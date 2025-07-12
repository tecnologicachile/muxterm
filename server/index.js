require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./auth');
const terminalManager = require('./terminal');
const sessionManager = require('./session');
const database = require('../db/database');
const tmuxManager = require('../utils/tmuxManager');
const logger = require('./utils/logger');
const tracer = require('./utils/persistenceTracer');
const updateChecker = require('./update-checker');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? false 
      : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3003'],
    credentials: true
  }
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
    const jwt = require('jsonwebtoken');
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
    // Check if auto-update script exists
    const updateScriptPath = path.join(__dirname, '..', 'update-auto.sh');
    if (!fs.existsSync(updateScriptPath)) {
      return res.status(404).json({ error: 'Update script not found' });
    }
    
    // Check if there's actually an update available
    const updateInfo = await updateChecker.checkForUpdates(true);
    if (!updateInfo) {
      return res.status(400).json({ error: 'No update available' });
    }
    
    logger.info(`Update initiated by user ${req.user.username} from ${updateInfo.current} to ${updateInfo.latest}`);
    
    // Execute update in background
    const { spawn } = require('child_process');
    const updateProcess = spawn('/bin/bash', [updateScriptPath], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' } // Disable color output for logs
    });
    
    // Collect output for logging
    let output = '';
    let errorOutput = '';
    
    updateProcess.stdout.on('data', (data) => {
      output += data.toString();
      logger.info('[Update]', data.toString().trim());
    });
    
    updateProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      logger.error('[Update Error]', data.toString().trim());
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

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const user = await sessionManager.validateToken(token);
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
  
  // Store terminal data listeners for cleanup
  socket.terminalListeners = new Map();
  
  // Check if there's a session layout stored for this user
  const userSessions = sessionManager.getUserSessions(socket.userId);
  
  // If user has sessions, emit them. Otherwise check for default session
  if (userSessions.length > 0) {
    logger.debug(`Sending ${userSessions.length} existing sessions for user ${socket.username}`);
    socket.emit('sessions', userSessions);
  } else {
    // Check if we should send the last active session layout
    const lastLayout = socket.handshake.query.sessionId ? 
      sessionManager.getSession(socket.userId, socket.handshake.query.sessionId) : null;
      
    if (lastLayout) {
      logger.debug('Sending session layout:', lastLayout.layout);
      socket.emit('session-layout', {
        sessionId: lastLayout.id,
        layout: lastLayout.layout
      });
    } else {
      logger.debug('Sending session layout:', { type: 'single', panels: [], activePanel: null });
      socket.emit('session-layout', {
        sessionId: null,
        layout: { type: 'single', panels: [], activePanel: null }
      });
    }
  }

  // Handle get-sessions request
  socket.on('get-sessions', () => {
    const sessions = sessionManager.getUserSessions(socket.userId);
    logger.debug(`get-sessions requested, returning ${sessions.length} sessions`);
    socket.emit('sessions', sessions);
  });

  socket.on('create-terminal', async (data) => {
    try {
      const terminal = await terminalManager.createTerminal(
        socket.userId,
        data.sessionId,
        data.rows || 24,
        data.cols || 80
      );

      socket.join(`terminal-${terminal.id}`);
      
      // Store the listener reference for cleanup
      const removeListener = terminal.onData((data) => {
        socket.emit('terminal-output', {
          terminalId: terminal.id,
          data: data
        });
      });
      socket.terminalListeners.set(terminal.id, removeListener);

      logger.debug('Terminal created:', terminal.id, 'for session:', data.sessionId);
      socket.emit('terminal-created', {
        terminalId: terminal.id,
        sessionId: data.sessionId
      });
      
      // Terminal is already saved in terminalManager.createTerminal
      logger.debug('Terminal successfully created and saved');
    } catch (error) {
      socket.emit('terminal-error', {
        message: 'Failed to create terminal',
        error: error.message
      });
    }
  });

  socket.on('restore-terminal', async (data) => {
    try {
      logger.debug('Restoring terminal:', data.terminalId);
      
      // SIEMPRE llamar a restoreTerminal para manejar la captura de buffer
      const cols = data.cols || 80;
      const rows = data.rows || 24;
      const terminal = await terminalManager.restoreTerminal(data.terminalId, socket.userId, data.sessionId, rows, cols);
      
      if (terminal && terminal.userId === socket.userId) {
        socket.join(`terminal-${terminal.id}`);
        
        // Remove old listener if exists
        const oldListener = socket.terminalListeners.get(terminal.id);
        if (oldListener) {
          oldListener(); // This calls the remove function
        }
        
        // Attach new data listener
        const removeListener = terminal.onData((output) => {
          socket.emit('terminal-output', {
            terminalId: terminal.id,
            data: output
          });
        });
        socket.terminalListeners.set(terminal.id, removeListener);
        
        // Con tmux, no necesitamos enviar el buffer ya que tmux mantiene el estado
        // Solo enviamos una señal de que el terminal fue restaurado
        socket.emit('terminal-restored', {
          terminalId: terminal.id,
          sessionId: data.sessionId
        });
        
        // Terminal restaurada - tmux ya está configurado desde el archivo .tmux.webssh.conf
        tracer.trace('CLIENT', 'SESSION_RESTORED', {
          terminalId: terminal.id,
          sessionId: data.sessionId,
          note: 'Terminal restored with tmux config'
        });
        
        logger.debug('Terminal restored successfully:', data.terminalId);
        
        // Forzar un resize para actualizar el contenido y adaptarse al nuevo cliente
        if (data.cols && data.rows) {
          // Primero hacer resize
          terminal.resize(data.cols, data.rows);
          logger.debug(`Resized terminal to ${data.cols}x${data.rows}`);
          
          // Luego forzar un redraw completo
          setTimeout(() => {
            terminal.write('\x1b[2J\x1b[H'); // Clear and reset
            terminal.write('\x0c'); // Form feed para refrescar
            logger.debug('Forced redraw after resize');
          }, 400);
        }
      } else {
        logger.info('Terminal not found and could not be restored:', data.terminalId);
        socket.emit('terminal-error', {
          message: 'Terminal not found',
          terminalId: data.terminalId
        });
      }
    } catch (error) {
      logger.error('Error restoring terminal:', error);
      socket.emit('terminal-error', {
        message: 'Failed to restore terminal',
        error: error.message
      });
    }
  });

  socket.on('terminal-input', async (data) => {
    logger.debug('Received terminal input:', data.terminalId, 'input:', data.input);
    // Debug auto-yes inputs
    if (data.input === '1\r' || data.input === '\r' || data.input === '1') {
      logger.debug(`[Auto-Yes Debug] Received auto-yes input: "${data.input}" for terminal: ${data.terminalId}`);
    }
    try {
      const terminal = terminalManager.getTerminal(data.terminalId);
      if (terminal && terminal.userId === socket.userId) {
        logger.debug('Writing to terminal:', data.terminalId);
        terminal.write(data.input);
      } else {
        logger.debug('Terminal not found or user mismatch:', data.terminalId, socket.userId);
      }
    } catch (error) {
      logger.error('Error writing to terminal:', error);
      socket.emit('terminal-error', {
        message: 'Failed to write to terminal',
        error: error.message
      });
    }
  });

  socket.on('resize-terminal', async (data) => {
    try {
      const terminal = terminalManager.getTerminal(data.terminalId);
      if (terminal && terminal.userId === socket.userId) {
        terminal.resize(data.cols, data.rows);
      }
    } catch (error) {
      socket.emit('terminal-error', {
        message: 'Failed to resize terminal',
        error: error.message
      });
    }
  });

  socket.on('close-terminal', async (data) => {
    try {
      const terminal = terminalManager.getTerminal(data.terminalId);
      if (terminal && terminal.userId === socket.userId) {
        terminalManager.closeTerminal(data.terminalId);
        socket.leave(`terminal-${data.terminalId}`);
        await sessionManager.removeTerminalFromSession(
          socket.userId,
          data.sessionId,
          data.terminalId
        );
      }
    } catch (error) {
      socket.emit('terminal-error', {
        message: 'Failed to close terminal',
        error: error.message
      });
    }
  });

  socket.on('restore-session', async (data) => {
    try {
      const session = await sessionManager.getSession(socket.userId, data.sessionId);
      if (session) {
        for (const terminalId of session.terminals) {
          const terminal = terminalManager.getTerminal(terminalId);
          if (terminal) {
            socket.join(`terminal-${terminalId}`);
            socket.emit('terminal-restored', {
              terminalId: terminalId,
              sessionId: data.sessionId
            });
          }
        }
      }
    } catch (error) {
      socket.emit('session-error', {
        message: 'Failed to restore session',
        error: error.message
      });
    }
  });

  // Handle layout requests
  socket.on('get-session-layout', async (data) => {
    try {
      const session = await sessionManager.getSession(socket.userId, data.sessionId);
      if (session) {
        logger.debug('Sending session layout:', session.layout);
        socket.emit('session-layout', {
          sessionId: data.sessionId,
          layout: session.layout
        });
      }
    } catch (error) {
      logger.error('Failed to get session layout:', error);
    }
  });

  // Handle layout updates
  socket.on('update-session-layout', async (data) => {
    try {
      logger.debug('Updating session layout:', data.sessionId, data.layout);
      await sessionManager.updateSessionLayout(socket.userId, data.sessionId, data.layout);
    } catch (error) {
      logger.error('Failed to update session layout:', error);
    }
  });
  
  // Handle session name update
  socket.on('update-session-name', async (data) => {
    try {
      const updated = await sessionManager.updateSessionName(socket.userId, data.sessionId, data.name);
      if (updated) {
        socket.emit('session-name-updated', { sessionId: data.sessionId, name: data.name });
        // Update all connected clients
        socket.emit('sessions', sessionManager.getUserSessions(socket.userId));
      }
    } catch (error) {
      logger.error('Failed to update session name:', error);
    }
  });
  
  // Handle session deletion
  socket.on('delete-session', async (data) => {
    try {
      const deleted = await sessionManager.deleteSession(socket.userId, data.sessionId);
      if (deleted) {
        socket.emit('session-deleted', { sessionId: data.sessionId });
        socket.emit('sessions', sessionManager.getUserSessions(socket.userId));
      }
    } catch (error) {
      logger.error('Failed to delete session:', error);
    }
  });
  
  // Handle delete all sessions
  socket.on('delete-all-sessions', async () => {
    try {
      const count = await sessionManager.deleteAllUserSessions(socket.userId);
      socket.emit('all-sessions-deleted', { count });
      socket.emit('sessions', []);
    } catch (error) {
      logger.error('Failed to delete all sessions:', error);
    }
  });
  
  // Create session with name
  socket.on('create-session', async (data) => {
    logger.debug('Received create-session request:', data);
    try {
      const session = await sessionManager.createSession(socket.userId, data.name);
      logger.debug('Session created:', session);
      socket.emit('session-created', { 
        sessionId: session.id, 
        name: session.name 
      });
      socket.emit('sessions', sessionManager.getUserSessions(socket.userId));
    } catch (error) {
      logger.error('Failed to create session:', error);
      socket.emit('session-error', { 
        message: 'Failed to create session', 
        error: error.message 
      });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`User ${socket.username} disconnected`);
    
    // Clean up all terminal listeners
    if (socket.terminalListeners) {
      socket.terminalListeners.forEach((removeListener) => {
        if (removeListener) {
          removeListener();
        }
      });
      socket.terminalListeners.clear();
    }
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  
  // Initialize tmux
  const hasTmux = await tmuxManager.checkTmux();
  if (!hasTmux) {
    logger.error('WARNING: tmux not installed. Sessions will not persist!');
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