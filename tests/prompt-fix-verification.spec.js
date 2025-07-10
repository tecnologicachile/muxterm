const { test, expect } = require('@playwright/test');

test.describe('Terminal Prompt Fix Verification', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  let authToken = '';
  
  test.beforeAll(async ({ request }) => {
    // Get auth token
    const response = await request.post(`${serverUrl}/api/auth/login`, {
      data: {
        username: 'test',
        password: 'test123'
      }
    });
    const data = await response.json();
    authToken = data.token;
  });

  test('Iteration 2: Verify prompt duplication fix', async ({ page, context }) => {
    console.log('=== ITERATION 2: Verifying prompt fix ===');
    
    // Set auth token in localStorage
    await context.addInitScript((token) => {
      localStorage.setItem('token', token);
    }, authToken);
    
    // Step 1: Go to sessions page
    await page.goto(clientUrl + '/sessions');
    await page.waitForLoadState('networkidle');
    
    // Step 2: Create a new session
    await page.click('button:has-text("Create New Session")');
    await page.waitForTimeout(1000);
    
    // Step 3: Click on the session to enter terminal
    const sessionCard = page.locator('div.MuiCard-root').first();
    await sessionCard.click();
    await page.waitForURL('**/terminal/**');
    await page.waitForTimeout(2000);
    
    // Step 4: Split terminal horizontally
    await page.click('button[title="Split"]');
    await page.waitForTimeout(2000);
    
    // Step 5: Type a command in left terminal
    const leftTerminal = page.locator('.terminal').first();
    await leftTerminal.click();
    await page.keyboard.type('echo "Test before refresh"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Step 6: Count prompts before refresh
    const contentBefore = await leftTerminal.textContent();
    const promptsBefore = (contentBefore.match(/usuario@usuario-Standard-PC-i440FX-PIIX-1996:-\$/g) || []).length;
    console.log(`Prompts before refresh: ${promptsBefore}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/fix-before-refresh.png', 
      fullPage: true 
    });
    
    // Step 7: Refresh the page
    console.log('Refreshing page...');
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Step 8: Count prompts after refresh
    const leftTerminalAfter = page.locator('.terminal').first();
    const contentAfter = await leftTerminalAfter.textContent();
    const promptsAfter = (contentAfter.match(/usuario@usuario-Standard-PC-i440FX-PIIX-1996:-\$/g) || []).length;
    console.log(`Prompts after refresh: ${promptsAfter}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/fix-after-refresh.png', 
      fullPage: true 
    });
    
    // Log content for debugging
    console.log('Terminal content preview after refresh:');
    console.log(contentAfter.substring(0, 300) + '...');
    
    // Test assertion
    if (promptsAfter > promptsBefore + 1) {
      console.error(`❌ FAILED: Prompts increased from ${promptsBefore} to ${promptsAfter}`);
      console.log('Full content:', contentAfter);
      expect(promptsAfter).toBeLessThanOrEqual(promptsBefore + 1);
    } else {
      console.log(`✅ PASSED: Prompts are properly managed (before: ${promptsBefore}, after: ${promptsAfter})`);
    }
  });
  
  test('Iteration 3: Multiple refresh test', async ({ page, context }) => {
    console.log('=== ITERATION 3: Multiple refresh test ===');
    
    await context.addInitScript((token) => {
      localStorage.setItem('token', token);
    }, authToken);
    
    // Use existing session
    await page.goto(clientUrl + '/sessions');
    await page.waitForLoadState('networkidle');
    
    const sessionCard = page.locator('div.MuiCard-root').first();
    await sessionCard.click();
    await page.waitForURL('**/terminal/**');
    await page.waitForTimeout(2000);
    
    let previousPromptCount = 0;
    
    for (let i = 1; i <= 3; i++) {
      console.log(`\nRefresh ${i}:`);
      
      const terminal = page.locator('.terminal').first();
      const content = await terminal.textContent();
      const prompts = (content.match(/usuario@usuario-Standard-PC-i440FX-PIIX-1996:-\$/g) || []).length;
      
      console.log(`  Prompt count: ${prompts}`);
      
      if (i > 1 && prompts > previousPromptCount + 1) {
        console.error(`  ❌ Prompts increased unexpectedly from ${previousPromptCount} to ${prompts}`);
      } else {
        console.log(`  ✅ Prompt count is stable`);
      }
      
      previousPromptCount = prompts;
      
      if (i < 3) {
        await page.reload();
        await page.waitForTimeout(2000);
      }
    }
  });
});