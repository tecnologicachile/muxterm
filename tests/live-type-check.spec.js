/**
 * Live: type a command, screenshot WHILE typing and right after Enter.
 * Pure visual evidence that input lands and output renders cleanly.
 */
const { test } = require('@playwright/test');

const BASE = 'https://192.168.10.150:3002';

test('Live: type a command and capture every step', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  console.log('1. Login');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.locator('input').all();
  await inputs[0].fill('test');
  await inputs[1].fill('test123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/workspace', { timeout: 10000 });
  await page.waitForTimeout(2500);

  console.log('2. Focus Terminal 1');
  await page.locator('[data-component="TerminalNative"] .xterm').first().click();
  await page.waitForTimeout(500);

  console.log('3. Clear and Enter');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.type('clear');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  await page.locator('[data-component="TerminalNative"]').first().screenshot({ path: '/tmp/live-00-clean.png' });
  console.log('   /tmp/live-00-clean.png saved');

  console.log('4. Type "echo SOY_PLAYWRIGHT" character-by-character');
  // Slow per-key so we can see the prompt grow on screen.
  for (const ch of 'echo SOY_PLAYWRIGHT') {
    await page.keyboard.type(ch);
    await page.waitForTimeout(40);
  }
  await page.locator('[data-component="TerminalNative"]').first().screenshot({ path: '/tmp/live-01-mid-typing.png' });
  console.log('   /tmp/live-01-mid-typing.png saved (BEFORE pressing Enter)');

  console.log('5. Press Enter');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await page.locator('[data-component="TerminalNative"]').first().screenshot({ path: '/tmp/live-02-after-enter.png' });
  console.log('   /tmp/live-02-after-enter.png saved');

  console.log('6. Read what xterm shows now');
  const lines = await page.evaluate(() => {
    const rows = document.querySelector('[data-component="TerminalNative"] .xterm-rows');
    if (!rows) return [];
    return Array.from(rows.children).map(r => r.textContent.replace(/\s+$/, ''));
  });
  console.log('   non-empty rows:');
  for (const l of lines) {
    if (l.trim()) console.log('     "' + l + '"');
  }

  console.log('7. Type a multi-line loop and capture');
  await page.keyboard.type('for i in 1 2 3 4 5; do echo line $i; done');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.locator('[data-component="TerminalNative"]').first().screenshot({ path: '/tmp/live-03-loop.png' });
  console.log('   /tmp/live-03-loop.png saved');

  const loopLines = await page.evaluate(() => {
    const rows = document.querySelector('[data-component="TerminalNative"] .xterm-rows');
    if (!rows) return [];
    return Array.from(rows.children).map(r => r.textContent.replace(/\s+$/, ''));
  });
  console.log('   non-empty rows after loop:');
  for (const l of loopLines) {
    if (l.trim()) console.log('     "' + l + '"');
  }

  await ctx.close();
  console.log('\nDone.');
});
