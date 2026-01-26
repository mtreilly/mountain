# Playwright QA Review (Headed) — Feature-by-Feature

Date: 2026-01-26  
App route tested: single-route UI + embed mode (`embed=true`)  
Test style: manual, headed Playwright click-through + keyboard/a11y checks

## What was exercised
- Mode switching: `Countries` vs `Regions`
- Selectors: chaser/target pickers, metric picker, swap actions
- URL param sync: selection changes, milestones toggle, view toggle (`chart/table`), embed params retention
- Growth controls: sliders, presets, target mode (`growing/static`)
- Projection: chart + table rendering, milestones overlay
- Share + exports:
  - Header actions: `Link`, `Card`, `Thread`
  - More options → export modal: `Observed CSV`, `Projection CSV`, `Report JSON`, `Embed code`
  - Citation panel: tabs, copy actions
- Embed mode:
  - Interactive embed (`embed=true`)
  - Static embed (`embed=true&interactive=false`)
  - `embedTheme` light/dark, fixed height (`h=...`)
- Keyboard + accessibility:
  - Tab order through selectors, dropdown search + selection
  - Modal open/close, Escape close behavior, focus restoration
  - Labeled form controls (sliders + horizon input)
- Dark mode / light mode visual sanity for key UI states (cards, table, modals, toasts)

## Things that worked reliably
- Selector dropdowns: search + keyboard navigation (Tab into results, Enter to select) and correct URL updates.
- Swap actions:
  - Regions swap updates URL params as expected.
  - Countries swap behaves correctly for chaser/target + growth rates.
- View / milestone toggles:
  - `ms=0` and `view=table` persist in URL.
  - Chart/table switching renders correctly in both themes.
- Share flows:
  - Link copying shows toasts.
  - Share Card modal generates images across theme + size options; downloads use consistent names.
  - Thread modal generates previews; copy actions show toasts; ZIP download works; Escape closes and focus returns sensibly.
- Export modal:
  - CSV/JSON downloads work and filenames align with selection state.
  - Embed code generation works and copy-to-clipboard feedback appears.
- Citation panel:
  - Opens from menu + keyboard shortcut; tab switching works; copy actions show toasts.

## Issues found (and what we changed)

### 1) Static embed incorrectly rendered the full app when data was invalid
**Symptom**: In `embed=true&interactive=false`, if the state had no valid data (e.g. invalid country codes), the app fell back to rendering the full UI (header/selectors/cards).  
**Impact**: Static embeds could unexpectedly show the full application surface, breaking expected “minimal chart-only embed” behavior.

**Fix**:
- `app/src/App.tsx`: embed now always renders `<EmbedView />` when `embed=true`, using a `loading/no-data/ready` status instead of gating on `hasData`.
- `app/src/components/EmbedView.tsx`: added a “non-ready” placeholder rendering path (still respects embed theme/body classes).

### 2) Invalid country ISO3 URL params were not normalized consistently
**Symptom**: Invalid `chaser`/`target` ISO3 codes could persist until other interactions occurred, and embed/static behavior didn’t consistently normalize.  
**Impact**: Broken deep-links; confusing blank/partial states; embed could show placeholders longer than needed.

**Fix**:
- `app/src/App.tsx`: normalize invalid ISO3s after countries list loads:
  - In normal/interactive contexts: show a toast and reset to defaults.
  - In static embed (`interactive=false`): reset silently (no toasts).

## Common failure patterns / risk areas (things to watch out for)
- **URL params + async data**: validation often needs to happen *after* lists load (countries/indicators). Without guards, it’s easy to:
  - briefly render “wrong” UI,
  - cause flicker/loops when the URL sync effect runs,
  - spam toasts on rerenders/navigation.
- **Embed vs full app behavior**:
  - Embed should be “minimal surface area”; gating on `hasData` is brittle.
  - Static embeds should not show toasts (no toast container) and should normalize quietly.
  - Embed theme handling must keep `documentElement.dark` in sync with `embedTheme` and remove cleanup on unmount.
- **Toast deduping**: invalid-param normalization benefits from stable “toast keys” (otherwise HMR/rerenders can duplicate messaging).
- **Keyboard UX regressions**:
  - Dropdowns: ensuring Enter selects and Escape closes without losing focus.
  - Modals: Escape close + focus restoration are easy to regress.
- **Theme regressions**:
  - Ensure muted text contrasts well in dark mode (especially “hint” lines, table captions, and modal secondary text).
 - **Dev-only noise vs real regressions**:
  - React “hook order changed” warnings can appear during hot reload; confirm with a clean `pnpm -C app build` before treating as a production issue.

## Regular checks recommended (quick manual smoke suite)
Run these checks after any change touching routing, selectors, modals, embed, or theme:

1) **URL correctness**
   - Change chaser/target/metric; confirm URL updates and restores state on reload.
   - Toggle milestones and chart/table; confirm URL reflects.
2) **Invalid URL handling**
   - Invalid `indicator`, `chaser`, `target`, and (regions mode) `cr/tr`:
     - normal mode: toast + reset
     - static embed: silent reset + minimal UI
3) **Keyboard and focus**
   - Tab through selectors; open a dropdown; select via keyboard; confirm focus stays predictable.
   - Open/close `Card` and `Thread` modals with Escape; confirm focus returns to the triggering button.
4) **Exports**
   - Download observed/projection/report; spot-check non-empty output.
   - Copy embed code; ensure it includes `embed=true` and preserves embed params.
5) **Theme**
   - Toggle light/dark; verify legibility of:
     - left column cards, right sidebar cards, table rows, modal text, toasts.
   - In embed, verify `embedTheme=dark/light/auto` changes rendering as expected.

## Suggested automation follow-ups (optional)
- Add a small Playwright smoke spec to cover:
  - URL param normalization (indicator + country + regions codes)
  - embed static minimal rendering (no header/selectors)
  - modal open/close + Escape + focus restore
  - export download endpoints returning non-empty files
