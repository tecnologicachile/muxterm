const { chromium } = require('playwright');

async function debugLogin() {
  console.log('🔍 DEBUG DE LOGIN\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-web-security'] // Para evitar problemas de CORS en el test
  });
  
  const page = await browser.newPage();
  
  // Habilitar logs
  page.on('console', msg => console.log('Browser:', msg.text()));
  page.on('pageerror', err => console.log('Error:', err));
  
  try {
    // 1. Probar con el HTML de test
    console.log('1. Probando login con HTML de test...');
    await page.goto(`file://${__dirname}/test-login-manual.html`);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    const result1 = await page.textContent('#result');
    console.log('   Resultado HTML test:', result1.substring(0, 100));
    
    // 2. Probar con la aplicación real
    console.log('\n2. Probando login en la aplicación real...');
    await page.goto('http://localhost:3002');
    await page.waitForTimeout(1000);
    
    // Verificar que estamos en la página de login
    const pageContent = await page.content();
    console.log('   Página cargada:', pageContent.includes('WebSSH') ? 'SÍ' : 'NO');
    console.log('   Formulario presente:', pageContent.includes('LOGIN') ? 'SÍ' : 'NO');
    
    // Intentar login
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    
    // Interceptar peticiones
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`   → Request: ${request.method()} ${request.url()}`);
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`   ← Response: ${response.status()} ${response.url()}`);
      }
    });
    
    // Click en login
    console.log('\n3. Haciendo click en LOGIN...');
    await page.click('button:has-text("LOGIN")');
    
    // Esperar respuesta
    await page.waitForTimeout(3000);
    
    // Verificar resultado
    const currentUrl = page.url();
    console.log('\n4. Resultado:');
    console.log('   URL actual:', currentUrl);
    console.log('   Login exitoso:', currentUrl.includes('sessions') ? 'SÍ' : 'NO');
    
    // Si no navegó, buscar errores
    if (!currentUrl.includes('sessions')) {
      const errorText = await page.locator('text=Invalid').count();
      const errorText2 = await page.locator('text=failed').count();
      console.log('   Mensaje de error visible:', errorText > 0 || errorText2 > 0 ? 'SÍ' : 'NO');
      
      // Verificar localStorage
      const token = await page.evaluate(() => localStorage.getItem('token'));
      console.log('   Token en localStorage:', token ? 'SÍ' : 'NO');
      
      // Verificar si hay errores en consola
      await page.screenshot({ path: 'debug-login.png' });
      console.log('   Screenshot guardado: debug-login.png');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugLogin().catch(console.error);