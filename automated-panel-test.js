#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');

// Configuración
const ITERATIONS = 15;
const BASE_URL = 'http://localhost:3002';

async function runSingleTest(iteration) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log(`\n📊 Iteración ${iteration}/${ITERATIONS}`);
    console.log('='.repeat(50));
    
    // 1. Login
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
    
    // Llenar credenciales
    await page.locator('input').first().fill('test');
    await page.locator('input').nth(1).fill('test123');
    await page.click('button:has-text("LOGIN")');
    
    // Esperar resultado
    await page.waitForTimeout(3000);
    
    // Verificar si llegamos a sessions
    const url = page.url();
    if (!url.includes('sessions')) {
      throw new Error('Login falló - no se llegó a sessions');
    }
    
    // 2. Crear sesión
    await page.click('button:has-text("New Session")');
    await page.waitForTimeout(3000);
    
    // 3. Verificar terminal
    await page.waitForSelector('.xterm-rows', { timeout: 5000 });
    
    // 4. Ejecutar comando
    await page.keyboard.type('echo "Terminal 1"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // 5. Split panel
    await page.click('button[title="Split Horizontal"]');
    await page.waitForTimeout(2000);
    
    // 6. Verificar 2 terminales
    const terminalsBeforeCount = await page.locator('.terminal-container').count();
    if (terminalsBeforeCount !== 2) {
      throw new Error(`Split falló - se esperaban 2 terminales, hay ${terminalsBeforeCount}`);
    }
    
    // 7. Comando en terminal 2
    await page.locator('.terminal-container').nth(1).click();
    await page.keyboard.type('echo "Terminal 2"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Screenshot antes
    await page.screenshot({ 
      path: `test-results/iteration-${iteration}-before.png`,
      fullPage: true 
    });
    
    // 8. REFRESH
    await page.reload();
    await page.waitForTimeout(5000);
    
    // 9. Verificar después del refresh
    await page.waitForSelector('.terminal-container', { timeout: 10000 });
    const terminalsAfterCount = await page.locator('.terminal-container').count();
    
    // Screenshot después
    await page.screenshot({ 
      path: `test-results/iteration-${iteration}-after.png`,
      fullPage: true 
    });
    
    // 10. Verificar resultado
    if (terminalsAfterCount === 2) {
      // Test funcionalidad
      await page.locator('.terminal-container').first().click();
      await page.keyboard.type('echo "OK"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      const content = await page.locator('.xterm-rows').first().textContent();
      if (content.includes('OK')) {
        console.log('✅ TEST PASÓ - Paneles y funcionalidad OK');
        return true;
      } else {
        console.log('❌ TEST FALLÓ - Terminal no responde');
        return false;
      }
    } else {
      console.log(`❌ TEST FALLÓ - ${terminalsAfterCount} terminales después del refresh`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ TEST FALLÓ - Error: ${error.message}`);
    await page.screenshot({ 
      path: `test-results/iteration-${iteration}-error.png`,
      fullPage: true 
    });
    return false;
  } finally {
    await browser.close();
  }
}

async function runAllTests() {
  console.log('🚀 INICIANDO TESTS AUTOMATIZADOS DE DISTRIBUCIÓN DE PANELES');
  console.log(`📋 Ejecutaremos ${ITERATIONS} iteraciones\n`);
  
  // Crear directorio de resultados
  if (!fs.existsSync('test-results')) {
    fs.mkdirSync('test-results');
  }
  
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
    
    // Si hay muchos fallos consecutivos, detener
    if (failCount >= 5 && successCount === 0) {
      console.log('\n⚠️  Deteniendo debido a múltiples fallos consecutivos');
      break;
    }
    
    // Esperar entre tests
    if (i < ITERATIONS) {
      console.log('   Esperando 2 segundos...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('📈 RESUMEN FINAL:');
  console.log('='.repeat(60));
  console.log(`✅ Exitosos: ${successCount}/${results.length} (${(successCount/results.length*100).toFixed(1)}%)`);
  console.log(`❌ Fallidos: ${failCount}/${results.length} (${(failCount/results.length*100).toFixed(1)}%)`);
  
  // Análisis de estabilidad
  console.log('\n📊 ANÁLISIS DE ESTABILIDAD:');
  if (successCount === results.length) {
    console.log('🎉 ¡PERFECTO! Todos los tests pasaron. La aplicación está completamente estable.');
  } else if (successCount >= results.length * 0.9) {
    console.log('✨ EXCELENTE: Más del 90% de éxito. La aplicación es muy estable.');
  } else if (successCount >= results.length * 0.8) {
    console.log('👍 BUENO: Más del 80% de éxito. La aplicación es estable.');
  } else if (successCount >= results.length * 0.5) {
    console.log('⚠️  REGULAR: Entre 50-80% de éxito. Hay problemas de estabilidad.');
  } else {
    console.log('❌ CRÍTICO: Menos del 50% de éxito. La aplicación tiene problemas graves.');
  }
  
  // Guardar resumen
  const summary = {
    date: new Date().toISOString(),
    totalTests: results.length,
    passed: successCount,
    failed: failCount,
    successRate: (successCount/results.length*100).toFixed(1) + '%',
    results: results
  };
  
  fs.writeFileSync('test-results/summary.json', JSON.stringify(summary, null, 2));
  console.log('\n📄 Resumen guardado en test-results/summary.json');
}

// Ejecutar
runAllTests().catch(console.error);