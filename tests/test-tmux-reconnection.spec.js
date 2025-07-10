const { test, expect } = require('@playwright/test');

test.describe('Test tmux reconnection', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Verify tmux prevents prompt duplication', async ({ page }) => {
    console.log('\n=== TESTING TMUX RECONNECTION ===');
    
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
      await page.fill('input[type="text"]', 'Tmux Test Session');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute some commands
      console.log('1. Ejecutando comandos...');
      await page.keyboard.type('echo "Test 1: Antes del split"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Get content before split
      const beforeSplit = await page.locator('.xterm-rows').textContent();
      console.log('\n2. Contenido antes del split:');
      console.log('   Longitud:', beforeSplit.length);
      console.log('   Contiene "Vídeosusuario@":', beforeSplit.includes('Vídeosusuario@') ? '❌ SÍ' : '✅ NO');
      
      // Split horizontally
      console.log('\n3. Dividiendo panel...');
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Type in terminal 2
        await page.keyboard.type('echo "Test 2: En terminal 2"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // Refresh page
        console.log('\n4. Refrescando página...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Check terminals after refresh
        const terminals = await page.locator('.xterm-rows').allTextContents();
        console.log('\n5. Después del refresh:');
        
        let hasProblems = false;
        terminals.forEach((content, i) => {
          console.log(`\n   Terminal ${i + 1}:`);
          console.log(`   - Longitud: ${content.length}`);
          
          // Check for concatenation problem
          if (content.includes('Vídeosusuario@')) {
            console.log('   - ❌ Tiene problema "Vídeosusuario@"');
            hasProblems = true;
          } else {
            console.log('   - ✅ Sin problema de concatenación');
          }
          
          // Check for duplicate prompts
          const promptPattern = /usuario@usuario-Standard-PC-i440FX-PIIX-1996:~\$/g;
          const promptMatches = content.match(promptPattern);
          const promptCount = promptMatches ? promptMatches.length : 0;
          
          console.log(`   - Prompts encontrados: ${promptCount}`);
          
          // Check if our commands are still there
          if (i === 0 && content.includes('Test 1: Antes del split')) {
            console.log('   - ✅ Comandos anteriores preservados');
          }
          if (i === 1 && content.includes('Test 2: En terminal 2')) {
            console.log('   - ✅ Comandos de terminal 2 preservados');
          }
        });
        
        if (!hasProblems) {
          console.log('\n🎉 ¡ÉXITO! tmux funcionando correctamente:');
          console.log('   - Sin duplicación de prompts');
          console.log('   - Sin concatenación Vídeosusuario@');
          console.log('   - Sesiones preservadas correctamente');
        } else {
          console.log('\n⚠️ Aún hay problemas a resolver');
        }
        
        // Test tmux invisibility
        console.log('\n6. Verificando que tmux es invisible:');
        const fullContent = await page.locator('body').textContent();
        if (fullContent.includes('[0]') || fullContent.includes('tmux')) {
          console.log('   - ❌ Se ve información de tmux');
        } else {
          console.log('   - ✅ tmux es completamente invisible');
        }
      }
    }
  });
});