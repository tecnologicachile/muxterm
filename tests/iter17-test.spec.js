const { test, expect } = require('@playwright/test');

test.describe('Iteración 17 Test', () => {
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Iteración 17: Limpieza radical del buffer', async ({ page }) => {
    console.log('\n=== ITERACIÓN 17: LIMPIEZA RADICAL DEL BUFFER ===');
    
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
      await page.fill('input[type="text"]', 'Iteración 17 - Limpieza Radical');
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
          path: 'tests/screenshots/iter17-before-refresh.png', 
          fullPage: true 
        });
        
        console.log('\n🔄 PROBANDO LIMPIEZA RADICAL...');
        
        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Take screenshot after refresh
        await page.screenshot({ 
          path: 'tests/screenshots/iter17-after-refresh.png', 
          fullPage: true 
        });
        
        // Ultra detailed analysis
        const terminalsAfter = await page.locator('.xterm-rows').allTextContents();
        
        console.log('📋 ANÁLISIS ULTRA DETALLADO:');
        let problemDetected = false;
        let problemDetails = [];
        
        for (let i = 0; i < terminalsAfter.length; i++) {
          const content = terminalsAfter[i];
          
          console.log(`\n🖥️ Terminal ${i + 1}:`);
          console.log(`📏 Longitud: ${content.length} caracteres`);
          console.log(`📝 Contenido completo:`);
          console.log(`"${content}"`);
          
          // Análisis carácter por carácter cerca del problema
          const problemIndex = content.indexOf('usuario@usuario-Standard-PC-i440FX-PIIX-');
          if (problemIndex > -1) {
            console.log(`\n🔍 ANÁLISIS DEL PROBLEMA en posición ${problemIndex}:`);
            const before = content.substring(Math.max(0, problemIndex - 20), problemIndex);
            const problem = content.substring(problemIndex, problemIndex + 50);
            console.log(`  Antes: "${before}"`);
            console.log(`  Problema: "${problem}"`);
            
            // Verificar si hay duplicación
            if (problem.includes('usuario@usuario-Standard-PC-i440FX-PIIX-usuario@')) {
              problemDetected = true;
              problemDetails.push({
                terminal: i + 1,
                position: problemIndex,
                context: problem
              });
              console.log(`  ❌ DUPLICACIÓN CONFIRMADA`);
            }
          }
          
          // Contar prompts únicos
          const prompts = [];
          const promptRegex = /\w+@[\w-]+:~\$/g;
          let match;
          while ((match = promptRegex.exec(content)) !== null) {
            prompts.push({
              text: match[0],
              position: match.index
            });
          }
          
          console.log(`\n📊 Prompts encontrados: ${prompts.length}`);
          prompts.forEach((prompt, idx) => {
            console.log(`  ${idx + 1}: "${prompt.text}" en posición ${prompt.position}`);
          });
          
          // Verificar si los prompts son idénticos (duplicación)
          if (prompts.length > 1) {
            const uniquePrompts = [...new Set(prompts.map(p => p.text))];
            if (uniquePrompts.length < prompts.length) {
              console.log(`  ⚠️ Prompts duplicados detectados`);
            }
          }
        }
        
        console.log('\n📊 RESULTADO ITERACIÓN 17:');
        
        if (problemDetected) {
          console.log('❌ LIMPIEZA RADICAL NO FUNCIONÓ');
          console.log(`🐛 Problemas encontrados: ${problemDetails.length}`);
          problemDetails.forEach(detail => {
            console.log(`  Terminal ${detail.terminal} en posición ${detail.position}`);
          });
          console.log('🔧 NECESITA: Iteración 18 con otro enfoque');
        } else {
          console.log('✅ LIMPIEZA RADICAL EXITOSA');
          console.log('🎉 NO SE DETECTÓ DUPLICACIÓN');
        }
        
        return { 
          success: !problemDetected, 
          problemDetected: problemDetected,
          problemDetails: problemDetails,
          totalTerminals: terminalsAfter.length,
          approach: 'radical-cleaning'
        };
        
      } else {
        console.log('❌ Botón Split no encontrado');
        return { success: false };
      }
    }
  });
});