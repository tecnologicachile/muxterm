/**
 * Whether each Claude Code session has work of yours pending.
 *
 * The terminal's activity light only says "text is coming out", which goes
 * dark while Claude thinks and lights up for a plain `ls`. The transcript
 * knows better: a prompt starts a turn, a turn_duration line ends it, and a
 * question tool without a result means Claude is waiting on you. This tails
 * every pane running Claude (not just the ones in modo conversación) and
 * tells the owner's browsers when a session goes busy, done or waiting.
 */
const fs = require('fs');
const sessions = require('./claude-sessions');
const transcript = require('./claude-transcript');
const activity = require('./claude-activity');

const TICK_MS = 1000;
const RERESOLVE_TICKS = 10;
const WAITING_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode', 'EnterPlanMode']);

const states = new Map();   // terminalId -> state
let io = null, ttydManager = null, database = null, timer = null;

function ownerOf(terminalId) {
  const t = ttydManager && ttydManager.getTerminal(terminalId);
  if (t) return t.userId;
  try { const row = database.findTerminalById(terminalId); return row ? row.user_id : null; } catch (e) { return null; }
}

function publicState(st) {
  return {
    terminalId: st.terminalId, busy: st.busy, waiting: st.waiting || !!st.permission,
    permission: st.permission ? st.permission.title : null,
    lastText: st.lastText, finishedAt: st.finishedAt, since: st.since
  };
}

function emit(st) {
  if (!io) return;
  const owner = ownerOf(st.terminalId);
  if (owner == null) return;
  for (const [, s] of io.sockets.sockets) {
    if (s.userId === owner) s.emit('claude-status', publicState(st));
  }
}

/** Fold events into the state; returns true when busy/waiting changed. */
// What a blocking tool is asking, for the activity log.
function waitingSummary(ev) {
  const inp = ev.input || {};
  if (inp.question) return inp.question;
  if (ev.name === 'ExitPlanMode') return 'Plan listo para revisar';
  if (ev.name === 'EnterPlanMode') return 'Quiere entrar en modo plan';
  return ev.name;
}

/**
 * Fold transcript events into the session state, and log the ones worth
 * keeping. `historical` is the tail replayed at startup: it is written as
 * already seen, so a restart does not turn last week into pending items.
 */
function apply(st, events, { historical = false } = {}) {
  const before = `${st.busy}|${st.waiting}`;
  const tid = st.terminalId;
  for (const ev of events) {
    if (ev.sidechain) continue;
    if (ev.kind === 'prompt') {
      st.busy = true; st.waiting = false; st.waitingTool = null; st.since = ev.ts || new Date().toISOString();
      st.turnText = '';
      activity.record({ terminalId: tid, kind: 'prompt', ts: ev.ts, summary: ev.text, ref: ev.uuid || 'prompt:' + ev.ts, seen: true });
    }
    else if (ev.kind === 'text' && ev.text) {
      st.lastText = String(ev.text).slice(0, 300);
      if (!ev.narration) st.turnText = st.lastText;
    }
    else if (ev.kind === 'tool' && WAITING_TOOLS.has(ev.name)) {
      st.waiting = true; st.waitingTool = ev.toolId;
      activity.record({ terminalId: tid, kind: 'waiting', ts: ev.ts, summary: waitingSummary(ev), ref: ev.toolId, seen: historical });
    }
    else if (ev.kind === 'result') {
      if (st.waitingTool && ev.toolId === st.waitingTool) { st.waiting = false; st.waitingTool = null; }
      if (ev.toolId) activity.resolve({ terminalId: tid, ref: ev.toolId });
      const r = ev.result || {};
      if (r.type === 'command' && r.ok === false) {
        activity.record({ terminalId: tid, kind: 'error', ts: ev.ts, summary: `Falló ${r.name || 'un comando'}`, ref: 'err:' + (ev.uuid || ev.toolId), seen: historical });
      }
    }
    else if (ev.kind === 'turn') {
      const wasBusy = st.busy;
      st.busy = false; st.waiting = false; st.waitingTool = null; st.finishedAt = ev.ts || new Date().toISOString();
      // turn_duration and stop_hook_summary for the same turn land within
      // a second of each other: one "done" is enough. And a Stop that ends
      // nothing you asked for (a reply to another session's message) is
      // not a finished turn of yours.
      const at = Date.parse(ev.ts || '') || Date.now();
      if (st.lastTurnAt && Math.abs(at - st.lastTurnAt) < 3000) continue;
      st.lastTurnAt = at;
      if (!wasBusy && !historical) continue;
      const interrupted = ev.reason === 'interrupted';
      activity.record({
        terminalId: tid, kind: interrupted ? 'interrupted' : 'done', ts: ev.ts,
        summary: interrupted ? 'Interrumpido' : (st.turnText || st.lastText || 'Terminó'),
        ref: ev.uuid || 'turn:' + (ev.ts || ''), seen: historical
      });
      st.turnText = '';
    }
  }
  return before !== `${st.busy}|${st.waiting}`;
}

function start(st) {
  const r = sessions.resolveTranscript(st.terminalId);
  st.file = r.file || null;
  st.offset = 0;
  if (!st.file) return;
  const tail = transcript.readTail(st.file);
  st.offset = tail.size;
  st.busy = false; st.waiting = false; st.waitingTool = null;
  apply(st, tail.events, { historical: true });
}

function tick() {
  try {
    const panes = sessions.listClaudePanes();
    const alive = new Set(panes.map(p => p.terminalId));
    for (const id of [...states.keys()]) if (!alive.has(id)) states.delete(id);
    for (const p of panes) {
      let st = states.get(p.terminalId);
      if (!st) {
        st = { terminalId: p.terminalId, busy: false, waiting: false, waitingTool: null, lastText: '', finishedAt: null, since: null, ticks: 0 };
        states.set(p.terminalId, st);
        start(st);
        continue;
      }
      if ((++st.ticks % RERESOLVE_TICKS) === 0) {
        const r = sessions.resolveTranscript(st.terminalId);
        if (r.file && r.file !== st.file) { start(st); continue; }
      }
      // A permission prompt is on screen only; it counts as waiting on you.
      const perm = sessions.readPermission(p.tmuxSession);
      const permTitle = perm ? perm.title + '|' + perm.question : null;
      if (permTitle !== st.permTitle) {
        st.permTitle = permTitle;
        st.permission = perm;
        // A prompt that went away was answered (or dismissed) in the terminal.
        if (!perm) activity.resolve({ terminalId: st.terminalId, kind: 'permission' });
        else activity.record({ terminalId: st.terminalId, kind: 'permission', summary: perm.title + (perm.question ? ': ' + perm.question : ''), ref: activity.refFor('perm', permTitle) });
        emit(st);
      }
      if (!st.file) continue;
      let size;
      try { size = fs.statSync(st.file).size; } catch (e) { continue; }
      if (size === st.offset) continue;
      if (size < st.offset) st.offset = 0;
      const buf = Buffer.alloc(size - st.offset);
      const fd = fs.openSync(st.file, 'r');
      try { fs.readSync(fd, buf, 0, buf.length, st.offset); } finally { fs.closeSync(fd); }
      st.offset = size;
      const events = [];
      for (const line of buf.toString('utf8').split('\n')) if (line.trim()) events.push(...transcript.parseLine(line));
      if (apply(st, events)) emit(st);
    }
  } catch (e) { /* next tick */ }
}

function init(deps) {
  io = deps.io; ttydManager = deps.ttydManager; database = deps.database;
  if (!timer) timer = setInterval(tick, TICK_MS);
}

/** Current state of every Claude session this user owns. */
function forUser(userId) {
  const out = {};
  for (const [id, st] of states) if (ownerOf(id) === userId) out[id] = publicState(st);
  return out;
}

module.exports = { init, forUser, _apply: apply };
