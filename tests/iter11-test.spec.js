const { test, expect } = require('@playwright/test');

test.describe('Iteración 11 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 11: Limpieza agresiva antes de restaurar', async ({ page }) => {
    console.log('\n=== ITERACIÓN 11: LIMPIEZA AGRESIVA ANTES DE RESTAURAR ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 11 - Limpieza Agresiva');
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
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter11-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 PROBANDO LIMPIEZA AGRESIVA...');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter11-after-refresh.png', 
          fullPage: true 
        });
        
        // Check if aggressive cleaning worked
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 VERIFICAR LIMPIEZA AGRESIVA:');
        let duplicateFound = false;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\nTerminal ${i + 1}:`);
          console.log(`"${content.substring(0, 200)}..."`);
          
          // Check for duplicates with multiple patterns
          const patterns = [
            /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g,
            /(\w+@[^@\s]*?)\s+(\w+@[^$]*\$)/g,
            /(\w+@[^@\s]*?)[^\w@]*(\w+@[^$]*\$)/g
          ];
          
          patterns.forEach((pattern, patternIdx) => {
            pattern.lastIndex = 0;
            let match;
            
            while ((match = pattern.exec(content)) !== null) {
              const firstUser = match[1].split('@')[0];
              const secondUser = match[2].split('@')[0];
              
              if (firstUser === secondUser) {
                duplicateFound = true;
                console.log(`❌ DUPLICADO ENCONTRADO (patrón ${patternIdx + 1}): "${match[0]}"`);
              }
            }
          });
          
          if (!duplicateFound) {
            console.log(`✅ SIN DUPLICADOS en terminal ${i + 1}`);
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 11:');
        if (duplicateFound) {
          console.log('❌ LIMPIEZA AGRESIVA NO FUNCIONÓ');
          console.log('🔧 NECESITA: Iteración 12 con enfoque diferente');
        } else {
          console.log('✅ LIMPIEZA AGRESIVA EXITOSA');
          console.log('🎉 PROBLEMA RESUELTO CON LIMPIEZA AGRESIVA');
        }
        
        return { 
          success: !duplicateFound, 
          duplicateFound: duplicateFound,
          approach: 'aggressive-cleaning'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});