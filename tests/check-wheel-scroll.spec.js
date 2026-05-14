/**
 * Diagnose: when user scrolls the wheel inside Terminal 1, does xterm's
 * viewportY change (scroll within the xterm scrollback) or does it
 * stay put (meaning the wheel is being absorbed elsewhere)?
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

test('Wheel scroll inside iframe ttyd', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page);

  // Click on first ttyd iframe to focus it
  const iframe = page.locator('iframe[src*="/ttyd/"]').first();
  await iframe.click({ position: { x: 100, y: 100 } });
  await page.waitForTimeout(500);

  console.log('Generate enough output to overflow the viewport');
  await page.keyboard.type('for i in $(seq 1 200); do echo line_$i; done');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);

  // Read xterm's buffer state from inside the iframe
  const before = await page.frameLocator('iframe[src*="/ttyd/"]').first().locator('body').evaluate(() => {
    const t = window.term;
    if (!t) return { error: 'no window.term in iframe' };
    return {
      cols: t.cols, rows: t.rows,
      bufferLen: t.buffer.active.length,
      viewportY: t.buffer.active.viewportY,
      baseY: t.buffer.active.baseY,
      scrollback: t.options ? t.options.scrollback : 'unknown',
    };
  });
  console.log('Before wheel:', before);

  // Scroll wheel up over the iframe
  console.log('Scrolling wheel up 5x with deltaY=-500');
  const box = await iframe.boundingBox();
  for (let i = 0; i < 5; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(150);
  }

  const after = await page.frameLocator('iframe[src*="/ttyd/"]').first().locator('body').evaluate(() => {
    const t = window.term;
    if (!t) return { error: 'no window.term in iframe' };
    return {
      cols: t.cols, rows: t.rows,
      bufferLen: t.buffer.active.length,
      viewportY: t.buffer.active.viewportY,
      baseY: t.buffer.active.baseY,
      scrollback: t.options ? t.options.scrollback : 'unknown',
    };
  });
  console.log('After wheel:', after);

  if (before.viewportY !== after.viewportY) {
    console.log(`viewportY changed: ${before.viewportY} → ${after.viewportY} → wheel scrolls xterm ✓`);
  } else {
    console.log(`viewportY unchanged at ${before.viewportY} → wheel NOT scrolling xterm ✗`);
  }

  await iframe.screenshot({ path: '/tmp/wheel-test.png' });
  await ctx.close();
});
