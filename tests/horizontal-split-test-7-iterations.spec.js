const { test, expect } = require('@playwright/test');

test.describe('Horizontal Split Test - 7 Iterations', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 1: División horizontal y actualización', async ({ page }) => {
    console.log('\n=== ITERACIÓN 1: DIVISIÓN HORIZONTAL ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 1 - División Horizontal');
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
          path: 'tests/screenshots/iter1-horizontal-before.png', 
          fullPage: true 
        });
        
        // Check prompts before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const promptCount = (terminalsBefore[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts antes: ${promptCount}`);
          totalPromptsBefore += promptCount;
        }
        
        console.log(`Total prompts antes: ${totalPromptsBefore}`);
        
        // Refresh page
        console.log('🔄 Actualizando página...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter1-horizontal-after.png', 
          fullPage: true 
        });
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts después: ${promptCount}`);
          totalPromptsAfter += promptCount;
        }
        
        console.log(`Total prompts después: ${totalPromptsAfter}`);
        
        // Assessment
        const promptIncrease = totalPromptsAfter - totalPromptsBefore;
        
        if (promptIncrease <= 0) {
          console.log(`✅ ITERACIÓN 1 EXITOSA: Sin duplicación (${promptIncrease})`);
        } else {
          console.log(`❌ ITERACIÓN 1 FALLIDA: Duplicación detectada (+${promptIncrease})`);
        }
        
      } else {
        console.log('❌ Botón Split no encontrado');
      }
    }
  });
  
  test('Iteración 2: División horizontal con comandos múltiples', async ({ page }) => {
    console.log('\n=== ITERACIÓN 2: DIVISIÓN HORIZONTAL CON COMANDOS MÚLTIPLES ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 2 - División Horizontal Múltiple');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute multiple commands
      await page.keyboard.type('echo "comando 1"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      await page.keyboard.type('pwd');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      await page.keyboard.type('whoami');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute command in second panel
        await page.keyboard.type('echo "panel 2"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        console.log('✅ Creado panel horizontal con comandos múltiples');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter2-horizontal-before.png', 
          fullPage: true 
        });
        
        // Check prompts before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const promptCount = (terminalsBefore[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts antes: ${promptCount}`);
          totalPromptsBefore += promptCount;
        }
        
        console.log(`Total prompts antes: ${totalPromptsBefore}`);
        
        // Refresh page
        console.log('🔄 Actualizando página...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter2-horizontal-after.png', 
          fullPage: true 
        });
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts después: ${promptCount}`);
          totalPromptsAfter += promptCount;
        }
        
        console.log(`Total prompts después: ${totalPromptsAfter}`);
        
        // Assessment
        const promptIncrease = totalPromptsAfter - totalPromptsBefore;
        
        if (promptIncrease <= 0) {
          console.log(`✅ ITERACIÓN 2 EXITOSA: Sin duplicación (${promptIncrease})`);
        } else {
          console.log(`❌ ITERACIÓN 2 FALLIDA: Duplicación detectada (+${promptIncrease})`);
        }
        
      } else {
        console.log('❌ Botón Split no encontrado');
      }
    }
  });
  
  test('Iteración 3: División horizontal con comandos rápidos', async ({ page }) => {
    console.log('\n=== ITERACIÓN 3: DIVISIÓN HORIZONTAL CON COMANDOS RÁPIDOS ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 3 - División Horizontal Rápida');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute rapid commands
      const rapidCommands = ['echo "1"', 'echo "2"', 'echo "3"', 'ls', 'pwd'];
      
      for (const cmd of rapidCommands) {
        await page.keyboard.type(cmd);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
      }
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute rapid commands in second panel
        for (let i = 0; i < 3; i++) {
          await page.keyboard.type(`echo "panel2-${i}"`);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(100);
        }
        
        console.log('✅ Creado panel horizontal con comandos rápidos');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter3-horizontal-before.png', 
          fullPage: true 
        });
        
        // Check prompts before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const promptCount = (terminalsBefore[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts antes: ${promptCount}`);
          totalPromptsBefore += promptCount;
        }
        
        console.log(`Total prompts antes: ${totalPromptsBefore}`);
        
        // Refresh page
        console.log('🔄 Actualizando página...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter3-horizontal-after.png', 
          fullPage: true 
        });
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts después: ${promptCount}`);
          totalPromptsAfter += promptCount;
        }
        
        console.log(`Total prompts después: ${totalPromptsAfter}`);
        
        // Assessment
        const promptIncrease = totalPromptsAfter - totalPromptsBefore;
        
        if (promptIncrease <= 0) {
          console.log(`✅ ITERACIÓN 3 EXITOSA: Sin duplicación (${promptIncrease})`);
        } else {
          console.log(`❌ ITERACIÓN 3 FALLIDA: Duplicación detectada (+${promptIncrease})`);
        }
        
      } else {
        console.log('❌ Botón Split no encontrado');
      }
    }
  });
  
  test('Iteración 4: División horizontal con comandos vacíos', async ({ page }) => {
    console.log('\n=== ITERACIÓN 4: DIVISIÓN HORIZONTAL CON COMANDOS VACÍOS ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 4 - División Horizontal Vacía');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute commands with empty ones
      await page.keyboard.type('echo "inicio"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      await page.keyboard.press('Enter'); // Empty command
      await page.waitForTimeout(200);
      
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      await page.keyboard.press('Enter'); // Empty command
      await page.waitForTimeout(200);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute commands with empty ones in second panel
        await page.keyboard.press('Enter'); // Empty command
        await page.waitForTimeout(200);
        
        await page.keyboard.type('echo "panel2"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        console.log('✅ Creado panel horizontal con comandos vacíos');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter4-horizontal-before.png', 
          fullPage: true 
        });
        
        // Check prompts before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const promptCount = (terminalsBefore[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts antes: ${promptCount}`);
          totalPromptsBefore += promptCount;
        }
        
        console.log(`Total prompts antes: ${totalPromptsBefore}`);
        
        // Refresh page
        console.log('🔄 Actualizando página...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter4-horizontal-after.png', 
          fullPage: true 
        });
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts después: ${promptCount}`);
          totalPromptsAfter += promptCount;
        }
        
        console.log(`Total prompts después: ${totalPromptsAfter}`);
        
        // Assessment
        const promptIncrease = totalPromptsAfter - totalPromptsBefore;
        
        if (promptIncrease <= 0) {
          console.log(`✅ ITERACIÓN 4 EXITOSA: Sin duplicación (${promptIncrease})`);
        } else {
          console.log(`❌ ITERACIÓN 4 FALLIDA: Duplicación detectada (+${promptIncrease})`);
        }
        
      } else {
        console.log('❌ Botón Split no encontrado');
      }
    }
  });
  
  test('Iteración 5: División horizontal con refreshes múltiples', async ({ page }) => {
    console.log('\n=== ITERACIÓN 5: DIVISIÓN HORIZONTAL CON REFRESHES MÚLTIPLES ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 5 - División Horizontal Multiple Refresh');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute command
      await page.keyboard.type('echo "test multiple refresh"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        await page.keyboard.type('echo "panel2 refresh"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        console.log('✅ Creado panel horizontal para refreshes múltiples');
        
        // Test multiple refreshes
        for (let refreshNum = 1; refreshNum <= 3; refreshNum++) {
          console.log(`\n--- Refresh ${refreshNum} ---`);
          
          // Take screenshot before refresh
          await page.screenshot({ 
            path: `tests/screenshots/iter5-refresh${refreshNum}-before.png`, 
            fullPage: true 
          });
          
          // Check prompts before refresh
          const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
          let totalPromptsBefore = 0;
          
          for (let i = 0; i < terminalsBefore.length; i++) {
            const promptCount = (terminalsBefore[i].match(/usuario@[^$]*\$/g) || []).length;
            totalPromptsBefore += promptCount;
          }
          
          console.log(`  Prompts antes refresh ${refreshNum}: ${totalPromptsBefore}`);
          
          // Refresh page
          await page.reload();
          await page.waitForTimeout(3000);
          
          // Take screenshot after refresh
          await page.screenshot({ 
            path: `tests/screenshots/iter5-refresh${refreshNum}-after.png`, 
            fullPage: true 
          });
          
          // Check prompts after refresh
          const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
          let totalPromptsAfter = 0;
          
          for (let i = 0; i < terminalsAfter.length; i++) {
            const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
            totalPromptsAfter += promptCount;
          }
          
          console.log(`  Prompts después refresh ${refreshNum}: ${totalPromptsAfter}`);
          
          const promptIncrease = totalPromptsAfter - totalPromptsBefore;
          
          if (promptIncrease <= 0) {
            console.log(`  ✅ Refresh ${refreshNum} EXITOSO: Sin duplicación (${promptIncrease})`);
          } else {
            console.log(`  ❌ Refresh ${refreshNum} FALLIDO: Duplicación detectada (+${promptIncrease})`);
          }
        }
        
        console.log('✅ ITERACIÓN 5 COMPLETADA: Test de refreshes múltiples');
        
      } else {
        console.log('❌ Botón Split no encontrado');
      }
    }
  });
  
  test('Iteración 6: División horizontal con scenario extremo', async ({ page }) => {
    console.log('\n=== ITERACIÓN 6: DIVISIÓN HORIZONTAL CON SCENARIO EXTREMO ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 6 - División Horizontal Extrema');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute many commands to create extreme scenario
      const extremeCommands = [
        'echo "extreme1"', 'echo "extreme2"', 'echo "extreme3"', 
        'ls', 'pwd', 'whoami', 'date', 'echo "extreme4"',
        'echo "extreme5"', 'echo "extreme6"'
      ];
      
      for (const cmd of extremeCommands) {
        await page.keyboard.type(cmd);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
      }
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Execute many commands in second panel
        for (let i = 0; i < 8; i++) {
          await page.keyboard.type(`echo "panel2-extreme-${i}"`);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(150);
        }
        
        console.log('✅ Creado panel horizontal con scenario extremo');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter6-horizontal-before.png', 
          fullPage: true 
        });
        
        // Check prompts before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const promptCount = (terminalsBefore[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts antes: ${promptCount}`);
          totalPromptsBefore += promptCount;
        }
        
        console.log(`Total prompts antes: ${totalPromptsBefore}`);
        
        // Refresh page
        console.log('🔄 Actualizando página...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter6-horizontal-after.png', 
          fullPage: true 
        });
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts después: ${promptCount}`);
          totalPromptsAfter += promptCount;
        }
        
        console.log(`Total prompts después: ${totalPromptsAfter}`);
        
        // Assessment
        const promptIncrease = totalPromptsAfter - totalPromptsBefore;
        const reductionRatio = totalPromptsAfter / totalPromptsBefore;
        
        console.log(`Ratio de reducción: ${reductionRatio.toFixed(2)}`);
        
        if (promptIncrease <= 0) {
          console.log(`✅ ITERACIÓN 6 EXITOSA: Sin duplicación (${promptIncrease})`);
        } else {
          console.log(`❌ ITERACIÓN 6 FALLIDA: Duplicación detectada (+${promptIncrease})`);
        }
        
      } else {
        console.log('❌ Botón Split no encontrado');
      }
    }
  });
  
  test('Iteración 7: División horizontal - Test final comprehensivo', async ({ page }) => {
    console.log('\n=== ITERACIÓN 7: DIVISIÓN HORIZONTAL - TEST FINAL COMPREHENSIVO ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 7 - División Horizontal Final');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute mixed scenario: regular, empty, and rapid commands
      await page.keyboard.type('echo "final test start"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      
      await page.keyboard.press('Enter'); // Empty
      await page.waitForTimeout(200);
      
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      
      // Rapid sequence
      for (let i = 0; i < 3; i++) {
        await page.keyboard.type(`echo "rapid-${i}"`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
      }
      
      await page.keyboard.type('pwd');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        // Mixed scenario in second panel
        await page.keyboard.type('echo "panel2 final"');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        await page.keyboard.press('Enter'); // Empty
        await page.waitForTimeout(200);
        
        await page.keyboard.type('whoami');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        console.log('✅ Creado panel horizontal para test final comprehensivo');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter7-horizontal-before.png', 
          fullPage: true 
        });
        
        // Check prompts before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsBefore = 0;
        
        for (let i = 0; i < terminalsBefore.length; i++) {
          const promptCount = (terminalsBefore[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts antes: ${promptCount}`);
          totalPromptsBefore += promptCount;
        }
        
        console.log(`Total prompts antes: ${totalPromptsBefore}`);
        
        // Refresh page
        console.log('🔄 Actualizando página...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter7-horizontal-after.png', 
          fullPage: true 
        });
        
        // Check prompts after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        let totalPromptsAfter = 0;
        let preservedContentCount = 0;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const promptCount = (terminalsAfter[i].match(/usuario@[^$]*\$/g) || []).length;
          console.log(`Terminal ${i + 1} prompts después: ${promptCount}`);
          totalPromptsAfter += promptCount;
          
          // Check content preservation
          const content = terminalsAfter[i];
          const preservedItems = content.match(/(final|rapid|panel2|pwd|whoami)/g);
          if (preservedItems) {
            preservedContentCount += preservedItems.length;
            console.log(`  Terminal ${i + 1} preserva ${preservedItems.length} elementos de contenido`);
          }
        }
        
        console.log(`Total prompts después: ${totalPromptsAfter}`);
        console.log(`Total contenido preservado: ${preservedContentCount}`);
        
        // Final assessment
        const promptIncrease = totalPromptsAfter - totalPromptsBefore;
        const reductionRatio = totalPromptsAfter / totalPromptsBefore;
        
        console.log(`Ratio de reducción: ${reductionRatio.toFixed(2)}`);
        
        const promptStable = promptIncrease <= 0;
        const contentPreserved = preservedContentCount >= 5;
        const goodReduction = reductionRatio <= 1.0;
        
        console.log(`\n=== EVALUACIÓN FINAL ITERACIÓN 7 ===`);
        console.log(`- Prompts estables: ${promptStable ? '✅' : '❌'}`);
        console.log(`- Contenido preservado: ${contentPreserved ? '✅' : '❌'}`);
        console.log(`- Buena reducción: ${goodReduction ? '✅' : '❌'}`);
        
        if (promptStable && contentPreserved && goodReduction) {
          console.log('✅ ITERACIÓN 7 EXITOSA: Test final comprehensivo aprobado');
        } else {
          console.log('❌ ITERACIÓN 7 FALLIDA: Test final comprehensivo con problemas');
        }
        
      } else {
        console.log('❌ Botón Split no encontrado');
      }
    }
  });
});