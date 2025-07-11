const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(path.join(dataDir, 'webssh.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    tmux_session TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS session_layouts (
    session_id TEXT PRIMARY KEY,
    layout TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS terminals (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    panel_id TEXT NOT NULL,
    tmux_window INTEGER,
    tmux_pane TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_terminals_session_id ON terminals(session_id);
`);

// Prepared statements
const statements = {
  // Users
  createUser: db.prepare('INSERT INTO users (username, password) VALUES (?, ?)'),
  findUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  getAllUsers: db.prepare('SELECT id, username FROM users'),
  
  // Sessions
  createSession: db.prepare('INSERT INTO sessions (id, user_id, name, tmux_session) VALUES (?, ?, ?, ?)'),
  updateSessionAccess: db.prepare('UPDATE sessions SET last_accessed = CURRENT_TIMESTAMP WHERE id = ?'),
  updateSessionName: db.prepare('UPDATE sessions SET name = ? WHERE id = ?'),
  findSessionById: db.prepare('SELECT * FROM sessions WHERE id = ?'),
  findSessionsByUserId: db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY last_accessed DESC'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
  
  // Session layouts
  upsertLayout: db.prepare(`
    INSERT INTO session_layouts (session_id, layout) VALUES (?, ?)
    ON CONFLICT(session_id) DO UPDATE SET layout = excluded.layout, updated_at = CURRENT_TIMESTAMP
  `),
  findLayoutBySessionId: db.prepare('SELECT * FROM session_layouts WHERE session_id = ?'),
  
  // Terminals
  createTerminal: db.prepare('INSERT INTO terminals (id, session_id, panel_id, tmux_window, tmux_pane) VALUES (?, ?, ?, ?, ?)'),
  findTerminalById: db.prepare('SELECT * FROM terminals WHERE id = ?'),
  findTerminalsBySessionId: db.prepare('SELECT * FROM terminals WHERE session_id = ?'),
  deleteTerminal: db.prepare('DELETE FROM terminals WHERE id = ?'),
  deleteTerminalsBySessionId: db.prepare('DELETE FROM terminals WHERE session_id = ?')
};

// Helper functions
const dbHelpers = {
  // Users
  createUser(username, hashedPassword) {
    try {
      const result = statements.createUser.run(username, hashedPassword);
      return { id: result.lastInsertRowid, username };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return null;
      }
      throw error;
    }
  },

  findUserByUsername(username) {
    return statements.findUserByUsername.get(username);
  },
  
  getAllUsers() {
    return statements.getAllUsers.all();
  },

  // Sessions
  createSession(sessionId, userId, name, tmuxSession) {
    statements.createSession.run(sessionId, userId, name, tmuxSession);
    return sessionId;
  },

  updateSessionAccess(sessionId) {
    statements.updateSessionAccess.run(sessionId);
  },
  
  updateSessionName(sessionId, newName) {
    const result = statements.updateSessionName.run(newName, sessionId);
    return result.changes > 0;
  },

  findSessionById(sessionId) {
    return statements.findSessionById.get(sessionId);
  },

  findSessionsByUserId(userId) {
    return statements.findSessionsByUserId.all(userId);
  },

  deleteSession(sessionId) {
    const deleteTerminals = db.transaction(() => {
      statements.deleteTerminalsBySessionId.run(sessionId);
      statements.deleteSession.run(sessionId);
    });
    deleteTerminals();
  },

  // Layouts
  saveLayout(sessionId, layout) {
    statements.upsertLayout.run(sessionId, JSON.stringify(layout));
  },

  getLayout(sessionId) {
    const row = statements.findLayoutBySessionId.get(sessionId);
    return row ? JSON.parse(row.layout) : null;
  },

  // Terminals
  createTerminal(terminalId, sessionId, panelId, tmuxWindow = null, tmuxPane = null) {
    statements.createTerminal.run(terminalId, sessionId, panelId, tmuxWindow, tmuxPane);
    return terminalId;
  },

  findTerminalById(terminalId) {
    return statements.findTerminalById.get(terminalId);
  },

  findTerminalsBySessionId(sessionId) {
    return statements.findTerminalsBySessionId.all(sessionId);
  },

  deleteTerminal(terminalId) {
    statements.deleteTerminal.run(terminalId);
  }
};

module.exports = { db, ...dbHelpers };