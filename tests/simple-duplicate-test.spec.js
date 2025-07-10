import { test, expect } from '@playwright/test';

test('Simple duplicate test', async ({ page }) => {
  // Navigate and login
  await page.goto('http://localhost:3003');
  await page.waitForLoadState('networkidle');
  
  const inputs = await page.locator('input').all();
  await inputs[0].fill('test');
  await inputs[1].fill('test123');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/sessions', { timeout: 10000 });
  
  // Create session
  await page.click('button:has-text("NEW SESSION")');
  await page.waitForSelector('text=Create New Session');
  const sessionInput = page.locator('input:visible').first();
  await sessionInput.fill('Simple Test');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  // Wait for terminal
  await page.waitForTimeout(3000);
  await page.waitForSelector('.xterm', { timeout: 10000 });
  
  // Clear screen first
  await page.keyboard.type('clear');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Type a single character
  await page.keyboard.type('a');
  await page.waitForTimeout(1000);
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/simple-single-char.png' });
  
  // Get visible text (not HTML)
  const visibleText = await page.locator('.xterm-screen').innerText();
  console.log('Visible text:', JSON.stringify(visibleText));
  
  // Count 'a' characters in visible text
  const aCount = (visibleText.match(/a/g) || []).length;
  console.log('Number of "a" characters:', aCount);
  
  expect(aCount).toBe(1);
});