const { test, expect } = require('@playwright/test');

test('Simple Login Test', async ({ page }) => {
  console.log('🔍 TEST DE LOGIN SIMPLE\n');
  
  // Habilitar logs de consola
  page.on('console', msg => console.log('Browser console:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('Page error:', err));
  
  // 1. Ir a la página
  console.log('1. Navegando a http://localhost:3003...');
  await page.goto('http://localhost:3003');
  await page.waitForTimeout(2000);
  
  // 2. Verificar que estamos en la página de login
  const title = await page.textContent('h4');
  console.log(`   - Título encontrado: "${title}"`);
  
  // 3. Verificar campos
  const inputs = await page.locator('input').count();
  console.log(`   - Número de inputs: ${inputs}`);
  
  // 4. Llenar formulario
  console.log('\n2. Llenando formulario...');
  await page.fill('input[name="username"]', 'test');
  await page.fill('input[name="password"]', 'test123');
  
  // Screenshot antes del click
  await page.screenshot({ path: 'test-screenshots/login-before-click.png' });
  
  // 5. Hacer click en login
  console.log('3. Haciendo click en LOGIN...');
  
  // Interceptar requests para ver qué pasa
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log(`   📤 Request: ${request.method()} ${request.url()}`);
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`   📥 Response: ${response.status()} ${response.url()}`);
    }
  });
  
  // Click y esperar
  await page.click('button[type="submit"]');
  
  // Esperar un poco
  await page.waitForTimeout(5000);
  
  // 6. Verificar dónde estamos
  console.log('\n4. Verificando resultado...');
  const currentUrl = page.url();
  console.log(`   - URL actual: ${currentUrl}`);
  
  // Screenshot después del click
  await page.screenshot({ path: 'test-screenshots/login-after-click.png' });
  
  // Buscar indicadores de éxito
  try {
    // Opción 1: Buscamos "Sessions"
    const sessionsText = await page.locator('text=Sessions').first();
    if (await sessionsText.isVisible()) {
      console.log('   ✅ Login exitoso - Página de sesiones visible');
      return;
    }
  } catch (e) {}
  
  try {
    // Opción 2: Buscamos "New Session"
    const newSessionBtn = await page.locator('button:has-text("New Session")').first();
    if (await newSessionBtn.isVisible()) {
      console.log('   ✅ Login exitoso - Botón New Session visible');
      return;
    }
  } catch (e) {}
  
  // Si llegamos aquí, el login falló
  const pageContent = await page.content();
  
  // Buscar mensajes de error
  if (pageContent.includes('Invalid') || pageContent.includes('failed')) {
    console.log('   ❌ Login falló - Credenciales inválidas');
  } else if (currentUrl.includes('login') || currentUrl === 'http://localhost:3003/') {
    console.log('   ❌ Login no redirigió - Seguimos en la página de login');
  } else {
    console.log('   ❓ Estado desconocido');
  }
  
  // Imprimir algo del contenido para debug
  const bodyText = await page.locator('body').textContent();
  console.log('\n📄 Contenido de la página (primeros 200 caracteres):');
  console.log(bodyText.substring(0, 200) + '...');
});