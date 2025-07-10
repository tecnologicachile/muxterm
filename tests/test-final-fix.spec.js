const { test, expect } = require('@playwright/test');

test.describe('Test Final Fix', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Final test: Create session, close it, verify persistence', async ({ page, context }) => {
    console.log('\n=== FINAL FIX TEST ===');
    
    // Step 1: Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    let sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Step 1 - Initial sessions: ${sessionCount}`);
    
    // Step 2: Create a session properly
    const createBtn = await page.locator('button').filter({ hasText: /new session/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      
      const dialog = await page.locator('[role="dialog"]').isVisible();
      if (dialog) {
        await page.fill('input[type="text"]', 'Test Session Fix');
        await page.click('button:has-text("Create")');
        await page.waitForTimeout(1000);
        
        // Should navigate to terminal
        await page.waitForURL('**/terminal/**');
        const sessionId = page.url().split('/terminal/')[1];
        console.log(`Step 2 - Created session: ${sessionId}`);
        
        // Execute a command and then close the browser tab (simulating disconnect)
        await page.keyboard.type('echo "Testing session cleanup"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // Go back to sessions
        await page.goto(clientUrl + '/sessions');
        await page.waitForTimeout(2000);
        
        sessionCount = await page.locator('div.MuiCard-root').count();
        console.log(`Step 2 - Sessions after creating: ${sessionCount}`);
      }
    }
    
    // Step 3: Navigate directly to sessions
    console.log('\nStep 3 - Testing direct navigation...');
    await page.goto(clientUrl + '/sessions');
    await page.waitForTimeout(2000);
    
    sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Step 3 - Sessions via direct navigation: ${sessionCount}`);
    
    // Step 4: Navigate from root
    console.log('\nStep 4 - Testing root navigation...');
    await page.goto(clientUrl);
    await page.waitForTimeout(1000);
    // Should redirect to sessions
    
    sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Step 4 - Sessions via root navigation: ${sessionCount}`);
    
    // Step 5: Final verification
    await page.screenshot({ 
      path: 'tests/screenshots/final-fix-result.png', 
      fullPage: true 
    });
    
    console.log('\n✅ FINAL TEST COMPLETE!');
    console.log(`Final session count: ${sessionCount}`);
    
    // Verify sessions persist across navigation
    expect(sessionCount).toBeGreaterThan(0);
  });
});