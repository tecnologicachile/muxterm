#!/usr/bin/env node

const { chromium } = require('playwright');

async function manualTest() {
  console.log('🧪 TEST MANUAL DE WEBSSH\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const page = await browser.newPage();
  
  try {
    // 1. Navegar
    console.log('1. Navegando a http://localhost:3002...');
    await page.goto('http://localhost:3002');
    await page.waitForTimeout(2000);
    
    // 2. Login
    console.log('2. Realizando login...');
    
    // Escribir username
    console.log('   - Escribiendo username...');
    await page.click('input:first-of-type');
    await page.keyboard.type('test');
    
    // Escribir password
    console.log('   - Escribiendo password...');
    await page.click('input:nth-of-type(2)');
    await page.keyboard.type('test123');
    
    // Click en login
    console.log('   - Click en LOGIN...');
    await page.click('button:has-text("LOGIN")');
    
    // Esperar navegación o error
    console.log('3. Esperando resultado...');
    await page.waitForTimeout(5000);
    
    // Verificar donde estamos
    const url = page.url();
    console.log(`   - URL actual: ${url}`);
    
    // Si llegamos a sessions, continuar con el test
    if (url.includes('sessions')) {
      console.log('   ✅ Login exitoso!\n');
      
      // 4. Crear sesión
      console.log('4. Creando nueva sesión...');
      await page.click('button:has-text("New Session")');
      await page.waitForTimeout(3000);
      
      // 5. Ejecutar comando
      console.log('5. Ejecutando comando en terminal...');
      await page.keyboard.type('echo "Test manual funcionando"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // 6. Split panel
      console.log('6. Dividiendo panel...');
      await page.click('button[title="Split Horizontal"]');
      await page.waitForTimeout(2000);
      
      // 7. Screenshot antes del refresh
      console.log('7. Tomando screenshot antes del refresh...');
      await page.screenshot({ path: 'manual-test-before-refresh.png', fullPage: true });
      
      // 8. Refresh
      console.log('8. Actualizando página (F5)...');
      await page.reload();
      await page.waitForTimeout(5000);
      
      // 9. Screenshot después del refresh
      console.log('9. Tomando screenshot después del refresh...');
      await page.screenshot({ path: 'manual-test-after-refresh.png', fullPage: true });
      
      // 10. Contar terminales
      const terminals = await page.locator('.terminal-container').count();
      console.log(`\n10. RESULTADO: ${terminals} terminales después del refresh`);
      
      if (terminals === 2) {
        console.log('✅ ¡TEST EXITOSO! Los paneles se mantuvieron.');
      } else {
        console.log('❌ TEST FALLIDO: Los paneles no se mantuvieron.');
      }
      
    } else {
      console.log('   ❌ Login falló - No se llegó a la página de sesiones');
    }
    
    console.log('\n🔚 Cerrando navegador en 10 segundos...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error durante el test:', error.message);
  } finally {
    await browser.close();
  }
}

// Ejecutar
manualTest().catch(console.error);