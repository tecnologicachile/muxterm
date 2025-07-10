const { test, expect } = require('@playwright/test');

test.describe('Test Session Persistence', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Create session and verify it persists', async ({ page, context }) => {
    console.log('=== TESTING SESSION PERSISTENCE ===\n');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.waitForTimeout(1000);
    
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    console.log('✓ Logged in successfully');
    
    // Count existing sessions
    const initialSessions = await page.locator('div.MuiCard-root').count();
    console.log(`✓ Initial sessions count: ${initialSessions}`);
    
    // Create new session
    console.log('\nCreating new session...');
    await page.click('button:has-text("Create New Session")');
    await page.waitForTimeout(1000);
    
    // Wait for new session card to appear
    await page.waitForSelector(`div.MuiCard-root:nth-child(${initialSessions + 1})`);
    const newSessionsCount = await page.locator('div.MuiCard-root').count();
    console.log(`✓ Sessions after creation: ${newSessionsCount}`);
    
    // Get the session ID from the card
    const sessionCard = await page.locator('div.MuiCard-root').last();
    await sessionCard.click();
    
    await page.waitForURL('**/terminal/**');
    const url = page.url();
    const sessionId = url.split('/terminal/')[1];
    console.log(`✓ Created session ID: ${sessionId}`);
    
    // Type some commands
    await page.waitForTimeout(2000);
    await page.keyboard.type('echo "Test session persistence"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Go back to sessions page
    console.log('\nNavigating back to sessions page...');
    await page.goto(clientUrl + '/sessions');
    await page.waitForTimeout(2000);
    
    // Count sessions again
    const finalSessions = await page.locator('div.MuiCard-root').count();
    console.log(`✓ Sessions count after navigation: ${finalSessions}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/session-persistence.png', 
      fullPage: true 
    });
    
    // Verify the session still exists
    expect(finalSessions).toBeGreaterThanOrEqual(newSessionsCount);
    console.log('\n✅ SESSION PERSISTENCE TEST COMPLETE!');
    console.log(`Session ${sessionId} persists after navigation`);
  });
});