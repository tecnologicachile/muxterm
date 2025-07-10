const { test } = require('@playwright/test');

test.describe('Prompt Fix Iteration 2', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteration 2: Test improved cleanup logic', async ({ page, context }) => {
    console.log('=== ITERATION 2: Testing improved cleanup logic ===');
    
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
    
    // Go to session
    await page.goto(clientUrl + '/terminal/48d075d5-ab5a-4a7d-a617-123691c8cf96');
    await page.waitForTimeout(3000);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/iter2-before.png', 
      fullPage: true 
    });
    
    // Refresh to trigger cleanup
    console.log('\nRefreshing to trigger cleanup...');
    await page.reload();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/iter2-after-1st.png', 
      fullPage: true 
    });
    
    // Check terminals visually
    const terminals = await page.locator('.terminal').all();
    if (terminals.length > 0) {
      // Click on left terminal and add some content
      await terminals[0].click();
      await page.keyboard.type('echo "Testing cleanup"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }
    
    // Refresh again
    console.log('\nSecond refresh...');
    await page.reload();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/iter2-after-2nd.png', 
      fullPage: true 
    });
    
    console.log('\n✅ Iteration 2 complete');
    console.log('Check screenshots to verify only 1 prompt per terminal');
  });
});