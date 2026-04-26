/**
 * AttachSession — manage one node-pty spawn of `tmux attach-session -t <name>`.
 *
 * This is the core of Option A: replace ttyd with our own tiny PTY bridge.
 * tmux client renders to the PTY in regular ANSI bytes (not control mode);
 * we forward those bytes to the browser unchanged. xterm.js on the
 * browser side renders them like any other terminal emulator.
 *
 * Resize is forwarded via node-pty's pty.resize(), which under the hood
 * is ioctl(TIOCSWINSZ) — same syscall ttyd uses, with kernel-level
 * atomicity. tmux receives SIGWINCH and adjusts the window. Whatever
 * comes out of tmux after that is already sized correctly.
 */

'use strict';

const { EventEmitter } = require('node:events');
const pty = require('node-pty');

const DEFAULT_SOCKET = 'muxterm';

class AttachSession extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string} opts.sessionName    tmux session name (e.g. webssh_ws_xxx)
   * @param {string} [opts.socket]        tmux socket name (-L). default 'muxterm'
   * @param {string} [opts.confPath]      path to .tmux.webssh.conf (-f). optional
   * @param {number} [opts.cols]
   * @param {number} [opts.rows]
   * @param {string} [opts.cwd]
   * @param {object} [opts.env]
   * @param {boolean} [opts.createIfMissing] use `new-session -A` instead of plain attach
   */
  constructor(opts) {
    super();
    this.sessionName = opts.sessionName;
    this.socket = opts.socket || DEFAULT_SOCKET;
    this.confPath = opts.confPath || null;
    this.cols = opts.cols || 80;
    this.rows = opts.rows || 24;
    this.cwd = opts.cwd || process.env.HOME;
    this.env = opts.env || process.env;
    this.createIfMissing = opts.createIfMissing !== false; // default true
    this._pty = null;
    this._stopped = false;
  }

  start() {
    if (this._pty) throw new Error('AttachSession already started');

    const args = ['-L', this.socket];
    if (this.confPath) args.push('-f', this.confPath);
    if (this.createIfMissing) {
      args.push('new-session', '-A', '-s', this.sessionName);
    } else {
      args.push('attach-session', '-t', this.sessionName);
    }

    this._pty = pty.spawn('tmux', args, {
      name: 'xterm-256color',
      cols: this.cols,
      rows: this.rows,
      cwd: this.cwd,
      env: this.env,
    });

    this._pty.onData((chunk) => {
      // Bytes come through as a string (utf8). Forward as-is — xterm.js
      // on the client will interpret them.
      this.emit('data', chunk.toString());
    });

    this._pty.onExit(({ exitCode, signal }) => {
      this._pty = null;
      this.emit('exit', { exitCode, signal });
    });

    return this;
  }

  /** Forward keystrokes from the browser to the tmux client stdin. */
  write(data) {
    if (!this._pty) return;
    try { this._pty.write(data); } catch (_) {}
  }

  /**
   * Resize via the kernel PTY ioctl. Atomic — tmux receives SIGWINCH
   * and any subsequent output respects the new dimensions. Same path
   * ttyd uses; same robustness.
   */
  resize(cols, rows) {
    if (!this._pty) return;
    if (cols < 1 || rows < 1) return;
    this.cols = cols;
    this.rows = rows;
    try { this._pty.resize(cols, rows); } catch (_) {}
  }

  /** Detach the tmux client. The session keeps living server-side. */
  stop() {
    if (this._stopped) return;
    this._stopped = true;
    if (this._pty) {
      try { this._pty.kill(); } catch (_) {}
      this._pty = null;
    }
  }

  isAlive() { return this._pty !== null; }
}

module.exports = { AttachSession };
