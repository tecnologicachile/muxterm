import { test, expect } from '@playwright/test';

test.describe('15 Iterative Layout Persistence Tests', () => {
  const testUser = 'test';
  const testPassword = 'test123';
  let testResults = [];
  
  // Helper to login
  async function login(page) {
    await page.goto('http://localhost:3003');
    await page.fill('input[name="username"]', testUser);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sessions');
  }
  
  // Helper to create session
  async function createSession(page, name) {
    await page.click('button:has-text("New Session")');
    const dialogInput = await page.locator('input[label*="Session Name"]');
    if (await dialogInput.isVisible()) {
      await dialogInput.fill(name);
      await page.click('button:has-text("Create")');
    }
    await page.waitForURL('**/terminal/**');
    await page.waitForSelector('.xterm-viewport', { timeout: 10000 });
    await page.waitForTimeout(1000);
    return page.url().split('/terminal/')[1];
  }
  
  // Helper to logout
  async function logout(page) {
    if (page.url().includes('/terminal/')) {
      await page.locator('[data-testid="ArrowBackIcon"]').locator('..').click();
      await page.waitForURL('**/sessions');
    }
    await page.locator('[data-testid="LogoutIcon"]').locator('..').click();
    await page.waitForURL('**/login');
  }
  
  // Helper to execute command and wait
  async function executeCommand(page, terminalIndex, command) {
    await page.locator('.xterm-viewport').nth(terminalIndex).click();
    await page.keyboard.type(command);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  }
  
  // Helper to verify terminal content
  async function verifyContent(page, terminalIndex, expectedContent) {
    const content = await page.locator('.xterm-viewport').nth(terminalIndex).textContent();
    return content.includes(expectedContent);
  }

  // Test 1: Single terminal with basic command
  test('Iteration 1: Single terminal with ls command', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test1-Single');
      
      // Execute command
      await executeCommand(page, 0, 'ls -la');
      
      // Logout and login
      await logout(page);
      await login(page);
      
      // Restore session
      await page.locator(`text=Test1-Single`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      // Verify
      const hasContent = await verifyContent(page, 0, 'total');
      expect(hasContent).toBe(true);
      
      testResults.push({ test: 1, status: 'PASSED', layout: 'single', restored: true });
    } catch (error) {
      testResults.push({ test: 1, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 2: Two panels horizontal with different commands
  test('Iteration 2: Two panels horizontal split', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test2-Horizontal');
      
      // Create split
      await page.keyboard.press('Control+Shift+D');
      await page.waitForTimeout(500);
      
      // Execute commands
      await executeCommand(page, 0, 'echo "Panel 1: $(date)"');
      await executeCommand(page, 1, 'pwd && echo "Panel 2 working"');
      
      // Logout and login
      await logout(page);
      await login(page);
      
      // Restore
      await page.locator(`text=Test2-Horizontal`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      // Verify panels
      expect(await page.locator('.xterm-viewport').count()).toBe(2);
      expect(await verifyContent(page, 0, 'Panel 1:')).toBe(true);
      expect(await verifyContent(page, 1, 'Panel 2 working')).toBe(true);
      
      testResults.push({ test: 2, status: 'PASSED', layout: '2-horizontal', restored: true });
    } catch (error) {
      testResults.push({ test: 2, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 3: Two panels vertical with environment variables
  test('Iteration 3: Two panels vertical split with env vars', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test3-Vertical');
      
      await page.keyboard.press('Control+Shift+S');
      await page.waitForTimeout(500);
      
      await executeCommand(page, 0, 'export TEST_VAR="Top Panel" && echo $TEST_VAR');
      await executeCommand(page, 1, 'echo $USER && echo "Bottom Panel Active"');
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test3-Vertical`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      expect(await page.locator('.xterm-viewport').count()).toBe(2);
      expect(await verifyContent(page, 0, 'Top Panel')).toBe(true);
      expect(await verifyContent(page, 1, 'Bottom Panel Active')).toBe(true);
      
      testResults.push({ test: 3, status: 'PASSED', layout: '2-vertical', restored: true });
    } catch (error) {
      testResults.push({ test: 3, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 4: Three panels with file operations
  test('Iteration 4: Three panels with file operations', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test4-ThreePanels');
      
      await page.keyboard.press('Control+Shift+D');
      await page.waitForTimeout(300);
      await page.keyboard.press('Control+Shift+S');
      await page.waitForTimeout(500);
      
      await executeCommand(page, 0, 'echo "Test content" > /tmp/test4.txt && cat /tmp/test4.txt');
      await executeCommand(page, 1, 'ls -la /tmp/test4.txt');
      await executeCommand(page, 2, 'wc -l /tmp/test4.txt');
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test4-ThreePanels`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      expect(await page.locator('.xterm-viewport').count()).toBe(3);
      expect(await verifyContent(page, 0, 'Test content')).toBe(true);
      expect(await verifyContent(page, 1, 'test4.txt')).toBe(true);
      expect(await verifyContent(page, 2, '/tmp/test4.txt')).toBe(true);
      
      testResults.push({ test: 4, status: 'PASSED', layout: '3-panels', restored: true });
    } catch (error) {
      testResults.push({ test: 4, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 5: Four panel grid with processes
  test('Iteration 5: Four panel grid with process monitoring', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test5-Grid');
      
      // Create 4 panel grid
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Control+Shift+D');
        await page.waitForTimeout(300);
      }
      
      await executeCommand(page, 0, 'ps aux | grep node | head -3');
      await executeCommand(page, 1, 'top -b -n 1 | head -5');
      await executeCommand(page, 2, 'df -h | grep "/$"');
      await executeCommand(page, 3, 'free -h | grep Mem');
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test5-Grid`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      expect(await page.locator('.xterm-viewport').count()).toBe(4);
      expect(await verifyContent(page, 0, 'node')).toBe(true);
      expect(await verifyContent(page, 2, '/')).toBe(true);
      expect(await verifyContent(page, 3, 'Mem')).toBe(true);
      
      testResults.push({ test: 5, status: 'PASSED', layout: '4-grid', restored: true });
    } catch (error) {
      testResults.push({ test: 5, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 6: Complex commands with pipes
  test('Iteration 6: Two panels with piped commands', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test6-Pipes');
      
      await page.keyboard.press('Control+Shift+D');
      await page.waitForTimeout(500);
      
      await executeCommand(page, 0, 'ls -la | grep -E "^d" | wc -l');
      await executeCommand(page, 1, 'echo "Line1\nLine2\nLine3" | grep Line | sort');
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test6-Pipes`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      expect(await page.locator('.xterm-viewport').count()).toBe(2);
      const panel1 = await page.locator('.xterm-viewport').first().textContent();
      const panel2 = await page.locator('.xterm-viewport').nth(1).textContent();
      expect(panel1).toMatch(/\d+/); // Should have a number
      expect(panel2).toContain('Line1');
      
      testResults.push({ test: 6, status: 'PASSED', layout: '2-horizontal', restored: true });
    } catch (error) {
      testResults.push({ test: 6, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 7: Directory navigation persistence
  test('Iteration 7: Three panels with directory changes', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test7-Directories');
      
      await page.keyboard.press('Control+Shift+D');
      await page.keyboard.press('Control+Shift+S');
      await page.waitForTimeout(500);
      
      await executeCommand(page, 0, 'cd /tmp && pwd && ls | head -3');
      await executeCommand(page, 1, 'cd /etc && pwd && ls | grep host');
      await executeCommand(page, 2, 'cd ~ && pwd && ls -la | grep bash');
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test7-Directories`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      expect(await page.locator('.xterm-viewport').count()).toBe(3);
      expect(await verifyContent(page, 0, '/tmp')).toBe(true);
      expect(await verifyContent(page, 1, '/etc')).toBe(true);
      expect(await verifyContent(page, 2, '/home')).toBe(true);
      
      testResults.push({ test: 7, status: 'PASSED', layout: '3-panels', restored: true });
    } catch (error) {
      testResults.push({ test: 7, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 8: History commands
  test('Iteration 8: Two panels with command history', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test8-History');
      
      await page.keyboard.press('Control+Shift+D');
      await page.waitForTimeout(500);
      
      // Execute multiple commands to build history
      await executeCommand(page, 0, 'echo "Command 1"');
      await executeCommand(page, 0, 'echo "Command 2"');
      await executeCommand(page, 0, 'history | tail -3');
      
      await executeCommand(page, 1, 'for i in 1 2 3; do echo "Loop $i"; done');
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test8-History`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      expect(await page.locator('.xterm-viewport').count()).toBe(2);
      expect(await verifyContent(page, 0, 'Command 2')).toBe(true);
      expect(await verifyContent(page, 1, 'Loop 3')).toBe(true);
      
      testResults.push({ test: 8, status: 'PASSED', layout: '2-horizontal', restored: true });
    } catch (error) {
      testResults.push({ test: 8, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 9: Four panels with different shells/commands
  test('Iteration 9: Four panels with varied commands', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test9-Varied');
      
      // Create 4 panels
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Control+Shift+D');
        await page.waitForTimeout(300);
      }
      
      await executeCommand(page, 0, 'echo $SHELL && echo "Shell info displayed"');
      await executeCommand(page, 1, 'uname -a');
      await executeCommand(page, 2, 'cat /etc/os-release | head -3');
      await executeCommand(page, 3, 'uptime');
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test9-Varied`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      expect(await page.locator('.xterm-viewport').count()).toBe(4);
      expect(await verifyContent(page, 0, 'Shell info displayed')).toBe(true);
      expect(await verifyContent(page, 1, 'Linux')).toBe(true);
      expect(await verifyContent(page, 2, 'NAME=')).toBe(true);
      expect(await verifyContent(page, 3, 'load average')).toBe(true);
      
      testResults.push({ test: 9, status: 'PASSED', layout: '4-grid', restored: true });
    } catch (error) {
      testResults.push({ test: 9, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 10: Active panel persistence
  test('Iteration 10: Three panels with active panel tracking', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test10-ActivePanel');
      
      await page.keyboard.press('Control+Shift+D');
      await page.keyboard.press('Control+Shift+S');
      await page.waitForTimeout(500);
      
      await executeCommand(page, 0, 'echo "Panel 0"');
      await executeCommand(page, 1, 'echo "Panel 1"');
      await executeCommand(page, 2, 'echo "Panel 2 - This should be active"');
      
      // Make sure panel 2 is active before logout
      await page.locator('.xterm-viewport').nth(2).click();
      await page.waitForTimeout(300);
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test10-ActivePanel`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      // Verify the active panel (should have green border)
      const activePanel = await page.locator('[style*="border: 2px solid #00ff00"]');
      expect(await activePanel.count()).toBe(1);
      
      testResults.push({ test: 10, status: 'PASSED', layout: '3-panels', restored: true });
    } catch (error) {
      testResults.push({ test: 10, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 11: Long running commands
  test('Iteration 11: Two panels with long output', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test11-LongOutput');
      
      await page.keyboard.press('Control+Shift+D');
      await page.waitForTimeout(500);
      
      await executeCommand(page, 0, 'for i in {1..20}; do echo "Line $i of output"; done');
      await executeCommand(page, 1, 'find /etc -name "*.conf" 2>/dev/null | head -10');
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test11-LongOutput`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      expect(await page.locator('.xterm-viewport').count()).toBe(2);
      expect(await verifyContent(page, 0, 'Line 20 of output')).toBe(true);
      expect(await verifyContent(page, 1, '.conf')).toBe(true);
      
      testResults.push({ test: 11, status: 'PASSED', layout: '2-horizontal', restored: true });
    } catch (error) {
      testResults.push({ test: 11, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 12: Color output persistence
  test('Iteration 12: Three panels with colored output', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test12-Colors');
      
      await page.keyboard.press('Control+Shift+D');
      await page.keyboard.press('Control+Shift+S');
      await page.waitForTimeout(500);
      
      await executeCommand(page, 0, 'ls --color=always -la | head -5');
      await executeCommand(page, 1, 'grep --color=always "root" /etc/passwd | head -3');
      await executeCommand(page, 2, 'echo -e "\\033[31mRed\\033[0m \\033[32mGreen\\033[0m \\033[34mBlue\\033[0m"');
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test12-Colors`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      expect(await page.locator('.xterm-viewport').count()).toBe(3);
      // Color codes should be preserved in the terminal buffer
      expect(await verifyContent(page, 0, 'total')).toBe(true);
      expect(await verifyContent(page, 1, 'root')).toBe(true);
      expect(await verifyContent(page, 2, 'Red')).toBe(true);
      
      testResults.push({ test: 12, status: 'PASSED', layout: '3-panels', restored: true });
    } catch (error) {
      testResults.push({ test: 12, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 13: Special characters and unicode
  test('Iteration 13: Two panels with special characters', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test13-Unicode');
      
      await page.keyboard.press('Control+Shift+D');
      await page.waitForTimeout(500);
      
      await executeCommand(page, 0, 'echo "Special chars: @#$%^&*() émojis: 🚀 🎯 ✅"');
      await executeCommand(page, 1, 'echo "Quotes: \\"double\\" \'single\' \\`backtick\\`"');
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test13-Unicode`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      expect(await page.locator('.xterm-viewport').count()).toBe(2);
      expect(await verifyContent(page, 0, '🚀')).toBe(true);
      expect(await verifyContent(page, 1, 'backtick')).toBe(true);
      
      testResults.push({ test: 13, status: 'PASSED', layout: '2-horizontal', restored: true });
    } catch (error) {
      testResults.push({ test: 13, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 14: Environment and variables
  test('Iteration 14: Four panels with environment setup', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test14-Environment');
      
      // Create 4 panels
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Control+Shift+D');
        await page.waitForTimeout(300);
      }
      
      await executeCommand(page, 0, 'export MY_VAR="Panel1" && echo "MY_VAR=$MY_VAR"');
      await executeCommand(page, 1, 'alias ll="ls -la" && ll | head -3');
      await executeCommand(page, 2, 'function greet() { echo "Hello $1"; } && greet "World"');
      await executeCommand(page, 3, 'VAR_LIST=(one two three) && echo ${VAR_LIST[@]}');
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test14-Environment`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(1500);
      
      expect(await page.locator('.xterm-viewport').count()).toBe(4);
      expect(await verifyContent(page, 0, 'MY_VAR=Panel1')).toBe(true);
      expect(await verifyContent(page, 1, 'total')).toBe(true);
      expect(await verifyContent(page, 2, 'Hello World')).toBe(true);
      expect(await verifyContent(page, 3, 'one two three')).toBe(true);
      
      testResults.push({ test: 14, status: 'PASSED', layout: '4-grid', restored: true });
    } catch (error) {
      testResults.push({ test: 14, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Test 15: Full stress test - maximum complexity
  test('Iteration 15: Stress test with all features', async ({ page }) => {
    try {
      await login(page);
      const sessionId = await createSession(page, 'Test15-StressTest');
      
      // Create 4 panels
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Control+Shift+D');
        await page.waitForTimeout(300);
      }
      
      // Complex commands in each panel
      await executeCommand(page, 0, `
        echo "=== Panel 1: System Info ===" &&
        date &&
        whoami &&
        pwd &&
        echo "Terminal $TERM"
      `);
      
      await executeCommand(page, 1, `
        echo "=== Panel 2: Process List ===" &&
        ps aux | grep -E "(node|chrome)" | head -5 &&
        echo "Total processes: $(ps aux | wc -l)"
      `);
      
      await executeCommand(page, 2, `
        echo "=== Panel 3: File Operations ===" &&
        touch /tmp/test15_{1..3}.txt &&
        ls -la /tmp/test15_*.txt &&
        echo "Files created successfully"
      `);
      
      await executeCommand(page, 3, `
        echo "=== Panel 4: Network Info ===" &&
        hostname &&
        echo "Timestamp: $(date +%s)" &&
        echo "Random: $RANDOM"
      `);
      
      // Make panel 3 active
      await page.locator('.xterm-viewport').nth(2).click();
      await page.waitForTimeout(300);
      
      await logout(page);
      await login(page);
      
      await page.locator(`text=Test15-StressTest`).locator('..').locator('..').locator('button:has-text("Open")').click();
      await page.waitForTimeout(2000);
      
      // Comprehensive verification
      expect(await page.locator('.xterm-viewport').count()).toBe(4);
      
      // Verify each panel retained its content
      expect(await verifyContent(page, 0, 'Panel 1: System Info')).toBe(true);
      expect(await verifyContent(page, 0, 'Terminal')).toBe(true);
      
      expect(await verifyContent(page, 1, 'Panel 2: Process List')).toBe(true);
      expect(await verifyContent(page, 1, 'Total processes:')).toBe(true);
      
      expect(await verifyContent(page, 2, 'Panel 3: File Operations')).toBe(true);
      expect(await verifyContent(page, 2, 'Files created successfully')).toBe(true);
      
      expect(await verifyContent(page, 3, 'Panel 4: Network Info')).toBe(true);
      expect(await verifyContent(page, 3, 'Timestamp:')).toBe(true);
      
      // Verify active panel
      const activePanel = await page.locator('[style*="border: 2px solid #00ff00"]');
      expect(await activePanel.count()).toBe(1);
      
      testResults.push({ test: 15, status: 'PASSED', layout: '4-grid-complex', restored: true });
    } catch (error) {
      testResults.push({ test: 15, status: 'FAILED', error: error.message });
      throw error;
    }
  });

  // Summary report
  test.afterAll(() => {
    console.log('\n=== Test Results Summary ===');
    console.log(`Total tests: ${testResults.length}`);
    console.log(`Passed: ${testResults.filter(r => r.status === 'PASSED').length}`);
    console.log(`Failed: ${testResults.filter(r => r.status === 'FAILED').length}`);
    
    console.log('\nDetailed Results:');
    testResults.forEach(result => {
      console.log(`Test ${result.test}: ${result.status} - Layout: ${result.layout || 'N/A'}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });
  });
});