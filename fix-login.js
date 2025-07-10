const { chromium } = require('playwright');

async function fixLogin() {
  console.log('🔧 SOLUCIONANDO PROBLEMA DE LOGIN\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Interceptar todas las peticiones
  await page.route('**/*', route => {
    console.log(`${route.request().method()} ${route.request().url()}`);
    route.continue();
  });
  
  // Habilitar logs detallados
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/auth/login')) {
      console.log(`\n📥 Login Response: ${response.status()}`);
      response.json().then(data => {
        console.log('   Data:', JSON.stringify(data, null, 2));
      }).catch(() => {});
    }
  });
  
  try {
    console.log('1. Navegando a http://localhost:3002...');
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');
    
    console.log('2. Esperando formulario...');
    await page.waitForSelector('input[name="username"]', { state: 'visible' });
    
    console.log('3. Llenando formulario...');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    
    console.log('4. Haciendo click en LOGIN...');
    
    // Evaluar directamente en el navegador
    const loginResult = await page.evaluate(async () => {
      const form = document.querySelector('form');
      if (!form) return { error: 'No se encontró el formulario' };
      
      // Buscar el botón de submit
      const button = form.querySelector('button[type="submit"]');
      if (!button) return { error: 'No se encontró el botón' };
      
      // Disparar el evento submit
      const event = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      
      // Esperar un poco
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verificar resultado
      return {
        url: window.location.href,
        token: localStorage.getItem('token'),
        user: localStorage.getItem('user')
      };
    });
    
    console.log('\n5. Resultado del login:');
    console.log('   URL:', loginResult.url);
    console.log('   Token guardado:', loginResult.token ? 'SÍ' : 'NO');
    console.log('   Usuario guardado:', loginResult.user ? 'SÍ' : 'NO');
    
    // Si no navegó, intentar navegar manualmente
    if (!loginResult.url.includes('sessions') && loginResult.token) {
      console.log('\n6. Token presente pero no navegó. Navegando manualmente...');
      await page.goto('http://localhost:3002/sessions');
      await page.waitForTimeout(2000);
      
      const finalUrl = page.url();
      console.log('   URL final:', finalUrl);
      
      // Tomar screenshot
      await page.screenshot({ path: 'sessions-page.png' });
      console.log('   Screenshot guardado: sessions-page.png');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-screenshot.png' });
  } finally {
    await browser.close();
  }
}

fixLogin().catch(console.error);