const { test, expect } = require('@playwright/test');

test.describe('Verify Authentication Flow', () => {
  test('Complete auth flow: login, navigate, logout', async ({ page }) => {
    console.log('\n=== VERIFYING COMPLETE AUTH FLOW ===\n');
    
    // Step 1: Go to login page
    console.log('1. Navigate to login page');
    await page.goto('http://localhost:3003');
    await expect(page).toHaveURL(/.*login/);
    
    // Step 2: Fill and submit login form
    console.log('2. Fill login form');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    // Step 3: Verify navigation to sessions
    console.log('3. Verify navigation to sessions');
    await page.waitForURL('**/sessions');
    await expect(page).toHaveURL(/.*sessions/);
    
    // Step 4: Verify sessions page content
    console.log('4. Verify sessions page is loaded');
    await expect(page.locator('h4:has-text("Your Sessions")')).toBeVisible();
    await expect(page.locator('button:has-text("New Session")')).toBeVisible();
    
    // Step 5: Verify we can still access sessions after navigation
    console.log('5. Verify sessions access after navigation');
    await page.goto('http://localhost:3003/sessions');
    await expect(page).toHaveURL(/.*sessions/);
    
    // Step 6: Create a new session
    console.log('6. Create new session');
    await page.click('button:has-text("New Session")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await page.fill('input[type="text"]', 'Test Session');
    await page.click('button:has-text("Create")');
    
    // Step 7: Verify navigation to terminal
    console.log('7. Verify navigation to terminal');
    await page.waitForURL('**/terminal/**');
    await expect(page).toHaveURL(/.*terminal.*/);
    
    // Step 8: Go back to sessions
    console.log('8. Navigate back to sessions');
    await page.goBack();
    await expect(page).toHaveURL(/.*sessions/);
    
    // Step 9: Refresh page and verify still logged in
    console.log('9. Refresh page and verify auth persists');
    await page.reload();
    await expect(page).toHaveURL(/.*sessions/);
    await expect(page.locator('h4:has-text("Your Sessions")')).toBeVisible();
    
    console.log('\n✅ All authentication flow tests passed!');
  });
  
  test('Invalid login credentials', async ({ page }) => {
    console.log('\n=== TESTING INVALID CREDENTIALS ===\n');
    
    // Go to login page
    await page.goto('http://localhost:3003/login');
    
    // Try invalid credentials
    await page.fill('input[name="username"]', 'invalid');
    await page.fill('input[name="password"]', 'wrong');
    await page.click('button[type="submit"]');
    
    // Should show error and stay on login page
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/.*login/);
    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Invalid|failed/i);
    
    console.log('✅ Invalid credentials handled correctly');
  });
  
  test('Protected routes redirect to login', async ({ page }) => {
    console.log('\n=== TESTING PROTECTED ROUTES ===\n');
    
    // Clear any existing auth
    await page.goto('http://localhost:3003');
    await page.evaluate(() => localStorage.clear());
    
    // Try to access protected routes
    const protectedRoutes = [
      '/sessions',
      '/terminal/test-id'
    ];
    
    for (const route of protectedRoutes) {
      console.log(`Testing protected route: ${route}`);
      await page.goto(`http://localhost:3003${route}`);
      await expect(page).toHaveURL(/.*login/);
    }
    
    console.log('✅ All protected routes redirect to login when not authenticated');
  });
});