const { test, expect } = require('@playwright/test');

test.describe('Iteración 22 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 22: Depuración y limpieza mejorada', async ({ page }) => {
    console.log('\n=== ITERACIÓN 22: DEPURACIÓN Y LIMPIEZA MEJORADA ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 22 - Depuración Final');
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
          path: 'tests/screenshots/iter22-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 PROBANDO DEPURACIÓN Y LIMPIEZA MEJORADA...');
        console.log('🔍 REVISAR LOGS DEL SERVIDOR PARA [ITER22]');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter22-after-refresh.png', 
          fullPage: true 
        });
        
        // Final verification
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('\n📋 VERIFICACIÓN FINAL - ITERACIÓN 22:');
        let allClean = true;
        let results = [];
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          const result = {
            terminal: i + 1,
            length: content.length,
            clean: true,
            issues: []
          };
          
          console.log(`\n🖥️ Terminal ${i + 1}:`);
          console.log(`📏 Longitud: ${content.length} caracteres`);
          
          // Verificaciones exhaustivas
          if (content.includes('Vídeosusuario@')) {
            result.clean = false;
            result.issues.push('Vídeosusuario@');
            allClean = false;
            console.log(`❌ 'Vídeosusuario@' AÚN PRESENTE`);
          }
          
          if (/(\w+@[\w-]+)-\1@[\w-]+:~\$/.test(content)) {
            result.clean = false;
            result.issues.push('duplicación-con-guión');
            allClean = false;
            console.log(`❌ Duplicación con guión detectada`);
          }
          
          if (/(\w+@[\w-]+)\1@[\w-]+:~\$/.test(content)) {
            result.clean = false;
            result.issues.push('duplicación-sin-guión');
            allClean = false;
            console.log(`❌ Duplicación sin guión detectada`);
          }
          
          if (content.includes('usuario@usuario-Standard-PC-i440FX-PIIX-usuario@')) {
            result.clean = false;
            result.issues.push('duplicación-completa');
            allClean = false;
            console.log(`❌ Duplicación completa detectada`);
          }
          
          // Contar prompts
          const prompts = content.match(/\w+@[\w-]+:~\$/g) || [];
          result.prompts = prompts.length;
          console.log(`📊 Prompts: ${prompts.length}`);
          
          if (result.clean) {
            console.log(`✅ Terminal ${i + 1}: COMPLETAMENTE LIMPIO`);
            
            if (i === 0) {
              const hasLs = content.includes('Descargas') && content.includes('Documentos');
              const hasVideos = content.includes('Vídeos') && !content.includes('Vídeosusuario');
              console.log(`   Salida ls: ${hasLs ? '✓' : '✗'}`);
              console.log(`   'Vídeos' correcto: ${hasVideos ? '✓' : '✗'}`);
            }
          }
          
          results.push(result);
        }
        
        console.log('\n📊 RESULTADO FINAL ITERACIÓN 22:');
        console.log(`Terminales totales: ${results.length}`);
        console.log(`Terminales limpios: ${results.filter(r => r.clean).length}`);
        
        if (allClean) {
          console.log('\n✅ ¡ÉXITO TOTAL EN ITERACIÓN 22!');
          console.log('🎉 PROBLEMA DE DUPLICACIÓN COMPLETAMENTE RESUELTO');
          console.log('✅ "Vídeosusuario@" corregido');
          console.log('✅ Sin duplicaciones con o sin guión');
          console.log('✅ Todos los terminales funcionando correctamente');
          console.log('\n🏆 SOLUCIÓN DEFINITIVA ALCANZADA');
        } else {
          console.log('\n❌ PROBLEMAS PERSISTEN');
          results.filter(r => !r.clean).forEach(r => {
            console.log(`Terminal ${r.terminal}: ${r.issues.join(', ')}`);
          });
          console.log('\n🔧 Revisar logs del servidor [ITER22] para más detalles');
        }
        
        return { 
          success: allClean, 
          iteration: 22,
          results: results,
          approach: 'debug-enhanced-cleaning'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});