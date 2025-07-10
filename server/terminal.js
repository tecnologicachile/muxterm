const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const path = require('path');
const database = require('../db/database');
const tmuxManager = require('../utils/tmuxManager');

class TerminalManager {
  constructor() {
    this.terminals = new Map();
  }

  createTerminal(userId, sessionId, rows = 24, cols = 80, terminalId = null, isRestore = false) {
    return new Promise((resolve, reject) => {
      try {
        // Si no se proporciona terminalId, crear uno nuevo
        if (!terminalId) {
          terminalId = uuidv4();
        }
        
        // Usar tmux para sesiones persistentes
        const tmuxSessionName = `webssh_${sessionId}_${terminalId}`.replace(/-/g, '_');
        
        // Configurar tmux para ser completamente invisible
        const tmuxConfigPath = path.join(__dirname, '..', '.tmux.webssh.conf');
        
        // Para restauración, solo hacer attach, no crear nueva sesión
        const tmuxArgs = isRestore ? [
          '-f', tmuxConfigPath,
          'attach-session',
          '-t', tmuxSessionName,
          '-x', cols.toString(),
          '-y', rows.toString()
        ] : [
          '-f', tmuxConfigPath,      // Usar nuestro archivo de configuración
          'new-session',
          '-A',                      // Attach si existe, crear si no
          '-s', tmuxSessionName,     // Nombre de sesión único
          '-x', cols.toString(),     // Ancho
          '-y', rows.toString(),     // Alto
          '-c', process.env.HOME     // Directorio inicial
        ];
        
        const ptyProcess = pty.spawn('tmux', tmuxArgs, {
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
          buffer: [],
          maxBufferSize: 1000,
          createdAt: new Date(),
          lastActivity: new Date(),
          dataListeners: []
        };

        // Flag para indicar si es la primera salida
        let isFirstOutput = true;
        
        ptyProcess.onData((data) => {
          // En la primera salida, limpiar cualquier basura inicial
          if (isFirstOutput) {
            isFirstOutput = false;
            // Esperar un poco para que tmux se estabilice
            if (!isRestore) {
              setTimeout(() => {
                // Enviar un clear para limpiar la pantalla
                ptyProcess.write('\x0c');
              }, 100);
            }
          }
          
          // Limpiar datos problemáticos
          let cleanData = data;
          
          // Eliminar secuencias problemáticas conocidas
          cleanData = cleanData.replace(/Vídeo/g, '');
          cleanData = cleanData.replace(/\x00/g, ''); // Eliminar bytes nulos
          
          // Solo agregar al buffer si hay datos válidos
          if (cleanData.length > 0) {
            terminal.buffer.push(cleanData);
            
            while (terminal.buffer.length > terminal.maxBufferSize) {
              terminal.buffer.shift();
            }
          }
          
          terminal.lastActivity = new Date();
          
          terminal.dataListeners.forEach(listener => {
            listener(cleanData);
          });
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

        terminal.resize = (cols, rows) => {
          ptyProcess.resize(cols, rows);
        };

        terminal.destroy = () => {
          ptyProcess.kill();
          // También matar la sesión tmux
          const { exec } = require('child_process');
          exec(`tmux kill-session -t ${tmuxSessionName}`, (error) => {
            if (error) console.log(`Error killing tmux session: ${error.message}`);
          });
          // Remove from database
          database.deleteTerminal(terminalId);
          this.terminals.delete(terminalId);
        };

        ptyProcess.onExit((exitCode, signal) => {
          console.log(`Terminal ${terminalId} exited with code ${exitCode} and signal ${signal}`);
          const sessionManager = require('./session');
          for (const [sessionId, session] of sessionManager.sessions) {
            if (session.terminals && session.terminals.includes(terminalId)) {
              console.log(`Removing terminal ${terminalId} from session ${sessionId}`);
              sessionManager.removeTerminalFromSession(session.userId, sessionId, terminalId);
              break;
            }
          }
          this.terminals.delete(terminalId);
        });

        this.terminals.set(terminalId, terminal);
        
        // Save terminal to database
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

    // Con tmux, simplemente devolvemos el buffer
    // No hay problemas de duplicación porque tmux mantiene el estado real
    return terminal.buffer.join('');
  }
  
  // Reconectar a una sesión tmux existente
  async restoreTerminal(terminalId, userId, sessionId, rows = 24, cols = 80) {
    // Verificar si el terminal ya existe
    const existingTerminal = this.terminals.get(terminalId);
    if (existingTerminal) {
      return existingTerminal;
    }
    
    // Si no existe, intentar reconectar a la sesión tmux
    const tmuxSessionName = `webssh_${sessionId}_${terminalId}`.replace(/-/g, '_');
    
    // Verificar si la sesión tmux existe
    const { execSync } = require('child_process');
    try {
      const tmuxSessions = execSync('tmux ls 2>/dev/null || true', { encoding: 'utf8' });
      if (tmuxSessions.includes(tmuxSessionName)) {
        console.log(`Tmux session ${tmuxSessionName} exists, reattaching...`);
        // La sesión existe, reconectar con flag de restauración
        return await this.createTerminal(userId, sessionId, rows, cols, terminalId, true);
      } else {
        console.log(`Tmux session ${tmuxSessionName} not found, creating new...`);
        // La sesión no existe, crear una nueva
        return await this.createTerminal(userId, sessionId, rows, cols, terminalId, false);
      }
    } catch (error) {
      console.log('Error checking tmux sessions:', error.message);
      // En caso de error, crear una nueva sesión
      return await this.createTerminal(userId, sessionId, rows, cols, terminalId, false);
    }
  }
  
  

  cleanupInactiveTerminals(maxInactiveMinutes = 30) {
    const now = new Date();
    const maxInactiveMs = maxInactiveMinutes * 60 * 1000;

    for (const [id, terminal] of this.terminals) {
      const inactiveTime = now - terminal.lastActivity;
      if (inactiveTime > maxInactiveMs) {
        console.log(`Cleaning up inactive terminal ${id}`);
        this.closeTerminal(id);
      }
    }
  }
}

module.exports = new TerminalManager();