const { test, expect } = require('@playwright/test');

test.describe('Horizontal Split - Iteración 3 Test', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 3: Test corrección de prompts consecutivos', async ({ page }) => {
    console.log('\n=== ITERACIÓN 3: TEST CORRECCIÓN DE PROMPTS CONSECUTIVOS ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 3 - Corrección Prompts Consecutivos');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute commands that typically cause consecutive prompts
      await page.keyboard.type('echo "test consecutive fix"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      await page.keyboard.type('pwd');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      await page.keyboard.type('whoami');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute commands in second panel that might cause consecutive prompts
        await page.keyboard.type('echo "panel 2 consecutive"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        await page.keyboard.type('date');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        await page.keyboard.type('echo "final panel 2"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        console.log('✅ Creado panel horizontal con comandos que causan prompts consecutivos');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter3-consecutive-fix-before.png', 
          fullPage: true 
        });
        
        // Check prompts before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        let duplicatePatternsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const content = terminalsBefore[i];
          const promptCount = (content.match(/usuario@[^$]*\$/g) || []).length;
          const consecutivePrompts = content.match(/usuario@[^$]*\$\s*usuario@[^$]*\$/g);
          
          console.log(`Terminal ${i + 1} prompts antes: ${promptCount}`);
          console.log(`Terminal ${i + 1} contenido preview: "${content.substring(0, 150)}..."`);
          
          if (consecutivePrompts) {
            duplicatePatternsBefore += consecutivePrompts.length;
            console.log(`⚠️ Terminal ${i + 1} tiene ${consecutivePrompts.length} patrones consecutivos ANTES`);
            for (let j = 0; j < consecutivePrompts.length; j++) {
              console.log(`   Patrón ${j + 1}: "${consecutivePrompts[j].substring(0, 80)}..."`);
            }
          }
          
          totalPromptsBefore += promptCount;
        }
        
        console.log(`\nRESUMEN ANTES:`);
        console.log(`- Total prompts antes: ${totalPromptsBefore}`);
        console.log(`- Patrones duplicados antes: ${duplicatePatternsBefore}`);
        
        // Refresh page
        console.log('\n🔄 Actualizando página...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter3-consecutive-fix-after.png', 
          fullPage: true 
        });
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        let duplicatePatternsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          const promptCount = (content.match(/usuario@[^$]*\$/g) || []).length;
          const consecutivePrompts = content.match(/usuario@[^$]*\$\s*usuario@[^$]*\$/g);
          
          console.log(`Terminal ${i + 1} prompts después: ${promptCount}`);
          console.log(`Terminal ${i + 1} contenido preview: "${content.substring(0, 150)}..."`);
          
          if (consecutivePrompts) {
            duplicatePatternsAfter += consecutivePrompts.length;
            console.log(`❌ Terminal ${i + 1} tiene ${consecutivePrompts.length} patrones consecutivos DESPUÉS`);
            for (let j = 0; j < consecutivePrompts.length; j++) {
              console.log(`   Patrón ${j + 1}: "${consecutivePrompts[j].substring(0, 80)}..."`);
            }
          }
          
          totalPromptsAfter += promptCount;
        }
        
        console.log(`\nRESUMEN DESPUÉS:`);
        console.log(`- Total prompts después: ${totalPromptsAfter}`);
        console.log(`- Patrones duplicados después: ${duplicatePatternsAfter}`);
        
        // Detailed analysis
        const promptIncrease = totalPromptsAfter - totalPromptsBefore;
        const duplicateIncrease = duplicatePatternsAfter - duplicatePatternsBefore;
        
        console.log(`\n📊 ANÁLISIS DETALLADO ITERACIÓN 3:`);
        console.log(`- Incremento de prompts: ${promptIncrease}`);
        console.log(`- Incremento de duplicados: ${duplicateIncrease}`);
        console.log(`- Ratio de reducción: ${(totalPromptsAfter / totalPromptsBefore).toFixed(2)}`);
        
        if (duplicatePatternsAfter > 0) {
          console.log(`❌ ITERACIÓN 3: AÚN HAY PATRONES CONSECUTIVOS`);
          console.log(`🔧 LA CORRECCIÓN ITERATIVA DEBE CONTINUAR`);
        } else if (promptIncrease > 0) {
          console.log(`❌ ITERACIÓN 3: HAY INCREMENTO DE PROMPTS`);
          console.log(`🔧 NECESITA MÁS CORRECCIÓN`);
        } else {
          console.log(`✅ ITERACIÓN 3 EXITOSA: Sin duplicación ni incremento`);
        }
        
        // Return results for next iteration
        return {
          needsCorrection: duplicatePatternsAfter > 0 || promptIncrease > 0,
          promptIncrease: promptIncrease,
          duplicateIncrease: duplicateIncrease,
          totalPromptsBefore: totalPromptsBefore,
          totalPromptsAfter: totalPromptsAfter
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { needsCorrection: false, error: 'Split button not found' };
      }
    }
  });
});