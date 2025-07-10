import { test, expect } from '@playwright/test';

test('Debug terminal initialization', async ({ page }) => {
  // Enable all console logging
  page.on('console', msg => {
    console.log(`[${msg.type()}]`, msg.text());
  });

  // Navigate and login
  await page.goto('http://localhost:3003');
  await page.waitForLoadState('networkidle');
  
  const inputs = await page.locator('input').all();
  await inputs[0].fill('test');
  await inputs[1].fill('test123');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/sessions', { timeout: 10000 });
  
  console.log('=== Creating session ===');
  
  // Create session
  await page.click('button:has-text("NEW SESSION")');
  await page.waitForSelector('text=Create New Session');
  const sessionInput = page.locator('input:visible').first();
  await sessionInput.fill('Debug Init');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  console.log('=== Waiting for terminal ===');
  
  // Wait and check every second
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    
    const status = await page.evaluate(() => {
      const xterm = document.querySelector('.xterm');
      const container = document.querySelector('div[style*="cursor: text"]');
      const canvas = document.querySelector('canvas');
      return {
        hasXterm: !!xterm,
        hasContainer: !!container,
        hasCanvas: !!canvas,
        containerDimensions: container ? {
          width: container.offsetWidth,
          height: container.offsetHeight
        } : null
      };
    });
    
    console.log(`Check ${i + 1}:`, status);
    
    if (status.hasXterm) {
      console.log('Terminal found!');
      break;
    }
  }
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/debug-init.png' });
});