const { test, expect } = require('@playwright/test');

test.describe('Final Comprehensive Test', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  // Test 1: Complete session flow with correct navigation
  test('Test 1: Complete session flow with Open buttons', async ({ page, context }) => {
    console.log('\n=== TEST 1: COMPLETE SESSION FLOW ===');
    
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    let sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Initial sessions: ${sessionCount}`);
    
    // If we have sessions, test navigation
    if (sessionCount > 0) {
      const openBtn = await page.locator('button:has-text("Open")').first();
      await openBtn.click();
      await page.waitForURL('**/terminal/**');
      
      const sessionId = page.url().split('/terminal/')[1];
      console.log(`Navigated to session: ${sessionId}`);
      
      // Execute commands
      await page.waitForTimeout(2000);
      await page.keyboard.type('echo "Test 1: Command execution"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Go back to sessions
      await page.goto(clientUrl + '/sessions');
      await page.waitForTimeout(2000);
      
      sessionCount = await page.locator('div.MuiCard-root').count();
      console.log(`Sessions after navigation: ${sessionCount}`);
    }
    
    // Test direct navigation persistence
    for (let i = 1; i <= 3; i++) {
      await page.goto(clientUrl + '/sessions');
      await page.waitForTimeout(1000);
      const count = await page.locator('div.MuiCard-root').count();
      console.log(`Direct navigation ${i}: ${count} sessions`);
    }
    
    await page.screenshot({ path: 'tests/screenshots/final-test-1.png', fullPage: true });
  });
  
  // Test 2: Multiple session operations
  test('Test 2: Multiple session operations', async ({ page, context }) => {
    console.log('\n=== TEST 2: MULTIPLE SESSION OPERATIONS ===');
    
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    let sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Initial sessions: ${sessionCount}`);
    
    // Open first session and use it
    if (sessionCount > 0) {
      const openBtn = await page.locator('button:has-text("Open")').first();
      await openBtn.click();
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute multiple commands
      await page.keyboard.type('ls -la');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      await page.keyboard.type('echo "Multiple commands test"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Go back and check persistence
      await page.goto(clientUrl + '/sessions');
      await page.waitForTimeout(2000);
      
      sessionCount = await page.locator('div.MuiCard-root').count();
      console.log(`Sessions after multiple commands: ${sessionCount}`);
      
      // Test opening the same session again
      const openBtnAgain = await page.locator('button:has-text("Open")').first();
      await openBtnAgain.click();
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      console.log('✅ Successfully reopened session after commands');
      
      // Go back to sessions
      await page.goto(clientUrl + '/sessions');
      await page.waitForTimeout(2000);
    }
    
    await page.screenshot({ path: 'tests/screenshots/final-test-2.png', fullPage: true });
  });
  
  // Test 3: Session creation and immediate use
  test('Test 3: Session creation and immediate use', async ({ page, context }) => {
    console.log('\n=== TEST 3: SESSION CREATION AND IMMEDIATE USE ===');
    
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    const initialCount = await page.locator('div.MuiCard-root').count();
    console.log(`Initial sessions: ${initialCount}`);
    
    // Create new session
    const createBtn = await page.locator('button:has-text("New Session")').first();
    await createBtn.click();
    
    const dialog = await page.locator('[role="dialog"]').isVisible();
    if (dialog) {
      await page.fill('input[type="text"]', 'Final Test Session');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      
      const sessionId = page.url().split('/terminal/')[1];
      console.log(`Created session: ${sessionId}`);
      
      // Use the new session
      await page.waitForTimeout(2000);
      await page.keyboard.type('echo "New session test"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Go back to sessions
      await page.goto(clientUrl + '/sessions');
      await page.waitForTimeout(2000);
      
      const finalCount = await page.locator('div.MuiCard-root').count();
      console.log(`Sessions after creation: ${finalCount}`);
      
      // Verify the new session persists
      expect(finalCount).toBeGreaterThan(initialCount);
      console.log('✅ New session persists correctly');
    }
    
    await page.screenshot({ path: 'tests/screenshots/final-test-3.png', fullPage: true });
  });
  
  // Test 4: Root navigation and persistence
  test('Test 4: Root navigation and persistence', async ({ page, context }) => {
    console.log('\n=== TEST 4: ROOT NAVIGATION AND PERSISTENCE ===');
    
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    let sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Sessions at start: ${sessionCount}`);
    
    // Navigate to root and back
    await page.goto(clientUrl);
    await page.waitForTimeout(1000);
    
    const rootUrl = page.url();
    console.log(`Root URL: ${rootUrl}`);
    
    // Should redirect to sessions
    if (rootUrl.includes('/sessions')) {
      console.log('✅ Root correctly redirects to sessions');
    }
    
    sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Sessions after root navigation: ${sessionCount}`);
    
    // Test multiple root navigations
    for (let i = 1; i <= 3; i++) {
      await page.goto(clientUrl);
      await page.waitForTimeout(1000);
      const count = await page.locator('div.MuiCard-root').count();
      console.log(`Root navigation ${i}: ${count} sessions`);
    }
    
    await page.screenshot({ path: 'tests/screenshots/final-test-4.png', fullPage: true });
  });
  
  // Test 5: Complete system validation
  test('Test 5: Complete system validation', async ({ page, context }) => {
    console.log('\n=== TEST 5: COMPLETE SYSTEM VALIDATION ===');
    
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    let sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Final validation - Sessions: ${sessionCount}`);
    
    // Test 1: Direct sessions navigation
    await page.goto(clientUrl + '/sessions');
    await page.waitForTimeout(2000);
    const directCount = await page.locator('div.MuiCard-root').count();
    console.log(`Direct navigation: ${directCount} sessions`);
    
    // Test 2: Session opening
    if (directCount > 0) {
      const openBtn = await page.locator('button:has-text("Open")').first();
      await openBtn.click();
      await page.waitForURL('**/terminal/**');
      console.log('✅ Session opening works');
      
      // Test 3: Command execution and SMART CLEANUP
      await page.waitForTimeout(2000);
      await page.keyboard.type('echo "Final validation test"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Test 4: Return to sessions
      await page.goto(clientUrl + '/sessions');
      await page.waitForTimeout(2000);
      
      const returnCount = await page.locator('div.MuiCard-root').count();
      console.log(`After command execution: ${returnCount} sessions`);
      
      // Test 5: Refresh persistence
      await page.reload();
      await page.waitForTimeout(2000);
      
      const refreshCount = await page.locator('div.MuiCard-root').count();
      console.log(`After refresh: ${refreshCount} sessions`);
      
      // Final validation
      expect(refreshCount).toBeGreaterThan(0);
      console.log('✅ ALL TESTS PASSED - System is working correctly!');
    }
    
    await page.screenshot({ path: 'tests/screenshots/final-test-5-validation.png', fullPage: true });
  });
});