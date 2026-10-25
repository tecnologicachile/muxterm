/**
 * Maps muxterm terminals to the Claude Code session running inside them and
 * tails its transcript.
 *
 * Mapping: tmux already tells us which panes run `claude` and their cwd, so the
 * chat view works on existing sessions with no changes to the user's Claude
 * config. A SessionStart hook can register the exact transcript path (see
 * scripts/muxterm-claude-hook.sh); when it has, that wins over the cwd guess.
 */
const { execSync, execFile } = require('child_process');
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

/** Every muxterm pane, with the program in its foreground, keyed by terminalId. */
function listPanes() {
  if (Date.now() - paneCache.at < PANE_CACHE_MS) return paneCache.all;
  try {
    const out = execSync(
      "tmux -L muxterm list-panes -a -F '#{session_name}\t#{pane_current_command}\t#{pane_current_path}'",
      { encoding: 'utf8', timeout: 3000 }
    );
    const all = [];
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      const [session, cmd, cwd] = line.split('\t');
      const terminalId = terminalIdFromTmuxSession(session);
      if (terminalId) all.push({ terminalId, cwd, tmuxSession: session, cmd });
    }
    paneCache = { at: Date.now(), all, panes: all.filter(p => p.cmd === 'claude') };
    return all;
  } catch (e) {
    paneCache = { at: Date.now(), all: [], panes: [] };
    return [];
  }
}

/** Panes currently running Claude Code. */
function listClaudePanes() {
  listPanes();
  return paneCache.panes;
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

/**
 * The prompt Claude Code suggests in its input box (accepted with Tab). It is
 * never written to the transcript, so it is read off the screen: the box sits
 * between the last two rule lines, and the suggestion is the dim text after
 * the prompt marker, while anything typed is bright.
 */
// Every Claude pane's screen, read by one tmux call that refreshScreens()
// starts each second without waiting for it. Starting a process costs this
// server tens of milliseconds (it is a big process to fork), and a sync
// capture per pane per second kept it frozen most of the time: with 27
// sessions every page and API call waited 4-10 s. Readers get what the last
// refresh saw, about a second old at most.
const screenCache = new Map();
const SCREEN_SEP = '@@muxterm-screen@@ ';
let refreshing = false;
function refreshScreens() {
  if (refreshing) return;
  const targets = listClaudePanes().map(p => p.tmuxSession);
  for (const s of screenCache.keys()) if (!targets.includes(s)) screenCache.delete(s);
  if (!targets.length) return;
  const args = ['-L', 'muxterm'];
  targets.forEach((s, i) => {
    if (i) args.push(';');
    args.push('display-message', '-p', '-t', s, SCREEN_SEP + s, ';', 'capture-pane', '-p', '-e', '-t', s);
  });
  refreshing = true;
  // A pane that closed stops the chain there; the panes before it still count.
  execFile('tmux', args, { encoding: 'utf8', timeout: 5000, maxBuffer: 32 * 1024 * 1024 }, (err, out) => {
    refreshing = false;
    const at = Date.now();
    for (const chunk of String(out || '').split(SCREEN_SEP).slice(1)) {
      const nl = chunk.indexOf('\n');
      if (nl > 0) screenCache.set(chunk.slice(0, nl), { at, out: chunk.slice(nl + 1) });
    }
  });
}

function readScreen(tmuxSession) {
  const c = screenCache.get(tmuxSession);
  if (c && Date.now() - c.at < 5000) return c.out;
  // A pane the refresh has not seen yet, or a refresh that keeps failing.
  let out = '';
  try { out = execSync(`tmux -L muxterm capture-pane -p -e -t ${tmuxSession}`, { encoding: 'utf8', timeout: 2000 }); } catch (e) {}
  screenCache.set(tmuxSession, { at: Date.now(), out });
  return out;
}

/**
 * A tool permission prompt, which lives only on screen:
 *   Run shell command … Do you want to proceed? ❯ 1. Yes  2. No  Esc to cancel
 * Returns { title, body, options: [{ n, label }] } or null.
 */
function readPermission(tmuxSession) {
  try {
    const plain = readScreen(tmuxSession).split('\n')
      .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').replace(/[│╭╮╰╯─]/g, ' ').replace(/\s+$/, ''));
    let q = -1;
    // Tool permissions ask "Do you want to proceed?"; plan approval asks
    // "Would you like to proceed?".
    for (let i = plain.length - 1; i >= 0; i--) if (/(Do you want|Would you like) to (proceed|make this edit|allow|run|continue)/i.test(plain[i])) { q = i; break; }
    if (q < 0) return null;
    const options = [];
    let end = q;
    for (let i = q + 1; i < plain.length && i < q + 12; i++) {
      const m = plain[i].match(/^\s*❯?\s*(\d+)\.\s+(.+?)\s*$/);
      if (m) { options.push({ n: Number(m[1]), label: m[2] }); end = i; continue; }
      if (/Esc to cancel/i.test(plain[i])) { end = i; break; }
      if (options.length && plain[i].trim() === '') break;
    }
    if (!options.length) return null;
    // The box above the question holds the title and the details, with
    // blank lines between them; its top is where the frame was (now blanks
    // for two lines running) or the screen top. Cap at 25 lines.
    let top = q - 1;
    while (top > 0 && q - top < 25 && !(plain[top].trim() === '' && plain[top - 1].trim() === '')) top--;
    const block = plain.slice(top, q).map(l => l.trim()).filter(Boolean);
    const title = block.shift() || 'Permiso';
    return { title, body: block.join('\n').slice(0, 1500), options, question: plain[q].trim() };
  } catch (e) { return null; }
}

/**
 * Claude Code's status lines under its input box: model, project and branch,
 * context used, usage, permission mode, agents. Screen only, like the rest.
 */
function readStatusLine(tmuxSession) {
  try {
    // Besides colours, the project line carries OSC 8 hyperlinks.
    const plain = readScreen(tmuxSession).split('\n')
      .map(l => l.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;]*m/g, ''));
    let last = -1;
    plain.forEach((l, i) => { if (l.trim().startsWith('────')) last = i; });
    if (last < 0) return null;
    const lines = plain.slice(last + 1, last + 5).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const text = lines.join(' │ ');
    const pct = (label) => { const m = text.match(new RegExp(label + '\\s*[█░]*\\s*(\\d+)%')); return m ? Number(m[1]) : null; };
    const model = (text.match(/^\[([^\]]+)\]/) || [])[1] || null;
    const project = (text.match(/\]\s*│\s*([^│]+?)\s*(?:│|$)/) || [])[1] || null;
    const mode = (text.match(/⏵⏵\s*([^(·│]+)/) || [])[1];
    const agents = (text.match(/←\s*(\d+)\s*agents?/) || [])[1];
    return {
      model, project: project ? project.trim() : null,
      context: pct('Context'), usage: pct('Usage'), weekly: pct('Weekly'),
      mode: mode ? mode.trim() : null, agents: agents ? Number(agents) : null
    };
  } catch (e) { return null; }
}

/**
 * Whether Claude Code is busy with a prompt. While it works it shows a
 * spinner line above its input box, a word with an ellipsis and the elapsed
 * time: "✻ Skedaddling… (52s · ↓ 2.8k tokens)". Once done the line turns
 * into "✻ Worked for 1m 3s", with no ellipsis.
 */
// The line Claude Code keeps just above the input box: "✻ Pondering… (52s ·
// ↓ 1.2k tokens)" while it works, "✻ Worked for 1m 31s · done 12:09 · 1 shell
// still running" once it is done. Returns whether it is working and that
// line without its glyph, or no text when neither is on screen.
function readActivity(tmuxSession) {
  const none = { working: false, text: '' };
  try {
    const plain = readScreen(tmuxSession).split('\n').map(l => l.replace(/\x1b\[[0-9;]*m/g, ''));
    const seps = [];
    plain.forEach((l, i) => { if (l.trim().startsWith('────')) seps.push(i); });
    if (seps.length < 2) return none;
    const boxTop = seps[seps.length - 2];
    for (let i = boxTop - 1; i >= 0 && i >= boxTop - 8; i--) {
      const l = plain[i];
      if (/^\s*\S\s+[^\s(]+…\s*\((?:\d+[hm]\s*)*\d+s\b/.test(l)) return { working: true, text: l.trim().replace(/^\S\s+/, '') };
      if (/^\s*\S\s+[A-Z][a-z]+ for (?:\d+[hm]\s*)*\d+s\b/.test(l)) return { working: false, text: l.trim().replace(/^\S\s+/, '') };
    }
    return none;
  } catch (e) { return none; }
}

// Shells Claude left running in the background. Claude Code counts them in
// its status bar under the input box ("⏵⏵ bypass permissions on · 1 shell ·")
// and in the done line ("✻ Worked for 1m 31s · 1 shell still running"); the
// transcript says nothing once the turn is over.
function readBackgroundShells(tmuxSession) {
  try {
    const plain = readScreen(tmuxSession).split('\n').map(l => l.replace(/\x1b\[[0-9;]*m/g, ''));
    let last = -1;
    plain.forEach((l, i) => { if (l.trim().startsWith('────')) last = i; });
    let n = 0;
    if (last >= 0) {
      for (const l of plain.slice(last + 1)) {
        const m = l.match(/(?:^|·)\s*(\d+) shells?\s*(?:·|$)/);
        if (m) n = Math.max(n, Number(m[1]));
      }
    }
    const m = readActivity(tmuxSession).text.match(/(\d+) shells? still running/);
    if (m) n = Math.max(n, Number(m[1]));
    return n;
  } catch (e) { return 0; }
}

function readSuggestion(tmuxSession) {
  try {
    const out = readScreen(tmuxSession);
    const lines = out.split('\n');
    const plain = lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, ''));
    const seps = [];
    plain.forEach((l, i) => { if (l.trim().startsWith('────')) seps.push(i); });
    if (seps.length < 2) return '';
    const box = lines.slice(seps[seps.length - 2] + 1, seps[seps.length - 1]).join(' ');
    const m = box.match(/❯\s*\x1b\[2m([\s\S]*?)(?:\x1b\[0m|\x1b\[22m|$)/);
    if (!m) return '';
    return m[1].replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();
  } catch (e) { return ''; }
}

/** Transcripts registered by the other live panes: not this pane's. */
function claimedByOthers(terminalId) {
  const claimed = new Set();
  const alive = new Set(listClaudePanes().map(p => p.terminalId));
  try {
    for (const f of fs.readdirSync(HOOK_DIR)) {
      if (!f.endsWith('.json')) continue;
      const id = f.slice(0, -5);
      if (id === terminalId || !alive.has(id)) continue;
      const reg = hookRegistration(id);
      if (reg) claimed.add(reg.transcriptPath);
    }
  } catch (e) {}
  return claimed;
}

/** Exact path if a hook registered it, else the newest transcript for the cwd. */
function resolveTranscript(terminalId) {
  let hooked = hookRegistration(terminalId);
  // A child session (subagent, scratchpad) that started in this pane may have
  // registered itself; its cwd is not the pane's. The pane's own transcript
  // lives under the directory tmux reports, so a registration from anywhere
  // else is noise.
  const paneNow = hooked && listClaudePanes().find(p => p.terminalId === terminalId);
  if (hooked && paneNow && hooked.cwd && paneNow.cwd && hooked.cwd !== paneNow.cwd) hooked = null;
  if (hooked) {
    // A registration can go stale without a new SessionStart — a session that
    // changed identity mid-way kept writing to a new file while the pointer
    // still named the old one. If a sibling transcript is clearly newer than
    // the registered file, the conversation has moved; follow it.
    const sibling = transcript.findTranscriptByCwd(hooked.cwd || path.dirname(hooked.transcriptPath), claimedByOthers(terminalId));
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
  const file = transcript.findTranscriptByCwd(pane.cwd, claimedByOthers(terminalId));
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
    // A joining listener gets the current suggestion too; it is otherwise
    // only sent when it changes.
    onEvents({ terminalId, events: tail.events, file: w.file, backlog: true, suggestion: w.suggestion || '', permission: w.permKey ? JSON.parse(w.permKey) : null, status: w.statusKey ? JSON.parse(w.statusKey) : null, working: !!w.working, activity: w.activity || '' });
    return;
  }

  const { file, source, cwd } = resolveTranscript(terminalId);
  if (!file) {
    onEvents({ terminalId, events: [], error: 'No Claude session found for this terminal', cwd });
    return;
  }

  const tail = transcript.readTail(file);
  const pane0 = listClaudePanes().find(p => p.terminalId === terminalId);
  const perm0 = pane0 ? readPermission(pane0.tmuxSession) : null;
  const status0 = pane0 ? readStatusLine(pane0.tmuxSession) : null;
  w = { file, offset: tail.size, listeners: new Set([onEvents]), timer: null, reset: false, suggestion: pane0 ? readSuggestion(pane0.tmuxSession) : '', permKey: JSON.stringify(perm0), statusKey: JSON.stringify(status0), ...(pane0 ? (({ working, text }) => ({ working, activity: text }))(readActivity(pane0.tmuxSession)) : { working: false, activity: '' }) };
  watchers.set(terminalId, w);
  onEvents({ terminalId, events: tail.events, file, source, backlog: true, suggestion: w.suggestion, permission: perm0, status: status0, working: w.working, activity: w.activity });

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
      // Every ~1.2 s, glance at the input box for a suggested prompt and
      // tell listeners only when it changes (including when it goes away).
      if ((w.ticks % 3) === 0) {
        const pane = listClaudePanes().find(p => p.terminalId === terminalId);
        const suggestion = pane ? readSuggestion(pane.tmuxSession) : '';
        const permission = pane ? readPermission(pane.tmuxSession) : null;
        const permKey = JSON.stringify(permission);
        const status = pane ? readStatusLine(pane.tmuxSession) : null;
        const statusKey = JSON.stringify(status);
        const { working, text: activity } = pane ? readActivity(pane.tmuxSession) : { working: false, text: '' };
        if (suggestion !== w.suggestion || permKey !== w.permKey || statusKey !== w.statusKey || working !== w.working || activity !== w.activity) {
          w.suggestion = suggestion; w.permKey = permKey; w.statusKey = statusKey; w.working = working; w.activity = activity;
          for (const fn of w.listeners) fn({ terminalId, events: [], suggestion, permission, status, working, activity });
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

module.exports = { listPanes, readSuggestion, readPermission, readStatusLine, readBackgroundShells, refreshScreens,
  listClaudePanes, resolveTranscript, registerFromHook, hookRegistration, HOOK_DIR, describeWatchers,
  watch, unwatch, unwatchAllFor, terminalIdFromTmuxSession
};
