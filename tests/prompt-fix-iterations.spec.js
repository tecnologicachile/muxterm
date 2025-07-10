const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.describe('Prompt Duplication Fix - Iterative Tests', () => {
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

  test('Iteration 1: Analyze current buffer behavior', async ({ page, context }) => {
    console.log('=== ITERATION 1: Analyzing buffer behavior ===');
    
    // Set auth token
    await context.addInitScript((token) => {
      localStorage.setItem('token', token);
    }, authToken);
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        console.log('Browser:', msg.text());
      }
    });
    
    // Go to existing session
    await page.goto(clientUrl + '/terminal/8a248684-387f-4195-9dae-a52a90518a07');
    await page.waitForTimeout(3000);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/iter1-initial.png', 
      fullPage: true 
    });
    
    // Analyze terminal content
    const terminals = await page.locator('.terminal').all();
    console.log(`Found ${terminals.length} terminals`);
    
    if (terminals.length > 0) {
      const leftTerminal = terminals[0];
      const initialContent = await leftTerminal.textContent();
      console.log(`Initial buffer size: ${initialContent.length} bytes`);
      
      // Count prompt occurrences
      const promptPattern = /usuario@usuario-Standard-PC-i440FX-PIIX-1996/g;
      const prompts = initialContent.match(promptPattern) || [];
      console.log(`Number of prompts: ${prompts.length}`);
      
      // Log first 500 chars for analysis
      console.log('\nFirst 500 chars of buffer:');
      console.log(initialContent.substring(0, 500));
      
      // Refresh and check again
      console.log('\nRefreshing page...');
      await page.reload();
      await page.waitForTimeout(3000);
      
      const terminalsAfter = await page.locator('.terminal').all();
      if (terminalsAfter.length > 0) {
        const contentAfter = await terminalsAfter[0].textContent();
        const promptsAfter = (contentAfter.match(promptPattern) || []).length;
        console.log(`\nAfter refresh:`);
        console.log(`Buffer size: ${contentAfter.length} bytes`);
        console.log(`Number of prompts: ${promptsAfter}`);
        console.log(`Buffer growth: ${contentAfter.length - initialContent.length} bytes`);
        
        // Take after screenshot
        await page.screenshot({ 
          path: 'tests/screenshots/iter1-after-refresh.png', 
          fullPage: true 
        });
        
        // Save buffer content for analysis
        fs.writeFileSync('tests/buffer-before.txt', initialContent);
        fs.writeFileSync('tests/buffer-after.txt', contentAfter);
        
        if (promptsAfter > prompts.length) {
          console.log('\n❌ PROBLEM CONFIRMED: Prompts are duplicating');
          console.log(`Prompts increased from ${prompts.length} to ${promptsAfter}`);
        }
      }
    }
  });
});