import { test, expect, type Page } from '@playwright/test';

/**
 * Headed Walkthrough Test - Interactive QA
 * 
 * Run with: npx playwright test qa-headed-walkthrough.spec.ts --headed
 * 
 * This test exercises all major features of the Convergence Explorer.
 * It pauses at key points so you can observe the UI and interact manually.
 */

const BASE_URL = 'http://localhost:8788';

async function waitForData(page: Page) {
  // Wait for the loading state to resolve
  await page.waitForTimeout(3000);
  // Wait for network to be idle
  await page.waitForLoadState('networkidle');
}

test.describe('🔍 Convergence Explorer - Headed Walkthrough', () => {
  
  // ============================================
  // TEST 1: Initial Load & Basic Layout
  // ============================================
  test('1️⃣ Initial Load - Verify basic layout', async ({ page }) => {
    console.log('\n🚀 TEST 1: Initial Load & Basic Layout');
    console.log('==========================================');
    
    await page.goto(BASE_URL);
    await waitForData(page);
    
    // Verify page title
    await expect(page).toHaveTitle(/Convergence|Explorer|Mountain/i);
    console.log('✅ Page title is correct');
    
    // Verify main layout elements exist
    const appContainer = page.locator('#root');
    await expect(appContainer).toBeVisible();
    console.log('✅ App container is visible');
    
    // Look for main content areas
    const chart = page.locator('svg').first();
    await expect(chart).toBeVisible();
    console.log('✅ Chart (SVG) is visible');
    
    console.log('\n📸 Taking screenshot of initial state...');
    await page.screenshot({ path: 'test-results/01-initial-load.png', fullPage: true });
    
    await page.pause();
  });

  // ============================================
  // TEST 2: Country Selection
  // ============================================
  test('2️⃣ Country Selection - Change chaser and target', async ({ page }) => {
    console.log('\n🚀 TEST 2: Country Selection');
    console.log('==========================================');
    
    await page.goto(BASE_URL);
    await waitForData(page);
    
    // Find and click the chaser country selector
    console.log('\n📝 Looking for country selectors...');
    
    // Look for buttons that might open the country picker
    const countryButtons = page.getByRole('button').filter({ hasText: /Nigeria|China|United States|Select/i });
    console.log(`Found ${await countryButtons.count()} potential country buttons`);
    
    // Try to find chaser selector
    const chaserButton = page.locator('[data-testid="chaser-picker"], button:has-text("Nigeria"), button:has-text("China")').first();
    if (await chaserButton.count() > 0) {
      console.log('🖱️  Clicking chaser selector...');
      await chaserButton.click();
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot after opening chaser picker...');
      await page.screenshot({ path: 'test-results/02a-chaser-picker-open.png' });
      
      // Try to search for a country
      const searchInput = page.getByPlaceholder(/search|filter/i).first();
      if (await searchInput.count() > 0) {
        console.log('⌨️  Searching for "India"...');
        await searchInput.fill('India');
        await page.waitForTimeout(500);
        
        // Press Enter to select first result
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        console.log('✅ Selected India as chaser');
      }
      
      await page.pause();
    }
    
    // Test target country selection
    const targetButton = page.locator('[data-testid="target-picker"], button:has-text("Ireland"), button:has-text("United States")').first();
    if (await targetButton.count() > 0) {
      console.log('🖱️  Clicking target selector...');
      await targetButton.click();
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot after opening target picker...');
      await page.screenshot({ path: 'test-results/02b-target-picker-open.png' });
      
      await page.pause();
    }
    
    console.log('\n📸 Final screenshot of country selection test...');
    await page.screenshot({ path: 'test-results/02c-country-selection-final.png', fullPage: true });
  });

  // ============================================
  // TEST 3: Metric/Indicator Selection
  // ============================================
  test('3️⃣ Metric Selection - Change indicators', async ({ page }) => {
    console.log('\n🚀 TEST 3: Metric Selection');
    console.log('==========================================');
    
    await page.goto(BASE_URL);
    await waitForData(page);
    
    // Find metric selector
    const metricSelector = page.locator('select').filter({ has: page.locator('option:has-text("GDP")') }).first();
    
    if (await metricSelector.count() > 0) {
      console.log('📝 Found metric selector');
      
      // Get available options
      const options = await metricSelector.locator('option').allTextContents();
      console.log('Available metrics:', options.slice(0, 5));
      
      // Select a different metric
      console.log('🖱️  Changing metric to Life Expectancy...');
      await metricSelector.selectOption({ label: /Life Expectancy/i });
      await page.waitForTimeout(1500);
      
      console.log('✅ Metric changed');
      await page.screenshot({ path: 'test-results/03-metric-changed.png', fullPage: true });
      
      await page.pause();
    } else {
      console.log('⚠️ Metric selector not found with basic locator, trying alternative...');
      // Try button-based metric picker
      const metricButton = page.getByRole('button').filter({ hasText: /GDP|Population|Life|Internet|Fertility/i }).first();
      if (await metricButton.count() > 0) {
        await metricButton.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/03-metric-picker-open.png' });
        await page.pause();
      }
    }
  });

  // ============================================
  // TEST 4: Growth Rate Controls
  // ============================================
  test('4️⃣ Growth Controls - Sliders and presets', async ({ page }) => {
    console.log('\n🚀 TEST 4: Growth Rate Controls');
    console.log('==========================================');
    
    await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    // Look for growth rate sliders
    const sliders = page.locator('input[type="range"]');
    const sliderCount = await sliders.count();
    console.log(`Found ${sliderCount} slider(s)`);
    
    if (sliderCount > 0) {
      console.log('🖱️  Adjusting first slider...');
      const firstSlider = sliders.first();
      
      // Get slider bounds
      const bounds = await firstSlider.boundingBox();
      if (bounds) {
        // Click at different positions on the slider
        await page.mouse.click(bounds.x + bounds.width * 0.7, bounds.y + bounds.height / 2);
        await page.waitForTimeout(500);
        
        console.log('📸 Screenshot after slider adjustment...');
        await page.screenshot({ path: 'test-results/04-growth-slider-adjusted.png', fullPage: true });
        
        await page.pause();
      }
    }
    
    // Look for preset buttons
    const presetButtons = page.getByRole('button').filter({ hasText: /preset|fast|slow|historic|optimistic|pessimistic/i });
    if (await presetButtons.count() > 0) {
      console.log(`Found ${await presetButtons.count()} preset button(s)`);
      await presetButtons.first().click();
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot after applying preset...');
      await page.screenshot({ path: 'test-results/04-preset-applied.png', fullPage: true });
      
      await page.pause();
    }
  });

  // ============================================
  // TEST 5: Chart and Table Views
  // ============================================
  test('5️⃣ View Toggle - Chart vs Table', async ({ page }) => {
    console.log('\n🚀 TEST 5: Chart and Table Views');
    console.log('==========================================');
    
    await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    // Look for view toggle buttons
    const viewButtons = page.getByRole('button').filter({ hasText: /chart|table|view/i });
    console.log(`Found ${await viewButtons.count()} view button(s)`);
    
    // Check for Chart/Table toggle
    const chartButton = page.getByRole('button', { name: /chart/i });
    const tableButton = page.getByRole('button', { name: /table/i });
    
    if (await tableButton.count() > 0) {
      console.log('🖱️  Switching to table view...');
      await tableButton.click();
      await page.waitForTimeout(1500);
      
      console.log('📸 Screenshot of table view...');
      await page.screenshot({ path: 'test-results/05-table-view.png', fullPage: true });
      
      await page.pause();
    }
    
    if (await chartButton.count() > 0) {
      console.log('🖱️  Switching back to chart view...');
      await chartButton.click();
      await page.waitForTimeout(1500);
      
      console.log('📸 Screenshot of chart view...');
      await page.screenshot({ path: 'test-results/05-chart-view.png', fullPage: true });
      
      await page.pause();
    }
  });

  // ============================================
  // TEST 6: Milestones Toggle
  // ============================================
  test('6️⃣ Milestones - Toggle overlay', async ({ page }) => {
    console.log('\n🚀 TEST 6: Milestones Toggle');
    console.log('==========================================');
    
    await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    // Look for milestones toggle
    const milestonesToggle = page.getByRole('button').filter({ hasText: /milestone|ms=/i });
    const milestonesCheckbox = page.getByRole('checkbox').filter({ hasText: /milestone/i });
    
    if (await milestonesToggle.count() > 0) {
      console.log('🖱️  Clicking milestones toggle...');
      await milestonesToggle.click();
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot with milestones toggled...');
      await page.screenshot({ path: 'test-results/06-milestones-toggled.png', fullPage: true });
      
      await page.pause();
    } else if (await milestonesCheckbox.count() > 0) {
      console.log('☑️  Checking milestones checkbox...');
      await milestonesCheckbox.click();
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot with milestones toggled...');
      await page.screenshot({ path: 'test-results/06-milestones-toggled.png', fullPage: true });
      
      await page.pause();
    } else {
      console.log('⚠️ Milestones toggle not found');
    }
  });

  // ============================================
  // TEST 7: Share Menu (Link, Card, Thread)
  // ============================================
  test('7️⃣ Share Menu - Link, Card, Thread modals', async ({ page }) => {
    console.log('\n🚀 TEST 7: Share Menu');
    console.log('==========================================');
    
    await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    // Look for share buttons
    const shareLinkButton = page.getByRole('button', { name: /^link$/i });
    const shareCardButton = page.getByRole('button', { name: /card/i });
    const shareThreadButton = page.getByRole('button', { name: /thread/i });
    const shareMenuButton = page.getByRole('button', { name: /share/i });
    
    // Test Share Link
    if (await shareLinkButton.count() > 0) {
      console.log('🖱️  Clicking Share Link button...');
      await shareLinkButton.click();
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot of share link toast/modal...');
      await page.screenshot({ path: 'test-results/07a-share-link.png' });
      
      await page.pause();
    }
    
    // Test Share Card
    if (await shareCardButton.count() > 0) {
      console.log('🖱️  Clicking Share Card button...');
      await shareCardButton.click();
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot of share card modal...');
      await page.screenshot({ path: 'test-results/07b-share-card-modal.png' });
      
      await page.pause();
      
      // Close modal with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    
    // Test Share Thread
    if (await shareThreadButton.count() > 0) {
      console.log('🖱️  Clicking Share Thread button...');
      await shareThreadButton.click();
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot of thread generator modal...');
      await page.screenshot({ path: 'test-results/07c-share-thread-modal.png' });
      
      await page.pause();
      
      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  // ============================================
  // TEST 8: Export Modal
  // ============================================
  test('8️⃣ Export Modal - CSV, JSON, Embed', async ({ page }) => {
    console.log('\n🚀 TEST 8: Export Modal');
    console.log('==========================================');
    
    await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    // Look for export/more options button
    const exportButton = page.getByRole('button', { name: /export|more|download/i });
    const moreButton = page.getByRole('button').filter({ has: page.locator('svg') }).nth(5); // Often the "..." button
    
    if (await exportButton.count() > 0) {
      console.log('🖱️  Clicking Export button...');
      await exportButton.first().click();
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot of export modal...');
      await page.screenshot({ path: 'test-results/08-export-modal.png' });
      
      // Look for export options
      const observedCsv = page.getByRole('button', { name: /observed.*csv/i });
      const projectionCsv = page.getByRole('button', { name: /projection.*csv/i });
      const reportJson = page.getByRole('button', { name: /report.*json/i });
      const embedCode = page.getByRole('button', { name: /embed/i });
      
      console.log(`Found export options: Observed CSV (${await observedCsv.count()}), Projection CSV (${await projectionCsv.count()}), Report JSON (${await reportJson.count()}), Embed (${await embedCode.count()})`);
      
      await page.pause();
      
      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      console.log('⚠️ Export button not found');
    }
  });

  // ============================================
  // TEST 9: Citation Panel
  // ============================================
  test('9️⃣ Citation Panel', async ({ page }) => {
    console.log('\n🚀 TEST 9: Citation Panel');
    console.log('==========================================');
    
    await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    // Try keyboard shortcut first (Ctrl+Shift+C)
    console.log('⌨️  Pressing Ctrl+Shift+C for citation panel...');
    await page.keyboard.press('Control+Shift+C');
    await page.waitForTimeout(1000);
    
    // Check if citation panel opened
    const citationPanel = page.locator('[class*="citation"], [role="dialog"]').filter({ hasText: /citation|reference|source/i });
    
    if (await citationPanel.count() > 0) {
      console.log('✅ Citation panel opened via keyboard shortcut');
      await page.screenshot({ path: 'test-results/09-citation-panel.png' });
      await page.pause();
      
      // Close with Escape
      await page.keyboard.press('Escape');
    } else {
      // Try finding a citation button
      const citationButton = page.getByRole('button', { name: /citation/i });
      if (await citationButton.count() > 0) {
        console.log('🖱️  Clicking Citation button...');
        await citationButton.click();
        await page.waitForTimeout(1000);
        
        await page.screenshot({ path: 'test-results/09-citation-panel.png' });
        await page.pause();
        
        await page.keyboard.press('Escape');
      } else {
        console.log('⚠️ Citation panel/button not found');
      }
    }
  });

  // ============================================
  // TEST 10: Dark/Light Mode
  // ============================================
  test('🔟 Theme Toggle - Dark/Light Mode', async ({ page }) => {
    console.log('\n🚀 TEST 10: Theme Toggle');
    console.log('==========================================');
    
    await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    // Find theme toggle
    const themeButton = page.getByRole('button', { name: /theme|dark|light/i });
    const themeToggle = page.locator('[class*="theme-toggle"], [data-testid="theme-toggle"]');
    
    if (await themeButton.count() > 0 || await themeToggle.count() > 0) {
      const button = themeButton.count() > 0 ? themeButton.first() : themeToggle.first();
      
      console.log('🖱️  Clicking theme toggle...');
      await button.click();
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot in dark mode...');
      await page.screenshot({ path: 'test-results/10-dark-mode.png', fullPage: true });
      
      await page.pause();
      
      // Toggle back
      await button.click();
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot in light mode...');
      await page.screenshot({ path: 'test-results/10-light-mode.png', fullPage: true });
      
      await page.pause();
    } else {
      console.log('⚠️ Theme toggle not found');
    }
  });

  // ============================================
  // TEST 11: Regions Mode
  // ============================================
  test('1️⃣1️⃣ Regions Mode', async ({ page }) => {
    console.log('\n🚀 TEST 11: Regions Mode');
    console.log('==========================================');
    
    await page.goto(`${BASE_URL}/?mode=regions`);
    await waitForData(page);
    
    console.log('📸 Screenshot of regions mode...');
    await page.screenshot({ path: 'test-results/11-regions-mode.png', fullPage: true });
    
    // Look for region selectors
    const regionSelectors = page.getByRole('button').filter({ hasText: /Sub-Saharan|Europe|Asia|America|Africa/i });
    console.log(`Found ${await regionSelectors.count()} region selector(s)`);
    
    if (await regionSelectors.count() > 0) {
      await regionSelectors.first().click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ path: 'test-results/11a-region-picker-open.png' });
      await page.pause();
    }
  });

  // ============================================
  // TEST 12: Embed Mode (Interactive)
  // ============================================
  test('1️⃣2️⃣ Embed Mode - Interactive', async ({ page }) => {
    console.log('\n🚀 TEST 12: Embed Mode (Interactive)');
    console.log('==========================================');
    
    await page.goto(`${BASE_URL}/?embed=true&chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    console.log('📸 Screenshot of interactive embed...');
    await page.screenshot({ path: 'test-results/12-embed-interactive.png', fullPage: true });
    
    // Verify minimal UI (no full app header)
    const hasFullHeader = await page.evaluate(() => {
      return document.querySelector('header, nav, [class*="app-header"]') !== null;
    });
    
    if (hasFullHeader) {
      console.log('⚠️ Warning: Full app header visible in embed mode');
    } else {
      console.log('✅ Embed mode shows minimal UI (no full header)');
    }
    
    await page.pause();
  });

  // ============================================
  // TEST 13: Embed Mode (Static)
  // ============================================
  test('1️⃣3️⃣ Embed Mode - Static', async ({ page }) => {
    console.log('\n🚀 TEST 13: Embed Mode (Static)');
    console.log('==========================================');
    
    await page.goto(`${BASE_URL}/?embed=true&interactive=false&chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    console.log('📸 Screenshot of static embed...');
    await page.screenshot({ path: 'test-results/13-embed-static.png', fullPage: true });
    
    // Verify minimal UI
    const hasFullHeader = await page.evaluate(() => {
      return document.querySelector('header, nav, [class*="app-header"]') !== null;
    });
    
    if (hasFullHeader) {
      console.log('⚠️ Warning: Full app header visible in static embed mode');
    } else {
      console.log('✅ Static embed mode shows minimal UI');
    }
    
    // Verify no toasts in static embed
    const hasToasts = await page.evaluate(() => {
      return document.querySelectorAll('[class*="toast"], [class*="sonner"]').length > 0;
    });
    
    if (hasToasts) {
      console.log('⚠️ Warning: Toasts visible in static embed (should be silent)');
    } else {
      console.log('✅ Static embed is silent (no toasts)');
    }
    
    await page.pause();
  });

  // ============================================
  // TEST 14: Invalid URL Parameter Handling
  // ============================================
  test('1️⃣4️⃣ Invalid URL Parameters', async ({ page }) => {
    console.log('\n🚀 TEST 14: Invalid URL Parameters');
    console.log('==========================================');
    
    // Test invalid country codes
    console.log('\n📝 Testing invalid country codes...');
    await page.goto(`${BASE_URL}/?chaser=INVALID&target=ALSO_INVALID&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    console.log('Current URL after normalization:', page.url());
    
    // Check for toast notification
    const hasToast = await page.evaluate(() => {
      return document.querySelectorAll('[class*="toast"], [class*="sonner"]').length > 0;
    });
    
    if (hasToast) {
      console.log('✅ Toast shown for invalid params in normal mode');
    }
    
    await page.screenshot({ path: 'test-results/14-invalid-params-normal.png', fullPage: true });
    await page.pause();
    
    // Test invalid params in static embed (should be silent)
    console.log('\n📝 Testing invalid params in static embed...');
    await page.goto(`${BASE_URL}/?embed=true&interactive=false&chaser=INVALID&target=CODES`);
    await waitForData(page);
    
    console.log('Current URL after silent normalization:', page.url());
    
    const hasToastInEmbed = await page.evaluate(() => {
      return document.querySelectorAll('[class*="toast"], [class*="sonner"]').length > 0;
    });
    
    if (hasToastInEmbed) {
      console.log('⚠️ Warning: Toast shown in static embed (should be silent)');
    } else {
      console.log('✅ Static embed normalized silently (no toast)');
    }
    
    await page.screenshot({ path: 'test-results/14-invalid-params-embed.png', fullPage: true });
    await page.pause();
  });

  // ============================================
  // TEST 15: Keyboard Navigation
  // ============================================
  test('1️⃣5️⃣ Keyboard Navigation', async ({ page }) => {
    console.log('\n🚀 TEST 15: Keyboard Navigation');
    console.log('==========================================');
    
    await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    // Tab through interactive elements
    console.log('\n📝 Tabbing through elements...');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      
      const activeElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? `${el.tagName}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ').join('.') : ''}` : 'null';
      });
      
      console.log(`  Tab ${i + 1}: ${activeElement}`);
    }
    
    await page.pause();
    
    // Test Escape key closes modals
    console.log('\n📝 Testing Escape key...');
    
    // First open a modal
    const shareButton = page.getByRole('button', { name: /card|thread/i }).first();
    if (await shareButton.count() > 0) {
      await shareButton.click();
      await page.waitForTimeout(1000);
      
      console.log('🖱️  Modal opened, now pressing Escape...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      // Check if modal closed
      const modalStillOpen = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"], [class*="modal"]');
        return modal && (modal as HTMLElement).offsetParent !== null;
      });
      
      if (modalStillOpen) {
        console.log('⚠️ Warning: Modal may not have closed with Escape');
      } else {
        console.log('✅ Modal closed with Escape key');
      }
    }
    
    await page.pause();
  });

  // ============================================
  // TEST 16: Swap Countries
  // ============================================
  test('1️⃣6️⃣ Swap Countries', async ({ page }) => {
    console.log('\n🚀 TEST 16: Swap Countries');
    console.log('==========================================');
    
    await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    // Look for swap button
    const swapButton = page.getByRole('button', { name: /swap/i });
    const swapIcon = page.locator('button:has(svg), button[class*="swap"]').first();
    
    if (await swapButton.count() > 0) {
      console.log('🖱️  Clicking swap button...');
      await swapButton.click();
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot after swap...');
      await page.screenshot({ path: 'test-results/16-after-swap.png', fullPage: true });
      
      console.log('Current URL after swap:', page.url());
      await page.pause();
    } else if (await swapIcon.count() > 0) {
      console.log('🖱️  Clicking swap icon button...');
      await swapIcon.click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ path: 'test-results/16-after-swap.png', fullPage: true });
      console.log('Current URL after swap:', page.url());
      await page.pause();
    } else {
      console.log('⚠️ Swap button not found');
    }
  });

  // ============================================
  // TEST 17: Full Smoke Test
  // ============================================
  test('1️⃣7️⃣ Full Smoke Test', async ({ page }) => {
    console.log('\n🚀 TEST 17: Full Smoke Test');
    console.log('==========================================');
    
    console.log('\n📋 Running through all major features...\n');
    
    // 1. Load page
    console.log('1️⃣ Loading page...');
    await page.goto(BASE_URL);
    await waitForData(page);
    console.log('   ✅ Page loaded');
    
    // 2. Change countries
    console.log('2️⃣ Testing country selection...');
    const chaserButton = page.locator('button:has-text("Nigeria"), button:has-text("China"), [data-testid="chaser-picker"]').first();
    if (await chaserButton.count() > 0) {
      await chaserButton.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      console.log('   ✅ Country picker opens');
    }
    
    // 3. Check chart renders
    console.log('3️⃣ Verifying chart...');
    const chart = page.locator('svg').first();
    await expect(chart).toBeVisible();
    console.log('   ✅ Chart is visible');
    
    // 4. Check for share buttons
    console.log('4️⃣ Checking share functionality...');
    const shareButtons = page.getByRole('button').filter({ hasText: /link|card|thread|share/i });
    console.log(`   ✅ Found ${await shareButtons.count()} share button(s)`);
    
    // 5. Check for export
    console.log('5️⃣ Checking export functionality...');
    const exportButton = page.getByRole('button', { name: /export|more/i });
    console.log(`   ✅ Export button exists: ${await exportButton.count() > 0}`);
    
    // 6. Final screenshot
    console.log('6️⃣ Taking final screenshot...');
    await page.screenshot({ path: 'test-results/17-full-smoke-test.png', fullPage: true });
    console.log('   ✅ Screenshot saved');
    
    console.log('\n✅ Full smoke test completed!');
    
    await page.pause();
  });
});
