import { test, expect } from '@playwright/test';

test('debug login process', async ({ page }) => {
  console.log('1. Navigating to app...');
  await page.goto('http://localhost:3003');
  
  console.log('2. Waiting for page to load...');
  await page.waitForLoadState('networkidle');
  
  console.log('3. Current URL:', page.url());
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/debug-1-initial.png' });
  
  console.log('4. Looking for input fields...');
  const inputs = await page.locator('input').count();
  console.log('   Found', inputs, 'input fields');
  
  console.log('5. Filling form...');
  // Try different selectors
  try {
    // Method 1: By index
    const allInputs = await page.locator('input').all();
    if (allInputs.length >= 2) {
      await allInputs[0].fill('test');
      await allInputs[1].fill('test123');
      console.log('   Filled using index method');
    }
  } catch (e) {
    console.log('   Index method failed:', e.message);
  }
  
  await page.screenshot({ path: 'tests/screenshots/debug-2-filled.png' });
  
  console.log('6. Looking for submit button...');
  const buttons = await page.locator('button').all();
  console.log('   Found', buttons.length, 'buttons');
  
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent();
    console.log(`   Button ${i}: "${text}"`);
  }
  
  console.log('7. Clicking LOGIN button...');
  await page.click('button:has-text("LOGIN")');
  
  console.log('8. Waiting for response...');
  // Listen for network responses
  page.on('response', response => {
    if (response.url().includes('/api/auth/login')) {
      console.log('   Login response:', response.status(), response.statusText());
    }
  });
  
  await page.waitForTimeout(3000);
  
  console.log('9. Final URL:', page.url());
  await page.screenshot({ path: 'tests/screenshots/debug-3-after-click.png' });
  
  // Check for error messages
  const alerts = await page.locator('[role="alert"]').count();
  if (alerts > 0) {
    const alertText = await page.locator('[role="alert"]').first().textContent();
    console.log('10. Alert found:', alertText);
  }
  
  // Check localStorage for auth token
  const token = await page.evaluate(() => localStorage.getItem('token'));
  console.log('11. Auth token in localStorage:', token ? 'Present' : 'Not found');
});