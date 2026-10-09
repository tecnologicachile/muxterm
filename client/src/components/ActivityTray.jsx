import React, { useMemo, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { isOpen, isUnseen } from '../utils/useActivity';

/**
 * What happened across your Claude sessions while you were elsewhere.
 *
 * Two blocks: what is waiting on you (always on top), then the chronology by
 * day. Clicking an entry takes you to the pane and marks it seen.
 */

const KIND_LABEL = {
  waiting: 'Te pregunta',
  permission: 'Pide permiso',
  done: 'Terminó',
  error: 'Falló un comando',
  interrupted: 'Interrumpido',
  prompt: 'Le pediste'
};
const KIND_COLOR = {
  waiting: '#ffa726', permission: '#ffa726', done: '#2e8b45', error: '#d9534f', interrupted: '#888', prompt: '#555'
};

// A question or permission already answered reads as past tense in the log.
const label = (e) => {
  if (e.resolved_at && e.kind === 'waiting') return 'Preguntó';
  if (e.resolved_at && e.kind === 'permission') return 'Pidió permiso';
  return KIND_LABEL[e.kind] || e.kind;
};
const two = (n) => String(n).padStart(2, '0');
const hhmm = (ts) => { const d = new Date(ts); return `${two(d.getHours())}:${two(d.getMinutes())}`; };
const ago = (ts) => {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(ts)) / 1000));
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
};
const dayLabel = (ts) => {
  const d = new Date(ts), now = new Date();
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, now)) return 'Hoy';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Ayer';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
};

const TOUCH = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none)').matches;

function Entry({ e, name, where, onGo, onSeen, highlight, compact }) {
  const unseen = isUnseen(e);
  return (
    <Box
      onClick={() => onGo(e)}
      title={e.summary}
      sx={{
        display: 'flex', gap: 1, px: 1.5, py: 1, cursor: 'pointer', minHeight: 44, position: 'relative',
        borderLeft: `3px solid ${KIND_COLOR[e.kind] || '#555'}`,
        backgroundColor: highlight ? 'rgba(255,167,38,0.08)' : 'transparent',
        '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
        '&:hover .seen-btn': { opacity: 1 }
      }}
    >
      {unseen && (
        <Box
          className="seen-btn"
          title="Marcar visto"
          onClick={(ev) => { ev.stopPropagation(); onSeen(e); }}
          sx={{
            position: 'absolute', right: 8, bottom: 6, width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#aaa',
            backgroundColor: 'rgba(40,40,40,0.95)', border: '1px solid #444', opacity: TOUCH ? 0.8 : 0, transition: 'opacity 0.1s',
            '&:hover': { color: '#fff', borderColor: '#888' }
          }}
        >✓</Box>
      )}
      <Box sx={{ width: 8, pt: '7px', flexShrink: 0 }}>
        {unseen && <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#ffa726' }} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
          <Typography sx={{ fontSize: 12, color: unseen ? '#eee' : '#aaa', fontWeight: unseen ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {!compact && name}
            {!compact && where && <Box component="span" sx={{ color: '#666', fontWeight: 400, ml: 0.5, fontSize: 11 }}>· {where}</Box>}
            <Box component="span" sx={{ color: KIND_COLOR[e.kind] || '#777', fontWeight: compact && unseen ? 600 : 400, ml: compact ? 0 : 0.75, fontSize: compact ? 12 : 11 }}>{label(e)}</Box>
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#666', flexShrink: 0 }} title={new Date(e.ts).toLocaleString()}>
            {highlight ? ago(e.ts) : hhmm(e.ts)}
          </Typography>
        </Box>
        <Typography sx={{
          fontSize: 12, color: e.kind === 'prompt' ? '#777' : '#ccc', mt: 0.25,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.35
        }}>
          {e.summary}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * One session's recent events. Unseen ones are listed; a run of unseen
 * "done" shows the latest in full and folds the rest, since the last reply
 * usually carries the real state; seen ones hide behind "anteriores".
 */
function SessionCard({ id, items, name, where, onGo, onSeen, onGoSession }) {
  const [showSeen, setShowSeen] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const unseen = items.filter(isUnseen);
  const seen = items.filter(e => !isUnseen(e));
  const latest = items[0];
  // Fold a run of unseen "done": the first (newest) stays, the rest collapse.
  let head = unseen, folded = [];
  if (unseen.length > 2 && unseen.every(e => e.kind === 'done')) { head = unseen.slice(0, 1); folded = unseen.slice(1); }
  return (
    <Box sx={{ borderBottom: '1px solid #262626' }}>
      <Box
        onClick={() => onGoSession(id)}
        sx={{ display: 'flex', alignItems: 'baseline', gap: 1, px: 1.5, pt: 1, pb: 0.5, cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' } }}
        title="Ir al panel y marcar la sesión como vista"
      >
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: unseen.length ? '#eee' : '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {name}{where ? <Box component="span" sx={{ color: '#666', fontWeight: 400, ml: 0.5, fontSize: 11 }}>· {where}</Box> : null}
        </Typography>
        {unseen.length > 0 && <Box sx={{ fontSize: 10, color: '#000', backgroundColor: '#ffa726', borderRadius: 8, px: '6px', lineHeight: '16px', fontWeight: 700, flexShrink: 0 }}>{unseen.length}</Box>}
        <Typography sx={{ fontSize: 11, color: '#666', flexShrink: 0 }} title={new Date(latest.ts).toLocaleString()}>{ago(latest.ts)}</Typography>
      </Box>
      {head.map(e => <Entry key={e.id} e={e} compact onGo={onGo} onSeen={onSeen} />)}
      {folded.length > 0 && (
        <Box>
          <Box onClick={() => setShowRun(v => !v)} sx={{ fontSize: 11, color: '#8ab4d8', px: 1.5, py: 0.5, cursor: 'pointer', '&:hover': { color: '#cde' } }}>
            {showRun ? '▾' : '▸'} {folded.length} {folded.length === 1 ? 'turno anterior' : 'turnos anteriores'} sin ver
          </Box>
          {showRun && folded.map(e => <Entry key={e.id} e={e} compact onGo={onGo} onSeen={onSeen} />)}
        </Box>
      )}
      {seen.length > 0 && (
        <Box>
          <Box onClick={() => setShowSeen(v => !v)} sx={{ fontSize: 11, color: '#666', px: 1.5, py: 0.5, cursor: 'pointer', '&:hover': { color: '#aaa' } }}>
            {showSeen ? '▾' : '▸'} {seen.length} {seen.length === 1 ? 'anterior' : 'anteriores'}
          </Box>
          {showSeen && seen.slice(0, 20).map(e => <Entry key={e.id} e={e} compact onGo={onGo} onSeen={onSeen} />)}
        </Box>
      )}
    </Box>
  );
}

export default function ActivityTray({ open, onClose, events, pending, unseenCount, nameOf, whereOf, onGoTo, markSeen, markAllSeen, isMobile }) {
  const [onlyPending, setOnlyPending] = useState(false);
  // "Por sesión" (one card per session) or "por hora" (the flat chronology).
  const [view, setView] = useState(() => { try { return localStorage.getItem('muxterm-tray-view') || 'session'; } catch (e) { return 'session'; } });
  const switchView = (v) => { setView(v); try { localStorage.setItem('muxterm-tray-view', v); } catch (e) {} };
  // One chip per session that has events, newest activity first.
  const [session, setSession] = useState(null);
  const sessions = useMemo(() => {
    const seen = new Map();
    for (const e of events) {
      const s = seen.get(e.terminal_id) || { id: e.terminal_id, unseen: 0 };
      if (isUnseen(e)) s.unseen++;
      seen.set(e.terminal_id, s);
    }
    return [...seen.values()];
  }, [events]);
  const sessionOk = (e) => !session || e.terminal_id === session;
  const shownPending = useMemo(() => pending.filter(sessionOk), [pending, session]);

  const groups = useMemo(() => {
    const list = events.filter(e => !isOpen(e) && sessionOk(e) && (!onlyPending || isUnseen(e)));
    const out = [];
    for (const e of list) {
      const label = dayLabel(e.ts);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(e);
    }
    return out;
  }, [events, onlyPending, session]);
  const cards = useMemo(() => {
    const list = events.filter(e => !isOpen(e) && sessionOk(e) && e.kind !== 'prompt');
    const by = new Map();
    for (const e of list) { if (!by.has(e.terminal_id)) by.set(e.terminal_id, []); by.get(e.terminal_id).push(e); }
    // Sessions with something unseen first, then by most recent event.
    return [...by.entries()].map(([id, items]) => ({ id, items, unseen: items.filter(isUnseen).length }))
      .filter(c => !onlyPending || c.unseen > 0)
      .sort((a, b) => (b.unseen > 0) - (a.unseen > 0) || (b.items[0].ts < a.items[0].ts ? -1 : 1));
  }, [events, onlyPending, session]);

  if (!open) return null;

  // Jumping to the pane is what you opened the tray for: it closes behind you.
  const go = (e) => {
    if (!e.seen_at) markSeen({ ids: [e.id] });
    onGoTo(e.terminal_id);
    onClose();
  };
  const seenOne = (e) => markSeen({ ids: [e.id] });
  const goSession = (terminalId) => { markSeen({ terminalId }); onGoTo(terminalId); onClose(); };

  return (
    <Box sx={{
      position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 30,
      width: isMobile ? '100%' : 380, maxWidth: '100%',
      backgroundColor: 'rgba(16,16,16,0.98)', borderLeft: '1px solid #333',
      display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 24px rgba(0,0,0,0.5)'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid #2a2a2a', flexWrap: 'wrap', rowGap: 0.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#ddd', flex: 1 }}>
          Actividad {unseenCount ? <Box component="span" sx={{ color: '#ffa726' }}>· {unseenCount} sin ver</Box> : null}
        </Typography>
        <Box sx={{ display: 'flex', border: '1px solid #444', borderRadius: 1, overflow: 'hidden', fontSize: 11 }}>
          {[['session', 'por sesión'], ['time', 'por hora']].map(([v, t]) => (
            <Box key={v} onClick={() => switchView(v)} sx={{ px: 1, py: 0.25, cursor: 'pointer', color: view === v ? '#ddd' : '#777', backgroundColor: view === v ? 'rgba(255,255,255,0.1)' : 'transparent' }}>{t}</Box>
          ))}
        </Box>
        <Box onClick={() => setOnlyPending(v => !v)} sx={{
          fontSize: 11, px: 1, py: 0.25, borderRadius: 1, cursor: 'pointer', border: '1px solid',
          borderColor: onlyPending ? '#ffa726' : '#444', color: onlyPending ? '#ffa726' : '#888'
        }}>solo sin ver</Box>
        {unseenCount > 0 && (
          <Box onClick={markAllSeen} sx={{ fontSize: 11, color: '#888', cursor: 'pointer', px: 0.5, '&:hover': { color: '#ddd' } }}>marcar todo visto</Box>
        )}
        <IconButton size="small" onClick={onClose} sx={{ color: '#888' }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
      </Box>

      {sessions.length > 1 && (
        <Box sx={{
          display: 'flex', gap: 0.5, px: 1.5, py: 0.75, overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid #2a2a2a',
          '&::-webkit-scrollbar': { height: 3 }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#333' }
        }}>
          {[{ id: null, name: 'Todas', unseen: unseenCount }, ...sessions.map(s => ({ ...s, name: nameOf(s.id) }))].map(s => {
            const on = session === s.id;
            return (
              <Box key={s.id || 'all'} onClick={() => setSession(on && s.id ? null : s.id)} sx={{
                fontSize: 11, px: 1, py: 0.25, borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                border: '1px solid', borderColor: on ? '#ffa726' : '#3a3a3a', color: on ? '#ffa726' : '#999',
                backgroundColor: on ? 'rgba(255,167,38,0.08)' : 'transparent', minHeight: isMobile ? 32 : 'auto', display: 'flex', alignItems: 'center'
              }}>
                {s.name}{s.unseen ? <Box component="span" sx={{ ml: 0.5, color: '#ffa726' }}>{s.unseen}</Box> : null}
              </Box>
            );
          })}
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#333' } }}>
        {shownPending.length > 0 && (
          <Box sx={{ borderBottom: '1px solid #2a2a2a', pb: 0.5 }}>
            <Typography sx={{ fontSize: 10, color: '#ffa726', letterSpacing: 1, textTransform: 'uppercase', px: 1.5, pt: 1, pb: 0.5 }}>
              Esperando por ti · {shownPending.length}
            </Typography>
            {shownPending.map(e => <Entry key={e.id} e={e} name={nameOf(e.terminal_id)} where={whereOf && whereOf(e.terminal_id)} onGo={go} onSeen={seenOne} highlight />)}
          </Box>
        )}
        {(view === 'session' ? cards.length === 0 : groups.length === 0) && (
          <Typography sx={{ fontSize: 12, color: '#666', px: 1.5, py: 3, textAlign: 'center' }}>
            {onlyPending ? 'Nada sin ver.' : session ? 'Sin actividad de esta sesión.' : 'Sin actividad todavía.'}
          </Typography>
        )}
        {view === 'session' && cards.map(c => (
          <SessionCard key={c.id} id={c.id} items={c.items} name={nameOf(c.id)} where={whereOf && whereOf(c.id)} onGo={go} onSeen={seenOne} onGoSession={goSession} />
        ))}
        {view === 'time' && groups.map(g => (
          <Box key={g.label}>
            <Typography sx={{ fontSize: 10, color: '#666', letterSpacing: 1, textTransform: 'uppercase', px: 1.5, pt: 1.25, pb: 0.5 }}>{g.label}</Typography>
            {g.items.map(e => <Entry key={e.id} e={e} name={nameOf(e.terminal_id)} where={whereOf && whereOf(e.terminal_id)} onGo={go} onSeen={seenOne} />)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
