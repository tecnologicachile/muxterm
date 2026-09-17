/**
 * Sends text into a terminal's tmux session as if the user had typed it.
 *
 * Shared by the voice transcription flow and the Claude chat view composer.
 * Ownership is checked against the live terminal, falling back to the DB while
 * the in-memory map is still empty after a restart.
 */
const ttydManager = require('./ttyd-manager');
const database = require('../db/database');
const logger = require('./utils/logger');

/**
 * @returns {{status:number, body:object}} ready to send as an HTTP response
 */
function injectText({ terminalId, text, userId }) {
  if (!terminalId || typeof text !== 'string' || !text.trim()) {
    return { status: 400, body: { status: 'error', message: 'terminalId and non-empty text are required' } };
  }

  const terminal = ttydManager.terminals.get(terminalId);
  let owned = !!(terminal && (!terminal.userId || !userId || terminal.userId === userId));
  if (!terminal) {
    const row = database.findTerminalById(terminalId);
    if (!row) return { status: 404, body: { status: 'error', message: 'Terminal not active' } };
    owned = !userId || row.user_id === userId;
  }
  if (!owned) return { status: 403, body: { status: 'error', message: 'Not your terminal' } };
  if (!terminal) {
    // Known in the DB but not attached in this process: sendKeys needs the live
    // tmux session name, so ask the user to open the terminal once.
    return { status: 409, body: { status: 'error', message: 'Open this terminal once before sending' } };
  }

  // A newline inside the literal text would submit early in Claude Code's TUI,
  // so the caller's line breaks collapse into spaces and Enter is a separate
  // keystroke (the TUI can drop it when glued to the text).
  const oneLine = text.replace(/\s*\n+\s*/g, ' ').trim();
  ttydManager.sendKeys(terminalId, oneLine);
  setTimeout(() => {
    try { ttydManager.sendKeys(terminalId, '\r'); } catch (e) {}
  }, 200);

  logger.info(`Injected ${oneLine.length} chars into terminal ${terminalId.substring(0, 8)}`);
  return { status: 200, body: { status: 'ok', sent: oneLine } };
}

module.exports = { injectText };
