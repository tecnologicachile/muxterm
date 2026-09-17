/**
 * Claude Code transcript reader.
 *
 * Claude Code appends every session to ~/.claude/projects/<cwd-slug>/<uuid>.jsonl
 * as structured JSON lines. This module turns those lines into render-ready
 * events for the chat view, and tails a live file for new ones.
 *
 * Transcripts reach hundreds of MB, so we never read a whole file: we seek from
 * the end and drop the partial first line.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// Bookkeeping lines the chat view has no use for (they were >60% of the file).
const NOISE_TYPES = new Set([
  'attachment', 'file-history-snapshot', 'mode', 'permission-mode',
  'last-prompt', 'atis-latch', 'summary', 'system'
]);

const MAX_TEXT = 4000;      // per rendered block
// Big tool outputs (WebFetch/Read) make lines huge, so a small window shows
// very few turns. 2 MB lands on a useful number of them.
const TAIL_BYTES = 2 * 1024 * 1024;

function clip(s, max = MAX_TEXT) {
  if (typeof s !== 'string') return { text: '', truncated: false };
  if (s.length <= max) return { text: s, truncated: false };
  return { text: s.slice(0, max), truncated: true, fullLength: s.length };
}

/** Shape a raw toolUseResult into something the UI can render directly. */
function normalizeResult(r) {
  if (r == null) return null;
  if (typeof r === 'string') return { type: 'generic', ...clip(r) };

  if (r.structuredPatch) {
    return {
      type: 'edit',
      filePath: r.filePath,
      replaceAll: !!r.replaceAll,
      // Hunks already carry +/-/space prefixes — render as a unified diff.
      patch: (r.structuredPatch || []).map(h => ({
        oldStart: h.oldStart, oldLines: h.oldLines,
        newStart: h.newStart, newLines: h.newLines,
        lines: (h.lines || []).slice(0, 200)
      }))
    };
  }
  if (typeof r.stdout === 'string' || typeof r.stderr === 'string') {
    return {
      type: 'bash',
      stdout: clip(r.stdout || ''),
      stderr: clip(r.stderr || ''),
      interrupted: !!r.interrupted
    };
  }
  if (r.file && r.file.filePath) {
    return {
      type: 'read',
      filePath: r.file.filePath,
      numLines: r.file.numLines,
      totalLines: r.file.totalLines
    };
  }
  if (r.url) {
    return { type: 'web', url: r.url, code: r.code, bytes: r.bytes };
  }
  if (r.query) {
    return { type: 'search', query: r.query, count: r.searchCount };
  }
  if (r.commandName) {
    return { type: 'command', name: r.commandName, ok: r.success !== false };
  }
  return { type: 'generic', ...clip(JSON.stringify(r)) };
}

/**
 * Turn one JSONL line into zero or more render events.
 * Returns an array (an assistant turn holds several content blocks).
 */
function parseLine(line) {
  let o;
  try { o = JSON.parse(line); } catch (e) { return []; }
  if (!o || typeof o !== 'object') return [];
  if (o.type === 'ai-title') return [{ kind: 'title', text: o.title || o.aiTitle || '' }];
  if (NOISE_TYPES.has(o.type)) return [];

  const base = {
    uuid: o.uuid,
    ts: o.timestamp,
    sidechain: !!o.isSidechain    // subagent thread
  };

  if (o.type === 'user') {
    const c = o.message && o.message.content;
    // A user line is either a real prompt or the carrier of a tool result.
    if (o.toolUseResult) {
      const toolId = Array.isArray(c)
        ? (c.find(b => b && b.type === 'tool_result') || {}).tool_use_id
        : undefined;
      const res = normalizeResult(o.toolUseResult);
      return res ? [{ ...base, kind: 'result', toolId, result: res }] : [];
    }
    if (typeof c === 'string') return [{ ...base, kind: 'prompt', ...clip(c) }];
    if (Array.isArray(c)) {
      const txt = c.filter(b => b && b.type === 'text').map(b => b.text).join('\n');
      if (txt) return [{ ...base, kind: 'prompt', ...clip(txt) }];
    }
    return [];
  }

  if (o.type === 'assistant') {
    const blocks = (o.message && o.message.content) || [];
    const out = [];
    for (const b of blocks) {
      if (!b) continue;
      if (b.type === 'text' && b.text) out.push({ ...base, kind: 'text', ...clip(b.text) });
      else if (b.type === 'thinking' && b.thinking) out.push({ ...base, kind: 'thinking', ...clip(b.thinking) });
      else if (b.type === 'tool_use') {
        out.push({
          ...base, kind: 'tool', toolId: b.id, name: b.name,
          input: clipInput(b.name, b.input || {})
        });
      }
    }
    return out;
  }
  return [];
}

/** Keep the few input fields worth showing; clip anything long. */
function clipInput(name, input) {
  const pick = {};
  for (const k of ['command', 'description', 'file_path', 'path', 'pattern', 'query', 'url', 'prompt', 'subagent_type']) {
    if (typeof input[k] === 'string') pick[k] = clip(input[k], 600).text;
  }
  // Write/Edit bodies are shown via the result diff, not the raw input.
  if (name === 'Write' && typeof input.content === 'string') pick._bytes = input.content.length;

  // These block on a human answering in the TUI, so surface enough for the chat
  // view to show what is being asked while it sends you to the terminal.
  if (name === 'AskUserQuestion' && Array.isArray(input.questions) && input.questions[0]) {
    const q = input.questions[0];
    pick.question = clip(q.question || '', 400).text;
    pick.header = q.header || '';
    pick.options = (q.options || []).slice(0, 6).map(opt => clip(opt.label || '', 120).text);
  }
  if (name === 'ExitPlanMode' && typeof input.plan === 'string') {
    pick.plan = clip(input.plan, 1200).text;
  }
  return pick;
}

/** Read the last chunk of a transcript and parse it. */
function readTail(file, maxBytes = TAIL_BYTES) {
  let fd;
  try {
    const st = fs.statSync(file);
    const start = Math.max(0, st.size - maxBytes);
    const len = st.size - start;
    if (len <= 0) return { events: [], size: st.size };
    const buf = Buffer.alloc(len);
    fd = fs.openSync(file, 'r');
    fs.readSync(fd, buf, 0, len, start);
    let text = buf.toString('utf8');
    if (start > 0) {
      const nl = text.indexOf('\n');   // drop the partial first line
      text = nl >= 0 ? text.slice(nl + 1) : '';
    }
    const events = [];
    for (const line of text.split('\n')) {
      if (line.trim()) events.push(...parseLine(line));
    }
    return { events, size: st.size };
  } catch (e) {
    return { events: [], size: 0, error: e.message };
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (e) {} }
  }
}

/** Claude Code's directory name for a cwd (every separator becomes a dash). */
function slugForCwd(cwd) {
  return String(cwd || '').replace(/[/.]/g, '-');
}

/**
 * Best-effort lookup when no hook has registered the session: newest .jsonl in
 * the slug dir, validated against the cwd recorded inside the file.
 */
function findTranscriptByCwd(cwd) {
  const dir = path.join(PROJECTS_DIR, slugForCwd(cwd));
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => {
        const p = path.join(dir, f);
        return { p, mtime: fs.statSync(p).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return files.length ? files[0].p : null;
  } catch (e) {
    return null;
  }
}

module.exports = { parseLine, readTail, slugForCwd, findTranscriptByCwd, PROJECTS_DIR, TAIL_BYTES };
