const { test, expect } = require('@playwright/test');

test.describe('Iteración 19 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 19: Limpieza Terminal 1 - contenido pegado', async ({ page }) => {
    console.log('\n=== ITERACIÓN 19: LIMPIEZA TERMINAL 1 - CONTENIDO PEGADO ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 19 - Terminal 1 Fix');
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
        
        await page.keyboard.type('pwd');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter19-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 PROBANDO LIMPIEZA TERMINAL 1...');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter19-after-refresh.png', 
          fullPage: true 
        });
        
        // Final analysis
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 ANÁLISIS FINAL - ITERACIÓN 19:');
        let problemsFound = 0;
        let cleanTerminals = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\n🖥️ Terminal ${i + 1}:`);
          console.log(`📏 Longitud: ${content.length} caracteres`);
          
          // Buscar patrones problemáticos
          let hasProblems = false;
          
          // Patrón 1: Vídeos pegado con usuario
          if (content.includes('Vídeosusuario@')) {
            hasProblems = true;
            console.log(`❌ 'Vídeos' pegado con prompt detectado`);
          }
          
          // Patrón 2: Duplicación general
          const duplicatePattern = /(\w+@[\w-]+)-\1@[\w-]+:~\$/;
          if (duplicatePattern.test(content)) {
            hasProblems = true;
            console.log(`❌ Duplicación con guión detectada`);
          }
          
          // Patrón 3: Duplicación amplia
          const broadDuplicate = /(\w+)@([\w-]+).*\1@\2.*\1@\2/;
          if (broadDuplicate.test(content)) {
            hasProblems = true;
            console.log(`❌ Duplicación múltiple detectada`);
          }
          
          // Contar prompts
          const prompts = content.match(/\w+@[\w-]+:~\$/g) || [];
          console.log(`📊 Prompts encontrados: ${prompts.length}`);
          
          // Verificar estado esperado
          if (i === 0) { // Terminal 1
            if (prompts.length === 2 && !hasProblems) {
              cleanTerminals++;
              console.log(`✅ Terminal 1: LIMPIO (2 prompts esperados)`);
            } else {
              problemsFound++;
              console.log(`❌ Terminal 1: CON PROBLEMAS`);
              console.log(`   Contenido problemático: "${content.substring(150, 250)}..."`);
            }
          } else if (i === 1) { // Terminal 2
            if (prompts.length === 1 && !hasProblems) {
              cleanTerminals++;
              console.log(`✅ Terminal 2: LIMPIO (1 prompt esperado)`);
            } else {
              problemsFound++;
              console.log(`❌ Terminal 2: CON PROBLEMAS`);
            }
          }
        }
        
        console.log('\n📊 RESULTADO FINAL ITERACIÓN 19:');
        console.log(`Total terminales: ${terminalsAfter.length}`);
        console.log(`Terminales limpios: ${cleanTerminals}`);
        console.log(`Problemas encontrados: ${problemsFound}`);
        
        const success = problemsFound === 0;
        
        if (success) {
          console.log('\n✅ ITERACIÓN 19 EXITOSA');
          console.log('🎉 PROBLEMA DE DUPLICACIÓN COMPLETAMENTE RESUELTO');
          console.log('✅ Terminal 1: Contenido separado correctamente del prompt');
          console.log('✅ Terminal 2: Sin duplicación');
        } else {
          console.log('\n❌ AÚN HAY PROBLEMAS');
          console.log('🔧 NECESITA: Iteración 20');
        }
        
        return { 
          success: success, 
          problemsFound: problemsFound,
          cleanTerminals: cleanTerminals,
          totalTerminals: terminalsAfter.length,
          approach: 'terminal1-content-separation'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});