/**
 * Sends text into a terminal's tmux session as if the user had typed it.
 *
 * Shared by the voice transcription flow and the Claude chat view composer.
 *
 * Delivery only needs tmux, not ttyd: the session survives a dropped browser,
 * a suspended phone, or a server restart that emptied the in-memory map. So we
 * resolve the tmux session by name and send straight to it, which keeps the
 * composer working in exactly the cases where it used to fail.
 */
const { execSync } = require('child_process');
const ttydManager = require('./ttyd-manager');
const database = require('../db/database');
const logger = require('./utils/logger');

const shQuote = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;

/**
 * The live tmux session for a terminal, found without the in-memory map:
 * muxterm names sessions webssh_<sessionId>_<terminalId with dashes as _>.
 */
function findTmuxSession(terminalId) {
  try {
    const out = execSync('tmux -L muxterm ls -F "#{session_name}" 2>/dev/null || true',
      { encoding: 'utf8', timeout: 3000 });
    const suffix = '_' + String(terminalId).replace(/-/g, '_');
    return out.split('\n').map(s => s.trim()).find(s => s && s.endsWith(suffix)) || null;
  } catch (e) {
    return null;
  }
}

/**
 * @returns {{status:number, body:object}} ready to send as an HTTP response
 */
function injectText({ terminalId, text, userId }) {
  if (!terminalId || typeof text !== 'string' || !text.trim()) {
    return { status: 400, body: { status: 'error', message: 'terminalId and non-empty text are required' } };
  }

  // Ownership, from the live terminal when we have it and the DB otherwise.
  const terminal = ttydManager.terminals.get(terminalId);
  if (terminal) {
    if (terminal.userId && userId && terminal.userId !== userId) {
      return { status: 403, body: { status: 'error', message: 'Not your terminal' } };
    }
  } else {
    const row = database.findTerminalById(terminalId);
    if (!row) return { status: 404, body: { status: 'error', message: 'Terminal not found' } };
    if (userId && row.user_id !== userId) {
      return { status: 403, body: { status: 'error', message: 'Not your terminal' } };
    }
  }

  const session = (terminal && terminal.tmuxSessionName) || findTmuxSession(terminalId);
  if (!session) {
    return { status: 409, body: { status: 'error', message: 'La sesión de este terminal ya no existe' } };
  }

  // A newline inside the literal text would submit early in Claude Code's TUI,
  // so line breaks collapse into spaces and Enter is a separate keystroke (the
  // TUI can drop it when glued to the text).
  const oneLine = text.replace(/\s*\n+\s*/g, ' ').trim();
  try {
    execSync(`tmux -L muxterm send-keys -t ${shQuote(session)} -l ${shQuote(oneLine)}`, { timeout: 3000 });
  } catch (e) {
    // Report it instead of answering ok on a send that never landed.
    logger.error(`send-keys failed for ${terminalId.substring(0, 8)}: ${e.message}`);
    return { status: 502, body: { status: 'error', message: 'No se pudo entregar el texto a la terminal' } };
  }
  // Claude Code's TUI treats a burst of characters as a paste, and an Enter
  // that lands while it is still digesting one can be dropped — the prompt
  // then sits in the box, typed but never sent, and the view looks stale.
  // So: a longer pause, then check the input line and press Enter again if
  // the text is still there.
  const tail = oneLine.slice(-24);
  const pressEnter = () => execSync(`tmux -L muxterm send-keys -t ${shQuote(session)} Enter`, { timeout: 3000 });
  const stillTyped = () => {
    try {
      const screen = execSync(`tmux -L muxterm capture-pane -p -t ${shQuote(session)}`, { encoding: 'utf8', timeout: 3000 });
      const lines = screen.split('\n').filter(l => l.trim());
      return lines.slice(-6).some(l => l.includes(tail));
    } catch (e) { return false; }
  };
  setTimeout(() => {
    try { pressEnter(); } catch (e) { logger.error(`send-keys Enter failed for ${terminalId.substring(0, 8)}: ${e.message}`); }
    let tries = 0;
    const verify = () => {
      if (!stillTyped() || ++tries > 3) return;
      try { pressEnter(); } catch (e) {}
      setTimeout(verify, 700);
    };
    setTimeout(verify, 900);
  }, 400);

  if (!terminal) {
    logger.info(`Sent to ${terminalId.substring(0, 8)} via tmux (terminal not attached in this process)`);
  }
  return { status: 200, body: { status: 'ok', sent: oneLine, reattached: !terminal } };
}

module.exports = { injectText, findTmuxSession };
