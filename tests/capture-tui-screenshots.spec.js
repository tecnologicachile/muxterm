/**
 * Phase A4: take high-res screenshots of vim, top, htop, less running
 * inside the native panel. Pure visual evidence — no assertions. The
 * human reviews these to judge whether rendering is at production
 * quality (or better).
 *
 * Output goes to /tmp/native-tui-*.png.
 */
const { test } = require('@playwright/test');

const BASE = 'https://192.168.10.150:3002';
const USER = 'test';
const PASS = 'test123';

async function login(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.locator('input').all();
  await inputs[0].fill(USER);
  await inputs[1].fill(PASS);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/workspace', { timeout: 10000 });
  await page.waitForTimeout(2500);
}

async function focusNative(page) {
  await page.locator('[data-component="TerminalNative"] .xterm').first().click();
  await page.waitForTimeout(400);
}

async function clearShell(page) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.type('clear');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
}

async function screenshotPanel(page, file) {
  // Capture only the native panel — gives a much more useful image
  // than a fullPage screenshot.
  const panel = page.locator('[data-component="TerminalNative"]').first();
  await panel.screenshot({ path: file });
}

test('Capture: top, htop, vim, less', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page);
  await focusNative(page);

  // ── top ─────────────────────────────────────────────────────────
  await clearShell(page);
  await page.keyboard.type('top');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  await screenshotPanel(page, '/tmp/native-tui-top.png');
  console.log('saved /tmp/native-tui-top.png');
  await page.keyboard.press('q');
  await page.waitForTimeout(800);

  // ── htop ────────────────────────────────────────────────────────
  await clearShell(page);
  await page.keyboard.type('htop');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  await screenshotPanel(page, '/tmp/native-tui-htop.png');
  console.log('saved /tmp/native-tui-htop.png');
  await page.keyboard.press('q');
  await page.waitForTimeout(800);

  // ── vim with content ────────────────────────────────────────────
  await clearShell(page);
  await page.keyboard.type('vim /tmp/muxterm-vim-tui.txt');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.keyboard.press('i');
  await page.waitForTimeout(200);
  await page.keyboard.type('Native panel rendering test');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Line 2 — accents: ñ á é í ó ú');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Line 3 — box: ┌──┐ │  │ └──┘');
  await page.waitForTimeout(800);
  await screenshotPanel(page, '/tmp/native-tui-vim-insert.png');
  console.log('saved /tmp/native-tui-vim-insert.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.keyboard.type(':q!');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);

  // ── less /etc/services ──────────────────────────────────────────
  await clearShell(page);
  await page.keyboard.type('less /etc/services');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await screenshotPanel(page, '/tmp/native-tui-less.png');
  console.log('saved /tmp/native-tui-less.png');
  // Page down once to verify scrolling
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await screenshotPanel(page, '/tmp/native-tui-less-page2.png');
  console.log('saved /tmp/native-tui-less-page2.png');
  await page.keyboard.press('q');
  await page.waitForTimeout(500);

  await ctx.close();
});
