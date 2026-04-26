/**
 * WebSocket bridge: Socket.IO ↔ AttachSession (PTY).
 *
 * One AttachSession per (sessionName), shared by every Socket.IO client
 * that subscribes. tmux already replicates output to all attached
 * clients via attach-session; here we share ONE node-pty across all
 * subscribers and broadcast its bytes.
 *
 * Wire protocol (JSON over Socket.IO):
 *
 *   client → server:
 *     'nt:attach'   { sessionName, cols, rows }
 *     'nt:input'    { sessionName, data }
 *     'nt:resize'   { sessionName, cols, rows }
 *     'nt:detach'   { sessionName }
 *
 *   server → client:
 *     'nt:attached' { sessionName, scrollback }   // raw ANSI to write to xterm
 *     'nt:data'     { sessionName, bytes }
 *     'nt:exit'     { sessionName, exitCode }
 *     'nt:error'    { sessionName, message }
 */

'use strict';

const { AttachSession } = require('./attach-session');
const { preload } = require('./scrollback');

class NativeTerminalManager {
  constructor(opts = {}) {
    this.socket = opts.socket || 'muxterm';
    this.confPath = opts.confPath || null;
    this._sessions = new Map();   // sessionName → AttachSession
    this._subs = new Map();       // sessionName → Set<socket>
  }

  _getOrCreate(sessionName, cols, rows) {
    let s = this._sessions.get(sessionName);
    if (s && s.isAlive()) return s;

    s = new AttachSession({
      sessionName,
      socket: this.socket,
      confPath: this.confPath,
      cols, rows,
      createIfMissing: true,
    });

    s.on('data', (bytes) => this._broadcast(sessionName, 'nt:data', { sessionName, bytes }));
    s.on('exit', (e) => {
      this._broadcast(sessionName, 'nt:exit', { sessionName, exitCode: e.exitCode });
      this._sessions.delete(sessionName);
      this._subs.delete(sessionName);
    });

    s.start();
    this._sessions.set(sessionName, s);
    this._subs.set(sessionName, new Set());
    return s;
  }

  _broadcast(sessionName, event, payload) {
    const subs = this._subs.get(sessionName);
    if (!subs) return;
    for (const sock of subs) {
      if (sock.connected) sock.emit(event, payload);
    }
  }

  async attach(socket, { sessionName, cols, rows }) {
    if (!sessionName) {
      socket.emit('nt:error', { sessionName, message: 'sessionName required' });
      return;
    }

    // 1. Pre-load existing scrollback (if any). Done BEFORE spawning
    //    the live attach to avoid duplicates: capture-pane reads what
    //    tmux already has; the live attach is what comes next.
    const scrollback = await preload({
      sessionName,
      socket: this.socket,
    });

    // 2. Spawn or reuse the AttachSession.
    this._getOrCreate(sessionName, cols || 80, rows || 24);
    this._subs.get(sessionName).add(socket);

    // 3. Send the scrollback to this client only. Live data follows.
    socket.emit('nt:attached', { sessionName, scrollback });
  }

  detach(socket, sessionName) {
    const subs = this._subs.get(sessionName);
    if (subs) subs.delete(socket);
    // Don't kill the AttachSession — others might still be using it,
    // and even if not, tmux session keeps running anyway. The
    // AttachSession will get garbage collected when tmux client exits.
    if (subs && subs.size === 0) {
      const s = this._sessions.get(sessionName);
      if (s) {
        s.stop();
        this._sessions.delete(sessionName);
      }
      this._subs.delete(sessionName);
    }
  }

  detachAll(socket) {
    for (const sessionName of Array.from(this._subs.keys())) {
      this.detach(socket, sessionName);
    }
  }

  input(sessionName, data) {
    const s = this._sessions.get(sessionName);
    if (s) s.write(data);
  }

  resize(sessionName, cols, rows) {
    const s = this._sessions.get(sessionName);
    if (s) s.resize(cols, rows);
  }
}

/**
 * Wire a NativeTerminalManager onto a Socket.IO server. The socket is
 * assumed to be already authenticated by the caller.
 */
function attachToSocketIO(io, opts = {}) {
  const manager = new NativeTerminalManager(opts);

  io.on('connection', (socket) => {
    socket.on('nt:attach', (payload) => {
      manager.attach(socket, payload || {}).catch((e) => {
        socket.emit('nt:error', { sessionName: payload && payload.sessionName, message: e.message });
      });
    });
    socket.on('nt:input', ({ sessionName, data }) => {
      if (sessionName != null && data != null) manager.input(sessionName, data);
    });
    socket.on('nt:resize', ({ sessionName, cols, rows }) => {
      if (sessionName != null) manager.resize(sessionName, cols, rows);
    });
    socket.on('nt:detach', ({ sessionName }) => {
      if (sessionName != null) manager.detach(socket, sessionName);
    });
    socket.on('disconnect', () => manager.detachAll(socket));
  });

  return manager;
}

module.exports = { NativeTerminalManager, attachToSocketIO };
