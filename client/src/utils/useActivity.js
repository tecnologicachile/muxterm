import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * The activity log of this user's Claude sessions, kept in step with the
 * server: a snapshot on connect, then the activity:* events it pushes.
 *
 * Exposes the raw events plus the two derived views the UI needs: what is
 * waiting on you, and which sessions have something you have not looked at.
 * See docs/design/bandeja-actividad.md.
 */
const LIMIT = 300;
const OPEN_KINDS = new Set(['waiting', 'permission']);
const NOTICE_KINDS = new Set(['done', 'error', 'interrupted']);

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export const isOpen = (e) => OPEN_KINDS.has(e.kind) && !e.resolved_at;
export const isUnseen = (e) => !e.seen_at && (NOTICE_KINDS.has(e.kind) || isOpen(e));

export default function useActivity(socket) {
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // The window of events we hold is finite; open waits older than it still
  // matter, so the pending endpoint tops them up.
  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([
        fetch(`/api/activity?limit=${LIMIT}`, { headers: auth() }).then(r => r.json()),
        fetch('/api/activity/pending', { headers: auth() }).then(r => r.json())
      ]);
      const byId = new Map();
      for (const e of [...(p.events || []), ...(a.events || [])]) byId.set(e.id, e);
      setEvents([...byId.values()].sort((x, y) => (y.ts < x.ts ? -1 : y.ts > x.ts ? 1 : y.id - x.id)));
      setLoaded(true);
    } catch (e) { /* next connect */ }
  }, []);

  useEffect(() => {
    if (!socket) return;
    load();
    const onNew = ({ event }) => {
      if (!event) return;
      setEvents(prev => prev.some(e => e.id === event.id) ? prev : [event, ...prev].slice(0, LIMIT * 2));
    };
    const onUpdate = ({ id, resolved_at, seen_at }) => {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...(resolved_at ? { resolved_at } : {}), ...(seen_at ? { seen_at } : {}) } : e));
    };
    const onSeen = ({ ids, terminalId, until, all, seen_at }) => {
      setEvents(prev => prev.map(e => {
        if (e.seen_at) return e;
        const hit = all || (ids && ids.includes(e.id)) || (terminalId && e.terminal_id === terminalId && (!until || e.ts <= until));
        return hit ? { ...e, seen_at } : e;
      }));
    };
    socket.on('connect', load);
    socket.on('activity:new', onNew);
    socket.on('activity:update', onUpdate);
    socket.on('activity:seen', onSeen);
    return () => {
      socket.off('connect', load);
      socket.off('activity:new', onNew);
      socket.off('activity:update', onUpdate);
      socket.off('activity:seen', onSeen);
    };
  }, [socket, load]);

  // Optimistic: the server echoes activity:seen, but the dot should go the
  // moment you click.
  const markSeen = useCallback((sel) => {
    const now = new Date().toISOString();
    setEvents(prev => prev.map(e => {
      if (e.seen_at) return e;
      const hit = (sel.ids && sel.ids.includes(e.id)) || (sel.terminalId && e.terminal_id === sel.terminalId);
      return hit ? { ...e, seen_at: now } : e;
    }));
    fetch('/api/activity/seen', { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(sel) }).catch(() => {});
  }, []);

  const markAllSeen = useCallback(() => {
    const now = new Date().toISOString();
    setEvents(prev => prev.map(e => e.seen_at ? e : { ...e, seen_at: now }));
    fetch('/api/activity/seen-all', { method: 'POST', headers: auth() }).catch(() => {});
  }, []);

  const pending = useMemo(() => events.filter(isOpen), [events]);
  // terminalId -> most recent unseen notice, in the shape the tab dots and
  // the page title already consume.
  const unseen = useMemo(() => {
    const out = {};
    for (const e of events) {
      if (!isUnseen(e)) continue;
      if (!out[e.terminal_id]) out[e.terminal_id] = { text: e.summary, waiting: isOpen(e), at: Date.parse(e.ts) || Date.now(), kind: e.kind, id: e.id };
    }
    return out;
  }, [events]);
  const unseenCount = useMemo(() => events.filter(isUnseen).length, [events]);

  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);

  return { events, pending, unseen, unseenCount, loaded, markSeen, markAllSeen, reload: load, eventsRef };
}
