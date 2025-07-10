const { test, expect } = require('@playwright/test');

test.describe('Fix with Clear Command', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Test if clear command helps', async ({ page }) => {
    console.log('\n=== TESTING CLEAR COMMAND SOLUTION ===');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    // Create new session
    const createBtn = await page.locator('button:has-text("New Session")').first();
    await createBtn.click();
    
    const dialog = await page.locator('[role="dialog"]').isVisible();
    if (dialog) {
      await page.fill('input[type="text"]', 'Clear Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute ls
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Check initial problem
      const beforeClear = await page.locator('.xterm-rows').textContent();
      console.log('\nBEFORE CLEAR:');
      if (beforeClear.includes('Vídeosusuario@')) {
        console.log('❌ Has "Vídeosusuario@" problem');
      } else {
        console.log('✅ No problem');
      }
      
      // Try clear command
      await page.keyboard.type('clear');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Type ls again
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      const afterClear = await page.locator('.xterm-rows').textContent();
      console.log('\nAFTER CLEAR:');
      if (afterClear.includes('Vídeosusuario@')) {
        console.log('❌ Still has "Vídeosusuario@" problem');
      } else {
        console.log('✅ Fixed! No "Vídeosusuario@"');
      }
      
      // Now test with echo to add newline
      await page.keyboard.type('echo');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      const afterEcho = await page.locator('.xterm-rows').textContent();
      console.log('\nAFTER ECHO:');
      if (afterEcho.includes('Vídeosusuario@')) {
        console.log('❌ Still has problem after echo');
      } else {
        console.log('✅ Fixed with echo!');
      }
    }
  });
});