const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const logger = require('./logger');

const execAsync = promisify(exec);

class TmuxManager {
  constructor() {
    this.prefix = 'webssh_';
  }

  // Generate tmux session name
  generateSessionName(sessionId) {
    return `${this.prefix}${sessionId.substring(0, 8)}`;
  }

  // Check if tmux is installed
  async checkTmux() {
    try {
      await execAsync('which tmux');
      return true;
    } catch {
      logger.error('tmux is not installed. Please install tmux to enable persistent sessions.');
      return false;
    }
  }

  // List all webssh tmux sessions
  async listSessions() {
    try {
      const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}"');
      return stdout
        .split('\n')
        .filter(name => name.startsWith(this.prefix))
        .map(name => name.trim());
    } catch (error) {
      // No sessions exist
      return [];
    }
  }

  // Create new tmux session
  async createSession(sessionId) {
    const sessionName = this.generateSessionName(sessionId);
    try {
      // Create detached tmux session with initial window
      await execAsync(`tmux new-session -d -s ${sessionName} -n main`);
      logger.debug(`Created tmux session: ${sessionName}`);
      return sessionName;
    } catch (error) {
      logger.error('Failed to create tmux session:', error);
      throw error;
    }
  }

  // Check if session exists
  async sessionExists(sessionName) {
    try {
      await execAsync(`tmux has-session -t ${sessionName}`);
      return true;
    } catch {
      return false;
    }
  }

  // Create new window in session
  async createWindow(sessionName, windowName) {
    try {
      const { stdout } = await execAsync(
        `tmux new-window -t ${sessionName}: -n ${windowName} -P -F "#{window_index}"`
      );
      return parseInt(stdout.trim());
    } catch (error) {
      logger.error('Failed to create tmux window:', error);
      throw error;
    }
  }

  // Create new pane in window
  async createPane(sessionName, windowIndex) {
    try {
      const { stdout } = await execAsync(
        `tmux split-window -t ${sessionName}:${windowIndex} -P -F "#{pane_id}"`
      );
      return stdout.trim();
    } catch (error) {
      logger.error('Failed to create tmux pane:', error);
      throw error;
    }
  }

  // Kill specific pane
  async killPane(sessionName, paneId) {
    try {
      await execAsync(`tmux kill-pane -t ${sessionName}:${paneId}`);
    } catch (error) {
      logger.error('Failed to kill tmux pane:', error);
    }
  }

  // Kill entire session
  async killSession(sessionName) {
    try {
      await execAsync(`tmux kill-session -t ${sessionName}`);
      logger.debug(`Killed tmux session: ${sessionName}`);
    } catch (error) {
      logger.error('Failed to kill tmux session:', error);
    }
  }

  // Get session info
  async getSessionInfo(sessionName) {
    try {
      const { stdout: windows } = await execAsync(
        `tmux list-windows -t ${sessionName} -F "#{window_index}:#{window_name}:#{window_panes}"`
      );
      
      const windowList = windows.trim().split('\n').map(line => {
        const [index, name, panes] = line.split(':');
        return { index: parseInt(index), name, panes: parseInt(panes) };
      });

      return { sessionName, windows: windowList };
    } catch (error) {
      logger.error('Failed to get session info:', error);
      return null;
    }
  }

  // Spawn process attached to tmux
  spawnInTmux(sessionName, windowIndex = 0, paneId = null) {
    const target = paneId ? `${sessionName}:${paneId}` : `${sessionName}:${windowIndex}`;
    
    // Use tmux pipe-pane to capture output and send input
    const tmuxProcess = spawn('tmux', ['pipe-pane', '-t', target, '-o', 'cat']);
    
    // Also create a process to send input
    const sendInput = (data) => {
      exec(`tmux send-keys -t ${target} "${data.replace(/"/g, '\\"')}"`, (error) => {
        if (error) {
          logger.error('Failed to send input to tmux:', error);
        }
      });
    };

    return { tmuxProcess, sendInput };
  }
}

module.exports = new TmuxManager();