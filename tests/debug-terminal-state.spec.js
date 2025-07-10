import { test, expect } from '@playwright/test';

test('Debug terminal state preservation', async ({ page }) => {
  // Inject console log interceptor
  let terminalStates = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Terminal') || text.includes('[TerminalView]') || text.includes('[PanelManager]')) {
      console.log('BROWSER:', text);
      if (text.includes('terminalId:')) {
        terminalStates.push(text);
      }
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
  await sessionInput.fill('State Debug Test');
  await page.click('button:has-text("CREATE")');
  await page.waitForURL('**/terminal/**', { timeout: 10000 });
  
  // Wait for terminal
  await page.waitForTimeout(3000);
  await page.waitForSelector('.xterm', { timeout: 10000 });
  
  console.log('\n=== TERMINAL STATE BEFORE SPLIT ===');
  terminalStates.forEach(s => console.log(s));
  terminalStates = [];
  
  // Execute command
  await page.keyboard.type('echo "CONTENT TO PRESERVE"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  
  // Get terminal HTML content
  const terminalContentBefore = await page.locator('.xterm-screen').innerHTML();
  console.log('Terminal HTML length before split:', terminalContentBefore.length);
  
  console.log('\n=== PERFORMING SPLIT ===');
  
  // Perform split
  await page.click('button:has-text("Split")');
  await page.click('text=Split Vertical');
  await page.waitForTimeout(3000);
  
  console.log('\n=== TERMINAL STATE AFTER SPLIT ===');
  terminalStates.forEach(s => console.log(s));
  
  // Get terminal HTML content after split
  const firstTerminal = await page.locator('.xterm-screen').first();
  const terminalContentAfter = await firstTerminal.innerHTML();
  console.log('First terminal HTML length after split:', terminalContentAfter.length);
  
  // Check if content is preserved
  const hasContent = terminalContentAfter.includes('CONTENT TO PRESERVE');
  console.log('Content preserved:', hasContent);
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/debug-state.png' });
});