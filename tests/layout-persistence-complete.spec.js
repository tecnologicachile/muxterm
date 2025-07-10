import { test, expect } from '@playwright/test';

test.describe('Layout Persistence Tests', () => {
  const testUser = 'test';
  const testPassword = 'test123';
  
  // Helper function to login
  async function login(page) {
    await page.goto('http://localhost:3003');
    await page.fill('input[name="username"]', testUser);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
  }
  
  // Helper function to create a new session
  async function createNewSession(page, sessionName = null) {
    await page.click('button:has-text("New Session")');
    if (sessionName) {
      await page.fill('input[label="Session Name (optional)"]', sessionName);
    }
    await page.click('button:has-text("Create")');
    await page.waitForURL('**/terminal/**');
    await page.waitForSelector('.xterm-viewport', { timeout: 10000 });
    await page.waitForTimeout(1000);
    return page.url().split('/terminal/')[1];
  }
  
  // Helper function to logout
  async function logout(page) {
    // Navigate back to sessions if in terminal view
    if (page.url().includes('/terminal/')) {
      await page.locator('[data-testid="ArrowBackIcon"]').locator('..').click();
      await page.waitForURL('**/sessions');
    }
    // Click logout button
    await page.locator('[data-testid="LogoutIcon"]').locator('..').click();
    await page.waitForURL('**/login');
  }

  test('Test 1: Single terminal layout persistence', async ({ page }) => {
    // Login and create session
    await login(page);
    const sessionId = await createNewSession(page, 'Single Terminal Test');
    
    // Type some content
    await page.keyboard.type('echo "Test 1: Single Terminal"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Navigate back to sessions
    await page.locator('[data-testid="ArrowBackIcon"]').locator('..').click();
    await page.waitForURL('**/sessions');
    
    // Verify session shows correct layout
    const sessionCard = await page.locator(`text=Single Terminal Test`).locator('..').locator('..');
    await expect(sessionCard.locator('text=Layout:')).toContainText('Single terminal');
    
    // Re-open session
    await sessionCard.locator('button:has-text("Open")').click();
    await page.waitForURL(`**/terminal/${sessionId}`);
    
    // Verify content is preserved
    const terminalContent = await page.locator('.xterm-viewport').textContent();
    expect(terminalContent).toContain('Test 1: Single Terminal');
  });

  test('Test 2: Horizontal split (2 panels) persistence', async ({ page }) => {
    await login(page);
    const sessionId = await createNewSession(page, 'Horizontal Split Test');
    
    // Create horizontal split
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Type in first terminal
    await page.locator('.xterm-viewport').first().click();
    await page.keyboard.type('echo "Panel 1 - Horizontal"');
    await page.keyboard.press('Enter');
    
    // Type in second terminal
    await page.locator('.xterm-viewport').nth(1).click();
    await page.keyboard.type('echo "Panel 2 - Horizontal"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Go back to sessions
    await page.locator('[data-testid="ArrowBackIcon"]').locator('..').click();
    await page.waitForURL('**/sessions');
    
    // Verify layout info
    const sessionCard = await page.locator(`text=Horizontal Split Test`).locator('..').locator('..');
    await expect(sessionCard.locator('text=Layout:')).toContainText('2 panels (split)');
    
    // Re-open and verify
    await sessionCard.locator('button:has-text("Open")').click();
    await page.waitForURL(`**/terminal/${sessionId}`);
    await page.waitForTimeout(1000);
    
    // Verify both panels exist with content
    const panels = await page.locator('.xterm-viewport').count();
    expect(panels).toBe(2);
    
    const panel1Content = await page.locator('.xterm-viewport').first().textContent();
    const panel2Content = await page.locator('.xterm-viewport').nth(1).textContent();
    expect(panel1Content).toContain('Panel 1 - Horizontal');
    expect(panel2Content).toContain('Panel 2 - Horizontal');
  });

  test('Test 3: Vertical split (2 panels) persistence', async ({ page }) => {
    await login(page);
    const sessionId = await createNewSession(page, 'Vertical Split Test');
    
    // Create vertical split
    await page.keyboard.press('Control+Shift+S');
    await page.waitForTimeout(500);
    
    // Type in terminals
    await page.locator('.xterm-viewport').first().click();
    await page.keyboard.type('echo "Top Panel"');
    await page.keyboard.press('Enter');
    
    await page.locator('.xterm-viewport').nth(1).click();
    await page.keyboard.type('echo "Bottom Panel"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Logout completely
    await logout(page);
    
    // Login again
    await login(page);
    
    // Open the session
    await page.locator(`text=Vertical Split Test`).locator('..').locator('..').locator('button:has-text("Open")').click();
    await page.waitForTimeout(1000);
    
    // Verify layout restored
    const panels = await page.locator('.xterm-viewport').count();
    expect(panels).toBe(2);
    
    const topContent = await page.locator('.xterm-viewport').first().textContent();
    const bottomContent = await page.locator('.xterm-viewport').nth(1).textContent();
    expect(topContent).toContain('Top Panel');
    expect(bottomContent).toContain('Bottom Panel');
  });

  test('Test 4: Three panel layout persistence', async ({ page }) => {
    await login(page);
    const sessionId = await createNewSession(page, '3 Panel Test');
    
    // Create 3 panels
    await page.keyboard.press('Control+Shift+D'); // 2 panels
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+Shift+S'); // 3 panels
    await page.waitForTimeout(500);
    
    // Add content to each
    for (let i = 0; i < 3; i++) {
      await page.locator('.xterm-viewport').nth(i).click();
      await page.keyboard.type(`echo "Panel ${i + 1} of 3"`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
    }
    
    // Navigate away and back
    await page.locator('[data-testid="ArrowBackIcon"]').locator('..').click();
    await page.waitForURL('**/sessions');
    
    // Verify shows 3 panels
    const sessionCard = await page.locator(`text=3 Panel Test`).locator('..').locator('..');
    await expect(sessionCard.locator('text=Layout:')).toContainText('3 panels');
    
    // Re-open
    await sessionCard.locator('button:has-text("Open")').click();
    await page.waitForTimeout(1000);
    
    // Verify all 3 panels
    const panels = await page.locator('.xterm-viewport').count();
    expect(panels).toBe(3);
    
    for (let i = 0; i < 3; i++) {
      const content = await page.locator('.xterm-viewport').nth(i).textContent();
      expect(content).toContain(`Panel ${i + 1} of 3`);
    }
  });

  test('Test 5: Four panel grid layout persistence', async ({ page }) => {
    await login(page);
    const sessionId = await createNewSession(page, 'Grid Layout Test');
    
    // Create 4 panel grid
    await page.keyboard.press('Control+Shift+D'); // 2 panels
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+Shift+S'); // 3 panels
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+Shift+D'); // 4 panels
    await page.waitForTimeout(500);
    
    // Add unique content to each panel
    const commands = ['ls -la', 'pwd', 'date', 'whoami'];
    for (let i = 0; i < 4; i++) {
      await page.locator('.xterm-viewport').nth(i).click();
      await page.keyboard.type(commands[i]);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
    }
    
    // Full logout
    await logout(page);
    
    // Login and restore
    await login(page);
    await page.locator(`text=Grid Layout Test`).locator('..').locator('..').locator('button:has-text("Open")').click();
    await page.waitForTimeout(1000);
    
    // Verify 4 panels with content
    const panels = await page.locator('.xterm-viewport').count();
    expect(panels).toBe(4);
    
    for (let i = 0; i < 4; i++) {
      const content = await page.locator('.xterm-viewport').nth(i).textContent();
      expect(content).toContain(commands[i]);
    }
  });

  test('Test 6: Active panel persistence', async ({ page }) => {
    await login(page);
    const sessionId = await createNewSession(page, 'Active Panel Test');
    
    // Create multiple panels
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+Shift+S');
    await page.waitForTimeout(500);
    
    // Click on the third panel to make it active
    await page.locator('.xterm-viewport').nth(2).click();
    await page.keyboard.type('echo "This is the active panel"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Navigate away
    await page.locator('[data-testid="ArrowBackIcon"]').locator('..').click();
    
    // Come back
    await page.locator(`text=Active Panel Test`).locator('..').locator('..').locator('button:has-text("Open")').click();
    await page.waitForTimeout(1000);
    
    // The third panel should have the green border (active)
    const activePanel = await page.locator('[style*="border: 2px solid #00ff00"]');
    await expect(activePanel).toBeVisible();
    
    // Verify it contains our text
    const activeContent = await activePanel.locator('.xterm-viewport').textContent();
    expect(activeContent).toContain('This is the active panel');
  });

  test('Test 7: Multiple sessions with different layouts', async ({ page }) => {
    await login(page);
    
    // Create first session with 2 panels
    const session1Id = await createNewSession(page, 'Session A - 2 panels');
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    await page.locator('[data-testid="ArrowBackIcon"]').locator('..').click();
    
    // Create second session with 4 panels
    const session2Id = await createNewSession(page, 'Session B - 4 panels');
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+Shift+D');
      await page.waitForTimeout(300);
    }
    await page.locator('[data-testid="ArrowBackIcon"]').locator('..').click();
    
    // Verify both sessions show correct layout info
    const sessionA = await page.locator(`text=Session A - 2 panels`).locator('..').locator('..');
    const sessionB = await page.locator(`text=Session B - 4 panels`).locator('..').locator('..');
    
    await expect(sessionA.locator('text=Layout:')).toContainText('2 panels');
    await expect(sessionB.locator('text=Layout:')).toContainText('4 panels (grid)');
    
    // Open each and verify
    await sessionA.locator('button:has-text("Open")').click();
    await page.waitForTimeout(1000);
    let panels = await page.locator('.xterm-viewport').count();
    expect(panels).toBe(2);
    await page.locator('[data-testid="ArrowBackIcon"]').locator('..').click();
    
    await sessionB.locator('button:has-text("Open")').click();
    await page.waitForTimeout(1000);
    panels = await page.locator('.xterm-viewport').count();
    expect(panels).toBe(4);
  });

  test('Test 8: Layout persistence after terminal commands', async ({ page }) => {
    await login(page);
    const sessionId = await createNewSession(page, 'Commands Test');
    
    // Create split
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Run long command in first panel
    await page.locator('.xterm-viewport').first().click();
    await page.keyboard.type('for i in {1..5}; do echo "Line $i"; sleep 0.1; done');
    await page.keyboard.press('Enter');
    
    // Run command in second panel
    await page.locator('.xterm-viewport').nth(1).click();
    await page.keyboard.type('ps aux | head -5');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Logout and login
    await logout(page);
    await login(page);
    
    // Restore session
    await page.locator(`text=Commands Test`).locator('..').locator('..').locator('button:has-text("Open")').click();
    await page.waitForTimeout(1000);
    
    // Verify both panels have their output
    const panel1 = await page.locator('.xterm-viewport').first().textContent();
    const panel2 = await page.locator('.xterm-viewport').nth(1).textContent();
    
    expect(panel1).toContain('Line 1');
    expect(panel1).toContain('Line 5');
    expect(panel2).toContain('USER');
    expect(panel2).toContain('PID');
  });

  test('Test 9: Layout persistence with terminal resize', async ({ page }) => {
    await login(page);
    const sessionId = await createNewSession(page, 'Resize Test');
    
    // Create horizontal split
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Add content
    await page.locator('.xterm-viewport').first().click();
    await page.keyboard.type('echo "Before resize"');
    await page.keyboard.press('Enter');
    
    // Find and drag resize handle
    const resizeHandle = await page.locator('[data-panel-resize-handle-id]').first();
    const box = await resizeHandle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2);
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    // Navigate away and back
    await page.locator('[data-testid="ArrowBackIcon"]').locator('..').click();
    await page.locator(`text=Resize Test`).locator('..').locator('..').locator('button:has-text("Open")').click();
    await page.waitForTimeout(1000);
    
    // Verify layout restored (panels exist)
    const panels = await page.locator('.xterm-viewport').count();
    expect(panels).toBe(2);
    
    // Verify content
    const content = await page.locator('.xterm-viewport').first().textContent();
    expect(content).toContain('Before resize');
  });

  test('Test 10: Complex workflow - create, modify, logout, login, verify', async ({ page }) => {
    await login(page);
    
    // Create session with specific name
    const sessionName = `Complex Test ${Date.now()}`;
    const sessionId = await createNewSession(page, sessionName);
    
    // Build complex layout
    await page.keyboard.press('Control+Shift+D'); // 2 panels
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+Shift+S'); // 3 panels
    await page.waitForTimeout(300);
    
    // Add different content to each panel
    await page.locator('.xterm-viewport').nth(0).click();
    await page.keyboard.type('cd /tmp && ls');
    await page.keyboard.press('Enter');
    
    await page.locator('.xterm-viewport').nth(1).click();
    await page.keyboard.type('echo $PATH');
    await page.keyboard.press('Enter');
    
    await page.locator('.xterm-viewport').nth(2).click();
    await page.keyboard.type('history | tail -5');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Make panel 2 active
    await page.locator('.xterm-viewport').nth(1).click();
    
    // Full logout
    await logout(page);
    
    // Close browser context and create new one (simulate new session)
    await page.context().close();
    const newContext = await page.context().browser().newContext();
    const newPage = await newContext.newPage();
    
    // Login fresh
    await login(newPage);
    
    // Find and open our session
    const sessionCard = await newPage.locator(`text=${sessionName}`).locator('..').locator('..');
    await expect(sessionCard.locator('text=Layout:')).toContainText('3 panels');
    await sessionCard.locator('button:has-text("Open")').click();
    await newPage.waitForTimeout(1500);
    
    // Verify all aspects
    const panelCount = await newPage.locator('.xterm-viewport').count();
    expect(panelCount).toBe(3);
    
    // Verify each panel's content
    const panel1 = await newPage.locator('.xterm-viewport').nth(0).textContent();
    const panel2 = await newPage.locator('.xterm-viewport').nth(1).textContent();
    const panel3 = await newPage.locator('.xterm-viewport').nth(2).textContent();
    
    expect(panel1).toContain('/tmp');
    expect(panel2).toContain('PATH');
    expect(panel3).toContain('history');
    
    // Verify panel 2 is active (has green border)
    const activePanel = await newPage.locator('[style*="border: 2px solid #00ff00"]');
    const activePanelContent = await activePanel.locator('.xterm-viewport').textContent();
    expect(activePanelContent).toContain('PATH');
    
    await newContext.close();
  });
});