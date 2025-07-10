const { test, expect } = require('@playwright/test');

test.describe('Simple Fix Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Simple test to verify fix', async ({ page }) => {
    console.log('\n=== SIMPLE FIX TEST ===');
    
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
      await page.fill('input[type="text"]', 'Simple Fix Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute ls
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Get initial content
      const initialContent = await page.locator('.xterm-rows').textContent();
      console.log('\nINITIAL CONTENT:');
      console.log(initialContent);
      
      // Check for problem BEFORE split
      if (initialContent.includes('Vídeosusuario@')) {
        console.log('❌ PROBLEM EXISTS BEFORE SPLIT!');
      } else {
        console.log('✅ No problem before split');
      }
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Refresh
        console.log('\n🔄 REFRESHING...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Check after refresh
        const terminals = await page.locator('.xterm-rows').allTextContents();
        
        console.log('\nAFTER REFRESH:');
        terminals.forEach((content, i) => {
          console.log(`\nTerminal ${i + 1}:`);
          if (content.includes('Vídeosusuario@')) {
            console.log('❌ Still has "Vídeosusuario@"');
            
            // Find exact position
            const idx = content.indexOf('Vídeosusuario@');
            const snippet = content.substring(Math.max(0, idx - 20), Math.min(content.length, idx + 30));
            console.log(`Context: ...${snippet}...`);
          } else {
            console.log('✅ Fixed! No "Vídeosusuario@"');
          }
          
          // Check for duplicate prompt
          if (content.includes('usuario@usuario-Standard-PC-i440FX-PIIX-usuario@')) {
            console.log('❌ Has duplicate prompt');
          } else {
            console.log('✅ No duplicate prompt');
          }
        });
      }
    }
  });
});