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

module.exports = router;
