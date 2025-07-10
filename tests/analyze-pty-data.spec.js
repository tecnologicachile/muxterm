const { test, expect } = require('@playwright/test');

test.describe('Analyze PTY Data Flow', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Analyze how PTY sends ls output', async ({ page }) => {
    console.log('\n=== ANALYZING PTY DATA FLOW ===');
    
    // Enable console logging from the page
    page.on('console', msg => {
      if (msg.text().includes('PTY') || msg.text().includes('terminal-output')) {
        console.log('[BROWSER]', msg.text());
      }
    });
    
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
      await page.fill('input[type="text"]', 'PTY Analysis');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Inject debug code to monitor WebSocket messages
      await page.evaluate(() => {
        const originalEmit = window.socket.emit;
        window.socket.emit = function(...args) {
          if (args[0] === 'terminal-input') {
            console.log('[SOCKET-OUT]', args[0], args[1]);
          }
          return originalEmit.apply(this, args);
        };
        
        window.socket.on('terminal-output', (data) => {
          console.log('[SOCKET-IN] terminal-output:', {
            terminalId: data.terminalId,
            dataLength: data.data.length,
            data: JSON.stringify(data.data),
            hasVideos: data.data.includes('Vídeos'),
            hasPrompt: data.data.includes('usuario@')
          });
        });
      });
      
      // Type ls command slowly
      console.log('\n📝 Typing ls command...');
      await page.keyboard.type('l', { delay: 100 });
      await page.keyboard.type('s', { delay: 100 });
      await page.waitForTimeout(500);
      
      console.log('📤 Pressing Enter...');
      await page.keyboard.press('Enter');
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      // Get final content
      const content = await page.locator('.xterm-rows').textContent();
      console.log('\n📋 FINAL CONTENT:');
      console.log(JSON.stringify(content));
      
      // Check for problem
      if (content.includes('Vídeosusuario@')) {
        console.log('\n❌ PROBLEM DETECTED: "Vídeosusuario@" found');
        const idx = content.indexOf('Vídeosusuario@');
        console.log(`Position: ${idx}`);
        console.log(`Context: "${content.substring(idx - 20, idx + 30)}"`);
      } else {
        console.log('\n✅ No "Vídeosusuario@" concatenation found');
      }
    }
  });
});