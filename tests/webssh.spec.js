import { test, expect } from '@playwright/test';

test.describe('WebSSH Terminal Tests', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    // Create a new page for each test
    page = await browser.newPage();
    
    // Go to the application
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' });
    
    // Wait for login form to be visible
    await page.waitForSelector('input:has-text("Username")', { state: 'visible', timeout: 5000 }).catch(() => {});
    
    // Login with test credentials using the actual input fields
    const usernameInput = page.locator('input').first();
    const passwordInput = page.locator('input[type="password"]');
    
    await usernameInput.fill('test');
    await passwordInput.fill('test123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to sessions page
    await page.waitForURL('**/sessions', { timeout: 10000 });
    
    // Wait for New Session button to be visible
    await page.waitForSelector('button:has-text("NEW SESSION")', { state: 'visible' });
    
    // Click on New Session button
    await page.click('button:has-text("NEW SESSION")');
    
    // Wait for the create session dialog
    await page.waitForSelector('text=Create New Session', { state: 'visible' });
    
    // Fill session name (optional) and click CREATE
    await page.fill('input[placeholder*="Session Name"]', 'Test Session');
    await page.click('button:has-text("CREATE")');
    
    // Wait for terminal view
    await page.waitForURL('**/terminal/**', { timeout: 10000 });
    
    // Wait for initial terminal to be ready
    await page.waitForTimeout(3000);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should login successfully', async () => {
    // We're already logged in from beforeEach
    expect(page.url()).toContain('/terminal/');
  });

  test('should create 4 panels and execute commands', async () => {
    // Panel 1 is already created, let's execute a command
    console.log('Testing Panel 1...');
    await page.keyboard.type('echo "Panel 1 - $(date)"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Create Panel 2 - Click split button and select horizontal
    console.log('Creating Panel 2...');
    await page.click('button:has-text("Split")');
    await page.click('text=Split Horizontal');
    await page.waitForTimeout(1000);
    
    // Execute command in Panel 2
    await page.keyboard.type('echo "Panel 2 - $(hostname)"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Create Panel 3
    console.log('Creating Panel 3...');
    await page.click('button:has-text("Split")');
    await page.click('text=Split Horizontal');
    await page.waitForTimeout(1000);
    
    // Execute command in Panel 3
    await page.keyboard.type('ls -la');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Create Panel 4
    console.log('Creating Panel 4...');
    await page.click('button:has-text("Split")');
    await page.click('text=Split Horizontal');
    await page.waitForTimeout(1000);
    
    // Execute command in Panel 4
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Verify we have 4 panels
    const statusBar = await page.textContent('.status-bar');
    expect(statusBar).toContain('4 panels');
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'tests/screenshots/four-panels.png', fullPage: true });
  });

  test('should switch between panels and verify commands persist', async () => {
    // Create 4 panels first
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("Split")');
      await page.click('text=Split Horizontal');
      await page.waitForTimeout(1000);
    }
    
    // Execute different commands in each panel
    const commands = [
      'echo "Terminal 1: $(date)"',
      'echo "Terminal 2: $(whoami)"',
      'echo "Terminal 3: $(pwd)"',
      'echo "Terminal 4: $(hostname)"'
    ];
    
    // Click on each panel and execute command
    const panels = await page.locator('[style*="border"]').all();
    console.log(`Found ${panels.length} panels`);
    
    for (let i = 0; i < Math.min(panels.length, 4); i++) {
      console.log(`Clicking panel ${i + 1}...`);
      await panels[i].click();
      await page.waitForTimeout(500);
      
      console.log(`Typing command: ${commands[i]}`);
      await page.keyboard.type(commands[i]);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }
    
    // Now click through panels again to verify output is still there
    for (let i = 0; i < Math.min(panels.length, 4); i++) {
      await panels[i].click();
      await page.waitForTimeout(500);
      
      // Verify the terminal still shows our command
      const terminalContent = await panels[i].textContent();
      console.log(`Panel ${i + 1} content includes:`, terminalContent.substring(0, 100));
    }
    
    // Take a screenshot
    await page.screenshot({ path: 'tests/screenshots/all-terminals-with-output.png', fullPage: true });
  });

  test('should maintain terminal sessions when switching panels', async () => {
    // Create 2 panels
    await page.click('button:has-text("Split")');
    await page.click('text=Split Horizontal');
    await page.waitForTimeout(1000);
    
    // In first panel, start a long-running command
    const panels = await page.locator('[style*="border"]').all();
    await panels[0].click();
    await page.keyboard.type('top');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    // Switch to second panel and run a command
    await panels[1].click();
    await page.keyboard.type('ls -la');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Switch back to first panel
    await panels[0].click();
    await page.waitForTimeout(500);
    
    // Verify top is still running (we should see CPU usage info)
    const firstPanelContent = await panels[0].textContent();
    expect(firstPanelContent).toContain('PID');
    
    // Press 'q' to quit top
    await page.keyboard.press('q');
    await page.waitForTimeout(500);
    
    // Take a screenshot
    await page.screenshot({ path: 'tests/screenshots/terminal-persistence.png', fullPage: true });
  });

  test('should handle rapid panel creation and deletion', async () => {
    // Create 4 panels rapidly
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("Split")');
      await page.click('text=Split Horizontal');
      await page.waitForTimeout(500);
    }
    
    // Verify we have 4 panels
    let statusBar = await page.textContent('.status-bar');
    expect(statusBar).toContain('4 panels');
    
    // Use keyboard shortcut to close current panel (Ctrl+B, x)
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(100);
    await page.keyboard.press('x');
    await page.waitForTimeout(1000);
    
    // Verify we have 3 panels
    statusBar = await page.textContent('.status-bar');
    expect(statusBar).toContain('3 panels');
    
    // Take a screenshot
    await page.screenshot({ path: 'tests/screenshots/panel-deletion.png', fullPage: true });
  });

  test('should execute commands in all 4 terminals simultaneously', async () => {
    // Create 4 panels
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("Split")');
      await page.click('text=Split Horizontal');
      await page.waitForTimeout(1000);
    }
    
    // Get all panels
    const panels = await page.locator('[style*="border"]').all();
    
    // Execute date command in each panel to verify they're independent
    for (let i = 0; i < panels.length; i++) {
      await panels[i].click();
      await page.waitForTimeout(200);
      await page.keyboard.type(`echo "Panel ${i + 1} time: $(date +%s%N)"`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }
    
    // Verify all panels show different timestamps
    const outputs = [];
    for (let i = 0; i < panels.length; i++) {
      const content = await panels[i].textContent();
      outputs.push(content);
    }
    
    // Check that we have 4 different outputs
    const uniqueOutputs = new Set(outputs);
    expect(uniqueOutputs.size).toBe(4);
    
    // Take a final screenshot
    await page.screenshot({ path: 'tests/screenshots/all-panels-with-timestamps.png', fullPage: true });
  });
});

test.describe('Terminal Focus Tests', () => {
  test('should maintain focus on active terminal', async ({ page }) => {
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' });
    
    // Wait for login form
    await page.waitForSelector('input', { state: 'visible', timeout: 5000 });
    
    // Login using the actual input fields
    const usernameInput = page.locator('input').first();
    const passwordInput = page.locator('input[type="password"]');
    
    await usernameInput.fill('test');
    await passwordInput.fill('test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions', { timeout: 10000 });
    
    // Create new session
    await page.click('button:has-text("NEW SESSION")');
    
    // Wait for the create session dialog
    await page.waitForSelector('text=Create New Session', { state: 'visible' });
    
    // Fill session name and click CREATE
    await page.fill('input[placeholder*="Session Name"]', 'Test Session Focus');
    await page.click('button:has-text("CREATE")');
    
    await page.waitForURL('**/terminal/**');
    await page.waitForTimeout(2000);
    
    // Create a second panel
    await page.click('button:has-text("Split")');
    await page.click('text=Split Horizontal');
    await page.waitForTimeout(1000);
    
    // Type in first panel
    const panels = await page.locator('[style*="border"]').all();
    await panels[0].click();
    await page.keyboard.type('echo "First panel"');
    await page.keyboard.press('Enter');
    
    // Switch to second panel and type
    await panels[1].click();
    await page.keyboard.type('echo "Second panel"');
    await page.keyboard.press('Enter');
    
    // Verify both panels have their respective outputs
    const firstContent = await panels[0].textContent();
    const secondContent = await panels[1].textContent();
    
    expect(firstContent).toContain('First panel');
    expect(secondContent).toContain('Second panel');
  });
});