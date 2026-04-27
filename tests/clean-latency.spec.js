/**
 * Clean latency: type a phrase end-to-end with no intermediate reads,
 * then measure how long after typing finishes the buffer has it all.
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

async function readBuf(page) {
  return page.evaluate(() => {
    const t = window.__nativeTerm;
    if (!t) return null;
    const buf = t.buffer.active;
    const lines = [];
    for (let i = 0; i < buf.length; i++) {
      const line = buf.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    return { lines, cursorX: buf.cursorX, cursorY: buf.cursorY };
  });
}

test('Clean latency — type, then poll', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page);

  await page.locator('[data-component="TerminalNative"] .xterm').first().click();
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);

  // Slowed-down typing — 80 ms between chars — so we don't race the bridge
  const phrase = 'echo HOLA_MUNDO_LATENCIA';
  console.log('Typing slowly:', phrase);
  const t0 = Date.now();
  for (const ch of phrase) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(80);
  }
  const typed = Date.now() - t0;
  console.log(`  typing finished in ${typed} ms`);

  // Now poll for the full phrase
  const start = Date.now();
  let foundAt = -1;
  let lastSnap = null;
  while (Date.now() - start < 3000) {
    const s = await readBuf(page);
    if (s && s.lines.some(l => l.includes(phrase))) {
      foundAt = Date.now() - start;
      lastSnap = s;
      break;
    }
    await page.waitForTimeout(20);
  }

  if (foundAt >= 0) {
    console.log(`Full phrase visible ${foundAt} ms after last keystroke`);
    console.log(`Cursor: (${lastSnap.cursorX}, ${lastSnap.cursorY})`);
    const promptLine = lastSnap.lines.find(l => l.includes(phrase));
    if (promptLine) {
      const tailCol = promptLine.indexOf(phrase) + phrase.length;
      console.log(`  phrase ends at col ${tailCol}, cursor at col ${lastSnap.cursorX}`);
      console.log(`  cursor at expected position: ${lastSnap.cursorX === tailCol}`);
    }
  } else {
    const s = await readBuf(page);
    console.log('TIMEOUT — phrase never appeared in buffer');
    console.log('Last buffer contents (last 5 non-empty lines):');
    const nonEmpty = s.lines.filter(l => l.trim());
    for (const l of nonEmpty.slice(-5)) console.log('  "' + l + '"');
  }

  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.locator('[data-component="TerminalNative"]').first().screenshot({ path: '/tmp/clean-latency.png' });

  await ctx.close();
});
