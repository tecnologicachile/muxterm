const { test, expect } = require('@playwright/test');

test.describe('Test New Prompt Configuration', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Verify new prompt with line break', async ({ page }) => {
    console.log('\n=== TESTING NEW PROMPT CONFIGURATION ===');
    
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
      await page.fill('input[type="text"]', 'New Prompt Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(3000);
      
      // Take screenshot before ls
      await page.screenshot({ path: 'before-ls.png' });
      
      // Execute ls
      console.log('Executing ls command...');
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Get content and check
      const content = await page.locator('.xterm-rows').textContent();
      console.log('\nChecking for Vídeosusuario@ problem:');
      
      if (content.includes('Vídeosusuario@')) {
        console.log('❌ Problem still exists with new prompt');
        const idx = content.indexOf('Vídeosusuario@');
        console.log(`Found at position: ${idx}`);
        console.log(`Context: "${content.substring(idx - 20, idx + 30)}"`);
      } else {
        console.log('✅ FIXED! No Vídeosusuario@ concatenation');
      }
      
      // Take screenshot after ls
      await page.screenshot({ path: 'after-ls.png' });
      
      // Check if there's a line break before prompt
      const lines = content.split(/\n/);
      console.log(`\nTotal lines in terminal: ${lines.length}`);
      
      // Find lines with prompts
      const promptLines = lines.filter(line => line.includes('usuario@') && line.includes(':~$'));
      console.log(`Found ${promptLines.length} prompt lines`);
      
      if (promptLines.length > 0) {
        console.log('\nPrompt lines:');
        promptLines.forEach((line, i) => {
          console.log(`  ${i + 1}: "${line.substring(0, 50)}..."`);
        });
      }
    }
  });
});