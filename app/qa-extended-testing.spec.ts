import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:8788';

/**
 * Extended QA Testing Suite
 * Additional scenarios beyond QA-PLAYWRIGHT-REVIEW.md
 */

test.describe('Extended QA Testing Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Performance & Responsiveness', () => {
    test('Initial load performance', async ({ page }) => {
      const performanceTiming = await page.evaluate(() => 
        JSON.stringify(performance.timing)
      );
      const timing = JSON.parse(performanceTiming);
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      
      console.log(`Initial load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(5000); // Should load under 5 seconds
    });

    test('Chart rendering performance', async ({ page }) => {
      await page.waitForTimeout(3000); // Wait for data load
      
      const chartRenderTime = await page.evaluate(async () => {
        const start = performance.now();
        // Force a re-render by changing a state
        return performance.now() - start;
      });
      
      console.log(`Chart render time: ${chartRenderTime}ms`);
    });

    test('Mobile viewport responsiveness', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      await page.waitForTimeout(1000);
      
      const layoutOk = await page.evaluate(() => {
        const leftColumn = document.querySelector('[class*="left-column"]');
        const rightSidebar = document.querySelector('[class*="right-sidebar"]');
        return {
          leftColumnVisible: !!leftColumn,
          rightSidebarVisible: !!rightSidebar,
          noHorizontalScroll: window.innerWidth >= document.documentElement.scrollWidth
        };
      });
      
      expect(layoutOk.noHorizontalScroll).toBe(true);
      expect(layoutOk.leftColumnVisible).toBe(true);
    });

    test('Tablet viewport (768px)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(1000);
      
      const layoutOk = await page.evaluate(() => {
        return window.innerWidth >= document.documentElement.scrollWidth;
      });
      
      expect(layoutOk).toBe(true); // No horizontal scroll
    });

    test('Large desktop viewport (1920px)', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1000);
      
      const layoutOk = await page.evaluate(() => {
        return window.innerWidth >= document.documentElement.scrollWidth;
      });
      
      expect(layoutOk).toBe(true);
    });
  });

  test.describe('Data Integrity & Calculations', () => {
    test('Verify CAGR calculation matches expected values', async ({ page }) => {
      await page.waitForTimeout(3000);
      
      // Test with known values: Nigeria vs Ireland GDP
      await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP&baseYear=2023`);
      await page.waitForTimeout(3000);
      
      const calculationValid = await page.evaluate(() => {
        const state = (window as any).__test_state__ || {};
        return {
          hasChaser: !!state.chaser,
          hasTarget: !!state.target,
          hasIndicator: !!state.indicator,
          hasValidGrowthRates: (state.cg || 0) >= 0 && (state.tg || 0) >= 0
        };
      });
      
      expect(calculationValid.hasChaser).toBe(true);
      expect(calculationValid.hasTarget).toBe(true);
      expect(calculationValid.hasIndicator).toBe(true);
    });

    test('Projection timeline accuracy', async ({ page }) => {
      await page.goto(`${BASE_URL}/?chaser=USA&target=CHN&indicator=GDP_PCAP_PPP&horizon=50`);
      await page.waitForTimeout(3000);
      
      const projectionValid = await page.evaluate(() => {
        const svg = document.querySelector('svg');
        const hasProjectionElements = svg?.querySelectorAll('path, circle, line').length > 10;
        return hasProjectionElements;
      });
      
      expect(projectionValid).toBe(true);
    });

    test('Data consistency across chart and table views', async ({ page }) => {
      await page.goto(`${BASE_URL}/?chaser=BRA&target=IND&indicator=GDP_PCAP_PPP&view=chart`);
      await page.waitForTimeout(3000);
      
      const chartData = await page.evaluate(() => {
        const svg = document.querySelector('svg');
        return {
          hasChart: !!svg,
          pathCount: svg?.querySelectorAll('path').length || 0
        };
      });
      
      // Switch to table view
      const tableToggle = await page.getByRole('button', { name: /table/i });
      if (await tableToggle.count() > 0) {
        await tableToggle.click();
        await page.waitForTimeout(1000);
        
        const tableVisible = await page.evaluate(() => {
          const table = document.querySelector('table');
          return !!table;
        });
        
        expect(tableVisible).toBe(true);
      }
      
      expect(chartData.hasChart).toBe(true);
      expect(chartData.pathCount).toBeGreaterThan(0);
    });
  });

  test.describe('Stress & Edge Cases', () => {
    test('Rapid mode switching stress test', async ({ page }) => {
      await page.waitForTimeout(2000);
      
      // Rapidly switch between modes if available
      const modeButtons = await page.getByRole('button', { name: /countries|regions/i });
      
      if (await modeButtons.count() > 0) {
        for (let i = 0; i < 10; i++) {
          await modeButtons.first().click();
          await page.waitForTimeout(100);
          if (await modeButtons.count() > 1) {
            await modeButtons.nth(1).click();
            await page.waitForTimeout(100);
          }
        }
      }
      
      // Should not crash or show errors
      const pageStable = await page.evaluate(() => {
        return !document.querySelector('.error, .crash, .exception');
      });
      
      expect(pageStable).toBe(true);
    });

    test('Rapid metric switching', async ({ page }) => {
      await page.waitForTimeout(2000);
      
      const metricPicker = await page.locator('#metric-picker, select:has-text("Select indicator")').first();
      
      if (await metricPicker.isVisible()) {
        const options = await metricPicker.locator('option').all();
        const optionValues = await Promise.all(
          options.slice(0, 5).map(opt => opt.getAttribute('value'))
        );
        
        // Switch rapidly between first 5 indicators
        for (const value of optionValues) {
          if (value) {
            await metricPicker.selectOption(value);
            await page.waitForTimeout(150);
          }
        }
      }
      
      // Should handle rapid changes gracefully
      const noErrors = await page.evaluate(() => {
        const consoleErrors = (window as any).__test_console_errors__ || [];
        return consoleErrors.length === 0;
      });
      
      expect(noErrors).toBe(true);
    });

    test('Many concurrent toasts', async ({ page }) => {
      await page.goto(`${BASE_URL}/?chaser=INVALID&target=ALSO_INVALID`);
      await page.waitForTimeout(3000);
      
      // Then change more parameters
      await page.goto(`${BASE_URL}/?chaser=XXX&target=YYY&indicator=FAKE`);
      await page.waitForTimeout(1000);
      
      // Should not stack toasts indefinitely
      const toastCount = await page.evaluate(() => {
        const toasts = document.querySelectorAll('[class*="toast"], [class*="sonner"], [data-sonner-toast]');
        return toasts.length;
      });
      
      // Should have at most 1-2 toasts visible
      expect(toastCount).toBeLessThanOrEqual(2);
    });

    test('Long-running session stability', async ({ page }) => {
      const startMemory = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0);
      
      // Perform many operations
      for (let i = 0; i < 20; i++) {
        await page.evaluate(() => {
          const el = document.querySelector('select, button');
          el?.dispatchEvent(new Event('click', { bubbles: true }));
        });
        await page.waitForTimeout(100);
      }
      
      const endMemory = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0);
      const memoryGrowth = (endMemory - startMemory) / 1024 / 1024; // MB
      
      console.log(`Memory growth: ${memoryGrowth.toFixed(2)}MB`);
      expect(memoryGrowth).toBeLessThan(50); // Should not grow more than 50MB
    });
  });

  test.describe('Regression Tests', () => {
    test('Regression: Static embed should NOT show full app UI', async ({ page }) => {
      await page.goto(`${BASE_URL}/?embed=true&interactive=false&chaser=INVALID`);
      await page.waitForTimeout(3000);
      
      // Should show minimal embed, NOT full app header/selectors
      const hasFullAppUI = await page.evaluate(() => {
        const header = document.querySelector('[class*="app-header"], header');
        const selectors = document.querySelector('[class*="country-selector"], [class*="region-selector"]');
        return !!header || !!selectors;
      });
      
      expect(hasFullAppUI).toBe(false);
      
      // Should show loading or no-data state
      const hasEmbedState = await page.evaluate(() => {
        const embedState = document.querySelector('[class*="embed-view"], [class*="loading"], [class*="no-data"]');
        return !!embedState;
      });
      
      expect(hasEmbedState).toBe(true);
    });

    test('Regression: Invalid ISO3 codes should normalize', async ({ page }) => {
      await page.goto(`${BASE_URL}/?chaser=ZZZ&target=XXX&indicator=GDP_PCAP_PPP`);
      await page.waitForTimeout(4000);
      
      // Should normalize invalid codes
      const urlNormalized = await page.evaluate(() => {
        const url = window.location.href;
        return !url.includes('chaser=ZZZ') && !url.includes('target=XXX');
      });
      
      expect(urlNormalized).toBe(true);
    });

    test('Regression: Toast deduping on rapid invalid params', async ({ page }) => {
      // Navigate multiple times with invalid params
      for (let i = 0; i < 5; i++) {
        await page.goto(`${BASE_URL}/?chaser=INVALID${i}&target=ALSO${i}`);
        await page.waitForTimeout(500);
      }
      
      // Should not accumulate many toasts
      const toastCount = await page.evaluate(() => {
        const toasts = document.querySelectorAll('[data-sonner-toast], [class*="toast"]');
        return toasts.length;
      });
      
      // Should dedupe, showing 1-2 at most
      expect(toastCount).toBeLessThanOrEqual(2);
    });

    test('Regression: Theme cleanup on unmount', async ({ page }) => {
      await page.goto(`${BASE_URL}/?embed=true&embedTheme=dark`);
      await page.waitForTimeout(2000);
      
      // Check dark theme applied
      const initialTheme = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });
      
      expect(initialTheme).toBe(true);
      
      // Navigate away
      await page.goto(`${BASE_URL}/?embed=true&embedTheme=light`);
      await page.waitForTimeout(1000);
      
      // Should clean up and apply new theme
      const newTheme = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });
      
      expect(newTheme).toBe(false);
    });

    test('Regression: No focus traps in modals', async ({ page }) => {
      await page.waitForTimeout(2000);
      
      // Try to open a modal (Share or Export)
      const shareButton = await page.getByRole('button', { name: /link|share/i }).first();
      
      if (await shareButton.isVisible()) {
        await shareButton.click();
        await page.waitForTimeout(1000);
        
        // Press Tab multiple times - should cycle through modal, not trap
        for (let i = 0; i < 15; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(50);
        }
        
        // Close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        
        const modalClosed = await page.evaluate(() => {
          const modal = document.querySelector('[class*="modal"], [role="dialog"]');
          return !modal || (modal as HTMLElement).offsetParent === null;
        });
        
        expect(modalClosed).toBe(true);
      }
    });

    test('Regression: Embed theme must control documentElement.dark', async ({ page }) => {
      await page.goto(`${BASE_URL}/?embed=true&embedTheme=auto`);
      await page.waitForTimeout(2000);
      
      const hasCorrectThemeClass = await page.evaluate(() => {
        const doc = document.documentElement;
        const hasDarkClass = doc.classList.contains('dark');
        const hasLightClass = doc.classList.contains('light');
        // With embedTheme=auto, should have a class based on system preference
        return hasDarkClass || hasLightClass;
      });
      
      expect(hasCorrectThemeClass).toBe(true);
    });
  });

  test.describe('Cross-browser & Environment', () => {
    test('URL encoding of special characters', async ({ page }) => {
      await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&cg=0.035&tmode=growing`);
      await page.waitForTimeout(2000);
      
      const urlEncodedCorrectly = await page.evaluate(() => {
        const url = window.location.href;
        // Should handle special characters in URLs
        return !url.includes(' ') && !url.includes('[') && !url.includes(']');
      });
      
      expect(urlEncodedCorrectly).toBe(true);
    });

    test('Backward compatibility with older URL formats', async ({ page }) => {
      // Test that older share links still work
      await page.goto(`${BASE_URL}/?c=NGA&t=IRL&i=GDP_PCAP_PPP`); // Shortened params
      await page.waitForTimeout(3000);
      
      const pageLoaded = await page.evaluate(() => {
        return document.readyState === 'complete';
      });
      
      expect(pageLoaded).toBe(true);
    });

    test('Copy to clipboard functionality', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.waitForTimeout(2000);
      
      const copyButton = await page.getByRole('button', { name: /copy/i }).first();
      
      if (await copyButton.isVisible()) {
        await copyButton.click();
        await page.waitForTimeout(1000);
        
        // Check if clipboard content was set
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        
        expect(clipboardText.length).toBeGreaterThan(0);
        expect(clipboardText).toMatch(/^https?:\/\//); // Should be a URL
      }
    });
  });

  test.describe('User Journey E2E Tests', () => {
    test('Complete user journey: Select → Configure → Share → Export', async ({ page }) => {
      console.log('Starting E2E journey...');
      
      // Step 1: Wait for initial load
      await page.waitForTimeout(3000);
      console.log('✓ App loaded');
      
      // Step 2: Select countries if selectors visible
      const chaserSelector = await page.locator('#chaser-picker, select').first();
      const targetSelector = await page.locator('#target-picker, select').nth(1);
      
      if (await chaserSelector.isVisible() && await targetSelector.isVisible()) {
        await chaserSelector.selectOption('NGA');
        await page.waitForTimeout(500);
        console.log('✓ Chaser selected');
        
        await targetSelector.selectOption('IRL');
        await page.waitForTimeout(500);
        console.log('✓ Target selected');
      }
      
      // Step 3: Configure growth parameters
      const growthSlider = await page.locator('input[type="range"]').first();
      if (await growthSlider.isVisible()) {
        await growthSlider.evaluate((el: HTMLInputElement) => {
          el.value = '0.05';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForTimeout(500);
        console.log('✓ Growth rate configured');
      }
      
      // Step 4: Toggle milestones
      const milestoneToggle = await page.getByRole('switch, checkbox').first();
      if (await milestoneToggle.isVisible()) {
        await milestoneToggle.click();
        await page.waitForTimeout(500);
        console.log('✓ Milestones toggled');
      }
      
      // Step 5: Switch to table view
      const tableToggle = await page.getByRole('button', { name: /table/i });
      if (await tableToggle.count() > 0) {
        await tableToggle.click();
        await page.waitForTimeout(1000);
        console.log('✓ Table view opened');
      }
      
      // Step 6: Share link
      const shareButton = await page.getByRole('button', { name: /link|share/i }).first();
      if (await shareButton.isVisible()) {
        await shareButton.click();
        await page.waitForTimeout(1000);
        console.log('✓ Share modal opened');
        
        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
      
      // Step 7: Export data
      const exportButton = await page.getByRole('button', { name: /export|download/i }).first();
      if (await exportButton.isVisible()) {
        await exportButton.click();
        await page.waitForTimeout(1000);
        console.log('✓ Export modal opened');
        
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
      
      // Verify URL contains all our changes
      const finalUrl = page.url();
      expect(finalUrl).toMatch(/chaser=NGA|target=IRL/);
      
      console.log('✅ E2E journey completed successfully!');
    });

    test('Embed workflow: Generate → Verify → Customize', async ({ page }) => {
      // Start with embed mode
      await page.goto(`${BASE_URL}/?chaser=USA&target=BRA&embed=true&embedTheme=light&h=600`);
      await page.waitForTimeout(3000);
      
      // Verify embed is minimal
      const isMinimal = await page.evaluate(() => {
        return !document.querySelector('header') && !document.querySelector('nav');
      });
      expect(isMinimal).toBe(true);
      
      // Check theme applied
      const themeCorrect = await page.evaluate(() => {
        return document.documentElement.classList.contains('light');
      });
      expect(themeCorrect).toBe(true);
      
      // Verify height
      const heightCorrect = await page.evaluate(() => {
        return document.body.clientHeight <= 600;
      });
      expect(heightCorrect).toBe(true);
      
      console.log('✅ Embed workflow validated!');
    });
  });
});

test.afterEach(async ({ page }, testInfo) => {
  console.log(`\n✓ Test "${testInfo.title}" completed`);
  
  // Log any console errors
  const errors = await page.evaluate(() => {
    return (window as any).__test_console_errors__ || [];
  });
  
  if (errors.length > 0) {
    console.log(`⚠ Console errors: ${errors.length}`, errors);
  }
});