const { test, expect } = require('@playwright/test');

test.describe('Iteración 15 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 15: Limpieza exhaustiva antes de devolver', async ({ page }) => {
    console.log('\n=== ITERACIÓN 15: LIMPIEZA EXHAUSTIVA ANTES DE DEVOLVER ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 15 - Limpieza Exhaustiva');
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
          path: 'tests/screenshots/iter15-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 PROBANDO LIMPIEZA EXHAUSTIVA...');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter15-after-refresh.png', 
          fullPage: true 
        });
        
        // Check results
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 VERIFICAR LIMPIEZA EXHAUSTIVA:');
        let problemFound = false;
        let cleanTerminals = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\nTerminal ${i + 1}:`);
          console.log(`Contenido: "${content}"`);
          
          // Verificar patrones de duplicación
          const duplicatePatterns = [
            /(\w+)@([\w-]+)-\1@\2(:~\$)/,  // user@host-user@host:~$
            /(\w+)@([\w-]+).*\1@\2.*:~\$/,  // user@host...user@host...:~$
            /(\w+@[\w-]+:~\$).*\1/          // prompt duplicado
          ];
          
          let hasDuplicate = false;
          duplicatePatterns.forEach((pattern, idx) => {
            if (pattern.test(content)) {
              hasDuplicate = true;
              problemFound = true;
              const match = content.match(pattern);
              console.log(`❌ PATRÓN ${idx+1} ENCONTRADO: "${match[0]}"`);
            }
          });
          
          // Contar prompts
          const prompts = (content.match(/\w+@[\w-]+:~\$/g) || []);
          console.log(`Prompts totales: ${prompts.length}`);
          
          // Verificar si está limpio
          if (!hasDuplicate) {
            if ((i === 0 && prompts.length <= 2) || (i === 1 && prompts.length === 1)) {
              cleanTerminals++;
              console.log(`✅ Terminal ${i + 1}: LIMPIO`);
            }
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 15:');
        console.log(`Terminales limpios: ${cleanTerminals}/${terminalsAfter.length}`);
        
        if (problemFound) {
          console.log('❌ LIMPIEZA EXHAUSTIVA NO RESOLVIÓ EL PROBLEMA');
          console.log('🔧 NECESITA: Iteración 16 con estrategia diferente');
        } else {
          console.log('✅ LIMPIEZA EXHAUSTIVA EXITOSA');
          console.log('🎉 TODOS LOS TERMINALES ESTÁN LIMPIOS');
        }
        
        return { 
          success: !problemFound, 
          problemFound: problemFound,
          cleanTerminals: cleanTerminals,
          totalTerminals: terminalsAfter.length,
          approach: 'exhaustive-cleaning'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});