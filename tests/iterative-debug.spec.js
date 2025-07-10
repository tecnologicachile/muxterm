const { test, expect } = require('@playwright/test');

test.describe('Iterative Debug Tests', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  // Test 1: Basic session creation and persistence
  test('Iteration 1: Basic session persistence', async ({ page, context }) => {
    console.log('\n=== ITERATION 1: BASIC SESSION PERSISTENCE ===');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    // Count initial sessions
    let sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Initial sessions: ${sessionCount}`);
    
    // Create new session
    const createBtn = await page.locator('button').filter({ hasText: /new session/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      
      const dialog = await page.locator('[role="dialog"]').isVisible();
      if (dialog) {
        await page.fill('input[type="text"]', 'Test Session Iter1');
        await page.click('button:has-text("Create")');
      }
      
      await page.waitForTimeout(2000);
      
      // Go back to sessions
      await page.goto(clientUrl + '/sessions');
      await page.waitForTimeout(2000);
    }
    
    // Check session count after creation
    sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Sessions after creation: ${sessionCount}`);
    
    // Test direct navigation 3 times
    for (let i = 1; i <= 3; i++) {
      console.log(`Direct navigation test ${i}...`);
      await page.goto(clientUrl + '/sessions');
      await page.waitForTimeout(1500);
      
      const count = await page.locator('div.MuiCard-root').count();
      console.log(`  Navigation ${i}: ${count} sessions`);
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/iter1-result.png', 
      fullPage: true 
    });
  });
  
  // Test 2: Session persistence after terminal creation
  test('Iteration 2: Terminal creation and session persistence', async ({ page, context }) => {
    console.log('\n=== ITERATION 2: TERMINAL CREATION AND PERSISTENCE ===');
    
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    // Check initial state
    let sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Initial sessions: ${sessionCount}`);
    
    if (sessionCount > 0) {
      // Click on first session
      await page.locator('div.MuiCard-root').first().click();
      await page.waitForURL('**/terminal/**');
      
      const sessionId = page.url().split('/terminal/')[1];
      console.log(`Opened session: ${sessionId}`);
      
      // Type a command
      await page.waitForTimeout(2000);
      await page.keyboard.type('echo "Testing terminal persistence"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Go back to sessions and check persistence
      await page.goto(clientUrl + '/sessions');
      await page.waitForTimeout(2000);
      
      sessionCount = await page.locator('div.MuiCard-root').count();
      console.log(`Sessions after terminal use: ${sessionCount}`);
      
      // Test multiple navigations
      for (let i = 1; i <= 3; i++) {
        await page.goto(clientUrl + '/sessions');
        await page.waitForTimeout(1000);
        const count = await page.locator('div.MuiCard-root').count();
        console.log(`Navigation ${i}: ${count} sessions`);
      }
    } else {
      console.log('No sessions found, creating one...');
      const createBtn = await page.locator('button').filter({ hasText: /new session/i }).first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
        const dialog = await page.locator('[role="dialog"]').isVisible();
        if (dialog) {
          await page.fill('input[type="text"]', 'Test Session Iter2');
          await page.click('button:has-text("Create")');
          await page.waitForTimeout(2000);
        }
      }
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/iter2-result.png', 
      fullPage: true 
    });
  });
  
  // Test 3: Split terminal persistence
  test('Iteration 3: Split terminal and session persistence', async ({ page, context }) => {
    console.log('\n=== ITERATION 3: SPLIT TERMINAL PERSISTENCE ===');
    
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    let sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Initial sessions: ${sessionCount}`);
    
    if (sessionCount > 0) {
      // Enter the session
      await page.locator('div.MuiCard-root').first().click();
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Try to split
      const splitBtn = await page.locator('button[title="Split"]').or(
        page.locator('button').filter({ hasText: /split/i })
      );
      
      if (await splitBtn.isVisible()) {
        await splitBtn.click();
        await page.waitForTimeout(1000);
        
        // Type in first terminal
        await page.keyboard.type('echo "Left panel"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        console.log('Split terminal created');
      }
      
      // Go back to sessions
      await page.goto(clientUrl + '/sessions');
      await page.waitForTimeout(2000);
      
      sessionCount = await page.locator('div.MuiCard-root').count();
      console.log(`Sessions after split: ${sessionCount}`);
      
      // Test refresh persistence
      for (let i = 1; i <= 3; i++) {
        await page.reload();
        await page.waitForTimeout(1500);
        const count = await page.locator('div.MuiCard-root').count();
        console.log(`Refresh ${i}: ${count} sessions`);
      }
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/iter3-result.png', 
      fullPage: true 
    });
  });
  
  // Test 4: Logout and re-login persistence
  test('Iteration 4: Logout/login persistence', async ({ page, context }) => {
    console.log('\n=== ITERATION 4: LOGOUT/LOGIN PERSISTENCE ===');
    
    // First login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    let sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Sessions before logout: ${sessionCount}`);
    
    // Try to logout
    const logoutBtn = await page.locator('button[aria-label="Logout"]').or(
      page.locator('button').filter({ hasText: /logout/i })
    );
    
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForURL('**/login');
      console.log('Logged out successfully');
      
      // Login again
      await page.fill('input[name="username"]', 'test');
      await page.fill('input[name="password"]', 'test123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/sessions');
      await page.waitForTimeout(2000);
      
      sessionCount = await page.locator('div.MuiCard-root').count();
      console.log(`Sessions after re-login: ${sessionCount}`);
    } else {
      console.log('Logout button not found, clearing localStorage manually');
      await page.evaluate(() => localStorage.clear());
      await page.goto(clientUrl + '/login');
      await page.fill('input[name="username"]', 'test');
      await page.fill('input[name="password"]', 'test123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/sessions');
      await page.waitForTimeout(2000);
      
      sessionCount = await page.locator('div.MuiCard-root').count();
      console.log(`Sessions after manual re-login: ${sessionCount}`);
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/iter4-result.png', 
      fullPage: true 
    });
  });
  
  // Test 5: Multiple session creation
  test('Iteration 5: Multiple session creation and persistence', async ({ page, context }) => {
    console.log('\n=== ITERATION 5: MULTIPLE SESSION PERSISTENCE ===');
    
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    let sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Initial sessions: ${sessionCount}`);
    
    // Create multiple sessions
    for (let i = 1; i <= 2; i++) {
      const createBtn = await page.locator('button').filter({ hasText: /new session/i }).first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
        
        const dialog = await page.locator('[role="dialog"]').isVisible();
        if (dialog) {
          await page.fill('input[type="text"]', `Multi Session ${i}`);
          await page.click('button:has-text("Create")');
          await page.waitForTimeout(1000);
          
          // Navigate back to sessions
          await page.goto(clientUrl + '/sessions');
          await page.waitForTimeout(1500);
          
          sessionCount = await page.locator('div.MuiCard-root').count();
          console.log(`Sessions after creating session ${i}: ${sessionCount}`);
        }
      }
    }
    
    // Test final persistence
    for (let i = 1; i <= 3; i++) {
      await page.goto(clientUrl + '/sessions');
      await page.waitForTimeout(1000);
      const count = await page.locator('div.MuiCard-root').count();
      console.log(`Final test ${i}: ${count} sessions`);
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/iter5-result.png', 
      fullPage: true 
    });
  });
});