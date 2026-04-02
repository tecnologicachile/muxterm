require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./auth');
const ttydManager = require('./ttyd-manager');
const jwt = require('jsonwebtoken');
const database = require('../db/database');
const tmuxManager = require('../utils/tmuxManager');
const logger = require('./utils/logger');
const tracer = require('./utils/persistenceTracer');
const updateChecker = require('./update-checker');
const httpProxy = require('http-proxy');
const guacamoleManager = require('./guacamole-manager');
const credEncryption = require('./credential-encryption');

// Encrypted credential cache helpers (stored in DB, not in memory)
function cachePassword(userId, type, host, port, username, password, source, vaultItemId) {
  if (!password) return;
  const cacheKey = `${type}:${host}:${port}:${username}`;
  const { ciphertext, iv } = credEncryption.encrypt(password);
  database.cacheCredential(userId, cacheKey, ciphertext, iv, source || 'local', vaultItemId || null);
}

function getCachedPassword(userId, type, host, port, username) {
  const cacheKey = `${type}:${host}:${port}:${username}`;
  const cached = database.getCachedCredential(userId, cacheKey);
  if (cached) {
    return credEncryption.decrypt(cached.encrypted_password, cached.password_iv);
  }
  return null;
}

const app = express();

// Try HTTPS first, fallback to HTTP
let server;
try {
  const certsDir = path.join(__dirname, '..', 'certs');
  if (fs.existsSync(certsDir)) {
    const files = fs.readdirSync(certsDir);
    const certFile = files.find(f => f.endsWith('.pem') && !f.includes('-key'));
    const keyFile = files.find(f => f.endsWith('-key.pem'));
    if (certFile && keyFile) {
      server = https.createServer({
        cert: fs.readFileSync(path.join(certsDir, certFile)),
        key: fs.readFileSync(path.join(certsDir, keyFile))
      }, app);
      console.log('[HTTPS] Enabled with certificate:', certFile);
    }
  }
} catch (e) {
  console.log('[HTTPS] Failed to load certs:', e.message);
}
if (!server) {
  server = http.createServer(app);
  console.log('[HTTP] Running without SSL');
}

// Socket.io uses /socket.io/ path, ttyd uses /ttyd/ path - no conflict
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? false
      : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3003'],
    credentials: true
  },
  path: '/socket.io/'
});


app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? false 
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3003'],
  credentials: true
}));

app.use(express.json());
// Session configuration without Redis for testing
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

app.use('/api/auth', authRoutes);

// Serve CA certificate for easy installation on other devices
// SFTP file browser API (mounted after authenticateToken is defined)

app.get('/ca.pem', (req, res) => {
  const caPath = path.join(__dirname, '..', 'certs', 'rootCA.pem');
  if (fs.existsSync(caPath)) {
    res.download(caPath, 'muxterm-ca.pem');
  } else {
    res.status(404).send('CA certificate not available');
  }
});

// Simple auth middleware for update endpoint
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      username: decoded.username || 'unknown'
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// SFTP file browser API
const sftpApi = require('./sftp-api');
// Vaultwarden integration
const vaultwardenApi = require('./vaultwarden-api');
app.use('/api/sftp', authenticateToken, (req, res, next) => {
  req.userId = req.user.id;
  next();
}, sftpApi);

app.use('/api/vault', authenticateToken, (req, res, next) => {
  req.userId = req.user.id;
  next();
}, vaultwardenApi);

// Guacd health check — test if guacd is accepting connections
app.get('/api/guacd-health', (req, res) => {
  const net = require('net');
  const client = new net.Socket();
  client.setTimeout(3000);
  client.connect(4822, '127.0.0.1', () => {
    client.destroy();
    res.json({ status: 'ok' });
  });
  client.on('error', () => {
    client.destroy();
    res.json({ status: 'unavailable' });
  });
  client.on('timeout', () => {
    client.destroy();
    res.json({ status: 'unavailable' });
  });
});

// Update check endpoint
app.get('/api/update-check', async (req, res) => {
  // Force check if manual=true query param
  const forceCheck = req.query.manual === 'true';
  const updateInfo = await updateChecker.checkForUpdates(forceCheck);
  const isDocker = fs.existsSync('/.dockerenv') || fs.existsSync('/app/start.sh');
  res.json({ update: updateInfo, isDocker });
});

// Debug endpoint for update system
app.get('/api/update-debug', authenticateToken, async (req, res) => {
  const debugInfo = {
    currentVersion: require('../package.json').version,
    nodeVersion: process.version,
    platform: process.platform,
    cwd: process.cwd(),
    serverDir: __dirname,
    muxTermDir: path.join(__dirname, '..'),
    muxTermCommand: '/usr/local/bin/muxterm',
    muxTermExists: fs.existsSync('/usr/local/bin/muxterm'),
    updateScriptExists: fs.existsSync(path.join(__dirname, '..', 'update.sh')),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PATH: process.env.PATH
    }
  };
  
  logger.info('Debug info requested:', debugInfo);
  res.json(debugInfo);
});

// Get update logs endpoint
app.get('/api/update-logs', authenticateToken, async (req, res) => {
  try {
    const logsDir = path.join(__dirname, '..', 'logs');
    const mainLogFile = path.join(logsDir, 'muxterm.log');
    const updateLogsDir = path.join(logsDir, 'updates');
    
    let logs = {
      recent: [],
      updateLogs: [],
      lastUpdateAttempt: null
    };
    
    // Read last 100 lines of main log
    if (fs.existsSync(mainLogFile)) {
      const { exec } = require('child_process');
      exec(`tail -100 ${mainLogFile} | grep -E "\\[Update|update|Update initiated|Update Process"`, (error, stdout) => {
        if (!error && stdout) {
          logs.recent = stdout.split('\n').filter(line => line.trim());
        }
        
        // Read update logs directory
        if (fs.existsSync(updateLogsDir)) {
          const files = fs.readdirSync(updateLogsDir)
            .filter(f => f.endsWith('.log'))
            .sort((a, b) => {
              const statA = fs.statSync(path.join(updateLogsDir, a));
              const statB = fs.statSync(path.join(updateLogsDir, b));
              return statB.mtime - statA.mtime;
            })
            .slice(0, 5); // Last 5 update attempts
          
          logs.updateLogs = files.map(file => {
            const filePath = path.join(updateLogsDir, file);
            const stats = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf8');
            return {
              filename: file,
              timestamp: stats.mtime,
              size: stats.size,
              content: content.slice(-5000) // Last 5000 chars
            };
          });
          
          if (logs.updateLogs.length > 0) {
            logs.lastUpdateAttempt = logs.updateLogs[0].timestamp;
          }
        }
        
        res.json(logs);
      });
    } else {
      res.json(logs);
    }
  } catch (error) {
    logger.error('Failed to get update logs:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// GitHub stars endpoint (cached to avoid rate limits)
let starsCache = { count: null, lastFetch: 0 };
app.get('/api/github-stars', async (req, res) => {
  const now = Date.now();
  const cacheTime = 5 * 60 * 1000; // 5 minutes
  
  // Return cached value if still fresh
  if (starsCache.count !== null && (now - starsCache.lastFetch) < cacheTime) {
    return res.json({ stars: starsCache.count });
  }
  
  try {
    const https = require('https');
    const options = {
      hostname: 'api.github.com',
      path: '/repos/tecnologicachile/muxterm',
      headers: {
        'User-Agent': 'MuxTerm-Server',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    
    https.get(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const repo = JSON.parse(data);
          starsCache.count = repo.stargazers_count || 0;
          starsCache.lastFetch = now;
          res.json({ stars: starsCache.count });
        } catch (e) {
          res.json({ stars: starsCache.count || 0 });
        }
      });
    }).on('error', () => {
      res.json({ stars: starsCache.count || 0 });
    });
  } catch (error) {
    res.json({ stars: starsCache.count || 0 });
  }
});

// Update execution endpoint (requires authentication)
app.post('/api/update-execute', authenticateToken, async (req, res) => {
  try {
    // Check if there's actually an update available
    const updateInfo = await updateChecker.checkForUpdates(true);
    if (!updateInfo) {
      return res.status(400).json({ error: 'No update available' });
    }
    
    // Check if update mechanism exists
    const muxTermCommand = '/usr/local/bin/muxterm';
    const muxTermDir = path.join(__dirname, '..');
    const updateScript = path.join(muxTermDir, 'scripts', 'update-independent.sh');
    if (!fs.existsSync(muxTermCommand) && !fs.existsSync(updateScript)) {
      logger.error('No update mechanism found (muxterm command or update-independent.sh)');
      return res.status(500).json({ error: 'No update mechanism available' });
    }
    
    logger.info(`Update initiated by user ${req.user.username} from ${updateInfo.current} to ${updateInfo.latest}`);
    
    // Execute update in background using muxterm update command
    const { spawn } = require('child_process');
    
    // Determine update command
    let updateCommand;
    
    if (fs.existsSync(updateScript)) {
      updateCommand = `${updateScript} "${muxTermDir}"`;
      logger.info(`Using update-independent.sh script`);
    } else {
      updateCommand = `cd "${muxTermDir}" && timeout 300 ${muxTermCommand} update --yes`;
      logger.info(`Using muxterm command directly`);
    }
    
    logger.info(`Update command: ${updateCommand}`);
    logger.info(`Working directory: ${muxTermDir}`);
    
    // Create a wrapper script that survives service stop
    const wrapperScript = `#!/bin/bash
# Update wrapper script that survives service stop
(
  # Detach from parent process completely
  setsid ${updateCommand} &
  echo "Update process started with PID: $!"
) &`;
    
    // Execute the wrapper script
    const updateProcess = spawn('/bin/bash', ['-c', wrapperScript], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, FORCE_COLOR: '0' } // Disable color output for logs
    });
    
    // Log that update was started
    logger.info('[Update] Update process started in background');
    
    updateProcess.on('error', (error) => {
      logger.error('[Update Process Error]', error);
    });
    
    // Don't wait for process to complete
    updateProcess.unref();
    
    // Send immediate response
    res.json({ 
      success: true, 
      message: 'Update started. The service will restart automatically.',
      version: updateInfo.latest
    });
    
    // The update script will handle the service restart
    
  } catch (error) {
    logger.error('Failed to execute update:', error);
    res.status(500).json({ error: 'Failed to execute update' });
  }
});

// ttyd proxy - authenticate and forward to ttyd UNIX sockets
const ttydProxy = httpProxy.createProxyServer({});

ttydProxy.on('error', (err, req, res) => {
  logger.debug('ttyd proxy error:', err.message);
  if (res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Terminal not ready');
  }
});

// Auth middleware for ttyd routes
const authenticateTtydRequest = (req, res, next) => {
  // Token from query params (iframe passes it via URL)
  const token = req.query.arg || req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.ttydUser = { id: decoded.id, username: decoded.username };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// HTTP proxy for ttyd
app.use('/ttyd/:terminalId', authenticateTtydRequest, (req, res) => {
  const terminal = ttydManager.getTerminal(req.params.terminalId);
  if (!terminal || !terminal.socketPath) {
    return res.status(404).json({ error: 'Terminal not found' });
  }
  if (!fs.existsSync(terminal.socketPath)) {
    return res.status(503).json({ error: 'Terminal starting...' });
  }
  // Rewrite URL: remove /ttyd/:terminalId prefix, keep the rest
  req.url = req.url.replace(`/${req.params.terminalId}`, '') || '/';
  ttydProxy.web(req, res, {
    target: { socketPath: terminal.socketPath },
    ws: false
  });
});

// WebSocket upgrade for ttyd
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/ttyd\/([^/]+)\/ws/);
  if (!match) return; // Not a ttyd WebSocket, let socket.io handle it

  const terminalId = match[1];
  const terminal = ttydManager.getTerminal(terminalId);
  if (!terminal || !terminal.socketPath || !fs.existsSync(terminal.socketPath)) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  // Rewrite path to ttyd's expected path
  req.url = '/ws' + (url.search || '');

  ttydProxy.ws(req, socket, head, {
    target: { socketPath: terminal.socketPath }
  });
});

if (process.env.NODE_ENV === 'production') {
  // First try public directory, then fall back to client/dist
  const publicPath = path.join(__dirname, '../public');
  const distPath = path.join(__dirname, '../client/dist');
  
  // Prefer client/dist (fresh build) over public/ (legacy/copy)
  if (fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else if (fs.existsSync(publicPath) && fs.existsSync(path.join(publicPath, 'index.html'))) {
    app.use(express.static(publicPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }
}

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const user = jwt.verify(token, process.env.JWT_SECRET);
    if (user) {
      socket.userId = user.id;
      socket.username = user.username;
      next();
    } else {
      next(new Error('Authentication failed'));
    }
  } catch (error) {
    next(new Error('Authentication failed'));
  }
};

io.use(authenticateSocket);

io.on('connection', (socket) => {
  logger.info(`User ${socket.username} connected`);

  // Keep vault session alive on any socket activity
  socket.onAny(() => {
    if (vaultwardenApi.keepAlive) vaultwardenApi.keepAlive(socket.userId);
  });

  // Send workspace layout on connect
  const workspace = database.getWorkspaceLayout(socket.userId);
  socket.emit('workspace', workspace || { panels: [], activePanel: null, minimizedPanels: [] });

  // Workspace events
  socket.on('get-workspace', () => {
    const ws = database.getWorkspaceLayout(socket.userId);
    socket.emit('workspace', ws || { panels: [], activePanel: null, minimizedPanels: [] });
  });

  socket.on('update-workspace', (data) => {
    try {
      database.saveWorkspaceLayout(socket.userId, data);
    } catch (error) {
      logger.error('Failed to update workspace:', error);
    }
  });

  // Terminal management via ttyd
  socket.on('create-terminal', async (data) => {
    try {
      // Check if this terminal has an SSH config (per-panel SSH)
      let sshConfig = null;
      const sshConnectionId = data.sshConnectionId || null;
      if (sshConnectionId) {
        const conn = database.getSshConnection(sshConnectionId);
        if (conn && conn.user_id === socket.userId) {
          sshConfig = {
            host: conn.host,
            port: conn.port,
            username: conn.username,
            authType: conn.auth_type,
            password: getCachedPassword(socket.userId, 'ssh', conn.host, conn.port, conn.username) || conn.password || null,
            privateKey: conn.private_key
          };
        }
      }

      // Support both workspace mode (no sessionId) and legacy mode (with sessionId)
      const sessionId = data.sessionId || `ws_${socket.userId}`;

      const terminal = await ttydManager.createTerminal(
        socket.userId,
        sessionId,
        data.rows || 24,
        data.cols || 80,
        null,
        sshConfig
      );
      const terminalEvent = data.requestId ? `terminal-created-${data.requestId}` : 'terminal-created';
      socket.emit(terminalEvent, {
        terminalId: terminal.id,
        sessionId: sessionId
      });
    } catch (error) {
      logger.error('Failed to create terminal:', error);
      socket.emit('terminal-error', { message: 'Failed to create terminal', error: error.message });
    }
  });

  // SSH Connection management
  socket.on('get-ssh-connections', () => {
    const connections = database.getSshConnections(socket.userId);
    socket.emit('ssh-connections', connections);
  });

  socket.on('create-ssh-connection', (data) => {
    try {
      // Check if an identical connection already exists (deduplicate)
      const existing = database.findSshConnectionByHostUser(socket.userId, data.host, data.port || 22, data.username);
      let conn;
      if (existing) {
        conn = existing;
      } else {
        conn = database.createSshConnection(
          socket.userId, data.name, data.host, data.port,
          data.username, data.authType, data.password, data.privateKey
        );
      }
      // Cache password encrypted in DB
      cachePassword(socket.userId, 'ssh', data.host, data.port || 22, data.username, data.password, data.fromVault ? 'vault' : 'local', data.vaultItemId);
      socket.emit('ssh-connection-created', conn);
      socket.emit('ssh-connections', database.getSshConnections(socket.userId));
    } catch (error) {
      socket.emit('ssh-error', { message: 'Failed to create SSH connection', error: error.message });
    }
  });

  socket.on('delete-ssh-connection', (data) => {
    const deleted = database.deleteSshConnection(data.id, socket.userId);
    if (deleted) {
      socket.emit('ssh-connections', database.getSshConnections(socket.userId));
    }
  });

  socket.on('update-ssh-connection', (data) => {
    try {
      database.db.prepare('UPDATE ssh_connections SET name=?, host=?, port=?, username=? WHERE id=? AND user_id=?')
        .run(data.name, data.host, data.port || 22, data.username, data.id, socket.userId);
      if (data.password) cachePassword(socket.userId, 'ssh', data.host, data.port || 22, data.username, data.password, 'local', null);
      socket.emit('ssh-connections', database.getSshConnections(socket.userId));
    } catch (e) {}
  });

  socket.on('update-rdp-connection', (data) => {
    try {
      database.db.prepare('UPDATE rdp_connections SET name=?, host=?, port=?, username=? WHERE id=? AND user_id=?')
        .run(data.name, data.host, data.port || 3389, data.username, data.id, socket.userId);
      if (data.password) cachePassword(socket.userId, 'rdp', data.host, data.port || 3389, data.username, data.password, 'local', null);
      socket.emit('rdp-connections', database.getRdpConnections(socket.userId));
    } catch (e) {}
  });

  socket.on('update-vnc-connection', (data) => {
    try {
      database.db.prepare('UPDATE vnc_connections SET name=?, host=?, port=? WHERE id=? AND user_id=?')
        .run(data.name, data.host, data.port || 5900, data.id, socket.userId);
      if (data.password) cachePassword(socket.userId, 'vnc', data.host, data.port || 5900, '', data.password, 'local', null);
      socket.emit('vnc-connections', database.getVncConnections(socket.userId));
    } catch (e) {}
  });

  // RDP Connection management
  socket.on('get-rdp-connections', () => {
    socket.emit('rdp-connections', database.getRdpConnections(socket.userId));
  });

  socket.on('create-rdp-connection', (data) => {
    try {
      const conn = database.createRdpConnection(
        socket.userId, data.name, data.host, data.port,
        data.username, data.password, data.domain
      );
      // Cache password encrypted in DB
      cachePassword(socket.userId, 'rdp', data.host, data.port || 3389, data.username, data.password, data.fromVault ? 'vault' : 'local', data.vaultItemId);
      socket.emit('rdp-connection-created', conn);
      socket.emit('rdp-connections', database.getRdpConnections(socket.userId));
    } catch (error) {
      socket.emit('rdp-error', { message: 'Failed to create RDP connection', error: error.message });
    }
  });

  socket.on('delete-rdp-connection', (data) => {
    const deleted = database.deleteRdpConnection(data.id, socket.userId);
    if (deleted) {
      socket.emit('rdp-connections', database.getRdpConnections(socket.userId));
    }
  });

  socket.on('create-rdp-token', (data) => {
    try {
      let rdpConfig;
      if (data.rdpConnectionId) {
        const conn = database.getRdpConnection(data.rdpConnectionId);
        if (!conn || conn.user_id !== socket.userId) {
          socket.emit('rdp-error', { message: 'RDP connection not found' });
          return;
        }
        rdpConfig = conn;
        // Retrieve cached password if not stored in DB
        if (!rdpConfig.password) {
          rdpConfig.password = getCachedPassword(socket.userId, 'rdp', conn.host, conn.port, conn.username);
        }
      } else {
        rdpConfig = { host: data.host, port: data.port, username: data.username, password: data.password, domain: data.domain };
        // Cache the password for future use
        cachePassword(socket.userId, 'rdp', data.host, data.port || 3389, data.username, data.password, data.fromVault ? 'vault' : 'local', data.vaultItemId);
      }

      rdpConfig._userId = socket.userId;
      rdpConfig._keyboardLayout = data.keyboardLayout || null;
      const token = guacamoleManager.createToken(rdpConfig);
      const rid = data.requestId || '';
      socket.emit(`rdp-token-created-${rid}`, {
        token,
        wsPort: guacamoleManager.guacPort || 4823
      });
    } catch (error) {
      logger.error('Failed to create RDP token:', error);
      const rid = data.requestId || '';
      socket.emit(`rdp-error-${rid}`, { message: 'Failed to create RDP token', error: error.message });
    }
  });

  // VNC Connection management
  socket.on('get-vnc-connections', () => {
    socket.emit('vnc-connections', database.getVncConnections(socket.userId));
  });

  socket.on('create-vnc-connection', (data) => {
    try {
      const conn = database.createVncConnection(
        socket.userId, data.name, data.host, data.port, data.password
      );
      // Cache password encrypted in DB
      cachePassword(socket.userId, 'vnc', data.host, data.port || 5900, '', data.password, data.fromVault ? 'vault' : 'local', data.vaultItemId);
      socket.emit('vnc-connection-created', conn);
      socket.emit('vnc-connections', database.getVncConnections(socket.userId));
    } catch (error) {
      socket.emit('vnc-error', { message: 'Failed to create VNC connection', error: error.message });
    }
  });

  socket.on('delete-vnc-connection', (data) => {
    const deleted = database.deleteVncConnection(data.id, socket.userId);
    if (deleted) {
      socket.emit('vnc-connections', database.getVncConnections(socket.userId));
    }
  });

  socket.on('create-vnc-token', (data) => {
    try {
      let vncConfig;
      if (data.vncConnectionId) {
        const conn = database.getVncConnection(data.vncConnectionId);
        if (!conn || conn.user_id !== socket.userId) {
          socket.emit('vnc-error', { message: 'VNC connection not found' });
          return;
        }
        vncConfig = conn;
        // Retrieve cached password if not stored in DB
        if (!vncConfig.password) {
          vncConfig.password = getCachedPassword(socket.userId, 'vnc', conn.host, conn.port, '');
        }
      } else {
        vncConfig = { host: data.host, port: data.port, password: data.password };
        // Cache the password for future use
        cachePassword(socket.userId, 'vnc', data.host, data.port || 5900, '', data.password, data.fromVault ? 'vault' : 'local', data.vaultItemId);
      }

      vncConfig._type = 'vnc';
      vncConfig._userId = socket.userId;
      const token = guacamoleManager.createToken(vncConfig);
      const rid = data.requestId || '';
      socket.emit(`vnc-token-created-${rid}`, { token });
    } catch (error) {
      logger.error('Failed to create VNC token:', error);
      const rid = data.requestId || '';
      socket.emit(`vnc-error-${rid}`, { message: 'Failed to create VNC token', error: error.message });
    }
  });

  socket.on('restore-terminal', async (data) => {
    try {
      const sessionId = data.sessionId || `ws_${socket.userId}`;

      // Get SSH config if this was an SSH terminal
      let sshConfig = null;
      if (data.sshConnectionId) {
        const conn = database.getSshConnection(data.sshConnectionId);
        if (conn && conn.user_id === socket.userId) {
          sshConfig = {
            host: conn.host, port: conn.port, username: conn.username,
            authType: conn.auth_type, password: getCachedPassword(socket.userId, 'ssh', conn.host, conn.port, conn.username) || conn.password || null, privateKey: conn.private_key
          };
        }
      }

      const terminal = await ttydManager.restoreTerminal(
        data.terminalId,
        socket.userId,
        sessionId,
        data.rows || 24,
        data.cols || 80,
        sshConfig
      );
      if (terminal && terminal.userId === socket.userId) {
        socket.emit('terminal-restored', {
          terminalId: terminal.id,
          sessionId: sessionId
        });
      } else {
        socket.emit('terminal-error', { message: 'Terminal not found', terminalId: data.terminalId });
      }
    } catch (error) {
      logger.error('Error restoring terminal:', error);
      socket.emit('terminal-error', { message: 'Failed to restore terminal', error: error.message });
    }
  });

  // Check if terminal had auth failure
  socket.on('check-terminal-auth', (data) => {
    const terminal = ttydManager.getTerminal(data.terminalId);
    if (terminal && terminal._authFailed) {
      socket.emit('terminal-auth-failed', { terminalId: data.terminalId });
    }
  });

  // Retry SSH with new password
  socket.on('retry-ssh-connection', async (data) => {
    try {
      const { terminalId, sshConnectionId, password } = data;
      // Close old terminal
      const oldTerminal = ttydManager.getTerminal(terminalId);
      if (oldTerminal) ttydManager.closeTerminal(terminalId);

      // Get SSH config
      const conn = database.getSshConnection(sshConnectionId);
      if (!conn || conn.user_id !== socket.userId) {
        socket.emit('terminal-error', { message: 'Connection not found' });
        return;
      }

      // Cache new password
      cachePassword(socket.userId, 'ssh', conn.host, conn.port, conn.username, password, 'local', null);

      const sshConfig = {
        host: conn.host, port: conn.port, username: conn.username,
        authType: 'password', password: password, privateKey: conn.private_key
      };

      const sessionId = `ws_${socket.userId}`;
      const terminal = await ttydManager.createTerminal(socket.userId, sessionId, 24, 80, null, sshConfig);
      const rid = data.requestId || '';
      socket.emit(rid ? `terminal-created-${rid}` : 'terminal-created', {
        terminalId: terminal.id, sessionId
      });
    } catch (error) {
      socket.emit('terminal-error', { message: 'Failed to retry SSH', error: error.message });
    }
  });

  // Scroll terminal history via tmux copy-mode
  socket.on('terminal-scroll', async (data) => {
    try {
      const terminal = ttydManager.getTerminal(data.terminalId);
      if (terminal && terminal.userId === socket.userId && terminal.tmuxSessionName) {
        const { execSync } = require('child_process');
        const sess = terminal.tmuxSessionName;
        if (data.direction === 'up') {
          execSync(`tmux -L muxterm copy-mode -t ${sess} 2>/dev/null; tmux -L muxterm send-keys -t ${sess} -X page-up`, { timeout: 2000 });
        } else if (data.direction === 'down') {
          execSync(`tmux -L muxterm send-keys -t ${sess} -X page-down 2>/dev/null || true`, { timeout: 2000 });
        } else if (data.direction === 'exit') {
          execSync(`tmux -L muxterm send-keys -t ${sess} -X cancel 2>/dev/null || true`, { timeout: 2000 });
        }
      }
    } catch (error) {
      logger.debug('Scroll error:', error.message);
    }
  });

  // Send keys via tmux (for SpecialKeysToolbar on mobile)
  socket.on('send-keys', async (data) => {
    try {
      const terminal = ttydManager.getTerminal(data.terminalId);
      if (terminal && terminal.userId === socket.userId) {
        ttydManager.sendKeys(data.terminalId, data.keys);
      }
    } catch (error) {
      logger.error('Error sending keys:', error);
    }
  });

  socket.on('close-terminal', async (data) => {
    try {
      const terminal = ttydManager.getTerminal(data.terminalId);
      if (terminal && terminal.userId === socket.userId) {
        ttydManager.closeTerminal(data.terminalId);
        database.deleteTerminalByUser(data.terminalId, socket.userId);
      }
    } catch (error) {
      logger.error('Failed to close terminal:', error);
    }
  });

  socket.on('disconnect', () => {
    logger.info(`User ${socket.username} disconnected`);
  });
});

const PORT = process.env.PORT || 3002;
// Initialize Guacamole proxy for RDP (separate WebSocket port)
guacamoleManager.init();

server.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  
  // Initialize tmux
  const hasTmux = await tmuxManager.checkTmux();
  if (!hasTmux) {
    logger.error('WARNING: tmux not installed. Sessions will not persist!');
  }

  // Clean up orphaned ttyd processes (but NOT tmux sessions on startup — they may reconnect)
  if (hasTmux) {
    ttydManager.cleanupOrphanedProcesses();
    // Delay tmux cleanup to allow workspace reconnections after restart
    setTimeout(() => {
      ttydManager.cleanupOrphanedTmuxSessions();
      // Run periodic cleanup every 30 minutes
      setInterval(() => ttydManager.cleanupOrphanedTmuxSessions(), 30 * 60 * 1000);
    }, 10 * 60 * 1000); // 10 minutes grace period
  }
  
  // Migrate plaintext passwords to encrypted cache
  try {
    const rdpConns = database.db.prepare('SELECT id, user_id, host, port, username, password FROM rdp_connections WHERE password IS NOT NULL').all();
    for (const conn of rdpConns) {
      cachePassword(conn.user_id, 'rdp', conn.host, conn.port || 3389, conn.username, conn.password, 'local', null);
    }
    database.db.prepare('UPDATE rdp_connections SET password = NULL WHERE password IS NOT NULL').run();

    const vncConns = database.db.prepare('SELECT id, user_id, host, port, password FROM vnc_connections WHERE password IS NOT NULL').all();
    for (const conn of vncConns) {
      cachePassword(conn.user_id, 'vnc', conn.host, conn.port || 5900, '', conn.password, 'local', null);
    }
    database.db.prepare('UPDATE vnc_connections SET password = NULL WHERE password IS NOT NULL').run();

    // Also clean any remaining SSH plaintext passwords
    database.db.prepare('UPDATE ssh_connections SET password = NULL WHERE password IS NOT NULL').run();
  } catch (e) {
    // Migration errors are non-fatal
  }

  // Create default admin user if no users exist
  const users = database.getAllUsers();
  if (!users || users.length === 0) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('admin', 10);
    const user = database.createUser('admin', hashedPassword);
    if (user) {
      // Mark as must change password on first login
      try { database.db.prepare('UPDATE users SET must_change_password = 1 WHERE id = ?').run(user.id); } catch (e) {}
      logger.info('Default admin user created: username=admin, password=admin');
      logger.info('⚠️  Password change required on first login');
    }
  } else if (process.env.NODE_ENV !== 'production') {
    // In development, always ensure admin user exists
    const adminUser = database.findUserByUsername('admin');
    if (!adminUser) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync('admin', 10);
      const user = database.createUser('admin', hashedPassword);
      if (user) {
        console.log('Admin user created for development');
      }
    }
  }
});