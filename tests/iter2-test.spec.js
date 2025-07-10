const { test, expect } = require('@playwright/test');

test.describe('Iteración 2 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 2: Validar corrección profunda', async ({ page }) => {
    console.log('\n=== ITERACIÓN 2: VALIDAR CORRECCIÓN PROFUNDA ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 2 - Fix Profundo');
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
          path: 'tests/screenshots/iter2-before-refresh.png', 
          fullPage: true 
        });
        
        // Refresh page
        console.log('\n🔄 ACTUALIZANDO PÁGINA...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter2-after-refresh.png', 
          fullPage: true 
        });
        
        // Check detailed content
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 ANÁLISIS DETALLADO ITERACIÓN 2:');
        let duplicateFound = false;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          console.log(`\nTerminal ${i + 1} content:`);
          console.log(`"${content}"`);
          
          // Check for exact pattern user reported
          const exactPattern = /(\w+@[^@\s]*)-(\w+@[^$]*\$)/g;
          const exactMatches = [];
          let exactMatch;
          
          while ((exactMatch = exactPattern.exec(content)) !== null) {
            exactMatches.push(exactMatch[0]);
          }
          
          if (exactMatches.length > 0) {
            duplicateFound = true;
            console.log(`❌ Found ${exactMatches.length} exact duplicate patterns:`);
            exactMatches.forEach((match, idx) => {
              console.log(`   ${idx + 1}: "${match}"`);
            });
          }
          
          // Check for alternative patterns
          const altPattern = /(\w+@[^@\s]*)\s*(\w+@[^$]*\$)/g;
          const altMatches = [];
          let altMatch;
          
          while ((altMatch = altPattern.exec(content)) !== null) {
            const firstPart = altMatch[1];
            const secondPart = altMatch[2];
            
            if (firstPart.includes('@') && secondPart.includes('@')) {
              const firstUser = firstPart.split('@')[0];
              const secondUser = secondPart.split('@')[0];
              
              if (firstUser === secondUser && firstPart !== secondPart) {
                altMatches.push(altMatch[0]);
              }
            }
          }
          
          if (altMatches.length > 0) {
            duplicateFound = true;
            console.log(`❌ Found ${altMatches.length} alternative duplicate patterns:`);
            altMatches.forEach((match, idx) => {
              console.log(`   ${idx + 1}: "${match}"`);
            });
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 2:');
        if (duplicateFound) {
          console.log('❌ PROBLEMA PERSISTE - Necesita iteración 3');
        } else {
          console.log('✅ PROBLEMA RESUELTO - Corrección profunda exitosa');
        }
        
        return { success: !duplicateFound, duplicateFound };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});