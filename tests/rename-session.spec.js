const { test, expect } = require('@playwright/test');

test.describe('Session Rename Functionality', () => {
  test('should create a session and rename it', async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3002');
    
    // Login
    await page.fill('input[type="text"]', 'test');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to sessions page
    await page.waitForURL('**/sessions');
    
    // Create a new session
    await page.click('text=Create New Session');
    
    // Fill session details
    const sessionName = `test-session-${Date.now()}`;
    await page.fill('input[placeholder="Session name"]', sessionName);
    await page.fill('input[placeholder="Hostname or IP"]', 'localhost');
    await page.fill('input[placeholder="Username"]', 'test');
    await page.fill('input[placeholder="Password"]', 'test');
    
    // Submit
    await page.click('button:has-text("Create Session")');
    
    // Wait for session to be created and redirected
    await page.waitForURL('**/terminal/**');
    
    // Take screenshot of terminal
    await page.screenshot({ path: 'tests/screenshots/rename-1-terminal.png' });
    
    // Go back to sessions list
    await page.goto('http://localhost:3002/sessions');
    
    // Wait for session card to appear
    await page.waitForSelector(`text=${sessionName}`);
    
    // Take screenshot before rename
    await page.screenshot({ path: 'tests/screenshots/rename-2-before.png' });
    
    // Look for rename functionality - could be:
    // 1. Edit button/icon on the session card
    // 2. Right-click context menu
    // 3. Three-dots menu
    
    // First, let's see what's available on the session card
    const sessionCard = page.locator(`div:has-text("${sessionName}")`).first();
    
    // Check for edit/menu buttons
    const editButton = sessionCard.locator('button[aria-label*="edit"], button[aria-label*="Edit"], button:has([data-testid*="edit"]), svg[data-testid*="edit"]');
    const menuButton = sessionCard.locator('button[aria-label*="menu"], button[aria-label*="Menu"], button:has([data-testid*="more"]), svg[data-testid*="more"]');
    
    // Try to find any button that might trigger rename
    if (await editButton.count() > 0) {
      await editButton.first().click();
      await page.screenshot({ path: 'tests/screenshots/rename-3-edit-clicked.png' });
    } else if (await menuButton.count() > 0) {
      await menuButton.first().click();
      await page.screenshot({ path: 'tests/screenshots/rename-3-menu-clicked.png' });
      
      // Look for rename option in menu
      const renameOption = page.locator('text=/rename/i, text=/edit/i');
      if (await renameOption.count() > 0) {
        await renameOption.first().click();
      }
    } else {
      // Try double-clicking the session name
      await sessionCard.locator(`text=${sessionName}`).dblclick();
      await page.screenshot({ path: 'tests/screenshots/rename-3-double-clicked.png' });
    }
    
    // Check if an input field appeared for renaming
    const renameInput = page.locator('input[value*="' + sessionName + '"]');
    if (await renameInput.count() > 0) {
      // Clear and type new name
      const newName = `renamed-${sessionName}`;
      await renameInput.clear();
      await renameInput.fill(newName);
      
      // Submit rename (Enter key or save button)
      await renameInput.press('Enter');
      
      // Wait for the change to be reflected
      await page.waitForTimeout(1000);
      
      // Verify the session was renamed
      await expect(page.locator(`text=${newName}`)).toBeVisible();
      await expect(page.locator(`text=${sessionName}`)).not.toBeVisible();
      
      await page.screenshot({ path: 'tests/screenshots/rename-4-after.png' });
      
      console.log('✓ Session renamed successfully');
    } else {
      // Take a screenshot to see what's available
      await page.screenshot({ path: 'tests/screenshots/rename-ui-inspection.png' });
      
      // Log what we found on the page
      const pageContent = await page.content();
      console.log('Session card HTML:', await sessionCard.innerHTML());
      
      // Check if rename functionality exists at all
      console.log('⚠️  Could not find rename functionality in the UI');
      console.log('Available buttons:', await sessionCard.locator('button').count());
      
      // List all buttons found
      const buttons = await sessionCard.locator('button').all();
      for (let i = 0; i < buttons.length; i++) {
        const buttonText = await buttons[i].textContent();
        const buttonAriaLabel = await buttons[i].getAttribute('aria-label');
        console.log(`Button ${i}: text="${buttonText}", aria-label="${buttonAriaLabel}"`);
      }
    }
  });
  
  test('should check if rename functionality is implemented', async ({ page }) => {
    // This is a simpler test just to check if rename is available
    await page.goto('http://localhost:3002');
    
    // Login
    await page.fill('input[type="text"]', 'test');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    // Wait for sessions page
    await page.waitForURL('**/sessions');
    
    // Check for any existing sessions
    const sessionCards = page.locator('[class*="session"], [data-testid*="session"]');
    const sessionCount = await sessionCards.count();
    
    console.log(`Found ${sessionCount} existing sessions`);
    
    if (sessionCount > 0) {
      // Inspect the first session card
      const firstCard = sessionCards.first();
      
      // Log all interactive elements
      console.log('\nInteractive elements in session card:');
      console.log('Buttons:', await firstCard.locator('button').count());
      console.log('Links:', await firstCard.locator('a').count());
      console.log('Inputs:', await firstCard.locator('input').count());
      
      // Take detailed screenshot
      await page.screenshot({ path: 'tests/screenshots/rename-session-card-detail.png', fullPage: true });
      
      // Try to trigger any available menu
      const allButtons = await firstCard.locator('button').all();
      for (let i = 0; i < allButtons.length; i++) {
        await allButtons[i].hover();
        await page.waitForTimeout(500);
        
        // Check if a tooltip or menu appeared
        const tooltips = await page.locator('[role="tooltip"], [class*="tooltip"], [class*="menu"]').count();
        if (tooltips > 0) {
          await page.screenshot({ path: `tests/screenshots/rename-button-${i}-hover.png` });
        }
      }
    }
  });
});