const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const GuacamoleLite = require('guacamole-lite');
const logger = require('./utils/logger');

const CIPHER = 'aes-256-cbc';

// Generate GUAC_SECRET if not provided (auto-save to .env)
if (!process.env.GUAC_SECRET) {
  const secret = crypto.randomBytes(16).toString('hex'); // 32 chars for aes-256
  process.env.GUAC_SECRET = secret;
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  if (!envContent.includes('GUAC_SECRET=')) {
    fs.appendFileSync(envPath, `\nGUAC_SECRET=${secret}\n`);
  }
}
const SECRET_KEY = process.env.GUAC_SECRET;

class GuacamoleManager {
  constructor() {
    this.guacServer = null;
  }

  init() {
    try {
      // Ensure drive redirection directory exists
      const driveRoot = '/tmp/guac-drive';
      if (!fs.existsSync(driveRoot)) {
        fs.mkdirSync(driveRoot, { recursive: true, mode: 0o777 });
      }

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

  _encryptToken(tokenObject) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(CIPHER, Buffer.from(SECRET_KEY), iv);
    let encrypted = cipher.update(JSON.stringify(tokenObject), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const data = { iv: iv.toString('base64'), value: encrypted };
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  // Map browser locale to Guacamole server-layout
  _resolveLayout(locale) {
    if (!locale) return 'failsafe';
    const lang = locale.toLowerCase().replace('_', '-');

    const layoutMap = {
      'es': 'es-es-qwerty',
      'es-es': 'es-es-qwerty',
      'es-latam': 'es-latam-qwerty',
      'es-ar': 'es-latam-qwerty',
      'es-mx': 'es-latam-qwerty',
      'es-cl': 'es-latam-qwerty',
      'es-co': 'es-latam-qwerty',
      'es-pe': 'es-latam-qwerty',
      'en': 'en-us-qwerty',
      'en-us': 'en-us-qwerty',
      'en-gb': 'en-gb-qwerty',
      'fr': 'fr-fr-azerty',
      'fr-fr': 'fr-fr-azerty',
      'fr-be': 'fr-be-azerty',
      'fr-ch': 'fr-ch-qwertz',
      'de': 'de-de-qwertz',
      'de-de': 'de-de-qwertz',
      'de-ch': 'de-ch-qwertz',
      'it': 'it-it-qwerty',
      'it-it': 'it-it-qwerty',
      'pt': 'pt-br-qwerty',
      'pt-br': 'pt-br-qwerty',
      'pt-pt': 'pt-pt-qwerty',
      'ja': 'ja-jp-qwerty',
      'ja-jp': 'ja-jp-qwerty',
      'sv': 'sv-se-qwerty',
      'sv-se': 'sv-se-qwerty',
      'da': 'da-dk-qwerty',
      'da-dk': 'da-dk-qwerty',
      'hu': 'hu-hu-qwertz',
      'hu-hu': 'hu-hu-qwertz',
      'tr': 'tr-tr-qwerty',
      'tr-tr': 'tr-tr-qwerty',
      'no': 'no-no-qwerty',
      'nb': 'no-no-qwerty',
      'nb-no': 'no-no-qwerty',
      'ro': 'ro-ro-qwerty',
      'ro-ro': 'ro-ro-qwerty',
      'pl': 'pl-pl-qwerty',
      'pl-pl': 'pl-pl-qwerty',
      'failsafe': 'failsafe'
    };

    // Try exact match, then language prefix, then failsafe
    return layoutMap[lang] || layoutMap[lang.split('-')[0]] || 'failsafe';
  }

  createToken(config) {
    const type = config._type || 'rdp';
    const layout = this._resolveLayout(config._keyboardLayout);
    console.log(`[GUAC] Creating ${type} token for:`, config.host, ':', config.port, 'user:', config.username, 'layout:', layout);

    if (type === 'vnc') {
      return this._encryptToken({
        connection: {
          type: 'vnc',
          settings: {
            hostname: config.host,
            port: config.port || 5900,
            password: config.password || ''
          }
        }
      });
    }

    // RDP
    return this._encryptToken({
      connection: {
        type: 'rdp',
        settings: {
          hostname: config.host,
          port: config.port || 3389,
          username: config.username,
          password: config.password || '',
          domain: config.domain || '',
          security: 'any',
          'ignore-cert': true,
          'resize-method': 'display-update',
          'server-layout': layout,
          'enable-drive': true,
          'drive-path': `/tmp/guac-drive/${config._userId || 'shared'}`,
          'create-drive-path': true,
          'drive-name': 'MuxTerm'
        }
      }
    });
  }
}

module.exports = new GuacamoleManager();
