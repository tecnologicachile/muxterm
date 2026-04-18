const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '..', 'data', 'system-settings.json');

const DEFAULTS = {
  autoUpdateEnabled: true,
  lastAutoUpdateCheck: null,
  lastAutoUpdateTriggered: null
};

function read() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return { ...DEFAULTS };
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const data = JSON.parse(raw);
    return { ...DEFAULTS, ...data };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

function write(settings) {
  try {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const current = read();
    const merged = { ...current, ...settings };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2));
    return merged;
  } catch (e) {
    return null;
  }
}

module.exports = { read, write, DEFAULTS };
