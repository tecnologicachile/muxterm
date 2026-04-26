/**
 * Pre-load the scrollback of a tmux pane as raw ANSI bytes (with colors).
 *
 * Used when a fresh client attaches to an existing tmux session: we
 * dump the pane's history with `tmux capture-pane -p -e -J -S -` and
 * stream those bytes to the client BEFORE the live attach starts.
 * xterm.js writes the dump into its scrollback buffer, so the user
 * scrolls back and sees the full history on a brand-new device — the
 * "history visible from any device" requirement.
 *
 * Flags used:
 *   -p       print to stdout (instead of writing to a buffer)
 *   -e       include escape sequences for colour/styling
 *   -J       join wrapped lines (so xterm.js can re-wrap to its width)
 *   -S -     start at the beginning of history (the entire scrollback)
 *
 * If the session/pane doesn't exist yet, returns an empty string.
 */

'use strict';

const { execFile } = require('node:child_process');

const TMUX_TIMEOUT_MS = 4000;

/**
 * @param {object} opts
 * @param {string} opts.sessionName
 * @param {string} [opts.socket='muxterm']
 * @param {string} [opts.target]  optional pane target. defaults to the
 *                                session's active pane.
 * @returns {Promise<string>}     the raw scrollback bytes (ANSI), or ''
 *                                if tmux had nothing to give us.
 */
function preload(opts) {
  return new Promise((resolve) => {
    const socket = opts.socket || 'muxterm';
    const target = opts.target || opts.sessionName;
    execFile(
      'tmux',
      ['-L', socket, 'capture-pane', '-p', '-e', '-J', '-S', '-', '-t', target],
      { timeout: TMUX_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          // Session/pane not found, or tmux not running. Either way, no
          // scrollback to return.
          resolve('');
          return;
        }
        resolve(stdout || '');
      }
    );
  });
}

module.exports = { preload };
