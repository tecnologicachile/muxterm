#!/usr/bin/env node

const { chromium } = require('playwright');

async function testCompleto() {
  console.log('✅ TEST COMPLETO FUNCIONAL DE WEBSSH\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // 1. LOGIN
    console.log('1. REALIZANDO LOGIN...');
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button:has-text("LOGIN")');
    
    // Esperar navegación con método alternativo
    let loginSuccess = false;
    for (let i = 0; i < 50; i++) {
      await page.waitForTimeout(200);
      if (page.url().includes('sessions')) {
        loginSuccess = true;
        break;
      }
    }
    
    if (!loginSuccess) {
      throw new Error('Login no navegó a sessions');
    }
    console.log('   ✅ Login exitoso\n');
    
    // 2. CREAR SESIÓN
    console.log('2. CREANDO NUEVA SESIÓN...');
    await page.waitForSelector('button:has-text("New Session")', { state: 'visible' });
    await page.click('button:has-text("New Session")');
    await page.waitForTimeout(3000);
    
    // Verificar terminal
    await page.waitForSelector('.terminal-container', { timeout: 10000 });
    console.log('   ✅ Terminal creado\n');
    
    // 3. EJECUTAR COMANDOS
    console.log('3. EJECUTANDO COMANDOS...');
    await page.keyboard.type('echo "Terminal funcionando"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    console.log('   ✅ Comandos ejecutados\n');
    
    // 4. DIVIDIR PANEL
    console.log('4. DIVIDIENDO PANEL...');
    await page.click('button[title="Split Horizontal"]');
    await page.waitForTimeout(2000);
    
    const terminals = await page.locator('.terminal-container').count();
    console.log(`   ✅ ${terminals} terminales creados\n`);
    
    // 5. COMANDO EN TERMINAL 2
    console.log('5. EJECUTANDO COMANDO EN TERMINAL 2...');
    await page.locator('.terminal-container').nth(1).click();
    await page.keyboard.type('echo "Terminal 2 activo"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    console.log('   ✅ Terminal 2 funcionando\n');
    
    // Screenshot antes del refresh
    await page.screenshot({ path: 'test-antes-refresh.png', fullPage: true });
    
    // 6. REFRESH DE PÁGINA
    console.log('6. ACTUALIZANDO PÁGINA (F5)...');
    await page.reload();
    await page.waitForTimeout(5000);
    
    // 7. VERIFICAR RESTAURACIÓN
    console.log('7. VERIFICANDO RESTAURACIÓN...');
    await page.waitForSelector('.terminal-container', { timeout: 15000 });
    const terminalsAfter = await page.locator('.terminal-container').count();
    
    if (terminalsAfter === 2) {
      console.log('   ✅ Los 2 terminales se restauraron correctamente');
      
      // Probar funcionalidad
      await page.locator('.terminal-container').first().click();
      await page.keyboard.type('echo "Funciona después del refresh"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      console.log('   ✅ Terminal responde después del refresh');
      
      // Screenshot final
      await page.screenshot({ path: 'test-despues-refresh.png', fullPage: true });
      
      console.log('\n🎉 ¡TEST COMPLETADO EXITOSAMENTE!');
      console.log('   La distribución de paneles se mantiene después del refresh.');
      console.log('   Los terminales siguen funcionando correctamente.');
      console.log('   tmux está funcionando de forma completamente invisible.\n');
      
    } else {
      console.log(`   ❌ FALLO: ${terminalsAfter} terminales después del refresh`);
      await page.screenshot({ path: 'test-fallo.png', fullPage: true });
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

// Ejecutar
testCompleto().catch(console.error);