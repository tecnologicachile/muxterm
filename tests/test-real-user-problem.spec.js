const { test, expect } = require('@playwright/test');

test.describe('Test Real User Problem', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Test exacto del problema del usuario', async ({ page }) => {
    console.log('\n=== TEST EXACTO DEL PROBLEMA DEL USUARIO ===');
    
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
      await page.fill('input[type="text"]', 'Test Real User Problem');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute exact command from user
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        console.log('✅ Creado panel horizontal como el usuario');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/real-problem-before.png', 
          fullPage: true 
        });
        
        // Check exact content before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 CONTENIDO ANTES DE ACTUALIZAR:');
        for (let i = 0; i < terminalsBefore.length; i++) {
          const content = terminalsBefore[i];
          console.log(`Terminal ${i + 1}:`);
          console.log(content);
          console.log('---');
          
          // Check for the exact pattern user reported
          const hasIncompletePrompt = content.includes('usuario@usuario-Standard-PC-i440FX-PIIX-');
          const hasCompletePrompt = content.includes('usuario@usuario-Standard-PC-i440FX-PIIX-1996:~$');
          
          if (hasIncompletePrompt && !hasCompletePrompt) {
            console.log('⚠️ Found incomplete prompt pattern like user reported');
          }
          
          const promptCount = (content.match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Prompts count: ${promptCount}`);
        }
        
        // Refresh page
        console.log('\n🔄 ACTUALIZANDO PÁGINA...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/real-problem-after.png', 
          fullPage: true 
        });
        
        // Check exact content after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 CONTENIDO DESPUÉS DE ACTUALIZAR:');
        let problemDetected = false;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          console.log(`Terminal ${i + 1}:`);
          console.log(content);
          console.log('---');
          
          // Check for the exact user problem pattern
          const hasIncompletePrompt = content.includes('usuario@usuario-Standard-PC-i440FX-PIIX-\n');
          const hasDoublePrompt = content.match(/usuario@[^$]*-\s*usuario@[^$]*\$/g);
          
          if (hasIncompletePrompt) {
            console.log('❌ PROBLEMA DETECTADO: Found incomplete prompt line');
            problemDetected = true;
          }
          
          if (hasDoublePrompt) {
            console.log('❌ PROBLEMA DETECTADO: Found double prompt pattern');
            console.log(`   Pattern: ${hasDoublePrompt[0]}`);
            problemDetected = true;
          }
          
          const promptCount = (content.match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Prompts count: ${promptCount}`);
        }
        
        console.log('\n📊 RESULTADO:');
        if (problemDetected) {
          console.log('❌ PROBLEMA AÚN EXISTE - NECESITA MÁS CORRECCIÓN');
        } else {
          console.log('✅ PROBLEMA RESUELTO - Sin duplicación detectada');
        }
        
        return { problemDetected };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { problemDetected: false, error: 'Split button not found' };
      }
    }
  });
});