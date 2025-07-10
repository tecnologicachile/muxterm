#!/usr/bin/env node

const { chromium, devices } = require('playwright');

async function testMobile() {
  console.log('🔹 TESTING MOBILE VERSION OF WEBSSH\n');
  
  // Simular diferentes dispositivos móviles
  const devicesToTest = [
    'iPhone 12',
    'Pixel 5',
    'iPad (gen 7)'
  ];
  
  const browser = await chromium.launch({ 
    headless: true
  });
  
  for (const deviceName of devicesToTest) {
    console.log(`\n📱 Testing on ${deviceName}...`);
    
    // Crear contexto con emulación de dispositivo
    const context = await browser.newContext({
      ...devices[deviceName],
      locale: 'es-ES',
      permissions: ['clipboard-read', 'clipboard-write']
    });
    
    const page = await context.newPage();
    
    try {
      // 1. Ir al login
      console.log('  1. Navegando al login...');
      await page.goto('http://localhost:3002');
      await page.waitForLoadState('networkidle');
      
      // Captura del login móvil
      await page.screenshot({ 
        path: `test-mobile-${deviceName.replace(/\s+/g, '-')}-login.png`,
        fullPage: true 
      });
      
      // 2. Hacer login
      console.log('  2. Haciendo login...');
      await page.fill('input[name="username"]', 'test');
      await page.fill('input[name="password"]', 'test123');
      await page.click('button[type="submit"]');
      
      // Esperar navegación
      await page.waitForURL('**/sessions', { timeout: 10000 });
      console.log('  ✅ Login exitoso');
      
      // 3. Crear nueva sesión
      console.log('  3. Creando sesión...');
      await page.waitForSelector('button:has-text("New Session")', { timeout: 5000 });
      await page.click('button:has-text("New Session")');
      
      // Esperar navegación de forma más flexible
      try {
        await page.waitForURL('**/terminal/**', { timeout: 10000 });
      } catch (e) {
        console.log('  ⚠️  No navegó automáticamente, verificando URL actual...');
        const currentUrl = page.url();
        console.log('  URL actual:', currentUrl);
        if (!currentUrl.includes('/terminal/')) {
          throw new Error('No se pudo navegar al terminal');
        }
      }
      
      // 4. Esperar que cargue el terminal
      await page.waitForSelector('.terminal-container', { timeout: 10000 });
      await page.waitForTimeout(3000); // Dar tiempo para que se inicialice
      
      // Captura del terminal móvil
      await page.screenshot({ 
        path: `test-mobile-${deviceName.replace(/\s+/g, '-')}-terminal.png`,
        fullPage: true 
      });
      
      // 5. Probar el teclado móvil
      console.log('  4. Probando entrada de teclado...');
      
      // Hacer clic en el terminal para activarlo
      const terminal = await page.locator('.terminal-container').first();
      await terminal.click();
      await page.waitForTimeout(1000);
      
      // Verificar si existe el botón de teclado (solo en móviles)
      const keyboardButton = await page.locator('[data-testid="keyboard-button"], .MuiIconButton-root:has(.MuiSvgIcon-root[data-testid*="KeyboardIcon"])');
      const hasKeyboardButton = await keyboardButton.count() > 0;
      
      console.log(`  📱 Botón de teclado visible: ${hasKeyboardButton ? 'SÍ' : 'NO'}`);
      
      if (hasKeyboardButton) {
        // Hacer clic en el botón de teclado
        await keyboardButton.click();
        await page.waitForTimeout(1000);
      }
      
      // Intentar escribir usando diferentes métodos
      console.log('  5. Escribiendo en el terminal...');
      
      // Método 1: Escribir directamente
      await page.keyboard.type('echo "Hola desde ' + deviceName + '"');
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Captura después de escribir
      await page.screenshot({ 
        path: `test-mobile-${deviceName.replace(/\s+/g, '-')}-typed.png`,
        fullPage: true 
      });
      
      // 6. Probar división de pantalla
      console.log('  6. Probando división de pantalla...');
      const splitButton = await page.locator('button:has-text("Split")');
      if (await splitButton.isVisible()) {
        await splitButton.click();
        await page.click('text=Split Horizontal');
        await page.waitForTimeout(2000);
        
        const terminalCount = await page.locator('.terminal-container').count();
        console.log(`  ✅ Terminales después de split: ${terminalCount}`);
        
        await page.screenshot({ 
          path: `test-mobile-${deviceName.replace(/\s+/g, '-')}-split.png`,
          fullPage: true 
        });
      }
      
      // 7. Verificar responsividad
      console.log('  7. Verificando diseño responsivo...');
      
      // Verificar que no hay scroll horizontal
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      const hasHorizontalScroll = bodyWidth > viewportWidth;
      
      console.log(`  📏 Ancho body: ${bodyWidth}px, Viewport: ${viewportWidth}px`);
      console.log(`  📏 Scroll horizontal: ${hasHorizontalScroll ? 'SÍ (PROBLEMA!)' : 'NO (OK)'}`);
      
      // Verificar altura del header
      const toolbarHeight = await page.locator('.toolbar').evaluate(el => el.offsetHeight);
      console.log(`  📏 Altura del toolbar: ${toolbarHeight}px`);
      
      console.log(`\n✅ Test completado para ${deviceName}`);
      
    } catch (error) {
      console.error(`\n❌ Error en ${deviceName}:`, error.message);
      await page.screenshot({ 
        path: `test-mobile-${deviceName.replace(/\s+/g, '-')}-error.png`,
        fullPage: true 
      });
    } finally {
      await context.close();
    }
  }
  
  await browser.close();
  
  console.log('\n🎉 TESTS MÓVILES COMPLETADOS');
  console.log('\nCapturas guardadas:');
  for (const device of devicesToTest) {
    const deviceSlug = device.replace(/\s+/g, '-');
    console.log(`  - test-mobile-${deviceSlug}-login.png`);
    console.log(`  - test-mobile-${deviceSlug}-terminal.png`);
    console.log(`  - test-mobile-${deviceSlug}-typed.png`);
    console.log(`  - test-mobile-${deviceSlug}-split.png`);
  }
}

// Ejecutar
testMobile().catch(console.error);