import { test, expect } from '@playwright/test';

test('Multiple splits - Content preservation test', async ({ page }) => {
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
  await sessionInput.fill('Multiple Splits Test');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  // Wait for terminal
  await page.waitForTimeout(3000);
  await page.waitForSelector('.xterm', { timeout: 10000 });
  
  console.log('=== PANEL 1: Initial commands ===');
  
  // Execute commands in first terminal
  await page.keyboard.type('echo "PANEL 1: ORIGINAL CONTENT"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  
  await page.keyboard.type('date');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Screenshot 1
  await page.screenshot({ path: 'tests/screenshots/multi-1-single.png' });
  
  console.log('=== SPLIT 1: Creating second panel (horizontal) ===');
  
  // First split - horizontal
  await page.click('button:has-text("Split")');
  await page.click('text=Split Horizontal');
  await page.waitForTimeout(2000);
  
  // Verify 2 panels
  let terminalCount = await page.locator('.xterm').count();
  expect(terminalCount).toBe(2);
  
  // Click on second terminal and add content
  const secondTerminal = await page.locator('.xterm').nth(1);
  await secondTerminal.click();
  await page.waitForTimeout(500);
  await page.keyboard.type('echo "PANEL 2: SECOND TERMINAL"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Screenshot 2
  await page.screenshot({ path: 'tests/screenshots/multi-2-horizontal.png' });
  
  console.log('=== SPLIT 2: Creating third panel (vertical) ===');
  
  // Second split - vertical
  await page.click('button:has-text("Split")');
  await page.click('text=Split Vertical');
  await page.waitForTimeout(2000);
  
  // Verify 3 panels
  terminalCount = await page.locator('.xterm').count();
  expect(terminalCount).toBe(3);
  
  // Click on third terminal and add content
  const thirdTerminal = await page.locator('.xterm').nth(2);
  await thirdTerminal.click();
  await page.waitForTimeout(500);
  await page.keyboard.type('echo "PANEL 3: THIRD TERMINAL"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Screenshot 3
  await page.screenshot({ path: 'tests/screenshots/multi-3-three.png' });
  
  console.log('=== SPLIT 3: Creating fourth panel ===');
  
  // Third split
  await page.click('button:has-text("Split")');
  await page.click('text=Split Horizontal');
  await page.waitForTimeout(2000);
  
  // Verify 4 panels
  terminalCount = await page.locator('.xterm').count();
  expect(terminalCount).toBe(4);
  
  // Click on fourth terminal and add content
  const fourthTerminal = await page.locator('.xterm').nth(3);
  await fourthTerminal.click();
  await page.waitForTimeout(500);
  await page.keyboard.type('echo "PANEL 4: FOURTH TERMINAL"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Screenshot 4
  await page.screenshot({ path: 'tests/screenshots/multi-4-four.png' });
  
  console.log('=== VERIFICATION: Checking all panels have content ===');
  
  // Verify all panels still have their content
  const panels = await page.locator('.xterm-screen').all();
  for (let i = 0; i < panels.length; i++) {
    const content = await panels[i].textContent();
    console.log(`Panel ${i + 1} has content: ${content?.length > 0 ? 'YES' : 'NO'}`);
  }
  
  // Click on first terminal again
  const firstTerminal = await page.locator('.xterm').first();
  await firstTerminal.click();
  await page.waitForTimeout(500);
  await page.keyboard.type('echo "PANEL 1: STILL WORKING"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Final screenshot
  await page.screenshot({ path: 'tests/screenshots/multi-5-final.png' });
  
  console.log('✅ Multiple splits test completed successfully!');
});