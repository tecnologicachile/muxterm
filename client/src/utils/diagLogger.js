// Diagnostic logger: buffers events client-side and flushes to server periodically
// Helps diagnose intermittent issues like STATUS_BREAKPOINT renderer crashes

const BUFFER_MAX = 300;
const FLUSH_INTERVAL_MS = 10000;
const FLUSH_SIZE = 10;
const STORAGE_KEY = 'muxterm_diag_enabled';

let buffer = [];
let flushTimer = null;
// Default OFF: users can enable in Settings if they need to report an issue
let enabled = false;
try { enabled = localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) {}

const getToken = () => {
  try { return localStorage.getItem('token') || ''; } catch (e) { return ''; }
};

const flush = async () => {
  if (!enabled || buffer.length === 0) return;
  const events = buffer.splice(0, buffer.length);
  try {
    await fetch('/api/diag/log', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ events })
    });
  } catch (e) {
    // On failure, keep at most BUFFER_MAX events
    buffer = [...events.slice(-BUFFER_MAX), ...buffer].slice(0, BUFFER_MAX);
  }
};

// Events that should be sent immediately via sendBeacon (survives renderer crash)
const URGENT = new Set(['page-load', 'drag-start', 'drag-end', 'panel-close', 'iframe-defuse', 'long-task', 'js-error', 'promise-reject', 'maximize-change']);

const sendBeaconOne = (ev) => {
  try {
    const blob = new Blob([JSON.stringify({ events: [ev] })], { type: 'application/json' });
    navigator.sendBeacon('/api/diag/log?token=' + encodeURIComponent(getToken()), blob);
  } catch (e) {}
};

export const logDiag = (kind, data) => {
  if (!enabled) return;
  const ev = { kind, data, ts: Date.now() };
  buffer.push(ev);
  if (buffer.length > BUFFER_MAX) buffer = buffer.slice(-BUFFER_MAX);
  // Critical events: send immediately via beacon so they survive crashes
  if (URGENT.has(kind)) sendBeaconOne(ev);
  if (buffer.length >= FLUSH_SIZE) flush();
};

export const startDiagLogger = () => {
  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

  // Periodic metrics snapshot every 10s
  setInterval(() => {
    try {
      const mem = performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1048576),
        total: Math.round(performance.memory.totalJSHeapSize / 1048576),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
      } : null;
      const iframeEls = document.querySelectorAll('iframe');
      const iframeSrcs = Array.from(iframeEls).map(f => {
        const m = f.src.match(/\/ttyd\/([a-f0-9-]+)/);
        return m ? m[1].slice(0, 8) : f.src.slice(0, 30);
      });
      const canvases = document.querySelectorAll('canvas').length;
      const uptime = Math.round((Date.now() - (window.__muxtermLoadTs || Date.now())) / 1000);
      logDiag('metrics', { mem, iframes: iframeEls.length, iframeSrcs, canvases, uptime });
    } catch (e) {}
  }, 10000);

  // Log before possible freeze: watch long tasks > 200ms
  try {
    if ('PerformanceObserver' in window) {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 200) {
            logDiag('long-task', { dur: Math.round(entry.duration), name: entry.name });
          }
        }
      });
      po.observe({ entryTypes: ['longtask'] });
    }
  } catch (e) {}

  // Capture unhandled errors
  window.addEventListener('error', (e) => {
    logDiag('js-error', {
      msg: String(e.message).slice(0, 500),
      file: e.filename, line: e.lineno, col: e.colno,
      stack: e.error?.stack?.slice(0, 1000)
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    logDiag('promise-reject', { reason: String(e.reason).slice(0, 500) });
  });

  // Track page load time
  window.__muxtermLoadTs = Date.now();
  logDiag('page-load', { ua: navigator.userAgent.slice(0, 200), url: location.pathname });

  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    if (buffer.length > 0 && navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify({ events: buffer })], { type: 'application/json' });
        navigator.sendBeacon('/api/diag/log?token=' + encodeURIComponent(getToken()), blob);
      } catch (e) {}
    }
  });
};

export const setDiagEnabled = (v) => {
  enabled = !!v;
  try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch (e) {}
};
export const isDiagEnabled = () => enabled;
