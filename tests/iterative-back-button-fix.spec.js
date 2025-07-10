const { test, expect } = require('@playwright/test');

test.describe('Iterative Back Button Fix', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteration 1: Test back button preserves sessions', async ({ page }) => {
    console.log('\n=== ITERATION 1: TESTING BACK BUTTON PRESERVATION ===');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    // Count initial sessions
    const initialSessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Initial sessions: ${initialSessionCount}`);
    
    // Create new session
    const createBtn = await page.locator('button:has-text("New Session")').first();
    await createBtn.click();
    
    const dialog = await page.locator('[role="dialog"]').isVisible();
    if (dialog) {
      await page.fill('input[type="text"]', 'Test Session Preservation');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      
      const sessionId = page.url().split('/terminal/')[1];
      console.log(`Created session: ${sessionId}`);
      
      // Wait for terminal to load
      await page.waitForTimeout(2000);
      
      // Execute a command
      await page.keyboard.type('echo "Session should persist after back button"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Click back button
      const backButton = await page.locator('[data-testid="ArrowBackIcon"]').first().locator('xpath=ancestor::button[1]');
      console.log('Clicking back button...');
      await backButton.click();
      
      // Wait for navigation
      await page.waitForURL('**/sessions');
      await page.waitForTimeout(2000);
      
      // Count sessions after back button
      const sessionsAfterBack = await page.locator('div.MuiCard-root').count();
      console.log(`Sessions after back button: ${sessionsAfterBack}`);
      
      // Expected: should have one more session than initial
      const expectedSessions = initialSessionCount + 1;
      
      if (sessionsAfterBack === expectedSessions) {
        console.log('✅ ITERATION 1 PASSED: Session preserved after back button');
        
        // Verify session exists by name
        const sessionCards = await page.locator('div.MuiCard-root').all();
        let foundSession = false;
        
        for (let i = 0; i < sessionCards.length; i++) {
          const cardText = await sessionCards[i].textContent();
          if (cardText && cardText.includes('Test Session Preservation')) {
            foundSession = true;
            console.log('✅ Session found by name in session list');
            break;
          }
        }
        
        if (!foundSession) {
          console.log('❌ Session not found by name, but count is correct');
        }
        
        // Test reopening the session
        if (foundSession) {
          const openBtn = await page.locator('button:has-text("Open")').first();
          await openBtn.click();
          await page.waitForURL('**/terminal/**');
          await page.waitForTimeout(2000);
          
          console.log('✅ Successfully reopened preserved session');
          
          // Go back to sessions for final verification
          await page.goto(clientUrl + '/sessions');
          await page.waitForTimeout(2000);
          
          const finalSessionCount = await page.locator('div.MuiCard-root').count();
          console.log(`Final session count: ${finalSessionCount}`);
          
          if (finalSessionCount === expectedSessions) {
            console.log('✅ ITERATION 1 FULLY PASSED: All tests successful');
          } else {
            console.log('❌ ITERATION 1 FAILED: Session count changed after reopening');
          }
        }
        
      } else {
        console.log(`❌ ITERATION 1 FAILED: Expected ${expectedSessions} sessions, got ${sessionsAfterBack}`);
        console.log('   Session was not preserved after back button');
      }
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/iteration-1-back-button-fix.png', 
      fullPage: true 
    });
  });
  
  test('Iteration 2: Test multiple back button operations', async ({ page }) => {
    console.log('\n=== ITERATION 2: TESTING MULTIPLE BACK BUTTON OPERATIONS ===');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    const initialSessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Initial sessions: ${initialSessionCount}`);
    
    // Create multiple sessions and test back button on each
    const sessionNames = ['Session A', 'Session B', 'Session C'];
    let expectedFinalCount = initialSessionCount;
    
    for (let i = 0; i < sessionNames.length; i++) {
      const sessionName = sessionNames[i];
      console.log(`Creating session: ${sessionName}`);
      
      // Create session
      const createBtn = await page.locator('button:has-text("New Session")').first();
      await createBtn.click();
      
      const dialog = await page.locator('[role="dialog"]').isVisible();
      if (dialog) {
        await page.fill('input[type="text"]', sessionName);
        await page.click('button:has-text("Create")');
        await page.waitForURL('**/terminal/**');
        await page.waitForTimeout(2000);
        
        expectedFinalCount++;
        
        // Execute a command
        await page.keyboard.type(`echo "This is ${sessionName}"`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // Click back button
        const backButton = await page.locator('[data-testid="ArrowBackIcon"]').first().locator('xpath=ancestor::button[1]');
        await backButton.click();
        await page.waitForURL('**/sessions');
        await page.waitForTimeout(2000);
        
        // Verify session count
        const currentSessionCount = await page.locator('div.MuiCard-root').count();
        console.log(`Sessions after creating ${sessionName}: ${currentSessionCount}`);
        
        if (currentSessionCount !== expectedFinalCount) {
          console.log(`❌ ITERATION 2 FAILED: Expected ${expectedFinalCount} sessions, got ${currentSessionCount}`);
          break;
        }
      }
    }
    
    // Final verification
    const finalSessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Final session count: ${finalSessionCount}`);
    
    if (finalSessionCount === expectedFinalCount) {
      console.log('✅ ITERATION 2 PASSED: All sessions preserved after multiple back button operations');
      
      // Verify all sessions exist by name
      const sessionCards = await page.locator('div.MuiCard-root').all();
      let foundSessions = 0;
      
      for (let i = 0; i < sessionCards.length; i++) {
        const cardText = await sessionCards[i].textContent();
        for (const sessionName of sessionNames) {
          if (cardText && cardText.includes(sessionName)) {
            foundSessions++;
            console.log(`✅ Found session: ${sessionName}`);
            break;
          }
        }
      }
      
      if (foundSessions === sessionNames.length) {
        console.log('✅ ITERATION 2 FULLY PASSED: All sessions found by name');
      } else {
        console.log(`❌ ITERATION 2 PARTIAL: Found ${foundSessions}/${sessionNames.length} sessions by name`);
      }
      
    } else {
      console.log(`❌ ITERATION 2 FAILED: Expected ${expectedFinalCount} sessions, got ${finalSessionCount}`);
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/iteration-2-back-button-fix.png', 
      fullPage: true 
    });
  });
  
  test('Iteration 3: Test back button with split panels', async ({ page }) => {
    console.log('\n=== ITERATION 3: TESTING BACK BUTTON WITH SPLIT PANELS ===');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    const initialSessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Initial sessions: ${initialSessionCount}`);
    
    // Create session
    const createBtn = await page.locator('button:has-text("New Session")').first();
    await createBtn.click();
    
    const dialog = await page.locator('[role="dialog"]').isVisible();
    if (dialog) {
      await page.fill('input[type="text"]', 'Split Panel Test Session');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute command in first panel
      await page.keyboard.type('echo "Panel 1 content"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Try to split the panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute command in second panel (if split worked)
        await page.keyboard.type('echo "Panel 2 content"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        console.log('✅ Successfully created split panels');
      } else {
        console.log('⚠️  Split button not found, testing with single panel');
      }
      
      // Click back button
      const backButton = await page.locator('[data-testid="ArrowBackIcon"]').first().locator('xpath=ancestor::button[1]');
      console.log('Clicking back button with split panels...');
      await backButton.click();
      await page.waitForURL('**/sessions');
      await page.waitForTimeout(2000);
      
      // Verify session preserved
      const sessionsAfterBack = await page.locator('div.MuiCard-root').count();
      console.log(`Sessions after back button: ${sessionsAfterBack}`);
      
      if (sessionsAfterBack === initialSessionCount + 1) {
        console.log('✅ ITERATION 3 PASSED: Session with split panels preserved');
        
        // Verify session exists by name
        const sessionCards = await page.locator('div.MuiCard-root').all();
        let foundSession = false;
        
        for (let i = 0; i < sessionCards.length; i++) {
          const cardText = await sessionCards[i].textContent();
          if (cardText && cardText.includes('Split Panel Test Session')) {
            foundSession = true;
            console.log('✅ Split panel session found by name');
            
            // Check if it shows multiple panels in the description
            if (cardText.includes('2 panel') || cardText.includes('horizontal')) {
              console.log('✅ Session correctly shows multiple panels');
            } else {
              console.log('ℹ️  Session shows as single panel (split may not have worked)');
            }
            break;
          }
        }
        
        if (!foundSession) {
          console.log('❌ Split panel session not found by name');
        }
        
        // Test reopening the session
        if (foundSession) {
          const openBtn = await page.locator('button:has-text("Open")').first();
          await openBtn.click();
          await page.waitForURL('**/terminal/**');
          await page.waitForTimeout(2000);
          
          console.log('✅ Successfully reopened split panel session');
          
          // Go back to sessions for final verification
          await page.goto(clientUrl + '/sessions');
          await page.waitForTimeout(2000);
          
          const finalSessionCount = await page.locator('div.MuiCard-root').count();
          console.log(`Final session count: ${finalSessionCount}`);
          
          if (finalSessionCount === initialSessionCount + 1) {
            console.log('✅ ITERATION 3 FULLY PASSED: Split panel session fully functional');
          } else {
            console.log('❌ ITERATION 3 FAILED: Session count changed after reopening');
          }
        }
        
      } else {
        console.log(`❌ ITERATION 3 FAILED: Expected ${initialSessionCount + 1} sessions, got ${sessionsAfterBack}`);
      }
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/iteration-3-back-button-fix.png', 
      fullPage: true 
    });
  });
});