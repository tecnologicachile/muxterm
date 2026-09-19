/**
 * Maps muxterm terminals to the Claude Code session running inside them and
 * tails its transcript.
 *
 * Mapping: tmux already tells us which panes run `claude` and their cwd, so the
 * chat view works on existing sessions with no changes to the user's Claude
 * config. A SessionStart hook can register the exact transcript path (see
 * scripts/muxterm-claude-hook.sh); when it has, that wins over the cwd guess.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const transcript = require('./claude-transcript');
const logger = require('./utils/logger');

// Where scripts/muxterm-claude-hook.js drops one file per terminal.
const HOOK_DIR = path.join(os.homedir(), '.muxterm', 'claude');

// terminalId -> { transcriptPath, sessionId, cwd, at }  (in-process fallback)
const registry = new Map();
// terminalId -> { file, offset, timer, listeners:Set }
const watchers = new Map();

const POLL_MS = 400;

/** `webssh_ws_1_c0a56c29_e08b_...` -> `c0a56c29-e08b-...` */
function terminalIdFromTmuxSession(name) {
  const parts = String(name || '').split('_');
  if (parts.length < 5) return null;
  const id = parts.slice(-5).join('-');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

// The tmux call blocks the event loop for ~13ms, and every open window polls
// it. One short-lived cache keeps the cost flat no matter how many clients ask.
let paneCache = { at: 0, panes: [] };
const PANE_CACHE_MS = 5000;

/** Panes currently running Claude Code, keyed by terminalId. */
function listClaudePanes() {
  if (Date.now() - paneCache.at < PANE_CACHE_MS) return paneCache.panes;
  try {
    const out = execSync(
      "tmux -L muxterm list-panes -a -F '#{session_name}\t#{pane_current_command}\t#{pane_current_path}'",
      { encoding: 'utf8', timeout: 3000 }
    );
    const found = [];
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      const [session, cmd, cwd] = line.split('\t');
      if (cmd !== 'claude') continue;
      const terminalId = terminalIdFromTmuxSession(session);
      if (terminalId) found.push({ terminalId, cwd, tmuxSession: session });
    }
    paneCache = { at: Date.now(), panes: found };
    return found;
  } catch (e) {
    paneCache = { at: Date.now(), panes: [] };
    return [];
  }
}

function registerFromHook({ terminalId, transcriptPath, sessionId, cwd }) {
  if (!terminalId || !transcriptPath) return false;
  registry.set(terminalId, { transcriptPath, sessionId, cwd, at: Date.now() });
  // A /clear starts a new transcript; re-point any live watcher at it.
  const w = watchers.get(terminalId);
  if (w && w.file !== transcriptPath) {
    w.file = transcriptPath;
    w.offset = 0;
    w.reset = true;
  }
  return true;
}

/** Registration written by the SessionStart hook for this terminal, if any. */
function hookRegistration(terminalId) {
  try {
    const raw = fs.readFileSync(path.join(HOOK_DIR, terminalId + '.json'), 'utf8');
    const reg = JSON.parse(raw);
    if (reg && reg.transcriptPath && fs.existsSync(reg.transcriptPath)) return reg;
  } catch (e) {}
  return null;
}

/** Exact path if a hook registered it, else the newest transcript for the cwd. */
function resolveTranscript(terminalId) {
  const hooked = hookRegistration(terminalId);
  if (hooked) {
    // A registration can go stale without a new SessionStart — a session that
    // changed identity mid-way kept writing to a new file while the pointer
    // still named the old one. If a sibling transcript is clearly newer than
    // the registered file, the conversation has moved; follow it.
    const sibling = transcript.findTranscriptByCwd(hooked.cwd || path.dirname(hooked.transcriptPath));
    try {
      if (sibling && sibling !== hooked.transcriptPath) {
        const a = fs.statSync(hooked.transcriptPath).mtimeMs;
        const b = fs.statSync(sibling).mtimeMs;
        if (b - a > 60 * 1000) return { file: sibling, source: 'cwd (hook stale)' };
      }
    } catch (e) {}
    return { file: hooked.transcriptPath, source: 'hook' };
  }
  const reg = registry.get(terminalId);
  if (reg && fs.existsSync(reg.transcriptPath)) {
    return { file: reg.transcriptPath, source: 'hook' };
  }
  const pane = listClaudePanes().find(p => p.terminalId === terminalId);
  if (!pane) return { file: null, source: 'none' };
  const file = transcript.findTranscriptByCwd(pane.cwd);
  return file ? { file, source: 'cwd', cwd: pane.cwd } : { file: null, source: 'none', cwd: pane.cwd };
}

/**
 * Start (or join) a tail for this terminal. `onEvents(payload)` fires with the
 * backlog first, then with each batch appended afterwards.
 */
function watch(terminalId, onEvents) {
  let w = watchers.get(terminalId);
  if (w) {
    w.listeners.add(onEvents);
    const tail = transcript.readTail(w.file);
    onEvents({ terminalId, events: tail.events, file: w.file, backlog: true });
    return;
  }

  const { file, source, cwd } = resolveTranscript(terminalId);
  if (!file) {
    onEvents({ terminalId, events: [], error: 'No Claude session found for this terminal', cwd });
    return;
  }

  const tail = transcript.readTail(file);
  w = { file, offset: tail.size, listeners: new Set([onEvents]), timer: null, reset: false };
  watchers.set(terminalId, w);
  onEvents({ terminalId, events: tail.events, file, source, backlog: true });

  // Poll the size: the file is appended by another process, and polling stat is
  // more dependable than fs.watch for that across filesystems.
  w.ticks = 0;
  w.timer = setInterval(() => {
    try {
      // A /clear starts a fresh transcript; the hook rewrites the pointer, so
      // check it every few seconds and follow the new file when it moves.
      // Which file to follow can change under us without any hook firing: a
      // session that switches identity mid-way, a /clear in a session that
      // predates the hook. The cwd fallback was only consulted when the watch
      // began, so the tailer sat on a file that had stopped growing while the
      // conversation carried on in a new one. Re-resolve every few seconds and
      // follow the file the pane is actually writing to.
      if ((++w.ticks % 12) === 0) {
        const r = resolveTranscript(terminalId);
        if (r.file && r.file !== w.file) {
          w.file = r.file;
          w.offset = 0;
          const t = transcript.readTail(w.file);
          w.offset = t.size;
          for (const fn of w.listeners) fn({ terminalId, events: t.events, file: w.file, source: r.source, backlog: true });
          return;
        }
      }
      if (w.reset) { w.reset = false; w.offset = 0; }
      const st = fs.statSync(w.file);
      if (st.size === w.offset) return;
      if (st.size < w.offset) { w.offset = 0; }  // rotated/truncated
      const len = st.size - w.offset;
      const buf = Buffer.alloc(len);
      const fd = fs.openSync(w.file, 'r');
      try { fs.readSync(fd, buf, 0, len, w.offset); } finally { fs.closeSync(fd); }
      w.offset = st.size;
      const events = [];
      for (const line of buf.toString('utf8').split('\n')) {
        if (line.trim()) events.push(...transcript.parseLine(line));
      }
      if (events.length) {
        for (const fn of w.listeners) fn({ terminalId, events, file: w.file });
      }
    } catch (e) {
      // File may vanish on /clear; the next hook registration re-points us.
    }
  }, POLL_MS);
}

function unwatch(terminalId, onEvents) {
  const w = watchers.get(terminalId);
  if (!w) return;
  if (onEvents) w.listeners.delete(onEvents);
  if (!onEvents || w.listeners.size === 0) {
    clearInterval(w.timer);
    watchers.delete(terminalId);
  }
}

function unwatchAllFor(fn) {
  for (const [terminalId, w] of watchers) {
    if (w.listeners.has(fn)) unwatch(terminalId, fn);
  }
}

/** Live watchers, for diagnostics: which transcript each terminal streams from. */
function describeWatchers() {
  const out = [];
  for (const [terminalId, w] of watchers) {
    out.push({ terminalId, file: w.file, listeners: w.listeners.size, offset: w.offset });
  }
  return out;
}

module.exports = {
  listClaudePanes, resolveTranscript, registerFromHook, hookRegistration, HOOK_DIR, describeWatchers,
  watch, unwatch, unwatchAllFor, terminalIdFromTmuxSession
};
