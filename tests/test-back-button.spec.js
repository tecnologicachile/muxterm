const { test, expect } = require('@playwright/test');

test.describe('Test Back Button Functionality', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Test back button behavior and session persistence', async ({ page }) => {
    console.log('\n=== TESTING BACK BUTTON FUNCTIONALITY ===');
    
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
    
    // Create new session to test with
    const createBtn = await page.locator('button:has-text("New Session")').first();
    await createBtn.click();
    
    const dialog = await page.locator('[role="dialog"]').isVisible();
    if (dialog) {
      await page.fill('input[type="text"]', 'Test Back Button Session');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      
      const sessionId = page.url().split('/terminal/')[1];
      console.log(`Created session: ${sessionId}`);
      
      // Wait for terminal to load
      await page.waitForTimeout(2000);
      
      // Execute a command to make sure session is active
      await page.keyboard.type('echo "Testing back button"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Look for the back button (first button in toolbar with ArrowBack icon)
      const backButton = await page.locator('button[aria-label=""]').first();
      const backButtonWithIcon = await page.locator('button:has([data-testid="ArrowBackIcon"])').first();
      
      console.log('Looking for back button...');
      
      // Try to find the back button by its position and icon
      let foundBackButton = null;
      
      // Method 1: Look for button with ArrowBack icon
      const arrowBackButtons = await page.locator('[data-testid="ArrowBackIcon"]').count();
      console.log(`Found ${arrowBackButtons} ArrowBack icons`);
      
      if (arrowBackButtons > 0) {
        foundBackButton = await page.locator('[data-testid="ArrowBackIcon"]').first().locator('xpath=ancestor::button[1]');
        console.log('Found back button via ArrowBack icon');
      } else {
        // Method 2: Look for first button in toolbar
        const toolbarButtons = await page.locator('header .MuiToolbar-root button').all();
        console.log(`Found ${toolbarButtons.length} buttons in toolbar`);
        
        if (toolbarButtons.length > 0) {
          foundBackButton = toolbarButtons[0];
          console.log('Using first button in toolbar as back button');
        }
      }
      
      if (foundBackButton) {
        console.log('Clicking back button...');
        await foundBackButton.click();
        
        // Wait for navigation back to sessions
        await page.waitForURL('**/sessions');
        await page.waitForTimeout(2000);
        
        // Count sessions after using back button
        const sessionsAfterBack = await page.locator('div.MuiCard-root').count();
        console.log(`Sessions after back button: ${sessionsAfterBack}`);
        
        // Check if the session disappeared
        if (sessionsAfterBack < initialSessionCount + 1) {
          console.log('⚠️  Session disappeared after using back button!');
          
          // Try to find the session by name
          const sessionCards = await page.locator('div.MuiCard-root').all();
          let foundTestSession = false;
          
          for (let i = 0; i < sessionCards.length; i++) {
            const cardText = await sessionCards[i].textContent();
            if (cardText && cardText.includes('Test Back Button Session')) {
              foundTestSession = true;
              break;
            }
          }
          
          if (!foundTestSession) {
            console.log('❌ Test session "Test Back Button Session" not found in session list');
          } else {
            console.log('✅ Test session found in session list');
          }
        } else {
          console.log('✅ Session count maintained after back button');
        }
        
        // Test direct navigation persistence
        console.log('\nTesting direct navigation persistence...');
        await page.goto(clientUrl + '/sessions');
        await page.waitForTimeout(2000);
        
        const directNavSessions = await page.locator('div.MuiCard-root').count();
        console.log(`Sessions after direct navigation: ${directNavSessions}`);
        
        // Compare results
        if (directNavSessions !== sessionsAfterBack) {
          console.log('⚠️  Session count differs between back button and direct navigation!');
        } else {
          console.log('✅ Session count consistent between back button and direct navigation');
        }
        
      } else {
        console.log('❌ Could not find back button');
      }
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/back-button-test.png', 
      fullPage: true 
    });
  });
});