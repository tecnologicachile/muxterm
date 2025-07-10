const { test, expect } = require('@playwright/test');

test.describe('Iteración 3 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 3: Arreglar detección de duplicados', async ({ page }) => {
    console.log('\n=== ITERACIÓN 3: ARREGLAR DETECCIÓN DE DUPLICADOS ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 3 - Arreglar Detección');
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
          path: 'tests/screenshots/iter3-before-refresh.png', 
          fullPage: true 
        });
        
        // Refresh page
        console.log('\n🔄 ACTUALIZANDO PÁGINA...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter3-after-refresh.png', 
          fullPage: true 
        });
        
        // Check for the EXACT problem user reported
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 BUSCAR PATRÓN EXACTO DEL USUARIO:');
        let problemFound = false;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          console.log(`\nTerminal ${i + 1} content (first 200 chars):`);
          console.log(`"${content.substring(0, 200)}..."`);
          
          // Look for the exact pattern the user showed:
          // "usuario@usuario-Standard-PC-i440FX-PIIX-usuario@usuario-Standard-PC-i440FX-PIIX-1996:~$"
          const userPattern = /(\w+@[^@\s]*?)(\w+@[^$]*\$)/g;
          const matches = [];
          let match;
          
          while ((match = userPattern.exec(content)) !== null) {
            const firstPart = match[1];
            const secondPart = match[2];
            
            console.log(`Found potential duplicate: "${match[0]}"`);
            console.log(`  First part: "${firstPart}"`);
            console.log(`  Second part: "${secondPart}"`);
            
            // Check if same user
            if (firstPart.includes('@') && secondPart.includes('@')) {
              const firstUser = firstPart.split('@')[0];
              const secondUser = secondPart.split('@')[0];
              
              if (firstUser === secondUser) {
                problemFound = true;
                console.log(`  ❌ DUPLICACIÓN CONFIRMADA: "${firstUser}" aparece duplicado`);
                matches.push(match[0]);
              }
            }
          }
          
          if (matches.length > 0) {
            console.log(`❌ Terminal ${i + 1} tiene ${matches.length} duplicaciones:`);
            matches.forEach((m, idx) => {
              console.log(`   ${idx + 1}: "${m}"`);
            });
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 3:');
        if (problemFound) {
          console.log('❌ PROBLEMA PERSISTE - La detección aún no funciona correctamente');
        } else {
          console.log('✅ PROBLEMA RESUELTO - Detección arreglada exitosamente');
        }
        
        return { success: !problemFound, problemFound };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});