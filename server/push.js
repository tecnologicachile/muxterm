/**
 * Web Push to the user's devices.
 *
 * The page notifies while it is open; this reaches the phone in your pocket
 * with the tab closed or the screen off. Browsers subscribe through their
 * service worker (client/public/sw.js) and hand us the subscription, which we
 * keep per user and use when a Claude session needs them.
 *
 * VAPID keys are generated once and kept in .env, like the other secrets.
 */
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const logger = require('./utils/logger');

let database = null;
let q = null;
let ready = false;

function ensureKeys() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    const keys = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    const envPath = require('./paths').envFile;
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (!envContent.includes('VAPID_PUBLIC_KEY=')) {
      fs.appendFileSync(envPath, `\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`);
    }
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@muxterm.local',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

function init(deps) {
  database = deps.database;
  const db = database.db;
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      subscription TEXT NOT NULL,
      ua TEXT,
      created_at TEXT NOT NULL,
      last_ok_at TEXT,
      failures INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
  `);
  q = {
    upsert: db.prepare(`INSERT INTO push_subscriptions (user_id, endpoint, subscription, ua, created_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, subscription = excluded.subscription, ua = excluded.ua, failures = 0`),
    remove: db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?'),
    drop: db.prepare('DELETE FROM push_subscriptions WHERE id = ?'),
    forUser: db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?'),
    ok: db.prepare('UPDATE push_subscriptions SET last_ok_at = ?, failures = 0 WHERE id = ?'),
    fail: db.prepare('UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?')
  };
  try { ensureKeys(); ready = true; } catch (e) { logger.error('Web Push disabled: ' + e.message); }
}

function publicKey() { return ready ? process.env.VAPID_PUBLIC_KEY : null; }

function subscribe(userId, subscription, ua) {
  if (!q || !subscription || !subscription.endpoint) return false;
  q.upsert.run(userId, subscription.endpoint, JSON.stringify(subscription), String(ua || '').slice(0, 200), new Date().toISOString());
  return true;
}

function unsubscribe(userId, endpoint) {
  if (!q || !endpoint) return 0;
  return q.remove.run(endpoint, userId).changes;
}

function countFor(userId) { return q ? q.count.get(userId).n : 0; }

/**
 * Send to every device of the user. Gone subscriptions (404/410) are dropped;
 * other failures are counted and the subscription dropped after ten in a row.
 * @returns {Promise<number>} devices reached
 */
async function send(userId, payload) {
  if (!ready || !q) return 0;
  const subs = q.forUser.all(userId);
  if (!subs.length) return 0;
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(subs.map(async (row) => {
    try {
      await webpush.sendNotification(JSON.parse(row.subscription), body, { TTL: 10 * 60, urgency: 'high' });
      q.ok.run(new Date().toISOString(), row.id);
      sent++;
    } catch (e) {
      const code = e && e.statusCode;
      if (code === 404 || code === 410 || row.failures >= 9) q.drop.run(row.id);
      else q.fail.run(row.id);
      logger.warn(`push to ${String(row.endpoint).slice(0, 40)}… failed: ${code || e.message}`);
    }
  }));
  return sent;
}

module.exports = { init, publicKey, subscribe, unsubscribe, countFor, send };
