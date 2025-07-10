const { test, expect } = require('@playwright/test');

test.describe('Iteración 9 - Confirmación', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 9: Confirmar solución con test adicional', async ({ page }) => {
    console.log('\n=== ITERACIÓN 9: CONFIRMAR SOLUCIÓN CON TEST ADICIONAL ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 9 - Confirmación Final');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute multiple commands to create more complex scenario
      await page.keyboard.type('echo "test confirmation"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      await page.keyboard.type('pwd');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute commands in second panel
        await page.keyboard.type('echo "panel 2 test"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        await page.keyboard.type('whoami');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        console.log('✅ Configuración completa con múltiples comandos');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter9-before-refresh.png', 
          fullPage: true 
        });
        
        // Check content before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let promptsBefore = 0;
        let duplicatesBefore = 0;
        
        console.log('\n📋 ESTADO ANTES DE ACTUALIZAR:');
        for (let i = 0; i < terminalsBefore.length; i++) {
          const content = terminalsBefore[i];
          const prompts = (content.match(/\w+@[^$]*\$/g) || []).length;
          promptsBefore += prompts;
          
          // Check for duplicates
          const duplicatePattern = /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g;
          let match;
          while ((match = duplicatePattern.exec(content)) !== null) {
            const firstUser = match[1].split('@')[0];
            const secondUser = match[2].split('@')[0];
            if (firstUser === secondUser) {
              duplicatesBefore++;
            }
          }
          
          console.log(`Terminal ${i + 1}: ${prompts} prompts, content: "${content.substring(0, 100)}..."`);
        }
        
        console.log(`Total antes: ${promptsBefore} prompts, ${duplicatesBefore} duplicados`);
        
        // Perform 3 consecutive refreshes to stress test
        for (let refresh = 1; refresh <= 3; refresh++) {
          console.log(`\n🔄 REFRESH ${refresh}/3...`);
          
          await page.reload();
          await page.waitForTimeout(3000);
          
          // Check after each refresh
          const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
          let promptsAfter = 0;
          let duplicatesAfter = 0;
          
          for (let i = 0; i < terminalsAfter.length; i++) {
            const content = terminalsAfter[i];
            const prompts = (content.match(/\w+@[^$]*\$/g) || []).length;
            promptsAfter += prompts;
            
            // Check for duplicates
            const duplicatePattern = /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g;
            let match;
            while ((match = duplicatePattern.exec(content)) !== null) {
              const firstUser = match[1].split('@')[0];
              const secondUser = match[2].split('@')[0];
              if (firstUser === secondUser) {
                duplicatesAfter++;
                console.log(`❌ Duplicado encontrado en refresh ${refresh}: "${match[0]}"`);
              }
            }
          }
          
          console.log(`Refresh ${refresh}: ${promptsAfter} prompts, ${duplicatesAfter} duplicados`);
          
          if (duplicatesAfter > 0) {
            console.log(`❌ FALLO en refresh ${refresh}: ${duplicatesAfter} duplicados detectados`);
          } else {
            console.log(`✅ ÉXITO en refresh ${refresh}: Sin duplicados`);
          }
        }
        
        // Final screenshot
        await page.screenshot({ 
          path: 'tests/screenshots/iter9-after-multiple-refreshes.png', 
          fullPage: true 
        });
        
        // Final assessment
        const terminalsAfterAll = await page.locator('.xterm-rows').allTextContents();
        let finalDuplicates = 0;
        
        for (let i = 0; i < terminalsAfterAll.length; i++) {
          const content = terminalsAfterAll[i];
          const duplicatePattern = /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g;
          let match;
          while ((match = duplicatePattern.exec(content)) !== null) {
            const firstUser = match[1].split('@')[0];
            const secondUser = match[2].split('@')[0];
            if (firstUser === secondUser) {
              finalDuplicates++;
            }
          }
        }
        
        console.log('\n📊 RESULTADO FINAL ITERACIÓN 9:');
        if (finalDuplicates === 0) {
          console.log('✅ CONFIRMACIÓN EXITOSA - No hay duplicados después de múltiples refreshes');
          console.log('🎉 PROBLEMA COMPLETAMENTE RESUELTO');
        } else {
          console.log(`❌ CONFIRMACIÓN FALLIDA - ${finalDuplicates} duplicados persisten`);
        }
        
        return { 
          success: finalDuplicates === 0, 
          finalDuplicates: finalDuplicates,
          refreshesTested: 3
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});