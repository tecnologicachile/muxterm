const { test, expect } = require('@playwright/test');

test.describe('Smart Cleanup Fix - Iterative', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteration 1: Fix and test SMART CLEANUP', async ({ page }) => {
    console.log('\n=== ITERATION 1: SMART CLEANUP FIX ===');
    
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
      await page.fill('input[type="text"]', 'SMART Cleanup Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute commands
      await page.keyboard.type('echo "test command"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute command in second panel
        await page.keyboard.type('echo "second panel"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        console.log('✅ Created split panels with commands');
        
        // Check prompts before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const promptCount = (terminalsBefore[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts before refresh: ${promptCount}`);
          totalPromptsBefore += promptCount;
        }
        
        console.log(`Total prompts before refresh: ${totalPromptsBefore}`);
        
        // Refresh page
        console.log('Refreshing page...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts after refresh: ${promptCount}`);
          totalPromptsAfter += promptCount;
          
          // Debug: show content
          console.log(`Terminal ${i + 1} content: "${terminalsAfter[i].substring(0, 150)}..."`);
        }
        
        console.log(`Total prompts after refresh: ${totalPromptsAfter}`);
        
        // Assessment
        if (totalPromptsAfter > totalPromptsBefore) {
          console.log(`❌ ITERATION 1 FAILED: Prompt duplication still occurs (${totalPromptsBefore} → ${totalPromptsAfter})`);
          console.log('   SMART CLEANUP is not working correctly');
          
          // Look for specific issues
          for (let i = 0; i < terminalsAfter.length; i++) {
            const content = terminalsAfter[i];
            if (content.includes('usuario@usuario-Standard-PC-i440FX-PIIX-usuario@usuario-Standard-PC-i440FX-PIIX-')) {
              console.log(`   Terminal ${i + 1} has consecutive prompts without commands`);
            }
          }
        } else {
          console.log(`✅ ITERATION 1 PASSED: No prompt duplication (${totalPromptsBefore} → ${totalPromptsAfter})`);
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/smart-cleanup-iter1.png', 
          fullPage: true 
        });
        
      } else {
        console.log('❌ Split button not found');
      }
    }
  });
  
  test('Iteration 2: Test multiple refresh cycles', async ({ page }) => {
    console.log('\n=== ITERATION 2: MULTIPLE REFRESH CYCLES ===');
    
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
      await page.fill('input[type="text"]', 'Multiple Refresh Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute commands
      await page.keyboard.type('echo "initial command"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute command in second panel
        await page.keyboard.type('pwd');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        console.log('✅ Created split panels with commands');
        
        // Test multiple refresh cycles
        for (let cycle = 1; cycle <= 3; cycle++) {
          console.log(`\n--- Refresh Cycle ${cycle} ---`);
          
          // Refresh page
          await page.reload();
          await page.waitForTimeout(3000);
          
          // Check prompts after refresh
          const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
          let totalPromptsAfter = 0;
          
          for (let i = 0; i < terminalsAfter.length; i++) {
            const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
            console.log(`Cycle ${cycle} - Terminal ${i + 1} prompts: ${promptCount}`);
            totalPromptsAfter += promptCount;
          }
          
          console.log(`Cycle ${cycle} - Total prompts: ${totalPromptsAfter}`);
          
          // Check for excessive prompts
          if (totalPromptsAfter > 4) {
            console.log(`⚠️  Cycle ${cycle}: Excessive prompts detected (${totalPromptsAfter})`);
          } else {
            console.log(`✅ Cycle ${cycle}: Prompt count acceptable (${totalPromptsAfter})`);
          }
          
          // Check for consecutive prompts pattern
          for (let i = 0; i < terminalsAfter.length; i++) {
            const content = terminalsAfter[i];
            if (content.includes('usuario@usuario-Standard-PC-i440FX-PIIX-usuario@usuario-Standard-PC-i440FX-PIIX-')) {
              console.log(`⚠️  Cycle ${cycle} - Terminal ${i + 1}: Consecutive prompts found`);
            }
          }
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/smart-cleanup-iter2.png', 
          fullPage: true 
        });
        
      } else {
        console.log('❌ Split button not found');
      }
    }
  });
  
  test('Iteration 3: Test extreme case - many commands', async ({ page }) => {
    console.log('\n=== ITERATION 3: EXTREME CASE - MANY COMMANDS ===');
    
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
      await page.fill('input[type="text"]', 'Extreme Test Session');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute many commands
      const commands = [
        'echo "command 1"',
        'ls',
        'echo "command 2"',
        'pwd',
        'echo "command 3"',
        'whoami',
        'echo "command 4"',
        'date',
        'echo "command 5"'
      ];
      
      for (const cmd of commands) {
        await page.keyboard.type(cmd);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
      }
      
      console.log('✅ Executed many commands');
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute commands in second panel
        for (let i = 0; i < 5; i++) {
          await page.keyboard.type(`echo "panel2 command ${i + 1}"`);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(300);
        }
        
        console.log('✅ Executed commands in both panels');
        
        // Check prompts before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const promptCount = (terminalsBefore[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts before refresh: ${promptCount}`);
          totalPromptsBefore += promptCount;
        }
        
        console.log(`Total prompts before refresh: ${totalPromptsBefore}`);
        
        // Refresh page
        console.log('Refreshing page with many commands...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts after refresh: ${promptCount}`);
          totalPromptsAfter += promptCount;
          
          // Check if command history is preserved
          const content = terminalsAfter[i];
          if (content.includes('command 1') || content.includes('panel2 command')) {
            console.log(`✅ Terminal ${i + 1} preserves command history`);
          } else {
            console.log(`⚠️  Terminal ${i + 1} may have lost command history`);
          }
        }
        
        console.log(`Total prompts after refresh: ${totalPromptsAfter}`);
        
        // Assessment for extreme case
        if (totalPromptsAfter > totalPromptsBefore * 1.5) {
          console.log(`❌ ITERATION 3 FAILED: Excessive prompt growth (${totalPromptsBefore} → ${totalPromptsAfter})`);
        } else {
          console.log(`✅ ITERATION 3 PASSED: Prompt growth controlled (${totalPromptsBefore} → ${totalPromptsAfter})`);
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/smart-cleanup-iter3.png', 
          fullPage: true 
        });
        
      } else {
        console.log('❌ Split button not found');
      }
    }
  });
});