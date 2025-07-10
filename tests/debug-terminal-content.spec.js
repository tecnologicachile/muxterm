const { test, expect } = require('@playwright/test');

test.describe('Debug Terminal Content', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Debug terminal DOM structure', async ({ page }) => {
    console.log('\n=== DEBUG TERMINAL DOM STRUCTURE ===');
    
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
      await page.fill('input[type="text"]', 'Debug Terminal');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute a command
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Debug: Find all possible terminal-related elements
      console.log('=== DEBUGGING DOM STRUCTURE ===');
      
      // Check for xterm-related selectors
      const xtermElements = await page.locator('[class*="xterm"]').count();
      console.log(`Found ${xtermElements} elements with xterm in class`);
      
      // Try different xterm selectors
      const selectors = [
        '.xterm-screen',
        '.xterm-rows',
        '.xterm-viewport',
        '.xterm-helper-textarea',
        '.xterm',
        '[class*="xterm-screen"]',
        '[class*="xterm-rows"]',
        '[class*="xterm-viewport"]'
      ];
      
      for (const selector of selectors) {
        try {
          const elements = await page.locator(selector).count();
          console.log(`Selector "${selector}": ${elements} elements`);
          
          if (elements > 0) {
            const content = await page.locator(selector).first().textContent();
            const preview = content.substring(0, 100).replace(/\n/g, '\\n');
            console.log(`  Content preview: "${preview}"`);
            
            // Check if it contains terminal prompt
            if (content.includes('usuario@') || content.includes('$') || content.includes('ls')) {
              console.log(`  ✅ This selector contains terminal content!`);
            }
          }
        } catch (error) {
          console.log(`  ❌ Error with selector "${selector}": ${error.message}`);
        }
      }
      
      // Try to find terminal content in different ways
      console.log('\n=== TRYING DIFFERENT APPROACHES ===');
      
      // Method 1: Look for text containing our command
      const lsElements = await page.locator(':has-text("ls")').count();
      console.log(`Elements containing "ls": ${lsElements}`);
      
      // Method 2: Look for prompt pattern
      const promptElements = await page.locator(':has-text("usuario@")').count();
      console.log(`Elements containing "usuario@": ${promptElements}`);
      
      // Method 3: Get all text content from page
      const allText = await page.textContent('body');
      if (allText.includes('usuario@')) {
        console.log('✅ Page contains terminal prompt in body');
        const promptMatches = allText.match(/usuario@[^$]*\$/g);
        console.log(`Found ${promptMatches ? promptMatches.length : 0} prompt patterns in body`);
      }
      
      // Method 4: Check for our specific terminal class
      const terminals = await page.locator('.terminal').count();
      console.log(`Elements with .terminal class: ${terminals}`);
      
      // Split the panel to see if we can detect the issue
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        console.log('\n=== TESTING SPLIT PANELS ===');
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute command in second panel
        await page.keyboard.type('echo "second panel"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // Check xterm elements after split
        const xtermAfterSplit = await page.locator('[class*="xterm"]').count();
        console.log(`XTerm elements after split: ${xtermAfterSplit}`);
        
        // Try to find terminal content after split
        for (const selector of ['.xterm-rows', '.xterm-viewport', '.xterm-screen']) {
          try {
            const elements = await page.locator(selector).count();
            console.log(`After split - "${selector}": ${elements} elements`);
            
            if (elements > 0) {
              for (let i = 0; i < Math.min(elements, 3); i++) {
                const content = await page.locator(selector).nth(i).textContent();
                const preview = content.substring(0, 100).replace(/\n/g, '\\n');
                console.log(`  Element ${i}: "${preview}"`);
                
                if (content.includes('usuario@') || content.includes('echo')) {
                  console.log(`  ✅ Element ${i} contains terminal content!`);
                }
              }
            }
          } catch (error) {
            console.log(`  ❌ Error with selector "${selector}": ${error.message}`);
          }
        }
        
        // Take screenshot for manual inspection
        await page.screenshot({ 
          path: 'tests/screenshots/debug-terminal-dom.png', 
          fullPage: true 
        });
        
        // Now refresh and check again
        console.log('\n=== AFTER REFRESH ===');
        await page.reload();
        await page.waitForTimeout(3000);
        
        const xtermAfterRefresh = await page.locator('[class*="xterm"]').count();
        console.log(`XTerm elements after refresh: ${xtermAfterRefresh}`);
        
        // Check if we can find terminal content after refresh
        for (const selector of ['.xterm-rows', '.xterm-viewport', '.xterm-screen']) {
          try {
            const elements = await page.locator(selector).count();
            console.log(`After refresh - "${selector}": ${elements} elements`);
            
            if (elements > 0) {
              for (let i = 0; i < Math.min(elements, 3); i++) {
                const content = await page.locator(selector).nth(i).textContent();
                const preview = content.substring(0, 100).replace(/\n/g, '\\n');
                console.log(`  Element ${i}: "${preview}"`);
                
                // Look for prompt patterns
                const promptCount = (content.match(/usuario@[^$]*\$/g) || []).length;
                if (promptCount > 0) {
                  console.log(`  ✅ Element ${i} has ${promptCount} prompts!`);
                }
              }
            }
          } catch (error) {
            console.log(`  ❌ Error with selector "${selector}": ${error.message}`);
          }
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/debug-terminal-dom-after-refresh.png', 
          fullPage: true 
        });
      }
    }
  });
});