const { test, expect } = require('@playwright/test');

test.describe('Iteración 16 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 16: Análisis y limpieza profunda', async ({ page }) => {
    console.log('\n=== ITERACIÓN 16: ANÁLISIS Y LIMPIEZA PROFUNDA ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 16 - Limpieza Profunda');
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
          path: 'tests/screenshots/iter16-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 PROBANDO ANÁLISIS Y LIMPIEZA PROFUNDA...');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter16-after-refresh.png', 
          fullPage: true 
        });
        
        // Detailed analysis
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 ANÁLISIS DETALLADO POST-REFRESH:');
        let allClean = true;
        let detailedResults = [];
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          const terminalResult = {
            index: i + 1,
            content: content,
            prompts: [],
            hasDuplicate: false,
            duplicateType: null
          };
          
          console.log(`\n🖥️ Terminal ${i + 1}:`);
          console.log(`Longitud: ${content.length} caracteres`);
          
          // Extraer todos los prompts
          const prompts = content.match(/\w+@[\w-]+:~\$/g) || [];
          terminalResult.prompts = prompts;
          console.log(`Prompts encontrados: ${prompts.length}`);
          prompts.forEach((prompt, idx) => {
            console.log(`  ${idx + 1}: "${prompt}"`);
          });
          
          // Verificar duplicación exacta
          const exactDuplicate = /(\w+@[\w-]+)-\1@[\w-]+:~\$/;
          if (exactDuplicate.test(content)) {
            terminalResult.hasDuplicate = true;
            terminalResult.duplicateType = 'exact';
            allClean = false;
            const match = content.match(exactDuplicate);
            console.log(`❌ DUPLICACIÓN EXACTA: "${match[0]}"`);
          }
          
          // Verificar duplicación sin guión
          const variantDuplicate = /(\w+@[\w-]+)\1@[\w-]+:~\$/;
          if (!terminalResult.hasDuplicate && variantDuplicate.test(content)) {
            terminalResult.hasDuplicate = true;
            terminalResult.duplicateType = 'variant';
            allClean = false;
            const match = content.match(variantDuplicate);
            console.log(`❌ DUPLICACIÓN VARIANTE: "${match[0]}"`);
          }
          
          // Verificar duplicación amplia
          const broadDuplicate = /(\w+)@([\w-]+).*\1@\2/;
          if (!terminalResult.hasDuplicate && broadDuplicate.test(content)) {
            terminalResult.hasDuplicate = true;
            terminalResult.duplicateType = 'broad';
            allClean = false;
            console.log(`❌ DUPLICACIÓN AMPLIA DETECTADA`);
          }
          
          if (!terminalResult.hasDuplicate) {
            console.log(`✅ Terminal ${i + 1}: SIN DUPLICACIÓN`);
          }
          
          detailedResults.push(terminalResult);
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 16:');
        console.log(`Total de terminales: ${terminalsAfter.length}`);
        console.log(`Terminales con duplicación: ${detailedResults.filter(r => r.hasDuplicate).length}`);
        console.log(`Terminales limpios: ${detailedResults.filter(r => !r.hasDuplicate).length}`);
        
        if (allClean) {
          console.log('✅ ANÁLISIS Y LIMPIEZA PROFUNDA EXITOSA');
          console.log('🎉 PROBLEMA COMPLETAMENTE RESUELTO');
        } else {
          console.log('❌ AÚN HAY DUPLICACIÓN');
          console.log('🔧 NECESITA: Iteración 17 con enfoque más radical');
          
          // Mostrar resumen de problemas
          detailedResults.filter(r => r.hasDuplicate).forEach(r => {
            console.log(`  Terminal ${r.index}: ${r.duplicateType} duplication`);
          });
        }
        
        return { 
          success: allClean, 
          totalTerminals: terminalsAfter.length,
          cleanTerminals: detailedResults.filter(r => !r.hasDuplicate).length,
          detailedResults: detailedResults,
          approach: 'deep-analysis-cleaning'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});