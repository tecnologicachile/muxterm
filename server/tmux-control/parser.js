/**
 * tmux control mode (-CC) protocol parser.
 *
 * In control mode, tmux emits structured text notifications instead of
 * drawing the terminal. The key notification is %output, which carries
 * the raw pane bytes (octal-encoded) — feeding them straight into an
 * xterm.js instance gives us native scrollback while keeping tmux as the
 * source of truth for persistence and multi-client replication.
 *
 * Protocol notifications (lines starting with `%`):
 *   %output %<paneId> <octal-encoded bytes>
 *   %begin <timestamp> <cmdNumber> <flags>
 *   %end <timestamp> <cmdNumber> <flags>
 *   %error <timestamp> <cmdNumber> <flags>
 *   %exit
 *   %session-changed $<sessionId> <name>
 *   %window-add @<windowId>
 *   %window-close @<windowId>
 *   %window-renamed @<windowId> <name>
 *   %unlinked-window-add @<windowId>
 *   %layout-change @<windowId> <layout> <visible-layout> <flags>
 *   %client-detached <client>
 *   %sessions-changed
 *
 * --
 *
 * The base parser (decodeTmuxOctal, encodeInputAsHex, parseControlLine
 * for %output/%begin/%end/%error/%exit, buildSendKeysCommands,
 * ControlModeLineBuffer) is adapted from clsh by my-claude-utils,
 * licensed under MIT. Source:
 *   https://github.com/my-claude-utils/clsh/blob/main/packages/agent/src/control-mode-parser.ts
 *
 * Extensions for multi-pane / multi-window support
 * (%window-add, %window-close, %window-renamed, %unlinked-window-add,
 *  %layout-change, %session-changed, %client-detached, %sessions-changed)
 * are MuxTerm-original.
 *
 * MIT License — see LICENSE in the repo root.
 */

'use strict';

/**
 * Decodes a tmux octal-encoded string.
 * tmux encodes bytes < 32 and backslash as `\NNN` (3 octal digits).
 * E.g. \033 → ESC (0x1B), \015 → CR, \012 → LF, \134 → backslash.
 */
function decodeTmuxOctal(encoded) {
  return encoded.replace(/\\(\d{3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/**
 * Encodes raw input bytes as space-separated hex pairs for `send-keys -H`.
 */
function encodeInputAsHex(data) {
  const parts = [];
  for (let i = 0; i < data.length; i++) {
    parts.push(data.charCodeAt(i).toString(16).padStart(2, '0'));
  }
  return parts.join(' ');
}

/**
 * Parses a single line of tmux control mode output.
 * Returns the event object, or null for non-event lines (DCS sequences,
 * empty lines, etc).
 */
function parseControlLine(line) {
  if (!line.startsWith('%')) return null;

  if (line.startsWith('%output ')) {
    // Format: %output %<paneId> <octal data>
    const rest = line.substring(8);
    const spaceIdx = rest.indexOf(' ');
    if (spaceIdx === -1) return null;
    return {
      type: 'output',
      paneId: rest.substring(0, spaceIdx),
      data: decodeTmuxOctal(rest.substring(spaceIdx + 1)),
    };
  }

  if (line.startsWith('%begin ')) {
    const parts = line.split(' ');
    return { type: 'begin', timestamp: parseInt(parts[1], 10), cmdNumber: parseInt(parts[2], 10) };
  }

  if (line.startsWith('%end ')) {
    const parts = line.split(' ');
    return { type: 'end', timestamp: parseInt(parts[1], 10), cmdNumber: parseInt(parts[2], 10) };
  }

  if (line.startsWith('%error ')) {
    const parts = line.split(' ');
    return { type: 'error', timestamp: parseInt(parts[1], 10), cmdNumber: parseInt(parts[2], 10) };
  }

  if (line === '%exit') return { type: 'exit' };

  if (line === '%sessions-changed') return { type: 'sessions-changed' };

  if (line.startsWith('%session-changed ')) {
    // Format: %session-changed $<sessionId> <name>
    const parts = line.split(' ');
    return { type: 'session-changed', sessionId: parts[1], name: parts.slice(2).join(' ') };
  }

  if (line.startsWith('%window-add ')) {
    return { type: 'window-add', windowId: line.substring(12).trim() };
  }

  if (line.startsWith('%unlinked-window-add ')) {
    return { type: 'unlinked-window-add', windowId: line.substring(21).trim() };
  }

  if (line.startsWith('%window-close ')) {
    return { type: 'window-close', windowId: line.substring(14).trim() };
  }

  if (line.startsWith('%window-renamed ')) {
    // Format: %window-renamed @<windowId> <name>
    const rest = line.substring(16);
    const spaceIdx = rest.indexOf(' ');
    if (spaceIdx === -1) return null;
    return {
      type: 'window-renamed',
      windowId: rest.substring(0, spaceIdx),
      name: rest.substring(spaceIdx + 1),
    };
  }

  if (line.startsWith('%layout-change ')) {
    // Format: %layout-change @<windowId> <layout> [<visible-layout> [<flags>]]
    const parts = line.substring(15).split(' ');
    return {
      type: 'layout-change',
      windowId: parts[0],
      layout: parts[1],
      visibleLayout: parts[2] || null,
      flags: parts[3] || null,
    };
  }

  if (line.startsWith('%client-detached ')) {
    return { type: 'client-detached', client: line.substring(17).trim() };
  }

  // Unknown notification — preserve so callers can log/trace if needed.
  return { type: 'unknown', raw: line };
}

/** Max input bytes per `send-keys -H` to keep tmux command length reasonable. */
const MAX_HEX_CHUNK = 512;

/**
 * Builds an array of `send-keys -t <target> -H <hex-pairs>` commands,
 * chunking input to avoid overly long single commands.
 * Caller is responsible for prefixing with `tmux -L <socket>` and joining.
 */
function buildSendKeysCommands(target, data) {
  const commands = [];
  for (let offset = 0; offset < data.length; offset += MAX_HEX_CHUNK) {
    const chunk = data.substring(offset, offset + MAX_HEX_CHUNK);
    commands.push(`send-keys -t ${target} -H ${encodeInputAsHex(chunk)}`);
  }
  return commands;
}

/**
 * Buffered line splitter for control mode PTY output.
 * Accumulates raw chunks from `pty.onData(...)`, splits on '\n', and
 * emits one parsed event per non-empty line.
 */
class ControlModeLineBuffer {
  constructor(callback) {
    this._buffer = '';
    this._callback = callback;
  }

  feed(data) {
    this._buffer += data;

    let nl;
    while ((nl = this._buffer.indexOf('\n')) !== -1) {
      const line = this._buffer.substring(0, nl).replace(/\r$/, '');
      this._buffer = this._buffer.substring(nl + 1);

      if (line === '') continue;

      const event = parseControlLine(line);
      if (event) this._callback(event);
    }
  }

  /** Drop any partial line not yet ended in '\n'. Call on disconnect. */
  reset() {
    this._buffer = '';
  }
}

module.exports = {
  decodeTmuxOctal,
  encodeInputAsHex,
  parseControlLine,
  buildSendKeysCommands,
  ControlModeLineBuffer,
};
