/**
 * What each terminal costs the machine.
 *
 * The box runs out of memory long before it runs out of anything else: every
 * Claude session drags a dozen MCP servers with it, and sessions nobody has
 * touched in a fortnight keep all of theirs alive. Nothing in the interface
 * said which those were. This weighs the process tree hanging off each tmux
 * pane and reports how long since the session last did anything, so the list
 * of terminals can show it.
 */
const fs = require('fs');
const { execSync } = require('child_process');

const PAGE = 4096;
const CACHE_MS = 10000;
let cache = { at: 0, value: null };

function terminalIdFromTmuxSession(name) {
  const parts = String(name || '').split('_');
  if (parts.length < 5) return null;
  const id = parts.slice(-5).join('-');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

/** One pass over /proc: parent and resident size of every process. */
function processTable() {
  const table = new Map();
  let pids;
  try { pids = fs.readdirSync('/proc').filter(n => /^\d+$/.test(n)); } catch (e) { return table; }
  for (const pid of pids) {
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      // The command name is in parentheses and may contain spaces; the fields
      // we need come after the closing one.
      const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      const ppid = Number(rest[1]);
      const statm = fs.readFileSync(`/proc/${pid}/statm`, 'utf8').split(' ');
      const rss = Number(statm[1]) * PAGE;
      table.set(Number(pid), { ppid, rss });
    } catch (e) { /* gone between readdir and read */ }
  }
  return table;
}

function subtreeRss(table, root) {
  const children = new Map();
  for (const [pid, p] of table) {
    if (!children.has(p.ppid)) children.set(p.ppid, []);
    children.get(p.ppid).push(pid);
  }
  let total = 0, count = 0;
  const stack = [root];
  while (stack.length) {
    const pid = stack.pop();
    const p = table.get(pid);
    if (!p) continue;
    total += p.rss; count++;
    for (const c of children.get(pid) || []) stack.push(c);
  }
  return { rss: total, processes: count };
}

function memInfo() {
  const out = { totalMB: 0, availableMB: 0 };
  try {
    const text = fs.readFileSync('/proc/meminfo', 'utf8');
    const grab = (k) => { const m = text.match(new RegExp(`^${k}:\\s+(\\d+)`, 'm')); return m ? Math.round(Number(m[1]) / 1024) : 0; };
    out.totalMB = grab('MemTotal');
    out.availableMB = grab('MemAvailable');
  } catch (e) {}
  return out;
}

/** Per-terminal idle time and memory, keyed by terminalId. Cached briefly. */
function usage() {
  if (cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
  const terminals = {};
  try {
    const out = execSync(
      "tmux -L muxterm list-panes -a -F '#{session_name}\t#{pane_pid}\t#{session_activity}\t#{pane_current_command}\t#{pane_current_path}'",
      { encoding: 'utf8', timeout: 3000 }
    );
    const table = processTable();
    const now = Math.floor(Date.now() / 1000);
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      const [session, panePid, activity, cmd, cwd] = line.split('\t');
      const terminalId = terminalIdFromTmuxSession(session);
      if (!terminalId) continue;
      const tree = subtreeRss(table, Number(panePid));
      const prev = terminals[terminalId];
      // A session with several panes: keep the most recent activity, add memory.
      terminals[terminalId] = {
        idleSec: Math.min(prev ? prev.idleSec : Infinity, Math.max(0, now - Number(activity))),
        rssMB: (prev ? prev.rssMB : 0) + Math.round(tree.rss / (1024 * 1024)),
        processes: (prev ? prev.processes : 0) + tree.processes,
        command: prev && prev.command === 'claude' ? 'claude' : cmd,
        cwd
      };
    }
  } catch (e) { /* no tmux server: nothing running */ }
  cache = { at: Date.now(), value: { terminals, mem: memInfo() } };
  return cache.value;
}

module.exports = { usage };
