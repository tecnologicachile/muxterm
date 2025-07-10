import { test, expect } from '@playwright/test';

test('Test no duplicates after fix', async ({ page }) => {
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
  await sessionInput.fill('No Duplicates Test');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  // Wait for terminal
  await page.waitForTimeout(3000);
  await page.waitForSelector('.xterm', { timeout: 10000 });
  
  console.log('=== Test 1: Single character ===');
  
  // Type echo command to have controlled output
  await page.keyboard.type('echo "X"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Get text and count X
  const text1 = await page.locator('.xterm-screen').innerText();
  const xCount = (text1.match(/X/g) || []).length;
  console.log('X count:', xCount);
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/no-dup-1.png' });
  
  console.log('=== Test 2: After split ===');
  
  // Split panel
  await page.click('button:has-text("Split")');
  await page.click('text=Split Horizontal');
  await page.waitForTimeout(2000);
  
  // Type in first terminal
  const firstTerminal = await page.locator('.xterm').first();
  await firstTerminal.click();
  await page.waitForTimeout(500);
  
  await page.keyboard.type('echo "Y"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Get text from first terminal
  const text2 = await page.locator('.xterm-screen').first().innerText();
  const yCount = (text2.match(/Y/g) || []).length;
  console.log('Y count in first terminal:', yCount);
  
  // Type in second terminal
  const secondTerminal = await page.locator('.xterm').nth(1);
  await secondTerminal.click();
  await page.waitForTimeout(500);
  
  await page.keyboard.type('echo "Z"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Get text from second terminal
  const text3 = await page.locator('.xterm-screen').nth(1).innerText();
  const zCount = (text3.match(/Z/g) || []).length;
  console.log('Z count in second terminal:', zCount);
  
  // Take final screenshot
  await page.screenshot({ path: 'tests/screenshots/no-dup-2.png' });
  
  // Expect only 1 of each character
  expect(xCount).toBe(1);
  expect(yCount).toBe(1);
  expect(zCount).toBe(1);
  
  console.log('✅ No duplicates found!');
});