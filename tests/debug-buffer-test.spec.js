const { test, expect } = require('@playwright/test');

test.describe('Debug Buffer Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Debug: Ver contenido exacto del buffer', async ({ page }) => {
    console.log('\n=== DEBUG: CONTENIDO EXACTO DEL BUFFER ===');
    
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
      await page.fill('input[type="text"]', 'Debug Buffer Test');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute ls command
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Get content BEFORE split
      const contentBeforeSplit = await page.locator('.xterm-rows').textContent();
      console.log('\n📋 CONTENIDO ANTES DEL SPLIT:');
      console.log(`"${contentBeforeSplit}"`);
      console.log(`Longitud: ${contentBeforeSplit.length} caracteres`);
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Get content AFTER split
        const terminalsAfterSplit = await page.locator('.xterm-rows').allTextContents();
        console.log('\n📋 CONTENIDO DESPUÉS DEL SPLIT:');
        terminalsAfterSplit.forEach((content, i) => {
          console.log(`Terminal ${i + 1}: "${content}"`);
          console.log(`Longitud: ${content.length} caracteres`);
        });
        
        // Now refresh
        console.log('\n🔄 REFRESCANDO...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Get content AFTER refresh
        const terminalsAfterRefresh = await page.locator('.xterm-rows').allTextContents();
        console.log('\n📋 CONTENIDO DESPUÉS DEL REFRESH:');
        terminalsAfterRefresh.forEach((content, i) => {
          console.log(`\nTerminal ${i + 1}:`);
          console.log(`Contenido RAW: "${content}"`);
          console.log(`Longitud: ${content.length} caracteres`);
          
          // Mostrar bytes alrededor de "Vídeos"
          const videosIndex = content.indexOf('Vídeos');
          if (videosIndex > -1) {
            console.log(`\n🔍 Análisis alrededor de "Vídeos" (índice ${videosIndex}):`);
            const start = Math.max(0, videosIndex - 10);
            const end = Math.min(content.length, videosIndex + 20);
            const snippet = content.substring(start, end);
            console.log(`Snippet: "${snippet}"`);
            
            // Mostrar códigos de caracteres
            console.log('Códigos de caracteres:');
            for (let j = start; j < end; j++) {
              const char = content[j];
              const code = content.charCodeAt(j);
              console.log(`  [${j}] '${char}' = ${code} (0x${code.toString(16)})`);
            }
          }
          
          // Buscar patrones problemáticos
          if (content.includes('Vídeosusuario@')) {
            console.log('❌ PROBLEMA DETECTADO: "Vídeosusuario@"');
          }
          
          const duplicatePattern = /(\w+@[\w.-]+)-\1/;
          if (duplicatePattern.test(content)) {
            console.log('❌ DUPLICACIÓN DETECTADA');
          }
        });
        
        console.log('\n🔍 REVISAR LOGS DEL SERVIDOR PARA [DEBUG] y [FIX]');
      }
    }
  });
});