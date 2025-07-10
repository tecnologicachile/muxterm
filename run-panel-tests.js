const { execSync } = require('child_process');
const fs = require('fs');

console.log('🧪 INICIANDO TESTS DE DISTRIBUCIÓN DE PANELES\n');

let successCount = 0;
let failCount = 0;
const iterations = 15;

// Función para ejecutar test
function runTest(iteration) {
  console.log(`\n📊 ITERACIÓN ${iteration}/${iterations}`);
  console.log('='.repeat(50));
  
  try {
    // Ejecutar el test
    execSync('npx playwright test tests/test-panel-distribution.spec.js --reporter=json', {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    successCount++;
    console.log(`✅ Test ${iteration} PASÓ`);
    
  } catch (error) {
    failCount++;
    console.log(`❌ Test ${iteration} FALLÓ`);
    
    // Guardar screenshot del error
    const screenshotSrc = 'test-results/test-panel-distribution-Te-6e983-intained-after-page-refresh-chromium/test-failed-1.png';
    const screenshotDest = `error-screenshots/iteration-${iteration}-error.png`;
    
    if (!fs.existsSync('error-screenshots')) {
      fs.mkdirSync('error-screenshots');
    }
    
    if (fs.existsSync(screenshotSrc)) {
      fs.copyFileSync(screenshotSrc, screenshotDest);
      console.log(`   Screenshot guardado: ${screenshotDest}`);
    }
    
    // Si es el primer fallo, mostrar detalles
    if (failCount === 1) {
      console.log('\n🔍 DETALLES DEL PRIMER ERROR:');
      console.log(error.stdout || error.message);
    }
  }
  
  // Esperar un poco entre tests
  console.log('   Esperando 2 segundos antes del siguiente test...');
  execSync('sleep 2');
}

// Limpiar sesiones tmux antes de empezar
console.log('🧹 Limpiando sesiones tmux existentes...');
try {
  execSync('tmux kill-server 2>/dev/null || true');
} catch (e) {}

// Ejecutar las iteraciones
for (let i = 1; i <= iterations; i++) {
  runTest(i);
  
  // Si hay muchos fallos consecutivos, detener
  if (failCount >= 5 && successCount === 0) {
    console.log('\n⚠️  Deteniendo tests debido a múltiples fallos consecutivos');
    break;
  }
}

// Resumen final
console.log('\n' + '='.repeat(50));
console.log('📈 RESUMEN FINAL:');
console.log(`   ✅ Exitosos: ${successCount}/${iterations} (${(successCount/iterations*100).toFixed(1)}%)`);
console.log(`   ❌ Fallidos: ${failCount}/${iterations} (${(failCount/iterations*100).toFixed(1)}%)`);

if (successCount === iterations) {
  console.log('\n🎉 ¡TODOS LOS TESTS PASARON! La aplicación está completamente depurada.');
} else if (successCount >= iterations * 0.8) {
  console.log('\n✨ La mayoría de los tests pasaron. La aplicación es estable.');
} else {
  console.log('\n⚠️  Hay problemas de estabilidad que necesitan corrección.');
}

process.exit(failCount > 0 ? 1 : 0);