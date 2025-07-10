const { test, expect } = require('@playwright/test');

test.describe('Iteración 13 - Corregir problema persistente', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 13: Limpieza mejorada con patrones genéricos', async ({ page }) => {
    console.log('\n=== ITERACIÓN 13: LIMPIEZA MEJORADA CON PATRONES GENÉRICOS ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 13 - Patrones Genéricos');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute commands
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute command in second panel
        await page.keyboard.type('pwd');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter13-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 PROBANDO LIMPIEZA MEJORADA...');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter13-after-refresh.png', 
          fullPage: true 
        });
        
        // Check for the exact problem pattern
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 VERIFICAR LIMPIEZA MEJORADA:');
        let duplicateFound = false;
        let exactPatternFound = false;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\nTerminal ${i + 1}:`);
          console.log(`Contenido: "${content}"`);
          
          // Buscar el patrón exacto del problema
          const exactPattern = /(\w+@[\w-]+)-(\1@[\w-]+:~\$)/;
          if (exactPattern.test(content)) {
            exactPatternFound = true;
            duplicateFound = true;
            const match = content.match(exactPattern);
            console.log(`❌ PATRÓN EXACTO ENCONTRADO: "${match[0]}"`);
          }
          
          // Buscar cualquier duplicación
          const genericPattern = /(\w+)@([\w-]+).*\1@\2/;
          if (!exactPatternFound && genericPattern.test(content)) {
            duplicateFound = true;
            console.log(`❌ DUPLICACIÓN GENÉRICA ENCONTRADA`);
          }
          
          // Contar prompts
          const prompts = (content.match(/\w+@[\w-]+:~\$/g) || []);
          console.log(`Prompts encontrados: ${prompts.length}`);
          prompts.forEach((prompt, idx) => {
            console.log(`  ${idx + 1}: "${prompt}"`);
          });
          
          if (!duplicateFound) {
            console.log(`✅ SIN DUPLICADOS en terminal ${i + 1}`);
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 13:');
        if (duplicateFound) {
          console.log('❌ LIMPIEZA MEJORADA NO FUNCIONÓ COMPLETAMENTE');
          console.log('🔧 NECESITA: Iteración 14 con enfoque diferente');
        } else {
          console.log('✅ LIMPIEZA MEJORADA EXITOSA');
          console.log('🎉 PROBLEMA RESUELTO CON PATRONES GENÉRICOS');
        }
        
        return { 
          success: !duplicateFound, 
          duplicateFound: duplicateFound,
          exactPatternFound: exactPatternFound,
          approach: 'improved-generic-patterns'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});