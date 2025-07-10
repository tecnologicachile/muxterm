import { test, expect } from '@playwright/test';

test.describe('Terminal Split Bug Demonstration', () => {
  test('BUG: Terminal content disappears after horizontal split', async ({ page }) => {
    console.log('=== STARTING BUG DEMONSTRATION ===');
    
    // Navigate and login
    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');
    
    const inputs = await page.locator('input').all();
    await inputs[0].fill('test');
    await inputs[1].fill('test123');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/sessions', { timeout: 10000 });
    
    // Create new session
    await page.click('button:has-text("NEW SESSION")');
    await page.waitForSelector('text=Create New Session');
    const sessionInput = page.locator('input:visible').first();
    await sessionInput.fill('Bug Demo Session');
    await page.click('button:has-text("CREATE")');
    await page.waitForURL('**/terminal/**', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    console.log('1. Session created successfully');
    
    // Execute ls command
    await page.click('.xterm-screen');
    await page.keyboard.type('ls -la');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    // Take screenshot showing ls output
    await page.screenshot({ path: 'tests/screenshots/bug-1-ls-output.png' });
    console.log('2. Executed ls -la command - output visible');
    
    // Get terminal content before split
    const terminalBeforeSplit = await page.locator('.xterm').first();
    const contentBefore = await terminalBeforeSplit.textContent();
    console.log('3. Terminal content before split:', contentBefore.includes('total') ? 'Contains ls output' : 'Empty');
    
    // Perform horizontal split
    await page.click('button:has-text("Split")');
    await page.click('text=Split Horizontal');
    await page.waitForTimeout(2000);
    
    // Take screenshot after split
    await page.screenshot({ path: 'tests/screenshots/bug-2-after-split.png' });
    console.log('4. Split performed');
    
    // Wait a bit more for panels to render
    await page.waitForTimeout(2000);
    
    // Check both panels - try different selectors
    let panels = await page.locator('[style*="border"]').all();
    console.log(`5. Found ${panels.length} panels with border selector`);
    
    // Try more specific selectors
    const xtermDivs = await page.locator('.xterm').all();
    console.log(`   Found ${xtermDivs.length} xterm divs`);
    
    const xtermScreens = await page.locator('.xterm-screen').all();
    console.log(`   Found ${xtermScreens.length} xterm-screen divs`);
    
    // Try to find terminal containers
    const terminalContainers = await page.locator('div[style*="cursor: text"]').all();
    console.log(`   Found ${terminalContainers.length} terminal containers`);
    
    // Get page content for debugging
    const bodyContent = await page.locator('body').innerHTML();
    console.log('   Page has content:', bodyContent.length > 0 ? 'Yes' : 'No');
    console.log('   Contains "2 panels":', bodyContent.includes('2 panel') ? 'Yes' : 'No');
    
    // Check first panel (should have ls output)
    if (panels.length > 0) {
      const firstPanelContent = await panels[0].textContent();
      const hasLsOutput = firstPanelContent.includes('total') || firstPanelContent.includes('drwx');
      console.log('6. First panel content:', hasLsOutput ? 'Still has ls output' : 'LOST CONTENT!');
      console.log('   Content length:', firstPanelContent.length);
    } else if (xtermDivs.length > 0) {
      console.log('6. Checking xterm content instead...');
      const firstXtermContent = await xtermDivs[0].textContent();
      console.log('   First xterm content length:', firstXtermContent.length);
      console.log('   Contains ls output:', firstXtermContent.includes('total') || firstXtermContent.includes('drwx'));
    } else {
      console.log('6. ERROR: No panels or xterm divs found!');
    }
    
    // Check second panel (should be empty/new)
    if (panels.length > 1) {
      const secondPanelContent = await panels[1].textContent();
      console.log('7. Second panel content length:', secondPanelContent.length);
    }
    
    // Additional test: try typing in first panel
    if (panels.length > 0) {
      await panels[0].click();
      await page.waitForTimeout(500);
      await page.keyboard.type('echo "Can I still type here?"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }
    
    await page.screenshot({ path: 'tests/screenshots/bug-3-typing-after-split.png' });
    
    console.log('=== BUG DEMONSTRATION COMPLETE ===');
    
    // For now, just log the result without failing
    if (panels.length === 0) {
      console.log('RESULT: No panels found after split!');
    } else {
      console.log('RESULT: Found panels, checking content preservation...');
    }
  });
});