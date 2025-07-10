const { test, expect } = require('@playwright/test');

test.describe('Terminal Prompt Duplication - Simple Test', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Simple test to verify prompt duplication', async ({ page }) => {
    console.log('=== Testing prompt duplication issue ===');
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'log') {
        console.log('Browser console:', msg.text());
      }
    });
    
    // Step 1: Go directly to terminal with existing session
    await page.goto(clientUrl + '/terminal/8a248684-387f-4195-9dae-a52a90518a07');
    
    // Wait for terminals to load
    await page.waitForTimeout(3000);
    
    // Step 2: Count prompts in left terminal
    const terminals = await page.locator('.terminal').all();
    console.log(`Found ${terminals.length} terminals`);
    
    if (terminals.length > 0) {
      const leftTerminal = terminals[0];
      const content = await leftTerminal.textContent();
      const prompts = content.match(/usuario@usuario-Standard-PC-i440FX-PIIX-1996:-\$/g) || [];
      console.log(`Current number of prompts: ${prompts.length}`);
      console.log('Terminal content preview:', content.substring(0, 200));
      
      // Take screenshot
      await page.screenshot({ 
        path: `tests/screenshots/terminal-state-${Date.now()}.png`, 
        fullPage: true 
      });
      
      // Check if prompts are duplicated
      if (prompts.length > 2) {
        console.error(`❌ ISSUE CONFIRMED: Terminal has ${prompts.length} prompts (expected 1-2)`);
        console.log('Full terminal content:', content);
      } else {
        console.log(`✅ OK: Terminal has ${prompts.length} prompts`);
      }
    }
  });
});