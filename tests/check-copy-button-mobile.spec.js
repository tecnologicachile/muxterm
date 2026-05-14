/**
 * Verify the Copy terminal content button (📋) is visible and usable on
 * mobile viewport in production muxterm.
 */
const { test, devices } = require('@playwright/test');
const BASE = 'https://192.168.10.150:3002';

test('Copy button visible on mobile', async ({ browser }) => {
  const ctx = await browser.newContext({
    ...devices['iPhone 14'],
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.locator('input').all();
  await inputs[0].fill('test');
  await inputs[1].fill('test123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/workspace', { timeout: 10000 });
  await page.waitForTimeout(2500);

  // Look for the Copy button (title contains "Copy terminal content")
  const copyBtns = await page.locator('button[title*="Copy"]').count();
  const allCopyBtns = await page.locator('[title*="Copy"]').count();
  console.log('Buttons with title "Copy":', copyBtns);
  console.log('Any element with title "Copy":', allCopyBtns);

  // Try clicking and see if a dialog opens
  if (allCopyBtns > 0) {
    const firstCopy = page.locator('[title*="Copy"]').first();
    const isVisible = await firstCopy.isVisible();
    const box = await firstCopy.boundingBox();
    console.log('First copy element visible:', isVisible);
    console.log('Bounding box:', box);
  }

  await page.screenshot({ path: '/tmp/mobile-copy-check.png', fullPage: false });

  await ctx.close();
});
