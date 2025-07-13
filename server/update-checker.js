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

  async checkForUpdates(forceCheck = false) {
    try {
      // Check if we should skip based on last check time
      if (!forceCheck && this.shouldSkipCheck()) {
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
        path: '/repos/tecnologicachile/muxterm/releases',
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
            const releases = JSON.parse(data);
            if (!Array.isArray(releases) || releases.length === 0) {
              resolve(null);
              return;
            }

            // Find the release with the highest version number
            let latestRelease = releases[0];
            let latestVersion = this.parseVersion(latestRelease.tag_name);

            for (const release of releases) {
              if (release.draft || release.prerelease) continue;
              
              const version = this.parseVersion(release.tag_name);
              if (this.compareVersions(version, latestVersion) > 0) {
                latestVersion = version;
                latestRelease = release;
              }
            }

            resolve(latestRelease);
          } catch {
            resolve(null);
          }
        });
      }).on('error', () => {
        resolve(null);
      });
    });
  }

  parseVersion(versionTag) {
    return versionTag.replace('v', '').split('.').map(Number);
  }

  compareVersions(v1, v2) {
    for (let i = 0; i < 3; i++) {
      if (v1[i] > v2[i]) return 1;
      if (v1[i] < v2[i]) return -1;
    }
    return 0;
  }

  isNewerVersion(latestTag) {
    const latest = this.parseVersion(latestTag);
    const current = this.currentVersion.split('.').map(Number);
    return this.compareVersions(latest, current) > 0;
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