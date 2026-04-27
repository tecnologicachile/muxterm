/**
 * Pure observation: log in, focus Terminal 1 (the native panel), and
 * record everything that might look "weird" — initial state, cursor
 * position, scrollback, what happens after pressing Enter, after `clear`,
 * after a real command. No assertions, just evidence.
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

async function snapshot(page, label) {
  const buf = await page.evaluate(() => {
    const rows = document.querySelector('[data-component="TerminalNative"] .xterm-rows');
    if (!rows) return { lines: [], rowCount: 0 };
    const lines = Array.from(rows.children).map(r => r.textContent);
    return { lines, rowCount: lines.length };
  });
  await page.locator('[data-component="TerminalNative"]').first().screenshot({ path: `/tmp/obs-${label}.png` });
  console.log(`\n--- ${label} ---`);
  console.log(`rows: ${buf.rowCount}`);
  console.log('first 8 non-empty rows:');
  let count = 0;
  for (const line of buf.lines) {
    if (line.trim() && count < 8) {
      console.log(`  [${count}] "${line.replace(/\s+$/, '')}"`);
      count++;
    }
  }
}

test('Observe Terminal 1', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  const consoleMsgs = [];
  page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => consoleMsgs.push(`[pageerror] ${e.message}`));

  await login(page);

  console.log('=== INITIAL STATE ===');
  // Counts
  const counts = await page.evaluate(() => ({
    nativeCount: document.querySelectorAll('[data-component="TerminalNative"]').length,
    iframeTtyd: document.querySelectorAll('iframe[src*="/ttyd/"]').length,
    xterm: document.querySelectorAll('[data-component="TerminalNative"] .xterm').length,
    statusAttr: document.querySelector('[data-component="TerminalNative"]')?.getAttribute('data-status'),
  }));
  console.log('TerminalNative count:', counts.nativeCount);
  console.log('ttyd iframes:        ', counts.iframeTtyd);
  console.log('xterm canvases:      ', counts.xterm);
  console.log('data-status:         ', counts.statusAttr);

  // Visible header for the native panel: rename text, buttons present?
  const headerInfo = await page.evaluate(() => {
    const native = document.querySelector('[data-component="TerminalNative"]');
    if (!native) return null;
    // Walk up to find the panel container
    let panel = native.closest('[data-panel-id]');
    if (!panel) return null;
    const header = panel.querySelector('.panel-header');
    return {
      panelId: panel.getAttribute('data-panel-id'),
      headerText: header ? header.textContent : null,
      buttonTitles: header ? Array.from(header.querySelectorAll('[title]')).map(b => b.getAttribute('title')) : [],
    };
  });
  console.log('Panel id:', headerInfo?.panelId);
  console.log('Header buttons:', headerInfo?.buttonTitles);

  await snapshot(page, '01-initial');

  console.log('\n=== AFTER FOCUS + ENTER ===');
  await page.locator('[data-component="TerminalNative"] .xterm').first().click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await snapshot(page, '02-after-enter');

  console.log('\n=== AFTER `clear` ===');
  await page.keyboard.type('clear');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await snapshot(page, '03-after-clear');

  console.log('\n=== AFTER `pwd && date && uname -a` ===');
  await page.keyboard.type('pwd && date && uname -a');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1800);
  await snapshot(page, '04-after-cmd');

  console.log('\n=== AFTER `ls -la /tmp | head -20` ===');
  await page.keyboard.type('ls -la /tmp | head -20');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1800);
  await snapshot(page, '05-after-ls');

  console.log('\n=== Cursor / focus state ===');
  const cursorInfo = await page.evaluate(() => {
    const cursor = document.querySelector('[data-component="TerminalNative"] .xterm-cursor-layer canvas');
    const focus = document.activeElement && document.activeElement.tagName + (document.activeElement.className ? ('.' + document.activeElement.className) : '');
    const xtermContainer = document.querySelector('[data-component="TerminalNative"] .xterm');
    const cls = xtermContainer ? xtermContainer.className : '';
    return { hasCursorLayer: !!cursor, activeElement: focus, xtermClasses: cls };
  });
  console.log('Cursor canvas present:', cursorInfo.hasCursorLayer);
  console.log('Active element:       ', cursorInfo.activeElement);
  console.log('xterm class list:     ', cursorInfo.xtermClasses);

  console.log('\n=== Last 10 console messages ===');
  for (const m of consoleMsgs.slice(-10)) console.log('  ' + m);

  await page.screenshot({ path: '/tmp/obs-fullpage.png', fullPage: false });

  await ctx.close();
});
