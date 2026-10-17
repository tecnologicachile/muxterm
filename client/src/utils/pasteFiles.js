// Files pasted or dropped onto a terminal or the chat composer are uploaded
// to the server (server/paste-files.js), which answers with the path it saved
// them at. That path, typed into the prompt, is how Claude Code takes an
// image or a file: the browser's clipboard never reaches Claude Code itself.

const token = () => { try { return localStorage.getItem('token') || ''; } catch (e) { return ''; } };

// The files a paste or drop event carries, or [] when it is only text.
export function eventFiles(dataTransfer) {
  if (!dataTransfer) return [];
  const files = Array.from(dataTransfer.files || []);
  if (files.length) return files;
  return Array.from(dataTransfer.items || [])
    .filter(it => it.kind === 'file')
    .map(it => it.getAsFile())
    .filter(Boolean);
}

export const carriesFiles = (dataTransfer) =>
  !!dataTransfer && Array.from(dataTransfer.types || []).includes('Files');

// Uploads every file and resolves to "path1 path2 " ready to type, or
// rejects with a message to show.
export async function uploadFiles(terminalId, files) {
  const out = [];
  for (const f of files) {
    const r = await fetch(`/api/paste-file?terminalId=${encodeURIComponent(terminalId)}&name=${encodeURIComponent(f.name || '')}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': f.type || 'application/octet-stream' },
      body: f
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.status !== 'ok') throw new Error(d.message || 'No se pudo subir el archivo');
    out.push(d.path);
  }
  return out.join(' ') + ' ';
}

// What Ctrl+V would paste, read straight from the clipboard: in the terminal
// xterm turns Ctrl+V into ^V and the browser never fires a paste event.
// Resolves to the images in it as files, [] when it holds only text, or null
// when the browser would not let us read it.
export async function clipboardFiles(nav) {
  try {
    if (!nav || !nav.clipboard || !nav.clipboard.read) return null;
    const items = await nav.clipboard.read();
    const files = [];
    for (const item of items) {
      const type = item.types.find(t => t.startsWith('image/'));
      if (!type) continue;
      const blob = await item.getType(type);
      files.push(new File([blob], `captura.${type.split('/')[1].replace('jpeg', 'jpg')}`, { type }));
    }
    return files;
  } catch (e) {
    return null;
  }
}
