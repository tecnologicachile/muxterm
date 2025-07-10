import { test, expect } from '@playwright/test';

test('Duplicate input bug - Characters typed twice', async ({ page }) => {
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
  await sessionInput.fill('Duplicate Input Test');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  // Wait for terminal
  await page.waitForTimeout(3000);
  await page.waitForSelector('.xterm', { timeout: 10000 });
  
  console.log('=== Testing single character input ===');
  
  // Type single character
  await page.keyboard.type('a');
  await page.waitForTimeout(500);
  
  // Get terminal content
  const terminalContent = await page.locator('.xterm-screen').textContent();
  console.log('Terminal content after typing "a":', terminalContent);
  
  // Check if 'a' appears once or twice
  const aCount = (terminalContent.match(/a/g) || []).length;
  console.log('Number of "a" characters found:', aCount);
  
  // Type a word
  await page.keyboard.type('test');
  await page.waitForTimeout(500);
  
  // Get terminal content again
  const terminalContent2 = await page.locator('.xterm-screen').textContent();
  console.log('Terminal content after typing "test":', terminalContent2);
  
  // Check for duplicates
  const hasDoubleT = terminalContent2.includes('tt');
  const hasDoubleE = terminalContent2.includes('ee');
  const hasDoubleS = terminalContent2.includes('ss');
  
  console.log('Has double t:', hasDoubleT);
  console.log('Has double e:', hasDoubleE);
  console.log('Has double s:', hasDoubleS);
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/duplicate-input.png' });
  
  // Test with split panels
  console.log('\n=== Testing with split panels ===');
  
  // Clear line
  await page.keyboard.press('Control+C');
  await page.waitForTimeout(500);
  
  // Split horizontal
  await page.click('button:has-text("Split")');
  await page.click('text=Split Horizontal');
  await page.waitForTimeout(2000);
  
  // Type in first terminal
  const firstTerminal = await page.locator('.xterm').first();
  await firstTerminal.click();
  await page.waitForTimeout(500);
  await page.keyboard.type('x');
  await page.waitForTimeout(500);
  
  // Check for duplicates in first terminal
  const firstTerminalContent = await page.locator('.xterm-screen').first().textContent();
  const xCount = (firstTerminalContent.match(/x/g) || []).length;
  console.log('Number of "x" in first terminal:', xCount);
  
  // Type in second terminal
  const secondTerminal = await page.locator('.xterm').nth(1);
  await secondTerminal.click();
  await page.waitForTimeout(500);
  await page.keyboard.type('y');
  await page.waitForTimeout(500);
  
  // Check for duplicates in second terminal
  const secondTerminalContent = await page.locator('.xterm-screen').nth(1).textContent();
  const yCount = (secondTerminalContent.match(/y/g) || []).length;
  console.log('Number of "y" in second terminal:', yCount);
  
  // Take final screenshot
  await page.screenshot({ path: 'tests/screenshots/duplicate-input-split.png' });
  
  // Assert no duplicates
  expect(aCount).toBeLessThanOrEqual(1);
  expect(xCount).toBeLessThanOrEqual(1);
  expect(yCount).toBeLessThanOrEqual(1);
});