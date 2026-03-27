const crypto = require('crypto');
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
      this.guacServer = new GuacamoleLite(
        { port: this.guacPort },
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
    } catch (error) {
      logger.error('Failed to initialize Guacamole proxy:', error);
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
          'resize-method': 'display-update'
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
