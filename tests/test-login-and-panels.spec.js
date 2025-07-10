const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Test Login and Panel Distribution', () => {
  test('Login and verify panel distribution persists', async ({ page }) => {
    console.log('\n=== TEST DE LOGIN Y DISTRIBUCIÓN DE PANELES ===\n');
    
    // Increase default timeout
    test.setTimeout(60000);
    
    await page.goto('http://localhost:3002');
    
    // 1. Login with better error handling
    console.log('1. Iniciando sesión...');
    
    // Wait for login form to be visible
    await page.waitForSelector('input', { state: 'visible', timeout: 5000 });
    
    // Fill credentials
    await page.locator('input').first().fill('test');
    await page.locator('input').nth(1).fill('test123');
    
    // Click login button and wait for navigation
    await Promise.all([
      page.waitForNavigation({ url: '**/sessions**', timeout: 15000 }),
      page.click('button:has-text("LOGIN")')
    ]);
    
    console.log('   ✅ Login exitoso');
    
    // 2. Wait for sessions page
    console.log('2. Esperando página de sesiones...');
    await page.waitForSelector('text=Sessions', { timeout: 10000 });
    
    // 3. Create new session
    console.log('3. Creando nueva sesión...');
    await page.click('button:has-text("New Session")');
    await page.waitForTimeout(3000);
    
    // 4. Wait for terminal
    console.log('4. Esperando terminal...');
    const terminal1 = page.locator('.xterm-rows').first();
    await terminal1.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // 5. Test terminal functionality
    console.log('5. Probando funcionalidad del terminal...');
    await page.keyboard.type('echo "Terminal 1 OK"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // 6. Split panel
    console.log('6. Dividiendo panel...');
    const splitButton = page.locator('button[title="Split Horizontal"]');
    await splitButton.waitFor({ state: 'visible', timeout: 5000 });
    await splitButton.click();
    await page.waitForTimeout(2000);
    
    // 7. Verify two terminals
    const terminals = page.locator('.terminal-container');
    const terminalCount = await terminals.count();
    console.log(`   - Número de terminales: ${terminalCount}`);
    
    if (terminalCount !== 2) {
      throw new Error(`Se esperaban 2 terminales, pero hay ${terminalCount}`);
    }
    
    // 8. Type in second terminal
    console.log('7. Escribiendo en segundo terminal...');
    await terminals.nth(1).click();
    await page.waitForTimeout(500);
    await page.keyboard.type('echo "Terminal 2 OK"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // 9. Take screenshot before refresh
    await page.screenshot({ 
      path: 'panel-test-before-refresh.png',
      fullPage: true 
    });
    
    // 10. Refresh page
    console.log('\n8. 🔄 ACTUALIZANDO PÁGINA...\n');
    await page.reload();
    
    // 11. Wait for page to reload
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // 12. Check terminals after refresh
    console.log('9. Verificando terminales después del refresh...');
    await page.waitForSelector('.terminal-container', { timeout: 10000 });
    
    const terminalsAfter = page.locator('.terminal-container');
    const terminalCountAfter = await terminalsAfter.count();
    
    console.log(`   - Terminales después del refresh: ${terminalCountAfter}`);
    
    // 13. Take screenshot after refresh
    await page.screenshot({ 
      path: 'panel-test-after-refresh.png',
      fullPage: true 
    });
    
    // 14. Verify results
    console.log('\n10. VERIFICACIÓN FINAL:');
    
    if (terminalCountAfter === 2) {
      console.log('   ✅ Se mantienen los 2 terminales');
      
      // Test functionality
      await terminalsAfter.first().click();
      await page.waitForTimeout(500);
      await page.keyboard.type('echo "Test OK after refresh"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Check if terminal responds
      const content = await page.locator('.xterm-rows').first().textContent();
      if (content.includes('Test OK after refresh')) {
        console.log('   ✅ Terminal responde correctamente después del refresh');
      } else {
        console.log('   ❌ Terminal no responde después del refresh');
        throw new Error('Terminal no funciona después del refresh');
      }
      
    } else {
      console.log(`   ❌ FALLO: Se esperaban 2 terminales pero hay ${terminalCountAfter}`);
      throw new Error('Los paneles no se mantuvieron después del refresh');
    }
    
    console.log('\n=== TEST COMPLETADO ===\n');
  });
});