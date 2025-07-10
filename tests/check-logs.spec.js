const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.describe('Check Server Logs', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Create session and check server logs', async ({ page }) => {
    console.log('\n=== CHECKING SERVER LOGS ===');
    
    // Clear server log first
    try {
      fs.writeFileSync('server.log', '');
      console.log('Server log cleared');
    } catch (e) {
      console.log('Could not clear server log');
    }
    
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
      await page.fill('input[type="text"]', 'Log Check');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Type ls command
      console.log('\nTyping ls command...');
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      
      // Read server log
      console.log('\nChecking server logs for PTY fixes...');
      try {
        const log = fs.readFileSync('server.log', 'utf8');
        const ptyLines = log.split('\n').filter(line => 
          line.includes('PTY-') || line.includes('BUFFER') || line.includes('FIX')
        );
        
        if (ptyLines.length > 0) {
          console.log('\nFound PTY/Buffer logs:');
          ptyLines.forEach(line => console.log(line));
        } else {
          console.log('\nNo PTY/Buffer logs found');
        }
      } catch (e) {
        console.log('Could not read server log:', e.message);
      }
      
      // Check terminal content
      const content = await page.locator('.xterm-rows').textContent();
      console.log('\nTerminal content check:');
      if (content.includes('Vídeosusuario@')) {
        console.log('❌ Has "Vídeosusuario@" problem');
        const idx = content.indexOf('Vídeosusuario@');
        console.log(`Found at position ${idx}`);
      } else {
        console.log('✅ No "Vídeosusuario@" problem');
      }
    }
  });
});