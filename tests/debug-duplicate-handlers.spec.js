import { test, expect } from '@playwright/test';

test('Debug duplicate handlers', async ({ page }) => {
  // Inject console log interceptor
  let dataHandlerSetups = 0;
  let terminalInits = 0;
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Setting up data handler')) {
      dataHandlerSetups++;
      console.log(`[${dataHandlerSetups}] DATA HANDLER SETUP:`, text);
    }
    if (text.includes('[Terminal Init]')) {
      terminalInits++;
      console.log(`[${terminalInits}] TERMINAL INIT:`, text);
    }
    if (text.includes('Input:') && text.includes('data:')) {
      console.log('INPUT EVENT:', text);
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
  await sessionInput.fill('Handler Debug Test');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  // Wait for terminal
  await page.waitForTimeout(3000);
  await page.waitForSelector('.xterm', { timeout: 10000 });
  
  console.log('\n=== STATS BEFORE INPUT ===');
  console.log('Data handler setups:', dataHandlerSetups);
  console.log('Terminal inits:', terminalInits);
  
  // Type single character
  console.log('\n=== TYPING "a" ===');
  await page.keyboard.type('a');
  await page.waitForTimeout(1000);
  
  // Split panel
  console.log('\n=== SPLITTING PANEL ===');
  await page.click('button:has-text("Split")');
  await page.click('text=Split Horizontal');
  await page.waitForTimeout(3000);
  
  console.log('\n=== STATS AFTER SPLIT ===');
  console.log('Data handler setups:', dataHandlerSetups);
  console.log('Terminal inits:', terminalInits);
  
  // Type in first terminal
  console.log('\n=== TYPING "x" IN FIRST TERMINAL ===');
  const firstTerminal = await page.locator('.xterm').first();
  await firstTerminal.click();
  await page.waitForTimeout(500);
  await page.keyboard.type('x');
  await page.waitForTimeout(1000);
  
  // Type in second terminal
  console.log('\n=== TYPING "y" IN SECOND TERMINAL ===');
  const secondTerminal = await page.locator('.xterm').nth(1);
  await secondTerminal.click();
  await page.waitForTimeout(500);
  await page.keyboard.type('y');
  await page.waitForTimeout(1000);
  
  console.log('\n=== FINAL STATS ===');
  console.log('Data handler setups:', dataHandlerSetups);
  console.log('Terminal inits:', terminalInits);
});