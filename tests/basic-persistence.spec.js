import { test, expect } from '@playwright/test';

test('Basic persistence test', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3003');
  await page.fill('input[name="username"]', 'test');
  await page.fill('input[name="password"]', 'test123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/sessions');
  
  console.log('1. Creating new session...');
  
  // Create session
  await page.click('button:has-text("New Session")');
  await page.waitForTimeout(1000);
  
  const dialog = page.locator('.MuiDialog-root');
  if (await dialog.count() > 0) {
    await page.locator('.MuiDialog-root input').fill('BasicTest');
    await page.click('.MuiDialog-root button:has-text("Create")');
  }
  
  await page.waitForURL('**/terminal/**');
  await page.waitForTimeout(3000);
  
  console.log('2. Checking terminal...');
  
  // Check terminal exists
  const terminalCount = await page.locator('.xterm-viewport').count();
  console.log(`   Found ${terminalCount} terminals`);
  expect(terminalCount).toBe(1);
  
  // Try to type in terminal
  console.log('3. Typing command...');
  
  // Try different ways to focus terminal
  const terminal = page.locator('.terminal-container').first();
  const xtermViewport = page.locator('.xterm-viewport').first();
  const xtermScreen = page.locator('.xterm-screen').first();
  
  // Try clicking different elements
  try {
    await terminal.click({ timeout: 2000 });
  } catch {
    try {
      await xtermViewport.click({ timeout: 2000 });
    } catch {
      await xtermScreen.click({ force: true });
    }
  }
  
  await page.waitForTimeout(500);
  await page.keyboard.type('echo "Test persistence"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Get terminal content
  const contentBefore = await xtermViewport.textContent();
  console.log('4. Terminal content before logout:', contentBefore.substring(0, 100));
  
  // Go back to sessions
  console.log('5. Going back to sessions...');
  const backButton = page.locator('button').filter({ has: page.locator('[data-testid="ArrowBackIcon"]') });
  await backButton.click();
  await page.waitForURL('**/sessions');
  
  // Logout
  console.log('6. Logging out...');
  const logoutButton = page.locator('button').filter({ has: page.locator('[data-testid="LogoutIcon"]') });
  await logoutButton.click();
  await page.waitForURL('**/login');
  
  // Login again
  console.log('7. Logging in again...');
  await page.fill('input[name="username"]', 'test');
  await page.fill('input[name="password"]', 'test123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/sessions');
  
  // Open the session
  console.log('8. Opening session...');
  await page.locator('text=BasicTest').locator('..').locator('..').locator('button:has-text("Open")').click();
  await page.waitForURL('**/terminal/**');
  await page.waitForTimeout(3000);
  
  // Check content
  console.log('9. Checking restored content...');
  const contentAfter = await page.locator('.xterm-viewport').first().textContent();
  console.log('   Terminal content after restore:', contentAfter.substring(0, 100));
  
  expect(contentAfter).toContain('Test persistence');
  console.log('✅ Test passed! Content was preserved.');
});