const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Test Panel Distribution After Refresh', () => {
  test('Verify panel split is maintained after page refresh', async ({ page }) => {
    console.log('\n=== TEST DE DISTRIBUCIÓN DE PANELES ===\n');
    
    await page.goto('http://localhost:3002');
    
    // 1. Login
    console.log('1. Iniciando sesión...');
    await page.locator('input').first().fill('test');
    await page.locator('input').nth(1).fill('test123');
    await page.click('button:has-text("LOGIN")');
    await page.waitForTimeout(2000);
    
    // Wait for login to complete
    await page.waitForSelector('button:has-text("New Session")', { timeout: 10000 });
    
    // 2. Create new session
    console.log('2. Creando nueva sesión...');
    await page.click('button:has-text("New Session")');
    await page.waitForTimeout(2000);
    
    // 3. Wait for terminal to be ready
    console.log('3. Esperando que el terminal esté listo...');
    const terminal1 = page.locator('.xterm-rows').first();
    await terminal1.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // 4. Execute command in first terminal
    console.log('4. Ejecutando comando en terminal 1...');
    await page.keyboard.type('echo "Terminal 1"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 5. Split panel horizontally
    console.log('5. Dividiendo panel horizontalmente...');
    await page.click('button[title="Split Horizontal"]');
    await page.waitForTimeout(2000);
    
    // 6. Verify we have 2 terminals
    const terminals = page.locator('.terminal-container');
    const terminalCount = await terminals.count();
    console.log(`   - Número de terminales: ${terminalCount}`);
    
    if (terminalCount !== 2) {
      throw new Error(`Se esperaban 2 terminales, pero hay ${terminalCount}`);
    }
    
    // 7. Execute command in second terminal
    console.log('6. Ejecutando comando en terminal 2...');
    const terminal2Container = terminals.nth(1);
    await terminal2Container.click();
    await page.waitForTimeout(500);
    await page.keyboard.type('echo "Terminal 2"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 8. Take screenshot before refresh
    console.log('7. Tomando screenshot antes del refresh...');
    await page.screenshot({ 
      path: 'before-refresh-panels.png',
      fullPage: true 
    });
    
    // 9. Get terminal dimensions before refresh
    const terminal1Box = await terminals.nth(0).boundingBox();
    const terminal2Box = await terminals.nth(1).boundingBox();
    console.log(`   - Terminal 1 dimensiones: ${terminal1Box.width}x${terminal1Box.height}`);
    console.log(`   - Terminal 2 dimensiones: ${terminal2Box.width}x${terminal2Box.height}`);
    
    // 10. Refresh page
    console.log('\n8. 🔄 ACTUALIZANDO PÁGINA (F5)...\n');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // 11. Wait for terminals to restore
    console.log('9. Esperando restauración de terminales...');
    await page.waitForSelector('.terminal-container', { timeout: 10000 });
    const terminalsAfter = page.locator('.terminal-container');
    const terminalCountAfter = await terminalsAfter.count();
    
    console.log(`   - Número de terminales después del refresh: ${terminalCountAfter}`);
    
    // 12. Take screenshot after refresh
    console.log('10. Tomando screenshot después del refresh...');
    await page.screenshot({ 
      path: 'after-refresh-panels.png',
      fullPage: true 
    });
    
    // 13. Verify results
    console.log('\n11. RESULTADOS:');
    
    // Check terminal count
    if (terminalCountAfter === 2) {
      console.log('   ✅ OK: Se mantienen los 2 terminales');
      
      // Check dimensions
      const terminal1BoxAfter = await terminalsAfter.nth(0).boundingBox();
      const terminal2BoxAfter = await terminalsAfter.nth(1).boundingBox();
      
      console.log(`   - Terminal 1 después: ${terminal1BoxAfter.width}x${terminal1BoxAfter.height}`);
      console.log(`   - Terminal 2 después: ${terminal2BoxAfter.width}x${terminal2BoxAfter.height}`);
      
      // Check if dimensions are similar (allowing small differences)
      const widthDiff1 = Math.abs(terminal1Box.width - terminal1BoxAfter.width);
      const heightDiff1 = Math.abs(terminal1Box.height - terminal1BoxAfter.height);
      
      if (widthDiff1 < 50 && heightDiff1 < 50) {
        console.log('   ✅ OK: Las dimensiones se mantienen');
      } else {
        console.log('   ❌ FALLO: Las dimensiones cambiaron significativamente');
      }
      
      // Test functionality
      console.log('\n12. Probando funcionalidad después del refresh...');
      await terminalsAfter.nth(0).click();
      await page.waitForTimeout(500);
      await page.keyboard.type('echo "Test después de refresh"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      const terminal1Content = await page.locator('.xterm-rows').first().textContent();
      if (terminal1Content.includes('Test después de refresh')) {
        console.log('   ✅ OK: Terminal 1 responde correctamente');
      } else {
        console.log('   ❌ FALLO: Terminal 1 no responde');
      }
      
    } else {
      console.log(`   ❌ FALLO: Se esperaban 2 terminales pero hay ${terminalCountAfter}`);
      throw new Error('La distribución de paneles no se mantuvo después del refresh');
    }
    
    console.log('\n=== FIN DEL TEST ===\n');
  });
});