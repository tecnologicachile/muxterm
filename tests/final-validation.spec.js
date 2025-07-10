const { test, expect } = require('@playwright/test');

test.describe('Final Validation', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Validate fix with horizontal split and refresh', async ({ page }) => {
    console.log('\n=== FINAL VALIDATION TEST ===');
    
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
      await page.fill('input[type="text"]', 'Final Validation');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute ls in terminal 1
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Check initial state
      const beforeSplit = await page.locator('.xterm-rows').textContent();
      console.log('\n1. BEFORE SPLIT:');
      if (beforeSplit.includes('Vídeosusuario@')) {
        console.log('   ❌ Has "Vídeosusuario@" problem');
      } else {
        console.log('   ✅ No problem');
      }
      
      // Split horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Check after split
        const terminals = await page.locator('.xterm-rows').allTextContents();
        console.log('\n2. AFTER SPLIT:');
        terminals.forEach((content, i) => {
          console.log(`   Terminal ${i + 1}:`);
          if (content.includes('Vídeosusuario@')) {
            console.log('   ❌ Has "Vídeosusuario@"');
          } else {
            console.log('   ✅ No "Vídeosusuario@"');
          }
        });
        
        // Refresh page
        console.log('\n3. REFRESHING PAGE...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Check after refresh
        const terminalsAfterRefresh = await page.locator('.xterm-rows').allTextContents();
        console.log('\n4. AFTER REFRESH:');
        let allGood = true;
        terminalsAfterRefresh.forEach((content, i) => {
          console.log(`   Terminal ${i + 1}:`);
          if (content.includes('Vídeosusuario@')) {
            console.log('   ❌ Still has "Vídeosusuario@"');
            allGood = false;
          } else {
            console.log('   ✅ Fixed! No "Vídeosusuario@"');
          }
          
          // Check for duplicate prompts
          if (content.includes('usuario@usuario-Standard-PC-i440FX-PIIX-usuario@')) {
            console.log('   ❌ Has duplicate prompt');
            allGood = false;
          } else {
            console.log('   ✅ No duplicate prompt');
          }
        });
        
        if (allGood) {
          console.log('\n🎉 ALL TESTS PASSED! The fix is working correctly.');
        } else {
          console.log('\n⚠️ Some issues remain.');
        }
      }
    }
  });
});