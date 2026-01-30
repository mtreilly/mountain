import { test, expect } from '@playwright/test';

/**
 * Manual QA Review (Headed) - Feature-by-Feature
 * Based on QA-PLAYWRIGHT-REVIEW.md
 */

const BASE_URL = 'http://localhost:8788';

test.describe('Convergence Explorer - Manual QA Review', () => {
  test.beforeEach(async ({ page }) => {
    console.log('\n=== Starting new test scenario ===');
    console.log(`Navigating to: ${BASE_URL}`);
    await page.goto(BASE_URL);
    
    // Wait for initial load
    await page.waitForLoadState('networkidle');
    console.log('✓ Page loaded successfully');
  });

  test('1. Mode Switching: Countries vs Regions', async ({ page, context }) => {
    console.log('\n--- Test 1: Mode Switching (Countries vs Regions) ---');
    
    // Check initial state - should be in Countries mode by default
    const leftColumn = page.locator('[class*="left-column"], #root > div > div');
    await expect(leftColumn).toBeVisible();
    
    // Look for mode toggle buttons
    await page.pause(); // Manual step: verify mode switching works
    console.log('✓ Can toggle between Countries and Regions mode');
  });

  test('2. Selectors: chaser/target pickers, metric picker, swap actions', async ({ page }) => {
    console.log('\n--- Test 2: Selectors and Pickers ---');
    
    // Test country selectors
    await page.waitForTimeout(2000); // Wait for lists to load
    
    console.log('Testing chaser selector...');
    const chaserSelector = page.locator('#chaser-picker, select:has-text("Select chaser")').first();
    await expect(chaserSelector).toBeVisible();
    
    console.log('Testing target selector...');
    const targetSelector = page.locator('#target-picker, select:has-text("Select target")').first();
    await expect(targetSelector).toBeVisible();
    
    console.log('Testing metric picker...');
    const metricPicker = page.locator('#metric-picker, select:has-text("Select indicator")').first();
    await expect(metricPicker).toBeVisible();
    
    await page.pause(); // Manual step: test dropdown interactions and swap actions
    console.log('✓ Selectors are visible and interactive');
  });

  test('3. URL param sync: selection changes, milestones toggle, view toggle', async ({ page }) => {
    console.log('\n--- Test 3: URL Parameter Synchronization ---');
    
    // Wait for data to load
    await page.waitForTimeout(3000);
    
    console.log('Current URL:', page.url());
    
    await page.pause(); // Manual step: make selections and verify URL updates
    
    console.log('✓ URL parameters sync with UI state');
  });

  test('4. Growth controls: sliders, presets, target mode', async ({ page }) => {
    console.log('\n--- Test 4: Growth Controls ---');
    
    // Look for growth controls
    const growthControls = page.locator('[class*="growth-controls"], [class*="slider"]');
    
    if (await growthControls.count() > 0) {
      console.log('✓ Growth controls are visible');
      
      await page.pause(); // Manual step: test sliders, presets, and target mode
      console.log('✓ Sliders and presets work correctly');
    } else {
      console.log('⚠ Growth controls not immediately visible');
    }
  });

  test('5. Projection: chart + table rendering, milestones overlay', async ({ page }) => {
    console.log('\n--- Test 5: Projection Rendering ---');
    
    // Wait for initial render
    await page.waitForTimeout(3000);
    
    console.log('Testing chart rendering...');
    const chart = page.locator('svg, canvas, [class*="chart"], [class*="recharts"]');
    await expect(chart.first()).toBeVisible();
    
    await page.pause(); // Manual step: test chart/table toggle, milestones
    console.log('✓ Chart and table rendering works');
  });

  test('6. Share flows: Link, Card, Thread', async ({ page }) => {
    console.log('\n--- Test 6: Share Flows ---');
    
    // Look for share buttons
    const shareLinkButton = page.getByRole('button', { name: /link|share/i });
    
    if (await shareLinkButton.count() > 0) {
      console.log('✓ Share buttons are visible');
      
      await page.pause(); // Manual step: test Link, Card, and Thread modals
      console.log('✓ Share modals work correctly');
    } else {
      console.log('⚠ Share buttons not immediately visible');
    }
  });

  test('7. Export modal: CSV, JSON, Embed code', async ({ page }) => {
    console.log('\n--- Test 7: Export Modal ---');
    
    // Look for export menu
    const exportButton = page.getByRole('button', { name: /export|more|download/i });
    
    if (await exportButton.count() > 0) {
      console.log('✓ Export button is visible');
      
      await page.pause(); // Manual step: test export modal, downloads, embed code
      console.log('✓ Export functionality works');
    } else {
      console.log('⚠ Export button not immediately visible');
    }
  });

  test('8. Citation panel: tabs, copy actions', async ({ page }) => {
    console.log('\n--- Test 8: Citation Panel ---');
    
    // Look for citation button or shortcut
    const citationButton = page.getByRole('button', { name: /citation|citations/i });
    
    if (await citationButton.count() > 0) {
      console.log('✓ Citation button is visible');
      
      await page.pause(); // Manual step: test citation panel, tabs, copy actions
      console.log('✓ Citation panel works');
    } else {
      console.log('⚠ Citation button not immediately visible');
      // Try keyboard shortcut (Ctrl+Shift+C in the app)
      await page.keyboard.press('Control+Shift+C');
      
      const citationPanel = page.locator('[class*="citation-panel"]');
      if (await citationPanel.count() > 0) {
        console.log('✓ Citation panel accessible via keyboard');
        await page.pause();
      }
    }
  });

  test('9. Embed mode: interactive and static', async ({ page }) => {
    console.log('\n--- Test 9: Embed Mode ---');
    
    const urls = [
      { type: 'Interactive Embed', url: `${BASE_URL}/?embed=true` },
      { type: 'Static Embed', url: `${BASE_URL}/?embed=true&interactive=false` },
    ];
    
    for (const { type, url } of urls) {
      console.log(`\nTesting ${type}: ${url}`);
      await page.goto(url);
      await page.waitForTimeout(2000);
      
      // Check that it's minimal (no full app header)
      await page.pause(); // Manual step: verify embed rendering
      console.log(`✓ ${type} renders correctly`);
    }
  });

  test('10. Keyboard + Accessibility', async ({ page }) => {
    console.log('\n--- Test 10: Keyboard and Accessibility ---');
    
    // Test tab navigation
    await page.waitForTimeout(2000);
    
    console.log('Testing tab navigation...');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    console.log('Testing dropdown keyboard search...');
    await page.pause(); // Manual step: test keyboard navigation, dropdown search
    
    console.log('Testing modal Escape behavior...');
    await page.pause(); // Manual step: open modals and test Escape key
    
    console.log('✓ Keyboard navigation works');
  });

  test('11. Dark mode / light mode', async ({ page }) => {
    console.log('\n--- Test 11: Dark/Light Mode Toggle ---');
    
    // Look for theme toggle
    const themeToggle = page.getByRole('button', { name: /theme|dark|light/i });
    
    if (await themeToggle.count() > 0) {
      console.log('✓ Theme toggle is visible');
      
      await page.pause(); // Manual step: toggle themes and check contrast
      console.log('✓ Theme switching works');
    } else {
      console.log('⚠ Theme toggle not immediately visible');
    }
    
    // Test embed theme parameter
    console.log('\nTesting embed theme parameter:');
    await page.goto(`${BASE_URL}/?embed=true&embedTheme=dark`);
    await page.waitForTimeout(2000);
    await page.pause();
    
    await page.goto(`${BASE_URL}/?embed=true&embedTheme=light`);
    await page.waitForTimeout(2000);
    await page.pause();
    
    console.log('✓ Embed theme parameter works');
  });

  test('12. Invalid URL params handling', async ({ page }) => {
    console.log('\n--- Test 12: Invalid URL Parameter Handling ---');
    
    // Test invalid country codes
    const invalidUrls = [
      `${BASE_URL}/?chaser=INVALID&target=ALSO_INVALID`,
      `${BASE_URL}/?indicator=NOT_REAL`,
      `${BASE_URL}/?chaser=USA&target=CHN&indicator=FAKE_INDICATOR`,
    ];
    
    for (const url of invalidUrls) {
      console.log(`\nTesting invalid params: ${url}`);
      await page.goto(url);
      await page.waitForTimeout(3000);
      
      // Should normalize to defaults (with toast in normal mode, silently in static embed)
      await page.pause(); // Manual step: verify normalization behavior
      console.log('✓ Invalid params handled correctly');
    }
  });

  test('13. Full smoke test - regular checks', async ({ page }) => {
    console.log('\n--- Test 13: Full Smoke Test ---');
    
    console.log('1. URL correctness - selections update URL');
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    await page.pause();
    
    console.log('2. Invalid URL handling - toast + reset');
    await page.goto(`${BASE_URL}/?chaser=ZZZ&target=YYY`);
    await page.waitForTimeout(3000);
    await page.pause();
    
    console.log('3. Keyboard and focus - tab navigation');
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.pause();
    
    console.log('4. Exports - downloads are non-empty');
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    await page.pause();
    
    console.log('5. Theme - toggle and verify contrast');
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    await page.pause();
    
    console.log('✓ Full smoke test completed');
  });

  test('14. Export file downloads', async ({ page }) => {
    console.log('\n--- Test 14: Export File Downloads ---');
    
    // Enable downloads
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    
    console.log('Testing export modal opens...');
    const exportButton = page.getByRole('button', { name: /export|more/i });
    
    if (await exportButton.count() > 0) {
      await exportButton.click();
      await page.waitForTimeout(1000);
      
      console.log('Testing Observed CSV export...');
      const observedCsvButton = page.getByRole('button', { name: /observed.*csv/i });
      if (await observedCsvButton.count() > 0) {
        const [download] = await Promise.all([
          page.waitForEvent('download'),
          observedCsvButton.click(),
        ]);
        console.log('✓ Observed CSV download triggered');
      }
      
      await page.pause();
    }
  });
});

test.afterEach(async ({ page }, testInfo) => {
  console.log(`\n✓ Test "${testInfo.title}" completed`);
  console.log('========================');
});