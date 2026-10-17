import React, { useEffect, useRef, useState } from 'react';
import { eventFiles, carriesFiles, uploadFiles, clipboardFiles } from '../utils/pasteFiles';
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from '../utils/SocketContext';
import logger from '../utils/logger';

// When the person last touched this browser: a click, a key, a resize, or
// the page load itself. A browser left open on another notebook keeps its
// tab visible and its window "focused" for its own desktop, so neither
// tells the two apart; recent interaction does. Clicks inside a terminal's
// iframe are recorded from the iframe document (see onLoad).
window.__muxtermLastTouch = Date.now();
const touch = () => { window.__muxtermLastTouch = Date.now(); };
const TOUCH_FRESH_MS = 20000;
const touchedRecently = () => (Date.now() - (window.__muxtermLastTouch || 0)) < TOUCH_FRESH_MS;
if (typeof document !== 'undefined' && !window.__muxtermTouchTracked) {
  window.__muxtermTouchTracked = true;
  ['pointerdown', 'keydown', 'wheel'].forEach(ev => document.addEventListener(ev, touch, true));
  window.addEventListener('resize', touch);
  window.addEventListener('focus', touch);
}

// The last thing on the page that legitimately held the keyboard: a visible
// terminal's iframe, the chat composer, a text field. Hidden iframes are not
// recorded, so focus can be handed back when one of them grabs it.
if (typeof document !== 'undefined' && !window.__muxtermFocusTracked) {
  window.__muxtermFocusTracked = true;
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!el || el === document.body) return;
    try { if (el.tagName === 'IFRAME' && getComputedStyle(el).visibility === 'hidden') return; } catch (err) {}
    window.__muxtermLastFocus = el;
  }, true);
}
function focusTerminalIframe(el) {
  const w = el && el.contentWindow;
  const ta = w && w.document.querySelector('.xterm-helper-textarea');
  if (!ta) return false;
  w.focus(); ta.focus();
  return true;
}
function giveFocusBack() {
  // The page's own focusin does not see focus entering an iframe, so a
  // terminal records itself (window.__muxtermActiveIframe) when it takes
  // the keyboard legitimately. Only something you can type in is worth
  // going back to; a button or a tab that was merely clicked is not.
  const el = window.__muxtermLastFocus;
  const typable = el && el.isConnected && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) &&
    getComputedStyle(el).visibility !== 'hidden';
  const term = window.__muxtermActiveIframe;
  try {
    if (typable) { el.focus(); return; }
    if (term && term.isConnected && getComputedStyle(term).visibility !== 'hidden' && focusTerminalIframe(term)) return;
    window.focus(); document.body.focus();
  } catch (e) {}
}

function Terminal({ terminalId, onClose, onTerminalCreated, isActive, hidden, panelId, onActivityChange, sshConnectionId }) {
  const iframeRef = useRef(null);
  const { socket, isReconnected, becameVisible } = useSocket();
  const [localTerminalId, setLocalTerminalId] = useState(terminalId);
  const [iframeReady, setIframeReady] = useState(false);
  const [hasActivity, setHasActivity] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  // "Subiendo…" or an error while a pasted or dropped file goes up.
  const [pasteNote, setPasteNote] = useState(null);
  const pasteIdRef = useRef(null);
  pasteIdRef.current = localTerminalId || terminalId;
  // Set while a restore was requested only because the tab came back into
  // view; the reply then decides whether the iframe needs reloading at all.
  const visibilityRestoreRef = useRef(false);
  // Whether the terminal had keyboard focus when its iframe was reloaded, so
  // the fresh one can take it back instead of leaving the cursor nowhere.
  const refocusRef = useRef(false);
  // ttyd focuses its terminal on its own when the socket opens. That is
  // wanted only in the active pane; elsewhere, unless a click just happened,
  // it steals the cursor from wherever you were typing.
  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  // Whether the pane was under the chat view the last time the size effect
  // ran, so coming back from it counts as a reason to re-fit.
  const hiddenBeforeRef = useRef(!!hidden);
  const lastPointerRef = useRef(0);
  const TOUCH_DEVICE = typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const [retryPassword, setRetryPassword] = useState('');
  const [retrying, setRetrying] = useState(false);
  const activityTimeoutRef = useRef(null);
  const terminalCreatedRef = useRef(false);
  const requestIdRef = useRef(null);
  const retryCountRef = useRef(0);

  // Cleanup activity timeout on unmount
  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, []);

  // Request terminal creation if new
  useEffect(() => {
    if (!socket) return;
    if (localTerminalId || terminalId || terminalCreatedRef.current) return;

    terminalCreatedRef.current = true;
    requestIdRef.current = uuidv4();
    const createData = { requestId: requestIdRef.current };
    if (sshConnectionId) createData.sshConnectionId = sshConnectionId;
    socket.emit('create-terminal', createData);
  }, [socket, localTerminalId, terminalId]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleTerminalCreated = (data) => {
      if (!localTerminalId) {
        setLocalTerminalId(data.terminalId);
        setIframeReady(true);
        if (onTerminalCreated) onTerminalCreated(data.terminalId);
      }
    };

    const handleTerminalRestored = (data) => {
      if (data.terminalId === (localTerminalId || terminalId)) {
        if (!localTerminalId) setLocalTerminalId(data.terminalId);
        setIframeReady(true);
        // Force iframe reload on every terminal-restored.
        // terminal-restored only fires after a socket reconnect that triggered
        // restore-terminal, so we can safely assume ttyd's WS on the client
        // side is now stale: the previous xterm.js buffer still holds whatever
        // was rendered before the server restarted, and if we leave it alone
        // ttyd re-sends the current tmux snapshot which xterm.js APPENDS
        // without clearing, producing duplicated content on each restart.
        // Reloading the iframe src gives us a fresh xterm.js that attaches to
        // the (new) ttyd process with a clean buffer.
        // The conditional-detection approach we had before (poll for
        // "Reconnect" text at 500ms) missed cases where ttyd hadn't yet shown
        // the overlay, letting the duplication accumulate.
        //
        // Except when nothing restarted: on the desktop, coming back to the
        // tab used to reload the iframe anyway, which dropped the cursor out of
        // the terminal every time you switched windows. A phone still reloads,
        // since the OS freezes its tabs and the frozen xterm needs replacing.
        const fromVisibility = visibilityRestoreRef.current;
        visibilityRestoreRef.current = false;
        if (fromVisibility && data.respawned === false && !TOUCH_DEVICE) return;
        if (iframeRef.current) {
          refocusRef.current = document.activeElement === iframeRef.current;
          iframeRef.current.src = iframeRef.current.src;
        }
      }
    };

    const handleTerminalError = (data) => {
      logger.error('Terminal error:', data);
      if (data.message && (data.message.includes('not found') || data.message.includes('No terminal'))) {
        retryCountRef.current++;
        if (sshConnectionId && retryCountRef.current >= 2) {
          // SSH failed multiple times — likely auth failure
          setAuthFailed(true);
          return;
        }
        if (retryCountRef.current <= 3) {
          logger.info('Terminal lost, recreating (attempt ' + retryCountRef.current + ')...');
          setLocalTerminalId(null);
          terminalCreatedRef.current = false;
          requestIdRef.current = uuidv4();
          const createData = { requestId: requestIdRef.current };
          if (sshConnectionId) createData.sshConnectionId = sshConnectionId;
          socket.emit('create-terminal', createData);
        }
      }
    };

    const handleAuthFailed = (data) => {
      if (data.terminalId === localTerminalId) {
        setAuthFailed(true);
        retryCountRef.current = 999; // Stop auto-retry
      }
    };

    const handleTerminalActivity = (data) => {
      if (data.terminalId === localTerminalId) {
        setHasActivity(true);
        if (onActivityChange) onActivityChange(panelId, true);
        if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = setTimeout(() => {
          setHasActivity(false);
          if (onActivityChange) onActivityChange(panelId, false);
        }, 2000);
      }
    };

    // Listen on correlated event if we have a requestId, otherwise generic
    const createdEvent = requestIdRef.current ? `terminal-created-${requestIdRef.current}` : 'terminal-created';
    socket.on(createdEvent, handleTerminalCreated);
    socket.on('terminal-restored', handleTerminalRestored);
    socket.on('terminal-error', handleTerminalError);
    socket.on('terminal-activity', handleTerminalActivity);
    socket.on('terminal-auth-failed', handleAuthFailed);

    return () => {
      socket.off(createdEvent, handleTerminalCreated);
      socket.off('terminal-restored', handleTerminalRestored);
      socket.off('terminal-error', handleTerminalError);
      socket.off('terminal-activity', handleTerminalActivity);
      socket.off('terminal-auth-failed', handleAuthFailed);
    };
  }, [socket, localTerminalId, terminalId, onTerminalCreated, panelId, onActivityChange]);

  // Restore terminal if we have an existing ID
  useEffect(() => {
    if (!socket || !localTerminalId && !terminalId) return;
    const tid = localTerminalId || terminalId;
    socket.emit('restore-terminal', { terminalId: tid, sshConnectionId });
  }, [socket, localTerminalId, terminalId]);

  // Handle reconnection
  useEffect(() => {
    if (isReconnected && localTerminalId && socket) {
      socket.emit('restore-terminal', { terminalId: localTerminalId, sshConnectionId });
    }
  }, [isReconnected, localTerminalId, socket]);

  // Returning to a backgrounded tab (mobile): even when socket.io still thinks
  // it's connected, the ttyd iframe can be frozen — which is why it used to need
  // a keypress to wake. Re-emit restore-terminal so the server replies
  // terminal-restored and the iframe reloads with a fresh, live xterm buffer.
  useEffect(() => {
    if (becameVisible && localTerminalId && socket && socket.connected) {
      visibilityRestoreRef.current = true;
      socket.emit('restore-terminal', { terminalId: localTerminalId, sshConnectionId });
    }
    // If the socket is not connected yet, the forced reconnect in SocketContext
    // fires 'reconnect' → isReconnected above handles the restore once it's back.
  }, [becameVisible]);

  // Becoming the active pane hands it the keyboard, so switching windows or
  // panes leaves you typing where you left off. Never while the pane is
  // hidden (modo conversación owns the keyboard there) and never over a text
  // field you are already typing in.
  useEffect(() => {
    if (!isActive || !iframeReady) return;
    const tryFocus = () => {
      try {
        const el = iframeRef.current;
        if (!el || getComputedStyle(el).visibility === 'hidden') return true;
        const a = document.activeElement;
        if (a && a !== document.body && a.tagName !== 'IFRAME') return true;
        const w = el.contentWindow;
        const ta = w && w.document.querySelector('.xterm-helper-textarea');
        if (!ta) return false;
        w.focus(); ta.focus();
        return true;
      } catch (e) { return true; }
    };
    const timers = [120, 600, 1500].map(d => setTimeout(tryFocus, d));
    return () => timers.forEach(clearTimeout);
  }, [isActive, iframeReady]);

  // Watch container size changes + periodic re-measure on activation/mount.
  // Fixes distorted rendering when xterm.js gets out of sync with actual container size
  // (tab switches, panel activations, resize handle drags, etc.)
  // Helpers shared by the size effects below. Both leave a hidden pane alone.
  const dispatchResize = () => {
    try {
      // A hidden pane must stay quiet: tmux sizes a session to whichever
      // client spoke last, and a hidden pane on the desktop re-fitting
      // itself was overriding the size the phone had just asked for.
      const el = iframeRef.current;
      if (!el || getComputedStyle(el).visibility === 'hidden') return;
      const w = el.contentWindow;
      if (w) {
        w.dispatchEvent(new Event('resize'));
        if (w.term && typeof w.term.fit === 'function') w.term.fit();
      }
      setTimeout(adoptSize, 60);
    } catch (e) {}
  };
  // The tmux window takes the size of the pane the person is looking at,
  // and only that one. ttyd clients keep sending their sizes, but once a
  // visible pane has asked the server to fix the window (tmux switches it
  // to window-size manual) those are ignored until another visible pane
  // asks. A browser in a background tab, or a hidden pane, never asks:
  // that is what stops a second notebook left open from winning.
  const adoptSize = () => {
    try {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      // Two notebooks can both have the tab visible; the one whose browser
      // window has the keyboard focus is the one being worked on.
      if (typeof document !== 'undefined' && typeof document.hasFocus === 'function' && !document.hasFocus()) return;
      // Each notebook's browser window is "focused" for its own desktop;
      // only the one the person touched lately gets to ask.
      if (!touchedRecently()) return;
      const el = iframeRef.current;
      if (!el || getComputedStyle(el).visibility === 'hidden') return;
      const t = el.contentWindow && el.contentWindow.term;
      const tid = localTerminalId || terminalId;
      if (!t || !socket || !tid || !(t.cols > 1) || !(t.rows > 1)) return;
      socket.emit('adopt-terminal-size', { terminalId: tid, cols: t.cols, rows: t.rows });
    } catch (e) {}
  };
  // Re-fitting is not enough when another tmux client (the phone) sized
  // the window meanwhile: xterm only tells ttyd its size when its own
  // cols/rows change, and here they have not. Shrink by a column and fit
  // back, so the size goes out again and tmux, on window-size latest,
  // follows this pane.
  // xterm measures the glyph width once, when it starts. A pane that loaded
  // under modo conversación (or in a hidden window) measured a fallback
  // font before the real one was in, and keeps drawing cells that wide:
  // letters come out spaced apart. fit() does not re-measure; nudging the
  // font size does, and redraws everything.
  const remeasureFont = () => {
    try {
      const el = iframeRef.current;
      if (!el || getComputedStyle(el).visibility === 'hidden') return;
      const t = el.contentWindow && el.contentWindow.term;
      if (!t) return;
      const opts = t.options;
      if (opts && typeof opts.fontSize === 'number') {
        const fs = opts.fontSize;
        opts.fontSize = fs + 0.5;
        opts.fontSize = fs;
      } else if (typeof t.setOption === 'function' && typeof t.getOption === 'function') {
        const fs = t.getOption('fontSize');
        t.setOption('fontSize', fs + 0.5);
        t.setOption('fontSize', fs);
      }
      if (typeof t.fit === 'function') t.fit();
    } catch (e) {}
  };
  const resendSize = () => {
    try {
      const el = iframeRef.current;
      if (!el || getComputedStyle(el).visibility === 'hidden') return;
      const w = el.contentWindow;
      const t = w && w.term;
      if (!t || typeof t.resize !== 'function' || !(t.cols > 2)) return;
      t.resize(t.cols - 1, t.rows);
      setTimeout(() => {
        try { if (typeof t.fit === 'function') t.fit(); else w.dispatchEvent(new Event('resize')); } catch (e) {}
        setTimeout(adoptSize, 60);
      }, 30);
    } catch (e) {}
  };

  useEffect(() => {
    if (!iframeRef.current) return;
    let debounceTimer = null;
    const schedule = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(dispatchResize, 120);
    };

    // 1) ResizeObserver for actual size changes
    const target = iframeRef.current.parentElement;
    let ro = null;
    if (target && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule);
      ro.observe(target);
    }
    // Moving to this notebook and clicking into its browser: the selected
    // pane takes the tmux window back from the other one.
    const onFocus = () => { if (isActive && !hidden) schedule(); };
    window.addEventListener('focus', onFocus);

    // 2) Staggered dispatch on activate/remount to cover cases where the container
    //    size doesn't change but xterm.js still has a stale column count (tab switch, etc.)
    const timers = [];
    // On activation, and on coming back from modo conversación whether or
    // not this is the selected pane (the chat toggle does not select it).
    // A pane in a hidden window is still skipped: dispatchResize and
    // resendSize both check the iframe's computed visibility.
    if (iframeReady && !hidden && (isActive || hiddenBeforeRef.current)) {
      [100, 350, 800, 1500].forEach(delay => {
        timers.push(setTimeout(dispatchResize, delay));
      });
      // Make tmux take this pane's size even if xterm thinks nothing changed.
      timers.push(setTimeout(resendSize, 500));
    }
    hiddenBeforeRef.current = !!hidden;

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('focus', onFocus);
      if (debounceTimer) clearTimeout(debounceTimer);
      timers.forEach(clearTimeout);
    };
  }, [iframeReady, isActive, hidden]);


  // Waking the notebook: every ttyd iframe reconnects, the browser window
  // may still be regaining its geometry (an external display coming back),
  // and nothing above fires for a pane that was neither activated nor
  // under the chat. Two passes, late enough for ttyd to be back, on every
  // visible pane.
  useEffect(() => {
    if (!iframeReady || hidden) return;
    const timers = [1500, 4000].map(d => setTimeout(() => { dispatchResize(); setTimeout(resendSize, 200); }, d));
    return () => timers.forEach(clearTimeout);
  }, [becameVisible, isReconnected]);   // eslint-disable-line react-hooks/exhaustive-deps

  const getToken = () => {
    try { return localStorage.getItem('token') || ''; } catch (e) { return ''; }
  };

  const tid = localTerminalId || terminalId;
  const token = getToken();
  // Only load iframe after server confirms terminal is ready (iframeReady)
  // For new terminals: iframeReady is set by handleTerminalCreated flow
  // For restored terminals: iframeReady is set by handleTerminalRestored
  const ttydUrl = tid && iframeReady ? `/ttyd/${tid}/?token=${encodeURIComponent(token)}` : null;

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flex: 1,
          width: '100%',
          backgroundColor: '#000',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '50px',
          minWidth: '100px'
        }}
      >
        {ttydUrl ? (
          <>
            <iframe
              ref={iframeRef}
              src={ttydUrl}
              onLoad={() => {
                // A fresh ttyd connection sends its own size, which tmux no
                // longer follows: ask explicitly once xterm has measured.
                // The late pass covers a slow load, where xterm's final
                // fit lands after the first ones.
                [400, 1500, 4000].forEach(delay => setTimeout(adoptSize, delay));
                // Typing or clicking in the terminal happens inside the
                // iframe, where the page's listeners do not see it.
                try {
                  const d = iframeRef.current?.contentDocument;
                  if (d) ['pointerdown', 'keydown', 'wheel'].forEach(ev => d.addEventListener(ev, touch, true));
                } catch (e) {}
                if (refocusRef.current) {
                  refocusRef.current = false;
                  // xterm's textarea appears once ttyd has connected; try a few times.
                  [150, 500, 1200].forEach(delay => setTimeout(() => {
                    try {
                      const w = iframeRef.current?.contentWindow;
                      const ta = w && w.document.querySelector('.xterm-helper-textarea');
                      if (ta) { w.focus(); ta.focus(); }
                    } catch (e) {}
                  }, delay));
                }
                try {
                  const doc = iframeRef.current?.contentDocument;
                  if (doc) {
                    // Hide xterm.js scrollbar and pre-connection messages
                    const style = doc.createElement('style');
                    style.textContent = '.xterm-viewport::-webkit-scrollbar { display: none !important; } .xterm-viewport { scrollbar-width: none !important; overflow: hidden !important; } body { background: #000 !important; } body > :not(#terminal-container):not(.xterm) { display: none !important; }';
                    doc.head.appendChild(style);
                    // A pane in modo conversación, or in another window, keeps
                    // its iframe mounted but hidden, and ttyd focuses its
                    // terminal whenever its socket (re)connects. With several
                    // such panes on one page, the last one to connect took the
                    // cursor away from the terminal being typed in. A hidden
                    // pane never gets to keep focus.
                    // Blurring alone is not enough: the page then treats the
                    // hidden iframe itself as focused and keystrokes vanish
                    // into it, so the previous holder gets the focus back.
                    doc.addEventListener('focusin', (e) => {
                      try {
                        const el = iframeRef.current;
                        const hidden = el && getComputedStyle(el).visibility === 'hidden';
                        const uninvited = !isActiveRef.current && Date.now() - lastPointerRef.current > 1500;
                        if (hidden || uninvited) {
                          if (e.target && e.target.blur) e.target.blur();
                          setTimeout(giveFocusBack, 0);
                        } else {
                          window.__muxtermActiveIframe = el;
                          window.__muxtermLastFocus = el;
                        }
                      } catch (err) {}
                    }, true);
                    doc.addEventListener('pointerdown', () => { lastPointerRef.current = Date.now(); }, true);
                    doc.addEventListener('touchstart', () => { lastPointerRef.current = Date.now(); }, true);
                    // Propagate clicks to parent for panel selection
                    doc.addEventListener('mousedown', () => {
                      const container = iframeRef.current?.closest('[data-panel-id]');
                      if (container) container.click();
                    });

                    // Touch → wheel bridge for mobile scroll. We use BOTH a
                    // synthetic WheelEvent AND socket terminal-scroll events
                    // simultaneously. For main-screen panes (Claude Code) the
                    // WheelEvent is consumed by tmux copy-mode and the socket
                    // events are harmless duplicates. For alternate-screen
                    // panes (OpenCode, vim) the WheelEvent may be ignored, but
                    // the socket events trigger SGR mouse escapes in the server.
                    let __lastY = null;
                    let __pressTimer = null;
                    let __movedSinceStart = false;
                    let __pendingDeltas = 0;
                    let __flushTimer = null;
                    const __flushScroll = () => {
                      __flushTimer = null;
                      if (__pendingDeltas === 0) return;
                      const dir = __pendingDeltas > 0 ? 'up' : 'down';
                      const steps = Math.min(Math.abs(__pendingDeltas), 8);
                      __pendingDeltas = 0;
                      const tid = terminalId;
                      if (socket && tid) {
                        for (let s = 0; s < steps; s++)
                          socket.emit('terminal-scroll', { terminalId: tid, direction: dir, step: 'line' });
                      }
                    };
                    const __triggerLongPressCopy = () => {
                      try {
                        const panelEl = iframeRef.current && iframeRef.current.closest('[data-panel-id]');
                        if (!panelEl) return;
                        const copyBtn = panelEl.querySelector('button[title*="Copy terminal"]');
                        if (copyBtn) {
                          copyBtn.click();
                          if (navigator.vibrate) navigator.vibrate(40);
                        }
                      } catch (_) {}
                    };
                    doc.addEventListener('touchstart', (e) => {
                      if (e.touches.length !== 1) { __lastY = null; return; }
                      __lastY = e.touches[0].clientY;
                      __movedSinceStart = false;
                      if (__pressTimer) clearTimeout(__pressTimer);
                      __pressTimer = setTimeout(() => {
                        __pressTimer = null;
                        if (!__movedSinceStart) __triggerLongPressCopy();
                      }, 800);
                    }, { passive: true });
                    doc.addEventListener('touchmove', (e) => {
                      if (e.touches.length !== 1 || __lastY === null) return;
                      const y = e.touches[0].clientY;
                      const dy = y - __lastY;
                      __lastY = y;
                      if (Math.abs(dy) > 2) {
                        __movedSinceStart = true;
                        if (__pressTimer) { clearTimeout(__pressTimer); __pressTimer = null; }
                      }
                      if (Math.abs(dy) < 2) return;
                      // WheelEvent (fast path for main screen)
                      const target = doc.querySelector('.xterm-viewport') || doc.querySelector('.xterm') || doc.body;
                      try {
                        target.dispatchEvent(new WheelEvent('wheel', {
                          deltaY: -dy, bubbles: true, cancelable: true
                        }));
                      } catch (_) {}
                      // Socket scroll (backup for alternate screen)
                      __pendingDeltas += dy;
                      if (!__flushTimer) __flushTimer = setTimeout(__flushScroll, 40);
                      e.preventDefault();
                    }, { passive: false });
                    doc.addEventListener('touchend', () => {
                      __lastY = null;
                      if (__pressTimer) { clearTimeout(__pressTimer); __pressTimer = null; }
                    }, { passive: true });
                    doc.addEventListener('touchcancel', () => {
                      __lastY = null;
                      if (__pressTimer) { clearTimeout(__pressTimer); __pressTimer = null; }
                    }, { passive: true });

                    // OSC 52 handler — wire tmux's "send selection" escape
                    // (]52;c;<base64>) directly to the OS clipboard.
                    // ttyd's bundled xterm.js does not register OSC 52 by
                    // default, so we register one as soon as the iframe's
                    // `window.term` becomes available. With this hooked,
                    // every drag-without-Shift selection ends up in the
                    // user's clipboard automatically.
                    const __wireOsc52 = (attempt) => {
                      try {
                        const w = iframeRef.current && iframeRef.current.contentWindow;
                        const term = w && w.term;
                        if (term && term.parser && term.parser.registerOscHandler) {
                          term.parser.registerOscHandler(52, (data) => {
                            try {
                              const m = String(data).match(/^[a-z01-7]*;(.*)$/i);
                              if (!m) return false;
                              const txt = atob(m[1]);
                              if (navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(txt).catch(() => {});
                              }
                            } catch (_) {}
                            return true;
                          });
                          return;
                        }
                      } catch (_) {}
                      if (attempt < 20) setTimeout(() => __wireOsc52(attempt + 1), 250);
                    };
                    __wireOsc52(0);

                    // Clickable links that span rows. tmux redraws every row
                    // on its own, so xterm never marks a long URL's rows as
                    // wrapped and ttyd's web-links addon only sees the first
                    // row (and would open it cut). Rebuild the logical line
                    // from consecutive full rows, find whole URLs, and open
                    // them in a new tab. Registered ahead of ttyd's provider
                    // so the cut first-row link never wins.
                    const __wireLinks = (attempt) => {
                      try {
                        const w = iframeRef.current && iframeRef.current.contentWindow;
                        const term = w && w.term;
                        if (term && term.registerLinkProvider && term.buffer) {
                          const MAX_ROWS = 30;
                          const rowStr = (i) => {
                            const l = term.buffer.active.getLine(i);
                            return l ? l.translateToString(true) : '';
                          };
                          const full = (i) => {
                            const next = term.buffer.active.getLine(i + 1);
                            return rowStr(i).length >= term.cols || !!(next && next.isWrapped);
                          };
                          const provider = {
                            provideLinks: (y, callback) => {
                              try {
                                const cols = term.cols;
                                let first = y - 1;
                                while (first > 0 && (y - 1 - first) < MAX_ROWS && full(first - 1)) first--;
                                let last = first;
                                let text = rowStr(first).padEnd(full(first) ? cols : 0);
                                while (full(last) && (last - first) < MAX_ROWS) {
                                  last++;
                                  const r = rowStr(last);
                                  text += full(last) ? r.padEnd(cols) : r;
                                }
                                if ((y - 1) < first || (y - 1) > last) { callback(undefined); return; }
                                const links = [];
                                const re = /https?:\/\/[^\s"'<>`]+/g;
                                let m;
                                while ((m = re.exec(text))) {
                                  const url = m[0].replace(/[.,;:!?)\]}'"]+$/, '');
                                  const a = m.index, b = m.index + url.length - 1;
                                  const sRow = first + Math.floor(a / cols), eRow = first + Math.floor(b / cols);
                                  if ((y - 1) < sRow || (y - 1) > eRow) continue;
                                  links.push({
                                    text: url,
                                    range: { start: { x: (a % cols) + 1, y: sRow + 1 }, end: { x: (b % cols) + 1, y: eRow + 1 } },
                                    decorations: { underline: true, pointerCursor: true },
                                    activate: (_e, u) => { window.open(u, '_blank', 'noopener,noreferrer'); },
                                  });
                                }
                                callback(links.length ? links : undefined);
                              } catch (_) { callback(undefined); }
                            },
                          };
                          term.registerLinkProvider(provider);
                          // Move ahead of ttyd's single-row web-links provider
                          // (index 0 stays xterm's own OSC 8 hyperlinks).
                          try {
                            const list = term._core.linkifier2._linkProviders;
                            const i = list.indexOf(provider);
                            if (i > 1) { list.splice(i, 1); list.splice(1, 0, provider); }
                          } catch (_) {}
                          return;
                        }
                      } catch (_) {}
                      if (attempt < 20) setTimeout(() => __wireLinks(attempt + 1), 250);
                    };
                    __wireLinks(0);

                    // Pasted or dropped files: Ctrl+V reaches the browser, not
                    // Claude Code, so a screenshot in the clipboard would be
                    // lost. Upload it and paste the saved path instead, which
                    // Claude Code takes as an attached image (or a file to
                    // read). Text pastes go on to xterm untouched.
                    const __sendFiles = (files) => {
                      const tid = pasteIdRef.current;
                      if (!tid) return;
                      setPasteNote({ text: files.length > 1 ? `Subiendo ${files.length} archivos…` : 'Subiendo archivo…' });
                      uploadFiles(tid, files).then((paths) => {
                        setPasteNote(null);
                        const w = iframeRef.current && iframeRef.current.contentWindow;
                        if (w && w.term) { w.term.paste(paths); w.term.focus(); }
                      }).catch((err) => {
                        setPasteNote({ text: err.message, error: true });
                        setTimeout(() => setPasteNote(null), 5000);
                      });
                    };
                    // Ctrl+V never fires a paste event here: xterm sends it as
                    // ^V, which Claude Code answers by reading the clipboard of
                    // this server, not yours. Hold the key, look at the
                    // browser's clipboard, and send ^V on as before unless it
                    // holds an image.
                    doc.addEventListener('keydown', (e) => {
                      if (!(e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && (e.key === 'v' || e.key === 'V'))) return;
                      const w = iframeRef.current && iframeRef.current.contentWindow;
                      if (!w || !w.term) return;
                      e.preventDefault();
                      e.stopImmediatePropagation();
                      clipboardFiles(w.navigator).then((files) => {
                        if (files && files.length) { __sendFiles(files); return; }
                        try { w.term._core.coreService.triggerDataEvent('\x16', true); } catch (_) {}
                      });
                    }, true);
                    doc.addEventListener('paste', (e) => {
                      const files = eventFiles(e.clipboardData);
                      if (!files.length) return;
                      e.preventDefault();
                      e.stopImmediatePropagation();
                      __sendFiles(files);
                    }, true);
                    doc.addEventListener('dragover', (e) => {
                      if (!carriesFiles(e.dataTransfer)) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                    }, true);
                    doc.addEventListener('drop', (e) => {
                      const files = eventFiles(e.dataTransfer);
                      if (!files.length) return;
                      e.preventDefault();
                      e.stopImmediatePropagation();
                      __sendFiles(files);
                    }, true);
                  }
                } catch(e) {}
              }}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#000'
              }}
              allow="clipboard-read; clipboard-write"
              title={`Terminal ${panelId}`}
            />
          </>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#555',
            fontSize: '14px'
          }}>
            Connecting...
          </div>
        )}
      </div>
      {pasteNote && (
        <div style={{
          position: 'absolute', right: 8, bottom: 8, zIndex: 11, pointerEvents: 'none',
          padding: '4px 10px', borderRadius: 4, fontSize: '12px',
          backgroundColor: pasteNote.error ? 'rgba(80,0,0,0.9)' : 'rgba(20,20,20,0.9)',
          color: pasteNote.error ? '#ff8080' : '#9f9', border: `1px solid ${pasteNote.error ? '#a33' : '#2e6b45'}`
        }}>{pasteNote.text}</div>
      )}
      {/* Auth failed overlay */}
      {authFailed && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 10
        }}>
          <div style={{ textAlign: 'center', maxWidth: '300px' }}>
            <div style={{ color: '#f44', fontSize: '14px', marginBottom: '12px' }}>Authentication Failed</div>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>
              The password was rejected. Enter the correct password to reconnect.
            </div>
            <input
              type="password"
              placeholder="New password"
              value={retryPassword}
              onChange={(e) => setRetryPassword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && retryPassword && !retrying) {
                  setRetrying(true);
                  requestIdRef.current = uuidv4();
                  socket.emit('retry-ssh-connection', {
                    terminalId: localTerminalId,
                    sshConnectionId,
                    password: retryPassword,
                    requestId: requestIdRef.current
                  });
                  setAuthFailed(false);
                  setRetryPassword('');
                  setRetrying(false);
                  retryCountRef.current = 0;
                  terminalCreatedRef.current = false;
                  setLocalTerminalId(null);
                }
              }}
              style={{
                width: '100%', padding: '8px 12px', backgroundColor: '#222',
                border: '1px solid #444', borderRadius: '4px', color: '#fff',
                fontSize: '13px', marginBottom: '12px', outline: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  if (!retryPassword || retrying) return;
                  setRetrying(true);
                  requestIdRef.current = uuidv4();
                  socket.emit('retry-ssh-connection', {
                    terminalId: localTerminalId,
                    sshConnectionId,
                    password: retryPassword,
                    requestId: requestIdRef.current
                  });
                  setAuthFailed(false);
                  setRetryPassword('');
                  setRetrying(false);
                  retryCountRef.current = 0;
                  terminalCreatedRef.current = false;
                  setLocalTerminalId(null);
                }}
                disabled={!retryPassword || retrying}
                style={{
                  padding: '6px 16px', backgroundColor: '#00ff00', color: '#000',
                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                }}
              >Reconnect</button>
              <button
                onClick={() => setAuthFailed(false)}
                style={{
                  padding: '6px 16px', backgroundColor: '#333', color: '#888',
                  border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                }}
              >Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(Terminal);
