const { test, expect } = require('@playwright/test');

test.describe('Iteración 4 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 4: Aplicar corrección correctamente', async ({ page }) => {
    console.log('\n=== ITERACIÓN 4: APLICAR CORRECCIÓN CORRECTAMENTE ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 4 - Aplicar Corrección');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute ls command
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter4-before-refresh.png', 
          fullPage: true 
        });
        
        // Get before state
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        console.log('📋 ANTES DE ACTUALIZAR:');
        console.log(`Content: "${terminalsBefore[0]?.substring(0, 150)}..."`);
        
        // Refresh page
        console.log('\n🔄 ACTUALIZANDO PÁGINA...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter4-after-refresh.png', 
          fullPage: true 
        });
        
        // Get after state
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 DESPUÉS DE ACTUALIZAR:');
        let problemFound = false;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          console.log(`Terminal ${i + 1} content: "${content.substring(0, 150)}..."`);
          
          // Check for exact duplicate pattern
          const duplicatePattern = /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g;
          const matches = [];
          let match;
          
          while ((match = duplicatePattern.exec(content)) !== null) {
            const firstPart = match[1];
            const secondPart = match[2];
            
            if (firstPart.includes('@') && secondPart.includes('@')) {
              const firstUser = firstPart.split('@')[0];
              const secondUser = secondPart.split('@')[0];
              
              if (firstUser === secondUser) {
                problemFound = true;
                matches.push({
                  full: match[0],
                  first: firstPart,
                  second: secondPart
                });
              }
            }
          }
          
          if (matches.length > 0) {
            console.log(`❌ Terminal ${i + 1} STILL HAS ${matches.length} duplicates:`);
            matches.forEach((m, idx) => {
              console.log(`   ${idx + 1}: Full: "${m.full}"`);
              console.log(`       First: "${m.first}"`);
              console.log(`       Second: "${m.second}"`);
            });
          } else {
            console.log(`✅ Terminal ${i + 1} NO duplicates found`);
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 4:');
        if (problemFound) {
          console.log('❌ PROBLEMA PERSISTE - Corrección no aplicada correctamente');
        } else {
          console.log('✅ PROBLEMA RESUELTO - Corrección aplicada exitosamente');
        }
        
        return { success: !problemFound, problemFound };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});