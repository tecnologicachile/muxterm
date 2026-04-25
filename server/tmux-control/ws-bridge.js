/**
 * WebSocket bridge that exposes one or more ControlModeSessions over a
 * Socket.IO namespace.
 *
 * Multi-client: each ControlModeSession is shared by every client that
 * subscribes to its session name. tmux replicates output to all attached
 * clients via control mode; this bridge replicates the resulting events
 * to all attached WebSockets.
 *
 * Per-client tracking (NOT per-session) is intentional:
 *   - scroll position lives in xterm.js on the client → independent.
 *   - input from each client is forwarded to the same shared pane via
 *     send-keys, just like multiple tmux clients in attach-session mode.
 *
 * Wire protocol (JSON over Socket.IO events):
 *   client → server:
 *     'cm:attach'  { sessionName, cols, rows }   subscribe to / create session
 *     'cm:input'   { sessionName, paneId, data } forward bytes to pane
 *     'cm:resize'  { sessionName, cols, rows }   inform tmux of new size
 *     'cm:cmd'     { sessionName, cmd }          arbitrary tmux command
 *     'cm:detach'  { sessionName }               unsubscribe
 *
 *   server → client:
 *     'cm:attached' { sessionName, snapshot, recentOutput }
 *     'cm:output'   { sessionName, paneId, data }
 *     'cm:structure' { sessionName, snapshot }
 *     'cm:exit'     { sessionName, exitCode, signal }
 *     'cm:error'    { sessionName, message }
 */

'use strict';

const { ControlModeSession } = require('./control-mode-session');

/**
 * Singleton-ish manager: keeps a map of sessionName → ControlModeSession
 * across the whole server, so different sockets attaching to the same
 * session share state.
 */
class ControlModeManager {
  constructor(opts = {}) {
    this.socket = opts.socket || 'muxterm';
    this.confPath = opts.confPath || null;
    this._sessions = new Map();   // sessionName → ControlModeSession
    this._subscribers = new Map(); // sessionName → Set<socket>
  }

  _getOrCreate(sessionName, cols, rows) {
    let cms = this._sessions.get(sessionName);
    if (cms) return cms;

    cms = new ControlModeSession({
      sessionName,
      socket: this.socket,
      confPath: this.confPath,
      cols, rows,
    });

    cms.on('output', (e) => this._broadcast(sessionName, 'cm:output', { sessionName, ...e }));
    cms.on('structure', (snap) => this._broadcast(sessionName, 'cm:structure', { sessionName, snapshot: snap }));
    cms.on('exit', (e) => {
      this._broadcast(sessionName, 'cm:exit', { sessionName, ...e });
      this._sessions.delete(sessionName);
      this._subscribers.delete(sessionName);
    });

    cms.start();
    this._sessions.set(sessionName, cms);
    this._subscribers.set(sessionName, new Set());
    return cms;
  }

  _broadcast(sessionName, event, payload) {
    const subs = this._subscribers.get(sessionName);
    if (!subs) return;
    for (const sock of subs) {
      if (sock.connected) sock.emit(event, payload);
    }
  }

  attach(socket, sessionName, cols, rows) {
    const cms = this._getOrCreate(sessionName, cols, rows);
    this._subscribers.get(sessionName).add(socket);

    // Send initial snapshot + recent output (replay).
    socket.emit('cm:attached', {
      sessionName,
      snapshot: cms.state.snapshot(),
      recentOutput: cms.recentOutput(),
    });

    return cms;
  }

  detach(socket, sessionName) {
    const subs = this._subscribers.get(sessionName);
    if (subs) subs.delete(socket);
    // We do NOT stop the underlying tmux client — that's intentional, so
    // the session keeps running for other clients. tmux handles the
    // server-side persistence regardless.
  }

  detachAll(socket) {
    for (const [sessionName, subs] of this._subscribers) {
      subs.delete(socket);
    }
  }

  /** Forward input bytes from a client to a pane. */
  input(sessionName, paneId, data) {
    const cms = this._sessions.get(sessionName);
    if (cms) cms.writeToPane(paneId, data);
  }

  /** Forward resize from a client to tmux. */
  resize(sessionName, cols, rows) {
    const cms = this._sessions.get(sessionName);
    if (cms) cms.resize(cols, rows);
  }

  /** Forward arbitrary tmux command. */
  command(sessionName, cmd) {
    const cms = this._sessions.get(sessionName);
    if (cms) cms.command(cmd);
  }

  /** For diagnostics / health checks. */
  stats() {
    const out = {};
    for (const [name, subs] of this._subscribers) {
      out[name] = { subscribers: subs.size };
    }
    return out;
  }
}

/**
 * Wire a ControlModeManager to a Socket.IO namespace or io instance.
 * The auth/JWT layer is the caller's responsibility — this assumes the
 * socket is already authenticated.
 *
 * Returns the manager so the caller can close/inspect it.
 */
function attachToSocketIO(io, opts = {}) {
  const manager = new ControlModeManager(opts);

  io.on('connection', (socket) => {
    socket.on('cm:attach', ({ sessionName, cols, rows }) => {
      try {
        manager.attach(socket, sessionName, cols || 80, rows || 24);
      } catch (e) {
        socket.emit('cm:error', { sessionName, message: e.message });
      }
    });

    socket.on('cm:input', ({ sessionName, paneId, data }) => {
      manager.input(sessionName, paneId, data);
    });

    socket.on('cm:resize', ({ sessionName, cols, rows }) => {
      manager.resize(sessionName, cols, rows);
    });

    socket.on('cm:cmd', ({ sessionName, cmd }) => {
      manager.command(sessionName, cmd);
    });

    socket.on('cm:detach', ({ sessionName }) => {
      manager.detach(socket, sessionName);
    });

    socket.on('disconnect', () => {
      manager.detachAll(socket);
    });
  });

  return manager;
}

module.exports = { ControlModeManager, attachToSocketIO };
