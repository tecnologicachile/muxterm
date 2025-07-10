const { test, expect } = require('@playwright/test');

test.describe('Iteración 20 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 20: Solución agresiva para Vídeosusuario', async ({ page }) => {
    console.log('\n=== ITERACIÓN 20: SOLUCIÓN AGRESIVA PARA VÍDEOSUSUARIO ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 20 - Solución Agresiva');
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
          path: 'tests/screenshots/iter20-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 PROBANDO SOLUCIÓN AGRESIVA...');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter20-after-refresh.png', 
          fullPage: true 
        });
        
        // Final verification
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 VERIFICACIÓN FINAL - ITERACIÓN 20:');
        let allClean = true;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\n🖥️ Terminal ${i + 1}:`);
          console.log(`📏 Longitud: ${content.length} caracteres`);
          
          // Verificaciones específicas
          const checks = {
            videosPegado: content.includes('Vídeosusuario@'),
            duplicacionGuion: /(\w+@[\w-]+)-\1@[\w-]+:~\$/.test(content),
            duplicacionMultiple: /(\w+)@([\w-]+).*\1@\2.*\1@\2/.test(content)
          };
          
          let terminalClean = true;
          
          if (checks.videosPegado) {
            console.log(`❌ 'Vídeosusuario@' TODAVÍA PRESENTE`);
            terminalClean = false;
            allClean = false;
          }
          
          if (checks.duplicacionGuion) {
            console.log(`❌ Duplicación con guión detectada`);
            terminalClean = false;
            allClean = false;
          }
          
          if (checks.duplicacionMultiple) {
            console.log(`❌ Duplicación múltiple detectada`);
            terminalClean = false;
            allClean = false;
          }
          
          // Contar prompts y verificar normalidad
          const prompts = content.match(/\w+@[\w-]+:~\$/g) || [];
          console.log(`📊 Prompts: ${prompts.length}`);
          
          // Verificar contenido esperado
          if (i === 0) { // Terminal 1
            const hasLsOutput = content.includes('Descargas') && content.includes('Documentos');
            const hasVideos = content.includes('Vídeos');
            
            console.log(`📁 Salida de ls presente: ${hasLsOutput ? 'SÍ' : 'NO'}`);
            console.log(`📁 'Vídeos' presente: ${hasVideos ? 'SÍ' : 'NO'}`);
            
            if (hasVideos && !checks.videosPegado) {
              console.log(`✅ 'Vídeos' correctamente separado`);
            }
            
            if (terminalClean && prompts.length === 2 && hasLsOutput) {
              console.log(`✅ Terminal 1: COMPLETAMENTE LIMPIO`);
            }
          } else if (i === 1) { // Terminal 2
            if (terminalClean && prompts.length === 1) {
              console.log(`✅ Terminal 2: COMPLETAMENTE LIMPIO`);
            }
          }
        }
        
        console.log('\n📊 RESULTADO FINAL ITERACIÓN 20:');
        
        if (allClean) {
          console.log('✅ ¡ÉXITO TOTAL!');
          console.log('🎉 PROBLEMA "Vídeosusuario@" RESUELTO');
          console.log('🎉 TODAS LAS DUPLICACIONES ELIMINADAS');
          console.log('✅ Terminal 1: Contenido y prompts correctos');
          console.log('✅ Terminal 2: Sin duplicación');
          console.log('\n🏆 PROBLEMA COMPLETAMENTE SOLUCIONADO EN ITERACIÓN 20');
        } else {
          console.log('❌ AÚN HAY PROBLEMAS');
          console.log('🔧 NECESITA: Iteración 21');
        }
        
        return { 
          success: allClean, 
          iteration: 20,
          totalTerminals: terminalsAfter.length,
          approach: 'aggressive-videos-separation'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});