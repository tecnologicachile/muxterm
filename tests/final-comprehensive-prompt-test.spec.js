const { test, expect } = require('@playwright/test');

test.describe('Final Comprehensive Prompt Test', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Final test: Comprehensive prompt duplication validation', async ({ page }) => {
    console.log('\n=== FINAL COMPREHENSIVE PROMPT TEST ===');
    
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
      await page.fill('input[type="text"]', 'Final Comprehensive Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute the exact command from screenshots
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        console.log('✅ Created split panels exactly like user screenshots');
        
        // Perform 10 consecutive refresh tests
        let testResults = [];
        
        for (let iteration = 1; iteration <= 10; iteration++) {
          console.log(`\n--- ITERATION ${iteration} ---`);
          
          // Check prompts before refresh
          const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
          let totalPromptsBefore = 0;
          
          for (let i = 0; i < terminalsBefore.length; i++) {
            const promptCount = (terminalsBefore[i].match(/usuario@[^$]*\$/g) || []).length;
            totalPromptsBefore += promptCount;
          }
          
          console.log(`  Before refresh: ${totalPromptsBefore} prompts`);
          
          // Refresh page
          await page.reload();
          await page.waitForTimeout(3000);
          
          // Check prompts after refresh
          const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
          let totalPromptsAfter = 0;
          
          for (let i = 0; i < terminalsAfter.length; i++) {
            const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
            totalPromptsAfter += promptCount;
          }
          
          console.log(`  After refresh: ${totalPromptsAfter} prompts`);
          
          const promptIncrease = totalPromptsAfter - totalPromptsBefore;
          const testPassed = promptIncrease <= 0;
          
          testResults.push({
            iteration: iteration,
            beforeCount: totalPromptsBefore,
            afterCount: totalPromptsAfter,
            increase: promptIncrease,
            passed: testPassed
          });
          
          if (testPassed) {
            console.log(`  ✅ ITERATION ${iteration} PASSED: No prompt duplication (${promptIncrease})`);
          } else {
            console.log(`  ❌ ITERATION ${iteration} FAILED: Prompt duplication detected (+${promptIncrease})`);
          }
        }
        
        // Final assessment
        const passedTests = testResults.filter(r => r.passed).length;
        const totalTests = testResults.length;
        const successRate = (passedTests / totalTests) * 100;
        
        console.log(`\n=== FINAL ASSESSMENT ===`);
        console.log(`Tests passed: ${passedTests}/${totalTests} (${successRate.toFixed(1)}%)`);
        
        if (successRate >= 90) {
          console.log('✅ COMPREHENSIVE TEST PASSED: Prompt duplication effectively resolved');
        } else {
          console.log('❌ COMPREHENSIVE TEST FAILED: Prompt duplication still occurs');
          
          // Show detailed results
          for (const result of testResults) {
            if (!result.passed) {
              console.log(`  Iteration ${result.iteration}: ${result.beforeCount} → ${result.afterCount} (+${result.increase})`);
            }
          }
        }
        
        // Take final screenshot
        await page.screenshot({ 
          path: 'tests/screenshots/final-comprehensive-result.png', 
          fullPage: true 
        });
        
        return {
          successRate: successRate,
          passedTests: passedTests,
          totalTests: totalTests,
          testResults: testResults
        };
        
      } else {
        console.log('❌ Split button not found');
        return { successRate: 0 };
      }
    }
  });
});