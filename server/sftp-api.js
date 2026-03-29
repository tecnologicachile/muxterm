const express = require('express');
const SftpClient = require('ssh2-sftp-client');
const path = require('path');
const multer = require('multer');
const router = express.Router();

// Store active SFTP connections per session
const connections = new Map();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Get or create SFTP connection
async function getConnection(sessionId, config) {
  if (connections.has(sessionId)) {
    const conn = connections.get(sessionId);
    // Test if still alive
    try {
      await conn.client.stat('/');
      return conn.client;
    } catch (e) {
      connections.delete(sessionId);
    }
  }

  const client = new SftpClient();
  await client.connect({
    host: config.host,
    port: config.port || 22,
    username: config.username,
    password: config.password
  });
  connections.set(sessionId, { client, config, lastUsed: Date.now() });
  return client;
}

// Connect endpoint
router.post('/connect', async (req, res) => {
  try {
    const { host, port, username, password } = req.body;
    const sessionId = `${req.userId}_${host}_${username}`;
    const client = await getConnection(sessionId, { host, port, username, password });
    const list = await client.list('/');
    res.json({ status: 'ok', sessionId, files: formatFiles(list, '/') });
  } catch (e) {
    res.status(400).json({ status: 'error', message: e.message });
  }
});

// List directory
router.post('/list', async (req, res) => {
  try {
    const { sessionId, path: dirPath } = req.body;
    const conn = connections.get(sessionId);
    if (!conn) return res.status(401).json({ status: 'error', message: 'Not connected' });
    const list = await conn.client.list(dirPath || '/');
    res.json({ status: 'ok', files: formatFiles(list, dirPath || '/') });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Create directory
router.post('/mkdir', async (req, res) => {
  try {
    const { sessionId, path: dirPath } = req.body;
    const conn = connections.get(sessionId);
    if (!conn) return res.status(401).json({ status: 'error', message: 'Not connected' });
    await conn.client.mkdir(dirPath, true);
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Delete file or directory
router.post('/delete', async (req, res) => {
  try {
    const { sessionId, path: filePath, isDir } = req.body;
    const conn = connections.get(sessionId);
    if (!conn) return res.status(401).json({ status: 'error', message: 'Not connected' });
    if (isDir) {
      await conn.client.rmdir(filePath, true);
    } else {
      await conn.client.delete(filePath);
    }
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Rename/move
router.post('/rename', async (req, res) => {
  try {
    const { sessionId, from, to } = req.body;
    const conn = connections.get(sessionId);
    if (!conn) return res.status(401).json({ status: 'error', message: 'Not connected' });
    await conn.client.rename(from, to);
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Upload file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { sessionId, path: destPath } = req.body;
    const conn = connections.get(sessionId);
    if (!conn) return res.status(401).json({ status: 'error', message: 'Not connected' });
    await conn.client.put(req.file.buffer, destPath);
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Download file
router.get('/download', async (req, res) => {
  try {
    const { sessionId, path: filePath } = req.query;
    const conn = connections.get(sessionId);
    if (!conn) return res.status(401).json({ status: 'error', message: 'Not connected' });
    // Verify ownership
    if (!sessionId.startsWith(`${req.userId}_`)) return res.status(403).json({ status: 'error', message: 'Forbidden' });
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    await conn.client.get(filePath, res);
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Disconnect
router.post('/disconnect', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const conn = connections.get(sessionId);
    if (conn) {
      await conn.client.end();
      connections.delete(sessionId);
    }
    res.json({ status: 'ok' });
  } catch (e) {
    res.json({ status: 'ok' });
  }
});

function formatFiles(list, parentPath) {
  return list.map(item => ({
    id: path.join(parentPath, item.name),
    name: item.name,
    type: item.type === 'd' ? 'folder' : 'file',
    size: item.size,
    date: new Date(item.modifyTime),
    parent: parentPath === '/' ? 0 : parentPath
  }));
}

// Cleanup stale connections every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, conn] of connections) {
    if (now - conn.lastUsed > 30 * 60 * 1000) { // 30 min idle
      conn.client.end().catch(() => {});
      connections.delete(id);
    }
  }
}, 10 * 60 * 1000);

module.exports = router;
