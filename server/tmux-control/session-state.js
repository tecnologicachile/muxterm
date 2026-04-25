/**
 * In-memory model of a tmux session driven by control-mode events.
 *
 * The parser produces individual events; this class consumes them and
 * keeps a coherent picture of the session's windows, panes and active
 * pane. Consumers (the WebSocket bridge, the React UI) read this model
 * to know what to render.
 *
 * Pane content is NOT stored here — that's xterm.js's job on the
 * client side. We only track structural metadata.
 */

'use strict';

class SessionState {
  constructor() {
    /** sessionId (e.g. "$0") → { id, name } */
    this.sessions = new Map();
    /** windowId (e.g. "@0") → { id, name, sessionId, layout, panes: Set<paneId> } */
    this.windows = new Map();
    /** paneId (e.g. "%0") → { id, windowId } */
    this.panes = new Map();

    this.activeSessionId = null;
    this.activeWindowId = null;
    this.activePaneId = null;

    /** Event subscribers — fired after every applied event */
    this._listeners = new Set();
  }

  on(fn) { this._listeners.add(fn); }
  off(fn) { this._listeners.delete(fn); }

  _emit(change) {
    for (const fn of this._listeners) {
      try { fn(change, this); } catch (_) { /* swallow */ }
    }
  }

  /** Apply a single parsed control-mode event. */
  apply(event) {
    switch (event.type) {
      case 'session-changed':
        this.activeSessionId = event.sessionId;
        if (!this.sessions.has(event.sessionId)) {
          this.sessions.set(event.sessionId, { id: event.sessionId, name: event.name || '' });
        } else {
          this.sessions.get(event.sessionId).name = event.name || '';
        }
        this._emit({ kind: 'session-changed', sessionId: event.sessionId });
        break;

      case 'sessions-changed':
        // Hint that the list of sessions changed; consumers can re-list.
        this._emit({ kind: 'sessions-changed' });
        break;

      case 'window-add':
      case 'unlinked-window-add':
        if (!this.windows.has(event.windowId)) {
          this.windows.set(event.windowId, {
            id: event.windowId,
            name: '',
            sessionId: this.activeSessionId,
            layout: null,
            panes: new Set(),
          });
        }
        this._emit({ kind: 'window-add', windowId: event.windowId });
        break;

      case 'window-close':
        if (this.windows.has(event.windowId)) {
          // Drop the window's panes too
          for (const paneId of this.windows.get(event.windowId).panes) {
            this.panes.delete(paneId);
          }
          this.windows.delete(event.windowId);
        }
        if (this.activeWindowId === event.windowId) this.activeWindowId = null;
        this._emit({ kind: 'window-close', windowId: event.windowId });
        break;

      case 'window-renamed': {
        const w = this.windows.get(event.windowId);
        if (w) w.name = event.name;
        this._emit({ kind: 'window-renamed', windowId: event.windowId, name: event.name });
        break;
      }

      case 'layout-change': {
        const w = this.windows.get(event.windowId);
        if (w) {
          w.layout = event.visibleLayout || event.layout;
          // Layout strings list panes — extract pane ids and seed the Set
          // so we know which panes the window currently has. tmux layout
          // format is "<checksum>,<dimensions>,<x>,<y>{,<id>|[<children>]}"
          // — ids are appended only at the leaf split level. For our
          // purposes we just record the raw layout; the pane list is
          // populated from %output events as they arrive.
        }
        this._emit({ kind: 'layout-change', windowId: event.windowId, layout: w ? w.layout : null });
        break;
      }

      case 'output': {
        // First time we see a paneId, register it under the active window.
        if (!this.panes.has(event.paneId)) {
          const targetWindowId = this.activeWindowId
            || (this.windows.size > 0 ? this.windows.keys().next().value : null);
          this.panes.set(event.paneId, { id: event.paneId, windowId: targetWindowId });
          if (targetWindowId && this.windows.has(targetWindowId)) {
            this.windows.get(targetWindowId).panes.add(event.paneId);
          }
        }
        if (!this.activePaneId) this.activePaneId = event.paneId;
        // Output events are not "structural"; we don't emit a state change
        // here — they're forwarded to xterm.js by the bridge instead.
        break;
      }

      case 'client-detached':
        this._emit({ kind: 'client-detached', client: event.client });
        break;

      case 'exit':
        this._emit({ kind: 'exit' });
        break;

      // begin / end / error are command transaction markers — ignored at
      // the state level.
      default:
        break;
    }
  }

  /** Snapshot for serialization to clients. */
  snapshot() {
    return {
      activeSessionId: this.activeSessionId,
      activeWindowId: this.activeWindowId,
      activePaneId: this.activePaneId,
      sessions: Array.from(this.sessions.values()),
      windows: Array.from(this.windows.values()).map(w => ({
        id: w.id,
        name: w.name,
        sessionId: w.sessionId,
        layout: w.layout,
        paneIds: Array.from(w.panes),
      })),
      panes: Array.from(this.panes.values()),
    };
  }
}

module.exports = { SessionState };
