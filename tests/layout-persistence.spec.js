import { test, expect } from '@playwright/test';

test.describe('Layout Persistence', () => {
  test('should save and restore panel layout across sessions', async ({ browser }) => {
    // Create first browser context
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    // Login and navigate to terminal
    await page1.goto('http://localhost:3003');
    await page1.fill('input[name="username"]', 'test');
    await page1.fill('input[name="password"]', 'test123');
    await page1.click('button[type="submit"]');
    
    // Wait for sessions page
    await page1.waitForURL('**/sessions');
    
    // Create a new session
    await page1.click('button:has-text("New Session")');
    await page1.waitForURL('**/terminal/**');
    
    // Get session ID from URL
    const url = page1.url();
    const sessionId = url.split('/terminal/')[1];
    console.log('Session ID:', sessionId);
    
    // Wait for terminal to be ready
    await page1.waitForSelector('.xterm-viewport', { timeout: 10000 });
    await page1.waitForTimeout(1000);
    
    // Create multiple panels
    await page1.keyboard.press('Control+Shift+D'); // Horizontal split
    await page1.waitForTimeout(500);
    
    await page1.keyboard.press('Control+Shift+S'); // Vertical split
    await page1.waitForTimeout(500);
    
    // Type in each terminal to make them distinguishable
    await page1.locator('.xterm-viewport').first().click();
    await page1.keyboard.type('echo "Panel 1"');
    await page1.keyboard.press('Enter');
    await page1.waitForTimeout(200);
    
    await page1.locator('.xterm-viewport').nth(1).click();
    await page1.keyboard.type('echo "Panel 2"');
    await page1.keyboard.press('Enter');
    await page1.waitForTimeout(200);
    
    await page1.locator('.xterm-viewport').nth(2).click();
    await page1.keyboard.type('echo "Panel 3"');
    await page1.keyboard.press('Enter');
    await page1.waitForTimeout(200);
    
    // Wait for layout to be saved
    await page1.waitForTimeout(1000);
    
    // Close first browser
    await context1.close();
    
    // Create second browser context (simulating different computer)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    // Login with same credentials
    await page2.goto('http://localhost:3003');
    await page2.fill('input[name="username"]', 'test');
    await page2.fill('input[name="password"]', 'test123');
    await page2.click('button[type="submit"]');
    
    // Wait for sessions page
    await page2.waitForURL('**/sessions');
    
    // Click on the existing session
    await page2.click('tr:has-text("Session")');
    await page2.waitForURL(`**/terminal/${sessionId}`);
    
    // Wait for terminals to load
    await page2.waitForSelector('.xterm-viewport', { timeout: 10000 });
    await page2.waitForTimeout(2000);
    
    // Verify that we have 3 panels
    const terminalCount = await page2.locator('.xterm-viewport').count();
    expect(terminalCount).toBe(3);
    
    // Verify content in each terminal
    const terminal1Content = await page2.locator('.xterm-viewport').first().textContent();
    const terminal2Content = await page2.locator('.xterm-viewport').nth(1).textContent();
    const terminal3Content = await page2.locator('.xterm-viewport').nth(2).textContent();
    
    expect(terminal1Content).toContain('Panel 1');
    expect(terminal2Content).toContain('Panel 2');
    expect(terminal3Content).toContain('Panel 3');
    
    // Cleanup
    await context2.close();
  });

  test('should handle empty layout gracefully', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3003');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    // Create new session
    await page.waitForURL('**/sessions');
    await page.click('button:has-text("New Session")');
    await page.waitForURL('**/terminal/**');
    
    // Should have one terminal by default
    await page.waitForSelector('.xterm-viewport', { timeout: 10000 });
    const terminalCount = await page.locator('.xterm-viewport').count();
    expect(terminalCount).toBe(1);
  });
});