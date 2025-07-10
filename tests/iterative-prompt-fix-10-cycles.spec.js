const { test, expect } = require('@playwright/test');

test.describe('Iterative Prompt Fix - 10 Cycles', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Cycle 1: Identify and fix prompt duplication', async ({ page }) => {
    console.log('\n=== CYCLE 1: IDENTIFY AND FIX PROMPT DUPLICATION ===');
    
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
      await page.fill('input[type="text"]', 'Cycle 1 Fix Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute command
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        console.log('✅ Created split panels');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/cycle1-before-refresh.png', 
          fullPage: true 
        });
        
        // Check prompts before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        let leftPanelPromptsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const promptCount = (terminalsBefore[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts before refresh: ${promptCount}`);
          totalPromptsBefore += promptCount;
          
          if (i === 0) leftPanelPromptsBefore = promptCount;
        }
        
        console.log(`Total prompts before refresh: ${totalPromptsBefore}`);
        console.log(`Left panel prompts before: ${leftPanelPromptsBefore}`);
        
        // Refresh page
        console.log('Refreshing page...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/cycle1-after-refresh.png', 
          fullPage: true 
        });
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        let leftPanelPromptsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts after refresh: ${promptCount}`);
          totalPromptsAfter += promptCount;
          
          if (i === 0) {
            leftPanelPromptsAfter = promptCount;
            console.log(`Left panel content: "${terminalsAfter[i].substring(0, 200)}..."`);
          }
        }
        
        console.log(`Total prompts after refresh: ${totalPromptsAfter}`);
        console.log(`Left panel prompts after: ${leftPanelPromptsAfter}`);
        
        // Assessment
        const promptIncrease = totalPromptsAfter - totalPromptsBefore;
        const leftPanelIncrease = leftPanelPromptsAfter - leftPanelPromptsBefore;
        
        if (promptIncrease > 0) {
          console.log(`❌ CYCLE 1 FAILED: Prompt duplication detected (+${promptIncrease} prompts)`);
          console.log(`   Left panel increase: +${leftPanelIncrease} prompts`);
          console.log('   🔧 Need to improve SMART CLEANUP algorithm');
        } else {
          console.log(`✅ CYCLE 1 PASSED: No prompt duplication detected`);
        }
        
        // Check for specific duplication patterns
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          const consecutivePrompts = content.match(/usuario@[^$]*\$\s*usuario@[^$]*\$/g);
          if (consecutivePrompts && consecutivePrompts.length > 0) {
            console.log(`⚠️  Terminal ${i + 1} has ${consecutivePrompts.length} consecutive prompt patterns`);
          }
        }
        
      } else {
        console.log('❌ Split button not found');
      }
    }
  });
  
  test('Cycle 2: Test radical cleanup effectiveness', async ({ page }) => {
    console.log('\n=== CYCLE 2: TEST RADICAL CLEANUP EFFECTIVENESS ===');
    
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
      await page.fill('input[type="text"]', 'Cycle 2 Radical Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute multiple commands
      await page.keyboard.type('echo "command 1"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      await page.keyboard.type('echo "command 2"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute command in second panel
        await page.keyboard.type('pwd');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        console.log('✅ Created split panels with multiple commands');
        
        // Check prompts before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const promptCount = (terminalsBefore[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts before refresh: ${promptCount}`);
          totalPromptsBefore += promptCount;
        }
        
        console.log(`Total prompts before refresh: ${totalPromptsBefore}`);
        
        // Refresh page multiple times to test stability
        for (let refreshCycle = 1; refreshCycle <= 3; refreshCycle++) {
          console.log(`\n--- Refresh ${refreshCycle} ---`);
          
          await page.reload();
          await page.waitForTimeout(3000);
          
          const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
          let totalPromptsAfter = 0;
          
          for (let i = 0; i < terminalsAfter.length; i++) {
            const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
            console.log(`  Terminal ${i + 1} prompts after refresh ${refreshCycle}: ${promptCount}`);
            totalPromptsAfter += promptCount;
            
            // Check for consecutive prompts
            const consecutivePrompts = terminalsAfter[i].match(/usuario@[^$]*\$\s*usuario@[^$]*\$/g);
            if (consecutivePrompts && consecutivePrompts.length > 0) {
              console.log(`  ❌ Terminal ${i + 1} has ${consecutivePrompts.length} consecutive prompts`);
            }
          }
          
          console.log(`  Total prompts after refresh ${refreshCycle}: ${totalPromptsAfter}`);
          
          if (totalPromptsAfter > totalPromptsBefore * 1.2) {
            console.log(`  ❌ Refresh ${refreshCycle}: Excessive prompt growth detected`);
          } else {
            console.log(`  ✅ Refresh ${refreshCycle}: Prompt growth controlled`);
          }
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/cycle2-final.png', 
          fullPage: true 
        });
        
      } else {
        console.log('❌ Split button not found');
      }
    }
  });
  
  test('Cycle 3: Test extreme duplication scenario', async ({ page }) => {
    console.log('\n=== CYCLE 3: TEST EXTREME DUPLICATION SCENARIO ===');
    
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
      await page.fill('input[type="text"]', 'Cycle 3 Extreme Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute many commands quickly
      const commands = [
        'echo "test1"', 'echo "test2"', 'echo "test3"', 'echo "test4"',
        'ls', 'pwd', 'whoami', 'date', 'echo "final"'
      ];
      
      for (const cmd of commands) {
        await page.keyboard.type(cmd);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
      }
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute commands in second panel
        for (let i = 0; i < 5; i++) {
          await page.keyboard.type(`echo "panel2-${i}"`);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(200);
        }
        
        console.log('✅ Created extreme scenario with many commands');
        
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
        console.log('Refreshing extreme scenario...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts after refresh: ${promptCount}`);
          totalPromptsAfter += promptCount;
          
          // Check if commands are preserved
          const content = terminalsAfter[i];
          const preservedCommands = content.match(/(test1|test2|panel2-)/g);
          if (preservedCommands) {
            console.log(`  ✅ Terminal ${i + 1} preserves ${preservedCommands.length} command references`);
          }
        }
        
        console.log(`Total prompts after refresh: ${totalPromptsAfter}`);
        
        const reductionRatio = totalPromptsAfter / totalPromptsBefore;
        console.log(`Prompt reduction ratio: ${reductionRatio.toFixed(2)}`);
        
        if (reductionRatio > 0.8) {
          console.log('❌ CYCLE 3 FAILED: Insufficient prompt reduction');
        } else {
          console.log('✅ CYCLE 3 PASSED: Significant prompt reduction achieved');
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/cycle3-extreme.png', 
          fullPage: true 
        });
        
      } else {
        console.log('❌ Split button not found');
      }
    }
  });
});