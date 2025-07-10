import { test, expect } from '@playwright/test';

test('Vertical split bug - Content preservation', async ({ page }) => {
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
  await sessionInput.fill('Vertical Split Test');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  // Wait for terminal
  await page.waitForTimeout(3000);
  await page.waitForSelector('.xterm', { timeout: 10000 });
  
  console.log('1. Executing commands before split...');
  
  // Execute commands
  await page.keyboard.type('echo "VERTICAL TEST LINE 1"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  await page.keyboard.type('echo "VERTICAL TEST LINE 2"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  await page.keyboard.type('ls -la | head -5');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  
  // Screenshot before split
  await page.screenshot({ path: 'tests/screenshots/vertical-1-before.png' });
  
  // Get terminal content
  const contentBefore = await page.locator('.xterm').first().textContent();
  console.log('Content before split:', contentBefore?.substring(0, 100));
  
  console.log('2. Performing VERTICAL split...');
  
  // Perform VERTICAL split
  await page.click('button:has-text("Split")');
  await page.click('text=Split Vertical');
  await page.waitForTimeout(3000);
  
  // Screenshot after split
  await page.screenshot({ path: 'tests/screenshots/vertical-2-after.png' });
  
  // Check terminals
  const terminalCount = await page.locator('.xterm').count();
  console.log(`3. Terminals after vertical split: ${terminalCount}`);
  
  // Get content after split
  const contentAfter = await page.locator('.xterm').first().textContent();
  console.log('Content after split:', contentAfter?.substring(0, 100));
  
  // Test interaction
  console.log('4. Testing terminal interaction...');
  const firstTerminal = await page.locator('.xterm').first();
  await firstTerminal.click();
  await page.waitForTimeout(500);
  await page.keyboard.type('echo "AFTER VERTICAL SPLIT"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Final screenshot
  await page.screenshot({ path: 'tests/screenshots/vertical-3-final.png' });
  
  // Verify
  expect(terminalCount).toBe(2);
  expect(contentAfter).toBeTruthy();
  
  console.log('✅ Vertical split test completed');
});