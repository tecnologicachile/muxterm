import { test, expect } from '@playwright/test';

test('Wait for terminal initialization before split', async ({ page }) => {
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
  await sessionInput.fill('Wait Terminal Test');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  console.log('1. Waiting for terminal to be ready...');
  
  // Wait for xterm to appear
  await page.waitForSelector('.xterm', { timeout: 10000 });
  await page.waitForTimeout(2000); // Extra wait for terminal to stabilize
  
  // Check if terminal is ready
  const terminalReady = await page.evaluate(() => {
    const xterm = document.querySelector('.xterm');
    const canvas = document.querySelector('canvas');
    return {
      hasXterm: xterm !== null,
      hasCanvas: canvas !== null,
      xtermContent: xterm ? xterm.textContent.substring(0, 50) : 'no xterm'
    };
  });
  console.log('2. Terminal status:', terminalReady);
  
  // Try to click on terminal to ensure it has focus
  const xtermElement = await page.locator('.xterm').first();
  if (xtermElement) {
    await xtermElement.click();
    console.log('3. Clicked on terminal');
  }
  
  // Execute command
  await page.keyboard.type('echo "TEST BEFORE SPLIT"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  
  // Get terminal content
  const contentBefore = await page.evaluate(() => {
    const xterm = document.querySelector('.xterm');
    return xterm ? xterm.textContent : 'No xterm';
  });
  console.log('4. Content before split includes TEST:', contentBefore.includes('TEST BEFORE SPLIT'));
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/wait-1-before.png' });
  
  // Now perform split
  console.log('5. Performing split...');
  await page.click('button:has-text("Split")');
  await page.click('text=Split Horizontal');
  await page.waitForTimeout(3000);
  
  // Check terminals after split
  const terminalsAfter = await page.evaluate(() => {
    const xterms = document.querySelectorAll('.xterm');
    return {
      count: xterms.length,
      contents: Array.from(xterms).map((xterm, i) => ({
        index: i,
        text: xterm.textContent ? xterm.textContent.substring(0, 100) : 'empty'
      }))
    };
  });
  console.log('6. Terminals after split:', terminalsAfter);
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/wait-2-after.png' });
  
  // Final check
  const preserved = terminalsAfter.contents.some(t => t.text.includes('TEST BEFORE SPLIT'));
  console.log('7. Content preserved:', preserved ? 'YES' : 'NO');
  
  // If not preserved, try to find where the content went
  if (!preserved) {
    const pageContent = await page.content();
    console.log('8. Page still contains TEST:', pageContent.includes('TEST BEFORE SPLIT'));
  }
});