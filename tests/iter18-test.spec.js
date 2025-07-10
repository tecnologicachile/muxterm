const { test, expect } = require('@playwright/test');

test.describe('Iteración 18 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 18: Limpieza específica para Terminal 2', async ({ page }) => {
    console.log('\n=== ITERACIÓN 18: LIMPIEZA ESPECÍFICA PARA TERMINAL 2 ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 18 - Terminal 2 Fix');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute commands
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        await page.keyboard.type('pwd');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter18-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 PROBANDO LIMPIEZA ESPECÍFICA TERMINAL 2...');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter18-after-refresh.png', 
          fullPage: true 
        });
        
        // Focused analysis on Terminal 2
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 ANÁLISIS ENFOCADO EN TERMINAL 2:');
        let allClean = true;
        let terminalResults = [];
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          const result = {
            index: i + 1,
            clean: true,
            content: content,
            length: content.length
          };
          
          console.log(`\n🖥️ Terminal ${i + 1}:`);
          console.log(`📏 Longitud: ${content.length} caracteres`);
          
          // Verificar el patrón específico del Terminal 2
          const terminal2Pattern = /^(\w+@[\w-]+)-\1@[\w-]+:~\$/;
          if (terminal2Pattern.test(content)) {
            result.clean = false;
            allClean = false;
            console.log(`❌ PATRÓN TERMINAL 2 ENCONTRADO: "${content}"`);
          }
          
          // Verificar cualquier duplicación
          const duplicatePattern = /(\w+)@([\w-]+).*\1@\2/;
          if (result.clean && duplicatePattern.test(content)) {
            result.clean = false;
            allClean = false;
            const match = content.match(duplicatePattern);
            console.log(`❌ DUPLICACIÓN GENÉRICA: "${match[0]}"`);
          }
          
          // Si es el Terminal 2 y es corto, verificar contenido exacto
          if (i === 1 && content.length < 100) {
            console.log(`📝 Contenido Terminal 2: "${content}"`);
            
            // El Terminal 2 debe tener solo un prompt
            const prompts = content.match(/\w+@[\w-]+:~\$/g) || [];
            if (prompts.length > 1) {
              result.clean = false;
              allClean = false;
              console.log(`❌ Terminal 2 tiene ${prompts.length} prompts (esperado: 1)`);
            } else if (prompts.length === 1) {
              console.log(`✅ Terminal 2 tiene exactamente 1 prompt: "${prompts[0]}"`);
            }
          }
          
          if (result.clean) {
            console.log(`✅ Terminal ${i + 1}: LIMPIO`);
          }
          
          terminalResults.push(result);
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 18:');
        console.log(`Terminales analizados: ${terminalsAfter.length}`);
        console.log(`Terminales limpios: ${terminalResults.filter(r => r.clean).length}`);
        
        // Verificación específica del Terminal 2
        if (terminalResults.length > 1) {
          const terminal2 = terminalResults[1];
          console.log(`\n🎯 Estado Terminal 2: ${terminal2.clean ? 'LIMPIO' : 'CON PROBLEMAS'}`);
          console.log(`   Longitud: ${terminal2.length} caracteres`);
        }
        
        if (allClean) {
          console.log('\n✅ LIMPIEZA ESPECÍFICA TERMINAL 2 EXITOSA');
          console.log('🎉 TODOS LOS TERMINALES ESTÁN LIMPIOS');
        } else {
          console.log('\n❌ AÚN HAY PROBLEMAS');
          console.log('🔧 NECESITA: Iteración 19');
        }
        
        return { 
          success: allClean, 
          terminalResults: terminalResults,
          terminal2Clean: terminalResults.length > 1 ? terminalResults[1].clean : false,
          approach: 'terminal2-specific-cleaning'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});