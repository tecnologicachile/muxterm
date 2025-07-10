const { test, expect } = require('@playwright/test');

test.describe('Iteración 13 - Investigar problema persistente', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 13: Investigar y capturar problema exacto', async ({ page }) => {
    console.log('\n=== ITERACIÓN 13: INVESTIGAR PROBLEMA PERSISTENTE ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 13 - Investigación');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute commands
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute command in second panel
        await page.keyboard.type('pwd');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // Capture content before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        console.log('\n📋 CONTENIDO ANTES DE ACTUALIZAR:');
        terminalsBefore.forEach((content, i) => {
          console.log(`Terminal ${i + 1}: "${content.substring(0, 300)}..."`);
        });
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter13-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 ACTUALIZANDO PÁGINA...');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter13-after-refresh.png', 
          fullPage: true 
        });
        
        // Capture content after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        console.log('\n📋 CONTENIDO DESPUÉS DE ACTUALIZAR:');
        let problemFound = false;
        let problemTerminal = -1;
        
        terminalsAfter.forEach((content, i) => {
          console.log(`\nTerminal ${i + 1}:`);
          console.log(`Contenido completo: "${content}"`);
          
          // Buscar el patrón exacto del problema
          const exactPattern = /usuario@usuario-Standard-PC-i440FX-PIIX-usuario@usuario-Standard-PC-i440FX-PIIX-1996:~\$/;
          if (exactPattern.test(content)) {
            problemFound = true;
            problemTerminal = i + 1;
            console.log(`❌ PROBLEMA ENCONTRADO EN TERMINAL ${i + 1}`);
            console.log(`Patrón exacto: "${content.match(exactPattern)[0]}"`);
          }
          
          // Análisis detallado del contenido
          const prompts = content.match(/\w+@[^$]*\$/g) || [];
          console.log(`Prompts encontrados: ${prompts.length}`);
          prompts.forEach((prompt, idx) => {
            console.log(`  ${idx + 1}: "${prompt}"`);
          });
        });
        
        console.log('\n📊 ANÁLISIS DEL PROBLEMA:');
        if (problemFound) {
          console.log(`❌ PROBLEMA CONFIRMADO en Terminal ${problemTerminal}`);
          console.log('🔍 PATRÓN: usuario@usuario-Standard-PC-i440FX-PIIX- aparece duplicado');
          console.log('🎯 NECESITA: Limpiar este patrón específico');
        } else {
          console.log('✅ NO SE ENCONTRÓ EL PROBLEMA');
        }
        
        return { 
          problemFound: problemFound,
          problemTerminal: problemTerminal,
          terminalsCount: terminalsAfter.length
        };
      }
    }
  });
});