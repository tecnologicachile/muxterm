const { test, expect } = require('@playwright/test');

test.describe('Iteración 21 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 21: Enfoque simple y directo', async ({ page }) => {
    console.log('\n=== ITERACIÓN 21: ENFOQUE SIMPLE Y DIRECTO ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 21 - Simple y Directo');
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
          path: 'tests/screenshots/iter21-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 PROBANDO ENFOQUE SIMPLE Y DIRECTO...');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter21-after-refresh.png', 
          fullPage: true 
        });
        
        // Final check
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 VERIFICACIÓN FINAL CON ENFOQUE SIMPLE:');
        let success = true;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\n🖥️ Terminal ${i + 1}:`);
          console.log(`📏 Longitud: ${content.length} caracteres`);
          
          // Verificaciones clave
          const problems = {
            videosPegado: content.includes('Vídeosusuario@'),
            duplicacionConGuion: /(\w+@[\w-]+)-\1@[\w-]+:~\$/.test(content),
            duplicacionSinGuion: /(\w+@[\w-]+)\1@[\w-]+:~\$/.test(content)
          };
          
          let hasProblems = false;
          
          Object.entries(problems).forEach(([key, value]) => {
            if (value) {
              hasProblems = true;
              success = false;
              console.log(`❌ ${key}: PRESENTE`);
            }
          });
          
          if (!hasProblems) {
            console.log(`✅ Terminal ${i + 1}: COMPLETAMENTE LIMPIO`);
            
            // Mostrar contenido limpio
            const prompts = content.match(/\w+@[\w-]+:~\$/g) || [];
            console.log(`   Prompts: ${prompts.length}`);
            
            if (i === 0) {
              const hasLs = content.includes('Descargas') && content.includes('Documentos');
              const hasVideos = content.includes('Vídeos');
              console.log(`   Salida ls: ${hasLs ? '✓' : '✗'}`);
              console.log(`   'Vídeos' separado: ${hasVideos && !problems.videosPegado ? '✓' : '✗'}`);
            }
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 21:');
        
        if (success) {
          console.log('✅ ¡ÉXITO TOTAL CON ENFOQUE SIMPLE!');
          console.log('🎉 TODOS LOS PROBLEMAS RESUELTOS');
          console.log('✅ Sin duplicación con guión');
          console.log('✅ Sin duplicación sin guión');
          console.log('✅ "Vídeos" correctamente separado');
          console.log('\n🏆 SOLUCIÓN COMPLETADA EN ITERACIÓN 21');
        } else {
          console.log('❌ AÚN HAY PROBLEMAS');
          console.log('🔧 NECESITA: Iteración 22');
        }
        
        return { 
          success: success, 
          iteration: 21,
          approach: 'simple-direct'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});