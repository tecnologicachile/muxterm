const { test, expect } = require('@playwright/test');

test.describe('Iteración 6 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 6: Enfoque simple y directo', async ({ page }) => {
    console.log('\n=== ITERACIÓN 6: ENFOQUE SIMPLE Y DIRECTO ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 6 - Simple Direct');
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
          path: 'tests/screenshots/iter6-before-refresh.png', 
          fullPage: true 
        });
        
        // Refresh page
        console.log('\n🔄 ACTUALIZANDO PÁGINA CON ENFOQUE SIMPLE...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter6-after-refresh.png', 
          fullPage: true 
        });
        
        // Check if simple approach worked
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 VERIFICAR ENFOQUE SIMPLE - ITERACIÓN 6:');
        let duplicateFound = false;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\nTerminal ${i + 1} content (first 250 chars):`);
          console.log(`"${content.substring(0, 250)}..."`);
          
          // Check for the exact duplicate pattern
          const duplicatePattern = /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g;
          const duplicateMatches = [];
          let match;
          
          while ((match = duplicatePattern.exec(content)) !== null) {
            const firstPart = match[1];
            const secondPart = match[2];
            
            if (firstPart.includes('@') && secondPart.includes('@')) {
              const firstUser = firstPart.split('@')[0];
              const secondUser = secondPart.split('@')[0];
              
              if (firstUser === secondUser) {
                duplicateFound = true;
                duplicateMatches.push({
                  full: match[0],
                  first: firstPart,
                  second: secondPart
                });
              }
            }
          }
          
          if (duplicateMatches.length > 0) {
            console.log(`❌ DUPLICACIÓN PERSISTENTE en Terminal ${i + 1}:`);
            duplicateMatches.forEach((dup, idx) => {
              console.log(`   ${idx + 1}. "${dup.full}"`);
              console.log(`      Should be: "${dup.second}"`);
            });
          } else {
            console.log(`✅ SIN duplicación en Terminal ${i + 1}`);
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 6:');
        if (duplicateFound) {
          console.log('❌ PROBLEMA PERSISTE - Enfoque simple no funcionó');
          console.log('🔧 NECESITA: Verificar si el código se ejecuta en el servidor');
        } else {
          console.log('✅ PROBLEMA RESUELTO - Enfoque simple exitoso');
        }
        
        return { 
          success: !duplicateFound, 
          duplicateFound: duplicateFound,
          approach: 'simple-direct'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});