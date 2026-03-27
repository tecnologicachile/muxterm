require('dotenv').config();
const express = require('express');
const http = require('http');
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

const app = express();
const server = http.createServer(app);

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

// Update check endpoint
app.get('/api/update-check', async (req, res) => {
  // Force check if manual=true query param
  const forceCheck = req.query.manual === 'true';
  const updateInfo = await updateChecker.checkForUpdates(forceCheck);
  res.json({ update: updateInfo });
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
    
    // Check if muxterm command exists
    const muxTermCommand = '/usr/local/bin/muxterm';
    if (!fs.existsSync(muxTermCommand)) {
      logger.error('muxterm command not found at /usr/local/bin/muxterm');
      return res.status(500).json({ error: 'muxterm command not found' });
    }
    
    logger.info(`Update initiated by user ${req.user.username} from ${updateInfo.current} to ${updateInfo.latest}`);
    
    // Execute update in background using muxterm update command
    const { spawn } = require('child_process');
    
    // Create a script to run muxterm update with auto-yes
    // First cd to the muxterm directory to ensure we're in the right place
    const muxTermDir = path.join(__dirname, '..');
    
    // Instead of calling muxterm command which detects service environment,
    // call the update-independent.sh script directly if it exists
    const updateIndependentScript = path.join(muxTermDir, 'scripts', 'update-independent.sh');
    let updateCommand;
    
    if (fs.existsSync(updateIndependentScript)) {
      updateCommand = `${updateIndependentScript} "${muxTermDir}"`;
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
  
  if (fs.existsSync(publicPath) && fs.existsSync(path.join(publicPath, 'index.html'))) {
    app.use(express.static(publicPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
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
            password: conn.password,
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
      socket.emit('terminal-created', {
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
      const conn = database.createSshConnection(
        socket.userId, data.name, data.host, data.port,
        data.username, data.authType, data.password, data.privateKey
      );
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
      } else {
        rdpConfig = { host: data.host, port: data.port, username: data.username, password: data.password, domain: data.domain };
      }

      const token = guacamoleManager.createToken(rdpConfig);
      const wsProtocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
      socket.emit('rdp-token-created', {
        token,
        wsUrl: `/guacamole/`
      });
    } catch (error) {
      logger.error('Failed to create RDP token:', error);
      socket.emit('rdp-error', { message: 'Failed to create RDP token', error: error.message });
    }
  });

  socket.on('restore-terminal', async (data) => {
    try {
      const sessionId = data.sessionId || `ws_${socket.userId}`;
      const terminal = await ttydManager.restoreTerminal(
        data.terminalId,
        socket.userId,
        sessionId,
        data.rows || 24,
        data.cols || 80
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
// Initialize Guacamole proxy for RDP
guacamoleManager.init(server);

server.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  
  // Initialize tmux
  const hasTmux = await tmuxManager.checkTmux();
  if (!hasTmux) {
    logger.error('WARNING: tmux not installed. Sessions will not persist!');
  }

  // Clean up orphaned ttyd processes and tmux sessions
  if (hasTmux) {
    ttydManager.cleanupOrphanedProcesses();
    ttydManager.cleanupOrphanedTmuxSessions();
  }
  
  // Create default user if no users exist
  const users = database.getAllUsers();
  if (!users || users.length === 0) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('test123', 10);
    const user = database.createUser('test', hashedPassword);
    if (user) {
      logger.info('Default user created: username=test, password=test123');
      logger.info('⚠️  IMPORTANT: Change the default password or create a new user!');
    }
  } else if (process.env.NODE_ENV !== 'production') {
    // In development, always ensure test user exists
    const testUser = database.findUserByUsername('test');
    if (!testUser) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync('test123', 10);
      const user = database.createUser('test', hashedPassword);
      if (user) {
        console.log('Test user created for development');
      }
    }
  }
});