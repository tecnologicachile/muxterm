/**
 * Measure end-to-end keystroke latency on Terminal 1 (native panel).
 * For each character: timestamp the keypress, then poll the xterm DOM
 * every 5 ms until the char appears at the prompt. Report min / max /
 * median round-trip in ms. Also report whether a cursor element is
 * visible and where it sits relative to the typed text.
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

async function readBuffer(page) {
  return page.evaluate(() => {
    const rows = document.querySelector('[data-component="TerminalNative"] .xterm-rows');
    if (!rows) return '';
    return Array.from(rows.children).map(r => r.textContent).join('\n');
  });
}

async function waitForChar(page, marker, deadlineMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    const buf = await readBuffer(page);
    if (buf.includes(marker)) return Date.now() - start;
    await page.waitForTimeout(5);
  }
  return -1;
}

test('Measure input latency on Terminal 1', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page);

  await page.locator('[data-component="TerminalNative"] .xterm').first().click();
  await page.waitForTimeout(400);

  // Get to a clean prompt
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.type('clear');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);

  // Type chars via input-events (page.keyboard.type), one at a time, with
  // a real gap between each. Build a unique marker per char so we know
  // exactly what to look for. Use distinct letters so a previous char
  // doesn't accidentally satisfy the next match.
  const probeChars = 'ZQWRTYPSDF'; // arbitrary non-repeating letters
  const latencies = [];
  console.log('\nTyping one char at a time, measuring DOM-render lag:\n');

  let accum = '';
  for (let i = 0; i < probeChars.length; i++) {
    const ch = probeChars[i];
    accum += ch;
    const t0 = Date.now();
    await page.keyboard.type(ch);
    const ms = await waitForChar(page, accum, 1500);
    if (ms < 0) {
      console.log(`  '${ch}' (#${i + 1}, looking for "${accum}"): TIMEOUT (>1500 ms)`);
      latencies.push(1500);
    } else {
      console.log(`  '${ch}' (#${i + 1}, looking for "${accum}"): ${ms} ms`);
      latencies.push(ms);
    }
    // Real gap so the next keystroke is independent
    await page.waitForTimeout(120);
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  console.log(`\nLatency summary: min=${min}ms  median=${median}ms  mean=${mean}ms  max=${max}ms`);

  // Cursor inspection
  const cursorInfo = await page.evaluate(() => {
    const xt = document.querySelector('[data-component="TerminalNative"] .xterm');
    if (!xt) return { error: 'no xterm' };
    const rect = xt.getBoundingClientRect();
    const cursorLayer = xt.querySelector('.xterm-cursor-layer');
    const helperTextarea = xt.querySelector('.xterm-helper-textarea');
    // The DOM renderer puts a span with class 'xterm-cursor' at the cursor position
    const cursorSpan = xt.querySelector('.xterm-cursor');
    const cursorRect = cursorSpan ? cursorSpan.getBoundingClientRect() : null;
    const helperRect = helperTextarea ? helperTextarea.getBoundingClientRect() : null;
    return {
      hasCursorLayer: !!cursorLayer,
      hasCursorSpan: !!cursorSpan,
      cursorSpanText: cursorSpan ? cursorSpan.textContent : null,
      cursorBox: cursorRect ? { x: Math.round(cursorRect.x), y: Math.round(cursorRect.y), w: Math.round(cursorRect.width), h: Math.round(cursorRect.height) } : null,
      helperBox: helperRect ? { x: Math.round(helperRect.x), y: Math.round(helperRect.y), w: Math.round(helperRect.width), h: Math.round(helperRect.height) } : null,
      xtermBox: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      xtermClasses: xt.className,
    };
  });
  console.log('\nCursor / focus state:');
  console.log('  has .xterm-cursor span:    ', cursorInfo.hasCursorSpan);
  if (cursorInfo.cursorBox) console.log('  cursor at:', cursorInfo.cursorBox);
  if (cursorInfo.helperBox) console.log('  helper textarea at:', cursorInfo.helperBox);
  console.log('  xterm container at:', cursorInfo.xtermBox);
  console.log('  xterm classes:     ', cursorInfo.xtermClasses);

  // Backspace cleanup so the prompt doesn't carry junk
  for (let i = 0; i < probeChars.length; i++) await page.keyboard.press('Backspace');
  await page.waitForTimeout(500);

  await page.locator('[data-component="TerminalNative"]').first().screenshot({ path: '/tmp/latency-end.png' });
  console.log('\n/tmp/latency-end.png saved');

  await ctx.close();
});
