import { test, expect } from '@playwright/test';

test('Step by step debugging', async ({ page }) => {
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'log') {
      console.log('[Browser]', msg.text());
    }
  });

  // Navigate and login
  await page.goto('http://localhost:3003');
  await page.waitForLoadState('networkidle');
  
  const inputs = await page.locator('input').all();
  await inputs[0].fill('test');
  await inputs[1].fill('test123');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/sessions', { timeout: 10000 });
  
  // Create session
  await page.click('button:has-text("NEW SESSION")');
  await page.waitForSelector('text=Create New Session');
  const sessionInput = page.locator('input:visible').first();
  await sessionInput.fill('Step by Step');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  // Wait for terminal
  await page.waitForTimeout(3000);
  
  console.log('=== Step 1: Check initial terminal ===');
  let terminalInfo = await page.evaluate(() => {
    const xterms = document.querySelectorAll('.xterm');
    return {
      count: xterms.length,
      hasContent: xterms.length > 0 && xterms[0].textContent.length > 0
    };
  });
  console.log('Initial terminals:', terminalInfo);
  
  // Click and type
  console.log('=== Step 2: Type command ===');
  await page.keyboard.type('echo "STEP BY STEP TEST"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  
  // Check content
  const contentBefore = await page.evaluate(() => {
    const xterm = document.querySelector('.xterm');
    if (!xterm) return 'NO XTERM';
    const text = xterm.textContent;
    return {
      length: text.length,
      includesCommand: text.includes('echo "STEP BY STEP TEST"'),
      includesOutput: text.includes('STEP BY STEP TEST'),
      preview: text.substring(0, 200)
    };
  });
  console.log('Content before split:', contentBefore);
  
  // Screenshot before
  await page.screenshot({ path: 'tests/screenshots/step-1-before.png' });
  
  console.log('=== Step 3: Split ===');
  await page.click('button:has-text("Split")');
  await page.click('text=Split Horizontal');
  await page.waitForTimeout(3000);
  
  // Check after split
  terminalInfo = await page.evaluate(() => {
    const xterms = document.querySelectorAll('.xterm');
    const results = [];
    xterms.forEach((xterm, i) => {
      const text = xterm.textContent;
      results.push({
        index: i,
        length: text.length,
        includesCommand: text.includes('echo "STEP BY STEP TEST"'),
        includesOutput: text.includes('STEP BY STEP TEST'),
        hasPrompt: text.includes('$') || text.includes('#'),
        preview: text.substring(0, 100)
      });
    });
    return results;
  });
  console.log('Terminals after split:', terminalInfo);
  
  // Screenshot after
  await page.screenshot({ path: 'tests/screenshots/step-2-after.png' });
  
  console.log('=== Final Result ===');
  const preserved = terminalInfo.some(t => t.includesOutput);
  console.log('Content preserved:', preserved ? 'YES' : 'NO');
});