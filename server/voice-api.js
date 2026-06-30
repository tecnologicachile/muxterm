const express = require('express');
const multer = require('multer');
const ttydManager = require('./ttyd-manager');
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
 * body { terminalId, text }. Sends the (user-reviewed) text into the terminal's
 * tmux session as if typed, then Enter. Reuses ttydManager.sendKeys.
 */
router.post('/inject', express.json(), async (req, res) => {
  try {
    const { terminalId, text } = req.body || {};
    if (!terminalId || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ status: 'error', message: 'terminalId and non-empty text are required' });
    }

    // Ownership: the terminal must be live in this server and belong to the caller.
    const terminal = ttydManager.terminals.get(terminalId);
    if (!terminal) {
      return res.status(404).json({ status: 'error', message: 'Terminal not active' });
    }
    if (terminal.userId && req.userId && terminal.userId !== req.userId) {
      return res.status(403).json({ status: 'error', message: 'Not your terminal' });
    }

    // Send the literal text, then Enter as a separate call (Claude Code's TUI can
    // drop the Enter if it arrives glued to the text — see docs/claude-msg.md).
    ttydManager.sendKeys(terminalId, text);
    setTimeout(() => {
      try { ttydManager.sendKeys(terminalId, '\r'); } catch (e) {}
    }, 200);

    return res.json({ status: 'ok' });
  } catch (e) {
    logger.error(`voice/inject error: ${e.message}`);
    return res.status(500).json({ status: 'error', message: 'Internal error during injection' });
  }
});

module.exports = router;
