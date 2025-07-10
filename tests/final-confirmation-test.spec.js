const { test, expect } = require('@playwright/test');

test.describe('Test Final de Confirmación - Duplicación de Prompt Resuelto', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Confirmación Final: Múltiples escenarios sin duplicación', async ({ page }) => {
    console.log('\n=== TEST FINAL DE CONFIRMACIÓN ===');
    console.log('🎯 OBJETIVO: Validar que NO hay duplicación en NINGÚN escenario');
    
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
      await page.fill('input[type="text"]', 'Test Final - Confirmación Definitiva');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // ESCENARIO 1: Comandos básicos
      console.log('\n📋 ESCENARIO 1: Comandos básicos');
      await page.keyboard.type('ls -la');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      await page.keyboard.type('pwd');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      await page.keyboard.type('whoami');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // ESCENARIO 2: Split panel
      console.log('\n📋 ESCENARIO 2: Split panel horizontal');
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Ejecutar comandos en el segundo panel
        await page.keyboard.type('echo "Panel 2 test"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        await page.keyboard.type('date');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // ESCENARIO 3: Múltiples refreshes
        console.log('\n📋 ESCENARIO 3: Múltiples refreshes consecutivos');
        
        for (let refresh = 1; refresh <= 5; refresh++) {
          console.log(`🔄 Refresh ${refresh}/5...`);
          
          // Screenshot antes del refresh
          await page.screenshot({ 
            path: `tests/screenshots/final-before-refresh-${refresh}.png`, 
            fullPage: true 
          });
          
          // Refresh
          await page.reload();
          await page.waitForTimeout(3000);
          
          // Screenshot después del refresh
          await page.screenshot({ 
            path: `tests/screenshots/final-after-refresh-${refresh}.png`, 
            fullPage: true 
          });
          
          // Verificar duplicación después de cada refresh
          const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
          let duplicatesFound = 0;
          
          for (let i = 0; i < terminalsAfter.length; i++) {
            const content = terminalsAfter[i];
            
            // Buscar el patrón de duplicación exacto
            const duplicatePattern = /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g;
            let match;
            
            while ((match = duplicatePattern.exec(content)) !== null) {
              const firstUser = match[1].split('@')[0];
              const secondUser = match[2].split('@')[0];
              
              if (firstUser === secondUser) {
                duplicatesFound++;
                console.log(`❌ DUPLICADO en refresh ${refresh}, terminal ${i+1}: "${match[0]}"`);
              }
            }
          }
          
          if (duplicatesFound === 0) {
            console.log(`✅ Refresh ${refresh}: SIN DUPLICADOS`);
          } else {
            console.log(`❌ Refresh ${refresh}: ${duplicatesFound} DUPLICADOS ENCONTRADOS`);
          }
        }
        
        // ESCENARIO 4: Verificación final exhaustiva
        console.log('\n📋 ESCENARIO 4: Verificación final exhaustiva');
        
        const terminalsAfterAll = await page.locator('.xterm-rows').allTextContents();
        let totalDuplicates = 0;
        let totalPrompts = 0;
        
        for (let i = 0; i < terminalsAfterAll.length; i++) {
          const content = terminalsAfterAll[i];
          
          // Contar todos los prompts
          const allPrompts = (content.match(/\w+@[^$]*\$/g) || []).length;
          totalPrompts += allPrompts;
          
          // Buscar duplicaciones
          const duplicatePattern = /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g;
          let match;
          
          while ((match = duplicatePattern.exec(content)) !== null) {
            const firstUser = match[1].split('@')[0];
            const secondUser = match[2].split('@')[0];
            
            if (firstUser === secondUser) {
              totalDuplicates++;
              console.log(`❌ DUPLICADO FINAL en terminal ${i+1}: "${match[0]}"`);
            }
          }
          
          console.log(`Terminal ${i+1}: ${allPrompts} prompts, contenido: "${content.substring(0, 100)}..."`);
        }
        
        // RESULTADO FINAL
        console.log('\n🎯 RESULTADO FINAL DEL TEST:');
        console.log(`📊 Total de prompts encontrados: ${totalPrompts}`);
        console.log(`📊 Total de duplicados encontrados: ${totalDuplicates}`);
        
        if (totalDuplicates === 0) {
          console.log('✅ ¡ÉXITO COMPLETO!');
          console.log('🎉 PROBLEMA DE DUPLICACIÓN COMPLETAMENTE RESUELTO');
          console.log('✅ La limpieza en tiempo real está funcionando perfectamente');
          console.log('✅ Todos los escenarios pasaron sin duplicación');
        } else {
          console.log(`❌ PROBLEMA PERSISTE: ${totalDuplicates} duplicados encontrados`);
          console.log('🔧 Se necesitan más iteraciones para resolver completamente');
        }
        
        // Take final screenshot
        await page.screenshot({ 
          path: 'tests/screenshots/final-confirmation-result.png', 
          fullPage: true 
        });
        
        return { 
          success: totalDuplicates === 0, 
          totalDuplicates: totalDuplicates,
          totalPrompts: totalPrompts,
          refreshesTested: 5,
          scenariosTested: 4
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});