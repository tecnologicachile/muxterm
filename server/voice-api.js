const express = require('express');
const multer = require('multer');
const { injectText } = require('./terminal-input');
const systemSettings = require('./system-settings');
const logger = require('./utils/logger');

const router = express.Router();

// Audio is kept in memory (Whisper hard limit is 25 MB) and forwarded straight to OpenAI.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// What Whisper's Spanish model emits for silence or near-silence. Not "no
// speech" — subtitle credits and sign-offs it saw at the end of countless
// videos. Anything matching is not a dictation.
const SILENCE_PATTERNS = [
  /subt[ií]tulos?\s+(realizados|creados|hechos)/i,
  /amara\.org/i,
  /antarctica\s+films/i,
  /^cc\s+por\s+/i,
  /gracias\s+por\s+ver/i,
  /suscr[ií]b(e|a)te/i,
  /^\s*\.{2,}\s*$/,
];
function isSilenceHallucination(text) {
  const t = String(text || '').trim();
  if (t.length < 2) return true;
  return SILENCE_PATTERNS.some(re => re.test(t));
}

// Map the recorder mime type to a filename extension OpenAI accepts.
function audioFilename(mime) {
  const m = (mime || '').toLowerCase();
  if (m.includes('webm')) return 'audio.webm';
  if (m.includes('ogg')) return 'audio.ogg';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'audio.mp4';
  if (m.includes('mpeg') || m.includes('mp3')) return 'audio.mp3';
  if (m.includes('wav')) return 'audio.wav';
  return 'audio.webm';
}

/**
 * POST /api/voice/transcribe
 * multipart/form-data with field `audio`. Returns { text } from Whisper.
 * Does NOT inject anything — the client reviews the text first.
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer || !req.file.buffer.length) {
      return res.status(400).json({ status: 'error', message: 'No audio received' });
    }

    const apiKey = systemSettings.getOpenAiKey();
    if (!apiKey) {
      return res.status(400).json({ status: 'error', message: 'OpenAI API key not configured. Set it in Settings.' });
    }

    const lang = (req.body && req.body.language) || 'es';
    const form = new FormData();
    form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), audioFilename(req.file.mimetype));
    form.append('model', 'whisper-1');
    if (lang) form.append('language', lang);

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      logger.error(`Whisper transcription failed (${r.status}): ${detail.slice(0, 300)}`);
      const message = r.status === 401
        ? 'OpenAI rejected the API key (401).'
        : `Transcription failed (${r.status}).`;
      return res.status(502).json({ status: 'error', message });
    }

    const data = await r.json();
    const text = (data && typeof data.text === 'string') ? data.text.trim() : '';
    if (isSilenceHallucination(text)) {
      // Whisper does not say "nothing here": on silent audio it produces
      // subtitle credits. Those were reaching Claude as prompts.
      logger.error(`Whisper returned a silence hallucination: ${text.slice(0, 80)}`);
      return res.status(422).json({ status: 'error', message: 'No se captó voz (audio en silencio)' });
    }
    return res.json({ status: 'ok', text });
  } catch (e) {
    logger.error(`voice/transcribe error: ${e.message}`);
    return res.status(500).json({ status: 'error', message: 'Internal error during transcription' });
  }
});

/**
 * POST /api/voice/inject
 * body { terminalId, text }. Sends the (user-reviewed) transcription into the
 * terminal. Kept for the voice flow; the shared implementation now also backs
 * the chat view composer.
 */
router.post('/inject', express.json(), (req, res) => {
  try {
    const { terminalId, text } = req.body || {};
    const r = injectText({ terminalId, text, userId: req.userId });
    return res.status(r.status).json(r.body);
  } catch (e) {
    logger.error(`voice/inject error: ${e.message}`);
    return res.status(500).json({ status: 'error', message: 'Internal error during injection' });
  }
});

/**
 * POST /api/voice/speak
 * body { text }. Streams back an mp3 of the text read aloud.
 *
 * The browser's own speech synthesis does not count as media playback, so
 * Android suspends it when the screen goes off. Real audio keeps playing, which
 * is why background listening has to come from a file rather than the Web
 * Speech API.
 */
const SPEAK_MAX_CHARS = 4000;   // bounds what one reply can cost

router.post('/speak', express.json(), async (req, res) => {
  try {
    const raw = (req.body && req.body.text) || '';
    const text = String(raw).trim().slice(0, SPEAK_MAX_CHARS);
    if (!text) return res.status(400).json({ status: 'error', message: 'text is required' });

    const apiKey = systemSettings.getOpenAiKey();
    if (!apiKey) return res.status(400).json({ status: 'error', message: 'OpenAI API key not configured' });

    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // tts-1 renders a whole reply in ~3s; the higher quality models stream
        // early but take far longer to finish, which risks stalling playback.
        model: 'tts-1',
        voice: (req.body && req.body.voice) || 'nova',
        input: text,
        response_format: 'mp3'
      })
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      logger.error(`TTS failed (${r.status}): ${detail.slice(0, 300)}`);
      return res.status(502).json({ status: 'error', message: `No se pudo generar la voz (${r.status})` });
    }

    // Send it whole, with a length. Streamed without one, a drop mid-body
    // reached the phone as a bare "Failed to fetch" with nothing to retry on;
    // tts-1 finishes in a few seconds anyway, so waiting costs little.
    const audio = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audio.length);
    res.setHeader('Cache-Control', 'no-store');
    res.end(audio);
  } catch (e) {
    logger.error(`voice/speak error: ${e.message}`);
    if (!res.headersSent) res.status(500).json({ status: 'error', message: 'Internal error' });
  }
});

module.exports = router;
