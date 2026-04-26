/**
 * Reproduce the user's report: open /test/native in Multi mode,
 * Attach, do NOTHING else, and check whether the component shows
 * "Connecting…" or progresses to a usable terminal.
 */
const { test } = require('@playwright/test');

const BASE = 'https://192.168.10.150:3002';
const USER = 'test';
const PASS = 'test123';

test('multi-pane Attach (no split) does NOT stay on "Connecting…"', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => console.log('[browser]', m.type(), m.text().substring(0, 250)));

  // Login
  await page.goto(BASE);
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.locator('input').all();
  await inputs[0].fill(USER);
  await inputs[1].fill(PASS);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1500);

  // Use the DEFAULT session name (likely already exists from prior runs)
  // — this is exactly what the user does when they click Attach.
  await page.goto(`${BASE}/test/native?v=` + Date.now());
  await page.waitForTimeout(800);

  console.log('Click Attach with default session name');
  await page.locator('button', { hasText: /^Attach$/i }).click();

  // Wait long enough for the refresh-client -S kick + any fallbacks
  await page.waitForTimeout(5000);

  console.log('After 5s, what does the page show?');
  const bodyText = await page.locator('body').textContent();
  const hasConnecting = bodyText.includes('Connecting');
  const xtermCount = await page.locator('.xterm').count();
  console.log('  has "Connecting…"?:', hasConnecting);
  console.log('  .xterm count:', xtermCount);

  await page.screenshot({ path: '/tmp/multipane-no-split.png', fullPage: true });

  console.log('');
  console.log(!hasConnecting && xtermCount >= 1 ? 'PASS — terminal usable' : 'FAIL — stuck on Connecting…');

  await ctx.close();
});
