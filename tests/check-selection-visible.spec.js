/**
 * Verify that Shift+drag selection is visible (not black-on-black).
 * After mode-style was switched from "bg=black,fg=black" to "reverse"
 * the highlighted text should appear as a clearly visible block.
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
  await page.waitForTimeout(2500);
}

test('Shift+drag selection is visually visible', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page);

  const iframe = page.locator('iframe[src*="/ttyd/"]').first();
  await iframe.click({ position: { x: 100, y: 100 } });
  await page.waitForTimeout(500);

  console.log('Generate output');
  await page.keyboard.type('for i in $(seq 1 60); do echo SELECTABLE_LINE_$i; done');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  await iframe.screenshot({ path: '/tmp/sel-1-baseline.png' });
  console.log('  /tmp/sel-1-baseline.png saved');

  // Get bounding box of iframe so we can compute drag coords
  const box = await iframe.boundingBox();
  console.log('iframe box:', box);

  // Make a Shift+drag selection across two lines roughly mid-iframe
  const startX = box.x + 60;
  const startY = box.y + box.height / 2 - 40;
  const endX = box.x + 400;
  const endY = box.y + box.height / 2 + 20;

  console.log(`Shift+drag from (${Math.round(startX)},${Math.round(startY)}) to (${Math.round(endX)},${Math.round(endY)})`);
  await page.keyboard.down('Shift');
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move in steps to simulate a real drag
  await page.mouse.move((startX + endX) / 2, (startY + endY) / 2, { steps: 8 });
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForTimeout(800);

  await iframe.screenshot({ path: '/tmp/sel-2-shift-drag.png' });
  console.log('  /tmp/sel-2-shift-drag.png saved (after Shift+drag)');

  // Also try plain wheel scroll up to verify mode-style on tmux copy-mode header
  console.log('Wheel up to enter tmux copy-mode (mode-style applies here too)');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(150);
  }
  await iframe.screenshot({ path: '/tmp/sel-3-wheel-copymode.png' });
  console.log('  /tmp/sel-3-wheel-copymode.png saved (wheeled into copy-mode)');

  await ctx.close();
});
