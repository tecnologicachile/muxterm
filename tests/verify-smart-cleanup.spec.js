const { test } = require('@playwright/test');

test.describe('Verify Smart Cleanup', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Test smart cleanup on existing session', async ({ page, context }) => {
    console.log('=== VERIFYING SMART CLEANUP ===');
    
    // Login
    const loginResponse = await fetch(`${serverUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', password: 'test123' })
    });
    
    const { token } = await loginResponse.json();
    await context.addInitScript((token) => {
      localStorage.setItem('token', token);
    }, token);
    
    // Go to sessions
    await page.goto(clientUrl + '/sessions');
    await page.waitForTimeout(2000);
    
    // Look for existing session or create new one
    const existingSession = await page.locator('div.MuiCard-root').first();
    if (await existingSession.isVisible()) {
      console.log('Using existing session...');
      await existingSession.click();
    } else {
      console.log('Creating new session...');
      await page.click('button:has-text("Create New Session")');
      await page.waitForTimeout(1000);
      await page.click('div.MuiCard-root');
    }
    
    await page.waitForURL('**/terminal/**');
    await page.waitForTimeout(2000);
    
    // Execute some commands
    console.log('\nExecuting test commands...');
    await page.keyboard.type('echo "Test 1"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    await page.keyboard.type('echo "Test 2"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Take before screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/verify-smart-cleanup-before.png', 
      fullPage: true 
    });
    
    // Refresh to trigger smart cleanup
    console.log('\nRefreshing to test smart cleanup...');
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Take after screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/verify-smart-cleanup-after.png', 
      fullPage: true 
    });
    
    // Do another refresh
    console.log('\nSecond refresh...');
    await page.reload();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/verify-smart-cleanup-after-2.png', 
      fullPage: true 
    });
    
    console.log('\n✅ Test complete!');
    console.log('Check screenshots and server logs for SMART CLEANUP messages');
  });
});