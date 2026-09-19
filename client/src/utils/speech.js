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

  const voice = pickVoice();
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    if (voice) u.voice = voice;
    u.lang = (voice && voice.lang) || 'es-ES';
    u.rate = 1.05;
    if (i === chunks.length - 1 && onEnd) u.onend = onEnd;
    if (onError) u.onerror = (e) => { if (e && e.error !== 'interrupted') onError(e); };
    try { window.speechSynthesis.speak(u); } catch (e) { if (onError) onError(e); }
  });
}

export function stopSpeaking() {
  try { window.speechSynthesis.cancel(); } catch (e) {}
}
