#!/usr/bin/env node

const { chromium } = require('playwright');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('=== Automated Layout Persistence Tests ===\n');
  const results = [];
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox']
  });
  
  try {
    for (let i = 1; i <= 15; i++) {
      console.log(`\nRunning Test ${i}...`);
      const result = await runSingleTest(browser, i);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ Test ${i} PASSED`);
      } else {
        console.log(`❌ Test ${i} FAILED: ${result.error}`);
      }
      
      await wait(1000); // Wait between tests
    }
  } finally {
    await browser.close();
  }
  
  // Print summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  
  results.forEach((r, i) => {
    console.log(`Test ${i + 1}: ${r.success ? '✅' : '❌'} - ${r.description}`);
  });
}

async function runSingleTest(browser, testNumber) {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Login
    await page.goto('http://localhost:3003');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions', { timeout: 5000 });
    
    // Create session
    await page.click('button:has-text("New Session")');
    await wait(500);
    
    const sessionName = `AutoTest${testNumber}`;
    const nameInput = await page.locator('input[placeholder*="Session Name"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill(sessionName);
      await page.click('button:has-text("Create")');
    }
    
    await page.waitForURL('**/terminal/**', { timeout: 5000 });
    await page.waitForSelector('.xterm-viewport', { timeout: 5000 });
    await wait(1000);
    
    // Execute test based on number
    let description = '';
    let panelCount = 1;
    
    switch(testNumber) {
      case 1:
        description = 'Single terminal with ls';
        await page.keyboard.type('ls -la');
        await page.keyboard.press('Enter');
        break;
        
      case 2:
        description = 'Two panels horizontal';
        await page.keyboard.press('Control+Shift+D');
        await wait(500);
        panelCount = 2;
        break;
        
      case 3:
        description = 'Two panels vertical';
        await page.keyboard.press('Control+Shift+S');
        await wait(500);
        panelCount = 2;
        break;
        
      case 4:
        description = 'Three panels';
        await page.keyboard.press('Control+Shift+D');
        await wait(300);
        await page.keyboard.press('Control+Shift+S');
        await wait(500);
        panelCount = 3;
        break;
        
      case 5:
        description = 'Four panel grid';
        for (let i = 0; i < 3; i++) {
          await page.keyboard.press('Control+Shift+D');
          await wait(300);
        }
        panelCount = 4;
        break;
        
      default:
        description = `Test configuration ${testNumber}`;
        // Create varying panel counts
        const splits = (testNumber - 1) % 4;
        for (let i = 0; i < splits; i++) {
          await page.keyboard.press('Control+Shift+D');
          await wait(300);
        }
        panelCount = splits + 1;
    }
    
    // Add some content to first terminal
    await page.locator('.xterm-viewport').first().click();
    await page.keyboard.type(`echo "Test ${testNumber} content"`);
    await page.keyboard.press('Enter');
    await wait(500);
    
    // Logout
    await page.locator('[data-testid="ArrowBackIcon"]').locator('..').click();
    await page.waitForURL('**/sessions');
    await page.locator('[data-testid="LogoutIcon"]').locator('..').click();
    await page.waitForURL('**/login');
    
    // Login again
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
    
    // Find and open session
    const sessionCard = await page.locator(`text=${sessionName}`);
    if (await sessionCard.count() > 0) {
      await sessionCard.locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForURL('**/terminal/**');
      await wait(1500);
      
      // Verify panel count
      const actualPanels = await page.locator('.xterm-viewport').count();
      if (actualPanels === panelCount) {
        // Verify content
        const content = await page.locator('.xterm-viewport').first().textContent();
        if (content.includes(`Test ${testNumber} content`)) {
          return { success: true, description };
        } else {
          return { success: false, description, error: 'Content not preserved' };
        }
      } else {
        return { success: false, description, error: `Expected ${panelCount} panels, got ${actualPanels}` };
      }
    } else {
      return { success: false, description, error: 'Session not found after logout' };
    }
    
  } catch (error) {
    return { success: false, description: `Test ${testNumber}`, error: error.message };
  } finally {
    await context.close();
  }
}

// Run tests
runTests().catch(console.error);