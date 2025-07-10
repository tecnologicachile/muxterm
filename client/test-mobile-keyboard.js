#!/usr/bin/env node

const { chromium, devices } = require('playwright');

async function testMobileKeyboard() {
  console.log('⌨️  TEST DE TECLADO MÓVIL EN WEBSSH\n');
  
  const browser = await chromium.launch({ headless: true });
  
  // Usar iPhone como dispositivo de prueba
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    locale: 'es-ES'
  });
  
  const page = await context.newPage();
  
  // Habilitar logs de consola para debugging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('   ❌ Error en consola:', msg.text());
    }
  });
  
  try {
    // 1. Login
    console.log('1. Haciendo login...');
    await page.goto('http://localhost:3002');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions', { timeout: 10000 });
    
    // 2. Crear sesión
    console.log('2. Creando nueva sesión...');
    await page.click('button:has-text("New Session")');
    
    // Esperar el diálogo de creación
    await page.waitForSelector('.MuiDialog-root', { timeout: 5000 });
    console.log('   Diálogo de creación detectado');
    
    // Hacer clic en el botón Create del diálogo
    await page.click('.MuiDialog-root button:has-text("Create")');
    
    // Esperar navegación al terminal
    await page.waitForURL('**/terminal/**', { timeout: 10000 });
    
    // Verificar si llegamos al terminal
    const url = page.url();
    console.log('   URL actual:', url);
    
    if (url.includes('/terminal/')) {
      console.log('   ✅ Navegación al terminal exitosa');
      
      // 3. Esperar que cargue el terminal
      console.log('3. Esperando que cargue el terminal...');
      try {
        // Intentar diferentes selectores
        try {
          await page.waitForSelector('.terminal-container, .xterm, [data-panel-id]', { timeout: 10000 });
        } catch (e) {
          console.log('   ⚠️  No se encontró .terminal-container, buscando alternativas...');
          const xtermExists = await page.locator('.xterm').count() > 0;
          const panelExists = await page.locator('[data-panel-id]').count() > 0;
          console.log(`   .xterm existe: ${xtermExists}`);
          console.log(`   [data-panel-id] existe: ${panelExists}`);
          
          if (!xtermExists && !panelExists) {
            throw new Error('No se encontró ningún elemento de terminal');
          }
        }
        await page.waitForTimeout(2000); // Dar tiempo para inicialización
        
        // 4. Verificar elementos móviles
        console.log('4. Verificando elementos específicos de móvil...');
        
        // Buscar el botón de teclado
        const keyboardButton = await page.locator('.MuiIconButton-root svg path[d*="M20 5H4c-1.1"]');
        const hasKeyboardButton = await keyboardButton.count() > 0;
        console.log(`   Botón de teclado visible: ${hasKeyboardButton ? '✅ SÍ' : '❌ NO'}`);
        
        // Verificar si hay input oculto
        const hiddenInput = await page.locator('input[type="text"][style*="position: absolute"]');
        const hasHiddenInput = await hiddenInput.count() > 0;
        console.log(`   Input oculto para móvil: ${hasHiddenInput ? '✅ SÍ' : '❌ NO'}`);
        
        // 5. Intentar activar el terminal
        console.log('5. Activando terminal...');
        // Buscar el terminal por varios selectores posibles
        let terminal = await page.locator('.terminal-container').first();
        if (await terminal.count() === 0) {
          terminal = await page.locator('.xterm').first();
        }
        if (await terminal.count() === 0) {
          terminal = await page.locator('[data-panel-id]').first();
        }
        
        if (await terminal.count() > 0) {
          await terminal.click();
          await page.waitForTimeout(1000);
        } else {
          console.log('   ⚠️  No se pudo encontrar el terminal para hacer clic');
        }
        
        // 6. Si hay botón de teclado, hacer clic
        if (hasKeyboardButton) {
          console.log('6. Haciendo clic en botón de teclado...');
          const button = await page.locator('.MuiIconButton-root:has(svg path[d*="M20 5H4c-1.1"])');
          await button.click();
          await page.waitForTimeout(1000);
        }
        
        // 7. Simular escritura
        console.log('7. Simulando escritura...');
        await page.keyboard.type('pwd');
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        // Capturar resultado
        await page.screenshot({ 
          path: 'mobile-keyboard-test-result.png',
          fullPage: true 
        });
        
        // 8. Verificar si el texto aparece en el terminal
        console.log('8. Verificando salida del terminal...');
        const terminalContent = await terminal.textContent();
        console.log('   Contenido del terminal (primeros 200 chars):');
        console.log('   ', terminalContent.substring(0, 200).replace(/\n/g, '\\n'));
        
      } catch (error) {
        console.error('   ❌ Error al cargar terminal:', error.message);
        await page.screenshot({ path: 'mobile-keyboard-test-error.png' });
      }
      
    } else {
      console.log('   ❌ No se pudo navegar al terminal');
      
      // Verificar si hay algún diálogo o modal
      const dialogs = await page.locator('.MuiDialog-root').count();
      if (dialogs > 0) {
        console.log('   ℹ️  Se detectó un diálogo/modal');
        const dialogContent = await page.locator('.MuiDialog-root').textContent();
        console.log('   Contenido:', dialogContent.substring(0, 100));
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error general:', error.message);
    await page.screenshot({ path: 'mobile-keyboard-test-fatal-error.png' });
  }
  
  await context.close();
  await browser.close();
  
  console.log('\n✅ Test completado');
}

// Ejecutar
testMobileKeyboard().catch(console.error);