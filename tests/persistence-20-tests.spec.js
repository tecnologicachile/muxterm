import { test, expect } from '@playwright/test';

test.describe.serial('20 Complete Persistence Tests with Corrections', () => {
  const baseURL = 'http://localhost:3003';
  const testUser = 'test';
  const testPassword = 'test123';
  
  // Helper functions
  async function login(page) {
    await page.goto(baseURL);
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', testUser);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions', { timeout: 10000 });
  }
  
  async function createSession(page, sessionName) {
    await page.click('button:has-text("New Session")');
    await page.waitForTimeout(500);
    
    // Handle dialog if it appears
    const dialogInput = page.locator('.MuiDialog-root input[type="text"]');
    if (await dialogInput.count() > 0) {
      await dialogInput.fill(sessionName);
      await page.click('.MuiDialog-root button:has-text("Create")');
    }
    
    await page.waitForURL('**/terminal/**', { timeout: 10000 });
    await page.waitForSelector('.xterm-viewport', { timeout: 10000 });
    await page.waitForTimeout(1500);
    
    return page.url().split('/terminal/')[1];
  }
  
  async function logout(page) {
    // Go back to sessions if in terminal
    if (page.url().includes('/terminal/')) {
      await page.locator('[data-testid="ArrowBackIcon"]').locator('..').click();
      await page.waitForURL('**/sessions');
    }
    // Click logout
    await page.locator('[data-testid="LogoutIcon"]').locator('..').click();
    await page.waitForURL('**/login');
  }
  
  async function executeCommand(page, terminalIndex, command) {
    // Click on the terminal container or the canvas element
    const terminalContainer = page.locator('.terminal-container').nth(terminalIndex);
    if (await terminalContainer.count() > 0) {
      await terminalContainer.click();
    } else {
      // Fallback to clicking the xterm screen
      const xtermScreen = page.locator('.xterm-screen').nth(terminalIndex);
      await xtermScreen.click({ force: true });
    }
    await page.waitForTimeout(200);
    await page.keyboard.type(command);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
  }
  
  async function getTerminalContent(page, terminalIndex) {
    return await page.locator('.xterm-viewport').nth(terminalIndex).textContent();
  }
  
  async function openSession(page, sessionName) {
    const sessionCard = page.locator(`text="${sessionName}"`).locator('..').locator('..');
    await sessionCard.locator('button:has-text("Open")').click();
    await page.waitForURL('**/terminal/**', { timeout: 10000 });
    await page.waitForTimeout(2000);
  }

  // Test 1: Basic single terminal persistence
  test('Test 1: Single terminal with basic commands', async ({ page }) => {
    await login(page);
    const sessionName = 'Test01-Single-Basic';
    await createSession(page, sessionName);
    
    // Execute commands
    await executeCommand(page, 0, 'echo "Test 1 Start"');
    await executeCommand(page, 0, 'ls -la | head -5');
    await executeCommand(page, 0, 'pwd');
    
    const contentBefore = await getTerminalContent(page, 0);
    
    // Logout and login
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    const contentAfter = await getTerminalContent(page, 0);
    expect(contentAfter).toContain('Test 1 Start');
    expect(contentAfter).toContain('total');
    expect(contentAfter).toBe(contentBefore);
  });

  // Test 2: Two horizontal panels
  test('Test 2: Horizontal split with different content', async ({ page }) => {
    await login(page);
    const sessionName = 'Test02-Horizontal';
    await createSession(page, sessionName);
    
    // Create split
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(1000);
    
    // Add content to each panel
    await executeCommand(page, 0, 'echo "Left Panel Active"');
    await executeCommand(page, 0, 'date');
    await executeCommand(page, 1, 'echo "Right Panel Active"');
    await executeCommand(page, 1, 'whoami');
    
    const leftBefore = await getTerminalContent(page, 0);
    const rightBefore = await getTerminalContent(page, 1);
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    expect(await page.locator('.xterm-viewport').count()).toBe(2);
    const leftAfter = await getTerminalContent(page, 0);
    const rightAfter = await getTerminalContent(page, 1);
    
    expect(leftAfter).toBe(leftBefore);
    expect(rightAfter).toBe(rightBefore);
    expect(leftAfter).toContain('Left Panel Active');
    expect(rightAfter).toContain('Right Panel Active');
  });

  // Test 3: Vertical split
  test('Test 3: Vertical split with file operations', async ({ page }) => {
    await login(page);
    const sessionName = 'Test03-Vertical';
    await createSession(page, sessionName);
    
    await page.keyboard.press('Control+Shift+S');
    await page.waitForTimeout(1000);
    
    // Create and verify file in top panel
    await executeCommand(page, 0, 'echo "Top panel content" > /tmp/test3_top.txt');
    await executeCommand(page, 0, 'cat /tmp/test3_top.txt');
    
    // Different operation in bottom panel
    await executeCommand(page, 1, 'echo "Bottom panel content" > /tmp/test3_bottom.txt');
    await executeCommand(page, 1, 'ls -la /tmp/test3_*.txt');
    
    const topBefore = await getTerminalContent(page, 0);
    const bottomBefore = await getTerminalContent(page, 1);
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    expect(await page.locator('.xterm-viewport').count()).toBe(2);
    expect(await getTerminalContent(page, 0)).toBe(topBefore);
    expect(await getTerminalContent(page, 1)).toBe(bottomBefore);
  });

  // Test 4: Three panels
  test('Test 4: Three panels with environment variables', async ({ page }) => {
    await login(page);
    const sessionName = 'Test04-ThreePanels';
    await createSession(page, sessionName);
    
    // Create 3 panels
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+Shift+S');
    await page.waitForTimeout(1000);
    
    // Set different variables in each
    await executeCommand(page, 0, 'export VAR1="Panel One" && echo $VAR1');
    await executeCommand(page, 1, 'export VAR2="Panel Two" && echo $VAR2');
    await executeCommand(page, 2, 'export VAR3="Panel Three" && echo $VAR3');
    
    const contents = [];
    for (let i = 0; i < 3; i++) {
      contents[i] = await getTerminalContent(page, i);
    }
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    expect(await page.locator('.xterm-viewport').count()).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(await getTerminalContent(page, i)).toBe(contents[i]);
    }
  });

  // Test 5: Four panel grid
  test('Test 5: Four panel grid with system commands', async ({ page }) => {
    await login(page);
    const sessionName = 'Test05-Grid';
    await createSession(page, sessionName);
    
    // Create 4 panels
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+Shift+D');
      await page.waitForTimeout(500);
    }
    
    // Different system info in each
    await executeCommand(page, 0, 'uname -a');
    await executeCommand(page, 1, 'df -h | head -5');
    await executeCommand(page, 2, 'free -h');
    await executeCommand(page, 3, 'ps aux | head -5');
    
    const gridContents = [];
    for (let i = 0; i < 4; i++) {
      gridContents[i] = await getTerminalContent(page, i);
    }
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    expect(await page.locator('.xterm-viewport').count()).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(await getTerminalContent(page, i)).toBe(gridContents[i]);
    }
  });

  // Test 6: Long running output
  test('Test 6: Long output preservation', async ({ page }) => {
    await login(page);
    const sessionName = 'Test06-LongOutput';
    await createSession(page, sessionName);
    
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Generate long output
    await executeCommand(page, 0, 'for i in {1..50}; do echo "Line $i of long output"; done');
    await executeCommand(page, 1, 'find /etc -type f -name "*.conf" 2>/dev/null | head -20');
    
    const longOutput1 = await getTerminalContent(page, 0);
    const longOutput2 = await getTerminalContent(page, 1);
    
    // Verify content before disconnect
    expect(longOutput1).toContain('Line 1 of long output');
    expect(longOutput1).toContain('Line 50 of long output');
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify preservation
    expect(await getTerminalContent(page, 0)).toBe(longOutput1);
    expect(await getTerminalContent(page, 1)).toBe(longOutput2);
  });

  // Test 7: Directory navigation
  test('Test 7: Working directory persistence', async ({ page }) => {
    await login(page);
    const sessionName = 'Test07-Directories';
    await createSession(page, sessionName);
    
    // Create 3 panels
    await page.keyboard.press('Control+Shift+D');
    await page.keyboard.press('Control+Shift+S');
    await page.waitForTimeout(1000);
    
    // Navigate to different directories
    await executeCommand(page, 0, 'cd /tmp && pwd && ls | head -3');
    await executeCommand(page, 1, 'cd /etc && pwd && ls *.conf | head -3');
    await executeCommand(page, 2, 'cd /var && pwd && ls -d */ | head -3');
    
    const dirs = [];
    for (let i = 0; i < 3; i++) {
      dirs[i] = await getTerminalContent(page, i);
    }
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify directories preserved
    for (let i = 0; i < 3; i++) {
      const content = await getTerminalContent(page, i);
      expect(content).toBe(dirs[i]);
    }
    
    // Test that we're still in the same directory
    await executeCommand(page, 0, 'pwd');
    expect(await getTerminalContent(page, 0)).toContain('/tmp');
  });

  // Test 8: Command history
  test('Test 8: Command history and complex commands', async ({ page }) => {
    await login(page);
    const sessionName = 'Test08-History';
    await createSession(page, sessionName);
    
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Build command history
    await executeCommand(page, 0, 'echo "First command"');
    await executeCommand(page, 0, 'echo "Second command"');
    await executeCommand(page, 0, 'echo "Third command"');
    await executeCommand(page, 0, 'history | tail -5');
    
    // Complex piped command
    await executeCommand(page, 1, 'ls -la | grep -E "^d" | wc -l');
    await executeCommand(page, 1, 'echo "Lines: $(ls | wc -l), Files: $(ls -p | grep -v / | wc -l)"');
    
    const hist1 = await getTerminalContent(page, 0);
    const hist2 = await getTerminalContent(page, 1);
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    expect(await getTerminalContent(page, 0)).toBe(hist1);
    expect(await getTerminalContent(page, 1)).toBe(hist2);
  });

  // Test 9: Color and formatting
  test('Test 9: ANSI colors and special characters', async ({ page }) => {
    await login(page);
    const sessionName = 'Test09-Colors';
    await createSession(page, sessionName);
    
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Color output
    await executeCommand(page, 0, 'echo -e "\\033[31mRed\\033[0m \\033[32mGreen\\033[0m \\033[34mBlue\\033[0m"');
    await executeCommand(page, 0, 'ls --color=always -la | head -5');
    
    // Special characters
    await executeCommand(page, 1, 'echo "Special: © ® ™ × ÷ ± µ λ π"');
    await executeCommand(page, 1, 'echo "Emojis: 🚀 💻 ✅ ❌ 📁 📄"');
    
    const color1 = await getTerminalContent(page, 0);
    const special1 = await getTerminalContent(page, 1);
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    expect(await getTerminalContent(page, 0)).toBe(color1);
    expect(await getTerminalContent(page, 1)).toBe(special1);
    expect(special1).toContain('🚀');
  });

  // Test 10: Active panel persistence
  test('Test 10: Active panel state preservation', async ({ page }) => {
    await login(page);
    const sessionName = 'Test10-ActivePanel';
    await createSession(page, sessionName);
    
    // Create 3 panels
    await page.keyboard.press('Control+Shift+D');
    await page.keyboard.press('Control+Shift+S');
    await page.waitForTimeout(1000);
    
    // Mark each panel
    await executeCommand(page, 0, 'echo "Panel 0"');
    await executeCommand(page, 1, 'echo "Panel 1"');
    await executeCommand(page, 2, 'echo "Panel 2 - Should be active"');
    
    // Make panel 2 active
    await page.locator('.xterm-viewport').nth(2).click();
    await page.waitForTimeout(500);
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify active panel
    const activePanel = page.locator('[style*="border: 2px solid #00ff00"]');
    expect(await activePanel.count()).toBe(1);
    const activeContent = await activePanel.locator('.xterm-viewport').textContent();
    expect(activeContent).toContain('Panel 2 - Should be active');
  });

  // Test 11: File creation and modification
  test('Test 11: File operations across panels', async ({ page }) => {
    await login(page);
    const sessionName = 'Test11-FileOps';
    await createSession(page, sessionName);
    
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Create file in left panel
    await executeCommand(page, 0, 'echo "Initial content" > /tmp/test11.txt');
    await executeCommand(page, 0, 'cat /tmp/test11.txt');
    
    // Modify in right panel
    await executeCommand(page, 1, 'echo "Added line" >> /tmp/test11.txt');
    await executeCommand(page, 1, 'cat /tmp/test11.txt');
    
    const left = await getTerminalContent(page, 0);
    const right = await getTerminalContent(page, 1);
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    expect(await getTerminalContent(page, 0)).toBe(left);
    expect(await getTerminalContent(page, 1)).toBe(right);
    
    // Verify file still exists
    await executeCommand(page, 0, 'cat /tmp/test11.txt');
    const newContent = await getTerminalContent(page, 0);
    expect(newContent).toContain('Added line');
  });

  // Test 12: Process monitoring
  test('Test 12: Running processes display', async ({ page }) => {
    await login(page);
    const sessionName = 'Test12-Processes';
    await createSession(page, sessionName);
    
    // Create 4 panels
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+Shift+D');
      await page.waitForTimeout(300);
    }
    
    // Different process views
    await executeCommand(page, 0, 'ps aux | grep node | head -5');
    await executeCommand(page, 1, 'pstree -p | head -20');
    await executeCommand(page, 2, 'top -b -n 1 | head -15');
    await executeCommand(page, 3, 'netstat -tuln 2>/dev/null | head -10 || ss -tuln | head -10');
    
    const processes = [];
    for (let i = 0; i < 4; i++) {
      processes[i] = await getTerminalContent(page, i);
    }
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify all preserved
    for (let i = 0; i < 4; i++) {
      expect(await getTerminalContent(page, i)).toBe(processes[i]);
    }
  });

  // Test 13: Variables and functions
  test('Test 13: Shell variables and functions', async ({ page }) => {
    await login(page);
    const sessionName = 'Test13-Variables';
    await createSession(page, sessionName);
    
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Define variables and functions
    await executeCommand(page, 0, 'MY_VAR="Test Value 123"');
    await executeCommand(page, 0, 'function greet() { echo "Hello, $1!"; }');
    await executeCommand(page, 0, 'greet "World"');
    await executeCommand(page, 0, 'echo "MY_VAR=$MY_VAR"');
    
    // Arrays
    await executeCommand(page, 1, 'declare -a COLORS=("red" "green" "blue")');
    await executeCommand(page, 1, 'echo "Colors: ${COLORS[@]}"');
    await executeCommand(page, 1, 'echo "First color: ${COLORS[0]}"');
    
    const vars1 = await getTerminalContent(page, 0);
    const vars2 = await getTerminalContent(page, 1);
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    expect(await getTerminalContent(page, 0)).toBe(vars1);
    expect(await getTerminalContent(page, 1)).toBe(vars2);
  });

  // Test 14: Loops and control structures
  test('Test 14: Loops and multi-line commands', async ({ page }) => {
    await login(page);
    const sessionName = 'Test14-Loops';
    await createSession(page, sessionName);
    
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // For loop
    await executeCommand(page, 0, 'for i in {1..5}; do echo "Iteration $i"; sleep 0.1; done');
    
    // While loop with counter
    await executeCommand(page, 1, 'count=0; while [ $count -lt 5 ]; do echo "Count: $count"; ((count++)); done');
    
    const loop1 = await getTerminalContent(page, 0);
    const loop2 = await getTerminalContent(page, 1);
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    expect(await getTerminalContent(page, 0)).toBe(loop1);
    expect(await getTerminalContent(page, 1)).toBe(loop2);
    expect(loop1).toContain('Iteration 5');
    expect(loop2).toContain('Count: 4');
  });

  // Test 15: Error output
  test('Test 15: Error and stderr preservation', async ({ page }) => {
    await login(page);
    const sessionName = 'Test15-Errors';
    await createSession(page, sessionName);
    
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Command with error
    await executeCommand(page, 0, 'ls /nonexistent 2>&1');
    await executeCommand(page, 0, 'echo "After error"');
    
    // Mixed output
    await executeCommand(page, 1, 'echo "Normal output" && ls /fakedir 2>&1 && echo "Continues"');
    
    const err1 = await getTerminalContent(page, 0);
    const err2 = await getTerminalContent(page, 1);
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify errors preserved
    expect(await getTerminalContent(page, 0)).toBe(err1);
    expect(await getTerminalContent(page, 1)).toBe(err2);
    expect(err1).toContain('No such file or directory');
  });

  // Test 16: Unicode and international characters
  test('Test 16: Unicode and international text', async ({ page }) => {
    await login(page);
    const sessionName = 'Test16-Unicode';
    await createSession(page, sessionName);
    
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Various unicode
    await executeCommand(page, 0, 'echo "English: Hello World"');
    await executeCommand(page, 0, 'echo "Spanish: ¡Hola Mundo!"');
    await executeCommand(page, 0, 'echo "Japanese: こんにちは世界"');
    await executeCommand(page, 0, 'echo "Arabic: مرحبا بالعالم"');
    
    // Math and symbols
    await executeCommand(page, 1, 'echo "Math: ∑ ∏ ∫ ∂ ∇ ∈ ∉"');
    await executeCommand(page, 1, 'echo "Arrows: ← → ↑ ↓ ⇐ ⇒ ⇑ ⇓"');
    
    const unicode1 = await getTerminalContent(page, 0);
    const unicode2 = await getTerminalContent(page, 1);
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    expect(await getTerminalContent(page, 0)).toBe(unicode1);
    expect(await getTerminalContent(page, 1)).toBe(unicode2);
  });

  // Test 17: Tab completion and partial commands
  test('Test 17: Command line state', async ({ page }) => {
    await login(page);
    const sessionName = 'Test17-CommandLine';
    await createSession(page, sessionName);
    
    // Create 3 panels
    await page.keyboard.press('Control+Shift+D');
    await page.keyboard.press('Control+Shift+S');
    await page.waitForTimeout(1000);
    
    // Different command states
    await executeCommand(page, 0, 'echo "Complete command"');
    await executeCommand(page, 1, 'echo $PATH | tr ":" "\\n" | head -5');
    await executeCommand(page, 2, 'date +"%Y-%m-%d %H:%M:%S"');
    
    const states = [];
    for (let i = 0; i < 3; i++) {
      states[i] = await getTerminalContent(page, i);
    }
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    for (let i = 0; i < 3; i++) {
      expect(await getTerminalContent(page, i)).toBe(states[i]);
    }
  });

  // Test 18: Quotes and escaping
  test('Test 18: Quote handling and escaping', async ({ page }) => {
    await login(page);
    const sessionName = 'Test18-Quotes';
    await createSession(page, sessionName);
    
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Various quote scenarios
    await executeCommand(page, 0, 'echo "Double quotes with $USER"');
    await executeCommand(page, 0, "echo 'Single quotes with $USER'");
    await executeCommand(page, 0, 'echo `date` "is the current date"');
    
    // Escaping
    await executeCommand(page, 1, 'echo "Line with \\"escaped\\" quotes"');
    await executeCommand(page, 1, 'echo "Tab\\there\\tspacing"');
    await executeCommand(page, 1, 'echo "Newline\\nhandling"');
    
    const quote1 = await getTerminalContent(page, 0);
    const quote2 = await getTerminalContent(page, 1);
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    expect(await getTerminalContent(page, 0)).toBe(quote1);
    expect(await getTerminalContent(page, 1)).toBe(quote2);
  });

  // Test 19: Background jobs
  test('Test 19: Background processes and jobs', async ({ page }) => {
    await login(page);
    const sessionName = 'Test19-Background';
    await createSession(page, sessionName);
    
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);
    
    // Start background job
    await executeCommand(page, 0, 'sleep 100 &');
    await executeCommand(page, 0, 'jobs');
    await executeCommand(page, 0, 'ps aux | grep sleep | grep -v grep');
    
    // Multiple commands
    await executeCommand(page, 1, 'echo "First" && echo "Second" && echo "Third"');
    await executeCommand(page, 1, 'echo "Command1"; echo "Command2"; echo "Command3"');
    
    const bg1 = await getTerminalContent(page, 0);
    const bg2 = await getTerminalContent(page, 1);
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Verify
    expect(await getTerminalContent(page, 0)).toBe(bg1);
    expect(await getTerminalContent(page, 1)).toBe(bg2);
  });

  // Test 20: Complete stress test
  test('Test 20: Complete stress test - all features', async ({ page }) => {
    await login(page);
    const sessionName = 'Test20-Complete';
    await createSession(page, sessionName);
    
    // Create maximum panels
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+Shift+D');
      await page.waitForTimeout(300);
    }
    
    // Panel 0: System info
    await executeCommand(page, 0, 'echo "=== System Information ==="');
    await executeCommand(page, 0, 'uname -a');
    await executeCommand(page, 0, 'uptime');
    await executeCommand(page, 0, 'df -h | head -5');
    
    // Panel 1: File operations
    await executeCommand(page, 1, 'echo "=== File Operations ==="');
    await executeCommand(page, 1, 'mkdir -p /tmp/test20/{dir1,dir2,dir3}');
    await executeCommand(page, 1, 'touch /tmp/test20/file{1..5}.txt');
    await executeCommand(page, 1, 'ls -la /tmp/test20/');
    
    // Panel 2: Process and network
    await executeCommand(page, 2, 'echo "=== Processes & Network ==="');
    await executeCommand(page, 2, 'ps aux | wc -l');
    await executeCommand(page, 2, 'netstat -rn 2>/dev/null | head -5 || ip route');
    await executeCommand(page, 2, 'echo "Current connections: $(netstat -an 2>/dev/null | wc -l || ss -an | wc -l)"');
    
    // Panel 3: Variables and time
    await executeCommand(page, 3, 'echo "=== Environment & Time ==="');
    await executeCommand(page, 3, 'export TEST_COMPLETE="Success"');
    await executeCommand(page, 3, 'echo "Test status: $TEST_COMPLETE"');
    await executeCommand(page, 3, 'echo "Timestamp: $(date +%s)"');
    await executeCommand(page, 3, 'echo "Formatted: $(date)"');
    
    // Make panel 2 active
    await page.locator('.xterm-viewport').nth(2).click();
    await page.waitForTimeout(500);
    
    // Store all content
    const allContent = [];
    for (let i = 0; i < 4; i++) {
      allContent[i] = await getTerminalContent(page, i);
    }
    
    // Reconnect
    await logout(page);
    await login(page);
    await openSession(page, sessionName);
    
    // Comprehensive verification
    expect(await page.locator('.xterm-viewport').count()).toBe(4);
    
    // Verify all content preserved exactly
    for (let i = 0; i < 4; i++) {
      const current = await getTerminalContent(page, i);
      expect(current).toBe(allContent[i]);
    }
    
    // Verify active panel
    const activePanel = page.locator('[style*="border: 2px solid #00ff00"]');
    expect(await activePanel.count()).toBe(1);
    const activeContent = await activePanel.locator('.xterm-viewport').textContent();
    expect(activeContent).toContain('Processes & Network');
    
    // Final validation - can still execute commands
    await executeCommand(page, 0, 'echo "Still working after restore!"');
    const finalContent = await getTerminalContent(page, 0);
    expect(finalContent).toContain('Still working after restore!');
  });
});