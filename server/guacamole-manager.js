const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const GuacamoleLite = require('guacamole-lite');
const logger = require('./utils/logger');

const CIPHER = 'aes-256-cbc';
const SECRET_KEY = process.env.GUAC_SECRET || 'MuxTermGuacamoleSecretKey32Bytes';

class GuacamoleManager {
  constructor() {
    this.guacServer = null;
  }

  init() {
    try {
      this.guacPort = 4823;

      // Load SSL certs if available (same certs as main server)
      const certsDir = path.join(__dirname, '..', 'certs');
      let wsOptions = { port: this.guacPort };
      if (fs.existsSync(certsDir)) {
        const files = fs.readdirSync(certsDir);
        const certFile = files.find(f => f.endsWith('.pem') && !f.includes('-key') && !f.includes('rootCA'));
        const keyFile = files.find(f => f.endsWith('-key.pem'));
        if (certFile && keyFile) {
          const https = require('https');
          const sslServer = https.createServer({
            cert: fs.readFileSync(path.join(certsDir, certFile)),
            key: fs.readFileSync(path.join(certsDir, keyFile))
          });
          sslServer.listen(this.guacPort);
          wsOptions = { server: sslServer };
          console.log('[GUAC] WSS enabled on port', this.guacPort);
        }
      }

      this.guacServer = new GuacamoleLite(
        wsOptions,
        { host: '127.0.0.1', port: 4822 },
        {
          crypt: {
            cypher: CIPHER,
            key: SECRET_KEY
          },
          connectionDefaultSettings: {
            rdp: {
              'security': 'any',
              'ignore-cert': true,
              'enable-wallpaper': false,
              'resize-method': 'display-update'
            }
          },
          allowedUnencryptedConnectionSettings: {
            rdp: ['width', 'height', 'dpi']
          },
          log: {
            level: 'VERBOSE'
          }
        }
      );

      this.guacServer.on('open', (clientConnection) => {
        console.log('[GUAC] Connection opened');
      });

      this.guacServer.on('close', (clientConnection) => {
        console.log('[GUAC] Connection closed');
      });

      this.guacServer.on('error', (clientConnection, error) => {
        console.log('[GUAC] Error:', error);
      });

      logger.info(`Guacamole proxy initialized on port ${this.guacPort}`);

      // Clean up old drive files every hour
      setInterval(() => this.cleanupDriveFiles(), 60 * 60 * 1000);
    } catch (error) {
      logger.error('Failed to initialize Guacamole proxy:', error);
    }
  }

  cleanupDriveFiles() {
    const driveRoot = '/tmp/guac-drive';
    if (!fs.existsSync(driveRoot)) return;

    const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
    const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100MB per user
    const now = Date.now();

    try {
      const userDirs = fs.readdirSync(driveRoot);
      for (const userDir of userDirs) {
        const userPath = path.join(driveRoot, userDir);
        if (!fs.statSync(userPath).isDirectory()) continue;

        let totalSize = 0;
        const files = [];

        // Collect files with stats
        const walkDir = (dir) => {
          for (const name of fs.readdirSync(dir)) {
            const filePath = path.join(dir, name);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
              walkDir(filePath);
            } else {
              files.push({ path: filePath, mtime: stat.mtimeMs, size: stat.size });
              totalSize += stat.size;
            }
          }
        };
        walkDir(userPath);

        // Delete files older than 24h
        for (const file of files) {
          if (now - file.mtime > MAX_AGE_MS) {
            fs.unlinkSync(file.path);
            totalSize -= file.size;
          }
        }

        // If still over 100MB, delete oldest first
        if (totalSize > MAX_SIZE_BYTES) {
          const remaining = files
            .filter(f => fs.existsSync(f.path))
            .sort((a, b) => a.mtime - b.mtime);
          for (const file of remaining) {
            if (totalSize <= MAX_SIZE_BYTES) break;
            fs.unlinkSync(file.path);
            totalSize -= file.size;
          }
        }
      }
    } catch (e) {
      // Cleanup errors are non-fatal
    }
  }

  createToken(rdpConfig) {
    const tokenObject = {
      connection: {
        type: 'rdp',
        settings: {
          hostname: rdpConfig.host,
          port: rdpConfig.port || 3389,
          username: rdpConfig.username,
          password: rdpConfig.password || '',
          domain: rdpConfig.domain || '',
          security: 'any',
          'ignore-cert': true,
          'resize-method': 'display-update',
          'server-layout': 'en-us-qwerty',
          'enable-drive': true,
          'drive-path': `/tmp/guac-drive/${rdpConfig._userId || 'shared'}`,
          'create-drive-path': true,
          'drive-name': 'MuxTerm'
        }
      }
    };

    console.log('[GUAC] Creating token for:', rdpConfig.host, ':', rdpConfig.port, 'user:', rdpConfig.username);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(CIPHER, Buffer.from(SECRET_KEY), iv);
    let encrypted = cipher.update(JSON.stringify(tokenObject), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const data = { iv: iv.toString('base64'), value: encrypted };
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }
}

module.exports = new GuacamoleManager();
