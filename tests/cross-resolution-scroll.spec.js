/**
 * Verify how scrollback rendering looks when viewed from a different
 * resolution than the one that generated the content.
 *
 * Phase 1: in PC viewport (1600x900) generate output that includes wide lines
 * + claude-style fixed-width art.
 * Phase 2: close and open in mobile viewport (iPhone 14, ~390x844). Scroll
 * back into the history and take screenshots to inspect the rewrap.
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

test('Scroll history rendered across PC->mobile viewports', async ({ browser }) => {
  // Phase 1: PC generates content
  const ctxPC = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const PC = await ctxPC.newPage();
  await login(PC);
  await PC.locator('iframe[src*="/ttyd/"]').first().click({ position: { x: 100, y: 100 } });
  await PC.waitForTimeout(500);
  await PC.keyboard.press('Enter');
  await PC.waitForTimeout(300);
  await PC.keyboard.type('clear');
  await PC.keyboard.press('Enter');
  await PC.waitForTimeout(500);

  // Wide line that exceeds mobile width (40 cols ~)
  console.log('Generate wide content from PC');
  await PC.keyboard.type('echo "================ WIDE_PC_LINE_THIS_HAS_OVER_120_CHARACTERS_TO_TEST_HOW_IT_WRAPS_ON_MOBILE_VIEWPORT_=========="');
  await PC.keyboard.press('Enter');
  await PC.waitForTimeout(800);
  await PC.keyboard.type('echo "Short PC line"');
  await PC.keyboard.press('Enter');
  await PC.waitForTimeout(500);
  // ASCII art block
  await PC.keyboard.type(`echo "+--------+--------+"; echo "| col_a  | col_b  |"; echo "+--------+--------+"; echo "| 1      | 2      |"; echo "+--------+--------+"`);
  await PC.keyboard.press('Enter');
  await PC.waitForTimeout(800);
  // 30 short lines for scrolling
  await PC.keyboard.type('for i in $(seq 1 30); do echo PC_LINE_$i; done');
  await PC.keyboard.press('Enter');
  await PC.waitForTimeout(2000);

  await PC.locator('iframe[src*="/ttyd/"]').first().screenshot({ path: '/tmp/cross-pc-bottom.png' });
  console.log('  /tmp/cross-pc-bottom.png — PC view bottom');
  // Scroll back to see the wide line
  const pcBox = await PC.locator('iframe[src*="/ttyd/"]').first().boundingBox();
  await PC.mouse.move(pcBox.x + pcBox.width/2, pcBox.y + pcBox.height/2);
  for (let i = 0; i < 6; i++) { await PC.mouse.wheel(0, -300); await PC.waitForTimeout(150); }
  await PC.locator('iframe[src*="/ttyd/"]').first().screenshot({ path: '/tmp/cross-pc-scrolled.png' });
  console.log('  /tmp/cross-pc-scrolled.png — PC view scrolled');

  await ctxPC.close();
  console.log('PC context closed.');

  // Phase 2: mobile opens fresh
  await new Promise((r) => setTimeout(r, 1000));
  const ctxMob = await browser.newContext({ ...devices['iPhone 14'], ignoreHTTPSErrors: true });
  const M = await ctxMob.newPage();
  await login(M);
  await M.waitForTimeout(2000);

  await M.locator('iframe[src*="/ttyd/"]').first().screenshot({ path: '/tmp/cross-mob-load.png' });
  console.log('  /tmp/cross-mob-load.png — mobile fresh load');

  // Now scroll back via touch swipe
  const mBox = await M.locator('iframe[src*="/ttyd/"]').first().boundingBox();
  console.log('Mobile iframe box:', mBox);
  for (let i = 0; i < 6; i++) {
    await M.dispatchEvent('iframe[src*="/ttyd/"]', 'touchstart', { touches: [{ clientX: mBox.x + mBox.width/2, clientY: mBox.y + 80 }] });
    await M.dispatchEvent('iframe[src*="/ttyd/"]', 'touchmove', { touches: [{ clientX: mBox.x + mBox.width/2, clientY: mBox.y + mBox.height - 80 }] });
    await M.dispatchEvent('iframe[src*="/ttyd/"]', 'touchend', { touches: [] });
    await M.waitForTimeout(300);
  }
  await M.locator('iframe[src*="/ttyd/"]').first().screenshot({ path: '/tmp/cross-mob-scrolled.png' });
  console.log('  /tmp/cross-mob-scrolled.png — mobile after wheel-up via touch');

  await ctxMob.close();
});
