const { test, expect } = require('@playwright/test');

test.describe('Debug Session Cards', () => {
  const serverUrl = 'http://127.0.0.1:3002';
  const clientUrl = 'http://127.0.0.1:3003';
  
  test('Debug session cards display and click', async ({ page, context }) => {
    console.log('\n=== DEBUG SESSION CARDS ===');
    
    // Login
    await page.goto(clientUrl + '/login');
    await page.fill('input[name="username"]', 'test');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/sessions');
    await page.waitForTimeout(2000);
    
    // Check all session cards
    const sessionCards = await page.locator('div.MuiCard-root').all();
    console.log(`Found ${sessionCards.length} session cards`);
    
    for (let i = 0; i < sessionCards.length; i++) {
      const card = sessionCards[i];
      
      // Get card text content
      const cardText = await card.textContent();
      console.log(`Card ${i + 1}: ${cardText?.substring(0, 100)}...`);
      
      // Get data attributes
      const cardElement = await card.elementHandle();
      const cardData = await cardElement?.evaluate(el => ({
        innerHTML: el.innerHTML.substring(0, 200),
        onClick: el.onclick !== null,
        classList: Array.from(el.classList),
        attributes: Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(' ')
      }));
      
      console.log(`  Card ${i + 1} data:`, cardData);
      
      // Check if card is clickable
      const isClickable = await card.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.cursor !== 'default' && style.pointerEvents !== 'none';
      });
      
      console.log(`  Card ${i + 1} clickable: ${isClickable}`);
      
      // If it's the first card, try to click it
      if (i === 0) {
        console.log('Attempting to click first card...');
        
        try {
          await card.click();
          
          // Wait a bit to see if navigation happens
          await page.waitForTimeout(2000);
          
          const currentUrl = page.url();
          console.log(`URL after click: ${currentUrl}`);
          
          if (currentUrl.includes('/terminal/')) {
            console.log('✅ Successfully navigated to terminal');
            
            // Go back to sessions for next test
            await page.goto(clientUrl + '/sessions');
            await page.waitForTimeout(2000);
          } else {
            console.log('❌ Did not navigate to terminal');
          }
        } catch (error) {
          console.log(`❌ Error clicking card: ${error.message}`);
        }
      }
    }
    
    // Check if there's a create button
    const createBtns = await page.locator('button').all();
    console.log(`\nFound ${createBtns.length} buttons`);
    
    for (let i = 0; i < createBtns.length; i++) {
      const btn = createBtns[i];
      const btnText = await btn.textContent();
      console.log(`Button ${i + 1}: "${btnText}"`);
      
      if (btnText && (btnText.includes('Create') || btnText.includes('New'))) {
        console.log(`  ✅ Found create button: "${btnText}"`);
      }
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/debug-session-cards.png', 
      fullPage: true 
    });
  });
});