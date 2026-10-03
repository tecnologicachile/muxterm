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

function Entry({ e, name, onGo, highlight }) {
  const unseen = isUnseen(e);
  return (
    <Box
      onClick={() => onGo(e)}
      sx={{
        display: 'flex', gap: 1, px: 1.5, py: 1, cursor: 'pointer', minHeight: 44,
        borderLeft: `3px solid ${KIND_COLOR[e.kind] || '#555'}`,
        backgroundColor: highlight ? 'rgba(255,167,38,0.08)' : 'transparent',
        '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' }
      }}
    >
      <Box sx={{ width: 8, pt: '7px', flexShrink: 0 }}>
        {unseen && <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#ffa726' }} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
          <Typography sx={{ fontSize: 12, color: unseen ? '#eee' : '#aaa', fontWeight: unseen ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
            <Box component="span" sx={{ color: KIND_COLOR[e.kind] || '#777', fontWeight: 400, ml: 0.75, fontSize: 11 }}>{KIND_LABEL[e.kind] || e.kind}</Box>
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

export default function ActivityTray({ open, onClose, events, pending, unseenCount, nameOf, onGoTo, markSeen, markAllSeen, isMobile }) {
  const [onlyPending, setOnlyPending] = useState(false);

  const groups = useMemo(() => {
    const list = events.filter(e => !isOpen(e) && (!onlyPending || isUnseen(e)));
    const out = [];
    for (const e of list) {
      const label = dayLabel(e.ts);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(e);
    }
    return out;
  }, [events, onlyPending]);

  if (!open) return null;

  const go = (e) => {
    if (!e.seen_at) markSeen({ ids: [e.id] });
    onGoTo(e.terminal_id);
    if (isMobile) onClose();
  };

  return (
    <Box sx={{
      position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 30,
      width: isMobile ? '100%' : 380, maxWidth: '100%',
      backgroundColor: 'rgba(16,16,16,0.98)', borderLeft: '1px solid #333',
      display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 24px rgba(0,0,0,0.5)'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid #2a2a2a' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#ddd', flex: 1 }}>
          Actividad {unseenCount ? <Box component="span" sx={{ color: '#ffa726' }}>· {unseenCount} sin ver</Box> : null}
        </Typography>
        <Box onClick={() => setOnlyPending(v => !v)} sx={{
          fontSize: 11, px: 1, py: 0.25, borderRadius: 1, cursor: 'pointer', border: '1px solid',
          borderColor: onlyPending ? '#ffa726' : '#444', color: onlyPending ? '#ffa726' : '#888'
        }}>solo sin ver</Box>
        {unseenCount > 0 && (
          <Box onClick={markAllSeen} sx={{ fontSize: 11, color: '#888', cursor: 'pointer', px: 0.5, '&:hover': { color: '#ddd' } }}>marcar todo visto</Box>
        )}
        <IconButton size="small" onClick={onClose} sx={{ color: '#888' }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#333' } }}>
        {pending.length > 0 && (
          <Box sx={{ borderBottom: '1px solid #2a2a2a', pb: 0.5 }}>
            <Typography sx={{ fontSize: 10, color: '#ffa726', letterSpacing: 1, textTransform: 'uppercase', px: 1.5, pt: 1, pb: 0.5 }}>
              Esperando por ti · {pending.length}
            </Typography>
            {pending.map(e => <Entry key={e.id} e={e} name={nameOf(e.terminal_id)} onGo={go} highlight />)}
          </Box>
        )}
        {groups.length === 0 && (
          <Typography sx={{ fontSize: 12, color: '#666', px: 1.5, py: 3, textAlign: 'center' }}>
            {onlyPending ? 'Nada sin ver.' : 'Sin actividad todavía.'}
          </Typography>
        )}
        {groups.map(g => (
          <Box key={g.label}>
            <Typography sx={{ fontSize: 10, color: '#666', letterSpacing: 1, textTransform: 'uppercase', px: 1.5, pt: 1.25, pb: 0.5 }}>{g.label}</Typography>
            {g.items.map(e => <Entry key={e.id} e={e} name={nameOf(e.terminal_id)} onGo={go} />)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
