import { test, expect } from '@playwright/test';

test('Simple split test with detailed logging', async ({ page }) => {
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'log') {
      console.log('[Browser Console]', msg.text());
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
  await sessionInput.fill('Simple Split Test');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  console.log('1. Waiting for initial terminal...');
  await page.waitForTimeout(3000);
  
  // Look for terminal before command
  const terminalsBefore = await page.evaluate(() => {
    const xterms = document.querySelectorAll('.xterm');
    const containers = document.querySelectorAll('div[style*="cursor"]');
    return {
      xterms: xterms.length,
      containers: containers.length,
      hasCanvas: document.querySelector('canvas') !== null
    };
  });
  console.log('2. Before command:', terminalsBefore);
  
  // Execute command
  await page.keyboard.type('echo "BEFORE SPLIT"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  
  // Check terminal content
  const contentBefore = await page.evaluate(() => {
    const xterm = document.querySelector('.xterm');
    return xterm ? xterm.textContent : 'No xterm found';
  });
  console.log('3. Terminal content before split:', contentBefore.substring(0, 100));
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/simple-1-before.png' });
  
  // Perform split
  console.log('4. Performing split...');
  await page.click('button:has-text("Split")');
  await page.click('text=Split Horizontal');
  await page.waitForTimeout(3000);
  
  // Look for terminals after split
  const terminalsAfter = await page.evaluate(() => {
    const xterms = document.querySelectorAll('.xterm');
    const containers = document.querySelectorAll('div[style*="cursor"]');
    const panels = document.querySelectorAll('[style*="border"]');
    return {
      xterms: xterms.length,
      containers: containers.length,
      panels: panels.length,
      hasCanvas: document.querySelector('canvas') !== null
    };
  });
  console.log('5. After split:', terminalsAfter);
  
  // Check each terminal's content
  const allTerminalContent = await page.evaluate(() => {
    const xterms = document.querySelectorAll('.xterm');
    return Array.from(xterms).map((xterm, i) => ({
      index: i,
      content: xterm.textContent ? xterm.textContent.substring(0, 100) : 'empty'
    }));
  });
  console.log('6. All terminal contents:', allTerminalContent);
  
  // Take final screenshot
  await page.screenshot({ path: 'tests/screenshots/simple-2-after.png' });
  
  // Final verdict
  const hasSplitContent = allTerminalContent.some(t => t.content.includes('BEFORE SPLIT'));
  console.log('7. Original content preserved:', hasSplitContent ? 'YES' : 'NO');
});