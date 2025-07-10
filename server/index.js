require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const session = require('express-session');
// const redis = require('redis');
// const RedisStore = require('connect-redis').default;
const path = require('path');

const authRoutes = require('./auth');
const terminalManager = require('./terminal');
const sessionManager = require('./session');
const database = require('../db/database');
const tmuxManager = require('../utils/tmuxManager');

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

// Redis temporarily disabled for testing
const redisClient = null;

// Fallback in-memory session store
const sessionStore = new Map();

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
  console.log(`User ${socket.username} connected`);
  
  // Store terminal data listeners for cleanup
  socket.terminalListeners = new Map();
  
  // Check if there's a session layout stored for this user
  const userSessions = sessionManager.getUserSessions(socket.userId);
  
  // If user has sessions, emit them. Otherwise check for default session
  if (userSessions.length > 0) {
    console.log(`Sending ${userSessions.length} existing sessions for user ${socket.username}`);
    socket.emit('sessions', userSessions);
  } else {
    // Check if we should send the last active session layout
    const lastLayout = socket.handshake.query.sessionId ? 
      sessionManager.getSession(socket.userId, socket.handshake.query.sessionId) : null;
      
    if (lastLayout) {
      console.log('Sending session layout:', lastLayout.layout);
      socket.emit('session-layout', {
        sessionId: lastLayout.id,
        layout: lastLayout.layout
      });
    } else {
      console.log('Sending session layout:', { type: 'single', panels: [], activePanel: null });
      socket.emit('session-layout', {
        sessionId: null,
        layout: { type: 'single', panels: [], activePanel: null }
      });
    }
  }

  // Handle get-sessions request
  socket.on('get-sessions', () => {
    const sessions = sessionManager.getUserSessions(socket.userId);
    console.log(`get-sessions requested, returning ${sessions.length} sessions`);
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

      console.log('Terminal created:', terminal.id, 'for session:', data.sessionId);
      socket.emit('terminal-created', {
        terminalId: terminal.id,
        sessionId: data.sessionId
      });

      await sessionManager.saveSession(socket.userId, data.sessionId, terminal.id);
    } catch (error) {
      socket.emit('terminal-error', {
        message: 'Failed to create terminal',
        error: error.message
      });
    }
  });

  socket.on('restore-terminal', async (data) => {
    try {
      console.log('Restoring terminal:', data.terminalId);
      let terminal = terminalManager.getTerminal(data.terminalId);
      
      // Si no existe el terminal, intentar restaurarlo desde tmux
      if (!terminal) {
        console.log('Terminal not found, attempting to restore from tmux...');
        const cols = data.cols || 80;
        const rows = data.rows || 24;
        terminal = await terminalManager.restoreTerminal(data.terminalId, socket.userId, data.sessionId, rows, cols);
      }
      
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
        
        console.log('Terminal restored successfully:', data.terminalId);
        
        // Forzar un resize para actualizar el contenido
        if (data.cols && data.rows) {
          terminal.resize(data.cols, data.rows);
        }
      } else {
        console.log('Terminal not found and could not be restored:', data.terminalId);
        socket.emit('terminal-error', {
          message: 'Terminal not found',
          terminalId: data.terminalId
        });
      }
    } catch (error) {
      console.error('Error restoring terminal:', error);
      socket.emit('terminal-error', {
        message: 'Failed to restore terminal',
        error: error.message
      });
    }
  });

  socket.on('terminal-input', async (data) => {
    console.log('Received terminal input:', data.terminalId, 'input:', data.input);
    try {
      const terminal = terminalManager.getTerminal(data.terminalId);
      if (terminal && terminal.userId === socket.userId) {
        console.log('Writing to terminal:', data.terminalId);
        terminal.write(data.input);
      } else {
        console.log('Terminal not found or user mismatch:', data.terminalId, socket.userId);
      }
    } catch (error) {
      console.error('Error writing to terminal:', error);
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
        console.log('Sending session layout:', session.layout);
        socket.emit('session-layout', {
          sessionId: data.sessionId,
          layout: session.layout
        });
      }
    } catch (error) {
      console.error('Failed to get session layout:', error);
    }
  });

  // Handle layout updates
  socket.on('update-session-layout', async (data) => {
    try {
      console.log('Updating session layout:', data.sessionId, data.layout);
      await sessionManager.updateSessionLayout(socket.userId, data.sessionId, data.layout);
    } catch (error) {
      console.error('Failed to update session layout:', error);
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
      console.error('Failed to update session name:', error);
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
      console.error('Failed to delete session:', error);
    }
  });
  
  // Handle delete all sessions
  socket.on('delete-all-sessions', async () => {
    try {
      const count = await sessionManager.deleteAllUserSessions(socket.userId);
      socket.emit('all-sessions-deleted', { count });
      socket.emit('sessions', []);
    } catch (error) {
      console.error('Failed to delete all sessions:', error);
    }
  });
  
  // Create session with name
  socket.on('create-session', async (data) => {
    try {
      const session = await sessionManager.createSession(socket.userId, data.name);
      socket.emit('session-created', { 
        sessionId: session.id, 
        name: session.name 
      });
      socket.emit('sessions', sessionManager.getUserSessions(socket.userId));
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.username} disconnected`);
    
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
  console.log(`Server running on port ${PORT}`);
  
  // Initialize tmux
  const hasTmux = await tmuxManager.checkTmux();
  if (!hasTmux) {
    console.warn('WARNING: tmux not installed. Sessions will not persist!');
  }
  
  // Create test user for development
  if (process.env.NODE_ENV !== 'production') {
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('test123', 10);
    const user = database.createUser('test', hashedPassword);
    if (user) {
      console.log('Test user created: username=test, password=test123');
    } else {
      console.log('Test user already exists');
    }
  }
});