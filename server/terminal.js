const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const path = require('path');
const fs = require('fs');
const database = require('../db/database');
const tmuxManager = require('../utils/tmuxManager');
const logger = require('./utils/logger');
const tracer = require('./utils/persistenceTracer');

class TerminalManager {
  constructor() {
    this.terminals = new Map();
  }

  createTerminal(userId, sessionId, rows = 24, cols = 80, terminalId = null, isRestore = false) {
    return new Promise((resolve, reject) => {
      try {
        if (!terminalId) {
          terminalId = uuidv4();
        }

        const tmuxSessionName = `webssh_${sessionId}_${terminalId}`.replace(/-/g, '_');
        const tmuxConfigPath = path.join(__dirname, '..', '.tmux.webssh.conf');

        if (!fs.existsSync(tmuxConfigPath)) {
          logger.error(`tmux config file not found at: ${tmuxConfigPath}`);
        }

        const tmuxSocket = 'muxterm';

        let tmuxArgs = ['-L', tmuxSocket];
        if (fs.existsSync(tmuxConfigPath)) {
          tmuxArgs.push('-f', tmuxConfigPath);
        }
        tmuxArgs.push(
          'new-session',
          '-A',
          '-d',
          '-s', tmuxSessionName,
          '-x', cols.toString(),
          '-y', rows.toString(),
          '-c', process.env.HOME
        );

        const { execSync } = require('child_process');
        try {
          execSync(`tmux ${tmuxArgs.join(' ')}`, { stdio: 'ignore' });
        } catch (e) {
          // Ignore if session already exists
        }

        // Attach to tmux session
        const attachArgs = ['-L', tmuxSocket];
        if (fs.existsSync(tmuxConfigPath)) {
          attachArgs.push('-f', tmuxConfigPath);
        }
        attachArgs.push('attach-session', '-t', tmuxSessionName);

        const ptyProcess = pty.spawn('tmux', attachArgs, {
          name: 'xterm-256color',
          cols: cols,
          rows: rows,
          cwd: process.env.HOME,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLUMNS: cols.toString(),
            LINES: rows.toString(),
            SHELL: '/bin/bash',
            LANG: process.env.LANG || 'en_US.UTF-8',
            LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
            LC_CTYPE: 'en_US.UTF-8'
          }
        });

        const terminal = {
          id: terminalId,
          userId: userId,
          sessionId: sessionId,
          tmuxSessionName: tmuxSessionName,
          pty: ptyProcess,
          dataListeners: [],
          // Track dimensions per socket for smart resize
          socketDimensions: new Map(), // socketId -> { cols, rows }
          createdAt: new Date(),
          lastActivity: new Date()
        };

        // Handle initial output cleanup
        let isFirstOutput = true;
        let suppressOutput = false;

        ptyProcess.onData((data) => {
          if (isFirstOutput) {
            isFirstOutput = false;
            if (!isRestore) {
              setTimeout(() => {
                ptyProcess.write('\x0c');
                if (!fs.existsSync(tmuxConfigPath)) {
                  ptyProcess.write('tmux set-option -g status off\r');
                  setTimeout(() => { ptyProcess.write('\x0c'); }, 50);
                }
              }, 300);
            } else {
              // For restores after server restart, suppress ALL output
              // until the restore handler sends the captured screen
              suppressOutput = true;
              // The restore handler in index.js will set suppressOutput = false
              // after it captures and sends the correct screen
              terminal._suppressRestore = () => { suppressOutput = false; };
            }
          }

          // Don't forward stale output during restore initialization
          if (suppressOutput) return;

          let cleanData = data;
          cleanData = cleanData.replace(/\x00/g, '');

          if (cleanData.length > 0) {
            terminal.lastActivity = new Date();
            terminal.dataListeners.forEach(listener => listener(cleanData));
          }
        });

        terminal.onData = (callback) => {
          terminal.dataListeners.push(callback);
          return () => {
            const index = terminal.dataListeners.indexOf(callback);
            if (index > -1) {
              terminal.dataListeners.splice(index, 1);
            }
          };
        };

        terminal.write = (data) => {
          terminal.lastActivity = new Date();
          ptyProcess.write(data);
        };

        // Smart resize: use the largest dimensions from all connected sockets
        terminal.resize = (cols, rows) => {
          ptyProcess.resize(cols, rows);
        };

        // Track a socket's dimensions and resize to the largest
        terminal.setSocketDimensions = (socketId, cols, rows) => {
          terminal.socketDimensions.set(socketId, { cols, rows });
          // Use the largest dimensions among all connected sockets
          let maxCols = cols;
          let maxRows = rows;
          terminal.socketDimensions.forEach((dim) => {
            if (dim.cols > maxCols) maxCols = dim.cols;
            if (dim.rows > maxRows) maxRows = dim.rows;
          });
          // During cooldown, block small resizes (layout settling)
          // but allow significant row changes (keyboard open/close)
          if (terminal._resizeCooldown) {
            const rowDiff = Math.abs(maxRows - terminal._lastRows);
            if (rowDiff > 5) {
              // Keyboard event - allow through
              console.log(`[PTY-RESIZE] COOLDOWN-ALLOW-KB ${terminal._lastCols}x${terminal._lastRows} -> ${maxCols}x${maxRows} (rowDiff=${rowDiff})`);
            } else {
              console.log(`[PTY-RESIZE] COOLDOWN-BLOCK ${terminal._lastCols}x${terminal._lastRows} -> ${maxCols}x${maxRows}`);
              return;
            }
          }
          console.log(`[PTY-RESIZE] NORMAL ${terminal._lastCols}x${terminal._lastRows} -> ${maxCols}x${maxRows}`);
          ptyProcess.resize(maxCols, maxRows);
          terminal._lastCols = maxCols;
          terminal._lastRows = maxRows;
        };

        // Track current dimensions
        terminal._lastCols = cols;
        terminal._lastRows = rows;

        // Temporarily block shrinking resize (used during restore to preserve screen content)
        terminal.pauseResize = (ms = 2000) => {
          terminal._resizeCooldown = true;
          if (terminal._resizeCooldownTimer) clearTimeout(terminal._resizeCooldownTimer);
          terminal._resizeCooldownTimer = setTimeout(() => { terminal._resizeCooldown = false; }, ms);
        };

        // Remove a socket's dimensions tracking
        // Don't remove during cooldown to prevent resize cascade on rapid refreshes
        terminal.removeSocket = (socketId) => {
          if (!terminal._resizeCooldown) {
            terminal.socketDimensions.delete(socketId);
          }
        };

        terminal.destroy = () => {
          ptyProcess.kill();
          const { exec } = require('child_process');
          exec(`tmux -L muxterm kill-session -t ${tmuxSessionName}`, (error) => {
            if (error) logger.debug(`Error killing tmux session: ${error.message}`);
          });
          database.deleteTerminal(terminalId);
          this.terminals.delete(terminalId);
        };

        ptyProcess.onExit((exitCode, signal) => {
          logger.debug(`Terminal ${terminalId} exited with code ${exitCode} and signal ${signal}`);
          this.terminals.delete(terminalId);
        });

        this.terminals.set(terminalId, terminal);
        database.createTerminal(terminalId, sessionId, terminalId, null, null);

        resolve(terminal);
      } catch (error) {
        reject(error);
      }
    });
  }

  getTerminal(terminalId) {
    return this.terminals.get(terminalId);
  }

  closeTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.destroy();
    }
  }

  getUserTerminals(userId) {
    const userTerminals = [];
    for (const [id, terminal] of this.terminals) {
      if (terminal.userId === userId) {
        userTerminals.push({
          id: id,
          sessionId: terminal.sessionId,
          createdAt: terminal.createdAt,
          lastActivity: terminal.lastActivity
        });
      }
    }
    return userTerminals;
  }

  getTerminalBuffer(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return '';
    return '';
  }

  async restoreTerminal(terminalId, userId, sessionId, rows = 24, cols = 80) {
    const existingTerminal = this.terminals.get(terminalId);
    if (existingTerminal) {
      existingTerminal._wasInMemory = true;
      return existingTerminal;
    }

    const tmuxSessionName = `webssh_${sessionId}_${terminalId}`.replace(/-/g, '_');
    const { execSync } = require('child_process');

    try {
      const tmuxSessions = execSync('tmux -L muxterm ls 2>/dev/null || true', { encoding: 'utf8' });
      if (tmuxSessions.includes(tmuxSessionName)) {
        logger.debug(`Tmux session ${tmuxSessionName} exists, reattaching...`);
        return await this.createTerminal(userId, sessionId, rows, cols, terminalId, true);
      } else {
        logger.debug(`Tmux session ${tmuxSessionName} not found, creating new...`);
        return await this.createTerminal(userId, sessionId, rows, cols, terminalId, false);
      }
    } catch (error) {
      logger.debug('Error checking tmux sessions:', error.message);
      return await this.createTerminal(userId, sessionId, rows, cols, terminalId, false);
    }
  }

  cleanupInactiveTerminals(maxInactiveMinutes = 30) {
    const now = new Date();
    const maxInactiveMs = maxInactiveMinutes * 60 * 1000;

    for (const [id, terminal] of this.terminals) {
      const inactiveTime = now - terminal.lastActivity;
      if (inactiveTime > maxInactiveMs) {
        logger.debug(`Cleaning up inactive terminal ${id}`);
        this.closeTerminal(id);
      }
    }
  }
}

module.exports = new TerminalManager();
