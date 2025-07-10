const { chromium } = require('playwright');

(async () => {
  console.log('Iniciando test de login...');
  
  const browser = await chromium.launch({ 
    headless: true 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Escuchar solicitudes de red
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log('>>>', request.method(), request.url());
      console.log('Headers:', request.headers());
      if (request.method() === 'POST') {
        console.log('Body:', request.postData());
      }
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log('<<<', response.status(), response.url());
      response.text().then(body => {
        console.log('Response body:', body);
      }).catch(() => {});
    }
  });
  
  // Interceptar errores de consola
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });
  
  try {
    console.log('Navegando a http://localhost:3002...');
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
    
    console.log('Esperando formulario de login...');
    await page.waitForSelector('form', { timeout: 5000 });
    
    console.log('Ingresando credenciales...');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    
    console.log('Haciendo clic en Login...');
    await page.click('button[type="submit"]');
    
    console.log('Esperando respuesta...');
    
    // Esperar navegación o mensaje de error
    try {
      await Promise.race([
        page.waitForURL('**/sessions', { timeout: 5000 }),
        page.waitForSelector('.MuiAlert-root', { timeout: 5000 })
      ]);
      
      const currentUrl = page.url();
      console.log('URL actual:', currentUrl);
      
      if (currentUrl.includes('/sessions')) {
        console.log('✓ Login exitoso!');
      } else {
        const errorText = await page.textContent('.MuiAlert-root');
        console.log('✗ Error de login:', errorText);
      }
    } catch (e) {
      console.log('✗ Timeout esperando respuesta');
      console.log('URL actual:', page.url());
      
      // Tomar screenshot
      await page.screenshot({ path: 'login-error.png' });
      console.log('Screenshot guardado en login-error.png');
    }
    
  } catch (error) {
    console.error('Error en el test:', error);
  }
  
  console.log('Presiona Enter para cerrar...');
  await new Promise(resolve => process.stdin.once('data', resolve));
  
  await browser.close();
})();