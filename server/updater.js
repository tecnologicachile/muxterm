/**
 * Updates for packaged installs (docs/design/actualizaciones.md).
 *
 * A packaged install is home/releases/<version>/ with home/current pointing
 * at the one in service. This module polls the channel's manifest, decides
 * (newer, allowed, our architecture, our Node, within the rollout), downloads
 * the package, checks its hash and signature, unpacks it beside the others,
 * repoints `current` and restarts. The next start confirms health and, if
 * it never comes, this module turns `current` back and marks the version.
 *
 * A git checkout (no RELEASE.json, no releases/ parent) is a developer
 * install: this stays idle and update.sh keeps doing its job.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const paths = require('./paths');
const logger = require('./utils/logger');

const DEFAULT_MANIFEST = 'https://github.com/tecnologicachile/muxterm/releases/latest/download/stable.json';
// Overridable for tests (MUXTERM_UPDATE_CHECK_MS): seconds instead of hours.
const CHECK_EVERY_MS = parseInt(process.env.MUXTERM_UPDATE_CHECK_MS, 10) || 6 * 60 * 60 * 1000;
const JITTER_MS = Math.min(60 * 60 * 1000, Math.round(CHECK_EVERY_MS / 6));
const FIRST_CHECK_MS = Math.min(60 * 1000, CHECK_EVERY_MS);
const HEALTH_GRACE_MS = 60 * 1000;
const KEEP_RELEASES = 2;
const NS = 'muxterm-release';
const SIGNER = 'release@muxterm';

let io = null, settings = null, timer = null;
let current = null;         // RELEASE.json of the running version
let status = { mode: 'git', state: 'idle' };
let busy = false;

const stateFile = () => path.join(paths.home, 'updater.json');
const readState = () => { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (e) { return {}; } };
const writeState = (patch) => { const s = { ...readState(), ...patch }; fs.writeFileSync(stateFile(), JSON.stringify(s, null, 2)); return s; };

function arch() { return { x64: 'linux-x64', arm64: 'linux-arm64' }[process.arch] || null; }
function nodeMajor() { return process.versions.node.split('.')[0]; }
function parseVer(v) { return String(v).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0); }
function cmpVer(a, b) { const x = parseVer(a), y = parseVer(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }

function installId() {
  const s = readState();
  if (s.installId) return s.installId;
  return writeState({ installId: crypto.randomBytes(8).toString('hex') }).installId;
}
// Which percent of the rollout this install sits at: stable per install, uniform across installs.
function rolloutSlot() { return parseInt(crypto.createHash('sha256').update(installId()).digest('hex').slice(0, 8), 16) % 100; }

function manifestUrl() {
  const s = settings ? settings.read() : {};
  return process.env.MUXTERM_UPDATE_URL || s.updateUrl || DEFAULT_MANIFEST;
}

function fetch(url, { to, maxRedirects = 5, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('http:') ? http : https;
    const req = mod.get(url, { headers: { 'User-Agent': `muxterm-updater/${current ? current.version : 'git'}` } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        res.resume();
        return resolve(fetch(new URL(res.headers.location, url).toString(), { to, maxRedirects: maxRedirects - 1, timeoutMs }));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} for ${url}`)); }
      if (to) {
        const out = fs.createWriteStream(to);
        res.pipe(out);
        out.on('finish', () => resolve(to));
        out.on('error', reject);
      } else {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

// OpenSSH signature check with the key shipped in the running version.
function verifySignature(file, sigFile) {
  return new Promise((resolve) => {
    const p = execFile('ssh-keygen', ['-Y', 'verify', '-f', paths.allowedSigners, '-I', SIGNER, '-n', NS, '-s', sigFile], (err) => resolve(!err));
    p.stdin.on('error', () => {});
    fs.createReadStream(file).pipe(p.stdin);
  });
}

function run(cmd, args) {
  return new Promise((resolve, reject) => execFile(cmd, args, (err, out, errOut) => err ? reject(new Error(errOut || err.message)) : resolve(out)));
}

function publicStatus() {
  return { ...status, mode: paths.packaged ? 'package' : 'git', current: current ? current.version : require('../package.json').version, installId: paths.packaged ? installId() : undefined, slot: paths.packaged ? rolloutSlot() : undefined, state: status.state };
}

function emit(name, payload) { if (io) io.emit(name, payload); }

/** Read the manifest and say what, if anything, should be installed. */
async function check() {
  const raw = await fetch(manifestUrl());
  let m;
  try { m = JSON.parse(raw.toString('utf8')); } catch (e) { throw new Error('manifest is not JSON'); }
  // The manifest's own signature travels beside it.
  const tmp = path.join(paths.releasesDir, '.manifest.tmp');
  fs.mkdirSync(paths.releasesDir, { recursive: true });
  fs.writeFileSync(tmp, raw);
  await fetch(manifestUrl() + '.sig', { to: tmp + '.sig' });
  const ok = await verifySignature(tmp, tmp + '.sig');
  fs.rmSync(tmp, { force: true }); fs.rmSync(tmp + '.sig', { force: true });
  if (!ok) throw new Error('manifest signature does not verify');

  const st = readState();
  const decision = { manifest: m, version: m.version, apply: false, reason: '' };
  const cur = current.version;
  if (cmpVer(m.version, cur) <= 0) decision.reason = 'up to date';
  else if (m.minVersion && cmpVer(cur, m.minVersion) < 0) decision.reason = `needs at least ${m.minVersion} first`;
  else if (st.failed && st.failed[m.version]) decision.reason = `${m.version} failed here before: ${st.failed[m.version]}`;
  else if (!m.assets || !m.assets[arch()]) decision.reason = `no package for ${arch()}`;
  else if (m.node && String(m.node) !== nodeMajor()) decision.reason = `built for Node ${m.node}, this is Node ${nodeMajor()}`;
  else if (typeof m.rollout === 'number' && rolloutSlot() >= m.rollout) decision.reason = `not in this rollout yet (${m.rollout}%)`;
  else decision.apply = true;
  status = { ...status, state: 'idle', lastCheck: new Date().toISOString(), available: decision.apply ? m.version : null, reason: decision.reason };
  settings && settings.write({ lastAutoUpdateCheck: Date.now() });
  return decision;
}

/** Download, verify, unpack, switch, restart. */
async function apply(m) {
  if (busy) throw new Error('an update is already in progress');
  busy = true;
  const v = m.version;
  const asset = m.assets[arch()];
  const dir = path.join(paths.releasesDir, v);
  const tmpTar = path.join(paths.releasesDir, `.${v}.tar.gz`);
  try {
    status = { ...status, state: 'downloading', target: v };
    emit('update-progress', { version: v, state: 'downloading' });
    logger.info(`[updater] downloading ${v} from ${asset.url}`);
    await fetch(asset.url, { to: tmpTar, timeoutMs: 10 * 60 * 1000 });
    await fetch(asset.sig, { to: tmpTar + '.sig' });

    status = { ...status, state: 'verifying' };
    const sum = await sha256(tmpTar);
    if (sum !== asset.sha256) throw new Error(`sha256 mismatch (${sum.slice(0, 12)}… vs ${asset.sha256.slice(0, 12)}…)`);
    if (!(await verifySignature(tmpTar, tmpTar + '.sig'))) throw new Error('package signature does not verify');

    status = { ...status, state: 'unpacking' };
    fs.rmSync(dir + '.tmp', { recursive: true, force: true });
    fs.mkdirSync(dir + '.tmp', { recursive: true });
    await run('tar', ['-xzf', tmpTar, '-C', dir + '.tmp', '--strip-components=1']);
    const rel = JSON.parse(fs.readFileSync(path.join(dir + '.tmp', 'RELEASE.json'), 'utf8'));
    if (rel.version !== v) throw new Error(`package says ${rel.version}, manifest says ${v}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(dir + '.tmp', dir);

    // Switch: a new symlink renamed over the old one, so there is never a
    // moment without `current`.
    const previous = fs.existsSync(paths.currentLink) ? path.basename(fs.readlinkSync(paths.currentLink)) : null;
    const tmpLink = paths.currentLink + '.new';
    fs.rmSync(tmpLink, { force: true });
    fs.symlinkSync(path.join('releases', v), tmpLink);
    fs.renameSync(tmpLink, paths.currentLink);
    writeState({ pending: { version: v, previous, since: new Date().toISOString(), starts: 0 } });
    status = { ...status, state: 'restarting' };
    emit('update-progress', { version: v, state: 'restarting' });
    logger.info(`[updater] ${v} in place (previous ${previous || 'none'}); restarting`);
    setTimeout(restart, 1500);
    return { version: v, previous };
  } catch (e) {
    status = { ...status, state: 'idle', error: e.message };
    logger.error(`[updater] ${v}: ${e.message}`);
    throw e;
  } finally {
    fs.rmSync(tmpTar, { force: true }); fs.rmSync(tmpTar + '.sig', { force: true });
    fs.rmSync(dir + '.tmp', { recursive: true, force: true });
    busy = false;
  }
}

// Ask systemd when we can; otherwise leave and let Restart=always bring the
// new version up.
function restart() {
  const unit = process.env.MUXTERM_UNIT || 'muxterm';
  const p = spawn('systemctl', ['restart', unit], { detached: true, stdio: 'ignore' });
  p.on('error', () => process.exit(0));
  p.unref();
  setTimeout(() => process.exit(0), 5000);
}

/** Put `current` back on the previous version and remember why. */
function rollback(pending, reason) {
  logger.error(`[updater] ${pending.version} did not come up healthy (${reason}); back to ${pending.previous}`);
  const failed = { ...(readState().failed || {}), [pending.version]: reason };
  if (pending.previous && fs.existsSync(path.join(paths.releasesDir, pending.previous))) {
    const tmpLink = paths.currentLink + '.new';
    fs.rmSync(tmpLink, { force: true });
    fs.symlinkSync(path.join('releases', pending.previous), tmpLink);
    fs.renameSync(tmpLink, paths.currentLink);
  }
  writeState({ pending: null, failed, lastRollback: { version: pending.version, reason, at: new Date().toISOString() } });
  restart();
}

function prune() {
  try {
    const keep = new Set([current.version, readState().lastGood].filter(Boolean));
    const all = fs.readdirSync(paths.releasesDir).filter(d => /^\d+\.\d+\.\d+/.test(d))
      .sort((a, b) => cmpVer(b, a));
    for (const d of all.slice(KEEP_RELEASES)) {
      if (keep.has(d)) continue;
      fs.rmSync(path.join(paths.releasesDir, d), { recursive: true, force: true });
      logger.info(`[updater] removed old release ${d}`);
    }
  } catch (e) { /* next time */ }
}

/**
 * Called once the server listens. If this start is the first of a freshly
 * switched version, confirm health shortly and record it; a version that
 * keeps crashing before reaching here is rolled back by `starts`.
 */
function confirmStart(port, isHttps) {
  const st = readState();
  const pending = st.pending;
  if (!pending) return;
  if (pending.version !== current.version) {
    // We are the previous version, started after a rollback: nothing pending any more.
    writeState({ pending: null });
    return;
  }
  setTimeout(async () => {
    try {
      const mod = isHttps ? https : http;
      const ok = await new Promise((resolve) => {
        const req = mod.get({ host: '127.0.0.1', port, path: '/api/health', rejectUnauthorized: false, timeout: 5000 }, (res) => {
          let b = ''; res.on('data', d => b += d); res.on('end', () => { try { resolve(JSON.parse(b).version === current.version); } catch (e) { resolve(false); } });
        });
        req.on('error', () => resolve(false)); req.on('timeout', () => { req.destroy(); resolve(false); });
      });
      if (!ok) return rollback(pending, 'health check failed');
      writeState({ pending: null, lastGood: current.version, appliedAt: new Date().toISOString() });
      logger.info(`[updater] ${current.version} is up and healthy`);
      emit('update-applied', { version: current.version, previous: pending.previous });
      prune();
    } catch (e) { rollback(pending, e.message); }
  }, 5000);
}

async function tick(force = false) {
  try {
    if (!force && settings && settings.read().autoUpdateEnabled === false) return null;
    const d = await check();
    if (d.apply) {
      emit('update-available', { version: d.version });
      await apply(d.manifest);
    }
    return d;
  } catch (e) {
    status = { ...status, state: 'idle', error: e.message, lastCheck: new Date().toISOString() };
    logger.warn(`[updater] check: ${e.message}`);
    return null;
  }
}

function init(deps) {
  io = deps.io; settings = deps.settings;
  try { current = JSON.parse(fs.readFileSync(path.join(paths.appRoot, 'RELEASE.json'), 'utf8')); } catch (e) { current = null; }
  if (!paths.packaged || !current) {
    status = { mode: 'git', state: 'idle', reason: 'not a packaged install; update.sh handles this checkout' };
    return;
  }
  status = { mode: 'package', state: 'idle' };
  // A version that crashed before confirming health twice is not coming back.
  const st = readState();
  if (st.pending && st.pending.version === current.version) {
    const starts = (st.pending.starts || 0) + 1;
    if (starts > 2) return rollback(st.pending, `crashed ${starts - 1} times at start`);
    writeState({ pending: { ...st.pending, starts } });
    // If health never gets confirmed (the server hangs before listening), fall back.
    setTimeout(() => { const s = readState(); if (s.pending && s.pending.version === current.version) rollback(s.pending, 'no health within a minute'); }, HEALTH_GRACE_MS).unref();
  }
  const first = FIRST_CHECK_MS + Math.random() * 4 * FIRST_CHECK_MS;
  setTimeout(() => { tick(); schedule(); }, first).unref();
  logger.info(`[updater] packaged install ${current.version}; first check in ${Math.round(first / 1000)} s`);
}

function schedule() {
  const wait = CHECK_EVERY_MS + (Math.random() * 2 - 1) * JITTER_MS;
  timer = setTimeout(() => { tick(); schedule(); }, wait);
  timer.unref();
}

module.exports = { init, check, apply, tick, confirmStart, status: publicStatus, cmpVer };
