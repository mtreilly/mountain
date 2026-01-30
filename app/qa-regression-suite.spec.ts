import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8788';

/**
 * Comprehensive Regression Test Suite
 * Tests specifically for issues documented in QA-PLAYWRIGHT-REVIEW.md
 */

test.describe('Regression Test Suite - QA-PLAYWRIGHT-REVIEW.md', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Regression: Static embed incorrectly rendered the full app', () => {
    test('Static embed with invalid data shows minimal UI, not full app', async ({ page }) => {
      // Issue: Static embed was falling back to full app UI when data was invalid
      await page.goto(`${BASE_URL}/?embed=true&interactive=false&chaser=INVALID&target=CODES`);
      await page.waitForTimeout(3000);
      
      // Should ALWAYS show EmbedView, never full app
      const hasFullApp = await page.evaluate(() => {
        const header = document.querySelector('header, [class*="app-header"]');
        const countrySelector = document.querySelector('[class*="country-selector"]');
        const navigation = document.querySelector('nav');
        return !!(header || countrySelector || navigation);
      });
      
      expect(hasFullApp).toBe(false);
      
      // Should show minimal embed surface (loading/no-data/ready)
      const hasEmbedSurface = await page.evaluate(() => {
        const embedContent = document.querySelector('[class*="embed-view"], [class*="minimal"]');
        const statePlaceholder = document.querySelector('[class*="loading"], [class*="no-data"]');
        return !!(embedContent || statePlaceholder);
      });
      
      expect(hasEmbedSurface).toBe(true);
      
      // Should NOT have toast container in static embed
      const hasToastContainer = await page.evaluate(() => {
        const toasts = document.querySelectorAll('[class*="toast"], [class*="sonner"]');
        return toasts.length > 0;
      });
      
      // Static embed should be silent (no toasts)
      expect(hasToastContainer).toBe(false);
    });

    test('Static embed with valid data also shows minimal UI', async ({ page }) => {
      await page.goto(`${BASE_URL}/?embed=true&interactive=false&chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
      await page.waitForTimeout(4000);
      
      const hasFullApp = await page.evaluate(() => {
        const header = document.querySelector('header, [class*="app-header"]');
        const countrySelector = document.querySelector('[class*="country-selector"]');
        return !!(header || countrySelector);
      });
      
      expect(hasFullApp).toBe(false);
    });

    test('EmbedView has loading state before data loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/?embed=true&chaser=NGA&target=IRL`);
      
      // Immediately check (before data loads)
      await page.waitForTimeout(500);
      
      const hasLoadingState = await page.evaluate(() => {
        const loading = document.querySelector('[class*="loading"], [class*="spinner"]');
        const embedView = document.querySelector('[class*="embed-view"]');
        return !!loading || !!embedView;
      });
      
      expect(hasLoadingState).toBe(true);
    });

    test('EmbedView shows no-data state when selection invalid', async ({ page }) => {
      await page.goto(`${BASE_URL}/?embed=true&chaser=ZZZ&target=YYY&interactive=false`);
      await page.waitForTimeout(4000);
      
      const hasNoDataState = await page.evaluate(() => {
        const noData = document.querySelector('[class*="no-data"], [class*="empty"]');
        const embedView = document.querySelector('[class*="embed-view"]');
        return !!noData || !!embedView;
      });
      
      expect(hasNoDataState).toBe(true);
    });
  });

  test.describe('Regression: Invalid country ISO3 URL params normalization', () => {
    test('Invalid chaser code normalized with toast in normal mode', async ({ page }) => {
      await page.goto(`${BASE_URL}/?chaser=INVALID&target=IRL&indicator=GDP_PCAP_PPP`);
      await page.waitForTimeout(4000);
      
      // Should show toast notification
      const toastAppeared = await page.evaluate(() => {
        const toasts = document.querySelectorAll('[data-sonner-toast], [class*="toast"]');
        return toasts.length > 0;
      });
      
      expect(toastAppeared).toBe(true);
      
      // URL should be normalized (invalid chaser removed or reset)
      const url = page.url();
      const hasInvalidChaser = url.includes('chaser=INVALID');
      expect(hasInvalidChaser).toBe(false);
    });

    test('Invalid target code normalized with toast in normal mode', async ({ page }) => {
      await page.goto(`${BASE_URL}/?chaser=NGA&target=INVALID&indicator=GDP_PCAP_PPP`);
      await page.waitForTimeout(4000);
      
      const toastAppeared = await page.evaluate(() => {
        const toasts = document.querySelectorAll('[class*="toast"], [class*="sonner"]');
        return toasts.length > 0;
      });
      
      expect(toastAppeared).toBe(true);
      
      const url = page.url();
      const hasInvalidTarget = url.includes('target=INVALID');
      expect(hasInvalidTarget).toBe(false);
    });

    test('Both invalid codes normalized with toast', async ({ page }) => {
      await page.goto(`${BASE_URL}/?chaser=ZZZ&target=YYY&indicator=GDP_PCAP_PPP`);
      await page.waitForTimeout(4000);
      
      const urlNormalized = await page.evaluate(() => {
        const url = window.location.href;
        return !url.includes('ZZZ') && !url.includes('YYY') && !url.includes('chaser=ZZZ');
      });
      
      expect(urlNormalized).toBe(true);
    });

    test('Invalid params normalized SILENTLY in static embed mode', async ({ page }) => {
      await page.goto(`${BASE_URL}/?embed=true&interactive=false&chaser=INVALID&target=CODES`);
      await page.waitForTimeout(4000);
      
      // Should NOT show toast
      const toastAppeared = await page.evaluate(() => {
        const toasts = document.querySelectorAll('[class*="toast"], [class*="sonner"]');
        return toasts.length > 0;
      });
      
      expect(toastAppeared).toBe(false);
      
      // But URL should still normalize
      const url = page.url();
      const hasInvalidParams = url.includes('chaser=INVALID') || url.includes('target=CODES');
      expect(hasInvalidParams).toBe(false);
    });

    test('Invalid indicator also normalized', async ({ page }) => {
      await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=FAKE_INDICATOR`);
      await page.waitForTimeout(4000);
      
      const urlNormalized = await page.evaluate(() => {
        const url = window.location.href;
        return !url.includes('FAKE_INDICATOR');
      });
      
      expect(urlNormalized).toBe(true);
    });

    test('Invalid region codes normalized in regions mode', async ({ page }) => {
      await page.goto(`${BASE_URL}/?mode=regions&cr=INVALID_REGION&tr=ANOTHER_FAKE`);
      await page.waitForTimeout(4000);
      
      const urlNormalized = await page.evaluate(() => {
        const url = window.location.href;
        return !url.includes('cr=INVALID_REGION') && !url.includes('tr=ANOTHER_FAKE');
      });
      
      expect(urlNormalized).toBe(true);
    });
  });

  test.describe('Regression: Toast deduping on rerenders', () => {
    test('Multiple rapid navigations with invalid params show max 1-2 toasts', async ({ page }) => {
      const invalidUrls = [
        `${BASE_URL}/?chaser=INV1&target=CODES1`,
        `${BASE_URL}/?chaser=INV2&target=CODES2`,
        `${BASE_URL}/?chaser=INV3&target=CODES3`,
        `${BASE_URL}/?chaser=INV4&target=CODES4`,
      ];
      
      for (const url of invalidUrls) {
        await page.goto(url);
        await page.waitForTimeout(300);
      }
      
      // Wait for normalization
      await page.waitForTimeout(2000);
      
      // Should only show 1-2 toasts total, not 4
      const toastCount = await page.evaluate(() => {
        const toasts = document.querySelectorAll('[data-sonner-toast], [class*="toast"]');
        return toasts.length;
      });
      
      expect(toastCount).toBeLessThanOrEqual(2);
    });

    test('Same error message deduped', async ({ page }) => {
      // Navigate to same invalid state twice
      await page.goto(`${BASE_URL}/?chaser=INVALID&target=IRL`);
      await page.waitForTimeout(2000);
      
      await page.goto(`${BASE_URL}/?chaser=INVALID&target=IRL`);
      await page.waitForTimeout(2000);
      
      // Should not show duplicate toasts for same error
      const messages = await page.evaluate(() => {
        const toasts = Array.from(document.querySelectorAll('[data-sonner-toast], [class*="toast"]'));
        return toasts.map(t => t.textContent).filter(Boolean);
      });
      
      // Each unique message should appear only once
      const uniqueMessages = new Set(messages);
      expect(messages.length).toBe(uniqueMessages.size);
    });
  });

  test.describe('Regression: Keyboard UX - No focus traps', () => {
    test('Modal focus cycles correctly without trap', async ({ page }) => {
      await page.waitForTimeout(2000);
      
      // Open a modal
      const shareButton = await page.getByRole('button', { name: /link|share/i }).first();
      
      if (await shareButton.isVisible()) {
        await shareButton.click();
        await page.waitForTimeout(1000);
        
        // Get initial focused element
        const initialFocus = await page.evaluate(() => document.activeElement?.tagName);
        
        // Tab through all focusable elements multiple times
        for (let i = 0; i < 20; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(50);
        }
        
        // Should still be able to tab to close button and press Escape
        let trapped = false;
        try {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          
          // Check if modal closed
          const modalClosed = await page.evaluate(() => {
            const modal = document.querySelector('[class*="modal"], [role="dialog"]');
            return !modal || (modal as HTMLElement).style.display === 'none' || (modal as HTMLElement).offsetParent === null;
          });
          
          expect(modalClosed).toBe(true);
        } catch {
          trapped = true;
        }
        
        expect(trapped).toBe(false);
      }
    });

    test('Dropdown search + Enter + Escape works', async ({ page }) => {
      await page.waitForTimeout(2000);
      
      const selector = await page.locator('select, [role="combobox"]').first();
      
      if (await selector.isVisible()) {
        // Tab to selector
        await selector.focus();
        await page.waitForTimeout(200);
        
        // Open dropdown (Space or Enter)
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
        
        // Type to search
        await page.keyboard.type('uni');
        await page.waitForTimeout(300);
        
        // Press Enter to select first result
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        // Verify selection was made
        const selectionMade = await page.evaluate(() => {
          const selects = Array.from(document.querySelectorAll('select'));
          return selects.some(s => (s as HTMLSelectElement).value !== '');
        });
        
        expect(selectionMade).toBe(true);
      }
    });
  });

  test.describe('Regression: Theme contrast and cleanup', () => {
    test('Dark mode has proper contrast', async ({ page }) => {
      await page.goto(`${BASE_URL}/?embedTheme=dark`);
      await page.waitForTimeout(3000);
      
      // Check if text is readable
      const contrastOk = await page.evaluate(() => {
        const elements = document.querySelectorAll('p, span, div, h1, h2, h3, td, th');
        for (const el of elements) {
          const style = window.getComputedStyle(el as Element);
          const color = style.color;
          const bgColor = style.backgroundColor;
          // In dark mode, text should be light on dark background
          if (color && bgColor && !color.includes('rgba(0, 0, 0, 0)')) {
            const isLightText = color.includes('255') || parseInt(color.split(',')[1]) > 200;
            const isDarkBg = bgColor.includes('0') || (!bgColor.includes('255') && parseInt(bgColor.split(',')[1]) < 100);
            if (!isLightText && !isDarkBg) return false;
          }
        }
        return true;
      });
      
      expect(contrastOk).toBe(true);
    });

    test('Theme cleanup on mode switch', async ({ page }) => {
      await page.goto(`${BASE_URL}/?embedTheme=dark`);
      await page.waitForTimeout(2000);
      
      // Verify dark theme applied
      const hasDarkClass = await page.evaluate(() => 
        document.documentElement.classList.contains('dark')
      );
      expect(hasDarkClass).toBe(true);
      
      // Switch theme
      await page.goto(`${BASE_URL}/?embedTheme=light`);
      await page.waitForTimeout(2000);
      
      // Verify dark class was removed
      const stillHasDarkClass = await page.evaluate(() => 
        document.documentElement.classList.contains('dark')
      );
      expect(stillHasDarkClass).toBe(false);
      
      // Verify light class applied
      const hasLightClass = await page.evaluate(() => 
        document.documentElement.classList.contains('light')
      );
      expect(hasLightClass).toBe(true);
    });
  });

  test.describe('Export guardrails - Non-empty downloads', () => {
    test('Observed CSV export is non-empty', async ({ page }) => {
      await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
      await page.waitForTimeout(3000);
      
      const exportButton = await page.getByRole('button', { name: /export|more/i }).first();
      
      if (await exportButton.isVisible()) {
        await exportButton.click();
        await page.waitForTimeout(500);
        
        const observedCsvButton = await page.getByRole('button', { name: /observed.*csv/i });
        
        if (await observedCsvButton.count() > 0) {
          const [download] = await Promise.all([
            page.waitForEvent('download'),
            observedCsvButton.click(),
          ]);
          
          // Save to temp location and check size
          const path = await download.path();
          const fs = require('fs');
          if (path && fs.existsSync(path)) {
            const stats = fs.statSync(path);
            expect(stats.size).toBeGreaterThan(100); // At least 100 bytes
          }
        }
      }
    });

    test('Export filenames encode selection state', async ({ page }) => {
      await page.goto(`${BASE_URL}/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP`);
      await page.waitForTimeout(3000);
      
      const exportButton = await page.getByRole('button', { name: /export|more/i }).first();
      
      if (await exportButton.isVisible()) {
        await exportButton.click();
        await page.waitForTimeout(500);
        
        const downloadButton = await page.getByRole('button', { name: /csv|json|report/i }).first();
        
        if (await downloadButton.count() > 0) {
          const [download] = await Promise.all([
            page.waitForEvent('download'),
            downloadButton.click(),
          ]);
          
          const filename = download.suggestedFilename();
          
          // Filename should contain meaningful info (not just "data.csv")
          const hasMeaningfulName = filename.includes('NGA') || 
                                   filename.includes('IRL') || 
                                   filename.includes('GDP') ||
                                   filename.length > 15;
          
          expect(hasMeaningfulName).toBe(true);
        }
      }
    });
  });
});

test.afterEach(async ({ page }, testInfo) => {
  console.log(`\n✅ Regression test "${testInfo.title}" completed`);
  
  // Check for errors
  const errors = await page.evaluate(() => {
    return (window as any).__test_console_errors__ || [];
  });
  
  if (errors.length > 0) {
    console.log(`⚠ Console errors:`, errors);
  }
});