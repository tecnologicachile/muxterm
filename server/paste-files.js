/**
 * Files pasted or dropped onto a terminal (or the Claude chat composer).
 *
 * Claude Code reads its own clipboard with Ctrl+V, but in MuxTerm the
 * browser's clipboard never reaches the server. So the browser uploads the
 * file here, we save it on this machine, and the caller types the path into
 * the terminal: Claude Code takes an image path as an attached image, and
 * any other file (PDF, CSV, code) as a file to read.
 *
 * Only local terminals: in an SSH terminal the path would point to a file
 * the remote machine does not have.
 */
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { resolveSession } = require('./terminal-input');
const logger = require('./utils/logger');

const DIR = path.join(os.homedir(), '.cache', 'muxterm', 'pastes');
const KEEP_MS = 7 * 24 * 3600 * 1000;
const MAX_BYTES = 50 * 1024 * 1024;
const REMOTE = /^(ssh|sshpass|mosh|mosh-client|telnet)$/;

// Old pastes are only useful while the conversation that used them is fresh.
function prune() {
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(DIR)) {
      const p = path.join(DIR, f);
      try { if (now - fs.statSync(p).mtimeMs > KEEP_MS) fs.unlinkSync(p); } catch (e) {}
    }
  } catch (e) {}
}

// A name without spaces or shell characters, so the typed path needs no
// quoting and Claude Code recognizes it as a path.
function safeName(name, mime) {
  let base = path.basename(String(name || '')).normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/^[._]+/, '');
  if (!base) base = 'pegado';
  if (!path.extname(base) && /^image\/(png|jpeg|gif|webp)$/.test(mime || '')) {
    base += '.' + mime.split('/')[1].replace('jpeg', 'jpg');
  }
  return base.slice(-80);
}

const router = express.Router();

router.post('/', express.raw({ type: () => true, limit: MAX_BYTES }), (req, res) => {
  const terminalId = String(req.query.terminalId || '');
  if (!terminalId) return res.status(400).json({ status: 'error', message: 'terminalId is required' });
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    return res.status(400).json({ status: 'error', message: 'Archivo vacío' });
  }

  const r = resolveSession({ terminalId, userId: req.user.id });
  if (r.error) return res.status(r.error.status).json(r.error.body);

  try {
    const cmd = execFileSync('tmux', ['-L', 'muxterm', 'display-message', '-p', '-t', r.session, '#{pane_current_command}'],
      { encoding: 'utf8', timeout: 3000 }).trim();
    if (REMOTE.test(cmd)) {
      return res.status(422).json({ status: 'error', message: 'Pegar archivos funciona solo en terminales locales' });
    }
  } catch (e) {}

  try {
    fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
    prune();
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const file = path.join(DIR, `${stamp}-${crypto.randomBytes(3).toString('hex')}-${safeName(req.query.name, req.headers['content-type'])}`);
    fs.writeFileSync(file, req.body, { mode: 0o600 });
    logger.info(`Pasted file for ${terminalId.substring(0, 8)}: ${path.basename(file)} (${req.body.length} bytes)`);
    res.json({ status: 'ok', path: file });
  } catch (e) {
    logger.error('paste-file error: ' + e.message);
    res.status(500).json({ status: 'error', message: 'No se pudo guardar el archivo' });
  }
});

// A body over the limit arrives here as a 413 from express.raw.
router.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ status: 'error', message: 'El archivo supera los 50 MB' });
  }
  next(err);
});

module.exports = router;
