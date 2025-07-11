const { test, expect } = require('@playwright/test');

test('Simple login test', async ({ page }) => {
  console.log('Navigating to http://localhost:3002...');
  await page.goto('http://localhost:3002');
  
  // Take screenshot of login page
  await page.screenshot({ path: 'login-page.png' });
  
  // Wait for any input to be visible
  try {
    await page.waitForSelector('input', { timeout: 5000 });
    console.log('Login form found');
    
    // Fill username
    const usernameInput = page.locator('input').first();
    await usernameInput.fill('test');
    console.log('Username filled');
    
    // Fill password
    const passwordInput = page.locator('input').nth(1);
    await passwordInput.fill('test123');
    console.log('Password filled');
    
    // Find and click login button
    const loginButton = page.locator('button[type="submit"]');
    await loginButton.click();
    console.log('Login button clicked');
    
    // Wait a bit to see what happens
    await page.waitForTimeout(3000);
    
    // Take screenshot after login attempt
    await page.screenshot({ path: 'after-login.png' });
    
    console.log('Current URL:', page.url());
    
  } catch (error) {
    console.error('Error during login:', error);
    await page.screenshot({ path: 'error-screenshot.png' });
    
    // Check page content
    const content = await page.content();
    console.log('Page content preview:', content.substring(0, 500));
  }
});