const { test, expect } = require('@playwright/test');

test.describe('Debug Authentication Flow', () => {
  test('Debug login and auth state', async ({ page }) => {
    console.log('\n=== DEBUGGING AUTHENTICATION FLOW ===\n');
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Browser error:', msg.text());
      } else if (msg.text().includes('Socket') || msg.text().includes('auth')) {
        console.log('📋 Browser log:', msg.text());
      }
    });
    
    page.on('pageerror', err => console.log('Page error:', err));
    
    // Monitor network requests
    page.on('request', request => {
      if (request.url().includes('/api/auth')) {
        console.log(`📤 Auth Request: ${request.method()} ${request.url()}`);
        console.log('   Headers:', request.headers());
        if (request.method() === 'POST') {
          console.log('   Body:', request.postData());
        }
      }
    });
    
    page.on('response', async response => {
      if (response.url().includes('/api/auth')) {
        console.log(`📥 Auth Response: ${response.status()} ${response.url()}`);
        if (response.ok()) {
          try {
            const body = await response.json();
            console.log('   Response body:', JSON.stringify(body, null, 2));
          } catch (e) {
            console.log('   Could not parse response body');
          }
        }
      }
    });
    
    // Step 1: Navigate to login page
    console.log('\n1. Navigating to login page...');
    await page.goto('http://localhost:3003/login');
    await page.waitForTimeout(1000);
    
    // Check current URL
    console.log('   Current URL:', page.url());
    
    // Step 2: Check localStorage before login
    const tokenBefore = await page.evaluate(() => localStorage.getItem('token'));
    console.log('   Token in localStorage before login:', tokenBefore);
    
    // Step 3: Fill login form
    console.log('\n2. Filling login form...');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    
    // Take screenshot before login
    await page.screenshot({ path: 'tests/screenshots/debug-auth-before-login.png' });
    
    // Step 4: Submit form
    console.log('\n3. Submitting login form...');
    const loginPromise = page.waitForResponse(resp => resp.url().includes('/api/auth/login'));
    await page.click('button[type="submit"]');
    
    // Wait for login response
    const loginResponse = await loginPromise;
    console.log('   Login response status:', loginResponse.status());
    
    // Wait a bit for React to update
    await page.waitForTimeout(2000);
    
    // Step 5: Check auth state after login
    console.log('\n4. Checking auth state after login...');
    const authState = await page.evaluate(() => {
      const token = localStorage.getItem('token');
      return {
        token: token,
        url: window.location.href,
        hasToken: !!token
      };
    });
    
    console.log('   Auth state:', authState);
    
    // Step 6: Check if navigation happened
    console.log('\n5. Checking navigation...');
    console.log('   Current URL:', page.url());
    
    // Take screenshot after login
    await page.screenshot({ path: 'tests/screenshots/debug-auth-after-login.png' });
    
    // Step 7: Check React Router state
    const routerState = await page.evaluate(() => {
      // Try to get React DevTools global hook
      const reactRoot = document.getElementById('root');
      if (reactRoot && reactRoot._reactRootContainer) {
        return 'React root found';
      }
      return 'React root not found';
    });
    console.log('   React state:', routerState);
    
    // Step 8: Try manual navigation
    if (authState.hasToken && page.url().includes('login')) {
      console.log('\n6. Token exists but still on login page. Trying manual navigation...');
      await page.goto('http://localhost:3003/sessions');
      await page.waitForTimeout(2000);
      console.log('   URL after manual navigation:', page.url());
      
      // Check if redirected back to login
      if (page.url().includes('login')) {
        console.log('   ❌ Redirected back to login - auth guard is blocking');
      } else {
        console.log('   ✅ Successfully navigated to sessions');
      }
    }
    
    // Step 9: Check for error messages
    const errorElement = await page.locator('[role="alert"], .error, .MuiAlert-root').first();
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent();
      console.log('\n❌ Error message found:', errorText);
    }
    
    // Final status
    console.log('\n=== FINAL STATUS ===');
    console.log('URL:', page.url());
    console.log('Has token:', authState.hasToken);
    console.log('Expected: http://localhost:3003/sessions');
    console.log('Success:', page.url().includes('sessions'));
  });
});