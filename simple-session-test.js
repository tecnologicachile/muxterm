const { chromium } = require('playwright');

async function testLoginAndSession() {
  console.log('=== TEST DE LOGIN Y CREACIÓN DE SESIÓN ===\n');
  
  const browser = await chromium.launch({
    headless: true
  });
  
  const page = await browser.newPage();
  
  try {
    // 1. Navigate to app
    console.log('1. Navegando a http://localhost:3002...');
    await page.goto('http://localhost:3002');
    
    // 2. Login
    console.log('2. Haciendo login...');
    await page.fill('input[type="text"]', 'test');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    // Wait for sessions page
    await page.waitForURL('**/sessions', { timeout: 5000 });
    console.log('   ✅ Login exitoso');
    
    // 3. Create session
    console.log('3. Creando nueva sesión...');
    await page.click('button:has-text("New Session")');
    
    // Wait for dialog
    await page.waitForSelector('text=Create New Session', { timeout: 5000 });
    
    // Fill session name
    const sessionInput = await page.waitForSelector('div[role="dialog"] input[type="text"]');
    await sessionInput.fill('Test Session');
    
    // Create session
    await page.click('div[role="dialog"] button:has-text("Create")');
    
    // Wait for terminal page
    console.log('4. Esperando redirección a terminal...');
    await page.waitForURL('**/terminal/**', { timeout: 10000 });
    console.log('   ✅ Sesión creada exitosamente');
    
    // Wait for terminal to be visible
    console.log('5. Esperando que el terminal sea visible...');
    await page.waitForSelector('.xterm-screen', { timeout: 10000 });
    console.log('   ✅ Terminal visible');
    
    // Test terminal
    console.log('6. Probando terminal...');
    await page.keyboard.type('echo "Hola desde Playwright"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-success.png' });
    console.log('   ✅ Screenshot guardado como test-success.png');
    
    console.log('\n✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await page.screenshot({ path: 'test-error.png' });
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
testLoginAndSession().catch(console.error);