const { test, expect } = require('@playwright/test');

test.describe('Debug Session Persistence', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  // Test 1: Create session and verify it appears in list
  test('Test 1: Create session and verify persistence', async ({ page, context }) => {
    console.log('\n=== TEST 1: CREATE SESSION AND VERIFY ===');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.waitForTimeout(1000);
    
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    console.log('✓ Logged in successfully');
    
    // Count initial sessions
    await page.waitForTimeout(2000);
    let sessionCards = await page.locator('div.MuiCard-root').all();
    const initialCount = sessionCards.length;
    console.log(`Initial sessions: ${initialCount}`);
    
    // Look for create button
    const createButtons = await page.locator('button').all();
    let createButton = null;
    
    for (const btn of createButtons) {
      const text = await btn.textContent();
      if (text && (text.includes('Create') || text.includes('New') || text.includes('nueva'))) {
        createButton = btn;
        console.log(`Found create button with text: "${text}"`);
        break;
      }
    }
    
    if (createButton) {
      await createButton.click();
      console.log('✓ Clicked create button');
      await page.waitForTimeout(2000);
      
      // Check if dialog opened
      const dialog = await page.locator('[role="dialog"]').isVisible();
      if (dialog) {
        console.log('Dialog opened, entering session name...');
        await page.fill('input[type="text"]', 'Test Session 1');
        await page.click('button:has-text("Create")');
      }
      
      // Wait for navigation or new session
      await page.waitForTimeout(3000);
      
      // Check current URL
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);
      
      if (currentUrl.includes('/terminal/')) {
        console.log('✓ Navigated to terminal');
        
        // Go back to sessions
        await page.goto(clientUrl + '/sessions');
        await page.waitForTimeout(2000);
      }
      
      // Count sessions again
      sessionCards = await page.locator('div.MuiCard-root').all();
      const newCount = sessionCards.length;
      console.log(`Sessions after creation: ${newCount}`);
      
      // Take screenshot
      await page.screenshot({ 
        path: 'tests/screenshots/test1-sessions.png', 
        fullPage: true 
      });
    } else {
      console.log('❌ No create button found');
    }
  });
  
  // Test 2: Navigate directly to sessions
  test('Test 2: Direct navigation to sessions', async ({ page, context }) => {
    console.log('\n=== TEST 2: DIRECT NAVIGATION ===');
    
    // Set token in localStorage
    await context.addInitScript(() => {
      localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlci1pZCIsInVzZXJuYW1lIjoidGVzdCIsImlhdCI6MTc1MjA5MDE5NiwiZXhwIjoxNzUyNjk0OTk2fQ.NxIJVq5afcOl53Dd1lDGYpLwuXuyu7f6H4mM0RcEGe8');
    });
    
    // Navigate directly to sessions
    await page.goto(clientUrl + '/sessions');
    await page.waitForTimeout(3000);
    
    // Check if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.log('❌ Redirected to login - token not valid');
      
      // Login again
      await page.fill('input[name="username"]', 'test');
      await page.fill('input[name="password"]', 'test123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/sessions');
    }
    
    // Count sessions
    const sessionCards = await page.locator('div.MuiCard-root').all();
    console.log(`Sessions found: ${sessionCards.length}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/test2-direct-nav.png', 
      fullPage: true 
    });
  });
  
  // Test 3: Navigate from root
  test('Test 3: Navigate from root URL', async ({ page, context }) => {
    console.log('\n=== TEST 3: ROOT NAVIGATION ===');
    
    // Login first
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    
    // Now navigate to root
    await page.goto(clientUrl);
    await page.waitForTimeout(2000);
    
    const finalUrl = page.url();
    console.log(`Final URL after root navigation: ${finalUrl}`);
    
    // Count sessions
    const sessionCards = await page.locator('div.MuiCard-root').all();
    console.log(`Sessions found: ${sessionCards.length}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/test3-root-nav.png', 
      fullPage: true 
    });
  });
  
  // Test 4: Check session manager state
  test('Test 4: Session persistence after refresh', async ({ page, context }) => {
    console.log('\n=== TEST 4: SESSION PERSISTENCE AFTER REFRESH ===');
    
    // Login and create session
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    
    // Count initial
    let sessionCards = await page.locator('div.MuiCard-root').all();
    const beforeRefresh = sessionCards.length;
    console.log(`Sessions before refresh: ${beforeRefresh}`);
    
    // Refresh page
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Count after refresh
    sessionCards = await page.locator('div.MuiCard-root').all();
    const afterRefresh = sessionCards.length;
    console.log(`Sessions after refresh: ${afterRefresh}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/test4-after-refresh.png', 
      fullPage: true 
    });
  });
  
  // Test 5: Monitor WebSocket communication
  test('Test 5: Monitor WebSocket events', async ({ page, context }) => {
    console.log('\n=== TEST 5: WEBSOCKET MONITORING ===');
    
    // Setup WebSocket monitoring
    const wsMessages = [];
    page.on('websocket', ws => {
      console.log(`WebSocket opened: ${ws.url()}`);
      ws.on('framesent', event => {
        wsMessages.push({ type: 'sent', payload: event.payload });
        console.log('→ Sent:', event.payload.substring(0, 100));
      });
      ws.on('framereceived', event => {
        wsMessages.push({ type: 'received', payload: event.payload });
        console.log('← Received:', event.payload.substring(0, 100));
      });
    });
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(3000);
    
    // Analyze WebSocket messages
    const sessionMessages = wsMessages.filter(msg => 
      msg.payload.includes('sessions') || 
      msg.payload.includes('get-sessions')
    );
    
    console.log(`\nWebSocket session-related messages: ${sessionMessages.length}`);
    sessionMessages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.type}: ${msg.payload.substring(0, 200)}`);
    });
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/test5-websocket.png', 
      fullPage: true 
    });
  });
});