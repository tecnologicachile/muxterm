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
 *
 * Multi-user safety: the wire-level `sessionName` is opaque from the
 * client (any string the client picks, typically the panel UUID). The
 * server transparently namespaces it to `mxt-<userId>-<sessionName>`
 * before touching tmux or the internal maps. Clients can never reach
 * another user's tmux session even if they guess the panel UUID.
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
    if (s && s.isAlive()) {
      // Existing tmux client — bring it up to the new browser's size
      // immediately. Without this, a fresh subscriber inherits whatever
      // size the previous (possibly mobile) client had pinned, even if
      // its own viewport is much larger.
      try { s.resize(cols, rows); } catch (_) {}
      return s;
    }

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

  /**
   * Translate the client's opaque sessionName into the per-user tmux
   * name. Returns null if the input is invalid.
   */
  _resolve(socket, sessionName) {
    const userId = socket && socket.userId;
    if (!userId) return null;
    if (typeof sessionName !== 'string') return null;
    // Allow alphanumerics, dash, underscore. Anything weirder is rejected
    // so the namespacing can't be escaped by a crafted payload.
    if (!/^[A-Za-z0-9_-]+$/.test(sessionName)) return null;
    if (sessionName.length > 128) return null;
    return `mxt-${userId}-${sessionName}`;
  }

  async attach(socket, { sessionName, cols, rows }) {
    const resolved = this._resolve(socket, sessionName);
    if (!resolved) {
      socket.emit('nt:error', { sessionName, message: 'invalid or unauthenticated session' });
      return;
    }

    // 1. Pre-load existing scrollback (if any). Done BEFORE spawning
    //    the live attach to avoid duplicates: capture-pane reads what
    //    tmux already has; the live attach is what comes next.
    const scrollback = await preload({
      sessionName: resolved,
      socket: this.socket,
    });

    // 2. Spawn or reuse the AttachSession.
    this._getOrCreate(resolved, cols || 80, rows || 24);
    this._subs.get(resolved).add(socket);

    // 3. Send the scrollback to this client only. Live data follows.
    //    The wire-level sessionName stays opaque (we echo what the
    //    client sent, not the internal name).
    socket.emit('nt:attached', { sessionName, scrollback });
  }

  detach(socket, sessionName) {
    // Accept either the raw client name (resolve again) or the already-
    // resolved name (used by detachAll, which iterates the map keys).
    const resolved = sessionName.startsWith('mxt-')
      ? sessionName
      : this._resolve(socket, sessionName);
    if (!resolved) return;
    const subs = this._subs.get(resolved);
    if (subs) subs.delete(socket);
    // Don't kill the AttachSession — others might still be using it,
    // and even if not, tmux session keeps living anyway. The
    // AttachSession will get garbage collected when tmux client exits.
    if (subs && subs.size === 0) {
      const s = this._sessions.get(resolved);
      if (s) {
        s.stop();
        this._sessions.delete(resolved);
      }
      this._subs.delete(resolved);
    }
  }

  detachAll(socket) {
    for (const resolved of Array.from(this._subs.keys())) {
      const subs = this._subs.get(resolved);
      if (subs && subs.has(socket)) this.detach(socket, resolved);
    }
  }

  input(socket, sessionName, data) {
    const resolved = this._resolve(socket, sessionName);
    if (!resolved) return;
    const s = this._sessions.get(resolved);
    if (s) s.write(data);
  }

  resize(socket, sessionName, cols, rows) {
    const resolved = this._resolve(socket, sessionName);
    if (!resolved) return;
    const s = this._sessions.get(resolved);
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
      if (sessionName != null && data != null) manager.input(socket, sessionName, data);
    });
    socket.on('nt:resize', ({ sessionName, cols, rows }) => {
      if (sessionName != null) manager.resize(socket, sessionName, cols, rows);
    });
    socket.on('nt:detach', ({ sessionName }) => {
      if (sessionName != null) manager.detach(socket, sessionName);
    });
    socket.on('disconnect', () => manager.detachAll(socket));
  });

  return manager;
}

module.exports = { NativeTerminalManager, attachToSocketIO };
