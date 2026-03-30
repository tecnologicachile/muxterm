const { v4: uuidv4 } = require('uuid');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const database = require('../db/database');
const logger = require('./utils/logger');

class TtydProcessManager {
  constructor() {
    this.terminals = new Map();
    this.socketDir = '/tmp/muxterm';
  }

  /**
   * Create a new terminal with tmux for session persistence
   */
  async createTerminal(userId, sessionId, rows = 24, cols = 80, terminalId = null, sshConfig = null) {
    if (!terminalId) {
      terminalId = uuidv4();
    }

    if (!this._checkTtydBinary()) {
      throw new Error('ttyd binary not found');
    }

    const tmuxSessionName = `webssh_${sessionId}_${terminalId}`.replace(/-/g, '_');
    const tmuxConfigPath = path.join(__dirname, '..', '.tmux.webssh.conf');

    // Build the shell command for SSH sessions
    let shellCommand = null;
    if (sshConfig) {
      const sshArgs = [];
      // Use sshpass for password authentication if available
      if (sshConfig.password && !sshConfig.privateKey) {
        sshArgs.push('sshpass', '-p', sshConfig.password);
      }
      sshArgs.push('ssh', '-o', 'StrictHostKeyChecking=accept-new');
      if (sshConfig.port && sshConfig.port !== 22) {
        sshArgs.push('-p', sshConfig.port.toString());
      }
      if (sshConfig.privateKey) {
        const keyPath = path.join(this.socketDir, `key_${terminalId}`);
        fs.writeFileSync(keyPath, sshConfig.privateKey, { mode: 0o600 });
        sshArgs.push('-i', keyPath);
      }
      sshArgs.push(`${sshConfig.username}@${sshConfig.host}`);
      shellCommand = sshArgs.join(' ');
      logger.info(`SSH terminal: ${sshConfig.username}@${sshConfig.host}:${sshConfig.port || 22}`);
    }

    // Create tmux session
    const tmuxArgs = ['-L', 'muxterm'];
    if (fs.existsSync(tmuxConfigPath)) {
      tmuxArgs.push('-f', tmuxConfigPath);
    }
    tmuxArgs.push(
      'new-session', '-A', '-d',
      '-s', tmuxSessionName,
      '-x', cols.toString(),
      '-y', rows.toString(),
      '-c', process.env.HOME
    );
    if (shellCommand) {
      tmuxArgs.push(shellCommand);
    }

    try {
      execSync(`tmux ${tmuxArgs.join(' ')}`, { stdio: 'ignore' });
      logger.debug(`Created tmux session: ${tmuxSessionName}`);
    } catch (e) {
      logger.debug(`tmux new-session (may already exist): ${e.message}`);
    }

    this._ensureSocketDir();
    const socketPath = path.join(this.socketDir, `ttyd_${terminalId}.sock`);

    // Remove stale socket
    if (fs.existsSync(socketPath)) {
      try { fs.unlinkSync(socketPath); } catch (e) {}
    }

    return this._spawnTtyd(terminalId, userId, sessionId, tmuxSessionName, socketPath);
  }

  /**
   * Spawn ttyd attached to a tmux session
   */
  async _spawnTtyd(terminalId, userId, sessionId, tmuxSessionName, socketPath) {
    const tmuxConfigPath = path.join(__dirname, '..', '.tmux.webssh.conf');

    const tmuxAttachArgs = ['-L', 'muxterm'];
    if (fs.existsSync(tmuxConfigPath)) {
      tmuxAttachArgs.push('-f', tmuxConfigPath);
    }
    tmuxAttachArgs.push('attach-session', '-t', tmuxSessionName);

    const themeJson = JSON.stringify({
      background: '#000000',
      foreground: '#f0f0f0',
      cursor: '#00ff00',
      cursorAccent: '#000000',
      selection: 'rgba(255,255,255,0.3)'
    });

    const ttydArgs = [
      '-W',
      '-i', socketPath,
      '-t', 'fontSize=14',
      '-t', 'fontFamily=Fira Code, monospace',
      '-t', `theme=${themeJson}`,
      '-t', 'scrollback=0',
      'tmux', ...tmuxAttachArgs
    ];

    logger.debug(`Spawning ttyd: ${ttydArgs.join(' ')}`);

    const ttydProcess = spawn('ttyd', ttydArgs, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    ttydProcess.unref();

    ttydProcess.stderr.on('data', (data) => {
      const line = data.toString().trim();
      if (line) logger.debug(`[ttyd:${terminalId.substring(0, 8)}] ${line}`);
    });

    ttydProcess.on('exit', (code, signal) => {
      logger.info(`ttyd exited: terminal=${terminalId.substring(0, 8)}, code=${code}, signal=${signal}`);
      const terminal = this.terminals.get(terminalId);
      if (terminal) terminal._exited = true;
    });

    await this._waitForSocket(socketPath, 3000);

    const terminal = {
      id: terminalId,
      userId: userId,
      sessionId: sessionId,
      tmuxSessionName: tmuxSessionName,
      socketPath: socketPath,
      process: ttydProcess,
      pid: ttydProcess.pid,
      createdAt: new Date(),
      lastActivity: new Date(),
      _exited: false,
    };

    this.terminals.set(terminalId, terminal);
    database.createTerminalForUser(terminalId, userId, terminalId, null);

    logger.info(`Terminal created: id=${terminalId.substring(0, 8)}, tmux=${tmuxSessionName}, pid=${ttydProcess.pid}`);
    return terminal;
  }

  /**
   * Restore an existing terminal or create a new one
   */
  async restoreTerminal(terminalId, userId, sessionId, rows = 24, cols = 80) {
    const existing = this.terminals.get(terminalId);
    if (existing && !existing._exited) {
      existing.lastActivity = new Date();
      return existing;
    }

    const tmuxSessionName = `webssh_${sessionId}_${terminalId}`.replace(/-/g, '_');

    try {
      const tmuxList = execSync('tmux -L muxterm ls 2>/dev/null || true', { encoding: 'utf8' });
      if (tmuxList.includes(tmuxSessionName)) {
        logger.info(`Restoring terminal ${terminalId.substring(0, 8)}: tmux session exists`);
        this._ensureSocketDir();
        const socketPath = path.join(this.socketDir, `ttyd_${terminalId}.sock`);
        if (fs.existsSync(socketPath)) {
          try { fs.unlinkSync(socketPath); } catch (e) {}
        }
        return await this._spawnTtyd(terminalId, userId, sessionId, tmuxSessionName, socketPath);
      } else {
        logger.info(`Restoring terminal ${terminalId.substring(0, 8)}: tmux not found, creating fresh`);
        return await this.createTerminal(userId, sessionId, rows, cols, terminalId);
      }
    } catch (error) {
      logger.error(`Error restoring terminal: ${error.message}`);
      return await this.createTerminal(userId, sessionId, rows, cols, terminalId);
    }
  }

  /**
   * Send keys to a terminal via tmux send-keys
   */
  sendKeys(terminalId, keys) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || !terminal.tmuxSessionName) return;

    const sess = terminal.tmuxSessionName;

    try {
      // Map common control sequences
      const keyMap = {
        '\x03': 'C-c', '\x04': 'C-d', '\x1a': 'C-z',
        '\x0c': 'C-l', '\x1b': 'Escape', '\t': 'Tab',
        '\r': 'Enter', '\x7f': 'BSpace',
        '\x1b[A': 'Up', '\x1b[B': 'Down',
        '\x1b[C': 'Right', '\x1b[D': 'Left',
        '\x1b[H': 'Home', '\x1b[F': 'End',
      };

      if (keyMap[keys]) {
        execSync(`tmux -L muxterm send-keys -t ${sess} ${keyMap[keys]}`, { timeout: 2000 });
      } else if (keys.length === 1 && keys.charCodeAt(0) < 32) {
        // Other control characters
        const letter = String.fromCharCode(keys.charCodeAt(0) + 64);
        execSync(`tmux -L muxterm send-keys -t ${terminal.tmuxSessionName} C-${letter.toLowerCase()}`, { timeout: 2000 });
      } else {
        // Literal text
        const escaped = keys.replace(/'/g, "'\\''");
        execSync(`tmux -L muxterm send-keys -t ${terminal.tmuxSessionName} -l '${escaped}'`, { timeout: 2000 });
      }
    } catch (e) {
      logger.debug(`sendKeys error: ${e.message}`);
    }
  }

  /**
   * Close a terminal
   */
  closeTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;

    // Kill ttyd process
    if (terminal.process && !terminal._exited) {
      try {
        process.kill(-terminal.pid, 'SIGTERM');
      } catch (e) {
        try { terminal.process.kill('SIGTERM'); } catch (e2) {}
      }
    }

    // Kill tmux session
    if (terminal.tmuxSessionName) {
      try {
        execSync(`tmux -L muxterm kill-session -t ${terminal.tmuxSessionName}`, { timeout: 2000 });
      } catch (e) {}
    }

    // Remove socket file
    if (terminal.socketPath && fs.existsSync(terminal.socketPath)) {
      try { fs.unlinkSync(terminal.socketPath); } catch (e) {}
    }

    // Remove SSH key file
    const keyPath = path.join(this.socketDir, `key_${terminalId}`);
    if (fs.existsSync(keyPath)) {
      try { fs.unlinkSync(keyPath); } catch (e) {}
    }

    database.deleteTerminal(terminalId);
    this.terminals.delete(terminalId);
    logger.info(`Terminal closed: ${terminalId.substring(0, 8)}`);
  }

  getTerminal(terminalId) {
    return this.terminals.get(terminalId);
  }

  getUserTerminals(userId) {
    const result = [];
    for (const [id, terminal] of this.terminals) {
      if (terminal.userId === userId) {
        result.push({ id, sessionId: terminal.sessionId, createdAt: terminal.createdAt, lastActivity: terminal.lastActivity });
      }
    }
    return result;
  }

  /**
   * Clean up orphaned processes
   */
  cleanupOrphanedProcesses() {
    this._ensureSocketDir();
    try {
      const files = fs.readdirSync(this.socketDir);
      const ttydSockets = files.filter(f => f.startsWith('ttyd_'));
      for (const f of ttydSockets) {
        try { fs.unlinkSync(path.join(this.socketDir, f)); } catch (e) {}
      }
      try { execSync("pkill -f 'ttyd.*muxterm' 2>/dev/null || true", { stdio: 'ignore' }); } catch (e) {}
      if (ttydSockets.length > 0) {
        logger.info(`Cleaned up ${ttydSockets.length} orphaned socket files`);
      }
    } catch (e) {}
  }

  /**
   * Clean up orphaned tmux sessions
   */
  cleanupOrphanedTmuxSessions() {
    try {
      const tmuxList = execSync('tmux -L muxterm ls 2>/dev/null || true', { encoding: 'utf8' });
      const tmuxSessions = tmuxList.split('\n').filter(l => l.includes('webssh_')).map(l => l.split(':')[0].trim());

      const allDbTerminals = new Set();
      const users = database.getAllUsers();
      if (users) {
        for (const user of users) {
          const sessions = database.findSessionsByUserId(user.id);
          if (sessions) {
            for (const session of sessions) {
              const terminals = database.findTerminalsBySessionId(session.id);
              if (terminals) {
                for (const t of terminals) {
                  allDbTerminals.add(`webssh_${session.id}_${t.id}`.replace(/-/g, '_'));
                }
              }
            }
          }
        }
      }

      let cleaned = 0;
      for (const tmuxSession of tmuxSessions) {
        if (!allDbTerminals.has(tmuxSession)) {
          try {
            execSync(`tmux -L muxterm kill-session -t ${tmuxSession}`, { timeout: 2000 });
            cleaned++;
          } catch (e) {}
        }
      }
      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} orphaned tmux sessions`);
      }
    } catch (e) {}
  }

  // --- Private helpers ---

  _ensureSocketDir() {
    if (!fs.existsSync(this.socketDir)) {
      fs.mkdirSync(this.socketDir, { recursive: true });
    }
  }

  _checkTtydBinary() {
    try { execSync('which ttyd', { stdio: 'ignore' }); return true; } catch (e) { return false; }
  }

  async _waitForSocket(socketPath, timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (fs.existsSync(socketPath)) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    logger.error(`Timeout waiting for socket: ${socketPath}`);
    return false;
  }
}

module.exports = new TtydProcessManager();
