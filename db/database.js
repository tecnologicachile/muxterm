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

  CREATE TABLE IF NOT EXISTS ssh_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER DEFAULT 22,
    username TEXT NOT NULL,
    auth_type TEXT DEFAULT 'password',
    password TEXT,
    private_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_terminals_session_id ON terminals(session_id);
  CREATE INDEX IF NOT EXISTS idx_ssh_connections_user_id ON ssh_connections(user_id);
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
  deleteTerminalsBySessionId: db.prepare('DELETE FROM terminals WHERE session_id = ?'),

  // SSH Connections
  createSshConnection: db.prepare('INSERT INTO ssh_connections (user_id, name, host, port, username, auth_type, password, private_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  findSshConnectionsByUserId: db.prepare('SELECT id, user_id, name, host, port, username, auth_type, created_at FROM ssh_connections WHERE user_id = ? ORDER BY name'),
  findSshConnectionById: db.prepare('SELECT * FROM ssh_connections WHERE id = ?'),
  updateSshConnection: db.prepare('UPDATE ssh_connections SET name=?, host=?, port=?, username=?, auth_type=?, password=?, private_key=? WHERE id=? AND user_id=?'),
  deleteSshConnection: db.prepare('DELETE FROM ssh_connections WHERE id = ? AND user_id = ?'),
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
    // Check if terminal already exists to avoid UNIQUE constraint error
    const existing = statements.findTerminalById.get(terminalId);
    if (existing) {
      return terminalId;
    }
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
  },

  // SSH Connections
  createSshConnection(userId, name, host, port, username, authType, password, privateKey) {
    const result = statements.createSshConnection.run(userId, name, host, port || 22, username, authType || 'password', password || null, privateKey || null);
    return { id: result.lastInsertRowid, name, host, port: port || 22, username };
  },

  getSshConnections(userId) {
    return statements.findSshConnectionsByUserId.all(userId);
  },

  getSshConnection(id) {
    return statements.findSshConnectionById.get(id);
  },

  updateSshConnection(id, userId, name, host, port, username, authType, password, privateKey) {
    const result = statements.updateSshConnection.run(name, host, port || 22, username, authType || 'password', password || null, privateKey || null, id, userId);
    return result.changes > 0;
  },

  deleteSshConnection(id, userId) {
    const result = statements.deleteSshConnection.run(id, userId);
    return result.changes > 0;
  }
};

module.exports = { db, ...dbHelpers };