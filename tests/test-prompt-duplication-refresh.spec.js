const { test, expect } = require('@playwright/test');

test.describe('Test Prompt Duplication After Refresh', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Test split panel prompt duplication after refresh', async ({ page }) => {
    console.log('\n=== TESTING PROMPT DUPLICATION AFTER REFRESH ===');
    
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
      await page.fill('input[type="text"]', 'Prompt Duplication Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute a command in first panel
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
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/before-refresh-split.png', 
          fullPage: true 
        });
        
        // Count prompts in left panel before refresh
        const leftPanelBefore = await page.locator('.panel-container').first();
        const leftTerminalBefore = await leftPanelBefore.locator('.xterm-screen').textContent();
        const promptCountBefore = (leftTerminalBefore.match(/usuario@usuario-Standard-PC-\d+FX-PIIX-\d+:~\$/g) || []).length;
        console.log(`Left panel prompts before refresh: ${promptCountBefore}`);
        
        // Refresh the page
        console.log('Refreshing page...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/after-refresh-split.png', 
          fullPage: true 
        });
        
        // Count prompts in left panel after refresh
        const leftPanelAfter = await page.locator('.panel-container').first();
        const leftTerminalAfter = await leftPanelAfter.locator('.xterm-screen').textContent();
        const promptCountAfter = (leftTerminalAfter.match(/usuario@usuario-Standard-PC-\d+FX-PIIX-\d+:~\$/g) || []).length;
        console.log(`Left panel prompts after refresh: ${promptCountAfter}`);
        
        // Count prompts in right panel after refresh
        const rightPanelAfter = await page.locator('.panel-container').last();
        const rightTerminalAfter = await rightPanelAfter.locator('.xterm-screen').textContent();
        const rightPromptCountAfter = (rightTerminalAfter.match(/usuario@usuario-Standard-PC-\d+FX-PIIX-\d+:~\$/g) || []).length;
        console.log(`Right panel prompts after refresh: ${rightPromptCountAfter}`);
        
        // Log terminal content for debugging
        console.log('\nLeft panel content after refresh:');
        console.log(leftTerminalAfter.substring(0, 200) + '...');
        
        console.log('\nRight panel content after refresh:');
        console.log(rightTerminalAfter.substring(0, 200) + '...');
        
        // Check for prompt duplication
        if (promptCountAfter > promptCountBefore) {
          console.log(`❌ PROMPT DUPLICATION DETECTED: ${promptCountBefore} → ${promptCountAfter} prompts in left panel`);
          console.log('🔍 This indicates SMART CLEANUP is not working correctly for split panels');
        } else {
          console.log(`✅ No prompt duplication: ${promptCountBefore} → ${promptCountAfter} prompts in left panel`);
        }
        
        // Check if right panel has normal prompt count
        if (rightPromptCountAfter <= 2) {
          console.log(`✅ Right panel has normal prompt count: ${rightPromptCountAfter}`);
        } else {
          console.log(`⚠️  Right panel also has prompt duplication: ${rightPromptCountAfter}`);
        }
        
        // Look for specific patterns that indicate SMART CLEANUP issues
        const hasExcessivePrompts = promptCountAfter > 3;
        const hasStackedPrompts = leftTerminalAfter.includes('usuario@usuario-Standard-PC-1440FX-PIIX-1996:~$usuario@usuario-Standard-PC-1440FX-PIIX-1996:~$');
        
        if (hasExcessivePrompts) {
          console.log(`⚠️  EXCESSIVE PROMPTS: Found ${promptCountAfter} prompts (expected ≤ 3)`);
        }
        
        if (hasStackedPrompts) {
          console.log('⚠️  STACKED PROMPTS: Found consecutive prompts without commands');
        }
        
        // Final assessment
        if (promptCountAfter <= promptCountBefore + 1 && !hasStackedPrompts) {
          console.log('✅ SMART CLEANUP WORKING: No significant prompt duplication detected');
        } else {
          console.log('❌ SMART CLEANUP FAILED: Prompt duplication persists after refresh');
        }
        
      } else {
        console.log('❌ Split button not found, cannot test split panel duplication');
      }
    }
  });
  
  test('Test single panel prompt duplication after refresh', async ({ page }) => {
    console.log('\n=== TESTING SINGLE PANEL PROMPT DUPLICATION ===');
    
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
      await page.fill('input[type="text"]', 'Single Panel Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute multiple commands
      const commands = ['echo "test1"', 'ls', 'echo "test2"', 'pwd'];
      for (const cmd of commands) {
        await page.keyboard.type(cmd);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
      }
      
      // Count prompts before refresh
      const terminalBefore = await page.locator('.xterm-screen').textContent();
      const promptCountBefore = (terminalBefore.match(/usuario@usuario-Standard-PC-\d+FX-PIIX-\d+:~\$/g) || []).length;
      console.log(`Single panel prompts before refresh: ${promptCountBefore}`);
      
      // Refresh the page
      console.log('Refreshing single panel...');
      await page.reload();
      await page.waitForTimeout(3000);
      
      // Count prompts after refresh
      const terminalAfter = await page.locator('.xterm-screen').textContent();
      const promptCountAfter = (terminalAfter.match(/usuario@usuario-Standard-PC-\d+FX-PIIX-\d+:~\$/g) || []).length;
      console.log(`Single panel prompts after refresh: ${promptCountAfter}`);
      
      // Take screenshot
      await page.screenshot({ 
        path: 'tests/screenshots/single-panel-after-refresh.png', 
        fullPage: true 
      });
      
      // Check for duplication
      if (promptCountAfter > promptCountBefore) {
        console.log(`❌ SINGLE PANEL DUPLICATION: ${promptCountBefore} → ${promptCountAfter} prompts`);
      } else {
        console.log(`✅ Single panel clean: ${promptCountBefore} → ${promptCountAfter} prompts`);
      }
      
      // Log content for debugging
      console.log('\nSingle panel content after refresh:');
      console.log(terminalAfter.substring(0, 300) + '...');
    }
  });
});