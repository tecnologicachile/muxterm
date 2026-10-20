// File paths Claude mentions ("Armé el PDF: /tmp/…/Factura 1344.pdf") are
// clickable in the terminal and in the conversation view: a PDF, an image or
// a text file opens in a new tab, anything else downloads. The file is read
// on the server (GET /api/localfs/download) with the user's session.

const token = () => { try { return localStorage.getItem('token') || ''; } catch (e) { return ''; } };

// A path starts with / or ~/ after a space, a quote or a bracket, and runs
// through segments that may hold single spaces between words. Where it ends
// is not knowable from the text ("Chile.pdf. Tiene 4 páginas" could be one
// name), so every place that looks like the end of a file name is a
// candidate and the server says which one exists.
const SEG = '[^\\s/"\'`<>|│]+(?: [^\\s/"\'`<>|│]+)*';
const PATH_RE = new RegExp(`(^|[\\s"'\`(\\[])(~?\\/(?:${SEG}\\/)*${SEG})`, 'g');
const END_RE = /\.[A-Za-z0-9]{1,6}(?=$|[\s.,;:!?)\]'"`])/g;

// [{ start, ends: [absolute end offsets, longest first] }]
export function pathCandidates(text) {
  const out = [];
  if (!text || text.indexOf('/') < 0) return out;
  PATH_RE.lastIndex = 0;
  let m;
  while ((m = PATH_RE.exec(text)) !== null) {
    const body = m[2];
    const start = m.index + m[1].length;
    const ends = [];
    END_RE.lastIndex = 0;
    let e;
    while ((e = END_RE.exec(body)) !== null) {
      const end = e.index + e[0].length;
      // The name after the last slash before this point must not be empty.
      if (body.lastIndexOf('/', end - 1) < end - e[0].length) ends.push(start + end);
    }
    if (ends.length) out.push({ start, ends: ends.reverse().slice(0, 8) });
  }
  return out;
}

// Which paths exist, asked in batches and remembered for a while: the
// terminal asks again on every mouse move over a row.
const known = new Map(); // path -> { ok, at }
const TTL_MS = 20000;
let batch = null;

export function existingPaths(paths) {
  const now = Date.now();
  const fresh = new Set();
  const ask = [];
  for (const p of paths) {
    const k = known.get(p);
    if (k && now - k.at < TTL_MS) { if (k.ok) fresh.add(p); }
    else ask.push(p);
  }
  if (!ask.length) return Promise.resolve(fresh);
  if (!batch) {
    batch = { paths: new Set(), waiters: [] };
    setTimeout(() => {
      const b = batch; batch = null;
      const list = [...b.paths];
      fetch('/api/localfs/exists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: list })
      })
        .then(r => r.json())
        .then(d => {
          const ok = new Set((d && d.existing) || []);
          const at = Date.now();
          for (const p of list) known.set(p, { ok: ok.has(p), at });
        })
        .catch(() => {})
        .finally(() => b.waiters.forEach(w => w()));
    }, 40);
  }
  ask.forEach(p => batch.paths.add(p));
  return new Promise(resolve => {
    batch.waiters.push(() => {
      for (const p of ask) if ((known.get(p) || {}).ok) fresh.add(p);
      resolve(fresh);
    });
  });
}

// For each candidate, the longest reading that exists: [{ start, end, path }].
export async function resolvePaths(text) {
  const cands = pathCandidates(text);
  if (!cands.length) return [];
  const all = cands.flatMap(c => c.ends.map(e => text.slice(c.start, e)));
  const ok = await existingPaths(all);
  const out = [];
  for (const c of cands) {
    const end = c.ends.find(e => ok.has(text.slice(c.start, e)));
    if (end) out.push({ start: c.start, end, path: text.slice(c.start, end) });
  }
  return out;
}

// Paths Claude Code wrapped itself. It breaks long lines on its own, at a
// space or mid-word, and indents the rest on the next row, so the terminal
// never sees one line: "…/scratchpa" then "     d/mercado/build.py". Rows
// next to row y are joined both ways (with the space a word break ate, and
// without), and the server keeps whichever reading is a file.
// rowAt(i) is row i's text, right-trimmed. Resolves to
// [{ path, start: { row, col }, end: { row, col } }] spanning several rows.
export async function wrappedPaths(rowAt, y, lastRow) {
  const windows = [[y - 1, y], [y, y + 1], [y - 2, y - 1, y], [y - 1, y, y + 1], [y, y + 1, y + 2]]
    .filter(w => w[0] >= 0 && w[w.length - 1] <= lastRow);
  const cands = [];
  for (const w of windows) {
    const rows = w.map(rowAt);
    // Every row after the first continues the one before: it is indented,
    // and the one before has text.
    if (rows.some((r, i) => i > 0 && (!/^\s+\S/.test(r) || !rows[i - 1].trim()))) continue;
    if (rows[0].indexOf('/') < 0 && rows.slice(1).every(r => r.indexOf('/') < 0)) continue;
    for (let mask = 0; mask < (1 << (rows.length - 1)); mask++) {
      let text = '';
      const pos = [];
      rows.forEach((r, i) => {
        let s = i < rows.length - 1 ? r.replace(/\s+$/, '') : r;
        let off = 0;
        if (i > 0) {
          off = r.match(/^\s*/)[0].length;
          s = s.slice(off);
          if (mask & (1 << (i - 1))) { text += ' '; pos.push(null); }
        }
        for (let c = 0; c < s.length; c++) { text += s[c]; pos.push({ row: w[i], col: off + c }); }
      });
      for (const c of pathCandidates(text)) {
        for (const e of c.ends) {
          const start = pos[c.start], end = pos[e - 1];
          if (!start || !end || start.row === end.row) continue;
          if (y < start.row || y > end.row) continue;
          cands.push({ path: text.slice(c.start, e), start, end });
        }
      }
    }
  }
  if (!cands.length) return [];
  const ok = await existingPaths([...new Set(cands.map(c => c.path))]);
  // The longest file starting at each place.
  const best = new Map();
  for (const c of cands) {
    if (!ok.has(c.path)) continue;
    const k = `${c.start.row}:${c.start.col}`;
    if (!best.has(k) || best.get(k).path.length < c.path.length) best.set(k, c);
  }
  return [...best.values()];
}

// Shown in the browser tab: PDFs and images as themselves, text as text.
// HTML and SVG download instead: opened from a blob they would run inside
// MuxTerm's own origin.
const VIEW_AS_IS = /\.(pdf|png|jpe?g|gif|webp|bmp)$/i;
const VIEW_AS_TEXT = /\.(txt|md|log|csv|tsv|json|ya?ml|xml|ini|conf|env|sh|js|jsx|ts|tsx|py|php|sql|css)$/i;

function note(text) {
  try {
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, {
      position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: 99999,
      background: '#3a1f1f', color: '#ffb4b4', border: '1px solid #7a3a3a', borderRadius: '6px',
      padding: '8px 14px', font: '13px system-ui, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.5)'
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  } catch (e) { /* nowhere to show it */ }
}

export async function openPath(p) {
  const asIs = VIEW_AS_IS.test(p), asText = VIEW_AS_TEXT.test(p);
  // Opened now, inside the click, or the popup blocker eats it.
  const win = (asIs || asText) ? window.open('', '_blank') : null;
  try {
    const r = await fetch(`/api/localfs/download?path=${encodeURIComponent(p)}`, {
      headers: { Authorization: `Bearer ${token()}` }
    });
    if (!r.ok) throw new Error(r.status === 404 ? 'El archivo ya no existe' : 'No se pudo abrir el archivo');
    let blob = await r.blob();
    if (asText) blob = new Blob([blob], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    if (win) {
      win.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = p.split('/').pop();
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (e) {
    if (win) win.close();
    note(e.message || 'No se pudo abrir el archivo');
  }
}
