const express = require('express');
const { execFile } = require('child_process');
const router = express.Router();

// Store active bw sessions per muxterm user
const bwSessions = new Map();

// Keep session alive on any vault API call
router.use((req, res, next) => {
  const session = bwSessions.get(req.userId);
  if (session) session.lastUsed = Date.now();
  next();
});

// Public method to refresh session from outside (called by other routes)
router.keepAlive = (userId) => {
  const session = bwSessions.get(userId);
  if (session) session.lastUsed = Date.now();
};

const VAULT_URL = process.env.VAULTWARDEN_URL || '';

function runBwRaw(args, options = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...options.env, BITWARDENCLI_APPDATA_DIR: '/tmp/bw-' + (options.userId || 'default'), NODE_TLS_REJECT_UNAUTHORIZED: '0', BW_NOINTERACTION: 'true' };
    execFile('bw', args, { env, timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const output = (stdout || '').trim();
      const errOutput = (stderr || '').trim();
      if (err) reject(new Error(output || errOutput || err.message));
      else resolve(output);
    });
  });
}

async function runBw(args, options = {}) {
  try {
    return await runBwRaw(args, options);
  } catch (e) {
    const msg = e.message || '';
    // Auto-unlock if vault is locked
    if (msg.includes('Vault is locked') || msg.includes('vault is locked')) {
      const session = bwSessions.get(options.userId);
      if (session && session.masterPassword) {
        try {
          const newKey = await runBwRaw(['unlock', session.masterPassword, '--raw'], options);
          session.sessionKey = newKey;
          // Replace old session key in args
          const sessionIdx = args.indexOf('--session');
          if (sessionIdx >= 0) {
            args[sessionIdx + 1] = newKey;
          }
          return await runBwRaw(args, options);
        } catch (unlockErr) {
          bwSessions.delete(options.userId);
          throw new Error('SESSION_EXPIRED');
        }
      }
      bwSessions.delete(options.userId);
      throw new Error('SESSION_EXPIRED');
    }
    if (msg.includes('not logged in') || msg.includes('Master password')) {
      bwSessions.delete(options.userId);
      throw new Error('SESSION_EXPIRED');
    }
    throw e;
  }
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

    // List organizations
    let organizations = [];
    try {
      const orgsOutput = await runBw(['list', 'organizations', '--session', sessionKey], { userId: req.userId });
      organizations = JSON.parse(orgsOutput).map(o => ({ id: o.id, name: o.name }));
    } catch (e) {}

    bwSessions.set(req.userId, {
      sessionKey,
      masterPassword: password,
      lastUsed: Date.now(),
      collectionId: null,
      organizationId: null
    });

    res.json({ status: 'ok', organizations });
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
    const { type } = req.query;

    const CACHE_TTL = 60000; // 1 minute cache
    const now = Date.now();
    const cacheKey = session.collectionId || 'all';

    // Use cache if fresh
    if (!session.itemsCache || !session.itemsCache[cacheKey] || (now - session.itemsCacheTime) > CACHE_TTL) {
      // Sync in background (don't block)
      if (!session.lastSync || (now - session.lastSync) > CACHE_TTL) {
        session.lastSync = now;
        runBw(['sync', '--session', session.sessionKey], { userId: req.userId }).catch(e => {
          if (e.message === 'SESSION_EXPIRED') bwSessions.delete(req.userId);
        });
      }

      // List items
      const args = ['list', 'items', '--session', session.sessionKey];
      if (session.collectionId) { args.push('--collectionid', session.collectionId); }
      let output;
      try {
        output = await runBw(args, { userId: req.userId });
      } catch (e) {
        if (e.message === 'SESSION_EXPIRED') {
          bwSessions.delete(req.userId);
          return res.status(401).json({ status: 'error', message: 'Vault session expired' });
        }
        throw e;
      }
      const parsed = JSON.parse(output);
      if (!session.itemsCache) session.itemsCache = {};
      session.itemsCache[cacheKey] = parsed;
      session.itemsCacheTime = now;
    }

    const items = session.itemsCache[cacheKey];

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

    // Filter by type if specified (sftp also matches ssh credentials)
    const filtered = type
      ? connections.filter(c => c.connections.some(p => p.scheme === type || (type === 'sftp' && p.scheme === 'ssh')))
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

    const { name, type, host, port, username, password } = req.body;
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

    // Auto-assign to "Remote Access" collection if available
    if (session.organizationId) item.organizationId = session.organizationId;
    if (session.collectionId) item.collectionIds = [session.collectionId];

    const encoded = Buffer.from(JSON.stringify(item)).toString('base64');
    const args = ['create', 'item', encoded, '--session', session.sessionKey];
    if (session.organizationId) { args.push('--organizationid', session.organizationId); }
    await runBw(args, { userId: req.userId });

    // Invalidate cache
    if (session.itemsCache) session.itemsCache = {};
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Rename item in vault
router.post('/rename', async (req, res) => {
  try {
    const session = bwSessions.get(req.userId);
    if (!session) return res.status(401).json({ status: 'error', message: 'Not logged in' });

    const { itemId, newName } = req.body;
    if (!itemId || !newName) return res.status(400).json({ status: 'error', message: 'itemId and newName required' });

    // Get current item
    const output = await runBw(['get', 'item', itemId, '--session', session.sessionKey], { userId: req.userId });
    const item = JSON.parse(output);
    item.name = newName;

    const encoded = Buffer.from(JSON.stringify(item)).toString('base64');
    await runBw(['edit', 'item', itemId, encoded, '--session', session.sessionKey], { userId: req.userId });

    // Invalidate cache
    if (session.itemsCache) session.itemsCache = {};
    res.json({ status: 'ok' });
  } catch (e) {
    if (e.message === 'SESSION_EXPIRED') return res.status(401).json({ status: 'error', message: 'Vault session expired' });
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

// Select organization (auto-finds "Remote Access" collection)
router.post('/select-org', async (req, res) => {
  try {
    const session = bwSessions.get(req.userId);
    if (!session) return res.status(401).json({ status: 'error', message: 'Not logged in' });

    const { organizationId } = req.body;
    session.organizationId = organizationId || null;
    session.collectionId = null;

    if (organizationId) {
      try {
        const colsOutput = await runBw(['list', 'org-collections', '--organizationid', organizationId, '--session', session.sessionKey], { userId: req.userId });
        const cols = JSON.parse(colsOutput);
        let remoteAccess = cols.find(c => c.name === 'Remote Access');
        if (!remoteAccess) {
          // Create "Remote Access" collection
          try {
            const newCol = JSON.stringify({ organizationId, name: 'Remote Access' });
            const encoded = Buffer.from(newCol).toString('base64');
            const createOutput = await runBw(['create', 'org-collection', encoded, '--organizationid', organizationId, '--session', session.sessionKey], { userId: req.userId });
            const created = JSON.parse(createOutput);
            remoteAccess = { id: created.id, name: created.name };
          } catch (e) { /* may not have permission to create collections */ }
        }
        if (remoteAccess) {
          session.collectionId = remoteAccess.id;
        }
      } catch (e) {}
    }

    res.json({ status: 'ok', collectionId: session.collectionId, hasRemoteAccess: !!session.collectionId });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
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
  res.json({ status: 'ok', loggedIn: !!session, collectionId: session?.collectionId || null, organizationId: session?.organizationId || null, hasRemoteAccess: !!session?.collectionId });
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
