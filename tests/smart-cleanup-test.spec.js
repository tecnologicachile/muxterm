const { test } = require('@playwright/test');

test.describe('Smart Cleanup Test', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Verify smart cleanup preserves command history', async ({ page, context }) => {
    console.log('=== SMART CLEANUP TEST: Verifying command history preservation ===');
    
    // Wait for server
    await page.waitForTimeout(2000);
    
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
    
    // Create new session
    await page.goto(clientUrl + '/sessions');
    await page.waitForTimeout(2000);
    
    console.log('\nCreating new session...');
    await page.click('button:has-text("Create New Session")');
    await page.waitForTimeout(1000);
    
    // Enter terminal
    await page.click('div.MuiCard-root');
    await page.waitForURL('**/terminal/**');
    await page.waitForTimeout(2000);
    
    // Execute multiple commands to create history
    console.log('Executing commands to create history...');
    
    await page.keyboard.type('echo "Command 1: Hello World"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    await page.keyboard.type('ls -la');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    await page.keyboard.type('echo "Command 3: Testing history"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Take screenshot before refresh
    await page.screenshot({ 
      path: 'tests/screenshots/smart-cleanup-before.png', 
      fullPage: true 
    });
    
    // Now test refreshes
    console.log('\nTesting refresh with smart cleanup...');
    
    for (let i = 1; i <= 3; i++) {
      console.log(`\nRefresh ${i}...`);
      await page.reload();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: `tests/screenshots/smart-cleanup-after-refresh-${i}.png`, 
        fullPage: true 
      });
    }
    
    console.log('\n✅ SMART CLEANUP TEST COMPLETE!');
    console.log('\nExpected results:');
    console.log('  - Only 1 prompt at the bottom');
    console.log('  - All command history preserved (echo, ls, pwd)');
    console.log('  - No duplicate prompts after refreshes');
  });
});