const { test, expect } = require('@playwright/test');

test.describe('Login functionality', () => {
  test('should login with default credentials', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3002');
    
    // Wait for login form to be visible
    await expect(page.locator('text=MuxTerm Login')).toBeVisible();
    
    // Fill in credentials
    await page.fill('input[type="text"]', 'test');
    await page.fill('input[type="password"]', 'test123');
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for redirect to main app
    await page.waitForURL('http://localhost:3002/', { timeout: 10000 });
    
    // Verify we're in the main app
    await expect(page.locator('text=MuxTerm')).toBeVisible();
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'login-success.png' });
  });

  test('should show error with wrong credentials', async ({ page }) => {
    await page.goto('http://localhost:3002');
    
    // Wait for login form
    await expect(page.locator('text=MuxTerm Login')).toBeVisible();
    
    // Fill wrong credentials
    await page.fill('input[type="text"]', 'wronguser');
    await page.fill('input[type="password"]', 'wrongpass');
    
    // Click login
    await page.click('button[type="submit"]');
    
    // Should show error
    await expect(page.locator('text=Invalid username or password')).toBeVisible();
    
    // Should still be on login page
    await expect(page.url()).toContain('/login');
  });
});