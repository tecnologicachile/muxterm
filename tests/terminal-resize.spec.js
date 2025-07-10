import { test, expect } from '@playwright/test';

test.describe('Terminal Resize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3003');
    
    // Login
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    // Wait for terminal to be ready
    await page.waitForSelector('.xterm-viewport', { timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('should allow resizing panels horizontally', async ({ page }) => {
    // Create a second terminal with horizontal split
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Find the resize handle
    const resizeHandle = await page.locator('[data-panel-resize-handle-id]').first();
    await expect(resizeHandle).toBeVisible();
    
    // Get initial panel sizes
    const leftPanel = await page.locator('[data-panel-id="panel-0"]').first();
    const rightPanel = await page.locator('[data-panel-id="panel-1"]').first();
    
    const initialLeftWidth = await leftPanel.evaluate(el => el.offsetWidth);
    const initialRightWidth = await rightPanel.evaluate(el => el.offsetWidth);
    
    console.log('Initial widths - Left:', initialLeftWidth, 'Right:', initialRightWidth);
    
    // Drag the resize handle to the right
    const handleBox = await resizeHandle.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 100, handleBox.y + handleBox.height / 2);
    await page.mouse.up();
    
    await page.waitForTimeout(500);
    
    // Check that panel sizes changed
    const newLeftWidth = await leftPanel.evaluate(el => el.offsetWidth);
    const newRightWidth = await rightPanel.evaluate(el => el.offsetWidth);
    
    console.log('New widths - Left:', newLeftWidth, 'Right:', newRightWidth);
    
    // Verify that the panels resized
    expect(newLeftWidth).toBeGreaterThan(initialLeftWidth);
    expect(newRightWidth).toBeLessThan(initialRightWidth);
    
    // Verify terminals still work after resize
    await page.locator('.xterm-viewport').first().click();
    await page.keyboard.type('echo "left panel works"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    await page.locator('.xterm-viewport').nth(1).click();
    await page.keyboard.type('echo "right panel works"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Check output
    const leftContent = await page.locator('.xterm-viewport').first().textContent();
    const rightContent = await page.locator('.xterm-viewport').nth(1).textContent();
    
    expect(leftContent).toContain('left panel works');
    expect(rightContent).toContain('right panel works');
  });

  test('should allow resizing panels vertically', async ({ page }) => {
    // Create a second terminal with vertical split
    await page.keyboard.press('Control+Shift+S');
    await page.waitForTimeout(500);
    
    // Find the resize handle (should be horizontal for vertical split)
    const resizeHandle = await page.locator('[data-panel-resize-handle-id]').first();
    await expect(resizeHandle).toBeVisible();
    
    // Get initial panel sizes
    const topPanel = await page.locator('[data-panel-id="panel-0"]').first();
    const bottomPanel = await page.locator('[data-panel-id="panel-1"]').first();
    
    const initialTopHeight = await topPanel.evaluate(el => el.offsetHeight);
    const initialBottomHeight = await bottomPanel.evaluate(el => el.offsetHeight);
    
    console.log('Initial heights - Top:', initialTopHeight, 'Bottom:', initialBottomHeight);
    
    // Drag the resize handle down
    const handleBox = await resizeHandle.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 100);
    await page.mouse.up();
    
    await page.waitForTimeout(500);
    
    // Check that panel sizes changed
    const newTopHeight = await topPanel.evaluate(el => el.offsetHeight);
    const newBottomHeight = await bottomPanel.evaluate(el => el.offsetHeight);
    
    console.log('New heights - Top:', newTopHeight, 'Bottom:', newBottomHeight);
    
    // Verify that the panels resized
    expect(newTopHeight).toBeGreaterThan(initialTopHeight);
    expect(newBottomHeight).toBeLessThan(initialBottomHeight);
  });

  test('should maintain terminal content after resize', async ({ page }) => {
    // Type some content in the first terminal
    await page.locator('.xterm-viewport').click();
    await page.keyboard.type('echo "Before resize"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Create a second terminal
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Type in second terminal
    await page.locator('.xterm-viewport').nth(1).click();
    await page.keyboard.type('echo "Second terminal"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Resize
    const resizeHandle = await page.locator('[data-panel-resize-handle-id]').first();
    const handleBox = await resizeHandle.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 150, handleBox.y + handleBox.height / 2);
    await page.mouse.up();
    
    await page.waitForTimeout(500);
    
    // Verify content is still present
    const leftContent = await page.locator('.xterm-viewport').first().textContent();
    const rightContent = await page.locator('.xterm-viewport').nth(1).textContent();
    
    expect(leftContent).toContain('Before resize');
    expect(rightContent).toContain('Second terminal');
  });
});