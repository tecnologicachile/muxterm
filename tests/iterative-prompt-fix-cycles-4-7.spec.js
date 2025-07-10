const { test, expect } = require('@playwright/test');

test.describe('Iterative Prompt Fix - Cycles 4-7', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Cycle 4: Test consecutive refresh stability', async ({ page }) => {
    console.log('\n=== CYCLE 4: TEST CONSECUTIVE REFRESH STABILITY ===');
    
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
      await page.fill('input[type="text"]', 'Cycle 4 Stability Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute commands
      await page.keyboard.type('echo "stability test"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      await page.keyboard.type('ls -la');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute commands in second panel
        await page.keyboard.type('echo "panel 2 stability"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        console.log('✅ Created split panels for stability test');
        
        // Test 5 consecutive refreshes
        let previousPromptCount = 0;
        for (let refreshNum = 1; refreshNum <= 5; refreshNum++) {
          console.log(`\n--- Consecutive Refresh ${refreshNum} ---`);
          
          await page.reload();
          await page.waitForTimeout(3000);
          
          const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
          let totalPromptsAfter = 0;
          
          for (let i = 0; i < terminalsAfter.length; i++) {
            const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
            console.log(`  Terminal ${i + 1} prompts: ${promptCount}`);
            totalPromptsAfter += promptCount;
            
            // Check for consecutive prompts
            const consecutivePrompts = terminalsAfter[i].match(/usuario@[^$]*\$\s*usuario@[^$]*\$/g);
            if (consecutivePrompts && consecutivePrompts.length > 0) {
              console.log(`  ⚠️  Terminal ${i + 1} has ${consecutivePrompts.length} consecutive prompts`);
            }
          }
          
          console.log(`  Total prompts: ${totalPromptsAfter}`);
          
          // Check stability
          if (refreshNum > 1) {
            const promptChange = totalPromptsAfter - previousPromptCount;
            if (Math.abs(promptChange) <= 1) {
              console.log(`  ✅ Refresh ${refreshNum}: Stable (+${promptChange})`);
            } else {
              console.log(`  ❌ Refresh ${refreshNum}: Unstable (+${promptChange})`);
            }
          }
          
          previousPromptCount = totalPromptsAfter;
        }
        
        // Final assessment
        if (previousPromptCount <= 5) {
          console.log('✅ CYCLE 4 PASSED: System remains stable after multiple refreshes');
        } else {
          console.log('❌ CYCLE 4 FAILED: System became unstable');
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/cycle4-stability.png', 
          fullPage: true 
        });
        
      } else {
        console.log('❌ Split button not found');
      }
    }
  });
  
  test('Cycle 5: Test edge case - empty commands', async ({ page }) => {
    console.log('\n=== CYCLE 5: TEST EDGE CASE - EMPTY COMMANDS ===');
    
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
      await page.fill('input[type="text"]', 'Cycle 5 Edge Case Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute empty commands and regular commands
      await page.keyboard.press('Enter'); // Empty command
      await page.waitForTimeout(300);
      
      await page.keyboard.type('echo "test"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      await page.keyboard.press('Enter'); // Another empty command
      await page.waitForTimeout(300);
      
      await page.keyboard.press('Enter'); // Another empty command
      await page.waitForTimeout(300);
      
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute empty commands in second panel
        await page.keyboard.press('Enter'); // Empty command
        await page.waitForTimeout(300);
        
        await page.keyboard.press('Enter'); // Empty command
        await page.waitForTimeout(300);
        
        console.log('✅ Created edge case scenario with empty commands');
        
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
        console.log('Refreshing edge case scenario...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts after refresh: ${promptCount}`);
          totalPromptsAfter += promptCount;
          
          // Check if meaningful content is preserved
          const content = terminalsAfter[i];
          if (content.includes('echo "test"') || content.includes('ls')) {
            console.log(`  ✅ Terminal ${i + 1} preserves meaningful commands`);
          }
        }
        
        console.log(`Total prompts after refresh: ${totalPromptsAfter}`);
        
        // Assessment for edge case
        if (totalPromptsAfter <= totalPromptsBefore) {
          console.log('✅ CYCLE 5 PASSED: Edge case handled correctly');
        } else {
          console.log('❌ CYCLE 5 FAILED: Edge case caused prompt growth');
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/cycle5-edge-case.png', 
          fullPage: true 
        });
        
      } else {
        console.log('❌ Split button not found');
      }
    }
  });
  
  test('Cycle 6: Test rapid command execution', async ({ page }) => {
    console.log('\n=== CYCLE 6: TEST RAPID COMMAND EXECUTION ===');
    
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
      await page.fill('input[type="text"]', 'Cycle 6 Rapid Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute commands rapidly
      const rapidCommands = [
        'echo "rapid1"', 'echo "rapid2"', 'echo "rapid3"',
        'pwd', 'whoami', 'date', 'echo "rapid4"', 'echo "rapid5"',
        'ls', 'echo "rapid6"', 'echo "rapid7"', 'echo "rapid8"'
      ];
      
      for (const cmd of rapidCommands) {
        await page.keyboard.type(cmd);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100); // Very short delay
      }
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute rapid commands in second panel
        for (let i = 0; i < 8; i++) {
          await page.keyboard.type(`echo "panel2-rapid-${i}"`);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(100);
        }
        
        console.log('✅ Created rapid command execution scenario');
        
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
        console.log('Refreshing rapid execution scenario...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts after refresh: ${promptCount}`);
          totalPromptsAfter += promptCount;
          
          // Check if rapid commands are preserved
          const content = terminalsAfter[i];
          const rapidCommands = content.match(/(rapid\d+|panel2-rapid-\d+)/g);
          if (rapidCommands) {
            console.log(`  ✅ Terminal ${i + 1} preserves ${rapidCommands.length} rapid commands`);
          }
        }
        
        console.log(`Total prompts after refresh: ${totalPromptsAfter}`);
        
        const reductionRatio = totalPromptsAfter / totalPromptsBefore;
        console.log(`Rapid scenario reduction ratio: ${reductionRatio.toFixed(2)}`);
        
        // Assessment
        if (reductionRatio < 0.7) {
          console.log('✅ CYCLE 6 PASSED: Rapid commands handled with good reduction');
        } else {
          console.log('❌ CYCLE 6 FAILED: Insufficient reduction for rapid commands');
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/cycle6-rapid.png', 
          fullPage: true 
        });
        
      } else {
        console.log('❌ Split button not found');
      }
    }
  });
  
  test('Cycle 7: Test mixed scenario validation', async ({ page }) => {
    console.log('\n=== CYCLE 7: TEST MIXED SCENARIO VALIDATION ===');
    
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
      await page.fill('input[type="text"]', 'Cycle 7 Mixed Validation');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Mixed scenario: regular commands, empty commands, rapid commands
      await page.keyboard.type('echo "start mixed test"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      await page.keyboard.press('Enter'); // Empty
      await page.waitForTimeout(200);
      
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Rapid sequence
      for (let i = 0; i < 3; i++) {
        await page.keyboard.type(`echo "mixed-${i}"`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
      }
      
      await page.keyboard.press('Enter'); // Empty
      await page.waitForTimeout(200);
      
      await page.keyboard.type('pwd');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Mixed scenario in second panel
        await page.keyboard.type('echo "panel2 mixed"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        await page.keyboard.press('Enter'); // Empty
        await page.waitForTimeout(200);
        
        await page.keyboard.type('whoami');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        console.log('✅ Created mixed validation scenario');
        
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
        console.log('Refreshing mixed validation scenario...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        let preservedContentCount = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts after refresh: ${promptCount}`);
          totalPromptsAfter += promptCount;
          
          // Check if mixed content is preserved
          const content = terminalsAfter[i];
          const preservedItems = content.match(/(mixed|panel2|start|pwd|whoami)/g);
          if (preservedItems) {
            preservedContentCount += preservedItems.length;
            console.log(`  ✅ Terminal ${i + 1} preserves ${preservedItems.length} content items`);
          }
        }
        
        console.log(`Total prompts after refresh: ${totalPromptsAfter}`);
        console.log(`Total preserved content items: ${preservedContentCount}`);
        
        const reductionRatio = totalPromptsAfter / totalPromptsBefore;
        console.log(`Mixed scenario reduction ratio: ${reductionRatio.toFixed(2)}`);
        
        // Comprehensive assessment
        const promptReductionGood = reductionRatio < 0.8;
        const contentPreserved = preservedContentCount > 5;
        const stablePromptCount = totalPromptsAfter <= 6;
        
        if (promptReductionGood && contentPreserved && stablePromptCount) {
          console.log('✅ CYCLE 7 PASSED: Mixed scenario handled comprehensively');
          console.log(`  - Prompt reduction: ${promptReductionGood ? 'Good' : 'Poor'}`);
          console.log(`  - Content preservation: ${contentPreserved ? 'Good' : 'Poor'}`);
          console.log(`  - Stable prompt count: ${stablePromptCount ? 'Good' : 'Poor'}`);
        } else {
          console.log('❌ CYCLE 7 FAILED: Mixed scenario issues detected');
          console.log(`  - Prompt reduction: ${promptReductionGood ? 'Good' : 'Poor'}`);
          console.log(`  - Content preservation: ${contentPreserved ? 'Good' : 'Poor'}`);
          console.log(`  - Stable prompt count: ${stablePromptCount ? 'Good' : 'Poor'}`);
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/cycle7-mixed.png', 
          fullPage: true 
        });
        
      } else {
        console.log('❌ Split button not found');
      }
    }
  });
});