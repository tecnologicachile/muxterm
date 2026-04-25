/**
 * TerminalNative — terminal panel that uses xterm.js DIRECTLY (no iframe,
 * no ttyd) and consumes a tmux control-mode stream from the server.
 *
 * Key differences from the legacy `Terminal` component:
 *   - xterm.js runs INSIDE this component, not inside an iframe served
 *     by ttyd. We control the xterm.js instance — it can have native
 *     scrollback, addons, themes, etc.
 *   - Bytes come from the server via Socket.IO 'cm:output' events.
 *   - The historical tmux scrollback is delivered as 'cm:attached'
 *     payload (recentOutput[]) and replayed in order.
 *   - Wheel/swipe scroll just works because xterm.js owns the buffer.
 *   - User input goes back via 'cm:input' (server forwards to tmux as
 *     send-keys -H).
 *
 * Multi-client: nothing special on the client side. The server
 * replicates output to every attached socket; each client has its own
 * xterm.js buffer and independent scroll position.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

const DEFAULT_THEME = {
  background: '#000000',
  foreground: '#f0f0f0',
  cursor: '#00ff00',
  cursorAccent: '#000000',
  selectionBackground: 'rgba(255,255,255,0.3)',
};

/**
 * Props:
 *   socket        Socket.IO client (already authenticated)
 *   sessionName   tmux session name to attach to (e.g. webssh_ws_1_xxx)
 *   onExit?       () => void
 *   className?    string for the container
 */
function TerminalNative({ socket, sessionName, onExit, className }) {
  const containerRef = useRef(null);
  const xtermRef = useRef(null);
  const fitRef = useRef(null);
  const activePaneRef = useRef(null);
  const [status, setStatus] = useState('connecting');

  // Init xterm instance once (per mount).
  useEffect(() => {
    if (!containerRef.current) return undefined;

    const term = new XTerm({
      fontFamily: 'Fira Code, monospace',
      fontSize: 14,
      cursorBlink: true,
      scrollback: 50000,
      theme: DEFAULT_THEME,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    try { fit.fit(); } catch (_) {}

    xtermRef.current = term;
    fitRef.current = fit;

    // Forward keystrokes to the active pane via the socket.
    const inputDisposable = term.onData((data) => {
      if (!activePaneRef.current) return;
      socket.emit('cm:input', {
        sessionName,
        paneId: activePaneRef.current,
        data,
      });
    });

    // Inform tmux of our viewport when we resize.
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      socket.emit('cm:resize', { sessionName, cols, rows });
    });

    return () => {
      inputDisposable.dispose();
      resizeDisposable.dispose();
      term.dispose();
    };
  }, [socket, sessionName]);

  // Hook up socket event handlers.
  useEffect(() => {
    if (!socket || !sessionName) return undefined;

    const onAttached = ({ sessionName: sn, snapshot, recentOutput }) => {
      if (sn !== sessionName) return;
      activePaneRef.current = snapshot.activePaneId
        || (snapshot.panes[0] && snapshot.panes[0].id)
        || null;
      const term = xtermRef.current;
      if (term && recentOutput) {
        for (const entry of recentOutput) {
          term.write(entry.data);
        }
      }
      setStatus('connected');
    };

    const onOutput = ({ sessionName: sn, paneId, data }) => {
      if (sn !== sessionName) return;
      // Multi-pane support comes later — for now, route everything to
      // the active pane. When we add splits in the UI, each pane will
      // have its own xterm instance.
      if (paneId !== activePaneRef.current && activePaneRef.current) return;
      const term = xtermRef.current;
      if (term) term.write(data);
    };

    const onStructure = ({ sessionName: sn, snapshot }) => {
      if (sn !== sessionName) return;
      if (!activePaneRef.current && snapshot.activePaneId) {
        activePaneRef.current = snapshot.activePaneId;
      }
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

    socket.on('cm:attached', onAttached);
    socket.on('cm:output', onOutput);
    socket.on('cm:structure', onStructure);
    socket.on('cm:exit', onExitMsg);
    socket.on('cm:error', onErr);

    // Attach with an initial size; the term may resize later via fit().
    const term = xtermRef.current;
    socket.emit('cm:attach', {
      sessionName,
      cols: term ? term.cols : 80,
      rows: term ? term.rows : 24,
    });

    return () => {
      socket.off('cm:attached', onAttached);
      socket.off('cm:output', onOutput);
      socket.off('cm:structure', onStructure);
      socket.off('cm:exit', onExitMsg);
      socket.off('cm:error', onErr);
      socket.emit('cm:detach', { sessionName });
    };
  }, [socket, sessionName, onExit]);

  // Re-fit on window resize and on visualViewport changes (mobile keyboard).
  useEffect(() => {
    const refit = () => {
      try { fitRef.current && fitRef.current.fit(); } catch (_) {}
    };
    window.addEventListener('resize', refit);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', refit);
    }
    // Also fit shortly after mount in case the container size changed.
    const t = setTimeout(refit, 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', refit);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', refit);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        position: 'relative',
      }}
      data-status={status}
    />
  );
}

export default TerminalNative;
