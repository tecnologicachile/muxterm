/**
 * TerminalNativeMultiPane — renders all the panes of a tmux window as a
 * tree of resizable splits, each with its own xterm.js instance. Routes
 * each %output event to the matching pane.
 *
 * Companion to TerminalNative.jsx (single-pane). When the active window
 * has only one pane, this component degrades to behave like the
 * single-pane variant. When the window has splits, each leaf pane gets
 * its own canvas.
 *
 * The layout tree is provided by parseLayout() (server side parses the
 * tmux layout string and ships the structure inside cm:structure events).
 *
 * NOT used in production yet — this is the next step toward replacing
 * the legacy ttyd-based Terminal component for local/tmux terminals.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
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
 * Single pane wrapper — owns one xterm.js instance, attaches the touch
 * scroll handler, registers itself with the parent so the parent can
 * route writes/focus by paneId.
 */
function PaneXTerm({ paneId, isActive, onRegister, onUnregister, onInput, onResize, onFocus }) {
  const containerRef = useRef(null);
  const xtermRef = useRef(null);
  const fitRef = useRef(null);

  useEffect(() => {
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

    onRegister(paneId, {
      write: (data) => term.write(data),
      resize: () => { try { fit.fit(); } catch (_) {} },
      dispose: () => term.dispose(),
      focus: () => term.focus(),
      cols: () => term.cols,
      rows: () => term.rows,
    });

    const dInput = term.onData((data) => onInput(paneId, data));
    const dRes = term.onResize(({ cols, rows }) => onResize(paneId, cols, rows));

    // Click → mark this pane as the active one (sends focus to tmux too).
    const onClick = () => onFocus(paneId);
    containerRef.current.addEventListener('click', onClick);

    return () => {
      dInput.dispose();
      dRes.dispose();
      containerRef.current && containerRef.current.removeEventListener('click', onClick);
      onUnregister(paneId);
      term.dispose();
    };
  }, [paneId]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        position: 'relative',
        boxShadow: isActive ? 'inset 0 0 0 2px #00ff00' : 'inset 0 0 0 1px #222',
        boxSizing: 'border-box',
      }}
    />
  );
}

/**
 * Render the parsed layout tree as nested flexbox splits, with leaf
 * <PaneXTerm> at each pane node.
 */
function LayoutNode({ node, activePaneId, paneProps }) {
  if (!node) return null;

  if (node.type === 'pane') {
    return (
      <PaneXTerm
        paneId={node.id}
        isActive={node.id === activePaneId}
        {...paneProps}
      />
    );
  }

  // Split: row for vertical (panes side-by-side), column for horizontal.
  const flexDir = node.orientation === 'v' ? 'row' : 'column';
  const totalChildSize = node.children.reduce(
    (sum, c) => sum + (node.orientation === 'v' ? c.cols : c.rows), 0
  );

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: flexDir }}>
      {node.children.map((child, idx) => {
        const childSize = node.orientation === 'v' ? child.cols : child.rows;
        const flexGrow = childSize / totalChildSize;
        return (
          <Box key={`${child.type}-${idx}`} sx={{ flex: flexGrow, minWidth: 0, minHeight: 0 }}>
            <LayoutNode node={child} activePaneId={activePaneId} paneProps={paneProps} />
          </Box>
        );
      })}
    </Box>
  );
}

function TerminalNativeMultiPane({ socket, sessionName, onExit }) {
  const [layout, setLayout] = useState(null);
  const [activePaneId, setActivePaneId] = useState(null);
  const panesRef = useRef(new Map());
  const recentOutputBufferedRef = useRef([]);

  // Server protocol: cm:structure / cm:attached carries snapshot. The
  // layout tree is already parsed server-side in session-state.js, so
  // we just consume snapshot.windows[i].layoutTree directly.
  const applySnapshot = (snapshot) => {
    let activeWindowId = snapshot.activeWindowId;
    if (!activeWindowId && snapshot.windows.length > 0) {
      activeWindowId = snapshot.windows[0].id;
    }
    const w = snapshot.windows.find(x => x.id === activeWindowId);
    if (w && w.layoutTree) setLayout(w.layoutTree);
    if (snapshot.activePaneId) setActivePaneId(snapshot.activePaneId);
  };

  // Pane registration: PaneXTerm calls back when its xterm is ready.
  const registerPane = (paneId, api) => {
    panesRef.current.set(paneId, api);
    // Flush any output buffered before this pane was ready.
    const pending = recentOutputBufferedRef.current.filter(o => o.paneId === paneId);
    for (const o of pending) api.write(o.data);
    recentOutputBufferedRef.current = recentOutputBufferedRef.current.filter(o => o.paneId !== paneId);
    if (paneId === activePaneId) api.focus();
  };
  const unregisterPane = (paneId) => panesRef.current.delete(paneId);

  // Forward input from a specific pane.
  const onPaneInput = (paneId, data) => {
    socket.emit('cm:input', { sessionName, paneId, data });
  };
  const onPaneResize = (paneId, cols, rows) => {
    // For multi-pane we can't really tell tmux "this single pane resized".
    // Tmux pane sizes are derived from the window size + layout. We
    // forward the active window viewport on resize via cm:resize. The
    // outer-most container fitting handles it.
    socket.emit('cm:resize', { sessionName, cols, rows });
  };
  const onPaneFocus = (paneId) => {
    setActivePaneId(paneId);
    // Tell tmux to make this pane active so future commands target it.
    socket.emit('cm:cmd', { sessionName, cmd: 'select-pane -t ' + paneId });
  };

  // Hook up socket handlers once.
  useEffect(() => {
    const onAttached = ({ sessionName: sn, snapshot, recentOutput }) => {
      if (sn !== sessionName) return;
      applySnapshot(snapshot);
      // Buffer the recent output: if we don't have a pane registered yet
      // (xterm.js takes a moment), the buffer flushes when register fires.
      for (const entry of recentOutput) {
        const api = panesRef.current.get(entry.paneId);
        if (api) api.write(entry.data);
        else recentOutputBufferedRef.current.push(entry);
      }
    };
    const onOutput = ({ sessionName: sn, paneId, data }) => {
      if (sn !== sessionName) return;
      const api = panesRef.current.get(paneId);
      if (api) api.write(data);
      else recentOutputBufferedRef.current.push({ paneId, data });
    };
    const onStructure = ({ sessionName: sn, snapshot }) => {
      if (sn !== sessionName) return;
      applySnapshot(snapshot);
    };
    const onExitMsg = ({ sessionName: sn, exitCode }) => {
      if (sn !== sessionName) return;
      if (onExit) onExit(exitCode);
    };

    socket.on('cm:attached', onAttached);
    socket.on('cm:output', onOutput);
    socket.on('cm:structure', onStructure);
    socket.on('cm:exit', onExitMsg);

    socket.emit('cm:attach', { sessionName, cols: 80, rows: 24 });

    return () => {
      socket.off('cm:attached', onAttached);
      socket.off('cm:output', onOutput);
      socket.off('cm:structure', onStructure);
      socket.off('cm:exit', onExitMsg);
      socket.emit('cm:detach', { sessionName });
    };
  }, [socket, sessionName]);

  // Trigger fit when layout changes, since splits resize their children.
  useEffect(() => {
    const t = setTimeout(() => {
      for (const api of panesRef.current.values()) api.resize();
    }, 50);
    return () => clearTimeout(t);
  }, [layout]);

  if (!layout) {
    return (
      <Box data-component="TerminalNativeMultiPane" data-state="connecting"
        sx={{ width: '100%', height: '100%', bgcolor: '#000', color: '#888', p: 2 }}>
        Connecting…
      </Box>
    );
  }

  const paneProps = {
    onRegister: registerPane,
    onUnregister: unregisterPane,
    onInput: onPaneInput,
    onResize: onPaneResize,
    onFocus: onPaneFocus,
  };

  return (
    <Box data-component="TerminalNativeMultiPane" sx={{ width: '100%', height: '100%' }}>
      <LayoutNode node={layout} activePaneId={activePaneId} paneProps={paneProps} />
    </Box>
  );
}

export default TerminalNativeMultiPane;
