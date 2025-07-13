const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const database = require('../db/database');
const tmuxManager = require('../utils/tmuxManager');
const logger = require('./utils/logger');

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
    logger.debug('[SessionManager] createSession called with userId:', userId, 'name:', name);
    
    if (!userId) {
      throw new Error('userId is required');
    }
    
    const sessionId = uuidv4();
    logger.debug('[SessionManager] Generated sessionId:', sessionId);
    
    // Create tmux session
    let tmuxSession = null;
    try {
      tmuxSession = await tmuxManager.createSession(sessionId);
      logger.debug('[SessionManager] Tmux session created:', tmuxSession);
    } catch (error) {
      logger.error('[SessionManager] Failed to create tmux session:', error);
      // Continue even if tmux fails
    }
    
    try {
      // Save to database
      database.createSession(sessionId, userId, name, tmuxSession);
      logger.debug('[SessionManager] Session saved to database');
      
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
      
      logger.debug('[SessionManager] Session created successfully');
      return { id: sessionId, name };
    } catch (error) {
      logger.error('[SessionManager] Database error:', error);
      throw error;
    }
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
    return sessions.map(s => {
      // Get the layout to count terminals
      const layout = database.getLayout(s.id);
      let terminalCount = 0;
      
      if (layout && layout.panels) {
        terminalCount = layout.panels.length;
      }
      
      return {
        id: s.id,
        name: s.name,
        createdAt: s.created_at,
        lastAccessed: s.last_accessed,
        terminals: terminalCount,
        layoutInfo: terminalCount > 1 ? `${terminalCount} panels` : null
      };
    });
  }

  updateSessionLayout(userId, sessionId, layout) {
    logger.debug(`[MULTI] Updating layout for ${sessionId} with ${layout.panels?.length || 0} panels`);
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
  
  updateSessionName(userId, sessionId, newName) {
    if (!userId || !sessionId || !newName) {
      return false;
    }
    
    // Verify session belongs to user
    const session = database.findSessionById(sessionId);
    if (!session || session.user_id !== userId) {
      return false;
    }
    
    // Update in database
    return database.updateSessionName(sessionId, newName);
  }
}

module.exports = new SessionManager();