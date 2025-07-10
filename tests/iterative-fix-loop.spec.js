const { test, expect } = require('@playwright/test');

test.describe('Iterative Fix Loop - 10 Iterations', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 1: Validar corrección con Playwright', async ({ page }) => {
    console.log('\n=== ITERACIÓN 1: VALIDAR CORRECCIÓN ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 1 - Fix Loop');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute ls command like user reported
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        console.log('✅ Panel dividido horizontalmente');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter1-before-refresh.png', 
          fullPage: true 
        });
        
        // Check content before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let problemBefore = false;
        
        console.log('📋 ANTES DE ACTUALIZAR:');
        for (let i = 0; i < terminalsBefore.length; i++) {
          const content = terminalsBefore[i];
          console.log(`Terminal ${i + 1}: ${content.substring(0, 100)}...`);
          
          // Check for duplication patterns
          const duplicatePattern = /(\w+@[^@-]*)-(\w+@[^$]*\$)/g;
          const duplicateMatches = content.match(duplicatePattern);
          
          if (duplicateMatches) {
            problemBefore = true;
            console.log(`⚠️ Duplicación antes: ${duplicateMatches.length} patrones`);
          }
        }
        
        console.log(`Estado antes: ${problemBefore ? 'PROBLEMA' : 'OK'}`);
        
        // Refresh page
        console.log('\n🔄 ACTUALIZANDO PÁGINA...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter1-after-refresh.png', 
          fullPage: true 
        });
        
        // Check content after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let problemAfter = false;
        
        console.log('📋 DESPUÉS DE ACTUALIZAR:');
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          console.log(`Terminal ${i + 1}: ${content.substring(0, 100)}...`);
          
          // Check for duplication patterns
          const duplicatePattern = /(\w+@[^@-]*)-(\w+@[^$]*\$)/g;
          const duplicateMatches = content.match(duplicatePattern);
          
          if (duplicateMatches) {
            problemAfter = true;
            console.log(`❌ Duplicación después: ${duplicateMatches.length} patrones`);
            duplicateMatches.forEach((match, idx) => {
              console.log(`   ${idx + 1}: "${match}"`);
            });
          }
        }
        
        console.log(`Estado después: ${problemAfter ? 'PROBLEMA' : 'OK'}`);
        
        // Assessment
        console.log('\n📊 RESULTADO ITERACIÓN 1:');
        if (problemAfter) {
          console.log('❌ PROBLEMA PERSISTE - Necesita más corrección');
          return { 
            success: false, 
            needsMoreWork: true,
            problemBefore: problemBefore,
            problemAfter: problemAfter
          };
        } else {
          console.log('✅ PROBLEMA RESUELTO - Corrección exitosa');
          return { 
            success: true, 
            needsMoreWork: false,
            problemBefore: problemBefore,
            problemAfter: problemAfter
          };
        }
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false, error: 'Split button not found' };
      }
    }
  });
});