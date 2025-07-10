import { test, expect } from '@playwright/test';

test('Simple diagnostic test', async ({ page }) => {
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser error:', msg.text());
    }
  });
  
  // Go to app
  await page.goto('http://localhost:3003');
  await page.waitForTimeout(2000);
  
  // Login
  await page.fill('input[name="username"]', 'test');
  await page.fill('input[name="password"]', 'test123');
  await page.click('button[type="submit"]');
  
  console.log('Waiting for sessions page...');
  await page.waitForURL('**/sessions', { timeout: 10000 });
  console.log('Sessions page loaded');
  
  // Check sessions
  const sessionCount = await page.locator('.session-card').count();
  console.log(`Found ${sessionCount} sessions`);
  
  // Create new session
  await page.click('button:has-text("New Session")');
  await page.waitForTimeout(1000);
  
  // Check for dialog
  const dialog = page.locator('.MuiDialog-root');
  if (await dialog.count() > 0) {
    console.log('Dialog found, filling name...');
    await page.locator('.MuiDialog-root input').fill('TestSession');
    await page.click('.MuiDialog-root button:has-text("Create")');
  }
  
  console.log('Waiting for terminal page...');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  console.log('Terminal page loaded');
  
  // Wait and check for terminal
  await page.waitForTimeout(3000);
  
  const terminalCount = await page.locator('.xterm-viewport').count();
  console.log(`Found ${terminalCount} terminals`);
  
  const terminalVisible = await page.locator('.xterm-viewport').first().isVisible();
  console.log(`Terminal visible: ${terminalVisible}`);
  
  // Take screenshot
  await page.screenshot({ path: 'terminal-diagnostic.png', fullPage: true });
});