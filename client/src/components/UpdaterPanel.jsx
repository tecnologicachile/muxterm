import React, { useEffect, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';

/**
 * Updates, as the server sees them (docs/design/actualizaciones.md).
 *
 * A packaged install shows the running version, the channel, the last check
 * and what is available, with "check now", "update now" and, when an update
 * is scheduled, "postpone an hour". A git checkout says so and leaves the
 * work to update.sh. Live changes arrive over the socket.
 */
const auth = (token) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
const when = (ts) => ts ? new Date(ts).toLocaleString() : '—';

export default function UpdaterPanel({ getToken, isAdmin, socket }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    try {
      const r = await fetch('/api/updater/status', { headers: auth(getToken()) });
      const d = await r.json();
      if (d.status === 'ok') setSt(d);
    } catch (e) {}
  };
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    const onAvail = (d) => { setNote(`Versión ${d.version} disponible${d.scheduledAt ? `; se instalará a las ${new Date(d.scheduledAt).toLocaleTimeString()}` : ''}.`); load(); };
    const onProg = (d) => { setNote(`${d.version}: ${({ downloading: 'descargando', verifying: 'verificando', unpacking: 'desempaquetando', restarting: 'reiniciando' })[d.state] || d.state}…`); load(); };
    const onDone = (d) => { setNote(`Actualizado a ${d.version}.`); load(); };
    socket.on('update-available', onAvail); socket.on('update-progress', onProg); socket.on('update-applied', onDone); socket.on('connect', refresh);
    return () => { socket.off('update-available', onAvail); socket.off('update-progress', onProg); socket.off('update-applied', onDone); socket.off('connect', refresh); };
  }, [socket]);   // eslint-disable-line react-hooks/exhaustive-deps

  const call = async (path, body) => {
    setBusy(path); setNote('');
    try {
      const r = await fetch(`/api/updater/${path}`, { method: 'POST', headers: auth(getToken()), body: JSON.stringify(body || {}) });
      const d = await r.json();
      if (d.status !== 'ok') setNote(d.message || 'No se pudo');
      else if (path === 'check') setNote(d.apply ? `Hay una versión nueva: ${d.version}.` : `Sin novedades (${d.reason}).`);
      else if (path === 'apply') setNote(d.applied ? `Instalando ${d.version}; el servicio se reiniciará.` : `No se aplicó: ${d.reason}.`);
      else if (path === 'postpone') setNote(`Pospuesto hasta las ${new Date(d.until).toLocaleTimeString()}.`);
      else if (path === 'channel') setNote(`Canal: ${d.channel}.`);
      await load();
    } catch (e) { setNote('Error de red'); }
    setBusy('');
  };

  if (!st) return null;
  const row = { display: 'flex', justifyContent: 'space-between', gap: 1, fontSize: '12px', color: '#aaa' };
  const val = { color: '#ddd' };
  return (
    <Box sx={{ mb: 2, p: 1.5, border: '1px solid #333', borderRadius: 1 }}>
      <Typography sx={{ fontSize: '13px', color: '#ccc', mb: 0.5 }}>📦 Versión y actualizaciones</Typography>
      <Box sx={row}><span>Versión en uso</span><span style={val}>{st.current}</span></Box>
      {st.mode === 'git' ? (
        <Typography sx={{ fontSize: '11px', color: '#666', mt: 0.5 }}>
          Instalación desde el código (checkout git): se actualiza con <code>muxterm update</code> o <code>update.sh</code>. El actualizador de paquetes firmados no aplica aquí.
        </Typography>
      ) : (
        <>
          <Box sx={row}><span>Canal</span>
            <span>
              {['stable', 'beta'].map(c => (
                <Box key={c} component="span" onClick={() => isAdmin && c !== st.channel && call('channel', { channel: c })}
                  sx={{ ml: 0.75, px: 0.75, borderRadius: 1, cursor: isAdmin ? 'pointer' : 'default', border: '1px solid', fontSize: '11px',
                    borderColor: st.channel === c ? '#ffa726' : '#444', color: st.channel === c ? '#ffa726' : '#888' }}>{c}</Box>
              ))}
            </span>
          </Box>
          <Box sx={row}><span>Última comprobación</span><span style={val}>{when(st.lastCheck)}</span></Box>
          <Box sx={row}><span>Disponible</span><span style={{ ...val, color: st.available ? '#ffa726' : '#ddd' }}>{st.available || (st.reason ? `no (${st.reason})` : 'no')}</span></Box>
          {st.state && st.state !== 'idle' && <Box sx={row}><span>Estado</span><span style={{ ...val, color: '#ffa726' }}>{st.state}{st.scheduledAt ? ` · ${new Date(st.scheduledAt).toLocaleTimeString()}` : ''}</span></Box>}
          {st.lastRollback && <Box sx={row}><span>Última vuelta atrás</span><span style={{ ...val, color: '#d9534f' }}>{st.lastRollback.version} ({st.lastRollback.reason})</span></Box>}
          {isAdmin && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Button size="small" variant="outlined" color="inherit" disabled={!!busy} onClick={() => call('check')}>Buscar ahora</Button>
              <Button size="small" variant="contained" color="success" disabled={!!busy || !st.available} onClick={() => call('apply')}>Actualizar ahora</Button>
              {st.state === 'scheduled' && <Button size="small" variant="outlined" color="warning" disabled={!!busy} onClick={() => call('postpone')}>Posponer 1 h</Button>}
            </Box>
          )}
        </>
      )}
      {note && <Typography sx={{ fontSize: '11px', color: '#9fb8d0', mt: 0.75 }}>{note}</Typography>}
    </Box>
  );
}
