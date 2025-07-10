const { test, expect } = require('@playwright/test');

test.describe('Iteración 7 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 7: Verificar si el código se ejecuta en el servidor', async ({ page }) => {
    console.log('\n=== ITERACIÓN 7: VERIFICAR SI EL CÓDIGO SE EJECUTA EN EL SERVIDOR ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 7 - Verificar Ejecución');
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
          path: 'tests/screenshots/iter7-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 ACTUALIZANDO PÁGINA - VERIFICAR LOGS DEL SERVIDOR...');
        console.log('📝 Buscar en logs del servidor: [ITER7 CLEANUP]');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter7-after-refresh.png', 
          fullPage: true 
        });
        
        // Check if logs show execution
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 DESPUÉS DE ACTUALIZAR - VERIFICAR LOGS:');
        let duplicateFound = false;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\nTerminal ${i + 1}:`);
          console.log(`Content: "${content.substring(0, 200)}..."`);
          
          // Check for duplicate pattern
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
                duplicateFound = true;
                matches.push(match[0]);
              }
            }
          }
          
          if (matches.length > 0) {
            console.log(`❌ DUPLICACIÓN ENCONTRADA: ${matches.length} patrones`);
            matches.forEach((m, idx) => {
              console.log(`   ${idx + 1}: "${m}"`);
            });
          } else {
            console.log(`✅ SIN duplicación`);
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 7:');
        console.log('🔍 VERIFICAR LOGS DEL SERVIDOR PARA:');
        console.log('   - [ITER7 CLEANUP] ¡CÓDIGO SE EJECUTA!');
        console.log('   - [ITER7 CLEANUP] ¡ENCONTRADO!');
        console.log('   - [ITER7 CLEANUP] ¡REEMPLAZANDO!');
        console.log('   - [ITER7 CLEANUP] ¡COMPLETADO!');
        
        if (duplicateFound) {
          console.log('❌ PROBLEMA PERSISTE - Verificar logs del servidor');
        } else {
          console.log('✅ PROBLEMA RESUELTO - Logs deberían mostrar ejecución');
        }
        
        return { 
          success: !duplicateFound, 
          duplicateFound: duplicateFound,
          needsServerLogCheck: true
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});