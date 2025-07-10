const { test } = require('@playwright/test');

test.describe('Test SMART CLEANUP Final', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Create session and test SMART CLEANUP', async ({ page, context }) => {
    console.log('=== TESTING SMART CLEANUP ===');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.waitForTimeout(1000);
    
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    console.log('Logged in successfully');
    
    // Create new session
    await page.click('button:has-text("Create New Session")');
    await page.waitForTimeout(1000);
    
    // Click on the session card
    const sessionCard = await page.locator('div.MuiCard-root').first();
    await sessionCard.click();
    
    await page.waitForURL('**/terminal/**');
    await page.waitForTimeout(2000);
    
    console.log('In terminal, executing commands...');
    
    // Type some commands
    await page.keyboard.type('echo "First command"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    await page.keyboard.type('ls -la');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    await page.keyboard.type('echo "Last command"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Take screenshot before refresh
    await page.screenshot({ 
      path: 'tests/screenshots/smart-cleanup-test-before.png', 
      fullPage: true 
    });
    
    console.log('\nRefreshing page to trigger SMART CLEANUP...');
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Take screenshot after refresh
    await page.screenshot({ 
      path: 'tests/screenshots/smart-cleanup-test-after-1.png', 
      fullPage: true 
    });
    
    // Refresh again
    console.log('Second refresh...');
    await page.reload();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/smart-cleanup-test-after-2.png', 
      fullPage: true 
    });
    
    console.log('\n✅ Test complete!');
    console.log('Check server logs for [SMART CLEANUP] messages');
  });
});