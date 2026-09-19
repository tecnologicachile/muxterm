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
  Send as SendIcon,
  Mic as MicIcon,
  Stop as StopIcon,
  VolumeUp as VolumeUpIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';
import { useSocket } from '../utils/SocketContext';
import { toSpeech, speak, stopSpeaking, speechSupported, silentLoopUri, fetchSpeechUrl, toneUri } from '../utils/speech';

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

// The browser default scrollbar is light and breaks the dark UI, and muxterm
// styles them per component rather than globally.
const darkScroll = {
  scrollbarWidth: 'thin',
  scrollbarColor: '#3a3a3a transparent',
  '&::-webkit-scrollbar': { width: '8px', height: '8px' },
  '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#3a3a3a', borderRadius: '4px',
    '&:hover': { backgroundColor: '#4d4d4d' }
  },
  '&::-webkit-scrollbar-corner': { backgroundColor: 'transparent' }
};

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
          fontFamily: '"Fira Code", monospace', color: '#d4d4d4', ...darkScroll
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
        <Box key={`k${key++}`} sx={{ overflowX: 'auto', my: 0.75, ...darkScroll }}>
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
          backgroundColor: '#0d0d0d', mb: 0.5, ...darkScroll
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
      p: 1, mt: 0.5, maxHeight: 320, overflow: 'auto', ...darkScroll
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
function Composer({ terminalId, waiting, onSent, isActive, recording, onVoiceToggle }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const inputRef = useRef(null);

  // Focusing here when the panel is selected saves a click before typing.
  // Desktop only: on a phone it would pop the on-screen keyboard every time
  // you switch panels.
  useEffect(() => {
    if (!isActive || waiting) return;
    const smallScreen = typeof window !== 'undefined' && window.innerWidth <= 768;
    const touchUA = typeof navigator !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (touchUA && smallScreen) return;
    const t = setTimeout(() => { try { inputRef.current?.focus(); } catch (e) {} }, 60);
    return () => clearTimeout(t);
  }, [isActive, waiting]);

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
          inputRef={inputRef}
          disabled={sending || !!waiting}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          InputProps={{ sx: { color: '#ddd', fontSize: '13px', backgroundColor: '#0d0d0d' } }}
        />
        {onVoiceToggle && !recording && (
          <IconButton
            onClick={() => onVoiceToggle(true)}
            disabled={!!waiting}
            sx={{ color: '#888', '&:hover': { color: '#00ff00' } }}
            title="Mensaje de voz"
          >
            <MicIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}
        {onVoiceToggle && recording && (
          <>
            {/* Stopping is a tap you already make, so it carries the choice:
                straight through, or via the review dialog. */}
            <IconButton
              onClick={() => onVoiceToggle(false)}
              sx={{ color: '#888', '&:hover': { color: '#ddd' } }}
              title="Detener y revisar antes de enviar"
            >
              <EditIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              onClick={() => onVoiceToggle(true)}
              sx={{
                color: '#ff3b3b', backgroundColor: 'rgba(255,59,59,0.12)',
                '&:hover': { color: '#ff6b6b' }
              }}
              title="Detener y enviar directo"
            >
              <StopIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </>
        )}
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

const authToken = () => { try { return localStorage.getItem('token') || ''; } catch (e) { return ''; } };

// Inside the companion app the native service owns the media session, the
// keep-alive and the headset button; the page must not compete for them.
const inNativeApp = () => typeof window !== 'undefined' && !!window.muxtermNative;

/* ---------- main view ---------- */

export default function ClaudeChatView({ terminalId, isActive, onNeedsTerminal, recording, onVoiceToggle, onHandsFree }) {
  const { socket } = useSocket();
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const scrollRef = useRef(null);
  const stickRef = useRef(true);
  const fileRef = useRef(null);
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState('');
  // Remembered per device: you want this on the phone with headphones, not
  // necessarily on the desktop.
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try { return localStorage.getItem('muxterm-autospeak') === '1'; } catch (e) { return false; }
  });
  const spokenRef = useRef(new Set());
  const audioRef = useRef(null);
  // True while we are the ones pausing or swapping the source, so a pause the
  // headset caused can be told apart from our own.
  const internalRef = useRef(false);
  const queueRef = useRef([]);
  const playingRef = useRef(false);
  const silentUri = useMemo(() => { try { return silentLoopUri(1); } catch (e) { return ''; } }, []);
  // With the screen off these beeps are the only feedback that exists.
  const tones = useMemo(() => {
    try {
      return { start: toneUri(660, 150), done: toneUri(1046, 150), error: toneUri(300, 380) };
    } catch (e) { return null; }
  }, []);
  const prevRecordingRef = useRef(false);

  const enqueueSpeechRef = useRef(() => {});
  const autoSpeakRef = useRef(autoSpeak);
  useEffect(() => { autoSpeakRef.current = autoSpeak; }, [autoSpeak]);

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
      // A reconnect re-sends the whole backlog. Clearing it made the
      // conversation blank and redraw, which is the flicker you see on coming
      // back to the tab. The merge dedupes by uuid, so only wipe when the
      // transcript itself changed (a /clear starts a new file).
      if (payload.backlog) {
        if (payload.file && fileRef.current && payload.file !== fileRef.current) setEvents([]);
        if (payload.file) fileRef.current = payload.file;
      }
      const incoming = payload.events || [];
      if (payload.backlog) {
        // Never read the history aloud on opening — only what arrives after.
        for (const ev of incoming) if (ev.kind === 'text' && ev.uuid) spokenRef.current.add(ev.uuid + ':' + (ev.text || '').length);
      } else if (autoSpeakRef.current) {
        // No visibility check: reading with the screen off is the point, and
        // the audio element is what makes it possible.
        for (const ev of incoming.filter(ev => ev.kind === 'text' && ev.text)) {
          const k = (ev.uuid || '') + ':' + ev.text.length;
          if (spokenRef.current.has(k)) continue;
          spokenRef.current.add(k);
          const t = toSpeech(ev.text);
          if (t) enqueueSpeechRef.current(t);
        }
      }
      merge(incoming);
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

  // Between replies the element loops near-silence, so the tab keeps a live
  // media session and Android does not freeze it with the screen off.
  const [handsFree, setHandsFree] = useState(false);
  // Flips the first time Android actually hands us a headset key, which is the
  // only proof that the routing works.
  const [mediaKeys, setMediaKeys] = useState(false);

  const keepAlive = useCallback(() => {
    if (inNativeApp()) { setHandsFree(true); return; }   // the service already holds it
    const a = audioRef.current;
    if (!a || !autoSpeakRef.current || !silentUri) return;
    try {
      internalRef.current = true;
      a.loop = true;
      a.volume = 0.05;
      if (a.src !== silentUri) a.src = silentUri;
      const p = a.play();
      if (p && p.then) p.then(() => setHandsFree(true)).catch(() => setHandsFree(false));
      // Android only routes headset buttons to a page it shows as a player,
      // and it only shows one that declares metadata and playback state.
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new window.MediaMetadata({
            title: 'muxterm — manos libres',
            artist: 'Pulsa play para dictar',
            album: 'Modo conversación'
          });
          navigator.mediaSession.playbackState = 'playing';
        } catch (e) {}
      }
    } catch (e) { setHandsFree(false); }
  }, [silentUri]);

  // Through the element that is already playing: with the screen off Android
  // refuses to start a brand-new audio element, which is how the beeps were
  // being played and why they were silent.
  const beep = useCallback((uri) => {
    const a = audioRef.current;
    if (!a || !uri) return;
    try {
      internalRef.current = true;
      a.loop = false;
      a.volume = 0.9;
      a.src = uri;
      a.onended = () => keepAlive();
      a.play().catch(() => {});
    } catch (e) {}
  }, [keepAlive]);

  const playNext = useCallback(async () => {
    const a = audioRef.current;
    if (!a || playingRef.current) return;
    const text = queueRef.current.shift();
    if (!text) { keepAlive(); return; }

    playingRef.current = true;
    setSpeaking(true);
    let url = null;
    try {
      url = await fetchSpeechUrl(text, authToken());
      internalRef.current = true;
      a.loop = false;
      a.volume = 1;
      a.src = url;
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new window.MediaMetadata({
            title: 'Respuesta de Claude', artist: 'muxterm'
          });
        } catch (e) {}
      }
      await a.play();
      await new Promise((resolve) => {
        a.onended = resolve;
        a.onerror = resolve;
      });
    } catch (e) {
      // Falling back to the browser voice only helps while the screen is on,
      // which is exactly when it is still allowed to speak.
      if (document.visibilityState === 'visible' && speechSupported()) {
        await new Promise((resolve) => speak(text, { onEnd: resolve, onError: resolve }));
      } else {
        setSpeechError((e && e.message) || 'No se pudo reproducir la voz');
        setTimeout(() => setSpeechError(''), 6000);
      }
    } finally {
      if (url) { try { URL.revokeObjectURL(url); } catch (e) {} }
      playingRef.current = false;
      setSpeaking(false);
    }
    if (queueRef.current.length) playNext(); else keepAlive();
  }, [keepAlive]);

  const enqueueSpeech = useCallback((text) => {
    if (!text) return;
    queueRef.current.push(text);
    playNext();
  }, [playNext]);

  const stopAll = useCallback(() => {
    queueRef.current = [];
    stopSpeaking();
    const a = audioRef.current;
    if (a) { try { internalRef.current = true; a.pause(); a.onended = null; } catch (e) {} }
    playingRef.current = false;
    setSpeaking(false);
    keepAlive();
  }, [keepAlive]);

  const speakLast = () => {
    if (autoSpeakRef.current) keepAlive();   // this tap is a gesture: use it
    if (speaking) { stopAll(); return; }
    const last = [...events].reverse().find(e => e.kind === 'text' && e.text);
    if (!last) return;
    const t = toSpeech(last.text);
    if (!t) return;
    setSpeechError('');
    enqueueSpeech(t);
  };

  const toggleAutoSpeak = () => {
    setAutoSpeak(v => {
      const next = !v;
      try { localStorage.setItem('muxterm-autospeak', next ? '1' : '0'); } catch (e) {}
      if (next) {
        // Start the audio inside the click: autoplay rules can block a play()
        // that only happens later from an effect, and then no media session
        // exists and the headset button has nowhere to go.
        autoSpeakRef.current = true;
        setTimeout(() => keepAlive(), 0);
      } else {
        setHandsFree(false);
        try { navigator.mediaSession.playbackState = 'none'; } catch (e) {}
      }
      if (!next) { queueRef.current = []; stopSpeaking(); const a = audioRef.current; if (a) { try { a.pause(); } catch (e) {} } setSpeaking(false); }
      return next;
    });
  };

  useEffect(() => { enqueueSpeechRef.current = enqueueSpeech; }, [enqueueSpeech]);

  // Hand the native service what it needs to dictate into this conversation:
  // the auth token and which terminal this view is on. The last mounted view
  // wins, which on a phone is the one you are looking at.
  useEffect(() => {
    // Follows the panel you are looking at, not the last one to mount: with
    // two panels in modo conversación the dictation went to the other one.
    if (!inNativeApp() || !terminalId || !isActive) return;
    try { window.muxtermNative.setContext(authToken(), terminalId, window.location.origin); } catch (e) {}
  }, [terminalId, isActive]);

  // Hold the microphone open while hands-free is on, and let it go when off.
  const [micHeld, setMicHeld] = useState(false);
  useEffect(() => {
    if (!onHandsFree) return;
    // Inside the companion app the service records natively; a page holding
    // the microphone open at the same time starves it, and Whisper is then
    // handed silence — which it "transcribes" as subtitle credits.
    if (inNativeApp()) { setMicHeld(true); return; }
    let alive = true;
    Promise.resolve(onHandsFree(!!autoSpeak)).then(ok => {
      if (alive) setMicHeld(!!autoSpeak && ok !== false);
    });
    return () => { alive = false; };
  }, [autoSpeak, onHandsFree]);

  useEffect(() => () => { if (onHandsFree) onHandsFree(false); }, [onHandsFree]);

  useEffect(() => {
    if (autoSpeak) keepAlive();
    else { const a = audioRef.current; if (a) { try { a.pause(); } catch (e) {} } }
  }, [autoSpeak, keepAlive]);

  useEffect(() => () => {
    stopSpeaking();
    const a = audioRef.current;
    if (a) { try { a.pause(); } catch (e) {} }
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  // Announce recording state out loud while hands-free is in play.
  useEffect(() => {
    if (!tones || !autoSpeak) { prevRecordingRef.current = !!recording; return; }
    const was = prevRecordingRef.current;
    prevRecordingRef.current = !!recording;
    if (!was && recording) beep(tones.start);
    if (was && !recording) beep(tones.done);
  }, [recording, autoSpeak, tones, beep]);

  // Bluetooth headset buttons reach the page as media session actions, and the
  // silent keep-alive loop is what keeps that session alive with the screen
  // off — so the hardware button works without an app.
  useEffect(() => {
    if (!autoSpeak || !('mediaSession' in navigator) || inNativeApp()) return;
    const set = (action, fn) => {
      try { navigator.mediaSession.setActionHandler(action, fn); } catch (e) {}
    };

    const startRecording = () => {
      if (!onVoiceToggle) return;
      onVoiceToggle(true);
      // Silence after a press means the mic never opened; say so with a tone.
      setTimeout(() => {
        if (!prevRecordingRef.current && tones) beep(tones.error);
      }, 1600);
    };

    // Left unset on purpose: registering them suppresses the pause that the
    // listener below relies on to notice the button.
    // Headsets that do have them keep the more explicit mapping.
    set('nexttrack', () => { if (recording) { onVoiceToggle && onVoiceToggle(true); } else startRecording(); });
    set('previoustrack', () => speakLast());
    return () => { set('nexttrack', null); set('previoustrack', null); };
  }, [autoSpeak, recording, onVoiceToggle, tones, stopAll, beep]);   // eslint-disable-line

  // Android's default response to the headset button is to pause our audio, and
  // that pause does arrive even where setActionHandler never fires. So the
  // event itself is the trigger: more reliable than asking to be told.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !autoSpeak || inNativeApp()) return;
    const onPause = () => {
      if (internalRef.current) { internalRef.current = false; return; }
      setMediaKeys(true);
      if (recording) { if (onVoiceToggle) onVoiceToggle(true); return; }
      if (playingRef.current) { stopAll(); return; }
      if (onVoiceToggle) {
        onVoiceToggle(true);
        setTimeout(() => { if (!prevRecordingRef.current && tones) beep(tones.error); }, 1600);
      }
    };
    // Our own src swaps settle quickly; clear the flag so a later real pause is
    // not mistaken for one of ours.
    const onPlaying = () => { internalRef.current = false; };
    a.addEventListener('pause', onPause);
    a.addEventListener('playing', onPlaying);
    return () => {
      a.removeEventListener('pause', onPause);
      a.removeEventListener('playing', onPlaying);
    };
  }, [autoSpeak, recording, onVoiceToggle, stopAll, tones, beep]);

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
      <Box sx={{
        px: 1.5, py: 0.6, borderBottom: '1px solid #222', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 1, minWidth: 0
      }}>
        <Box sx={{ color: '#00aa55', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0 }}>
          MODO CONVERSACIÓN
        </Box>
        {title && (
          <Box sx={{ color: '#777', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            {title}
          </Box>
        )}
        {speechSupported() && (
          <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto', flexShrink: 0, alignItems: 'center' }}>
            {/* A play triangle and a worded switch: two speaker glyphs side by
                side were impossible to tell apart. */}
            <IconButton
              size="small"
              onClick={speakLast}
              sx={{ padding: '3px', color: speaking ? '#00ff00' : '#999', '&:hover': { color: '#00ff00' } }}
              title={speaking ? 'Detener lectura' : 'Escuchar la última respuesta'}
            >
              {speaking ? <StopIcon sx={{ fontSize: 17 }} /> : <PlayArrowIcon sx={{ fontSize: 17 }} />}
            </IconButton>
            {autoSpeak && (
              <Box
                onClick={() => keepAlive()}
                sx={{
                  fontSize: '9px', maxWidth: 128, lineHeight: 1.15, cursor: 'pointer',
                  color: handsFree ? '#00aa55' : '#ffa726'
                }}
              >
                {handsFree
                  ? `manos libres: activo${micHeld ? ' · mic' : ' · SIN MIC'}${mediaKeys ? ' · botón ok' : ''}`
                  : 'manos libres inactivo — tócame'}
              </Box>
            )}
            <Box
              onClick={toggleAutoSpeak}
              title={autoSpeak ? 'Lectura automática activada' : 'Lectura automática desactivada'}
              sx={{
                display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer',
                px: 0.6, py: '2px', borderRadius: 1, userSelect: 'none',
                border: `1px solid ${autoSpeak ? '#00aa55' : '#3a3a3a'}`,
                color: autoSpeak ? '#00ff00' : '#666',
                backgroundColor: autoSpeak ? 'rgba(0,170,85,0.12)' : 'transparent',
                '&:hover': { borderColor: '#00aa55' }
              }}
            >
              <VolumeUpIcon sx={{ fontSize: 13 }} />
              <Box component="span" sx={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em' }}>AUTO</Box>
            </Box>
          </Box>
        )}
      </Box>
      <Box ref={scrollRef} onScroll={onScroll} sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1, ...darkScroll }}>
        {error && <Box sx={{ color: '#ffa726', fontSize: '12px', p: 2, textAlign: 'center' }}>{error}</Box>}
        {!error && events.length === 0 && (
          <Box sx={{ color: '#666', fontSize: '12px', p: 2, textAlign: 'center' }}>Esperando actividad de Claude…</Box>
        )}
        {messageNodes}
      </Box>

      {speechError && (
        <Box sx={{ flexShrink: 0, px: 1.5, py: 0.5, backgroundColor: 'rgba(255,167,38,0.12)', color: '#ffa726', fontSize: '11px' }}>
          {speechError}. Revisa en Ajustes de Android → Texto a voz que haya una voz instalada.
        </Box>
      )}

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

      <audio ref={audioRef} preload="auto" playsInline style={{ display: 'none' }} />

      {/* The prompt goes into the same tmux session, as if typed */}
      <Composer
        terminalId={terminalId}
        waiting={waiting}
        isActive={isActive}
        recording={recording}
        onVoiceToggle={onVoiceToggle}
        onSent={() => { stickRef.current = true; }}
      />
    </Box>
  );
}
