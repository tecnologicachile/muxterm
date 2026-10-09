/**
 * Where things live.
 *
 * appRoot is the code: this checkout, or releases/X.Y.Z in a packaged
 * install. home is the installation: where .env, data/, certs/ and logs/
 * stay across versions. In a git checkout they are the same directory; in a
 * packaged install the service sets MUXTERM_HOME (and the updater, which
 * knows the layout, derives it from appRoot when the variable is missing).
 */
const path = require('path');
const fs = require('fs');

const appRoot = path.resolve(__dirname, '..');

function detectHome() {
  if (process.env.MUXTERM_HOME) return path.resolve(process.env.MUXTERM_HOME);
  // releases/<version> under an install root
  const parent = path.dirname(appRoot);
  if (path.basename(parent) === 'releases' && fs.existsSync(path.join(appRoot, 'RELEASE.json'))) return path.dirname(parent);
  return appRoot;
}

const home = detectHome();

module.exports = {
  appRoot,
  home,
  packaged: home !== appRoot,
  envFile: path.join(home, '.env'),
  dataDir: path.join(home, 'data'),
  certsDir: path.join(home, 'certs'),
  logsDir: path.join(home, 'logs'),
  releasesDir: path.join(home, 'releases'),
  currentLink: path.join(home, 'current'),
  tmuxConf: path.join(appRoot, '.tmux.webssh.conf'),
  allowedSigners: path.join(appRoot, 'release', 'allowed_signers')
};
