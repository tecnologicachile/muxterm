const { test, expect } = require('@playwright/test');

test.describe('Terminal Prompt Duplication Tests', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test.beforeEach(async ({ page }) => {
    // Clear server logs before each test
    await page.goto(serverUrl + '/api/auth/login');
  });

  test('Iteration 1: Reproduce prompt duplication on refresh', async ({ page }) => {
    console.log('=== ITERATION 1: Reproducing prompt duplication ===');
    
    // Step 1: Login
    await page.goto(clientUrl);
    await page.waitForSelector('input[name="username"]');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    
    // Step 2: Create a new session
    await page.click('button:has-text("Create New Session")');
    await page.waitForTimeout(500);
    
    // Step 3: Enter the terminal
    await page.click('div.MuiCard-root');
    await page.waitForURL('**/terminal/**');
    await page.waitForTimeout(1000);
    
    // Step 4: Split terminal
    await page.click('button[title="Split"]');
    await page.waitForTimeout(1000);
    
    // Step 5: Take screenshot before refresh
    await page.screenshot({ path: 'tests/screenshots/before-refresh-1.png', fullPage: true });
    
    // Count prompts in left terminal before refresh
    const leftTerminalBefore = await page.locator('.terminal').first();
    const leftContentBefore = await leftTerminalBefore.textContent();
    const promptCountBefore = (leftContentBefore.match(/usuario@usuario-Standard-PC-i440FX-PIIX-1996:-\$/g) || []).length;
    console.log(`Prompts before refresh: ${promptCountBefore}`);
    
    // Step 6: Refresh the page
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Step 7: Take screenshot after refresh
    await page.screenshot({ path: 'tests/screenshots/after-refresh-1.png', fullPage: true });
    
    // Count prompts in left terminal after refresh
    const leftTerminalAfter = await page.locator('.terminal').first();
    const leftContentAfter = await leftTerminalAfter.textContent();
    const promptCountAfter = (leftContentAfter.match(/usuario@usuario-Standard-PC-i440FX-PIIX-1996:-\$/g) || []).length;
    console.log(`Prompts after refresh: ${promptCountAfter}`);
    
    // Log terminal content for debugging
    console.log('Left terminal content after refresh:');
    console.log(leftContentAfter.substring(0, 500) + '...');
    
    // Test assertion - prompts should not increase
    if (promptCountAfter > promptCountBefore) {
      console.error(`❌ FAILED: Prompts increased from ${promptCountBefore} to ${promptCountAfter}`);
      expect(promptCountAfter).toBeLessThanOrEqual(promptCountBefore);
    } else {
      console.log(`✅ PASSED: Prompts stayed the same or decreased`);
    }
  });
});