#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');

// Configuración
const ITERATIONS = 15;
const BASE_URL = 'http://localhost:3002';

async function waitForNavigation(page, targetUrl, timeout = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const currentUrl = page.url();
    if (currentUrl.includes(targetUrl)) {
      return true;
    }
    await page.waitForTimeout(100);
  }
  return false;
}

async function runSingleTest(iteration) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log(`\n📊 Iteración ${iteration}/${ITERATIONS}`);
    console.log('='.repeat(50));
    
    // 1. Login con mejor manejo
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Esperar a que los campos estén listos
    await page.waitForSelector('input[name="username"]', { state: 'visible' });
    
    // Llenar formulario
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    
    // Click en login
    await page.click('button:has-text("LOGIN")');
    
    // Esperar navegación con método personalizado
    const loginSuccess = await waitForNavigation(page, 'sessions', 10000);
    
    if (!loginSuccess) {
      // Verificar si hay error de login
      const errorElement = await page.locator('text=Invalid').count();
      if (errorElement > 0) {
        throw new Error('Login falló - credenciales inválidas');
      }
      throw new Error('Login falló - no navegó a sessions');
    }
    
    // 2. Esperar a que la página de sesiones cargue
    await page.waitForSelector('button:has-text("New Session")', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // 3. Crear nueva sesión
    await page.click('button:has-text("New Session")');
    await page.waitForTimeout(3000);
    
    // 4. Verificar terminal
    await page.waitForSelector('.terminal-container', { timeout: 10000 });
    await page.waitForSelector('.xterm-rows', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // 5. Ejecutar comando en terminal 1
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('ls');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // 6. Split panel
    const splitBtn = await page.locator('button[title="Split Horizontal"]');
    await splitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await splitBtn.click();
    await page.waitForTimeout(2000);
    
    // 7. Verificar 2 terminales antes del refresh
    const terminalsBeforeCount = await page.locator('.terminal-container').count();
    if (terminalsBeforeCount !== 2) {
      throw new Error(`Split falló - se esperaban 2 terminales, hay ${terminalsBeforeCount}`);
    }
    
    // 8. Ejecutar comando en terminal 2
    const terminal2 = page.locator('.terminal-container').nth(1);
    await terminal2.click();
    await page.waitForTimeout(500);
    await page.keyboard.type('echo "Terminal 2 activo"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Capturar dimensiones antes del refresh
    const dims1Before = await page.locator('.terminal-container').first().boundingBox();
    const dims2Before = await page.locator('.terminal-container').nth(1).boundingBox();
    
    // Screenshot antes del refresh
    await page.screenshot({ 
      path: `test-results/iteration-${iteration}-before.png`,
      fullPage: true 
    });
    
    // 9. REFRESH DE PÁGINA
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    
    // 10. Verificar restauración después del refresh
    try {
      await page.waitForSelector('.terminal-container', { timeout: 15000 });
    } catch (e) {
      throw new Error('Los terminales no se restauraron después del refresh');
    }
    
    const terminalsAfterCount = await page.locator('.terminal-container').count();
    
    // Screenshot después del refresh
    await page.screenshot({ 
      path: `test-results/iteration-${iteration}-after.png`,
      fullPage: true 
    });
    
    // 11. Verificar resultado
    if (terminalsAfterCount === 2) {
      // Verificar dimensiones
      const dims1After = await page.locator('.terminal-container').first().boundingBox();
      const dims2After = await page.locator('.terminal-container').nth(1).boundingBox();
      
      const dimsDiff = Math.abs(dims1Before.width - dims1After.width) + 
                      Math.abs(dims1Before.height - dims1After.height);
      
      if (dimsDiff > 100) {
        console.log('⚠️  Las dimensiones cambiaron significativamente');
      }
      
      // Test de funcionalidad
      await page.locator('.terminal-container').first().click();
      await page.waitForTimeout(500);
      await page.keyboard.type('echo "Funciona después del refresh"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Verificar que el terminal responde
      const terminalResponds = await page.locator('.xterm-rows').first().textContent();
      if (terminalResponds.includes('Funciona después del refresh')) {
        console.log('✅ TEST PASÓ - Distribución y funcionalidad OK');
        return true;
      } else {
        console.log('❌ TEST FALLÓ - Terminal no responde correctamente');
        return false;
      }
    } else {
      console.log(`❌ TEST FALLÓ - ${terminalsAfterCount} terminales después del refresh (esperados: 2)`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ TEST FALLÓ - ${error.message}`);
    try {
      await page.screenshot({ 
        path: `test-results/iteration-${iteration}-error.png`,
        fullPage: true 
      });
    } catch (e) {}
    return false;
  } finally {
    await browser.close();
  }
}

async function runAllTests() {
  console.log('🚀 INICIANDO TESTS FINALES DE DISTRIBUCIÓN DE PANELES');
  console.log(`📋 Configuración: ${ITERATIONS} iteraciones en ${BASE_URL}\n`);
  
  // Verificar que el servidor esté funcionando
  try {
    const testBrowser = await chromium.launch({ headless: true });
    const testPage = await testBrowser.newPage();
    await testPage.goto(BASE_URL, { timeout: 5000 });
    await testBrowser.close();
    console.log('✅ Servidor verificado y funcionando\n');
  } catch (e) {
    console.error('❌ ERROR: El servidor no está respondiendo en ' + BASE_URL);
    console.error('   Asegúrate de que el servidor esté ejecutándose.');
    process.exit(1);
  }
  
  // Crear directorio de resultados
  if (!fs.existsSync('test-results')) {
    fs.mkdirSync('test-results');
  }
  
  // Limpiar sesiones tmux antes de empezar
  try {
    require('child_process').execSync('tmux kill-server 2>/dev/null || true');
    console.log('🧹 Sesiones tmux limpiadas\n');
  } catch (e) {}
  
  let successCount = 0;
  let failCount = 0;
  const results = [];
  
  // Ejecutar todas las iteraciones
  for (let i = 1; i <= ITERATIONS; i++) {
    const success = await runSingleTest(i);
    results.push({ iteration: i, success });
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Si hay muchos fallos al principio, investigar
    if (i === 3 && successCount === 0) {
      console.log('\n⚠️  Detectados múltiples fallos. Verificando problema...');
      console.log('   - Revisa test-results/iteration-*-error.png para ver qué está pasando');
    }
    
    // Continuar con todos los tests para tener estadísticas completas
    if (i < ITERATIONS) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Resumen final detallado
  console.log('\n' + '='.repeat(60));
  console.log('📈 RESUMEN FINAL DETALLADO');
  console.log('='.repeat(60));
  console.log(`✅ Tests exitosos: ${successCount}/${ITERATIONS} (${(successCount/ITERATIONS*100).toFixed(1)}%)`);
  console.log(`❌ Tests fallidos: ${failCount}/${ITERATIONS} (${(failCount/ITERATIONS*100).toFixed(1)}%)`);
  
  // Detalles de cada iteración
  console.log('\n📊 Detalle por iteración:');
  results.forEach(r => {
    console.log(`   Iteración ${r.iteration}: ${r.success ? '✅ PASÓ' : '❌ FALLÓ'}`);
  });
  
  // Análisis de estabilidad
  console.log('\n🔍 ANÁLISIS DE ESTABILIDAD:');
  const successRate = (successCount/ITERATIONS*100);
  
  if (successRate === 100) {
    console.log('🎉 ¡PERFECTO! La aplicación está COMPLETAMENTE DEPURADA.');
    console.log('   Todos los tests pasaron. La distribución de paneles es 100% estable.');
  } else if (successRate >= 95) {
    console.log('✨ EXCELENTE: La aplicación es muy estable (>95% éxito).');
    console.log('   Solo fallos ocasionales, probablemente por timing.');
  } else if (successRate >= 80) {
    console.log('👍 BUENO: La aplicación es estable (>80% éxito).');
    console.log('   Algunos problemas menores que revisar.');
  } else if (successRate >= 50) {
    console.log('⚠️  REGULAR: Estabilidad media (50-80% éxito).');
    console.log('   Se requieren mejoras significativas.');
  } else {
    console.log('❌ CRÍTICO: Baja estabilidad (<50% éxito).');
    console.log('   Problemas graves que requieren atención inmediata.');
  }
  
  // Guardar resumen completo
  const summary = {
    date: new Date().toISOString(),
    serverUrl: BASE_URL,
    totalTests: ITERATIONS,
    passed: successCount,
    failed: failCount,
    successRate: successRate.toFixed(1) + '%',
    stabilityLevel: 
      successRate === 100 ? 'PERFECT' :
      successRate >= 95 ? 'EXCELLENT' :
      successRate >= 80 ? 'GOOD' :
      successRate >= 50 ? 'REGULAR' : 'CRITICAL',
    results: results
  };
  
  fs.writeFileSync('test-results/final-summary.json', JSON.stringify(summary, null, 2));
  console.log('\n📄 Resumen completo guardado en test-results/final-summary.json');
  console.log('🖼️  Screenshots guardados en test-results/iteration-*.png');
  
  process.exit(failCount > 0 ? 1 : 0);
}

// Ejecutar
runAllTests().catch(console.error);