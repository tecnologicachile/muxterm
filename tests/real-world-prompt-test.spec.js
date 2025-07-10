const { test, expect } = require('@playwright/test');

test.describe('Real World Prompt Duplication Test', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Take screenshot before and after refresh to analyze real problem', async ({ page }) => {
    console.log('\n=== REAL WORLD PROMPT DUPLICATION TEST ===');
    
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
      await page.fill('input[type="text"]', 'Real World Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute command like in the screenshots
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        console.log('✅ Created split panels like in screenshots');
        
        // === TAKE SCREENSHOT BEFORE REFRESH ===
        await page.screenshot({ 
          path: 'tests/screenshots/real-world-before-refresh.png', 
          fullPage: true 
        });
        
        // Analyze content before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        let leftPanelPromptsBefore = 0;
        let rightPanelPromptsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const content = terminalsBefore[i];
          const promptCount = (content.match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts before refresh: ${promptCount}`);
          console.log(`Terminal ${i + 1} content preview: "${content.substring(0, 200)}..."`);
          
          totalPromptsBefore += promptCount;
          
          if (i === 0) leftPanelPromptsBefore = promptCount;
          if (i === 1) rightPanelPromptsBefore = promptCount;
        }
        
        console.log(`\nBEFORE REFRESH SUMMARY:`);
        console.log(`Left panel prompts: ${leftPanelPromptsBefore}`);
        console.log(`Right panel prompts: ${rightPanelPromptsBefore}`);
        console.log(`Total prompts: ${totalPromptsBefore}`);
        
        // === REFRESH PAGE ===
        console.log('\n🔄 REFRESHING PAGE...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // === TAKE SCREENSHOT AFTER REFRESH ===
        await page.screenshot({ 
          path: 'tests/screenshots/real-world-after-refresh.png', 
          fullPage: true 
        });
        
        // Analyze content after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        let leftPanelPromptsAfter = 0;
        let rightPanelPromptsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          const promptCount = (content.match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts after refresh: ${promptCount}`);
          console.log(`Terminal ${i + 1} content preview: "${content.substring(0, 200)}..."`);
          
          totalPromptsAfter += promptCount;
          
          if (i === 0) leftPanelPromptsAfter = promptCount;
          if (i === 1) rightPanelPromptsAfter = promptCount;
          
          // Check for consecutive prompts pattern
          const consecutivePrompts = content.match(/usuario@[^$]*\$\s*usuario@[^$]*\$/g);
          if (consecutivePrompts && consecutivePrompts.length > 0) {
            console.log(`❌ Terminal ${i + 1} has ${consecutivePrompts.length} consecutive prompt patterns`);
            console.log(`   Example: "${consecutivePrompts[0].substring(0, 100)}..."`);
          }
        }
        
        console.log(`\nAFTER REFRESH SUMMARY:`);
        console.log(`Left panel prompts: ${leftPanelPromptsAfter}`);
        console.log(`Right panel prompts: ${rightPanelPromptsAfter}`);
        console.log(`Total prompts: ${totalPromptsAfter}`);
        
        // === PROBLEM ANALYSIS ===
        console.log(`\n📊 PROBLEM ANALYSIS:`);
        const totalIncrease = totalPromptsAfter - totalPromptsBefore;
        const leftIncrease = leftPanelPromptsAfter - leftPanelPromptsBefore;
        const rightIncrease = rightPanelPromptsAfter - rightPanelPromptsBefore;
        
        console.log(`Total prompt increase: ${totalIncrease}`);
        console.log(`Left panel increase: ${leftIncrease}`);
        console.log(`Right panel increase: ${rightIncrease}`);
        
        if (totalIncrease > 0) {
          console.log(`❌ PROBLEM CONFIRMED: Prompt duplication after refresh (+${totalIncrease})`);
          
          if (leftIncrease > 0) {
            console.log(`   Left panel has duplication: +${leftIncrease} prompts`);
          }
          if (rightIncrease > 0) {
            console.log(`   Right panel has duplication: +${rightIncrease} prompts`);
          }
          
          // Detailed analysis of the problem
          console.log(`\n🔍 DETAILED PROBLEM ANALYSIS:`);
          
          // Check if RADICAL CLEANUP is working
          if (leftPanelPromptsAfter > 3) {
            console.log(`   Left panel has ${leftPanelPromptsAfter} prompts (expected ≤ 3)`);
            console.log(`   RADICAL CLEANUP may not be working correctly`);
          }
          
          // Check for specific patterns
          for (let i = 0; i < terminalsAfter.length; i++) {
            const content = terminalsAfter[i];
            
            // Look for stacked prompts without commands
            const stackedPrompts = content.match(/usuario@[^$]*\$\s*usuario@[^$]*\$/g);
            if (stackedPrompts) {
              console.log(`   Terminal ${i + 1} has ${stackedPrompts.length} stacked prompts`);
            }
            
            // Check if buffer cleanup is preserving duplicates
            const promptSpacing = content.split('usuario@').length - 1;
            if (promptSpacing > totalPromptsAfter / 2) {
              console.log(`   Terminal ${i + 1} may have buffer cleanup issues`);
            }
          }
          
        } else {
          console.log(`✅ NO PROBLEM: Prompt count stable or reduced`);
        }
        
        // Return detailed problem information for next iteration
        return {
          problemExists: totalIncrease > 0,
          leftPanelIssue: leftIncrease > 0,
          rightPanelIssue: rightIncrease > 0,
          totalIncrease: totalIncrease,
          leftIncrease: leftIncrease,
          rightIncrease: rightIncrease,
          beforeContent: terminalsBefore,
          afterContent: terminalsAfter
        };
        
      } else {
        console.log('❌ Split button not found');
        return { problemExists: false };
      }
    }
  });
});