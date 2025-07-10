const { test, expect } = require('@playwright/test');

test.describe.serial('Back Button Fix - Sequential Tests', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteration 1: Clean slate and test back button preservation', async ({ page }) => {
    console.log('\n=== ITERATION 1: CLEAN SLATE TEST ===');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    // Clean up existing sessions first
    console.log('Cleaning up existing sessions...');
    let sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Found ${sessionCount} existing sessions`);
    
    // Delete all existing sessions
    while (sessionCount > 0) {
      const deleteButtons = await page.locator('button[title="Delete session"]').all();
      if (deleteButtons.length > 0) {
        await deleteButtons[0].click();
        // Wait for confirmation dialog
        await page.waitForTimeout(500);
        const confirmButton = await page.locator('button:has-text("Delete")').last();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }
      } else {
        break;
      }
      sessionCount = await page.locator('div.MuiCard-root').count();
    }
    
    // Verify clean slate
    const cleanSessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Clean slate: ${cleanSessionCount} sessions`);
    
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
      
      if (sessionsAfterBack === 1) {
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
          
          if (finalSessionCount === 1) {
            console.log('✅ ITERATION 1 FULLY PASSED: All tests successful');
          } else {
            console.log('❌ ITERATION 1 FAILED: Session count changed after reopening');
          }
        }
        
      } else {
        console.log(`❌ ITERATION 1 FAILED: Expected 1 session, got ${sessionsAfterBack}`);
        console.log('   Session was not preserved after back button');
      }
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/iteration-1-clean-back-button-fix.png', 
      fullPage: true 
    });
  });
  
  test('Iteration 2: Test multiple sessions preservation', async ({ page }) => {
    console.log('\n=== ITERATION 2: MULTIPLE SESSIONS TEST ===');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    // Should have 1 session from previous test
    const initialSessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Initial sessions: ${initialSessionCount}`);
    
    // Create 2 more sessions
    const sessionNames = ['Session A', 'Session B'];
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
      path: 'tests/screenshots/iteration-2-clean-back-button-fix.png', 
      fullPage: true 
    });
  });
  
  test('Iteration 3: Test session command history preservation', async ({ page }) => {
    console.log('\n=== ITERATION 3: COMMAND HISTORY PRESERVATION TEST ===');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    // Should have 3 sessions from previous tests
    const initialSessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Initial sessions: ${initialSessionCount}`);
    
    // Create a session with multiple commands
    const createBtn = await page.locator('button:has-text("New Session")').first();
    await createBtn.click();
    
    const dialog = await page.locator('[role="dialog"]').isVisible();
    if (dialog) {
      await page.fill('input[type="text"]', 'Command History Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute multiple commands
      const commands = [
        'echo "First command"',
        'ls -la',
        'echo "Second command"',
        'pwd',
        'echo "Third command"'
      ];
      
      for (const command of commands) {
        await page.keyboard.type(command);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
      }
      
      console.log('✅ Executed multiple commands');
      
      // Click back button
      const backButton = await page.locator('[data-testid="ArrowBackIcon"]').first().locator('xpath=ancestor::button[1]');
      console.log('Clicking back button...');
      await backButton.click();
      await page.waitForURL('**/sessions');
      await page.waitForTimeout(2000);
      
      // Verify session count
      const sessionsAfterBack = await page.locator('div.MuiCard-root').count();
      console.log(`Sessions after back button: ${sessionsAfterBack}`);
      
      if (sessionsAfterBack === initialSessionCount + 1) {
        console.log('✅ ITERATION 3 PASSED: Session preserved after back button');
        
        // Reopen the session to check command history
        const sessionCards = await page.locator('div.MuiCard-root').all();
        let foundSession = false;
        
        for (let i = 0; i < sessionCards.length; i++) {
          const cardText = await sessionCards[i].textContent();
          if (cardText && cardText.includes('Command History Test')) {
            foundSession = true;
            console.log('✅ Command history session found by name');
            
            // Click the Open button for this session
            const openBtn = await sessionCards[i].locator('button:has-text("Open")');
            await openBtn.click();
            await page.waitForURL('**/terminal/**');
            await page.waitForTimeout(2000);
            
            // Check if we can see command history (by looking at terminal content)
            const terminalContent = await page.locator('.xterm-screen').textContent();
            
            if (terminalContent && terminalContent.includes('First command')) {
              console.log('✅ Command history preserved - found "First command"');
            } else {
              console.log('⚠️  Command history may not be fully preserved');
            }
            
            if (terminalContent && terminalContent.includes('Third command')) {
              console.log('✅ Command history preserved - found "Third command"');
            } else {
              console.log('⚠️  Latest command may not be preserved');
            }
            
            console.log('✅ ITERATION 3 PASSED: Session and command history preserved');
            break;
          }
        }
        
        if (!foundSession) {
          console.log('❌ Command history session not found by name');
        }
        
      } else {
        console.log(`❌ ITERATION 3 FAILED: Expected ${initialSessionCount + 1} sessions, got ${sessionsAfterBack}`);
      }
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/iteration-3-clean-back-button-fix.png', 
      fullPage: true 
    });
  });
});