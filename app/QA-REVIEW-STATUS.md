# Playwright QA Review - Active Status

**Date:** 2026-01-27  
**App URL:** http://localhost:8788  
**Test Suite:** qa-manual-review.spec.ts  
**Mode:** Headed Browser (Interactive)  
**Status:** 🟢 RUNNING

## Current Test Execution

The Playwright headed browser is currently running through 14 comprehensive test scenarios based on **QA-PLAYWRIGHT-REVIEW.md**. The browser window should be visible on your screen.

### Active Processes
- **App Server:** Running (Wrangler on localhost:8788)
- **Playwright Test Runner:** Active (PID: 41024, 41355)
- **Chrome for Testing:** 28+ processes running
- **Test Worker:** Single worker executing tests sequentially

## Test Coverage in Progress

### ✅ Core Functionality
1. **Mode Switching** - Countries vs Regions toggle
2. **Selectors** - Chaser/target pickers, metric picker, swap actions
3. **URL Sync** - Parameter synchronization, milestones, view toggle
4. **Growth Controls** - Sliders, presets, target mode (growing/static)
5. **Projection** - Chart/table rendering, milestones overlay

### ✅ Share & Export Flows
6. **Share Actions** - Link, Card, Thread modals
7. **Export Modal** - Observed CSV, Projection CSV, Report JSON, Embed code
8. **Citation Panel** - Tabs, copy actions, keyboard shortcut (Ctrl+Shift+C)

### ✅ Embed Mode Testing
9. **Interactive Embed** - `?embed=true`
10. **Static Embed** - `?embed=true&interactive=false`
11. **Embed Theme** - Dark/light/auto themes with height parameters

### ✅ UX & Accessibility
12. **Keyboard Navigation** - Tab order, dropdown search, Enter select, Escape close
13. **Focus Management** - Modal open/close, focus restoration
14. **Theme Testing** - Dark/light mode visual sanity checks

### ✅ Edge Cases
15. **Invalid Parameters** - Toast notifications and silent resets
16. **Downloads** - Non-empty export files with proper filenames
17. **URL Normalization** - Validation after async data loads

## What to Expect

### In the Headed Browser Window:
- Each test pauses at key interaction points (`await page.pause()`)
- You can manually interact with the UI during pauses
- Console logs show real-time test progress
- Tests validate URL params, UI state, and export functionality

### Key Test Scenarios Being Validated:

**URL Parameter Handling:**
- Selections update URL correctly
- Milestones toggle (`ms=0`) persists
- View toggle (`view=table`) works
- Invalid ISO3 codes trigger toasts + reset (normal mode)
- Invalid params silently reset in static embed mode

**Embed Mode Guardrails:**
- Static embed never shows full app UI (always minimal)
- Loading/no-data placeholders render correctly
- `embedTheme` controls document CSS classes

**Keyboard + Accessibility:**
- All interactive controls reachable by Tab
- Dropdowns: keyboard search + Enter + Escape work
- Modals: Escape closes, focus returns to trigger

**Export Guardrails:**
- Downloads are non-empty
- Filenames encode selection state
- Copy actions show toast feedback (non-static contexts)

## Verification Checklist

As tests run, the following are automatically verified:

- [x] App loads on localhost:8788
- [x] Selectors are visible and interactive
- [x] URL parameters sync with UI state
- [x] Chart/table rendering works
- [x] Share/export buttons are accessible
- [ ] Modal open/close behavior works
- [ ] Keyboard navigation is functional
- [ ] Theme switching works correctly
- [ ] Invalid params are normalized
- [ ] Embed modes render minimal UI
- [ ] Downloads trigger correctly
- [ ] Focus management works (no focus traps)

## Next Steps

1. **Monitor Progress:** Watch the headed browser window
2. **Manual Interaction:** When tests pause, manually verify features
3. **Check Logs:** Console output shows detailed test progress
4. **Interrupt if Needed:** Press Ctrl+C to stop tests
5. **Review Results:** Tests will exit with status codes

## Known Working Features (from QA-PLAYWRIGHT-REVIEW.md)

Based on previous test runs, these features are known to work:
- Selector dropdowns with keyboard navigation
- Swap actions (Regions and Countries)
- View/milestone toggles
- Share flows (Link, Card, Thread)
- Export modal (CSV/JSON/Embed)
- Citation panel and copy actions
- Embed theme parameter handling

## Issues to Watch For

The tests specifically check for regressions in:
- Static embed showing full app UI (Issue #1 - FIXED)
- Invalid country codes not normalizing (Issue #2 - FIXED)
- Toast deduping on rerenders
- Keyboard UX regressions (dropdowns, modals)
- Theme contrast issues in dark mode

---

**Note:** This is a manual click-through review using headed Playwright. Tests pause at key points for visual verification. All scenarios from QA-PLAYWRIGHT-REVIEW.md are being exercised.
