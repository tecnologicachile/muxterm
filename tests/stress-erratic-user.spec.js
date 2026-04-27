/**
 * Stress test — simulate erratic user behaviour and capture screenshots
 * for human review. No assertions on rendering: the image is the test.
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
  await page.waitForTimeout(3000);
}

async function focus(page) {
  await page.locator('[data-component="TerminalNative"] .xterm').first().click();
  await page.waitForTimeout(400);
}

async function shot(page, label) {
  await page.locator('[data-component="TerminalNative"]').first().screenshot({ path: `/tmp/stress-${label}.png` });
  console.log(`  /tmp/stress-${label}.png`);
}

async function clearShell(page) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.type('clear');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
}

test('A — fast typing without delay', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page); await focus(page); await clearShell(page);

  console.log('A. Fast typing 50 chars with no gap');
  const fast = 'echo abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH';
  await page.keyboard.type(fast, { delay: 0 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await shot(page, 'A-fast');
  await ctx.close();
});

test('B — paste a 1KB blob', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page); await focus(page); await clearShell(page);

  console.log('B. Paste 1KB of text via insertText');
  const blob = ('paste-test-' + 'x'.repeat(50) + ' ').repeat(20);
  await page.keyboard.type('echo ', { delay: 5 });
  // Use clipboard via dispatchEvent on the helper textarea
  await page.evaluate((text) => {
    const ta = document.querySelector('[data-component="TerminalNative"] .xterm-helper-textarea');
    if (ta) {
      ta.focus();
      const ev = new InputEvent('input', { data: text, inputType: 'insertText', bubbles: true });
      ta.value = text;
      ta.dispatchEvent(ev);
    }
  }, blob);
  await page.waitForTimeout(1000);
  await shot(page, 'B-paste-before-enter');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  await shot(page, 'B-paste-after-enter');
  await ctx.close();
});

test('C — Ctrl+C a long-running command', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page); await focus(page); await clearShell(page);

  console.log('C. Run sleep 30 then Ctrl+C');
  await page.keyboard.type('sleep 30');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await shot(page, 'C-sleeping');
  await page.keyboard.press('Control+c');
  await page.waitForTimeout(1000);
  await shot(page, 'C-after-ctrl-c');
  await ctx.close();
});

test('D — UTF-8 and emojis', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page); await focus(page); await clearShell(page);

  console.log('D. Type ñ á é í ó ú and emojis');
  // Some emoji chars confuse Playwright keyboard.type, so use clipboard
  await page.evaluate(() => {
    const ta = document.querySelector('[data-component="TerminalNative"] .xterm-helper-textarea');
    if (ta) {
      ta.focus();
      const text = "echo 'acentos: ñ á é í ó ú · emojis: 🚀 🔥 ✨ 🎉'";
      ta.value = text;
      ta.dispatchEvent(new InputEvent('input', { data: text, inputType: 'insertText', bubbles: true }));
    }
  });
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await shot(page, 'D-utf8');
  await ctx.close();
});

test('E — Backspace overflow', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page); await focus(page); await clearShell(page);

  console.log('E. Type "abc", press Backspace 20 times');
  await page.keyboard.type('abc');
  await page.waitForTimeout(300);
  for (let i = 0; i < 20; i++) await page.keyboard.press('Backspace');
  await page.waitForTimeout(500);
  await shot(page, 'E-backspace');
  await ctx.close();
});

test('F — Enter spam', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page); await focus(page); await clearShell(page);

  console.log('F. Press Enter 30 times rapidly');
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(1500);
  await shot(page, 'F-enter-spam');
  await ctx.close();
});

test('G — Reload page during typing', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page); await focus(page); await clearShell(page);

  console.log('G. Type "for i in 1..5", reload, see what survives');
  await page.keyboard.type('for i in $(seq 1 5); do echo line $i;');
  await page.waitForTimeout(500);
  await shot(page, 'G-before-reload');
  await page.reload();
  await page.waitForTimeout(3000);
  await shot(page, 'G-after-reload');
  await ctx.close();
});

test('H — Resize browser mid-typing', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page); await focus(page); await clearShell(page);

  console.log('H. Type, shrink viewport, type more, screenshot');
  await page.keyboard.type('echo before-resize-');
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 800, height: 600 });
  await page.waitForTimeout(800);
  await page.keyboard.type('after');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await shot(page, 'H-resize');
  await ctx.close();
});

test('I — Two tabs racing', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const A = await ctx.newPage();
  const B = await ctx.newPage();
  await login(A);
  await login(B);
  console.log('I. Both tabs type to the same panel at the same time');
  await focus(A);
  await focus(B);
  // Type interleaved
  for (let i = 0; i < 10; i++) {
    await A.keyboard.type('A');
    await B.keyboard.type('B');
  }
  await A.waitForTimeout(1500);
  await A.locator('[data-component="TerminalNative"]').first().screenshot({ path: '/tmp/stress-I-A.png' });
  await B.locator('[data-component="TerminalNative"]').first().screenshot({ path: '/tmp/stress-I-B.png' });
  console.log('  /tmp/stress-I-A.png');
  console.log('  /tmp/stress-I-B.png');
  await ctx.close();
});
