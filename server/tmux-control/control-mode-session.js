/**
 * One ControlModeSession per tmux session attached in control-mode.
 *
 * Wraps a node-pty spawn of `tmux -CC` and exposes:
 *   - .start() — spawn tmux, begin parsing.
 *   - .write(data) — forward user input to a specific pane via send-keys -H.
 *   - .resize(cols, rows) — propagate terminal size changes.
 *   - .stop() — kill the underlying tmux client (the SERVER stays alive,
 *     so the session and its history persist for next attachment).
 *   - .on('output', cb) — fired with { paneId, data } for every %output.
 *   - .on('structure', cb) — fired with state-snapshot diffs whenever
 *     windows/panes change.
 *   - .on('exit', cb) — fired when tmux client exits.
 *
 * Multiple WebSocket clients can attach to the same ControlModeSession;
 * the WebSocket bridge forwards events from this single session to all
 * subscribers, replicating tmux's natural multi-client behaviour.
 */

'use strict';

const { EventEmitter } = require('node:events');
const pty = require('node-pty');
const { ControlModeLineBuffer, buildSendKeysCommands } = require('./parser');
const { SessionState } = require('./session-state');

const DEFAULT_SOCKET = 'muxterm';
const DEFAULT_TMUX_CONF = null; // resolved by caller; null = no -f flag

const RECENT_OUTPUT_BUFFER_LIMIT = 10_000;

class ControlModeSession extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string} opts.sessionName    tmux session name (e.g. webssh_ws_1_xxx)
   * @param {string} [opts.socket]        tmux socket name (-L). default 'muxterm'
   * @param {string} [opts.confPath]      path to tmux .conf (-f). optional
   * @param {number} [opts.cols]          initial pty width
   * @param {number} [opts.rows]          initial pty height
   * @param {string} [opts.cwd]
   * @param {object} [opts.env]
   */
  constructor(opts) {
    super();
    this.sessionName = opts.sessionName;
    this.socket = opts.socket || DEFAULT_SOCKET;
    this.confPath = opts.confPath || DEFAULT_TMUX_CONF;
    this.cols = opts.cols || 80;
    this.rows = opts.rows || 24;
    this.cwd = opts.cwd || process.env.HOME;
    this.env = opts.env || process.env;

    this.state = new SessionState();
    this._tmux = null;
    this._buffer = null;
    this._stopped = false;

    /** Recent %output entries for replay to newly-connected clients.
     *  Each entry: { paneId, data }. Capped at RECENT_OUTPUT_BUFFER_LIMIT. */
    this._recentOutput = [];
  }

  start() {
    if (this._tmux) throw new Error('ControlModeSession already started');

    const args = ['-L', this.socket, '-CC'];
    if (this.confPath) args.push('-f', this.confPath);
    args.push('new-session', '-A', '-s', this.sessionName);

    this._tmux = pty.spawn('tmux', args, {
      name: 'xterm-256color',
      cols: this.cols,
      rows: this.rows,
      cwd: this.cwd,
      env: this.env,
    });

    this._buffer = new ControlModeLineBuffer((event) => this._onEvent(event));

    this._tmux.onData((chunk) => this._buffer.feed(chunk.toString()));

    this._tmux.onExit(({ exitCode, signal }) => {
      this._tmux = null;
      this._buffer = null;
      this.emit('exit', { exitCode, signal });
    });

    // Tmux only emits %layout-change when the layout actually changes —
    // a freshly attached session that's been stable won't fire one, so
    // the client never learns the structure. Force a synthetic refresh:
    // after a short delay, ask tmux to redraw the client. The redraw
    // path emits layout-change for every visible window.
    setTimeout(() => {
      if (this._tmux && !this._stopped) {
        try { this._tmux.write('refresh-client -S\n'); } catch (_) {}
      }
    }, 250);

    return this;
  }

  _onEvent(event) {
    // 1. Apply to state model. Will fire 'structure' for structural events.
    this.state.apply(event);

    // 2. Output goes to subscribers AND to the recent-output ring buffer.
    if (event.type === 'output') {
      this._recentOutput.push({ paneId: event.paneId, data: event.data });
      if (this._recentOutput.length > RECENT_OUTPUT_BUFFER_LIMIT) {
        this._recentOutput.shift();
      }
      this.emit('output', { paneId: event.paneId, data: event.data });
      return;
    }

    // 3. Structural events fire the snapshot for clients to re-render
    //    their UI (window/pane lists, layout, names).
    if (
      event.type === 'window-add' ||
      event.type === 'unlinked-window-add' ||
      event.type === 'window-close' ||
      event.type === 'window-renamed' ||
      event.type === 'layout-change' ||
      event.type === 'session-changed' ||
      event.type === 'sessions-changed'
    ) {
      this.emit('structure', this.state.snapshot());
    }

    if (event.type === 'unknown') {
      this.emit('unknown', event.raw);
    }
  }

  /**
   * Forward bytes to a specific pane via tmux send-keys -H.
   * @param {string} paneId   e.g. "%0"
   * @param {string} data     raw bytes (utf-8 string)
   */
  writeToPane(paneId, data) {
    if (!this._tmux) return;
    if (!data) return;
    const commands = buildSendKeysCommands(paneId, data);
    for (const cmd of commands) {
      this._tmux.write(cmd + '\n');
    }
  }

  /**
   * Resize all panes of the session (this is what tmux does on
   * window-size change). The control-mode pty itself also resizes.
   */
  resize(cols, rows) {
    if (!this._tmux) return;
    this.cols = cols;
    this.rows = rows;
    try { this._tmux.resize(cols, rows); } catch (_) {}
    // Refresh-client triggers tmux to redraw to the new geometry.
    this._tmux.write(`refresh-client -C ${cols}x${rows}\n`);
  }

  /** Send an arbitrary tmux command via the control-mode channel. */
  command(cmd) {
    if (!this._tmux) return;
    this._tmux.write(cmd + '\n');
  }

  /** Recent output buffer for replay. */
  recentOutput() { return this._recentOutput.slice(); }

  /** Stop only this control-mode CLIENT. The server keeps the session alive. */
  stop() {
    if (this._stopped) return;
    this._stopped = true;
    if (this._tmux) {
      try { this._tmux.write('detach-client\n'); } catch (_) {}
      // give tmux a beat to detach cleanly, then kill
      setTimeout(() => {
        if (this._tmux) {
          try { this._tmux.kill(); } catch (_) {}
        }
      }, 200);
    }
  }
}

module.exports = { ControlModeSession };
