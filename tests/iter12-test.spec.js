const { test, expect } = require('@playwright/test');

test.describe('Iteración 12 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 12: Limpieza específica para segundo terminal', async ({ page }) => {
    console.log('\n=== ITERACIÓN 12: LIMPIEZA ESPECÍFICA PARA SEGUNDO TERMINAL ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 12 - Segundo Terminal');
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
        
        console.log('\n🔍 ENFOQUE ESPECÍFICO EN SEGUNDO TERMINAL');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter12-before-refresh.png', 
          fullPage: true 
        });
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter12-after-refresh.png', 
          fullPage: true 
        });
        
        // Check specifically for second terminal issues
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 VERIFICAR LIMPIEZA ESPECÍFICA SEGUNDO TERMINAL:');
        let duplicateFound = false;
        let secondTerminalFixed = true;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\nTerminal ${i + 1}:`);
          console.log(`"${content.substring(0, 200)}..."`);
          
          // Verificar específicamente el patrón del segundo terminal
          const secondTerminalPattern = /(\w+@[^@\s]*?-\w+@[^$]*\$)/g;
          const secondTerminalMatches = [];
          let match;
          
          while ((match = secondTerminalPattern.exec(content)) !== null) {
            secondTerminalMatches.push(match[0]);
            duplicateFound = true;
            secondTerminalFixed = false;
          }
          
          if (secondTerminalMatches.length > 0) {
            console.log(`❌ PATRÓN SEGUNDO TERMINAL ENCONTRADO: ${secondTerminalMatches.length} instancias`);
            secondTerminalMatches.forEach((m, idx) => {
              console.log(`   ${idx + 1}: "${m}"`);
            });
          }
          
          // Verificar también el patrón general
          const generalPattern = /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g;
          const generalMatches = [];
          
          generalPattern.lastIndex = 0;
          while ((match = generalPattern.exec(content)) !== null) {
            const firstUser = match[1].split('@')[0];
            const secondUser = match[2].split('@')[0];
            
            if (firstUser === secondUser) {
              generalMatches.push(match[0]);
              duplicateFound = true;
            }
          }
          
          if (generalMatches.length > 0) {
            console.log(`❌ PATRÓN GENERAL ENCONTRADO: ${generalMatches.length} instancias`);
            generalMatches.forEach((m, idx) => {
              console.log(`   ${idx + 1}: "${m}"`);
            });
          }
          
          if (secondTerminalMatches.length === 0 && generalMatches.length === 0) {
            console.log(`✅ Terminal ${i + 1}: SIN DUPLICADOS`);
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 12:');
        if (duplicateFound) {
          console.log('❌ LIMPIEZA ESPECÍFICA SEGUNDO TERMINAL NO FUNCIONÓ');
          console.log('🔧 NECESITA: Iteración 13 con enfoque diferente');
        } else {
          console.log('✅ LIMPIEZA ESPECÍFICA SEGUNDO TERMINAL EXITOSA');
          console.log('🎉 PROBLEMA RESUELTO CON ENFOQUE ESPECÍFICO');
        }
        
        return { 
          success: !duplicateFound, 
          duplicateFound: duplicateFound,
          secondTerminalFixed: secondTerminalFixed,
          approach: 'second-terminal-specific'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});