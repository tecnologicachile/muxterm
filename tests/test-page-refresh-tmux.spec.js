const { test, expect } = require('@playwright/test');

test.describe('Test Page Refresh with tmux', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Verify no prompt duplication after page refresh', async ({ page }) => {
    console.log('\n=== TEST DE ACTUALIZACIÓN DE PÁGINA CON TMUX ===');
    
    // 1. Login
    console.log('\n1. Iniciando sesión...');
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    // 2. Crear nueva sesión
    console.log('2. Creando nueva sesión...');
    const createBtn = await page.locator('button:has-text("New Session")').first();
    await createBtn.click();
    
    const dialog = await page.locator('[role="dialog"]').isVisible();
    if (dialog) {
      await page.fill('input[type="text"]', 'Test Refresh tmux');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // 3. Ejecutar comandos en terminal 1
      console.log('3. Ejecutando comandos en terminal principal...');
      
      // Comando 1: echo
      await page.keyboard.type('echo "Sesión con tmux - Terminal 1"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Comando 2: pwd
      await page.keyboard.type('pwd');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Comando 3: ls
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Capturar contenido antes de dividir
      const beforeSplitContent = await page.locator('.xterm-rows').textContent();
      const promptCountBefore = (beforeSplitContent.match(/usuario@.*\$/g) || []).length;
      console.log(`   - Prompts antes del split: ${promptCountBefore}`);
      console.log(`   - Contiene "Vídeosusuario@": ${beforeSplitContent.includes('Vídeosusuario@') ? 'SÍ' : 'NO'}`);
      
      // 4. Dividir panel horizontalmente
      console.log('\n4. Dividiendo panel...');
      const splitButton = await page.locator('button:has-text("Split")');
      await splitButton.click();
      await page.waitForTimeout(2000);
      
      // 5. Ejecutar comando en terminal 2
      console.log('5. Ejecutando comando en terminal 2...');
      await page.keyboard.type('echo "Terminal 2 - tmux session"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Tomar screenshot antes del refresh
      await page.screenshot({ path: 'before-refresh-tmux.png', fullPage: true });
      
      // 6. ACTUALIZAR LA PÁGINA
      console.log('\n6. 🔄 ACTUALIZANDO PÁGINA (F5)...');
      await page.reload();
      await page.waitForTimeout(3000);
      
      // 7. Verificar después del refresh
      console.log('\n7. Verificando estado después del refresh:');
      const terminals = await page.locator('.xterm-rows').allTextContents();
      
      let allTestsPassed = true;
      
      terminals.forEach((content, index) => {
        console.log(`\n   Terminal ${index + 1}:`);
        
        // a) Verificar que no hay concatenación "Vídeosusuario@"
        if (content.includes('Vídeosusuario@')) {
          console.log('   ❌ FALLO: Contiene "Vídeosusuario@"');
          allTestsPassed = false;
        } else {
          console.log('   ✅ OK: Sin concatenación "Vídeosusuario@"');
        }
        
        // b) Contar prompts
        const prompts = content.match(/usuario@[^:]+:[^$]*\$/g) || [];
        console.log(`   - Prompts encontrados: ${prompts.length}`);
        
        // c) Verificar que no hay prompts duplicados consecutivos
        let hasDuplicatePrompts = false;
        for (let i = 1; i < prompts.length; i++) {
          if (prompts[i] === prompts[i-1]) {
            hasDuplicatePrompts = true;
            break;
          }
        }
        
        if (hasDuplicatePrompts) {
          console.log('   ❌ FALLO: Prompts duplicados detectados');
          allTestsPassed = false;
        } else {
          console.log('   ✅ OK: Sin duplicación de prompts');
        }
        
        // d) Verificar que los comandos anteriores están preservados
        if (index === 0) {
          // Terminal 1 debe tener los comandos originales
          const hasOriginalCommands = 
            content.includes('Sesión con tmux - Terminal 1') &&
            content.includes('pwd') &&
            content.includes('ls');
          
          if (hasOriginalCommands) {
            console.log('   ✅ OK: Comandos originales preservados');
          } else {
            console.log('   ❌ FALLO: Faltan comandos originales');
            allTestsPassed = false;
          }
        } else if (index === 1) {
          // Terminal 2 debe tener su comando
          if (content.includes('Terminal 2 - tmux session')) {
            console.log('   ✅ OK: Comando de terminal 2 preservado');
          } else {
            console.log('   ❌ FALLO: Falta comando de terminal 2');
            allTestsPassed = false;
          }
        }
      });
      
      // 8. Prueba adicional: escribir nuevo comando después del refresh
      console.log('\n8. Probando funcionalidad después del refresh...');
      await page.keyboard.type('echo "Funcionando después del refresh"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      const finalContent = await page.locator('.xterm-rows').first().textContent();
      if (finalContent.includes('Funcionando después del refresh')) {
        console.log('   ✅ OK: Terminal funciona correctamente después del refresh');
      } else {
        console.log('   ❌ FALLO: Terminal no responde después del refresh');
        allTestsPassed = false;
      }
      
      // Tomar screenshot final
      await page.screenshot({ path: 'after-refresh-tmux.png', fullPage: true });
      
      // 9. Resumen final
      console.log('\n' + '='.repeat(50));
      if (allTestsPassed) {
        console.log('🎉 TODOS LOS TESTS PASARON EXITOSAMENTE');
        console.log('✅ tmux previene la duplicación de prompts');
        console.log('✅ Las sesiones se mantienen correctamente');
        console.log('✅ No hay problemas de concatenación');
      } else {
        console.log('⚠️ ALGUNOS TESTS FALLARON');
        console.log('Revisa los logs anteriores para más detalles');
      }
      console.log('='.repeat(50));
      
      // Verificar que tmux está invisible
      const bodyContent = await page.locator('body').textContent();
      if (!bodyContent.includes('[0]') && !bodyContent.includes('tmux')) {
        console.log('\n✅ Bonus: tmux es completamente invisible al usuario');
      }
      
      // Assertion para que Playwright marque el test como exitoso/fallido
      expect(allTestsPassed).toBe(true);
    }
  });
});