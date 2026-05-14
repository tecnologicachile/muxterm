/**
 * Quick reality check against PRODUCTION (local 192.168.10.236, v1.1.59,
 * ttyd-based). Open the same workspace in two contexts. Type in one,
 * see if the other shows it in real time. If yes, the whole Option A
 * experiment was unnecessary — production already does multi-client.
 */
const { test } = require('@playwright/test');
const BASE = 'https://192.168.10.150:3002';

async function login(page, user, pass) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.locator('input').all();
  await inputs[0].fill(user);
  await inputs[1].fill(pass);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/workspace', { timeout: 10000 });
  await page.waitForTimeout(2500);
}

test('Production ttyd: do two browsers share live output?', async ({ browser }) => {
  // First we need to know what users exist in local production.
  // Try common defaults; the script will tell us if login fails.
  const ctxA = await browser.newContext({ ignoreHTTPSErrors: true });
  const A = await ctxA.newPage();
  try {
    await login(A, 'test', 'test123');
    console.log('Logged in to production as test/test123');
  } catch (e) {
    await A.screenshot({ path: '/tmp/prod-login-failed.png' });
    console.log('Login failed — see /tmp/prod-login-failed.png. Exiting.');
    await ctxA.close();
    process.exit(2);
  }

  const ctxB = await browser.newContext({ ignoreHTTPSErrors: true });
  const B = await ctxB.newPage();
  await login(B, 'test', 'test123');

  console.log('Both contexts on /workspace. Inspecting iframes...');
  const iframesA = await A.locator('iframe[src*="/ttyd/"]').count();
  const iframesB = await B.locator('iframe[src*="/ttyd/"]').count();
  console.log('  A ttyd iframes:', iframesA);
  console.log('  B ttyd iframes:', iframesB);

  if (iframesA === 0) {
    console.log('No ttyd iframe in production? Take screenshot and bail.');
    await A.screenshot({ path: '/tmp/prod-A-no-iframe.png' });
    await ctxA.close(); await ctxB.close();
    return;
  }

  // Focus A's first ttyd iframe and type
  console.log('Typing into A\'s first ttyd iframe...');
  const frameA = A.frameLocator('iframe[src*="/ttyd/"]').first();
  // Click somewhere in the frame to focus
  await A.locator('iframe[src*="/ttyd/"]').first().click({ position: { x: 50, y: 50 } });
  await A.waitForTimeout(800);
  const probe = `PROD_MULTI_${Date.now().toString(36)}`;
  await A.keyboard.type(`echo ${probe}`);
  await A.keyboard.press('Enter');
  await A.waitForTimeout(2500);

  await A.screenshot({ path: '/tmp/prod-A-after.png', fullPage: false });
  await B.screenshot({ path: '/tmp/prod-B-after.png', fullPage: false });
  console.log('Screenshots saved: /tmp/prod-A-after.png, /tmp/prod-B-after.png');

  // Read text from inside ttyd iframe in B (where the test did NOT type)
  const aText = await frameA.locator('body').textContent().catch(() => '');
  const frameB = B.frameLocator('iframe[src*="/ttyd/"]').first();
  const bText = await frameB.locator('body').textContent().catch(() => '');
  console.log('   A frame body length:', aText.length, 'has probe:', aText.includes(probe));
  console.log('   B frame body length:', bText.length, 'has probe:', bText.includes(probe));

  await ctxA.close();
  await ctxB.close();
});
