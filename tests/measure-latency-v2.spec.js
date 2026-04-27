/**
 * Latency v2 — uses window.__nativeTerm exposed by TerminalNative to read
 * the active buffer line via the canonical xterm.js API. Works regardless
 * of which renderer (DOM/Canvas/WebGL) is active.
 */
const { test } = require('@playwright/test');
const BASE = 'https://192.168.10.150:3002';

async function login(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.locator('input').all();
  await inputs[0].fill('test');
  await inputs[1].fill('test123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/workspace', { timeout: 10000 });
  await page.waitForTimeout(3000);
}

async function readActive(page) {
  return page.evaluate(() => {
    const t = window.__nativeTerm;
    if (!t) return null;
    const buf = t.buffer.active;
    const lines = [];
    for (let i = 0; i < buf.length; i++) {
      const line = buf.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    return { lines, cursorX: buf.cursorX, cursorY: buf.cursorY, cols: t.cols, rows: t.rows };
  });
}

async function pollFor(page, predicate, timeoutMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await readActive(page);
    if (snap && predicate(snap)) return Date.now() - start;
    await page.waitForTimeout(10);
  }
  return -1;
}

test('Latency v2 with WebGL renderer', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page);

  await page.locator('[data-component="TerminalNative"] .xterm').first().click();
  await page.waitForTimeout(800);

  const initial = await readActive(page);
  console.log('Initial buffer state:');
  console.log('  cols x rows:', initial.cols + 'x' + initial.rows);
  console.log('  cursor:     ', `(${initial.cursorX}, ${initial.cursorY})`);
  console.log('  non-empty lines:');
  for (const l of initial.lines) if (l.trim()) console.log('    "' + l + '"');

  // Make sure we land on a clean prompt line
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);

  const probe = 'ZQWRTY';
  const latencies = [];
  console.log('\nTyping with WebGL renderer:');
  let accum = '';
  for (const ch of probe) {
    accum += ch;
    const t0 = Date.now();
    await page.keyboard.type(ch);
    const ms = await pollFor(page, (s) => s.lines.some(l => l.includes(accum)), 1500);
    latencies.push(ms);
    console.log(`  '${ch}' visible after ${ms === -1 ? 'TIMEOUT' : ms + ' ms'}`);
    await page.waitForTimeout(120);
  }

  const sorted = [...latencies].filter(x => x !== -1).sort((a, b) => a - b);
  if (sorted.length) {
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
    console.log(`\nLatency: min=${min}  median=${median}  mean=${mean}  max=${max} (ms)`);
  }

  // Cursor sanity check after typing
  const after = await readActive(page);
  console.log('\nPost-typing cursor:');
  console.log('  cursor at:', `(${after.cursorX}, ${after.cursorY})`);
  // Find the line containing our probe and check cursor sits right after it
  const probeLine = after.lines.find(l => l.includes(probe));
  if (probeLine) {
    const probeEndCol = probeLine.indexOf(probe) + probe.length;
    console.log('  probe ends at col:', probeEndCol);
    console.log('  cursor matches probe end:', after.cursorX === probeEndCol);
  }

  await page.locator('[data-component="TerminalNative"]').first().screenshot({ path: '/tmp/latency-v2.png' });
  await ctx.close();
});
