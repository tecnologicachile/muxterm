import { test, expect } from '@playwright/test';

test('simple webssh test', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:3003');
  
  // Take screenshot of login page
  await page.screenshot({ path: 'tests/screenshots/login-page.png' });
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Fill login form
  const inputs = await page.locator('input').all();
  if (inputs.length >= 2) {
    await inputs[0].fill('test');  // username
    await inputs[1].fill('test123'); // password
  }
  
  // Click login button
  await page.click('button:has-text("LOGIN")');
  
  // Wait for navigation with better error handling
  try {
    await page.waitForURL('**/sessions', { timeout: 5000 });
  } catch (e) {
    console.log('Navigation failed, checking for errors...');
    // Check if there's an error message
    const errorElement = await page.locator('.MuiAlert-message').count();
    if (errorElement > 0) {
      const errorText = await page.locator('.MuiAlert-message').textContent();
      console.log('Login error:', errorText);
    }
  }
  
  // Take screenshot after login attempt
  await page.screenshot({ path: 'tests/screenshots/after-login.png' });
  
  // Check if we're on sessions page
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);
  
  if (!currentUrl.includes('/sessions')) {
    throw new Error(`Failed to login. Still on: ${currentUrl}`);
  }
  
  // Look for NEW SESSION button
  const newSessionBtn = page.locator('button:has-text("NEW SESSION")');
  await expect(newSessionBtn).toBeVisible();
  
  // Click NEW SESSION
  await newSessionBtn.click();
  
  // Wait a bit
  await page.waitForTimeout(1000);
  
  // Take screenshot of dialog
  await page.screenshot({ path: 'tests/screenshots/new-session-dialog.png' });
  
  // Look for input field in dialog (it might be the only visible input)
  const dialogInput = page.locator('input:visible').first();
  await dialogInput.fill('Test Session');
  
  // Click CREATE button
  await page.click('button:has-text("CREATE")');
  
  // Wait for terminal page
  await page.waitForTimeout(3000);
  
  // Take screenshot of terminal
  await page.screenshot({ path: 'tests/screenshots/terminal-page.png' });
  
  // Verify we're on terminal page
  expect(page.url()).toContain('/terminal/');
  
  // Try to type something
  await page.keyboard.type('echo "Hello from Playwright"');
  await page.keyboard.press('Enter');
  
  await page.waitForTimeout(1000);
  
  // Take final screenshot
  await page.screenshot({ path: 'tests/screenshots/terminal-with-command.png' });
});