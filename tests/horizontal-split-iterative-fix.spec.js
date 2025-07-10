const { test, expect } = require('@playwright/test');

test.describe('Horizontal Split - Iterative Fix with Prompt Duplication Check', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 1: Revisar duplicación y corregir', async ({ page }) => {
    console.log('\n=== ITERACIÓN 1: REVISAR DUPLICACIÓN Y CORREGIR ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 1 - División Horizontal Check');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute command
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        console.log('✅ Creado panel con división horizontal');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter1-horizontal-check-before.png', 
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
          console.log(`Terminal ${i + 1} contenido: "${content.substring(0, 100)}..."`);
          
          if (consecutivePrompts) {
            duplicatePatternsBefore += consecutivePrompts.length;
            console.log(`⚠️ Terminal ${i + 1} tiene ${consecutivePrompts.length} patrones consecutivos`);
          }
          
          totalPromptsBefore += promptCount;
        }
        
        console.log(`Total prompts antes: ${totalPromptsBefore}`);
        console.log(`Patrones duplicados antes: ${duplicatePatternsBefore}`);
        
        // Refresh page
        console.log('🔄 Actualizando página...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter1-horizontal-check-after.png', 
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
          console.log(`Terminal ${i + 1} contenido: "${content.substring(0, 100)}..."`);
          
          if (consecutivePrompts) {
            duplicatePatternsAfter += consecutivePrompts.length;
            console.log(`❌ Terminal ${i + 1} tiene ${consecutivePrompts.length} patrones consecutivos`);
          }
          
          totalPromptsAfter += promptCount;
        }
        
        console.log(`Total prompts después: ${totalPromptsAfter}`);
        console.log(`Patrones duplicados después: ${duplicatePatternsAfter}`);
        
        // Detailed analysis
        const promptIncrease = totalPromptsAfter - totalPromptsBefore;
        const duplicateIncrease = duplicatePatternsAfter - duplicatePatternsBefore;
        
        console.log(`\n📊 ANÁLISIS DETALLADO:`);
        console.log(`- Incremento de prompts: ${promptIncrease}`);
        console.log(`- Incremento de duplicados: ${duplicateIncrease}`);
        
        if (promptIncrease > 0 || duplicateIncrease > 0) {
          console.log(`❌ ITERACIÓN 1 DETECTÓ PROBLEMA: Duplicación encontrada`);
          console.log(`🔧 NECESITA CORRECCIÓN EN EL CÓDIGO`);
          
          // This would be where we make code corrections
          return {
            needsCorrection: true,
            promptIncrease: promptIncrease,
            duplicateIncrease: duplicateIncrease
          };
        } else {
          console.log(`✅ ITERACIÓN 1 EXITOSA: Sin duplicación detectada`);
          return {
            needsCorrection: false,
            promptIncrease: promptIncrease,
            duplicateIncrease: duplicateIncrease
          };
        }
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { needsCorrection: false, error: 'Split button not found' };
      }
    }
  });
  
  test('Iteración 2: Test after correction', async ({ page }) => {
    console.log('\n=== ITERACIÓN 2: TEST AFTER CORRECTION ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 2 - Post Correction Check');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute multiple commands to stress test
      await page.keyboard.type('echo "test 1"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      await page.keyboard.type('echo "test 2"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute commands in second panel
        await page.keyboard.type('echo "panel 2 test"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        await page.keyboard.type('pwd');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        console.log('✅ Creado panel horizontal con múltiples comandos');
        
        // Check prompts before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        let duplicatePatternsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const content = terminalsBefore[i];
          const promptCount = (content.match(/usuario@[^$]*\$/g) || []).length;
          const consecutivePrompts = content.match(/usuario@[^$]*\$\s*usuario@[^$]*\$/g);
          
          console.log(`Terminal ${i + 1} prompts antes: ${promptCount}`);
          
          if (consecutivePrompts) {
            duplicatePatternsBefore += consecutivePrompts.length;
            console.log(`⚠️ Terminal ${i + 1} tiene ${consecutivePrompts.length} patrones consecutivos antes`);
          }
          
          totalPromptsBefore += promptCount;
        }
        
        console.log(`Total prompts antes: ${totalPromptsBefore}`);
        
        // Refresh page
        console.log('🔄 Actualizando página...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        let duplicatePatternsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          const promptCount = (content.match(/usuario@[^$]*\$/g) || []).length;
          const consecutivePrompts = content.match(/usuario@[^$]*\$\s*usuario@[^$]*\$/g);
          
          console.log(`Terminal ${i + 1} prompts después: ${promptCount}`);
          
          if (consecutivePrompts) {
            duplicatePatternsAfter += consecutivePrompts.length;
            console.log(`❌ Terminal ${i + 1} tiene ${consecutivePrompts.length} patrones consecutivos después`);
          }
          
          totalPromptsAfter += promptCount;
        }
        
        console.log(`Total prompts después: ${totalPromptsAfter}`);
        
        // Analysis
        const promptIncrease = totalPromptsAfter - totalPromptsBefore;
        const duplicateIncrease = duplicatePatternsAfter - duplicatePatternsBefore;
        
        console.log(`\n📊 ANÁLISIS ITERACIÓN 2:`);
        console.log(`- Incremento de prompts: ${promptIncrease}`);
        console.log(`- Incremento de duplicados: ${duplicateIncrease}`);
        
        if (promptIncrease > 0 || duplicateIncrease > 0) {
          console.log(`❌ ITERACIÓN 2: AÚN HAY DUPLICACIÓN`);
          console.log(`🔧 NECESITA MÁS CORRECCIÓN EN EL CÓDIGO`);
        } else {
          console.log(`✅ ITERACIÓN 2 EXITOSA: Sin duplicación después de corrección`);
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/iter2-post-correction.png', 
          fullPage: true 
        });
        
      } else {
        console.log('❌ Botón Split no encontrado');
      }
    }
  });
});