const { test } = require('@playwright/test');

test.describe('Prompt Fix Iteration 4', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteration 4: Test radical cleanup', async ({ page, context }) => {
    console.log('=== ITERATION 4: Testing radical cleanup ===');
    
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
    
    // Take before screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/iter4-before.png', 
      fullPage: true 
    });
    
    // Refresh multiple times to test cleanup
    for (let i = 1; i <= 3; i++) {
      console.log(`\nRefresh ${i}...`);
      await page.reload();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: `tests/screenshots/iter4-after-refresh-${i}.png`, 
        fullPage: true 
      });
    }
    
    console.log('\n✅ Iteration 4 complete');
    console.log('Check screenshots - should show only 1 prompt per terminal');
  });
});