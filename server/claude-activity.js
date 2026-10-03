/**
 * The activity log of Claude Code sessions.
 *
 * One row per thing worth knowing about a session: you asked something, Claude
 * finished, Claude is waiting on you, a permission prompt is up, a command
 * failed. The status tracker (claude-status.js) writes it as it tails each
 * transcript; the tray, the tab dots and anything built later read from it.
 *
 * "Seen" is kept here, per event, so it survives a reload and is the same on
 * every device — unlike the in-memory map the browser used to keep.
 *
 * See docs/design/bandeja-actividad.md.
 */
const crypto = require('crypto');
const path = require('path');
const push = require('./push');

const MAX_SUMMARY = 300;
const KEEP_DAYS = 7;
const KEEP_PER_SESSION = 500;

let io = null, database = null, ttydManager = null, sessions = null;
let q = null;

// How long a finished turn waits before it is pushed: long enough for a page
// that was looking at it to mark it seen, which is the signal that you know.
const DONE_PUSH_DELAY_MS = 10000;

/** "baseapi" for the pane's cwd: the server has no better name for a session. */
function sessionName(terminalId) {
  try {
    const pane = sessions && sessions.listClaudePanes().find(p => p.terminalId === terminalId);
    return pane && pane.cwd ? path.basename(pane.cwd) : 'Claude';
  } catch (e) { return 'Claude'; }
}

function pushFor(row) {
  const name = sessionName(row.terminal_id);
  const titles = { waiting: `${name}: Claude te pregunta`, permission: `${name}: Claude pide permiso`, done: `${name}: Claude terminó`, error: `${name}: falló un comando` };
  const title = titles[row.kind];
  if (!title) return;
  push.send(row.user_id, { title, body: row.summary, tag: 'muxterm-' + row.terminal_id, terminalId: row.terminal_id, eventId: row.id, url: '/workspace' }).catch(() => {});
}

function ownerOf(terminalId) {
  const t = ttydManager && ttydManager.getTerminal(terminalId);
  if (t) return t.userId;
  try { const row = database.findTerminalById(terminalId); return row ? row.user_id : null; } catch (e) { return null; }
}

function emitTo(userId, name, payload) {
  if (!io || userId == null) return;
  for (const [, s] of io.sockets.sockets) {
    if (s.userId === userId) s.emit(name, payload);
  }
}

function clip(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > MAX_SUMMARY ? t.slice(0, MAX_SUMMARY - 1) + '…' : t;
}

function prepare() {
  const db = database.db;
  db.exec(`
    CREATE TABLE IF NOT EXISTS claude_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      terminal_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      ts TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      ref TEXT NOT NULL,
      seen_at TEXT,
      resolved_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_claude_activity_ref ON claude_activity(terminal_id, ref);
    CREATE INDEX IF NOT EXISTS idx_claude_activity_user_ts ON claude_activity(user_id, ts DESC);
  `);
  q = {
    insert: db.prepare('INSERT OR IGNORE INTO claude_activity (user_id, terminal_id, kind, ts, summary, ref, seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    byRef: db.prepare('SELECT * FROM claude_activity WHERE terminal_id = ? AND ref = ?'),
    byId: db.prepare('SELECT * FROM claude_activity WHERE id = ?'),
    resolve: db.prepare('UPDATE claude_activity SET resolved_at = ? WHERE terminal_id = ? AND ref = ? AND resolved_at IS NULL'),
    resolveOpenKind: db.prepare('UPDATE claude_activity SET resolved_at = ? WHERE terminal_id = ? AND kind = ? AND resolved_at IS NULL'),
    openOfKind: db.prepare('SELECT id FROM claude_activity WHERE terminal_id = ? AND kind = ? AND resolved_at IS NULL'),
    seenIds: db.prepare('UPDATE claude_activity SET seen_at = ? WHERE user_id = ? AND id = ? AND seen_at IS NULL'),
    seenTerminal: db.prepare('UPDATE claude_activity SET seen_at = ? WHERE user_id = ? AND terminal_id = ? AND (? IS NULL OR ts <= ?) AND seen_at IS NULL'),
    seenAll: db.prepare('UPDATE claude_activity SET seen_at = ? WHERE user_id = ? AND seen_at IS NULL'),
    list: db.prepare('SELECT * FROM claude_activity WHERE user_id = ? AND (? IS NULL OR terminal_id = ?) AND (? IS NULL OR ts < ?) ORDER BY ts DESC, id DESC LIMIT ?'),
    pending: db.prepare(`SELECT * FROM claude_activity WHERE user_id = ?
      AND ((kind IN ('waiting','permission') AND resolved_at IS NULL) OR (kind IN ('done','error','interrupted') AND seen_at IS NULL))
      ORDER BY ts DESC, id DESC`),
    unseenCounts: db.prepare(`SELECT terminal_id, COUNT(*) AS n FROM claude_activity WHERE user_id = ? AND seen_at IS NULL
      AND (kind IN ('done','error','interrupted') OR (kind IN ('waiting','permission') AND resolved_at IS NULL)) GROUP BY terminal_id`),
    pruneOld: db.prepare(`DELETE FROM claude_activity WHERE ts < ? AND NOT (kind IN ('waiting','permission') AND resolved_at IS NULL)`),
    pruneExcess: db.prepare(`DELETE FROM claude_activity WHERE id IN (
      SELECT id FROM claude_activity WHERE terminal_id = ? AND NOT (kind IN ('waiting','permission') AND resolved_at IS NULL)
      ORDER BY ts DESC, id DESC LIMIT -1 OFFSET ?)`),
    terminals: db.prepare('SELECT DISTINCT terminal_id FROM claude_activity')
  };
}

function init(deps) {
  io = deps.io; database = deps.database; ttydManager = deps.ttydManager; sessions = deps.sessions || null;
  prepare();
}

/**
 * Add an event. Idempotent on (terminalId, ref): replaying a transcript tail
 * after a restart inserts nothing twice. `seen` marks it read on arrival (a
 * prompt you typed, or history replayed at startup).
 * @returns the new row, or null if it was already there
 */
function record({ terminalId, kind, ts, summary, ref, seen }) {
  if (!q || !terminalId || !kind || !ref) return null;
  const userId = ownerOf(terminalId);
  if (userId == null) return null;
  const when = ts || new Date().toISOString();
  const info = q.insert.run(userId, terminalId, kind, when, clip(summary), String(ref), seen ? when : null);
  if (!info.changes) return null;
  const row = q.byId.get(info.lastInsertRowid);
  emitTo(userId, 'activity:new', { event: row });
  // To the phone: a question or permission right away; a finished turn only
  // if nobody has looked at it after a moment.
  if (!seen) {
    if (row.kind === 'waiting' || row.kind === 'permission') pushFor(row);
    else if (row.kind === 'done' || row.kind === 'error') {
      setTimeout(() => {
        try {
          const now = q.byId.get(row.id);
          if (now && !now.seen_at) pushFor(now);
        } catch (e) {}
      }, DONE_PUSH_DELAY_MS);
    }
  }
  return row;
}

/** A waiting/permission event stopped waiting. */
function resolve({ terminalId, ref, kind }) {
  if (!q || !terminalId) return;
  const now = new Date().toISOString();
  const ids = ref
    ? [q.byRef.get(terminalId, String(ref))].filter(r => r && !r.resolved_at).map(r => r.id)
    : q.openOfKind.all(terminalId, kind).map(r => r.id);
  if (!ids.length) return;
  if (ref) q.resolve.run(now, terminalId, String(ref));
  else q.resolveOpenKind.run(now, terminalId, kind);
  const userId = ownerOf(terminalId);
  for (const id of ids) emitTo(userId, 'activity:update', { id, resolved_at: now });
}

function markSeen(userId, { ids, terminalId, until }) {
  if (!q) return 0;
  const now = new Date().toISOString();
  let n = 0;
  if (Array.isArray(ids)) {
    for (const id of ids) n += q.seenIds.run(now, userId, Number(id)).changes;
  } else if (terminalId) {
    n = q.seenTerminal.run(now, userId, terminalId, until || null, until || null).changes;
  }
  if (n) emitTo(userId, 'activity:seen', { ids: ids || null, terminalId: terminalId || null, until: until || now, seen_at: now });
  return n;
}

function markAllSeen(userId) {
  if (!q) return 0;
  const now = new Date().toISOString();
  const n = q.seenAll.run(now, userId).changes;
  if (n) emitTo(userId, 'activity:seen', { all: true, seen_at: now });
  return n;
}

function list(userId, { since, limit, terminalId } = {}) {
  if (!q) return [];
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  return q.list.all(userId, terminalId || null, terminalId || null, since || null, since || null, lim);
}

function pending(userId) {
  return q ? q.pending.all(userId) : [];
}

/** terminalId -> number of events waiting for the user to look. */
function unseenByTerminal(userId) {
  const out = {};
  if (!q) return out;
  for (const r of q.unseenCounts.all(userId)) out[r.terminal_id] = r.n;
  return out;
}

function prune() {
  if (!q) return;
  try {
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString();
    q.pruneOld.run(cutoff);
    for (const r of q.terminals.all()) q.pruneExcess.run(r.terminal_id, KEEP_PER_SESSION);
  } catch (e) { /* next hour */ }
}

/** A stable ref for things that have no transcript uuid (permission prompts). */
function refFor(prefix, text) {
  return prefix + ':' + crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 16);
}

module.exports = { init, record, resolve, markSeen, markAllSeen, list, pending, unseenByTerminal, prune, refFor };
