const { test, expect } = require('@playwright/test');

test.describe('Prompt Fix Iteration 1', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteration 1: Test more aggressive cleanup (1 prompt max)', async ({ page, context }) => {
    console.log('=== ITERATION 1: Testing 1 prompt max cleanup ===');
    
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
    
    // Go to the session
    await page.goto(clientUrl + '/terminal/48d075d5-ab5a-4a7d-a617-123691c8cf96');
    await page.waitForTimeout(3000);
    
    // Take screenshot before refresh
    await page.screenshot({ 
      path: 'tests/screenshots/iter1-before.png', 
      fullPage: true 
    });
    
    // Count visible prompts (visual check)
    const terminals = await page.locator('.terminal').all();
    console.log(`Found ${terminals.length} terminals`);
    
    // Refresh page to trigger cleanup
    console.log('\nRefreshing page to trigger cleanup...');
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Take screenshot after refresh
    await page.screenshot({ 
      path: 'tests/screenshots/iter1-after.png', 
      fullPage: true 
    });
    
    // Do another refresh to ensure stability
    console.log('\nSecond refresh to verify stability...');
    await page.reload();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/iter1-after-2nd.png', 
      fullPage: true 
    });
    
    console.log('\n✅ Iteration 1 complete');
    console.log('Check screenshots and server logs for cleanup messages');
  });
});