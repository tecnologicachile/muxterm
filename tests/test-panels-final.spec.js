const { test, expect } = require('@playwright/test');

test.describe('Panel Distribution Tests', () => {
  // Configurar timeouts más largos
  test.use({ 
    timeout: 120000,
    actionTimeout: 30000 
  });

  test('Panel distribution persists after page refresh - Full Test', async ({ page }) => {
    console.log('\n🚀 INICIANDO TEST COMPLETO DE DISTRIBUCIÓN DE PANELES\n');
    
    // Configurar listeners para debug
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console Error:', msg.text());
      }
    });

    page.on('requestfailed', request => {
      console.log('❌ Request failed:', request.url());
    });
    
    // 1. Navegar a la aplicación
    console.log('1. Navegando a la aplicación...');
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // 2. Login
    console.log('2. Realizando login...');
    
    // Esperar a que los campos estén visibles
    await page.waitForSelector('input', { state: 'visible' });
    
    // Llenar credenciales
    const usernameInput = page.locator('input').first();
    const passwordInput = page.locator('input').nth(1);
    
    await usernameInput.fill('test');
    await passwordInput.fill('test123');
    
    // Screenshot antes del login
    await page.screenshot({ path: 'test-screenshots/1-before-login.png' });
    
    // Click en login y esperar respuesta
    console.log('   - Haciendo click en LOGIN...');
    await page.click('button:has-text("LOGIN")');
    
    // Esperar un poco para que se procese
    await page.waitForTimeout(3000);
    
    // Verificar si llegamos a la página de sesiones
    try {
      await page.waitForSelector('text=Sessions', { timeout: 10000 });
      console.log('   ✅ Login exitoso - Página de sesiones cargada');
    } catch (e) {
      // Si no llegamos a sesiones, verificar si hay un error
      await page.screenshot({ path: 'test-screenshots/2-login-failed.png' });
      const pageContent = await page.content();
      if (pageContent.includes('Invalid credentials') || pageContent.includes('Login failed')) {
        throw new Error('Login falló - Credenciales inválidas');
      }
      throw new Error('Login no redirigió a la página de sesiones');
    }
    
    // 3. Crear nueva sesión
    console.log('3. Creando nueva sesión...');
    
    // Buscar y hacer click en New Session
    const newSessionBtn = page.locator('button:has-text("New Session")');
    await newSessionBtn.waitFor({ state: 'visible' });
    await newSessionBtn.click();
    
    // Esperar a que aparezca el terminal
    await page.waitForTimeout(3000);
    
    // 4. Verificar terminal principal
    console.log('4. Verificando terminal principal...');
    const terminal1 = page.locator('.xterm-rows').first();
    await terminal1.waitFor({ state: 'visible', timeout: 10000 });
    
    // Ejecutar comando en terminal 1
    await page.keyboard.type('echo "Terminal 1 - Antes del split"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ path: 'test-screenshots/3-terminal1-ready.png' });
    
    // 5. Dividir panel
    console.log('5. Dividiendo panel horizontalmente...');
    
    // Buscar botón de split
    const splitBtn = page.locator('button[title="Split Horizontal"]');
    await splitBtn.waitFor({ state: 'visible' });
    await splitBtn.click();
    await page.waitForTimeout(2000);
    
    // 6. Verificar dos terminales
    console.log('6. Verificando que hay 2 terminales...');
    const terminals = page.locator('.terminal-container');
    const count = await terminals.count();
    
    if (count !== 2) {
      await page.screenshot({ path: 'test-screenshots/4-split-failed.png' });
      throw new Error(`Se esperaban 2 terminales pero hay ${count}`);
    }
    console.log(`   ✅ ${count} terminales encontrados`);
    
    // 7. Ejecutar comando en terminal 2
    console.log('7. Ejecutando comando en terminal 2...');
    await terminals.nth(1).click();
    await page.waitForTimeout(500);
    await page.keyboard.type('echo "Terminal 2 - Después del split"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Capturar estado antes del refresh
    await page.screenshot({ 
      path: 'test-screenshots/5-before-refresh.png',
      fullPage: true 
    });
    
    // Obtener dimensiones antes del refresh
    const dims1Before = await terminals.nth(0).boundingBox();
    const dims2Before = await terminals.nth(1).boundingBox();
    console.log(`   Terminal 1: ${dims1Before.width}x${dims1Before.height}`);
    console.log(`   Terminal 2: ${dims2Before.width}x${dims2Before.height}`);
    
    // 8. REFRESH DE PÁGINA
    console.log('\n8. 🔄 ACTUALIZANDO PÁGINA (F5)...\n');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    
    // 9. Verificar estado después del refresh
    console.log('9. Verificando estado después del refresh...');
    
    // Esperar a que se carguen los terminales
    await page.waitForSelector('.terminal-container', { timeout: 15000 });
    
    const terminalsAfter = page.locator('.terminal-container');
    const countAfter = await terminalsAfter.count();
    
    console.log(`   - Terminales después del refresh: ${countAfter}`);
    
    // Screenshot después del refresh
    await page.screenshot({ 
      path: 'test-screenshots/6-after-refresh.png',
      fullPage: true 
    });
    
    // 10. Verificación final
    console.log('\n10. RESULTADOS FINALES:');
    
    if (countAfter === 2) {
      console.log('   ✅ ÉXITO: Los 2 terminales se mantuvieron');
      
      // Verificar dimensiones
      const dims1After = await terminalsAfter.nth(0).boundingBox();
      const dims2After = await terminalsAfter.nth(1).boundingBox();
      
      const widthDiff = Math.abs(dims1Before.width - dims1After.width);
      const heightDiff = Math.abs(dims1Before.height - dims1After.height);
      
      if (widthDiff < 50 && heightDiff < 50) {
        console.log('   ✅ Las dimensiones se mantuvieron');
      } else {
        console.log('   ⚠️  Las dimensiones cambiaron significativamente');
      }
      
      // Probar funcionalidad
      console.log('\n11. Probando funcionalidad post-refresh...');
      await terminalsAfter.first().click();
      await page.waitForTimeout(500);
      await page.keyboard.type('echo "Funciona después del refresh"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Screenshot final
      await page.screenshot({ 
        path: 'test-screenshots/7-final-test.png',
        fullPage: true 
      });
      
      const terminalContent = await page.locator('.xterm-rows').first().textContent();
      if (terminalContent.includes('Funciona después del refresh')) {
        console.log('   ✅ Terminal funciona correctamente');
        console.log('\n🎉 TEST COMPLETADO EXITOSAMENTE\n');
      } else {
        console.log('   ❌ Terminal no responde correctamente');
        throw new Error('Terminal no funcional después del refresh');
      }
      
    } else {
      console.log(`   ❌ FALLO: Se esperaban 2 terminales pero hay ${countAfter}`);
      throw new Error('La distribución de paneles no se mantuvo');
    }
  });
});