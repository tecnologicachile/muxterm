const { test, expect } = require('@playwright/test');

test.describe('Final Prompt Fix Verification', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Verify prompt fix with visual inspection', async ({ page }) => {
    console.log('=== Final Verification Test ===');
    
    // Go directly to the terminal session
    await page.goto(clientUrl + '/terminal/8a248684-387f-4195-9dae-a52a90518a07');
    await page.waitForTimeout(3000);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/final-initial.png', 
      fullPage: true 
    });
    
    // Count terminals
    const terminals = await page.locator('.terminal').all();
    console.log(`Found ${terminals.length} terminals`);
    
    if (terminals.length > 0) {
      // Get content from left terminal
      const leftTerminal = terminals[0];
      const initialContent = await leftTerminal.textContent();
      console.log(`Initial buffer size: ${initialContent.length}`);
      
      // Refresh page 3 times
      for (let i = 1; i <= 3; i++) {
        console.log(`\nRefresh ${i}:`);
        await page.reload();
        await page.waitForTimeout(2000);
        
        const terminalsAfter = await page.locator('.terminal').all();
        if (terminalsAfter.length > 0) {
          const content = await terminalsAfter[0].textContent();
          console.log(`  Buffer size: ${content.length}`);
          
          // Check if buffer is growing significantly
          if (content.length > initialContent.length * 1.5) {
            console.error(`  ❌ Buffer growing excessively!`);
          } else {
            console.log(`  ✅ Buffer size stable`);
          }
        }
      }
      
      // Take final screenshot
      await page.screenshot({ 
        path: 'tests/screenshots/final-after-refreshes.png', 
        fullPage: true 
      });
      
      console.log('\n✅ Visual verification test completed');
      console.log('Check screenshots in tests/screenshots/ folder');
    }
  });
});