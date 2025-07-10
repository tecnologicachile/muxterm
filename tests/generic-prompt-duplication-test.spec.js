const { test, expect } = require('@playwright/test');

test.describe('Generic Prompt Duplication Test', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Test solución genérica para cualquier usuario/máquina', async ({ page }) => {
    console.log('\n=== TEST SOLUCIÓN GENÉRICA PARA CUALQUIER USUARIO/MÁQUINA ===');
    
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
      await page.fill('input[type="text"]', 'Generic Test - Any User/Machine');
      await page.click('button:has-text("Create")');
      await page.waitForURL('**/terminal/**');
      await page.waitForTimeout(2000);
      
      // Execute command like original user
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Split panel horizontally
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.waitForTimeout(2000);
        
        console.log('✅ Creado panel horizontal para test genérico');
        
        // Take screenshot before refresh
        await page.screenshot({ 
          path: 'tests/screenshots/generic-test-before.png', 
          fullPage: true 
        });
        
        // Check content before refresh
        const terminalsBefore = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 CONTENIDO ANTES (GENÉRICO):');
        for (let i = 0; i < terminalsBefore.length; i++) {
          const content = terminalsBefore[i];
          console.log(`Terminal ${i + 1}: "${content.substring(0, 100)}..."`);
          
          // Extract current user@hostname pattern
          const promptPattern = content.match(/(\w+@[^$]*\$)/g);
          if (promptPattern) {
            console.log(`  Patrones de prompt detectados: ${promptPattern.length}`);
            promptPattern.forEach((pattern, idx) => {
              console.log(`    ${idx + 1}: "${pattern}"`);
            });
          }
        }
        
        // Refresh page
        console.log('\n🔄 ACTUALIZANDO PÁGINA...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/generic-test-after.png', 
          fullPage: true 
        });
        
        // Check content after refresh
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 CONTENIDO DESPUÉS (GENÉRICO):');
        let duplicateDetected = false;
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          console.log(`Terminal ${i + 1}: "${content.substring(0, 100)}..."`);
          
          // Extract current user@hostname pattern
          const promptPattern = content.match(/(\w+@[^$]*\$)/g);
          if (promptPattern) {
            console.log(`  Patrones de prompt detectados: ${promptPattern.length}`);
            promptPattern.forEach((pattern, idx) => {
              console.log(`    ${idx + 1}: "${pattern}"`);
            });
          }
          
          // Check for generic duplication patterns
          const genericDuplicatePattern = /(\w+@[^@]*?)(\w+@[^$]*\$)/g;
          const duplicateMatches = [];
          let duplicateMatch;
          
          while ((duplicateMatch = genericDuplicatePattern.exec(content)) !== null) {
            const firstPart = duplicateMatch[1];
            const secondPart = duplicateMatch[2];
            
            if (firstPart.includes('@') && secondPart.includes('@')) {
              const firstUser = firstPart.split('@')[0];
              const secondUser = secondPart.split('@')[0];
              
              if (firstUser === secondUser) {
                duplicateMatches.push({
                  full: duplicateMatch[0],
                  first: firstPart,
                  second: secondPart
                });
              }
            }
          }
          
          if (duplicateMatches.length > 0) {
            duplicateDetected = true;
            console.log(`❌ Terminal ${i + 1} tiene ${duplicateMatches.length} duplicaciones genéricas:`);
            duplicateMatches.forEach((dup, idx) => {
              console.log(`    ${idx + 1}: "${dup.full}" -> debería ser "${dup.second}"`);
            });
          }
          
          // Check for consecutive identical prompts
          const consecutivePattern = /(\w+@[^$]*\$)\s*\1/g;
          const consecutiveMatches = content.match(consecutivePattern);
          if (consecutiveMatches) {
            duplicateDetected = true;
            console.log(`❌ Terminal ${i + 1} tiene ${consecutiveMatches.length} prompts consecutivos idénticos`);
          }
        }
        
        console.log('\n📊 RESULTADO GENÉRICO:');
        if (duplicateDetected) {
          console.log('❌ DUPLICACIÓN DETECTADA - La solución genérica necesita mejoras');
        } else {
          console.log('✅ SIN DUPLICACIÓN - La solución genérica funciona correctamente');
        }
        
        return { duplicateDetected };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { duplicateDetected: false, error: 'Split button not found' };
      }
    }
  });
  
  test('Test simulación de diferentes usuarios', async ({ page }) => {
    console.log('\n=== SIMULACIÓN DE DIFERENTES USUARIOS ===');
    
    // This test simulates what would happen with different usernames
    // by checking if our regex patterns work with various user@hostname formats
    
    const testCases = [
      'john@desktop-abc123:~$ ls',
      'admin@server-production:~$ pwd', 
      'developer@laptop-dev:~$ whoami',
      'root@ubuntu-server:~$ ls -la',
      'user123@machine-456:~$ echo test'
    ];
    
    console.log('🧪 Probando patrones de diferentes usuarios:');
    
    for (let i = 0; i < testCases.length; i++) {
      const testPrompt = testCases[i];
      
      // Simulate the duplication problem
      const duplicatedPrompt = testPrompt.replace(/(\w+@[^:]*):/, '$1-$1:');
      
      console.log(`\nTest ${i + 1}:`);
      console.log(`  Original: "${testPrompt}"`);
      console.log(`  Duplicado: "${duplicatedPrompt}"`);
      
      // Test our generic pattern
      const genericPattern = /(\w+@[^@]*?)(\w+@[^$]*\$)/g;
      const match = genericPattern.exec(duplicatedPrompt);
      
      if (match) {
        const firstPart = match[1];
        const secondPart = match[2];
        
        if (firstPart.includes('@') && secondPart.includes('@')) {
          const firstUser = firstPart.split('@')[0];
          const secondUser = secondPart.split('@')[0];
          
          if (firstUser === secondUser) {
            console.log(`  ✅ Duplicación detectada correctamente`);
            console.log(`  🔧 Corrección: "${duplicatedPrompt}" -> "${secondPart}"`);
          } else {
            console.log(`  ❌ No se detectó duplicación (usuarios diferentes)`);
          }
        }
      } else {
        console.log(`  ❌ Patrón no coincide`);
      }
    }
    
    console.log('\n✅ Test de simulación completado');
  });
});