#!/usr/bin/env node

const { chromium, devices } = require('playwright');

async function testMobileSimple() {
  console.log('📱 TEST SIMPLE DE RESPONSIVIDAD MÓVIL\n');
  
  const browser = await chromium.launch({ headless: true });
  
  // Test 1: iPhone 12
  console.log('1. Probando en iPhone 12...');
  const iPhoneContext = await browser.newContext({
    ...devices['iPhone 12'],
    locale: 'es-ES'
  });
  
  const page = await iPhoneContext.newPage();
  
  try {
    // Navegar al login
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');
    
    // Verificar diseño responsivo del login
    const loginForm = await page.locator('.auth-form');
    const formBox = await loginForm.boundingBox();
    const viewport = page.viewportSize();
    
    console.log(`   Viewport: ${viewport.width}x${viewport.height}`);
    console.log(`   Form: ${formBox.width}x${formBox.height}`);
    console.log(`   Form ocupa ${Math.round(formBox.width / viewport.width * 100)}% del ancho`);
    
    // Verificar que no hay scroll horizontal
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    
    console.log(`   Scroll horizontal: ${hasHorizontalScroll ? '❌ SÍ' : '✅ NO'}`);
    
    // Tomar captura
    await page.screenshot({ 
      path: 'mobile-test-iphone-login.png',
      fullPage: true 
    });
    
    // Hacer login
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    // Esperar a llegar a sessions
    await page.waitForURL('**/sessions', { timeout: 10000 });
    console.log('   ✅ Login exitoso');
    
    // Verificar página de sesiones
    await page.screenshot({ 
      path: 'mobile-test-iphone-sessions.png',
      fullPage: true 
    });
    
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    await page.screenshot({ path: 'mobile-test-iphone-error.png' });
  }
  
  await iPhoneContext.close();
  
  // Test 2: Android (Pixel 5)
  console.log('\n2. Probando en Pixel 5...');
  const androidContext = await browser.newContext({
    ...devices['Pixel 5'],
    locale: 'es-ES'
  });
  
  const androidPage = await androidContext.newPage();
  
  try {
    await androidPage.goto('http://localhost:3002');
    await androidPage.waitForLoadState('networkidle');
    
    // Verificar diseño
    const viewport = androidPage.viewportSize();
    console.log(`   Viewport: ${viewport.width}x${viewport.height}`);
    
    // Verificar elementos del login
    const title = await androidPage.locator('h4:has-text("WebSSH")');
    const titleVisible = await title.isVisible();
    console.log(`   Título visible: ${titleVisible ? '✅' : '❌'}`);
    
    const inputs = await androidPage.locator('input').count();
    console.log(`   Campos de entrada: ${inputs}`);
    
    await androidPage.screenshot({ 
      path: 'mobile-test-android-login.png',
      fullPage: true 
    });
    
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
  
  await androidContext.close();
  
  // Test 3: Viewport personalizado pequeño
  console.log('\n3. Probando viewport móvil genérico (360x640)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 360, height: 640 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36',
    hasTouch: true,
    isMobile: true
  });
  
  const mobilePage = await mobileContext.newPage();
  
  try {
    await mobilePage.goto('http://localhost:3002');
    await mobilePage.waitForLoadState('networkidle');
    
    // Verificar CSS responsivo
    const authForm = await mobilePage.locator('.auth-form');
    const computedStyles = await authForm.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        width: styles.width,
        padding: styles.padding,
        minWidth: styles.minWidth,
        boxShadow: styles.boxShadow
      };
    });
    
    console.log('   Estilos aplicados:');
    console.log(`   - Ancho: ${computedStyles.width}`);
    console.log(`   - Padding: ${computedStyles.padding}`);
    console.log(`   - Min-width: ${computedStyles.minWidth}`);
    console.log(`   - Box-shadow: ${computedStyles.boxShadow}`);
    
    await mobilePage.screenshot({ 
      path: 'mobile-test-generic-login.png',
      fullPage: true 
    });
    
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
  
  await mobileContext.close();
  await browser.close();
  
  console.log('\n✅ Tests completados');
  console.log('\nCapturas guardadas:');
  console.log('  - mobile-test-iphone-login.png');
  console.log('  - mobile-test-iphone-sessions.png');
  console.log('  - mobile-test-android-login.png');
  console.log('  - mobile-test-generic-login.png');
}

// Ejecutar
testMobileSimple().catch(console.error);