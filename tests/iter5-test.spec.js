const { test, expect } = require('@playwright/test');

test.describe('Iteración 5 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 5: Verificar buffer assignment', async ({ page }) => {
    console.log('\n=== ITERACIÓN 5: VERIFICAR BUFFER ASSIGNMENT ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 5 - Buffer Assignment');
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
          path: 'tests/screenshots/iter5-before-refresh.png', 
          fullPage: true 
        });
        
        // Refresh page
        console.log('\n🔄 ACTUALIZANDO PÁGINA PARA ITERACIÓN 5...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter5-after-refresh.png', 
          fullPage: true 
        });
        
        // Check if cleanup is working
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 VERIFICAR BUFFER ASSIGNMENT - ITERACIÓN 5:');
        let duplicateFound = false;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\nTerminal ${i + 1} full content:`);
          console.log(`"${content}"`);
          
          // Check for the exact problem pattern
          const problemPattern = /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g;
          const problemMatches = [];
          let problemMatch;
          
          while ((problemMatch = problemPattern.exec(content)) !== null) {
            const firstPart = problemMatch[1];
            const secondPart = problemMatch[2];
            
            if (firstPart.includes('@') && secondPart.includes('@')) {
              const firstUser = firstPart.split('@')[0];
              const secondUser = secondPart.split('@')[0];
              
              if (firstUser === secondUser) {
                duplicateFound = true;
                problemMatches.push({
                  full: problemMatch[0],
                  first: firstPart,
                  second: secondPart,
                  users: `${firstUser} vs ${secondUser}`
                });
              }
            }
          }
          
          if (problemMatches.length > 0) {
            console.log(`❌ DUPLICACIÓN ENCONTRADA en Terminal ${i + 1}:`);
            problemMatches.forEach((match, idx) => {
              console.log(`   ${idx + 1}. Full match: "${match.full}"`);
              console.log(`      First part: "${match.first}"`);
              console.log(`      Second part: "${match.second}"`);
              console.log(`      Users: ${match.users}`);
            });
          } else {
            console.log(`✅ NO duplicación en Terminal ${i + 1}`);
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 5:');
        if (duplicateFound) {
          console.log('❌ PROBLEMA PERSISTE - Buffer assignment no funciona');
          console.log('🔧 CAUSA: El algoritmo de limpieza no se está ejecutando o aplicando correctamente');
        } else {
          console.log('✅ PROBLEMA RESUELTO - Buffer assignment correcto');
        }
        
        return { 
          success: !duplicateFound, 
          duplicateFound: duplicateFound,
          terminalsChecked: terminalsAfter.length 
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});