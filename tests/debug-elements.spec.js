import { test } from '@playwright/test';

test('Debug page elements', async ({ page }) => {
  // Login first
  await page.goto('http://localhost:3003');
  await page.fill('input[name="username"]', 'test');
  await page.fill('input[name="password"]', 'test123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/sessions');
  
  console.log('\n=== Sessions Page ===');
  
  // Find all buttons
  const buttons = await page.locator('button').all();
  console.log(`Found ${buttons.length} buttons:`);
  
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent();
    const ariaLabel = await buttons[i].getAttribute('aria-label');
    const innerHTML = await buttons[i].innerHTML();
    console.log(`Button ${i}: text="${text}", aria-label="${ariaLabel}"`);
    if (innerHTML.includes('svg')) {
      console.log(`  Contains SVG icon`);
    }
  }
  
  // Look for logout icon specifically
  console.log('\n=== Looking for logout ===');
  const svgIcons = await page.locator('svg').all();
  console.log(`Found ${svgIcons.length} SVG icons`);
  
  // Try different selectors
  const iconButton = await page.locator('button svg').count();
  console.log(`Icon buttons: ${iconButton}`);
  
  // Take screenshot
  await page.screenshot({ path: 'sessions-page-debug.png', fullPage: true });
});