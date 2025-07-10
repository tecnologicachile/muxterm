const { test, expect } = require('@playwright/test');

test.describe('Validación Final Exhaustiva', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Validación exhaustiva: 10 refreshes con split horizontal', async ({ page }) => {
    console.log('\n=== VALIDACIÓN FINAL EXHAUSTIVA ===');
    console.log('🎯 OBJETIVO: Validar 10 refreshes consecutivos sin duplicación');
    
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
      await page.fill('input[type="text"]', 'Validación Final Exhaustiva');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute initial commands
      await page.keyboard.type('ls -la');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      await page.keyboard.type('pwd');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute commands in second panel
        await page.keyboard.type('whoami');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // Take initial screenshot
        await page.screenshot({ 
          path: 'tests/screenshots/final-validation-initial.png', 
          fullPage: true 
        });
        
        let totalDuplicates = 0;
        let successfulRefreshes = 0;
        
        // Perform 10 consecutive refreshes
        for (let refresh = 1; refresh <= 10; refresh++) {
          console.log(`\n🔄 REFRESH ${refresh}/10...`);
          
          // Refresh page
          await page.reload();
          await page.waitForTimeout(3000);
          
          // Take screenshot after refresh
          await page.screenshot({ 
            path: `tests/screenshots/final-validation-refresh-${refresh}.png`, 
            fullPage: true 
          });
          
          // Check for duplicates
          const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
          let duplicatesInThisRefresh = 0;
          
          for (let i = 0; i < terminalsAfter.length; i++) {
            const content = terminalsAfter[i];
            
            // Check for the exact duplication pattern
            const duplicatePattern = /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g;
            let match;
            
            while ((match = duplicatePattern.exec(content)) !== null) {
              const firstUser = match[1].split('@')[0];
              const secondUser = match[2].split('@')[0];
              
              if (firstUser === secondUser) {
                duplicatesInThisRefresh++;
                totalDuplicates++;
                console.log(`❌ DUPLICADO en refresh ${refresh}, terminal ${i+1}: "${match[0]}"`);
              }
            }
          }
          
          if (duplicatesInThisRefresh === 0) {
            successfulRefreshes++;
            console.log(`✅ Refresh ${refresh}: SIN DUPLICADOS`);
          } else {
            console.log(`❌ Refresh ${refresh}: ${duplicatesInThisRefresh} DUPLICADOS`);
          }
          
          // Add small delay between refreshes
          await page.waitForTimeout(500);
        }
        
        // Final assessment
        console.log('\n📊 RESULTADO FINAL DE VALIDACIÓN EXHAUSTIVA:');
        console.log(`🔢 Total refreshes realizados: 10`);
        console.log(`✅ Refreshes exitosos (sin duplicados): ${successfulRefreshes}`);
        console.log(`❌ Refreshes con duplicados: ${10 - successfulRefreshes}`);
        console.log(`🐛 Total duplicados encontrados: ${totalDuplicates}`);
        
        const successRate = (successfulRefreshes / 10) * 100;
        console.log(`📈 Tasa de éxito: ${successRate}%`);
        
        if (totalDuplicates === 0) {
          console.log('\n🎉 ¡VALIDACIÓN COMPLETAMENTE EXITOSA!');
          console.log('✅ PROBLEMA DE DUPLICACIÓN COMPLETAMENTE RESUELTO');
          console.log('✅ 10/10 refreshes pasaron sin duplicación');
          console.log('✅ La limpieza agresiva está funcionando perfectamente');
        } else {
          console.log('\n❌ VALIDACIÓN FALLIDA');
          console.log(`🔧 Se encontraron ${totalDuplicates} duplicados en ${10 - successfulRefreshes} refreshes`);
          console.log('🔧 La solución necesita más trabajo');
        }
        
        // Take final screenshot
        await page.screenshot({ 
          path: 'tests/screenshots/final-validation-complete.png', 
          fullPage: true 
        });
        
        return { 
          success: totalDuplicates === 0, 
          totalDuplicates: totalDuplicates,
          successfulRefreshes: successfulRefreshes,
          successRate: successRate,
          totalRefreshes: 10
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});