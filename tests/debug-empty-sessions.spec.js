const { test, expect } = require('@playwright/test');

test.describe('Debug Empty Sessions', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  let testNum = 0;
  
  // Función helper para limpiar sesiones
  async function cleanupSessions(page) {
    // Intenta eliminar todas las sesiones existentes
    const deleteAllBtn = await page.locator('button[aria-label="Delete All Sessions"]').or(
      page.locator('button').filter({ hasText: /delete all/i })
    );
    
    if (await deleteAllBtn.isVisible()) {
      await deleteAllBtn.click();
      // Confirmar eliminación si hay dialog
      const confirmBtn = await page.locator('button').filter({ hasText: /confirm|yes|delete/i }).last();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  }
  
  test.beforeEach(async ({ page }) => {
    testNum++;
    console.log(`\n=== TEST ${testNum} STARTING ===`);
  });
  
  test('Test 1: Fresh start - no sessions', async ({ page, context }) => {
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    // Clean up any existing sessions
    await cleanupSessions(page);
    
    const sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Sessions after cleanup: ${sessionCount}`);
    
    await page.screenshot({ 
      path: 'tests/screenshots/debug-1-fresh-start.png', 
      fullPage: true 
    });
  });
  
  test('Test 2: Direct navigation after cleanup', async ({ page, context }) => {
    // Login first
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    
    // Cleanup
    await cleanupSessions(page);
    
    // Now navigate directly to sessions
    await page.goto(clientUrl + '/sessions');
    await page.waitForTimeout(2000);
    
    const sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`Sessions on direct navigation: ${sessionCount}`);
    
    // Check for any automatic session creation
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    await page.screenshot({ 
      path: 'tests/screenshots/debug-2-direct-nav.png', 
      fullPage: true 
    });
  });
  
  test('Test 3: Monitor session creation', async ({ page, context }) => {
    // Setup request monitoring
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/api/') || request.url().includes('socket.io')) {
        requests.push({
          method: request.method(),
          url: request.url(),
          postData: request.postData()
        });
      }
    });
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    console.log('\nAPI Requests made:');
    requests.forEach((req, i) => {
      console.log(`${i + 1}. ${req.method} ${req.url}`);
      if (req.postData) {
        console.log(`   Data: ${req.postData.substring(0, 100)}`);
      }
    });
    
    const sessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`\nFinal session count: ${sessionCount}`);
  });
  
  test('Test 4: Check localStorage', async ({ page, context }) => {
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(1000);
    
    // Check localStorage
    const storageData = await page.evaluate(() => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
      }
      return data;
    });
    
    console.log('\nLocalStorage contents:');
    Object.entries(storageData).forEach(([key, value]) => {
      console.log(`${key}: ${value.substring(0, 100)}...`);
    });
  });
  
  test('Test 5: Server state verification', async ({ page, context }) => {
    // Make direct API call to check sessions
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlci1pZCIsInVzZXJuYW1lIjoidGVzdCIsImlhdCI6MTc1MjA5MDE5NiwiZXhwIjoxNzUyNjk0OTk2fQ.NxIJVq5afcOl53Dd1lDGYpLwuXuyu7f6H4mM0RcEGe8';
    
    // Login to establish session
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    // Get session count from UI
    const uiSessionCount = await page.locator('div.MuiCard-root').count();
    console.log(`UI shows ${uiSessionCount} sessions`);
    
    // Monitor console for session data
    page.on('console', msg => {
      if (msg.text().includes('sessions') || msg.text().includes('Sessions')) {
        console.log('Console:', msg.text());
      }
    });
    
    // Navigate away and back
    await page.goto(clientUrl);
    await page.waitForTimeout(1000);
    await page.goto(clientUrl + '/sessions');
    await page.waitForTimeout(2000);
    
    const finalCount = await page.locator('div.MuiCard-root').count();
    console.log(`Final UI count: ${finalCount}`);
  });
});