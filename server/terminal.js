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
        // Si no se proporciona terminalId, crear uno nuevo
        if (!terminalId) {
          terminalId = uuidv4();
        }
        
        // Usar tmux para sesiones persistentes
        const tmuxSessionName = `webssh_${sessionId}_${terminalId}`.replace(/-/g, '_');
        
        // Configurar tmux para ser completamente invisible
        const tmuxConfigPath = path.join(__dirname, '..', '.tmux.webssh.conf');
        
        // Verificar si el archivo de configuración existe
        if (!fs.existsSync(tmuxConfigPath)) {
          logger.error(`tmux config file not found at: ${tmuxConfigPath}`);
          logger.error('tmux will use default settings (with status bar visible)');
        }
        
        // Para restauración, solo hacer attach, no crear nueva sesión
        let tmuxArgs;
        
        if (fs.existsSync(tmuxConfigPath)) {
          // Siempre usar -A para attach-or-create
          tmuxArgs = [
            '-f', tmuxConfigPath,      // Usar nuestro archivo de configuración
            'new-session',
            '-A',                      // Attach si existe, crear si no
            '-d',                      // Detached inicialmente
            '-s', tmuxSessionName,     // Nombre de sesión único
            '-x', cols.toString(),     // Ancho
            '-y', rows.toString(),     // Alto
            '-c', process.env.HOME     // Directorio inicial
          ];
        } else {
          // Fallback: usar comandos directos si no hay archivo de configuración
          tmuxArgs = [
            'new-session',
            '-A',                      // Attach si existe, crear si no
            '-d',                      // Detached inicialmente
            '-s', tmuxSessionName,     // Nombre de sesión único
            '-x', cols.toString(),     // Ancho
            '-y', rows.toString(),     // Alto
            '-c', process.env.HOME     // Directorio inicial
          ];
        }
        
        // Primero crear/verificar la sesión tmux
        const { execSync } = require('child_process');
        try {
          execSync(`tmux ${tmuxArgs.join(' ')}`, { stdio: 'ignore' });
        } catch (e) {
          // Ignorar errores si la sesión ya existe
        }
        
        // Ahora hacer attach a la sesión
        const attachArgs = fs.existsSync(tmuxConfigPath) ? 
          ['-f', tmuxConfigPath, 'attach-session', '-t', tmuxSessionName] :
          ['attach-session', '-t', tmuxSessionName];
        
        logger.debug(`Attaching to tmux session with args: ${attachArgs.join(' ')}`);
        logger.debug(`tmux config exists: ${fs.existsSync(tmuxConfigPath)}`);
          
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
          buffer: [],
          maxBufferSize: 1000,
          lastSnapshot: '', // Almacenar último estado visual conocido
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
            // Para restauración, no limpiar nada
            if (!isRestore) {
              setTimeout(() => {
                // Enviar un clear para limpiar la pantalla
                ptyProcess.write('\x0c');
                
                // Si no se usó el archivo de configuración, enviar comandos para deshabilitar la barra
                if (!fs.existsSync(tmuxConfigPath)) {
                  // Enviar comando tmux para deshabilitar la barra de estado
                  ptyProcess.write('tmux set-option -g status off\r');
                  setTimeout(() => {
                    // Limpiar la pantalla de nuevo
                    ptyProcess.write('\x0c');
                  }, 50);
                }
              }, 300); // Aumentar delay para LXC
            } else {
              // Para restauración, tmux ya está configurado
              logger.debug('Terminal restored, tmux config already applied');
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
            
            // No necesitamos almacenar contenido, tmux lo maneja
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
            if (error) logger.debug(`Error killing tmux session: ${error.message}`);
          });
          // Remove from database
          database.deleteTerminal(terminalId);
          this.terminals.delete(terminalId);
        };

        ptyProcess.onExit((exitCode, signal) => {
          logger.debug(`Terminal ${terminalId} exited with code ${exitCode} and signal ${signal}`);
          // Simply remove the terminal, session cleanup will be handled elsewhere
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
    if (!terminal) {
      tracer.trace('BUFFER', 'GET_FAILED', { terminalId, reason: 'Terminal not found' });
      return '';
    }
    
    // Usar el output persistente que tiene todo el contenido
    const persistentBuffer = terminal.persistentOutput || '';
    
    // Log para debug
    logger.debug(`Persistent buffer length: ${persistentBuffer.length} chars`);
    logger.debug(`Persistent buffer preview: ${persistentBuffer.substring(0, 200).replace(/\n/g, '\\n')}`);
    
    tracer.traceBuffer('RETURNING_PERSISTENT_BUFFER', persistentBuffer, {
      terminalId,
      source: 'terminal.persistentOutput',
      length: persistentBuffer.length
    });
    
    return persistentBuffer;
  }
  
  // Reconectar a una sesión tmux existente
  async restoreTerminal(terminalId, userId, sessionId, rows = 24, cols = 80) {
    // Verificar si el terminal ya existe
    const existingTerminal = this.terminals.get(terminalId);
    if (existingTerminal) {
      tracer.trace('RESTORE', 'TERMINAL_EXISTS_IN_MEMORY', {
        terminalId,
        sessionId,
        hasBuffer: existingTerminal.buffer.length > 0
      });
      
      // Si existe pero no tiene buffer capturado, intentar capturar de tmux
      if (!existingTerminal.capturedBuffer) {
        const tmuxSessionName = `webssh_${sessionId}_${terminalId}`.replace(/-/g, '_');
        const { execSync } = require('child_process');
        
        try {
          // Capturar incluyendo el historial completo (scrollback)
          const captureCmd = `tmux capture-pane -t ${tmuxSessionName} -p -S -10000 -E -`;
          tracer.trace('RESTORE', 'CAPTURING_FROM_EXISTING_TERMINAL', {
            terminalId,
            tmuxSession: tmuxSessionName
          });
          
          const capturedBuffer = execSync(captureCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
          
          if (capturedBuffer) {
            existingTerminal.capturedBuffer = capturedBuffer;
            existingTerminal.bufferCaptureTime = Date.now();
            
            tracer.traceBuffer('CAPTURED_FOR_EXISTING', capturedBuffer, {
              terminalId,
              sessionId,
              tmuxSession: tmuxSessionName
            });
          }
        } catch (error) {
          tracer.trace('RESTORE', 'CAPTURE_FAILED_FOR_EXISTING', {
            terminalId,
            error: error.message
          });
        }
      }
      
      return existingTerminal;
    }
    
    // Si no existe, intentar reconectar a la sesión tmux
    const tmuxSessionName = `webssh_${sessionId}_${terminalId}`.replace(/-/g, '_');
    
    // Verificar si la sesión tmux existe
    const { execSync } = require('child_process');
    try {
      const tmuxSessions = execSync('tmux ls 2>/dev/null || true', { encoding: 'utf8' });
      if (tmuxSessions.includes(tmuxSessionName)) {
        logger.debug(`Tmux session ${tmuxSessionName} exists, reattaching...`);
        
        // Capturar el buffer completo de la sesión tmux antes de reconectar
        const captureId = tracer.startCapture(terminalId, sessionId);
        
        try {
          // Primero intentar capturar con el formato de escape sequences
          const captureCmd = `tmux capture-pane -t ${tmuxSessionName} -p -e -S -100`;
          logger.debug(`Executing capture command: ${captureCmd}`);
          tracer.captureStep(captureId, 'TMUX_CAPTURE_START', { command: captureCmd });
          
          const capturedBuffer = execSync(captureCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
          logger.debug(`Captured buffer length: ${capturedBuffer.length} characters`);
          logger.debug(`Buffer full content: ${capturedBuffer}`);
          
          tracer.traceBuffer('CAPTURED_FROM_TMUX', capturedBuffer, {
            terminalId,
            sessionId,
            tmuxSession: tmuxSessionName
          });
          
          // Crear el terminal con flag de restauración
          tracer.captureStep(captureId, 'CREATING_TERMINAL', { restore: true });
          const terminal = await this.createTerminal(userId, sessionId, rows, cols, terminalId, true);
          
          // Almacenar el buffer capturado para envío posterior
          if (capturedBuffer) {
            terminal.capturedBuffer = capturedBuffer;
            terminal.bufferCaptureTime = Date.now();
            logger.debug('Stored captured buffer for later delivery');
            
            tracer.captureStep(captureId, 'BUFFER_STORED', {
              bufferLength: capturedBuffer.length,
              timestamp: terminal.bufferCaptureTime
            });
          }
          
          tracer.endCapture(captureId, true);
          return terminal;
        } catch (captureError) {
          logger.error('Error capturing tmux buffer:', captureError);
          // Si falla la captura, continuar con reconexión normal
          return await this.createTerminal(userId, sessionId, rows, cols, terminalId, true);
        }
      } else {
        logger.debug(`Tmux session ${tmuxSessionName} not found, creating new...`);
        // La sesión no existe, crear una nueva
        return await this.createTerminal(userId, sessionId, rows, cols, terminalId, false);
      }
    } catch (error) {
      logger.debug('Error checking tmux sessions:', error.message);
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
        logger.debug(`Cleaning up inactive terminal ${id}`);
        this.closeTerminal(id);
      }
    }
  }
}

module.exports = new TerminalManager();