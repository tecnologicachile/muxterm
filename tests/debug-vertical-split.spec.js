import { test, expect } from '@playwright/test';

test('Debug vertical split - Track component lifecycle', async ({ page }) => {
  // Inject console log interceptor
  page.on('console', msg => {
    if (msg.text().includes('[Terminal') || msg.text().includes('[PanelManager]')) {
      console.log('BROWSER:', msg.text());
    }
  });

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
  await sessionInput.fill('Debug Split Test');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  // Wait for terminal
  await page.waitForTimeout(3000);
  await page.waitForSelector('.xterm', { timeout: 10000 });
  
  console.log('\n=== BEFORE COMMANDS ===');
  
  // Execute command
  await page.keyboard.type('echo "BEFORE SPLIT"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  
  // Check terminal content
  const terminalElement = await page.locator('.xterm').first();
  const bbox = await terminalElement.boundingBox();
  console.log('Terminal dimensions before split:', bbox);
  
  console.log('\n=== PERFORMING SPLIT ===');
  
  // Perform split
  await page.click('button:has-text("Split")');
  await page.click('text=Split Vertical');
  await page.waitForTimeout(3000);
  
  console.log('\n=== AFTER SPLIT ===');
  
  // Check both terminals
  const terminalCount = await page.locator('.xterm').count();
  console.log('Terminal count:', terminalCount);
  
  for (let i = 0; i < terminalCount; i++) {
    const term = await page.locator('.xterm').nth(i);
    const bbox = await term.boundingBox();
    console.log(`Terminal ${i} dimensions:`, bbox);
  }
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/debug-vertical.png' });
});