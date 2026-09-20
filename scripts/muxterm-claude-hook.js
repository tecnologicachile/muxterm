#!/usr/bin/env node
/**
 * muxterm SessionStart hook.
 *
 * Records which transcript the Claude Code session in this tmux pane is writing
 * to, so muxterm's chat view can tail the exact file instead of guessing from
 * the cwd. Writes one small file per terminal, overwritten on every
 * SessionStart — which fires again after /clear, so the pointer stays correct.
 *
 * Contract: this runs inside every Claude Code startup. It must never block or
 * fail the session — every path exits 0.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function main() {
  // Only meaningful inside a muxterm pane.
  if (!process.env.TMUX) return;

  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch (e) { return; }
  let hook;
  try { hook = JSON.parse(input); } catch (e) { return; }
  if (!hook || !hook.transcript_path) return;
  // Claude spawns child sessions (subagents, scratchpad work) inside the same
  // pane; their SessionStart fires too and would overwrite the pane's pointer
  // with a transcript nobody is reading. Only the session rooted in a real
  // project directory owns the pane.
  if (/^\/tmp\/claude-/.test(hook.cwd || '') || /-tmp-claude-/.test(hook.transcript_path)) return;

  // tmux session name -> terminalId (muxterm names them webssh_<sessionId>_<uuid>)
  let sessionName = '';
  try {
    sessionName = execFileSync('tmux', ['display-message', '-p', '#{session_name}'],
      { encoding: 'utf8', timeout: 2000 }).trim();
  } catch (e) { return; }
  const parts = sessionName.split('_');
  if (parts.length < 5) return;
  const terminalId = parts.slice(-5).join('-');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(terminalId)) return;

  const dir = path.join(os.homedir(), '.muxterm', 'claude');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, terminalId + '.json'), JSON.stringify({
    terminalId,
    sessionId: hook.session_id || null,
    transcriptPath: hook.transcript_path,
    cwd: hook.cwd || null,
    tmuxSession: sessionName,
    ts: Date.now()
  }));
}

try { main(); } catch (e) { /* never fail the Claude session */ }
process.exit(0);
