/**
 * Diagnose claude code rendering on LXC Terminal 1.
 * Open Terminal 1, run claude, take a series of screenshots over time
 * to capture any rendering glitches (overlapping text, alt-screen
 * leaks, scroll duplication).
 */
const { test } = require('@playwright/test');
const BASE = 'https://192.168.10.150:3002';

test('Inspect claude rendering on LXC', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.locator('input').all();
  await inputs[0].fill('test');
  await inputs[1].fill('test123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/workspace', { timeout: 10000 });
  await page.waitForTimeout(2500);

  const iframe = page.locator('iframe[src*="/ttyd/"]').first();
  await iframe.click({ position: { x: 100, y: 100 } });
  await page.waitForTimeout(500);

  // Clear and confirm we are on a clean prompt
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.type('clear');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  await iframe.screenshot({ path: '/tmp/claude-0-pre.png' });
  console.log('  /tmp/claude-0-pre.png — prompt clean');

  // Check claude is installed
  await page.keyboard.type('which claude && claude --version 2>&1 | head -2');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  await iframe.screenshot({ path: '/tmp/claude-1-version.png' });
  console.log('  /tmp/claude-1-version.png — version check');

  // Launch claude
  console.log('Launching claude');
  await page.keyboard.type('claude');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  await iframe.screenshot({ path: '/tmp/claude-2-launch.png' });
  console.log('  /tmp/claude-2-launch.png — claude launched');

  // After 1s more (in case there's a banner / login prompt that takes time)
  await page.waitForTimeout(2000);
  await iframe.screenshot({ path: '/tmp/claude-3-stable.png' });
  console.log('  /tmp/claude-3-stable.png — stable view');

  // Type a small prompt and Enter (in case claude is at a prompt)
  await page.keyboard.type('hola');
  await page.waitForTimeout(800);
  await iframe.screenshot({ path: '/tmp/claude-4-typed.png' });
  console.log('  /tmp/claude-4-typed.png — typed something');

  // Try Ctrl+C to bail safely
  await page.keyboard.press('Control+c');
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+c');
  await page.waitForTimeout(800);
  await iframe.screenshot({ path: '/tmp/claude-5-after-ctrlc.png' });
  console.log('  /tmp/claude-5-after-ctrlc.png — after ctrl+c');

  await ctx.close();
});
