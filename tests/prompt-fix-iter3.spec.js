const { test } = require('@playwright/test');

test.describe('Prompt Fix Iteration 3', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteration 3: Test with debug logs', async ({ page, context }) => {
    console.log('=== ITERATION 3: Testing with debug logs ===');
    
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
    
    // Single refresh to see debug output
    console.log('\nRefreshing to see debug output...');
    await page.reload();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/iter3-debug.png', 
      fullPage: true 
    });
    
    console.log('\n✅ Check server logs for [DEBUG] messages');
  });
});