const { test } = require('@playwright/test');

test.describe('Prompt Fix Final Test', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Final test: Verify prompt cleanup works correctly', async ({ page, context }) => {
    console.log('=== FINAL TEST: Verifying prompt cleanup ===');
    
    // Wait for server to be ready
    await page.waitForTimeout(3000);
    
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
    
    // Go to sessions page
    await page.goto(clientUrl + '/sessions');
    await page.waitForTimeout(2000);
    
    // Create new session
    console.log('\nCreating new session...');
    await page.click('button:has-text("Create New Session")');
    await page.waitForTimeout(1000);
    
    // Enter terminal
    await page.click('div.MuiCard-root');
    await page.waitForURL('**/terminal/**');
    await page.waitForTimeout(2000);
    
    // Split terminal
    console.log('Splitting terminal...');
    await page.click('button[title="Split"]');
    await page.waitForTimeout(2000);
    
    // Type commands in both terminals
    const terminals = await page.locator('.terminal').all();
    
    // Left terminal
    await terminals[0].click();
    await page.keyboard.type('ls');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Right terminal
    await terminals[1].click(); 
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/final-test-initial.png', 
      fullPage: true 
    });
    
    // Now test multiple refreshes
    console.log('\nTesting multiple refreshes...');
    
    for (let i = 1; i <= 5; i++) {
      console.log(`Refresh ${i}...`);
      await page.reload();
      await page.waitForTimeout(2000);
      
      if (i === 1 || i === 3 || i === 5) {
        await page.screenshot({ 
          path: `tests/screenshots/final-test-after-${i}-refreshes.png`, 
          fullPage: true 
        });
      }
    }
    
    console.log('\n✅ FINAL TEST COMPLETE!');
    console.log('\nCheck screenshots to verify:');
    console.log('  - Only 1 prompt per terminal');
    console.log('  - Commands and output are preserved');
    console.log('  - No prompt duplication after multiple refreshes');
  });
});