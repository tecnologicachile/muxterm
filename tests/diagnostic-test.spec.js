import { test, expect } from '@playwright/test';

test('Diagnostic: Check application availability', async ({ page }) => {
  console.log('1. Checking if application is accessible...');
  
  try {
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' });
    console.log('✓ Page loaded');
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'diagnostic-screenshot.png' });
    
    // Check if login form exists
    const usernameInput = await page.locator('input[name="username"]');
    const passwordInput = await page.locator('input[name="password"]');
    
    console.log('2. Checking login form...');
    console.log('Username input visible:', await usernameInput.isVisible());
    console.log('Password input visible:', await passwordInput.isVisible());
    
    // Get page content for debugging
    const content = await page.content();
    if (content.includes('Cannot GET') || content.includes('Error')) {
      console.log('❌ Error page detected');
      console.log('Page content:', content.substring(0, 500));
    }
    
    // Check for React app
    const rootElement = await page.locator('#root');
    console.log('React root element exists:', await rootElement.count() > 0);
    
  } catch (error) {
    console.log('❌ Error accessing application:', error.message);
    throw error;
  }
});