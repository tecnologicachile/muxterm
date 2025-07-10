const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const database = require('../db/database');
const tmuxManager = require('../utils/tmuxManager');

class SessionManager {
  constructor() {
    // Cache for active sessions
    this.activeSessionsCache = new Map();
  }

  async validateToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded;
    } catch (error) {
      return null;
    }
  }

  async createSession(userId, name) {
    const sessionId = uuidv4();
    
    // Create tmux session
    let tmuxSession = null;
    try {
      tmuxSession = await tmuxManager.createSession(sessionId);
    } catch (error) {
      console.error('Failed to create tmux session:', error);
    }
    
    // Save to database
    database.createSession(sessionId, userId, name, tmuxSession);
    
    // Update access time
    database.updateSessionAccess(sessionId);
    
    // Cache it
    this.activeSessionsCache.set(sessionId, {
      id: sessionId,
      userId,
      name,
      tmuxSession,
      createdAt: new Date()
    });
    
    return { id: sessionId, name };
  }

  getSession(userId, sessionId) {
    // Try cache first
    if (this.activeSessionsCache.has(sessionId)) {
      const session = this.activeSessionsCache.get(sessionId);
      if (session.userId === userId) {
        database.updateSessionAccess(sessionId);
        return session;
      }
    }
    
    // Load from database
    const session = database.findSessionById(sessionId);
    if (session && session.user_id === userId) {
      database.updateSessionAccess(sessionId);
      
      // Cache it
      this.activeSessionsCache.set(sessionId, {
        id: session.id,
        userId: session.user_id,
        name: session.name,
        tmuxSession: session.tmux_session,
        createdAt: session.created_at,
        layout: database.getLayout(sessionId)
      });
      
      return this.activeSessionsCache.get(sessionId);
    }
    
    return null;
  }

  getUserSessions(userId) {
    const sessions = database.findSessionsByUserId(userId);
    return sessions.map(s => ({
      id: s.id,
      name: s.name,
      createdAt: s.created_at,
      lastAccessed: s.last_accessed
    }));
  }

  updateSessionLayout(userId, sessionId, layout) {
    const session = this.getSession(userId, sessionId);
    if (!session) return false;
    
    database.saveLayout(sessionId, layout);
    
    // Update cache
    if (this.activeSessionsCache.has(sessionId)) {
      this.activeSessionsCache.get(sessionId).layout = layout;
    }
    
    return true;
  }

  getSessionLayout(userId, sessionId) {
    const session = this.getSession(userId, sessionId);
    if (!session) return null;
    
    const layout = database.getLayout(sessionId);
    return layout || { type: 'single', panels: [], activePanel: null };
  }

  async deleteSession(userId, sessionId) {
    const session = this.getSession(userId, sessionId);
    if (!session) return false;
    
    // Kill tmux session
    if (session.tmuxSession) {
      await tmuxManager.killSession(session.tmuxSession);
    }
    
    // Remove from cache
    this.activeSessionsCache.delete(sessionId);
    
    // Delete from database
    database.deleteSession(sessionId);
    
    return true;
  }

  async deleteAllUserSessions(userId) {
    const sessions = database.findSessionsByUserId(userId);
    
    for (const session of sessions) {
      if (session.tmux_session) {
        await tmuxManager.killSession(session.tmux_session);
      }
      this.activeSessionsCache.delete(session.id);
      database.deleteSession(session.id);
    }
    
    return true;
  }
}

module.exports = new SessionManager();