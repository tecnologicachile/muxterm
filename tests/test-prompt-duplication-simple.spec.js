const { test, expect } = require('@playwright/test');

test.describe('Simple Prompt Duplication Test', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Test prompt duplication after refresh - simple approach', async ({ page }) => {
    console.log('\n=== SIMPLE PROMPT DUPLICATION TEST ===');
    
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
      await page.fill('input[type="text"]', 'Prompt Test Session');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute a command
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split the panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute command in second panel
        await page.keyboard.type('ls');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        console.log('✅ Created split panels with commands');
        
        // Get all terminal content before refresh
        const allTerminalsBefore = await page.locator('.xterm-screen').allTextContents();
        console.log(`Found ${allTerminalsBefore.length} terminals before refresh`);
        
        // Count prompts in each terminal before refresh
        let totalPromptsBefore = 0;
        for (let i = 0; i < allTerminalsBefore.length; i++) {
          const promptCount = (allTerminalsBefore[i].match(/usuario@usuario-Standard-PC-\d+FX-PIIX-\d+:~\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts before refresh: ${promptCount}`);
          totalPromptsBefore += promptCount;
        }
        console.log(`Total prompts before refresh: ${totalPromptsBefore}`);
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/simple-before-refresh.png', 
          fullPage: true 
        });
        
        // Refresh the page
        console.log('Refreshing page...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Get all terminal content after refresh
        const allTerminalsAfter = await page.locator('.xterm-screen').allTextContents();
        console.log(`Found ${allTerminalsAfter.length} terminals after refresh`);
        
        // Count prompts in each terminal after refresh
        let totalPromptsAfter = 0;
        for (let i = 0; i < allTerminalsAfter.length; i++) {
          const promptCount = (allTerminalsAfter[i].match(/usuario@usuario-Standard-PC-\d+FX-PIIX-\d+:~\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts after refresh: ${promptCount}`);
          totalPromptsAfter += promptCount;
          
          // Show first 200 characters of each terminal for debugging
          console.log(`Terminal ${i + 1} content: ${allTerminalsAfter[i].substring(0, 200).replace(/\n/g, '\\n')}...`);
        }
        console.log(`Total prompts after refresh: ${totalPromptsAfter}`);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/simple-after-refresh.png', 
          fullPage: true 
        });
        
        // Analyze results
        const promptIncrease = totalPromptsAfter - totalPromptsBefore;
        
        if (promptIncrease > 0) {
          console.log(`❌ PROMPT DUPLICATION DETECTED: ${promptIncrease} extra prompts after refresh`);
          console.log(`   Before: ${totalPromptsBefore} prompts, After: ${totalPromptsAfter} prompts`);
          
          // Check if any terminal has excessive prompts
          for (let i = 0; i < allTerminalsAfter.length; i++) {
            const promptCount = (allTerminalsAfter[i].match(/usuario@usuario-Standard-PC-\d+FX-PIIX-\d+:~\$/g) || []).length;
            if (promptCount > 3) {
              console.log(`⚠️  Terminal ${i + 1} has excessive prompts: ${promptCount}`);
            }
          }
          
        } else if (promptIncrease < 0) {
          console.log(`⚠️  PROMPT LOSS: ${Math.abs(promptIncrease)} prompts lost after refresh`);
        } else {
          console.log('✅ No prompt duplication detected');
        }
        
        // Check for specific duplication patterns
        for (let i = 0; i < allTerminalsAfter.length; i++) {
          const content = allTerminalsAfter[i];
          if (content.includes('usuario@usuario-Standard-PC-1440FX-PIIX-1996:~$usuario@usuario-Standard-PC-1440FX-PIIX-1996:~$')) {
            console.log(`⚠️  Terminal ${i + 1} has consecutive prompts without commands`);
          }
        }
        
      } else {
        console.log('❌ Split button not found, testing with single terminal');
        
        // Test single terminal
        const terminalBefore = await page.locator('.xterm-screen').textContent();
        const promptsBefore = (terminalBefore.match(/usuario@usuario-Standard-PC-\d+FX-PIIX-\d+:~\$/g) || []).length;
        console.log(`Single terminal prompts before refresh: ${promptsBefore}`);
        
        await page.reload();
        await page.waitForTimeout(3000);
        
        const terminalAfter = await page.locator('.xterm-screen').textContent();
        const promptsAfter = (terminalAfter.match(/usuario@usuario-Standard-PC-\d+FX-PIIX-\d+:~\$/g) || []).length;
        console.log(`Single terminal prompts after refresh: ${promptsAfter}`);
        
        if (promptsAfter > promptsBefore) {
          console.log(`❌ Single terminal duplication: ${promptsBefore} → ${promptsAfter}`);
        } else {
          console.log(`✅ Single terminal clean: ${promptsBefore} → ${promptsAfter}`);
        }
      }
    }
  });
});