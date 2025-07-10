const { test, expect } = require('@playwright/test');

test.describe('Verify Existing Sessions', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Check existing sessions and SMART CLEANUP', async ({ page, context }) => {
    console.log('=== VERIFICANDO SESIONES EXISTENTES ===\n');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.waitForTimeout(1000);
    
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    console.log('✓ Login exitoso');
    
    // Contar sesiones existentes
    await page.waitForTimeout(2000);
    const sessionsCount = await page.locator('div.MuiCard-root').count();
    console.log(`✓ Sesiones encontradas: ${sessionsCount}`);
    
    if (sessionsCount > 0) {
      // Entrar a la primera sesión existente
      console.log('\nEntrando a sesión existente...');
      const firstSession = await page.locator('div.MuiCard-root').first();
      await firstSession.click();
      
      await page.waitForURL('**/terminal/**');
      const url = page.url();
      const sessionId = url.split('/terminal/')[1];
      console.log(`✓ Sesión ID: ${sessionId}`);
      
      await page.waitForTimeout(2000);
      
      // Tomar screenshot antes de refrescar
      await page.screenshot({ 
        path: 'tests/screenshots/before-refresh-smart-cleanup.png', 
        fullPage: true 
      });
      
      // Refrescar para activar SMART CLEANUP
      console.log('\nRefrescando página para activar SMART CLEANUP...');
      await page.reload();
      await page.waitForTimeout(3000);
      
      // Tomar screenshot después
      await page.screenshot({ 
        path: 'tests/screenshots/after-refresh-smart-cleanup.png', 
        fullPage: true 
      });
      
      console.log('\n✅ TEST COMPLETADO!');
      console.log('Revisa el server.log para ver mensajes [SMART CLEANUP]');
      
    } else {
      console.log('\n⚠️  No hay sesiones existentes');
      console.log('Creando nueva sesión...');
      
      // Buscar botón de crear sesión
      const createButton = await page.locator('button').filter({ hasText: /create|nueva|new/i }).first();
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(2000);
        
        const newSessionsCount = await page.locator('div.MuiCard-root').count();
        console.log(`✓ Sesiones después de crear: ${newSessionsCount}`);
      }
    }
    
    // Navegar de vuelta a sesiones
    await page.goto(clientUrl + '/sessions');
    await page.waitForTimeout(2000);
    
    // Screenshot final
    await page.screenshot({ 
      path: 'tests/screenshots/sessions-final.png', 
      fullPage: true 
    });
    
    const finalCount = await page.locator('div.MuiCard-root').count();
    console.log(`\n✓ Total de sesiones al final: ${finalCount}`);
  });
});