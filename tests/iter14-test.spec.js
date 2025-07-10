const { test, expect } = require('@playwright/test');

test.describe('Iteración 14 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 14: Limpieza inmediata mejorada', async ({ page }) => {
    console.log('\n=== ITERACIÓN 14: LIMPIEZA INMEDIATA MEJORADA ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 14 - Limpieza Inmediata');
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
          path: 'tests/screenshots/iter14-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 PROBANDO LIMPIEZA INMEDIATA MEJORADA...');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter14-after-refresh.png', 
          fullPage: true 
        });
        
        // Check results
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 VERIFICAR LIMPIEZA INMEDIATA:');
        let duplicateFound = false;
        let exactProblemFound = false;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\nTerminal ${i + 1}:`);
          console.log(`Contenido completo: "${content}"`);
          
          // Buscar el patrón exacto del problema
          const exactPattern = /usuario@usuario-Standard-PC-i440FX-PIIX-usuario@usuario-Standard-PC-i440FX-PIIX-1996:~\$/;
          if (exactPattern.test(content)) {
            exactProblemFound = true;
            duplicateFound = true;
            console.log(`❌ PATRÓN EXACTO DEL PROBLEMA ENCONTRADO`);
          }
          
          // Buscar cualquier tipo de duplicación
          const genericDuplication = /(\w+)@([\w-]+).*\1@\2/;
          if (!exactProblemFound && genericDuplication.test(content)) {
            duplicateFound = true;
            console.log(`❌ DUPLICACIÓN GENÉRICA ENCONTRADA`);
          }
          
          // Contar y mostrar prompts
          const prompts = (content.match(/\w+@[\w-]+:~\$/g) || []);
          console.log(`Prompts encontrados: ${prompts.length}`);
          prompts.forEach((prompt, idx) => {
            console.log(`  ${idx + 1}: "${prompt}"`);
          });
          
          if (!duplicateFound || (i === 0 && prompts.length === 2) || (i === 1 && prompts.length === 1)) {
            console.log(`✅ Terminal ${i + 1}: Parece estar limpio`);
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 14:');
        if (duplicateFound) {
          console.log('❌ LIMPIEZA INMEDIATA NO FUNCIONÓ COMPLETAMENTE');
          console.log('🔧 NECESITA: Iteración 15 con otro enfoque');
        } else {
          console.log('✅ LIMPIEZA INMEDIATA EXITOSA');
          console.log('🎉 PROBLEMA RESUELTO CON LIMPIEZA INMEDIATA');
        }
        
        return { 
          success: !duplicateFound, 
          duplicateFound: duplicateFound,
          exactProblemFound: exactProblemFound,
          approach: 'immediate-cleaning'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});