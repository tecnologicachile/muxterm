const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const multer = require('multer');
const ttydManager = require('./ttyd-manager');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Get CWD of a terminal's shell process via tmux pane_pid
function getTerminalCwd(terminalId) {
  const terminal = ttydManager.getTerminal(terminalId);
  if (!terminal || !terminal.tmuxSessionName) return null;
  try {
    // Get pane PID from tmux
    const panePid = execSync(
      `tmux -L muxterm display-message -p -t ${terminal.tmuxSessionName} '#{pane_pid}'`,
      { encoding: 'utf8' }
    ).trim();
    if (!panePid) return null;
    // The shell PID is the pane_pid; its child (or itself) cwd
    // Try to find the deepest descendant with a cwd
    let pid = panePid;
    try {
      // Get child process if exists (for cases where shell launched something)
      const children = execSync(`pgrep -P ${pid}`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
      if (children.length > 0) pid = children[children.length - 1];
    } catch (e) {}
    const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
    return cwd;
  } catch (e) {
    return null;
  }
}

// Get current working directory of terminal
router.get('/cwd/:terminalId', (req, res) => {
  const cwd = getTerminalCwd(req.params.terminalId);
  if (!cwd) return res.status(404).json({ status: 'error', message: 'Terminal CWD not found' });
  res.json({ status: 'ok', cwd });
});

// List directory contents
router.post('/list', (req, res) => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath) return res.status(400).json({ status: 'error', message: 'Path required' });
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = entries.map(entry => {
      const fullPath = path.join(dirPath, entry.name);
      let stat = null;
      try { stat = fs.statSync(fullPath); } catch (e) {}
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'folder' : 'file',
        size: stat ? stat.size : 0,
        date: stat ? stat.mtime : null,
        path: fullPath
      };
    });
    files.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    res.json({ status: 'ok', path: dirPath, files });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Create directory
router.post('/mkdir', (req, res) => {
  try {
    const { path: dirPath } = req.body;
    fs.mkdirSync(dirPath, { recursive: true });
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Delete file or directory
router.post('/delete', (req, res) => {
  try {
    const { path: filePath, isDir } = req.body;
    if (isDir) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Rename
router.post('/rename', (req, res) => {
  try {
    const { from, to } = req.body;
    fs.renameSync(from, to);
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Upload file
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    const destPath = req.body.path;
    fs.writeFileSync(destPath, req.file.buffer);
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Claude writes paths as /abs/path or ~/path; both name a file here.
const expandHome = (p) => (p === '~' || p.startsWith('~/')) ? path.join(os.homedir(), p.slice(1)) : p;
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };

// Which of these paths are files. A path mentioned in a terminal or a reply
// can have spaces ("Factura 1344 - Tecnológica Chile.pdf. Tiene 4 páginas"),
// so the client sends every place it could end and keeps the one that exists.
router.post('/exists', (req, res) => {
  const paths = Array.isArray(req.body && req.body.paths) ? req.body.paths.slice(0, 200) : [];
  res.json({ status: 'ok', existing: paths.filter(p => typeof p === 'string' && isFile(expandHome(p))) });
});

// Download file
router.get('/download', (req, res) => {
  try {
    const filePath = req.query.path && expandHome(String(req.query.path));
    if (!filePath || !isFile(filePath)) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.download(filePath);
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
