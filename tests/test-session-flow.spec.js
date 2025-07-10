const { test, expect } = require('@playwright/test');

test.describe('Test Session Flow', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Complete session flow test', async ({ page, context }) => {
    console.log('\n=== COMPLETE SESSION FLOW TEST ===');
    
    // Monitor console logs
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'info') {
        console.log('Browser:', msg.text());
      }
    });
    
    // Step 1: Fresh login
    console.log('\n1. Fresh login...');
    await page.goto(clientUrl + '/login');
    await page.waitForTimeout(1000);
    
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    console.log('✓ Logged in, at sessions page');
    
    // Step 2: Count initial sessions
    await page.waitForTimeout(2000);
    let sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`\n2. Initial session count: ${sessionCount}`);
    
    // Step 3: Create a new session
    console.log('\n3. Creating new session...');
    const createBtn = await page.locator('button').filter({ hasText: /new session/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      
      // Check for dialog
      const dialog = await page.locator('[role="dialog"]').isVisible();
      if (dialog) {
        await page.fill('input[type="text"]', 'Test Session Created');
        await page.click('button:has-text("Create")');
      }
      
      await page.waitForTimeout(2000);
      
      // Check if navigated to terminal
      if (page.url().includes('/terminal/')) {
        const sessionId = page.url().split('/terminal/')[1];
        console.log(`✓ Created session: ${sessionId}`);
        
        // Go back to sessions
        await page.goto(clientUrl + '/sessions');
        await page.waitForTimeout(2000);
      }
    }
    
    // Step 4: Count sessions after creation
    sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`\n4. Sessions after creation: ${sessionCount}`);
    
    // Step 5: Navigate away and back
    console.log('\n5. Navigating away and back...');
    await page.goto(clientUrl);
    await page.waitForTimeout(1000);
    await page.goto(clientUrl + '/sessions');
    await page.waitForTimeout(2000);
    
    sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Sessions after navigation: ${sessionCount}`);
    
    // Step 6: Direct navigation
    console.log('\n6. Direct navigation to sessions...');
    await page.goto(clientUrl + '/sessions');
    await page.waitForTimeout(2000);
    
    sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Sessions after direct navigation: ${sessionCount}`);
    
    // Step 7: Logout and login again
    console.log('\n7. Logout and login again...');
    const logoutBtn = await page.locator('button[aria-label="Logout"]').or(page.locator('button').filter({ hasText: /logout/i }));
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForURL('**/login');
      
      // Login again
      await page.fill('input[name="username"]', 'test');
      await page.fill('input[name="password"]', 'test123');
      await page.click('button[type="submit"]');
      
      await page.waitForURL('**/sessions');
      await page.waitForTimeout(2000);
      
      sessionCount = await page.locator('div.MuiCard-root').count();
      console.log(`Sessions after re-login: ${sessionCount}`);
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/session-flow-final.png', 
      fullPage: true 
    });
    
    console.log('\n✅ Test complete!');
  });
});