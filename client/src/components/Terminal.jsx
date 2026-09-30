import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from '../utils/SocketContext';
import logger from '../utils/logger';

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

function Terminal({ terminalId, onClose, onTerminalCreated, isActive, panelId, onActivityChange, sshConnectionId }) {
  const iframeRef = useRef(null);
  const { socket, isReconnected, becameVisible } = useSocket();
  const [localTerminalId, setLocalTerminalId] = useState(terminalId);
  const [iframeReady, setIframeReady] = useState(false);
  const [hasActivity, setHasActivity] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
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
  useEffect(() => {
    if (!iframeRef.current) return;
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
      } catch (e) {}
    };
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

    // 2) Staggered dispatch on activate/remount to cover cases where the container
    //    size doesn't change but xterm.js still has a stale column count (tab switch, etc.)
    const timers = [];
    if (isActive && iframeReady) {
      [100, 350, 800, 1500].forEach(delay => {
        timers.push(setTimeout(dispatchResize, delay));
      });
    }

    return () => {
      if (ro) ro.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
      timers.forEach(clearTimeout);
    };
  }, [iframeReady, isActive]);


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
