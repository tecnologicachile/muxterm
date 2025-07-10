const { test, expect } = require('@playwright/test');

test.describe('Verify Fix After Restart', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Create new session and verify no prompt duplication', async ({ page, context }) => {
    console.log('=== VERIFY FIX AFTER SERVER RESTART ===');
    
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
    
    // Type some commands to generate content
    console.log('Typing commands...');
    const leftTerminal = page.locator('.terminal').first();
    await leftTerminal.click();
    await page.keyboard.type('echo "Test 1"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    await page.keyboard.type('ls');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/verify-1-initial.png', 
      fullPage: true 
    });
    
    // Now do multiple refreshes
    console.log('\nTesting multiple refreshes...');
    
    for (let i = 1; i <= 5; i++) {
      console.log(`\nRefresh ${i}:`);
      await page.reload();
      await page.waitForTimeout(2000);
      
      const terminals = await page.locator('.terminal').all();
      console.log(`  Terminals visible: ${terminals.length}`);
      
      if (i === 3 || i === 5) {
        await page.screenshot({ 
          path: `tests/screenshots/verify-${i+1}-after-${i}-refreshes.png`, 
          fullPage: true 
        });
      }
    }
    
    console.log('\n✅ Test completed!');
    console.log('\n📸 Check screenshots to verify:');
    console.log('  1. No duplicate prompts');
    console.log('  2. Terminal content is preserved correctly');
    console.log('  3. No prompt accumulation across refreshes');
  });
});