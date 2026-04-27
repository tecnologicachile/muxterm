/**
 * Bare-bones: log in, screenshot. Click, screenshot. Type, screenshot.
 * No `clear`, no Enters. Catch any visible delay or missing chars.
 */
const { test } = require('@playwright/test');
const BASE = 'https://192.168.10.150:3002';

test('Simplest typing test', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.locator('input').all();
  await inputs[0].fill('test');
  await inputs[1].fill('test123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/workspace', { timeout: 10000 });
  await page.waitForTimeout(3000);

  const native = page.locator('[data-component="TerminalNative"]').first();
  await native.screenshot({ path: '/tmp/simple-1-loaded.png' });
  console.log('saved /tmp/simple-1-loaded.png');

  await page.locator('[data-component="TerminalNative"] .xterm').first().click();
  await page.waitForTimeout(800);
  await native.screenshot({ path: '/tmp/simple-2-clicked.png' });
  console.log('saved /tmp/simple-2-clicked.png');

  // Type slowly so each char has its own moment to render
  console.log('Typing "hola" with 200ms gap, screenshot after each char');
  for (let i = 0; i < 'hola'.length; i++) {
    const ch = 'hola'[i];
    const t0 = Date.now();
    await page.keyboard.type(ch);
    // Poll for character appearance up to 2s
    let ms = -1;
    const target = 'hola'.slice(0, i + 1);
    for (let t = 0; t < 2000; t += 20) {
      const buf = await page.evaluate(() => {
        const rows = document.querySelector('[data-component="TerminalNative"] .xterm-rows');
        if (!rows) return '';
        return Array.from(rows.children).map(r => r.textContent).join('|');
      });
      if (buf.includes(target)) { ms = Date.now() - t0; break; }
      await page.waitForTimeout(20);
    }
    console.log(`  '${ch}' visible after ${ms === -1 ? 'TIMEOUT' : ms + ' ms'}`);
    await native.screenshot({ path: `/tmp/simple-3-typed-${i + 1}.png` });
    await page.waitForTimeout(200);
  }

  // Final read of all rows
  const all = await page.evaluate(() => {
    const rows = document.querySelector('[data-component="TerminalNative"] .xterm-rows');
    if (!rows) return [];
    return Array.from(rows.children).map(r => r.textContent.replace(/\s+$/, ''));
  });
  console.log('\nAll non-empty rows:');
  for (const l of all) if (l.trim()) console.log('  "' + l + '"');

  await ctx.close();
});
