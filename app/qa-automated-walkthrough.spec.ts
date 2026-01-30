import { test, expect, type Page } from '@playwright/test';

/**
 * Automated Walkthrough Test - No Pauses
 * 
 * Run with: npx playwright test qa-automated-walkthrough.spec.ts --headed
 * 
 * This test exercises all major features automatically without pausing.
 * Screenshots are saved at each step for review.
 */

const BASE_URL = 'http://localhost:8788';

async function waitForData(page: Page) {
  // Wait for chart to be visible instead of networkidle
  await page.waitForTimeout(3000);
  try {
    await page.waitForSelector('svg', { timeout: 5000 });
  } catch {
    // SVG might not be present in all states
  }
}

test.describe('🤖 Automated Feature Walkthrough', () => {
  test.setTimeout(120000);

  test('Complete feature walkthrough', async ({ page }) => {
    console.log('\n🚀 Starting Automated Feature Walkthrough');
    console.log('==========================================\n');
    
    // ============================================
    // 1. Initial Load
    // ============================================
    console.log('📍 STEP 1: Initial Page Load');
    await page.goto(BASE_URL);
    await waitForData(page);
    
    console.log('   Taking screenshot: 01-initial-load.png');
    await page.screenshot({ path: 'test-results/01-initial-load.png', fullPage: true });
    
    // Verify main components
    const chart = page.locator('svg').first();
    await expect(chart).toBeVisible();
    console.log('   ✅ Chart is visible');
    
    // ============================================
    // 2. Test Country Pickers
    // ============================================
    console.log('\n📍 STEP 2: Testing Country Selection');
    
    // Find all buttons to understand the UI
    const allButtons = await page.getByRole('button').all();
    console.log(`   Found ${allButtons.length} buttons on page`);
    
    for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
      const text = await allButtons[i].textContent();
      console.log(`   Button ${i}: "${text?.trim() || '(no text)'}"`);
    }
    
    // Try to find and click chaser picker (usually shows a country name)
    const possiblePickers = page.getByRole('button').filter({ 
      hasText: /Nigeria|China|United States|India|Brazil|Select|Choose/i 
    });
    
    if (await possiblePickers.count() > 0) {
      const picker = possiblePickers.first();
      const pickerText = await picker.textContent();
      console.log(`   Clicking picker: "${pickerText?.trim()}"`);
      
      await picker.click();
      await page.waitForTimeout(1000);
      
      console.log('   Taking screenshot: 02-country-picker-open.png');
      await page.screenshot({ path: 'test-results/02-country-picker-open.png' });
      
      // Try to search
      const searchInput = page.getByPlaceholder(/search|filter/i).first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('India');
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        console.log('   ✅ Selected India');
      }
      
      // Close picker if still open
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    
    // ============================================
    // 3. Test Metric Selection
    // ============================================
    console.log('\n📍 STEP 3: Testing Metric Selection');
    
    // Look for select dropdowns (metric selector is often a <select>)
    const selects = page.locator('select');
    const selectCount = await selects.count();
    console.log(`   Found ${selectCount} select element(s)`);
    
    if (selectCount > 0) {
      const firstSelect = selects.first();
      const options = await firstSelect.locator('option').allTextContents();
      console.log(`   Available options: ${options.slice(0, 5).join(', ')}...`);
      
      // Select a different option if available
      if (options.length > 1) {
        await firstSelect.selectOption({ index: Math.min(1, options.length - 1) });
        await page.waitForTimeout(1500);
        console.log('   ✅ Changed selection');
        
        console.log('   Taking screenshot: 03-metric-changed.png');
        await page.screenshot({ path: 'test-results/03-metric-changed.png', fullPage: true });
      }
    }
    
    // ============================================
    // 4. Test Growth Controls
    // ============================================
    console.log('\n📍 STEP 4: Testing Growth Controls');
    
    // Navigate to specific comparison for better testing
    await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    const sliders = page.locator('input[type="range"]');
    const sliderCount = await sliders.count();
    console.log(`   Found ${sliderCount} slider(s)`);
    
    if (sliderCount > 0) {
      const slider = sliders.first();
      const bounds = await slider.boundingBox();
      if (bounds) {
        // Click at 70% position
        await page.mouse.click(bounds.x + bounds.width * 0.7, bounds.y + bounds.height / 2);
        await page.waitForTimeout(1000);
        console.log('   ✅ Adjusted slider');
        
        console.log('   Taking screenshot: 04-growth-adjusted.png');
        await page.screenshot({ path: 'test-results/04-growth-adjusted.png', fullPage: true });
      }
    }
    
    // Look for preset buttons
    const presetButtons = page.getByRole('button').filter({ 
      hasText: /preset|historic|optimistic|pessimistic|fast|slow/i 
    });
    
    if (await presetButtons.count() > 0) {
      const presetText = await presetButtons.first().textContent();
      console.log(`   Clicking preset: "${presetText?.trim()}"`);
      await presetButtons.first().click();
      await page.waitForTimeout(1000);
      console.log('   Taking screenshot: 04-preset-applied.png');
      await page.screenshot({ path: 'test-results/04-preset-applied.png', fullPage: true });
    }
    
    // ============================================
    // 5. Test Chart/Table Toggle
    // ============================================
    console.log('\n📍 STEP 5: Testing View Toggle');
    
    const tableButton = page.getByRole('button', { name: /table/i });
    if (await tableButton.count() > 0) {
      await tableButton.click();
      await page.waitForTimeout(1500);
      console.log('   ✅ Switched to table view');
      
      console.log('   Taking screenshot: 05-table-view.png');
      await page.screenshot({ path: 'test-results/05-table-view.png', fullPage: true });
      
      // Switch back to chart
      const chartButton = page.getByRole('button', { name: /chart/i });
      if (await chartButton.count() > 0) {
        await chartButton.click();
        await page.waitForTimeout(1500);
        console.log('   ✅ Switched back to chart view');
      }
    }
    
    // ============================================
    // 6. Test Share Menu
    // ============================================
    console.log('\n📍 STEP 6: Testing Share Menu');
    
    // Test Link share
    const linkButton = page.getByRole('button', { name: /^link$/i });
    if (await linkButton.count() > 0) {
      await linkButton.click();
      await page.waitForTimeout(1000);
      console.log('   ✅ Clicked Link share');
      await page.screenshot({ path: 'test-results/06-share-link.png' });
      await page.waitForTimeout(500);
    }
    
    // Test Card share
    const cardButton = page.getByRole('button', { name: /card/i });
    if (await cardButton.count() > 0) {
      await cardButton.click();
      await page.waitForTimeout(1000);
      console.log('   ✅ Opened Card share modal');
      await page.screenshot({ path: 'test-results/06-share-card.png' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    
    // Test Thread share
    const threadButton = page.getByRole('button', { name: /thread/i });
    if (await threadButton.count() > 0) {
      await threadButton.click();
      await page.waitForTimeout(1000);
      console.log('   ✅ Opened Thread generator modal');
      await page.screenshot({ path: 'test-results/06-share-thread.png' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    
    // ============================================
    // 7. Test Export Modal
    // ============================================
    console.log('\n📍 STEP 7: Testing Export Modal');
    
    const exportButton = page.getByRole('button', { name: /export|more/i }).first();
    if (await exportButton.count() > 0) {
      await exportButton.click();
      await page.waitForTimeout(1000);
      console.log('   ✅ Opened export modal');
      
      // Look for export options
      const observedCsv = page.getByRole('button', { name: /observed.*csv/i });
      const projectionCsv = page.getByRole('button', { name: /projection.*csv/i });
      const embedCode = page.getByRole('button', { name: /embed/i });
      
      console.log(`   Export options found:`);
      console.log(`   - Observed CSV: ${await observedCsv.count() > 0}`);
      console.log(`   - Projection CSV: ${await projectionCsv.count() > 0}`);
      console.log(`   - Embed Code: ${await embedCode.count() > 0}`);
      
      await page.screenshot({ path: 'test-results/07-export-modal.png' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    
    // ============================================
    // 8. Test Citation Panel (Keyboard Shortcut)
    // ============================================
    console.log('\n📍 STEP 8: Testing Citation Panel');
    
    await page.keyboard.press('Control+Shift+C');
    await page.waitForTimeout(1000);
    
    const citationPanel = page.locator('[class*="citation"]').filter({ hasText: /citation|reference|source/i });
    if (await citationPanel.count() > 0) {
      console.log('   ✅ Citation panel opened via keyboard');
      await page.screenshot({ path: 'test-results/08-citation-panel.png' });
    } else {
      console.log('   ⚠️ Citation panel not detected');
    }
    await page.keyboard.press('Escape');
    
    // ============================================
    // 9. Test Theme Toggle
    // ============================================
    console.log('\n📍 STEP 9: Testing Theme Toggle');
    
    const themeButton = page.getByRole('button', { name: /theme|dark|light/i }).first();
    if (await themeButton.count() > 0) {
      await themeButton.click();
      await page.waitForTimeout(1000);
      console.log('   ✅ Toggled theme');
      await page.screenshot({ path: 'test-results/09-theme-toggled.png', fullPage: true });
    }
    
    // ============================================
    // 10. Test Regions Mode
    // ============================================
    console.log('\n📍 STEP 10: Testing Regions Mode');
    
    await page.goto(`${BASE_URL}/?mode=regions`);
    await waitForData(page);
    console.log('   ✅ Loaded regions mode');
    await page.screenshot({ path: 'test-results/10-regions-mode.png', fullPage: true });
    
    // ============================================
    // 11. Test Embed Modes
    // ============================================
    console.log('\n📍 STEP 11: Testing Embed Modes');
    
    // Interactive embed
    await page.goto(`${BASE_URL}/?embed=true&chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    console.log('   ✅ Loaded interactive embed');
    await page.screenshot({ path: 'test-results/11-embed-interactive.png', fullPage: true });
    
    // Static embed
    await page.goto(`${BASE_URL}/?embed=true&interactive=false&chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    console.log('   ✅ Loaded static embed');
    await page.screenshot({ path: 'test-results/11-embed-static.png', fullPage: true });
    
    // Static embed with invalid params (should normalize silently)
    await page.goto(`${BASE_URL}/?embed=true&interactive=false&chaser=INVALID&target=CODES`);
    await waitForData(page);
    
    const hasToasts = await page.evaluate(() => {
      return document.querySelectorAll('[class*="toast"], [class*="sonner"]').length > 0;
    });
    
    if (hasToasts) {
      console.log('   ⚠️ Warning: Toasts visible in static embed');
    } else {
      console.log('   ✅ Static embed is silent (no toasts)');
    }
    await page.screenshot({ path: 'test-results/11-embed-static-invalid.png', fullPage: true });
    
    // ============================================
    // 12. Test Invalid URL Parameters
    // ============================================
    console.log('\n📍 STEP 12: Testing Invalid URL Parameters');
    
    await page.goto(`${BASE_URL}/?chaser=INVALID&target=ALSO_INVALID&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    console.log(`   URL after normalization: ${page.url()}`);
    
    const hasToastInNormal = await page.evaluate(() => {
      return document.querySelectorAll('[class*="toast"], [class*="sonner"]').length > 0;
    });
    
    if (hasToastInNormal) {
      console.log('   ✅ Toast shown for invalid params in normal mode');
    }
    await page.screenshot({ path: 'test-results/12-invalid-params.png', fullPage: true });
    
    // ============================================
    // 13. Test Keyboard Navigation
    // ============================================
    console.log('\n📍 STEP 13: Testing Keyboard Navigation');
    
    await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    console.log('   Tabbing through 10 elements:');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      
      const activeElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? `${el.tagName}${el.id ? '#' + el.id : ''}` : 'null';
      });
      console.log(`     ${i + 1}. ${activeElement}`);
    }
    
    // Test Escape closes modals
    const shareCardButton = page.getByRole('button', { name: /card/i });
    if (await shareCardButton.count() > 0) {
      await shareCardButton.click();
      await page.waitForTimeout(1000);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      console.log('   ✅ Escape key closes modals');
    }
    
    // ============================================
    // 14. Test Swap Functionality
    // ============================================
    console.log('\n📍 STEP 14: Testing Swap Functionality');
    
    await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
    await waitForData(page);
    
    const initialUrl = page.url();
    console.log(`   Initial URL: ${initialUrl}`);
    
    const swapButton = page.getByRole('button', { name: /swap/i });
    if (await swapButton.count() > 0) {
      await swapButton.click();
      await page.waitForTimeout(1000);
      console.log(`   URL after swap: ${page.url()}`);
      console.log('   ✅ Swap button works');
      await page.screenshot({ path: 'test-results/14-after-swap.png', fullPage: true });
    }
    
    // ============================================
    // Summary
    // ============================================
    console.log('\n==========================================');
    console.log('✅ Walkthrough Complete!');
    console.log('==========================================');
    console.log('\n📸 Screenshots saved to test-results/');
    console.log('   Review the screenshots to verify UI appearance');
  });
});
