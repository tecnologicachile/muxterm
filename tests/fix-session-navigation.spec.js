const { test, expect } = require('@playwright/test');

test.describe('Fix Session Navigation', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Test session navigation with Open buttons', async ({ page, context }) => {
    console.log('\n=== FIX SESSION NAVIGATION ===');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    // Count sessions
    const sessionCards = await page.locator('div.MuiCard-root').all();
    console.log(`Found ${sessionCards.length} session cards`);
    
    if (sessionCards.length > 0) {
      // Look for Open buttons
      const openButtons = await page.locator('button:has-text("Open")').all();
      console.log(`Found ${openButtons.length} Open buttons`);
      
      if (openButtons.length > 0) {
        console.log('Clicking first Open button...');
        
        try {
          await openButtons[0].click();
          
          // Wait for navigation
          await page.waitForURL('**/terminal/**', { timeout: 10000 });
          
          const currentUrl = page.url();
          const sessionId = currentUrl.split('/terminal/')[1];
          console.log(`✅ Successfully navigated to terminal: ${sessionId}`);
          
          // Type a command to test functionality
          await page.waitForTimeout(2000);
          await page.keyboard.type('echo "Navigation test successful"');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1000);
          
          // Go back to sessions
          await page.goto(clientUrl + '/sessions');
          await page.waitForTimeout(2000);
          
          const finalSessionCount = await page.locator('div.MuiCard-root').count();
          console.log(`Sessions after navigation test: ${finalSessionCount}`);
          
        } catch (error) {
          console.log(`❌ Error with Open button: ${error.message}`);
          
          // Try direct click on card as fallback
          console.log('Trying direct card click as fallback...');
          await sessionCards[0].click();
          await page.waitForTimeout(2000);
          
          const fallbackUrl = page.url();
          console.log(`Fallback URL: ${fallbackUrl}`);
        }
      } else {
        console.log('No Open buttons found, trying card click...');
        await sessionCards[0].click();
        await page.waitForTimeout(2000);
        
        const directUrl = page.url();
        console.log(`Direct click URL: ${directUrl}`);
      }
    } else {
      console.log('No session cards found, creating one...');
      
      const createBtn = await page.locator('button:has-text("New Session")').first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
        
        const dialog = await page.locator('[role="dialog"]').isVisible();
        if (dialog) {
          await page.fill('input[type="text"]', 'Navigation Test Session');
          await page.click('button:has-text("Create")');
          await page.waitForTimeout(2000);
          
          // Check if it navigated to terminal
          const createUrl = page.url();
          console.log(`URL after creation: ${createUrl}`);
        }
      }
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/fix-session-navigation.png', 
      fullPage: true 
    });
  });
});