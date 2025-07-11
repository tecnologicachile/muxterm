const https = require('https');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

class UpdateChecker {
  constructor() {
    this.lastCheckFile = path.join(__dirname, '..', 'data', '.last-update-check');
    this.checkInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.currentVersion = require('../package.json').version;
  }

  async checkForUpdates() {
    try {
      // Check if we should skip based on last check time
      if (this.shouldSkipCheck()) {
        logger.debug('Skipping update check - too soon since last check');
        return null;
      }

      const latestRelease = await this.fetchLatestRelease();
      
      if (!latestRelease) {
        return null;
      }

      // Save last check time
      this.saveLastCheckTime();

      // Compare versions
      if (this.isNewerVersion(latestRelease.tag_name)) {
        return {
          current: this.currentVersion,
          latest: latestRelease.tag_name.replace('v', ''),
          url: latestRelease.html_url,
          changelog: this.parseChangelog(latestRelease.body),
          publishedAt: latestRelease.published_at
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to check for updates:', error);
      return null;
    }
  }

  shouldSkipCheck() {
    try {
      if (fs.existsSync(this.lastCheckFile)) {
        const lastCheck = parseInt(fs.readFileSync(this.lastCheckFile, 'utf8'));
        return Date.now() - lastCheck < this.checkInterval;
      }
      return false;
    } catch {
      return false;
    }
  }

  saveLastCheckTime() {
    try {
      fs.writeFileSync(this.lastCheckFile, Date.now().toString());
    } catch (error) {
      logger.error('Failed to save last check time:', error);
    }
  }

  fetchLatestRelease() {
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/tecnologicachile/muxterm/releases/latest',
        headers: {
          'User-Agent': 'MuxTerm-Update-Checker',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      https.get(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            resolve(release.tag_name ? release : null);
          } catch {
            resolve(null);
          }
        });
      }).on('error', () => {
        resolve(null);
      });
    });
  }

  isNewerVersion(latestTag) {
    const latest = latestTag.replace('v', '').split('.').map(Number);
    const current = this.currentVersion.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (latest[i] > current[i]) return true;
      if (latest[i] < current[i]) return false;
    }
    return false;
  }

  parseChangelog(body) {
    if (!body) return [];
    
    // Extract bullet points from release notes
    const lines = body.split('\n')
      .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))
      .map(line => line.trim().substring(2))
      .slice(0, 5); // Max 5 items

    return lines;
  }
}

module.exports = new UpdateChecker();