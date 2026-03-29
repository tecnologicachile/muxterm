const express = require('express');
const { execFile } = require('child_process');
const router = express.Router();

// Store active bw sessions per muxterm user
const bwSessions = new Map();

const VAULT_URL = process.env.VAULTWARDEN_URL || '';

function runBw(args, options = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...options.env, BITWARDENCLI_APPDATA_DIR: '/tmp/bw-' + (options.userId || 'default'), NODE_TLS_REJECT_UNAUTHORIZED: '0' };
    execFile('bw', args, { env, timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stdout.trim() || stderr.trim() || err.message));
      else resolve(stdout.trim());
    });
  });
}

// Configure Vaultwarden URL
router.post('/config', async (req, res) => {
  try {
    const { serverUrl } = req.body;
    const url = serverUrl || VAULT_URL;
    if (!url) return res.status(400).json({ status: 'error', message: 'Server URL required' });
    await runBw(['config', 'server', url], { userId: req.userId });
    res.json({ status: 'ok', serverUrl: url });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Login with API Key
router.post('/login', async (req, res) => {
  try {
    const { email, password, serverUrl } = req.body;

    // Clean slate: remove old bw data and logout
    const fs = require('fs');
    const bwDir = '/tmp/bw-' + req.userId;
    try { fs.rmSync(bwDir, { recursive: true, force: true }); } catch (e) {}
    try { await runBw(['logout'], { userId: req.userId }); } catch (e) { /* ignore */ }

    if (serverUrl) {
      await runBw(['config', 'server', serverUrl], { userId: req.userId });
    }

    // Login with email + password
    const loginOutput = await runBw(['login', email, password, '--raw'], { userId: req.userId });
    const sessionKey = loginOutput;

    bwSessions.set(req.userId, {
      sessionKey,
      lastUsed: Date.now()
    });

    res.json({ status: 'ok' });
  } catch (e) {
    res.status(401).json({ status: 'error', message: e.message });
  }
});

// List organizations
router.get('/organizations', async (req, res) => {
  try {
    const session = bwSessions.get(req.userId);
    if (!session) return res.status(401).json({ status: 'error', message: 'Not logged in' });
    const output = await runBw(['list', 'organizations', '--session', session.sessionKey], { userId: req.userId });
    const orgs = JSON.parse(output);
    res.json({ status: 'ok', items: orgs.map(o => ({ id: o.id, name: o.name })) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// List collections (for an organization)
router.get('/collections', async (req, res) => {
  try {
    const session = bwSessions.get(req.userId);
    if (!session) return res.status(401).json({ status: 'error', message: 'Not logged in' });
    const { organizationId } = req.query;
    const args = ['list', 'org-collections', '--organizationid', organizationId, '--session', session.sessionKey];
    const output = await runBw(args, { userId: req.userId });
    const cols = JSON.parse(output);
    res.json({ status: 'ok', items: cols.map(c => ({ id: c.id, name: c.name })) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// List items filtered by URI scheme
router.get('/items', async (req, res) => {
  try {
    const session = bwSessions.get(req.userId);
    if (!session) return res.status(401).json({ status: 'error', message: 'Not logged in to Vaultwarden' });

    session.lastUsed = Date.now();
    const { type, collectionId } = req.query;

    // Sync first
    try { await runBw(['sync', '--session', session.sessionKey], { userId: req.userId }); } catch (e) { /* ignore */ }

    // List items (optionally filtered by collection)
    const args = ['list', 'items', '--session', session.sessionKey];
    if (collectionId) { args.push('--collectionid', collectionId); }
    const output = await runBw(args, { userId: req.userId });
    const items = JSON.parse(output);

    // Filter login items with URIs
    const connections = items
      .filter(item => item.type === 1 && item.login) // type 1 = Login
      .map(item => {
        const uris = (item.login.uris || []).map(u => u.uri).filter(Boolean);
        const parsed = uris.map(uri => {
          try {
            const match = uri.match(/^(ssh|rdp|vnc|sftp):\/\/([^:\/]+)(?::(\d+))?/);
            if (match) return { scheme: match[1], host: match[2], port: parseInt(match[3]) || null };
          } catch (e) {}
          return null;
        }).filter(Boolean);

        if (parsed.length === 0) return null;

        return {
          id: item.id,
          name: item.name,
          username: item.login.username,
          password: item.login.password,
          connections: parsed,
          folder: item.folderId,
          notes: item.notes
        };
      })
      .filter(Boolean);

    // Filter by type if specified
    const filtered = type
      ? connections.filter(c => c.connections.some(p => p.scheme === type))
      : connections;

    res.json({ status: 'ok', items: filtered });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Get single item
router.get('/item/:id', async (req, res) => {
  try {
    const session = bwSessions.get(req.userId);
    if (!session) return res.status(401).json({ status: 'error', message: 'Not logged in' });

    session.lastUsed = Date.now();
    const output = await runBw(['get', 'item', req.params.id, '--session', session.sessionKey], { userId: req.userId });
    const item = JSON.parse(output);

    res.json({
      status: 'ok',
      item: {
        id: item.id,
        name: item.name,
        username: item.login?.username,
        password: item.login?.password,
        uris: (item.login?.uris || []).map(u => u.uri)
      }
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Create item in vault
router.post('/create', async (req, res) => {
  try {
    const session = bwSessions.get(req.userId);
    if (!session) return res.status(401).json({ status: 'error', message: 'Not logged in' });

    const { name, type, host, port, username, password, organizationId, collectionId } = req.body;
    const uri = `${type}://${host}${port ? ':' + port : ''}`;

    const item = {
      type: 1,
      name: name,
      login: {
        username: username || null,
        password: password || null,
        uris: [{ uri: uri, match: null }]
      }
    };

    // If organization + collection specified, assign item to them
    if (organizationId) item.organizationId = organizationId;
    if (collectionId) item.collectionIds = [collectionId];

    const encoded = Buffer.from(JSON.stringify(item)).toString('base64');
    const args = ['create', 'item', encoded, '--session', session.sessionKey];
    if (organizationId) { args.push('--organizationid', organizationId); }
    await runBw(args, { userId: req.userId });

    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Lock vault
router.post('/lock', async (req, res) => {
  try {
    const session = bwSessions.get(req.userId);
    if (session) {
      await runBw(['lock', '--session', session.sessionKey], { userId: req.userId });
      bwSessions.delete(req.userId);
    }
    res.json({ status: 'ok' });
  } catch (e) {
    res.json({ status: 'ok' });
  }
});

// Set timeout
let sessionTimeoutMinutes = 30;
router.post('/timeout', (req, res) => {
  const { minutes } = req.body;
  if (minutes >= 5 && minutes <= 480) {
    sessionTimeoutMinutes = minutes;
  }
  res.json({ status: 'ok', minutes: sessionTimeoutMinutes });
});

// Check status
router.get('/status', async (req, res) => {
  const session = bwSessions.get(req.userId);
  res.json({ status: 'ok', loggedIn: !!session });
});

// Cleanup stale sessions (30 min idle)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of bwSessions) {
    if (now - session.lastUsed > sessionTimeoutMinutes * 60 * 1000) {
      runBw(['lock', '--session', session.sessionKey], { userId: id }).catch(() => {});
      bwSessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

module.exports = router;
