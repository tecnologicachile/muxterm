/**
 * Reading Claude's replies out loud, using the browser's own speech synthesis.
 *
 * No API key and no round trip: the voice is whatever the phone already has.
 * Swapping in OpenAI's TTS later only means replacing `speak` with an audio
 * element fed by the server.
 */

/** Markdown is for reading, not for listening — strip what would be noise. */
export function toSpeech(md) {
  const out = [];
  let inCode = false;
  for (const raw of String(md || '').split('\n')) {
    const line = raw.trimEnd();
    if (line.trim().startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;                                  // code read aloud is unbearable
    if (/^\s*\|.*\|\s*$/.test(line)) continue;             // tables likewise
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) continue;
    let t = line
      .replace(/^\s*#{1,6}\s+/, '')                        // heading marks
      .replace(/^\s*>\s?/, '')                             // quote marks
      .replace(/^\s*([-*+]|\d+[.)])\s+/, '')               // bullets
      .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')           // links: keep the label
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1');
    if (t.trim()) out.push(t.trim());
  }
  // Join with a period only where the line does not already end in
  // punctuation, or headings and list items run together as "Los números:.".
  return out.reduce((acc, line) => {
    if (!acc) return line;
    return /[.!?:;…]$/.test(acc) ? acc + ' ' + line : acc + '. ' + line;
  }, '').trim();
}

/**
 * Android Chrome populates the voice list asynchronously, and a speak() issued
 * before it is ready can do nothing at all — silently.
 */
function whenVoicesReady() {
  return new Promise((resolve) => {
    try {
      if ((window.speechSynthesis.getVoices() || []).length) return resolve();
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
      setTimeout(finish, 1200);          // speak with the default voice rather than hang
    } catch (e) { resolve(); }
  });
}

/** Prefer a Spanish voice when the device has one. */
function pickVoice() {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.find(v => /^es(-|_)/i.test(v.lang) && /google|natural|premium/i.test(v.name))
      || voices.find(v => /^es(-|_)/i.test(v.lang))
      || null;
  } catch (e) {
    return null;
  }
}

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Speak `text`, replacing anything already playing.
 *
 * Long utterances get cut off partway through in several browsers, so the text
 * is queued sentence by sentence; `onEnd` fires once the last chunk finishes.
 */
export function speak(text, { onEnd, onError, queue = false } = {}) {
  if (!speechSupported()) { if (onError) onError(new Error('sin soporte de voz')); return; }
  const clean = String(text || '').trim();
  if (!clean) { if (onEnd) onEnd(); return; }

  if (!queue) stopSpeaking();   // queue: let auto-play chain replies instead of cutting them

  const chunks = [];
  let buf = '';
  for (const piece of clean.split(/(?<=[.!?…])\s+/)) {
    if ((buf + ' ' + piece).trim().length > 220 && buf) { chunks.push(buf.trim()); buf = piece; }
    else buf = (buf + ' ' + piece).trim();
  }
  if (buf.trim()) chunks.push(buf.trim());

  whenVoicesReady().then(() => {
    const voice = pickVoice();
    let started = false;
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      if (voice) u.voice = voice;
      u.lang = (voice && voice.lang) || 'es-ES';
      u.rate = 1.05;
      u.onstart = () => { started = true; };
      if (i === chunks.length - 1 && onEnd) u.onend = onEnd;
      if (onError) u.onerror = (e) => { if (e && e.error !== 'interrupted') onError(e); };
      try { window.speechSynthesis.speak(u); } catch (e) { if (onError) onError(e); }
    });
    // Chrome can leave the engine paused, where speak() queues but never plays.
    try { window.speechSynthesis.resume(); } catch (e) {}
    // Nothing started after a beat means it failed quietly; say so rather than
    // leaving a button that looks broken.
    setTimeout(() => {
      if (!started && onError) onError(new Error('El navegador no reprodujo la voz'));
    }, 1800);
  });
}

export function stopSpeaking() {
  try { window.speechSynthesis.cancel(); } catch (e) {}
}

/**
 * A long, near-silent WAV to loop between replies.
 *
 * Half a minute rather than a second: Chrome does not surface media controls —
 * and therefore does not route headset buttons — for clips it considers too
 * short to be real media.
 *
 * A tab that is actively playing media does not get frozen with the screen off,
 * which is what keeps the socket alive and lets the next reply be spoken. It is
 * deliberately not digital silence: some engines discard a wholly silent track.
 */
export function silentLoopUri(seconds = 30) {
  const rate = 8000;
  const n = rate * seconds;
  const bytes = new Uint8Array(44 + n);
  const dv = new DataView(bytes.buffer);
  const put = (off, str) => { for (let i = 0; i < str.length; i++) bytes[off + i] = str.charCodeAt(i); };
  put(0, 'RIFF'); dv.setUint32(4, 36 + n, true); put(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate, true);
  dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  put(36, 'data'); dv.setUint32(40, n, true);
  // Near-silence, deliberately not digital zero: some engines discard a wholly
  // silent track. Making it audibly loud was tried to win hardware media keys
  // and did not, so there is no reason to make anyone listen to it.
  for (let i = 0; i < n; i++) bytes[44 + i] = 128 + (i % 2);
  // A blob rather than a data URI: base64 would inflate half a minute of audio
  // to something the browser has to parse on every start.
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}

/** Fetch the server-rendered mp3 for `text` as an object URL. */
export async function fetchSpeechUrl(text, token) {
  const r = await fetch('/api/voice/speak', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!r.ok) {
    let msg = `No se pudo generar la voz (${r.status})`;
    try { const d = await r.json(); if (d && d.message) msg = d.message; } catch (e) {}
    throw new Error(msg);
  }
  return URL.createObjectURL(await r.blob());
}

/**
 * A short tone as a data URI.
 *
 * With the screen off a beep is the only feedback there is, so recording has to
 * announce itself audibly or you cannot tell whether it started.
 */
export function toneUri(freq = 880, ms = 140, volume = 0.3) {
  const rate = 8000;
  const n = Math.round(rate * ms / 1000);
  const bytes = new Uint8Array(44 + n);
  const dv = new DataView(bytes.buffer);
  const put = (off, str) => { for (let i = 0; i < str.length; i++) bytes[off + i] = str.charCodeAt(i); };
  put(0, 'RIFF'); dv.setUint32(4, 36 + n, true); put(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate, true);
  dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  put(36, 'data'); dv.setUint32(40, n, true);
  for (let i = 0; i < n; i++) {
    // Fade the edges or the tone clicks on start and stop.
    const fade = Math.min(1, Math.min(i, n - i) / (rate * 0.01));
    bytes[44 + i] = 128 + Math.round(Math.sin(2 * Math.PI * freq * i / rate) * 127 * volume * fade);
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

/** Play a tone without disturbing whatever the main player is doing. */
export function playTone(uri) {
  try {
    const a = new Audio(uri);
    a.volume = 0.6;
    a.play().catch(() => {});
  } catch (e) {}
}
