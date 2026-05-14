/**
 * Clean cross-resolution test: kill any running app first, generate plain
 * shell content from PC viewport, then open in mobile viewport and inspect.
 */
const { test, devices } = require('@playwright/test');
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

test('Cross-resolution scroll: PC writes wide, mobile reads narrow', async ({ browser }) => {
  // PC phase
  const ctxPC = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const PC = await ctxPC.newPage();
  await login(PC);
  await PC.locator('iframe[src*="/ttyd/"]').first().click({ position: { x: 100, y: 100 } });
  await PC.waitForTimeout(500);

  // Multiple Ctrl+C and /exit to ensure we're at bash prompt, not in claude
  console.log('Force back to bash prompt');
  for (let i = 0; i < 3; i++) {
    await PC.keyboard.press('Control+c');
    await PC.waitForTimeout(200);
  }
  await PC.keyboard.type('/exit');
  await PC.keyboard.press('Enter');
  await PC.waitForTimeout(500);
  for (let i = 0; i < 3; i++) {
    await PC.keyboard.press('Control+c');
    await PC.waitForTimeout(200);
  }
  await PC.keyboard.type('exit');
  await PC.keyboard.press('Enter');
  await PC.waitForTimeout(500);
  await PC.keyboard.type('clear');
  await PC.keyboard.press('Enter');
  await PC.waitForTimeout(800);
  await PC.locator('iframe[src*="/ttyd/"]').first().screenshot({ path: '/tmp/xres-pc-cleared.png' });

  // Now generate distinguishable content
  console.log('Generate wide content from PC viewport');
  await PC.keyboard.type('echo "WIDE_PC_LINE: this line is intentionally very long and exceeds 100 characters to test how it wraps on a much narrower mobile viewport"');
  await PC.keyboard.press('Enter');
  await PC.waitForTimeout(500);
  await PC.keyboard.type('echo "+--------+--------+--------+"');
  await PC.keyboard.press('Enter');
  await PC.keyboard.type('echo "| col_a  | col_b  | col_c  |"');
  await PC.keyboard.press('Enter');
  await PC.keyboard.type('echo "+--------+--------+--------+"');
  await PC.keyboard.press('Enter');
  await PC.keyboard.type('echo "| 1      | 2      | 3      |"');
  await PC.keyboard.press('Enter');
  await PC.keyboard.type('echo "+--------+--------+--------+"');
  await PC.keyboard.press('Enter');
  await PC.keyboard.type('for i in $(seq 1 30); do echo "PC_LINE_$i_short"; done');
  await PC.keyboard.press('Enter');
  await PC.waitForTimeout(2000);

  await PC.locator('iframe[src*="/ttyd/"]').first().screenshot({ path: '/tmp/xres-pc-bottom.png' });

  // Scroll back in PC to see all
  const pcBox = await PC.locator('iframe[src*="/ttyd/"]').first().boundingBox();
  await PC.mouse.move(pcBox.x + pcBox.width/2, pcBox.y + pcBox.height/2);
  for (let i = 0; i < 5; i++) { await PC.mouse.wheel(0, -300); await PC.waitForTimeout(150); }
  await PC.locator('iframe[src*="/ttyd/"]').first().screenshot({ path: '/tmp/xres-pc-scrolled.png' });

  await ctxPC.close();

  // Mobile phase
  await new Promise((r) => setTimeout(r, 1500));
  const ctxMob = await browser.newContext({ ...devices['iPhone 14'], ignoreHTTPSErrors: true });
  const M = await ctxMob.newPage();
  await login(M);
  await M.waitForTimeout(3000); // give the iframe time to load + capture-pane

  // Take a screenshot of the mobile workspace BEFORE any scroll
  await M.screenshot({ path: '/tmp/xres-mob-load-full.png', fullPage: false });

  // Try to find iframe via locator first
  const mIframe = M.locator('iframe[src*="/ttyd/"]').first();
  const mIframeCount = await M.locator('iframe[src*="/ttyd/"]').count();
  console.log('Mobile ttyd iframes found:', mIframeCount);
  if (mIframeCount === 0) {
    console.log('No iframe — bail');
    await ctxMob.close();
    return;
  }
  const mBox = await mIframe.boundingBox();
  console.log('Mobile iframe box:', mBox);
  await mIframe.screenshot({ path: '/tmp/xres-mob-bottom.png' });

  // Touch swipe from top to bottom — that scrolls UP (older content)
  console.log('Touch swipe to scroll back');
  for (let i = 0; i < 8; i++) {
    await M.dispatchEvent(mIframe, 'touchstart', {
      touches: [{ clientX: mBox.x + mBox.width / 2, clientY: mBox.y + 60 }],
    }).catch(() => {});
    await M.dispatchEvent(mIframe, 'touchmove', {
      touches: [{ clientX: mBox.x + mBox.width / 2, clientY: mBox.y + mBox.height - 100 }],
    }).catch(() => {});
    await M.dispatchEvent(mIframe, 'touchend', { touches: [] }).catch(() => {});
    await M.waitForTimeout(250);
  }
  await mIframe.screenshot({ path: '/tmp/xres-mob-scrolled.png' });

  await ctxMob.close();
});
