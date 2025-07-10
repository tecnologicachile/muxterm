import { test, expect } from '@playwright/test';

test('Debug login page', async ({ page }) => {
  await page.goto('http://localhost:3003');
  await page.waitForTimeout(2000);
  
  // Debug all inputs
  const allInputs = await page.locator('input').all();
  console.log(`Found ${allInputs.length} inputs`);
  
  for (let i = 0; i < allInputs.length; i++) {
    const input = allInputs[i];
    const name = await input.getAttribute('name');
    const type = await input.getAttribute('type');
    const placeholder = await input.getAttribute('placeholder');
    const visible = await input.isVisible();
    console.log(`Input ${i}: name="${name}", type="${type}", placeholder="${placeholder}", visible=${visible}`);
  }
  
  // Check for MUI TextField
  const muiInputs = await page.locator('.MuiTextField-root input').all();
  console.log(`\nFound ${muiInputs.length} MUI inputs`);
  
  // Look for text "Username" or "Password"
  const hasUsername = await page.locator('text=Username').count();
  const hasPassword = await page.locator('text=Password').count();
  console.log(`\nUsername label found: ${hasUsername > 0}`);
  console.log(`Password label found: ${hasPassword > 0}`);
  
  // Take screenshot
  await page.screenshot({ path: 'login-page-debug.png', fullPage: true });
});