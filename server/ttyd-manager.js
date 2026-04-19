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
  async createTerminal(userId, sessionId, rows = 24, cols = 80, terminalId = null, sshConfig = null, initialCwd = null, startupCommand = null) {
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
      const sshParts = ['ssh', '-o', 'StrictHostKeyChecking=accept-new'];
      if (sshConfig.port && sshConfig.port !== 22) {
        sshParts.push('-p', sshConfig.port.toString());
      }
      if (sshConfig.privateKey) {
        const keyPath = path.join(this.socketDir, `key_${terminalId}`);
        fs.writeFileSync(keyPath, sshConfig.privateKey, { mode: 0o600 });
        sshParts.push('-i', keyPath);
      }
      sshParts.push(`${sshConfig.username}@${sshConfig.host}`);

      if (sshConfig.password && !sshConfig.privateKey) {
        // Wrap in bash -c with SSHPASS env var (not visible in ps)
        const escapedPass = sshConfig.password.replace(/'/g, "'\\''");
        shellCommand = `bash -c "SSHPASS='${escapedPass}' sshpass -e ${sshParts.join(' ')}"`;
      } else {
        shellCommand = sshParts.join(' ');
      }
      logger.info(`SSH terminal: ${sshConfig.username}@${sshConfig.host}:${sshConfig.port || 22}${sshConfig.initialPath ? ` cd:${sshConfig.initialPath}` : ''}`);
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
      '-c', (initialCwd && fs.existsSync(initialCwd)) ? initialCwd : process.env.HOME
    );
    if (shellCommand) {
      tmuxArgs.push(shellCommand);
    }

    try {
      execSync(`tmux ${tmuxArgs.join(' ')}`, { stdio: 'ignore' });
      logger.debug(`Created tmux session: ${tmuxSessionName}`);
      // Execute startup command if provided (only for local terminals, after session created)
      if (startupCommand && !sshConfig) {
        setTimeout(() => {
          try {
            execSync(`tmux -L muxterm send-keys -t ${tmuxSessionName} '${startupCommand.replace(/'/g, "'\\''")}' Enter`, { stdio: 'ignore' });
            logger.info(`Startup command sent to ${tmuxSessionName}: ${startupCommand}`);
          } catch (e) {}
        }, 500);
      }
      // SSH initial path: after the SSH handshake + prompt, send `cd <path>`.
      // 2.5s covers auth handshake on most networks; if unreachable, the command
      // just posts into a disconnected session and gets ignored.
      if (sshConfig && sshConfig.initialPath) {
        setTimeout(() => {
          try {
            // Wrap path in single quotes on the remote side so spaces work;
            // strip any single quotes from the path (rare, avoids nested escaping).
            const remoteSafePath = sshConfig.initialPath.replace(/'/g, '');
            const remoteCmd = `cd '${remoteSafePath}'`;
            // Escape for the local shell single-quote in the send-keys command
            execSync(`tmux -L muxterm send-keys -t ${tmuxSessionName} '${remoteCmd.replace(/'/g, "'\\''")}' Enter`, { stdio: 'ignore' });
            logger.info(`Initial path sent to ${tmuxSessionName}: ${sshConfig.initialPath}`);
          } catch (e) {}
        }, 2500);
      }
    } catch (e) {
      logger.debug(`tmux new-session (may already exist): ${e.message}`);
    }

    this._ensureSocketDir();
    const socketPath = path.join(this.socketDir, `ttyd_${terminalId}.sock`);

    // Remove stale socket
    if (fs.existsSync(socketPath)) {
      try { fs.unlinkSync(socketPath); } catch (e) {}
    }

    return this._spawnTtyd(terminalId, userId, sessionId, tmuxSessionName, socketPath, !!sshConfig);
  }

  /**
   * Spawn ttyd attached to a tmux session
   */
  async _spawnTtyd(terminalId, userId, sessionId, tmuxSessionName, socketPath, isSsh = false) {
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

    const createdTime = Date.now();
    ttydProcess.on('exit', (code, signal) => {
      logger.info(`ttyd exited: terminal=${terminalId.substring(0, 8)}, code=${code}, signal=${signal}`);
      const terminal = this.terminals.get(terminalId);
      if (terminal) {
        terminal._exited = true;
        // If SSH died within 10 seconds, likely auth failure
        if (sshConfig && (Date.now() - createdTime) < 10000) {
          terminal._authFailed = true;
          logger.info(`SSH auth likely failed for ${sshConfig.username}@${sshConfig.host}`);
          // Notify via callback
          if (this.onAuthFailed) this.onAuthFailed(terminalId, userId);
        }
      }
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

    // Check if SSH tmux session dies quickly (auth failure detection)
    if (isSsh) {
      setTimeout(() => {
        try {
          const tmuxList = execSync('tmux -L muxterm ls 2>/dev/null || true', { encoding: 'utf8' });
          if (!tmuxList.includes(tmuxSessionName)) {
            terminal._authFailed = true;
            logger.info(`SSH auth likely failed for terminal ${terminalId.substring(0, 8)} (tmux died)`);
            if (this.onAuthFailed) this.onAuthFailed(terminalId, userId);
          }
        } catch (e) {}
      }, 8000);
    }

    logger.info(`Terminal created: id=${terminalId.substring(0, 8)}, tmux=${tmuxSessionName}, pid=${ttydProcess.pid}`);
    return terminal;
  }

  /**
   * Restore an existing terminal or create a new one
   */
  async restoreTerminal(terminalId, userId, sessionId, rows = 24, cols = 80, sshConfig = null, initialCwd = null, startupCommand = null) {
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
        logger.info(`Restoring terminal ${terminalId.substring(0, 8)}: tmux not found, creating fresh${initialCwd ? ' at ' + initialCwd : ''}`);
        return await this.createTerminal(userId, sessionId, rows, cols, terminalId, sshConfig, initialCwd, startupCommand);
      }
    } catch (error) {
      logger.error(`Error restoring terminal: ${error.message}`);
      return await this.createTerminal(userId, sessionId, rows, cols, terminalId, sshConfig, initialCwd, startupCommand);
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
   * Get CWD of a terminal's shell via tmux pane_pid + /proc/PID/cwd
   */
  getTerminalCwd(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || !terminal.tmuxSessionName) return null;
    try {
      const panePid = execSync(
        `tmux -L muxterm display-message -p -t ${terminal.tmuxSessionName} '#{pane_pid}'`,
        { encoding: 'utf8' }
      ).trim();
      if (!panePid) return null;
      let pid = panePid;
      try {
        const children = execSync(`pgrep -P ${pid}`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
        if (children.length > 0) pid = children[children.length - 1];
      } catch (e) {}
      return fs.readlinkSync(`/proc/${pid}/cwd`);
    } catch (e) {
      return null;
    }
  }

  /**
   * Save CWDs of all active terminals into workspace layouts (for reboot persistence)
   */
  /**
   * Get CWD by tmux session name directly (doesn't need terminals Map)
   */
  getCwdByTmuxSession(tmuxSessionName) {
    try {
      const panePid = execSync(
        `tmux -L muxterm display-message -p -t ${tmuxSessionName} '#{pane_pid}'`,
        { encoding: 'utf8' }
      ).trim();
      if (!panePid) return null;
      let pid = panePid;
      try {
        const children = execSync(`pgrep -P ${pid}`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
        if (children.length > 0) pid = children[children.length - 1];
      } catch (e) {}
      return fs.readlinkSync(`/proc/${pid}/cwd`);
    } catch (e) {
      return null;
    }
  }

  saveAllCwds(includeMinimized = true) {
    let saved = 0;
    try {
      const allUsers = database.getAllUsers();
      for (const user of allUsers) {
        const layout = database.getWorkspaceLayout(user.id);
        if (!layout) continue;
        let changed = false;
        const sessionId = `ws_${user.id}`;
        const allPanels = includeMinimized
          ? [...(layout.panels || []), ...(layout.minimizedPanels || [])]
          : [...(layout.panels || [])];
        for (const panel of allPanels) {
          if (panel.terminalId && (!panel.type || panel.type === 'local' || panel.type === 'ssh')) {
            // Build tmux session name directly from userId + terminalId
            const tmuxName = `webssh_${sessionId}_${panel.terminalId}`.replace(/-/g, '_');
            const cwd = this.getCwdByTmuxSession(tmuxName);
            if (cwd) {
              panel.lastCwd = cwd;
              changed = true;
              saved++;
            }
          }
        }
        if (changed) {
          database.saveWorkspaceLayout(user.id, layout);
        }
      }
    } catch (e) {
      console.error('Error saving CWDs:', e.message);
    }
    console.log(`[SHUTDOWN] Saved CWDs for ${saved} terminals`);
    return saved;
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

      // Build set of known terminal tmux names from active ttyd terminals + workspace layouts
      const knownSessions = new Set();
      for (const [id, terminal] of this.terminals) {
        if (terminal.tmuxSessionName) {
          knownSessions.add(terminal.tmuxSessionName);
        }
      }
      // Also protect sessions from workspace layouts (active + minimized panels)
      try {
        const database = require('../db/database');
        const allUsers = database.getAllUsers();
        for (const user of allUsers) {
          const layout = database.getWorkspaceLayout(user.id);
          if (layout) {
            const allPanels = [...(layout.panels || []), ...(layout.minimizedPanels || [])];
            for (const panel of allPanels) {
              if (panel.terminalId) {
                const sessionId = `ws_${user.id}`;
                const tmuxName = `webssh_${sessionId}_${panel.terminalId}`.replace(/-/g, '_');
                knownSessions.add(tmuxName);
              }
            }
          }
        }
      } catch (e) {}

      let cleaned = 0;
      for (const tmuxSession of tmuxSessions) {
        if (!knownSessions.has(tmuxSession)) {
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
