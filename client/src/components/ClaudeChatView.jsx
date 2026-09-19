import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { Box, Typography, IconButton, TextField, CircularProgress } from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Terminal as TerminalIcon,
  Edit as EditIcon,
  Description as FileIcon,
  Language as WebIcon,
  Search as SearchIcon,
  Build as ToolIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useSocket } from '../utils/SocketContext';

/**
 * Rich view of the Claude Code session running in a terminal.
 *
 * Reads the structured transcript the server tails (no terminal scraping), so
 * it can show real diffs and collapsible tool calls. Read-only: input still
 * goes through the terminal.
 */

/* ---------- tiny markdown renderer (builds React nodes, never raw HTML) ---------- */

function inline(text, keyBase) {
  // Code first so emphasis inside a span of code is left alone.
  const out = [];
  const re = /(`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*\n]+\*)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${keyBase}-i${i++}`;
    if (t.startsWith('`')) {
      out.push(<code key={k} style={{ background: '#222', padding: '1px 4px', borderRadius: 3, fontFamily: '"Fira Code", monospace', fontSize: '0.92em', color: '#7ddc7d' }}>{t.slice(1, -1)}</code>);
    } else if (t.startsWith('[')) {
      const cut = t.indexOf('](');
      const label = t.slice(1, cut), href = t.slice(cut + 2, -1);
      out.push(<a key={k} href={href} target="_blank" rel="noreferrer" style={{ color: '#4da6ff' }}>{label}</a>);
    } else if (t.startsWith('***')) {
      out.push(<strong key={k}><em>{t.slice(3, -3)}</em></strong>);
    } else if (t.startsWith('**')) {
      out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    } else if (t.startsWith('~~')) {
      out.push(<span key={k} style={{ textDecoration: 'line-through', opacity: 0.7 }}>{t.slice(2, -2)}</span>);
    } else {
      out.push(<em key={k}>{t.slice(1, -1)}</em>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
const splitRow = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

function MiniMarkdown({ text }) {
  const nodes = [];
  const lines = String(text || '').split('\n');
  let i = 0, key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {                       // fenced code
      const lang = line.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      nodes.push(
        <Box key={`k${key++}`} component="pre" sx={{
          m: '6px 0', p: 1, backgroundColor: '#0d0d0d', border: '1px solid #262626',
          borderRadius: 1, overflow: 'auto', fontSize: '12px', lineHeight: 1.5,
          fontFamily: '"Fira Code", monospace', color: '#d4d4d4'
        }}>
          {lang && <Box component="span" sx={{ color: '#666', fontSize: '10px', display: 'block', mb: 0.5 }}>{lang}</Box>}
          {body.join('\n')}
        </Box>
      );
      continue;
    }

    // Table: a row of pipes followed by the |---|---| separator.
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(splitRow(lines[i++]));
      nodes.push(
        <Box key={`k${key++}`} sx={{ overflowX: 'auto', my: 0.75 }}>
          <Box component="table" sx={{ borderCollapse: 'collapse', fontSize: '12px', width: '100%' }}>
            <thead>
              <tr>{head.map((c, ci) => (
                <Box component="th" key={ci} sx={{
                  border: '1px solid #2e2e2e', px: 1, py: 0.5, textAlign: 'left',
                  color: '#eee', backgroundColor: '#161616', fontWeight: 700, whiteSpace: 'nowrap'
                }}>{inline(c, `th${key}-${ci}`)}</Box>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => (
                  <Box component="td" key={ci} sx={{
                    border: '1px solid #2e2e2e', px: 1, py: 0.5, color: '#ccc', verticalAlign: 'top'
                  }}>{inline(c, `td${key}-${ri}-${ci}`)}</Box>
                ))}</tr>
              ))}
            </tbody>
          </Box>
        </Box>
      );
      continue;
    }

    // Blockquote — how drafts and previews are usually shown.
    if (/^\s*>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      nodes.push(
        <Box key={`k${key++}`} sx={{
          borderLeft: '3px solid #555', pl: 1.25, my: 0.75, py: 0.5,
          backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '0 3px 3px 0'
        }}>
          <MiniMarkdown text={body.join('\n')} />
        </Box>
      );
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {    // horizontal rule
      nodes.push(<Box key={`k${key++}`} sx={{ borderTop: '1px solid #2e2e2e', my: 1 }} />);
      i++; continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const size = Math.max(11, 16 - h[1].length);
      nodes.push(<Typography key={`k${key++}`} sx={{ fontWeight: 700, fontSize: `${size}px`, mt: 1, mb: 0.5, color: '#eee' }}>{inline(h[2], `h${key}`)}</Typography>);
      i++; continue;
    }

    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      const depth = Math.min(3, Math.floor(li[1].replace(/\t/g, '  ').length / 2));
      nodes.push(
        <Box key={`k${key++}`} sx={{ display: 'flex', gap: 1, pl: 1 + depth * 1.5 }}>
          <Box sx={{ color: '#666', flexShrink: 0 }}>{/^\d/.test(li[2]) ? li[2] : '•'}</Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>{inline(li[3], `l${key}`)}</Box>
        </Box>
      );
      i++; continue;
    }

    if (!line.trim()) { nodes.push(<Box key={`k${key++}`} sx={{ height: 6 }} />); i++; continue; }
    nodes.push(<Box key={`k${key++}`} sx={{ whiteSpace: 'pre-wrap' }}>{inline(line, `p${key}`)}</Box>);
    i++;
  }
  return <Box sx={{ fontSize: '13px', lineHeight: 1.6, color: '#ddd' }}>{nodes}</Box>;
}

/* ---------- result renderers ---------- */

function Diff({ patch, filePath }) {
  return (
    <Box sx={{ mt: 0.5 }}>
      <Box sx={{ fontSize: '11px', color: '#888', fontFamily: 'monospace', mb: 0.5 }}>{filePath}</Box>
      {(patch || []).map((h, hi) => (
        <Box key={hi} sx={{
          border: '1px solid #262626', borderRadius: 1, overflow: 'auto',
          backgroundColor: '#0d0d0d', mb: 0.5
        }}>
          <Box sx={{ fontSize: '10px', color: '#666', px: 1, py: 0.3, borderBottom: '1px solid #222', fontFamily: 'monospace' }}>
            @@ -{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@
          </Box>
          {(h.lines || []).map((l, li) => {
            const add = l.startsWith('+'), del = l.startsWith('-');
            return (
              <Box key={li} sx={{
                fontFamily: '"Fira Code", monospace', fontSize: '11.5px', lineHeight: 1.5,
                whiteSpace: 'pre', px: 1,
                color: add ? '#7ddc7d' : del ? '#ff8080' : '#9a9a9a',
                backgroundColor: add ? 'rgba(46,160,67,0.12)' : del ? 'rgba(248,81,73,0.12)' : 'transparent'
              }}>{l}</Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

function Mono({ text, color = '#bbb', truncated, fullLength }) {
  if (!text) return null;
  return (
    <Box sx={{
      fontFamily: '"Fira Code", monospace', fontSize: '11.5px', lineHeight: 1.5,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word', color,
      backgroundColor: '#0d0d0d', border: '1px solid #222', borderRadius: 1,
      p: 1, mt: 0.5, maxHeight: 320, overflow: 'auto'
    }}>
      {text}
      {truncated && <Box sx={{ color: '#666', mt: 0.5 }}>… recortado ({fullLength} caracteres)</Box>}
    </Box>
  );
}

function Result({ result }) {
  if (!result) return null;
  switch (result.type) {
    case 'edit':
      return <Diff patch={result.patch} filePath={result.filePath} />;
    case 'bash':
      return (
        <>
          <Mono text={result.stdout && result.stdout.text} truncated={result.stdout && result.stdout.truncated} fullLength={result.stdout && result.stdout.fullLength} />
          <Mono text={result.stderr && result.stderr.text} color="#ff8080" truncated={result.stderr && result.stderr.truncated} />
          {result.interrupted && <Box sx={{ color: '#ffa726', fontSize: '11px', mt: 0.5 }}>interrumpido</Box>}
        </>
      );
    case 'read':
      return <Box sx={{ fontSize: '11px', color: '#888', mt: 0.5, fontFamily: 'monospace' }}>{result.filePath} · {result.numLines} de {result.totalLines} líneas</Box>;
    case 'web':
      return <Box sx={{ fontSize: '11px', color: '#888', mt: 0.5 }}>{result.url} · HTTP {result.code}</Box>;
    case 'search':
      return <Box sx={{ fontSize: '11px', color: '#888', mt: 0.5 }}>“{result.query}” · {result.count} resultados</Box>;
    case 'command':
      return <Box sx={{ fontSize: '11px', color: result.ok ? '#7ddc7d' : '#ff8080', mt: 0.5 }}>{result.name}</Box>;
    default:
      return <Mono text={result.text} truncated={result.truncated} fullLength={result.fullLength} />;
  }
}

// Tools that stop and wait for a human answer in the TUI. The chat view cannot
// drive their arrow-key pickers, so it says so instead of looking stuck.
const WAITING_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode', 'EnterPlanMode']);

const TOOL_ICON = {
  Bash: TerminalIcon, Edit: EditIcon, Write: EditIcon, Read: FileIcon,
  WebFetch: WebIcon, WebSearch: SearchIcon, Grep: SearchIcon, Glob: SearchIcon
};

function ToolCard({ ev }) {
  // Edits are the payload — open them by default, keep noisier tools collapsed.
  const [open, setOpen] = useState(ev.result && ev.result.type === 'edit');
  const Icon = TOOL_ICON[ev.name] || ToolIcon;
  const subtitle = ev.input && (ev.input.command || ev.input.file_path || ev.input.path || ev.input.query || ev.input.url || ev.input.pattern || ev.input.description || '');
  return (
    <Box sx={{ border: '1px solid #262626', borderRadius: 1, mb: 0.75, backgroundColor: '#141414' }}>
      <Box onClick={() => setOpen(o => !o)} sx={{
        display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.6, cursor: 'pointer',
        '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' }
      }}>
        {open ? <ExpandMoreIcon sx={{ fontSize: 15, color: '#666' }} /> : <ChevronRightIcon sx={{ fontSize: 15, color: '#666' }} />}
        <Icon sx={{ fontSize: 14, color: '#00aa55' }} />
        <Box sx={{ fontSize: '12px', color: '#ccc', fontWeight: 600 }}>{ev.name}</Box>
        <Box sx={{
          fontSize: '11px', color: '#777', fontFamily: '"Fira Code", monospace',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1
        }}>{subtitle}</Box>
        {!ev.result && <Box sx={{ fontSize: '10px', color: '#ffa726' }}>corriendo…</Box>}
      </Box>
      {open && (
        <Box sx={{ px: 1, pb: 1 }}>
          {ev.input && ev.input.command && <Mono text={ev.input.command} color="#7ddc7d" />}
          <Result result={ev.result} />
        </Box>
      )}
    </Box>
  );
}

/**
 * Its own component on purpose: the draft lives here, so typing re-renders this
 * box alone instead of the whole conversation on every keystroke.
 */
function Composer({ terminalId, waiting, onSent }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || waiting) return;
    setSending(true);
    setSendError('');
    try {
      const token = (() => { try { return localStorage.getItem('token') || ''; } catch (e) { return ''; } })();
      const r = await fetch('/api/claude/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminalId, text })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.status !== 'ok') setSendError(d.message || 'No se pudo enviar');
      else { setDraft(''); if (onSent) onSent(); }
    } catch (e) {
      setSendError('Error de red al enviar');
    }
    setSending(false);
  };

  return (
    <Box sx={{ flexShrink: 0, borderTop: '1px solid #222', p: 1, backgroundColor: '#111' }}>
      {sendError && <Box sx={{ color: '#ff8080', fontSize: '11px', mb: 0.5 }}>{sendError}</Box>}
      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-end' }}>
        <TextField
          multiline maxRows={6} fullWidth size="small"
          placeholder={waiting ? 'Responde primero en el terminal…' : 'Escribe un prompt… (Enter envía, Shift+Enter nueva línea)'}
          value={draft}
          disabled={sending || !!waiting}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          InputProps={{ sx: { color: '#ddd', fontSize: '13px', backgroundColor: '#0d0d0d' } }}
        />
        <IconButton
          onClick={send}
          disabled={sending || !!waiting || !draft.trim()}
          sx={{ color: draft.trim() ? '#00ff00' : '#555' }}
          title="Enviar a Claude"
        >
          {sending ? <CircularProgress size={18} sx={{ color: '#00ff00' }} /> : <SendIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>
      {draft.includes('\n') && (
        <Box sx={{ color: '#777', fontSize: '10px', mt: 0.5 }}>
          Los saltos de línea se envían como espacios (la TUI de Claude enviaría el prompt en el primero).
        </Box>
      )}
    </Box>
  );
}

/* ---------- main view ---------- */

export default function ClaudeChatView({ terminalId, isActive, onNeedsTerminal }) {
  const { socket } = useSocket();
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const scrollRef = useRef(null);
  const stickRef = useRef(true);

  const merge = useCallback((incoming) => {
    setEvents(prev => {
      const next = prev.slice();
      for (const ev of incoming) {
        if (ev.kind === 'title') { setTitle(ev.text); continue; }
        if (ev.kind === 'result') {
          // Attach to its tool call; if the tool is outside our window, drop it.
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].kind === 'tool' && next[i].toolId === ev.toolId) {
              next[i] = { ...next[i], result: ev.result };
              break;
            }
          }
          continue;
        }
        if (ev.uuid && next.some(e => e.uuid === ev.uuid && e.kind === ev.kind && e.toolId === ev.toolId)) continue;
        next.push(ev);
      }
      return next.slice(-400);
    });
  }, []);

  useEffect(() => {
    if (!socket || !terminalId) return;
    const onEvents = (payload) => {
      if (!payload || payload.terminalId !== terminalId) return;
      if (payload.error) { setError(payload.error); return; }
      setError('');
      if (payload.backlog) setEvents([]);
      merge(payload.events || []);
    };
    // The server drops the watch when the socket disconnects (a suspended
    // phone does that constantly), and socket.io reuses the same object on
    // reconnect, so nothing here would re-run. Re-subscribe on every connect
    // or the view goes quiet without saying so.
    const subscribe = () => socket.emit('claude-watch', { terminalId });
    socket.on('claude-events', onEvents);
    socket.on('connect', subscribe);
    subscribe();
    return () => {
      socket.off('claude-events', onEvents);
      socket.off('connect', subscribe);
      socket.emit('claude-unwatch', { terminalId });
    };
  }, [socket, terminalId, merge]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [events]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  // Built once per batch of events so typing in the composer never rebuilds
  // hundreds of styled nodes.
  const messageNodes = useMemo(() => events.map((ev, i) => {
          const pad = ev.sidechain ? { borderLeft: '2px solid #444', pl: 1, ml: 0.5 } : {};
          if (ev.kind === 'prompt') {
            return (
              <Box key={`e${i}`} sx={{ ...pad, mb: 1, mt: 1.5, borderLeft: '3px solid #00aa55', pl: 1.25, backgroundColor: 'rgba(0,170,85,0.06)', py: 0.75, borderRadius: '0 4px 4px 0' }}>
                <MiniMarkdown text={ev.text} />
              </Box>
            );
          }
          if (ev.kind === 'text') {
            return <Box key={`e${i}`} sx={{ ...pad, mb: 1 }}><MiniMarkdown text={ev.text} /></Box>;
          }
          if (ev.kind === 'tool') {
            return <Box key={`e${i}`} sx={pad}><ToolCard ev={ev} /></Box>;
          }
          return null;
  }), [events]);

  // Claude is blocked if the newest blocking tool call has no result yet.
  let waiting = null;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind !== 'tool') continue;
    if (WAITING_TOOLS.has(e.name) && !e.result) waiting = e;
    break;
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0a' }}>
      {title && (
        <Box sx={{ px: 1.5, py: 0.6, borderBottom: '1px solid #222', color: '#888', fontSize: '11px', flexShrink: 0 }}>
          {title}
        </Box>
      )}
      <Box ref={scrollRef} onScroll={onScroll} sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1 }}>
        {error && <Box sx={{ color: '#ffa726', fontSize: '12px', p: 2, textAlign: 'center' }}>{error}</Box>}
        {!error && events.length === 0 && (
          <Box sx={{ color: '#666', fontSize: '12px', p: 2, textAlign: 'center' }}>Esperando actividad de Claude…</Box>
        )}
        {messageNodes}
      </Box>

      {waiting && (
        <Box sx={{
          flexShrink: 0, borderTop: '1px solid #4a3c00', backgroundColor: 'rgba(255,167,38,0.10)',
          px: 1.5, py: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box sx={{ color: '#ffa726', fontSize: '12px', fontWeight: 700, flex: 1 }}>
              Claude está esperando tu respuesta en el terminal
            </Box>
            <Box
              component="button"
              onClick={() => onNeedsTerminal && onNeedsTerminal()}
              sx={{
                cursor: 'pointer', border: '1px solid #ffa726', background: 'transparent',
                color: '#ffa726', borderRadius: 1, fontSize: '11px', padding: '3px 10px',
                '&:hover': { backgroundColor: 'rgba(255,167,38,0.15)' }
              }}
            >Ir al terminal</Box>
          </Box>
          {waiting.input && waiting.input.question && (
            <Box sx={{ color: '#ddd', fontSize: '12px', mb: 0.5 }}>{waiting.input.question}</Box>
          )}
          {waiting.input && waiting.input.options && waiting.input.options.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {waiting.input.options.map((opt, i) => (
                <Box key={i} sx={{
                  fontSize: '11px', color: '#bbb', border: '1px solid #333',
                  borderRadius: 1, px: 0.75, py: 0.25
                }}>{opt}</Box>
              ))}
            </Box>
          )}
          {waiting.name === 'ExitPlanMode' && (
            <Box sx={{ color: '#bbb', fontSize: '11.5px' }}>Claude pide aprobar un plan.</Box>
          )}
          <Box sx={{ color: '#8a7a55', fontSize: '10px', mt: 0.5 }}>
            Se responde con las flechas en el terminal; esta vista no puede hacerlo.
          </Box>
        </Box>
      )}

      {/* The prompt goes into the same tmux session, as if typed */}
      <Composer
        terminalId={terminalId}
        waiting={waiting}
        onSent={() => { stickRef.current = true; }}
      />
    </Box>
  );
}
