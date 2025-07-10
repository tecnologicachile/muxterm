const { test, expect } = require('@playwright/test');

test.describe('Iteración 10 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 10: Aplicar limpieza en tiempo real', async ({ page }) => {
    console.log('\n=== ITERACIÓN 10: APLICAR LIMPIEZA EN TIEMPO REAL ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 10 - Limpieza Tiempo Real');
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
          path: 'tests/screenshots/iter10-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 PROBANDO LIMPIEZA EN TIEMPO REAL...');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter10-after-refresh.png', 
          fullPage: true 
        });
        
        // Check if real-time cleaning worked
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 VERIFICAR LIMPIEZA EN TIEMPO REAL:');
        let duplicateFound = false;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\nTerminal ${i + 1}:`);
          console.log(`"${content.substring(0, 200)}..."`);
          
          // Check for duplicates
          const duplicatePattern = /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g;
          const duplicates = [];
          let match;
          
          while ((match = duplicatePattern.exec(content)) !== null) {
            const firstUser = match[1].split('@')[0];
            const secondUser = match[2].split('@')[0];
            
            if (firstUser === secondUser) {
              duplicateFound = true;
              duplicates.push(match[0]);
            }
          }
          
          if (duplicates.length > 0) {
            console.log(`❌ DUPLICADOS ENCONTRADOS: ${duplicates.length}`);
            duplicates.forEach((dup, idx) => {
              console.log(`   ${idx + 1}: "${dup}"`);
            });
          } else {
            console.log(`✅ SIN DUPLICADOS`);
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 10:');
        if (duplicateFound) {
          console.log('❌ LIMPIEZA EN TIEMPO REAL NO FUNCIONÓ');
          console.log('🔧 NECESITA: Más iteraciones o enfoque diferente');
        } else {
          console.log('✅ LIMPIEZA EN TIEMPO REAL EXITOSA');
          console.log('🎉 PROBLEMA RESUELTO DEFINITIVAMENTE');
        }
        
        return { 
          success: !duplicateFound, 
          duplicateFound: duplicateFound,
          approach: 'realtime-cleaning'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});