import { test, expect } from '@playwright/test';

test('Final test - Terminal content preservation after split', async ({ page }) => {
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'log' && msg.text().includes('[Terminal')) {
      console.log(msg.text());
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
  await sessionInput.fill('Final Test');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  console.log('1. Waiting for terminal initialization...');
  
  // Wait for terminal to be ready
  let terminalReady = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    const hasXterm = await page.locator('.xterm').count() > 0;
    if (hasXterm) {
      terminalReady = true;
      console.log(`2. Terminal ready after ${(i + 1) * 0.5} seconds`);
      break;
    }
  }
  
  if (!terminalReady) {
    throw new Error('Terminal never initialized');
  }
  
  // Click on terminal and execute command
  const terminal = await page.locator('.xterm').first();
  await terminal.click();
  await page.waitForTimeout(500);
  
  await page.keyboard.type('echo "CONTENT BEFORE SPLIT - SUCCESS"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  await page.keyboard.type('ls -la | head -5');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  
  // Get content before split
  const contentBefore = await page.evaluate(() => {
    const xterm = document.querySelector('.xterm');
    return xterm ? xterm.textContent : '';
  });
  console.log('3. Content includes SUCCESS:', contentBefore.includes('SUCCESS'));
  console.log('4. Content includes ls output:', contentBefore.includes('total') || contentBefore.includes('drwx'));
  
  // Take screenshot before split
  await page.screenshot({ path: 'tests/screenshots/final-1-before.png' });
  
  // Perform split
  console.log('5. Performing split...');
  await page.click('button:has-text("Split")');
  await page.click('text=Split Horizontal');
  await page.waitForTimeout(3000);
  
  // Check terminals after split
  const xtermsAfter = await page.locator('.xterm').count();
  console.log(`6. Number of terminals after split: ${xtermsAfter}`);
  
  // Check content in all terminals
  const allContents = await page.evaluate(() => {
    const xterms = document.querySelectorAll('.xterm');
    return Array.from(xterms).map((xterm, i) => ({
      index: i,
      hasSuccess: xterm.textContent.includes('SUCCESS'),
      hasLs: xterm.textContent.includes('total') || xterm.textContent.includes('drwx'),
      length: xterm.textContent.length
    }));
  });
  
  console.log('7. Terminal contents after split:', allContents);
  
  // Take final screenshot
  await page.screenshot({ path: 'tests/screenshots/final-2-after.png' });
  
  // Verify content preservation
  const contentPreserved = allContents.some(t => t.hasSuccess);
  console.log('8. FINAL RESULT:', contentPreserved ? '✅ CONTENT PRESERVED!' : '❌ CONTENT LOST!');
  
  expect(contentPreserved).toBe(true);
});