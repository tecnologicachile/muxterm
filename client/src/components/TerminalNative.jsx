/**
 * TerminalNative — terminal panel using xterm.js directly (no iframe).
 *
 * Replaces the legacy ttyd-iframe terminal for local/tmux sessions:
 *   - xterm.js mounts inside this React component.
 *   - Server side spawns `tmux attach-session -s <name>` with node-pty
 *     and bridges ANSI bytes to/from this socket.
 *   - 50,000 lines of local scrollback in xterm.js → wheel/swipe scroll
 *     works natively, no buttons.
 *   - When connecting/reconnecting the server pre-loads the existing
 *     tmux scrollback (capture-pane) so opening on a new device shows
 *     the full history.
 *
 * Wire protocol (mirror of server/native-terminal/ws-bridge.js):
 *   client → server: nt:attach / nt:input / nt:resize / nt:detach
 *   server → client: nt:attached (with scrollback) / nt:data / nt:exit
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { WebglAddon } from 'xterm-addon-webgl';
import { CanvasAddon } from 'xterm-addon-canvas';
import 'xterm/css/xterm.css';

const DEFAULT_THEME = {
  background: '#000000',
  foreground: '#f0f0f0',
  cursor: '#00ff00',
  cursorAccent: '#000000',
  selectionBackground: 'rgba(255,255,255,0.3)',
};

function TerminalNative({ socket, sessionName, onExit, className }) {
  const containerRef = useRef(null);
  const xtermRef = useRef(null);
  const fitRef = useRef(null);
  const attachedRef = useRef(false);
  const [status, setStatus] = useState('connecting');

  // 1. Init xterm.js once per (socket, sessionName).
  useEffect(() => {
    if (!containerRef.current) return undefined;

    const term = new XTerm({
      fontFamily: 'Fira Code, monospace',
      fontSize: 14,
      cursorBlink: true,
      scrollback: 50000,
      theme: DEFAULT_THEME,
      allowProposedApi: true,
      // Treat incoming '\n' as '\r\n'. tmux (and many shells) emit lone
      // line-feeds when redrawing — strict VT100 leaves the cursor in
      // the same column, producing a cascading-to-the-right effect on
      // simple commands like ls/pwd/date. ttyd's bundled xterm sets
      // this; we have to mirror it here.
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    // Default xterm.js renderer is the DOM renderer — extremely slow,
    // chars take ~1.5s to paint and the cursor lags behind. Try WebGL
    // first (best perf), fall back to Canvas, fall back to DOM only if
    // both fail. WebGL needs to be loaded AFTER term.open() because it
    // needs the canvas to be in the DOM.
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => { try { webgl.dispose(); } catch (_) {} });
      term.loadAddon(webgl);
    } catch (_) {
      try { term.loadAddon(new CanvasAddon()); } catch (__) {}
    }
    try { fit.fit(); } catch (_) {}

    xtermRef.current = term;
    fitRef.current = fit;
    // Expose for Playwright/E2E tests: read the buffer via the canonical
    // xterm.js API instead of the DOM (the WebGL renderer doesn't keep
    // .xterm-rows in sync). Production code never references this.
    if (typeof window !== 'undefined') window.__nativeTerm = term;

    // Forward keystrokes to the PTY.
    const dInput = term.onData((data) => {
      socket.emit('nt:input', { sessionName, data });
    });
    // Propagate viewport changes to the PTY (kernel ioctl atomically
    // updates winsize and tmux gets SIGWINCH — same path ttyd uses).
    const dRes = term.onResize(({ cols, rows }) => {
      socket.emit('nt:resize', { sessionName, cols, rows });
    });

    // Touch scroll for mobile: xterm.js absorbs touch events on the
    // canvas, so swipes started on text "stick" instead of scrolling.
    // Override on the container in capture phase to call scrollLines
    // ourselves.
    const containerEl = containerRef.current;
    let touch = null;
    const SCROLL_THRESHOLD_PX = 6;
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) { touch = null; return; }
      touch = { y0: e.touches[0].clientY, lastY: e.touches[0].clientY, scrolling: false };
    };
    const onTouchMove = (e) => {
      if (!touch || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      if (!touch.scrolling) {
        if (Math.abs(y - touch.y0) > SCROLL_THRESHOLD_PX) touch.scrolling = true;
        else return;
      }
      const cellH = (term._core && term._core._renderService
        && term._core._renderService.dimensions
        && term._core._renderService.dimensions.css
        && term._core._renderService.dimensions.css.cell
        && term._core._renderService.dimensions.css.cell.height) || 18;
      const dy = y - touch.lastY;
      const lines = Math.round(-dy / cellH);
      if (lines !== 0) {
        term.scrollLines(lines);
        touch.lastY = y;
      }
      e.preventDefault();
    };
    const onTouchEnd = () => { touch = null; };
    containerEl.addEventListener('touchstart', onTouchStart, { passive: true });
    containerEl.addEventListener('touchmove', onTouchMove, { passive: false });
    containerEl.addEventListener('touchend', onTouchEnd, { passive: true });
    containerEl.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      dInput.dispose();
      dRes.dispose();
      containerEl.removeEventListener('touchstart', onTouchStart);
      containerEl.removeEventListener('touchmove', onTouchMove);
      containerEl.removeEventListener('touchend', onTouchEnd);
      containerEl.removeEventListener('touchcancel', onTouchEnd);
      term.dispose();
    };
  }, [socket, sessionName]);

  // 2. Attach / detach from the server bridge.
  useEffect(() => {
    if (!socket || !sessionName) return undefined;

    const onAttached = ({ sessionName: sn, scrollback }) => {
      if (sn !== sessionName) return;
      const term = xtermRef.current;
      if (!term) return;
      // Write the historical scrollback BEFORE any live data shows up.
      if (scrollback) term.write(scrollback);
      attachedRef.current = true;
      setStatus('connected');
      // Re-fit AFTER the container has had time to lay out. Only emit
      // a resize if cols/rows actually changed — every SIGWINCH at the
      // server triggers tmux to redraw the viewport, which would echo
      // a fresh prompt and end up looking like duplicate output.
      setTimeout(() => {
        try {
          const fit = fitRef.current;
          if (!fit) return;
          const before = { cols: term.cols, rows: term.rows };
          fit.fit();
          if (term.cols !== before.cols || term.rows !== before.rows) {
            socket.emit('nt:resize', { sessionName, cols: term.cols, rows: term.rows });
          }
        } catch (_) {}
      }, 250);
    };

    const onData = ({ sessionName: sn, bytes }) => {
      if (sn !== sessionName) return;
      const term = xtermRef.current;
      if (term) term.write(bytes);
    };

    const onExitMsg = ({ sessionName: sn, exitCode }) => {
      if (sn !== sessionName) return;
      setStatus('exited');
      if (onExit) onExit(exitCode);
    };

    const onErr = ({ sessionName: sn, message }) => {
      if (sn !== sessionName) return;
      setStatus('error');
      const term = xtermRef.current;
      if (term) term.write(`\r\n\x1b[31m[muxterm] ${message}\x1b[0m\r\n`);
    };

    socket.on('nt:attached', onAttached);
    socket.on('nt:data', onData);
    socket.on('nt:exit', onExitMsg);
    socket.on('nt:error', onErr);

    const term = xtermRef.current;
    socket.emit('nt:attach', {
      sessionName,
      cols: term ? term.cols : 80,
      rows: term ? term.rows : 24,
    });

    return () => {
      socket.off('nt:attached', onAttached);
      socket.off('nt:data', onData);
      socket.off('nt:exit', onExitMsg);
      socket.off('nt:error', onErr);
      socket.emit('nt:detach', { sessionName });
      attachedRef.current = false;
    };
  }, [socket, sessionName, onExit]);

  // 3. Re-fit on window resize and on Android keyboard show/hide.
  useEffect(() => {
    const refit = () => { try { fitRef.current && fitRef.current.fit(); } catch (_) {} };
    window.addEventListener('resize', refit);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', refit);
    const t = setTimeout(refit, 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', refit);
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', refit);
    };
  }, []);

  return (
    <Box
      ref={containerRef}
      className={className}
      data-component="TerminalNative"
      data-status={status}
      sx={{ width: '100%', height: '100%', backgroundColor: '#000', position: 'relative' }}
    />
  );
}

export default TerminalNative;
