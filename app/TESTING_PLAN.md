# Testing Plan — Convergence Explorer

## Current State

| Category | Files | Tested | Coverage |
|----------|-------|--------|----------|
| Lib modules (`src/lib/`) | 23 | 19 | ~83% |
| React components (`src/components/`) | 40+ | 0 | 0% |
| Custom hooks (`src/hooks/`) | 8 | 0 | 0% |
| E2E user flows | — | 0 | 0% |

**What exists today:**
- 20 unit tests in `scripts/test.ts` (fixed input/output, `node:assert`)
- 42 property-based tests in `scripts/property.test.ts` (fast-check, invariants)
- Custom TAP-like runner via `tsx`, no external test framework
- Pre-push hook runs: `lint:biome → typecheck → test`

**Untested lib modules:** `chartExport.ts`, `clipboard.ts`, `download.ts`, `fetchDownload.ts`

## Progress Log

- **2026-02-11:** Phase 4 expansion completed for additional E2E flows:
  - Added region comparison flow coverage (`e2e/region-comparison.spec.ts`).
  - Added export/share coverage for CSV, JSON, share link copy, and share card PNG download (`e2e/export.spec.ts`).
  - Added implications flow coverage and stabilized scenario/template interactions for full-suite reliability (`e2e/implications.spec.ts`).
  - Added responsive layout assertions by viewport project (`e2e/responsive-layout.spec.ts`).
  - Added keyboard navigation coverage (tab order, modal keyboard controls, slider arrow-key behavior) (`e2e/keyboard-navigation.spec.ts`).
  - Added accessibility and visual checks in E2E suite (`e2e/accessibility.spec.ts`, `e2e/visual-regression.spec.ts`).
  - Full E2E suite status after these updates: **59 passed, 10 skipped**.

---

## Testing Philosophy

1. **Pure logic first** — the lib layer is where bugs cause the most damage (wrong projections, bad exports, broken share links). Maximize coverage here before touching UI.
2. **Property-based over example-based** — for math/serialization, proving invariants hold across random inputs is far more valuable than a handful of hardcoded cases.
3. **Minimal framework churn** — keep the existing `tsx` + `node:assert` + `fast-check` runner for lib tests. Only introduce Vitest/Playwright when testing things that genuinely need a DOM or browser.
4. **Test the contract, not the implementation** — assert *what* a function returns, not *how* it computes it. This keeps tests stable through refactors.
5. **Each phase should be independently shippable** — every phase adds value on its own.

---

## Phase 1: Complete Lib Coverage

**Goal:** 100% of `src/lib/` modules covered.
**Framework:** Existing `tsx` + `node:assert` + `fast-check` runner.
**Effort:** Small — follows established patterns.

### 1.1 `chartExport.ts`

This module converts SVGs to PNGs via `@resvg/resvg-wasm` and copies to clipboard. Testing the full pipeline requires WASM, but the logic around it can be tested.

| Test | Type | What to assert |
|------|------|----------------|
| SVG string construction | Unit | Valid SVG output for given dimensions/theme |
| Export filename generation | Unit | Correct naming pattern with country codes and date |
| Error handling for invalid SVG | Unit | Graceful failure, no unhandled rejections |

### 1.2 `clipboard.ts` / `download.ts` / `fetchDownload.ts`

These are thin browser-API wrappers. Not worth unit testing directly — they'll be covered by E2E tests in Phase 4. Skip for now.

### 1.3 Strengthen existing property tests

| Module | New property tests |
|--------|-------------------|
| `convergence.ts` | Commutativity: swapping chaser/target with inverted rates gives same convergence year. Monotonicity: higher growth differential → fewer years. |
| `implicationsMath.ts` | `computeTotals` output values are always non-negative. `projectValue` with rate=0 returns base value for all years. |
| `shareState.ts` | Fuzz with unicode, emoji, and URL-unsafe characters — roundtrip must not corrupt. |
| `templatePaths.ts` | `estimateFromTemplate` output is always within clamped bounds. |
| `sensitivityAnalysis.ts` | Sensitivity scenarios are always sorted by convergence year. Rate perturbations are symmetric around base case. |
| `headlineGenerator.ts` | Output never contains raw HTML or unescaped `<>` characters. |
| `oecdRegions.ts` | All region codes in dataset resolve to valid region metadata. |
| `citations.ts` | BibTeX output is valid (balanced braces, no unescaped special chars). |

---

## Phase 2: Snapshot Tests for Generated Outputs

**Goal:** Catch unintended regressions in SVG cards, CSV exports, and citation formatting.
**Framework:** Existing runner + file-based snapshots.
**Effort:** Small-medium.

### How it works

1. Generate output (SVG string, CSV string, JSON blob) from a fixed input.
2. First run: write to `scripts/__snapshots__/{name}.snap`.
3. Subsequent runs: compare output to snapshot, fail if different.
4. Update snapshots intentionally with an `--update` flag.

### What to snapshot

| Output | Input fixture | Snapshot file |
|--------|---------------|---------------|
| Share card SVG (Twitter size) | NGA→USA, GDP per capita, 3% vs 1% | `shareCard-twitter.svg.snap` |
| Share card SVG (LinkedIn size) | Same | `shareCard-linkedin.svg.snap` |
| Historical card SVG | NGA→USA, 2000-2023 data | `historicalCard.svg.snap` |
| Implications card SVG | NGA, electricity demand | `implicationsCard.svg.snap` |
| Sensitivity card SVG | NGA→USA, ±1% perturbation | `sensitivityCard.svg.snap` |
| CSV export (observed) | 10 data points | `export-observed.csv.snap` |
| CSV export (projected) | 20-year projection | `export-projected.csv.snap` |
| JSON report | Full convergence result | `export-report.json.snap` |
| Citation (BibTeX) | Fixed context | `citation-bibtex.snap` |
| Citation (APA) | Fixed context | `citation-apa.snap` |
| Thread captions | 4-card thread | `thread-captions.snap` |

### Implementation

Add a small `assertSnapshot(name, content)` helper to the test runner:

```typescript
function assertSnapshot(name: string, content: string) {
  const dir = path.join(__dirname, "__snapshots__");
  const file = path.join(dir, `${name}.snap`);
  if (process.argv.includes("--update") || !fs.existsSync(file)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, content);
    return;
  }
  const existing = fs.readFileSync(file, "utf-8");
  assert.equal(content, existing, `Snapshot mismatch: ${name}`);
}
```

---

## Phase 3: Hook & Component Tests

**Goal:** Test React hooks in isolation and critical interactive components.
**Framework:** Vitest + React Testing Library + jsdom.
**Effort:** Medium — requires adding Vitest to the project.

### 3.0 Framework Setup

```bash
pnpm add -D vitest @testing-library/react @testing-library/user-event jsdom @testing-library/jest-dom
```

Add `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

Add script: `"test:components": "vitest run"`

### 3.1 Hook Tests

Hooks that do pure computation (no API calls) are easy to test with `renderHook`.

| Hook | Tests |
|------|-------|
| `useConvergence` | Returns correct years/projection for known inputs. Returns null when chaser > target with positive rates. Handles edge cases (identical values, zero rates). |
| `useRegionalConvergence` | Same invariants as useConvergence but with region data. |
| `useTheme` | Toggles between light/dark. Persists to localStorage. Applies correct class to document. |
| `useResizeObserver` | Returns initial dimensions. Updates on resize. Cleans up observer on unmount. |

Hooks that fetch data (`useCountries`, `useIndicators`, `useCountryData`, `useBatchData`) should be tested with mocked `fetch`:

| Hook | Tests |
|------|-------|
| `useCountries` | Returns country list on success. Sets loading state. Handles network error. |
| `useIndicators` | Returns indicator list. Handles empty response. |
| `useCountryData` | Fetches correct endpoint for indicator. Respects `enabled` flag. Handles 404. |
| `useBatchData` | Batches multiple country requests. Handles partial failures. |

### 3.2 Component Tests

Focus on **interactive components** — presentational components are better covered by E2E and visual regression.

#### Critical interactive components

**CountryPickerModal**
- Renders list of countries grouped by income/region
- Search filters countries correctly
- Selecting a country calls `onSelect` and closes modal
- Keyboard navigation works (arrow keys, enter, escape)
- Group buttons (EU, G7, G20, BRICS) filter correctly

**MetricSelector**
- Renders categorized indicator list
- Search narrows results
- Selecting an indicator updates the value
- Keyboard navigation through categories

**GrowthRateSlider**
- Dragging updates value within bounds (-5% to 12%)
- Preset buttons (Stagnant, Slow, Moderate, Fast, Rapid) set correct values
- Displays formatted percentage

**ExportModal**
- CSV download triggers with correct content
- JSON export includes all required fields
- Base year selector works
- Citation link opens citation panel

**ShareCardModal**
- Size selector toggles between Twitter/LinkedIn/Square
- Theme selector works
- Download button triggers PNG generation
- Copy button triggers clipboard write

**EmbedCodeGenerator**
- Generated iframe code contains correct URL parameters
- Copy button works
- Preview updates when parameters change

#### Presentational components (lower priority)

**ResultSummary** — renders correct text for convergence/divergence/never cases
**ProjectionTable** — renders correct rows for projection data
**CountryContextCard** — shows adjustment explanation

---

## Phase 4: End-to-End Tests

**Goal:** Verify complete user flows in a real browser.
**Framework:** Playwright.
**Effort:** Medium-large.

### 4.0 Setup

```bash
pnpm add -D @playwright/test
npx playwright install chromium
```

Add `playwright.config.ts`:
```typescript
export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: {
    command: "pnpm dev",
    port: 5173,
    reuseExistingServer: true,
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 375, height: 812 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
```

Add script: `"test:e2e": "playwright test"`

### 4.1 Smoke Tests

Run these on every push — they should complete in <30 seconds.

| Test | Steps | Assertions |
|------|-------|------------|
| App loads | Navigate to `/` | No console errors. Header, selectors, chart visible. |
| Embed loads | Navigate to `/?embed=1&...` | Chart renders. No header/footer. |
| Share link loads | Navigate to full share URL | Correct countries, metric, rates pre-filled. |
| 404/invalid params | Navigate with garbage params | App loads with defaults, shows toast warnings. |

### 4.2 Country Comparison Flow

| Test | Steps | Assertions |
|------|-------|------------|
| Select countries | Open picker → search "Nigeria" → select → repeat for USA | Both countries shown in selectors. Chart renders with two lines. |
| Change metric | Open metric selector → pick "Life expectancy" | Chart updates. Y-axis label changes. |
| Adjust growth rates | Drag chaser slider to 5% | Convergence year decreases. Result summary updates. |
| Use presets | Click "Rapid" preset for chaser | Slider moves to preset value. Projection updates. |
| Toggle chart/table | Click table view toggle | Table renders with year/value columns. Data matches chart. |
| View milestones | Toggle milestones on | 25%/50%/75% markers appear on chart. |

### 4.3 Region Comparison Flow

| Test | Steps | Assertions |
|------|-------|------------|
| Switch to regions mode | Click "Regions" toggle | Region selectors appear. Metric locked to GDP per capita. |
| Select regions | Pick two OECD TL2 regions | Chart renders with region data. |

### 4.4 Export Flow

| Test | Steps | Assertions |
|------|-------|------------|
| CSV export | Open export modal → click CSV | Downloaded file is valid CSV with correct headers and data. |
| JSON export | Open export modal → click JSON | Downloaded file is valid JSON matching schema. |
| Share link copy | Click share → copy link | Clipboard contains URL with correct parameters. |
| Share card download | Open share card modal → select Twitter → download | PNG file downloaded, dimensions match Twitter card size. |

### 4.5 Implications Flow

| Test | Steps | Assertions |
|------|-------|------------|
| Open implications | Select GDP per capita → click Implications | Side panel opens with electricity, urbanization, CO2, GDP tabs. |
| Change scenario | Switch scenario dropdown | Values update. No NaN or missing values in any card. |
| Change template | Switch template country | Electricity mix changes. Tech equivalents update. |

### 4.6 Responsive Layout

| Test | Viewport | Assertions |
|------|----------|------------|
| Mobile layout | 375px | Selectors stack vertically. Chart fills width. Sidebar collapses. |
| Tablet layout | 768px | Two-column layout. Modals don't overflow. |
| Desktop layout | 1440px | Full layout with sidebar. All panels visible. |

---

## Phase 5: Accessibility Tests

**Goal:** Automated WCAG AA compliance checks.
**Framework:** `@axe-core/playwright` (integrated into Phase 4 E2E tests).
**Effort:** Small — piggybacks on existing Playwright setup.

### Setup

```bash
pnpm add -D @axe-core/playwright
```

### Tests

Run axe on every major page state:

| State | What to check |
|-------|---------------|
| Initial load | Full page scan — color contrast, ARIA roles, landmarks. |
| Country picker open | Modal has correct ARIA attributes. Focus trapped. Escape closes. |
| Export modal open | Form labels present. Buttons have accessible names. |
| Implications panel open | Tab panel has correct roles. Cards have headings. |
| Dark mode | Contrast ratios still pass in dark theme. |
| Embed mode | Reduced UI still has accessible chart and labels. |

### Keyboard navigation tests

| Flow | Steps | Assertions |
|------|-------|------------|
| Tab through controls | Tab from header through all interactive elements | Visible focus ring on each. Logical tab order. |
| Modal keyboard | Open modal → tab through → escape | Focus trapped in modal. Escape returns focus to trigger. |
| Slider keyboard | Focus slider → arrow keys | Value changes in correct increments. |

---

## Phase 6: Visual Regression Tests

**Goal:** Catch unintended visual changes to charts, cards, and layouts.
**Framework:** Playwright screenshots + pixel comparison.
**Effort:** Medium.

### How it works

1. Playwright navigates to a page state.
2. Takes a screenshot of a specific element or full page.
3. Compares against a baseline image stored in `e2e/__screenshots__/`.
4. Fails if pixel diff exceeds threshold (0.1%).
5. Update baselines with `--update-snapshots`.

### What to capture

| Screenshot | Element | Variants |
|------------|---------|----------|
| Convergence chart | `.convergence-chart` | Light, dark, with milestones, without |
| Result summary | `.result-summary` | Convergence, divergence, never-converges |
| Growth rate controls | `.growth-controls` | Default, dragged, preset selected |
| Share card preview | `.share-card-preview` | Twitter, LinkedIn, Square × light/dark |
| Implications panel | `.implications-panel` | Electricity tab, CO2 tab |
| Mobile layout | Full page | 375px viewport |
| Embed view | Full page | Minimal chrome |

### Considerations

- Pin test data (use a fixed share URL with known countries/rates) so screenshots are deterministic.
- Exclude dynamic elements (timestamps, animation frames) from comparison regions.
- Store baselines in git (they're small PNGs) for team review.

---

## Phase 7: Performance & Benchmark Tests

**Goal:** Ensure core calculations stay fast as complexity grows.
**Framework:** Existing runner + `performance.now()` (or Vitest `bench` if adopted).
**Effort:** Small.

### Benchmarks

| Function | Input | Budget |
|----------|-------|--------|
| `generateProjection` | 100-year horizon, yearly intervals | <5ms |
| `parseShareStateFromSearch` | Full URL with all params | <1ms |
| `toSearchString` | Full ShareState object | <1ms |
| `formatCsv` (observed) | 50 years of data | <2ms |
| `formatCsv` (projected) | 100-year projection | <3ms |
| `generateShareCardSvg` | Full card with all elements | <50ms |
| `generateThread` | 4-card thread | <100ms |
| `computeTotals` | GDP implications for large country | <5ms |
| OECD region lookup | All regions | <1ms |

### Implementation

```typescript
function bench(name: string, fn: () => void, budget: number, iterations = 100) {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
  assert.ok(median < budget, `${name}: ${median.toFixed(2)}ms exceeds ${budget}ms budget`);
  process.stdout.write(`ok - bench ${name}: ${median.toFixed(2)}ms (budget: ${budget}ms)\n`);
}
```

---

## Phase 8: Mutation Testing

**Goal:** Measure test *quality* — do our tests actually catch bugs?
**Framework:** Stryker Mutator.
**Effort:** Medium (setup + initial run is slow).

### What it does

1. Automatically mutates source code (flip `>` to `<`, change `+` to `-`, remove return statements).
2. Runs tests against each mutant.
3. Reports "killed" (test caught it) vs "survived" (test missed it) mutants.
4. Mutation score = killed / total.

### Target modules

Start with the highest-value modules:

| Module | Why |
|--------|-----|
| `convergence.ts` | Core math — a sign flip here means wrong projections for every user. |
| `implicationsMath.ts` | Complex arithmetic — easy to introduce subtle errors. |
| `shareState.ts` | URL parsing — a missed case breaks all shared links. |
| `sensitivityAnalysis.ts` | Comparative calculations — ordering bugs are subtle. |

### Target score

Aim for **>80% mutation score** on these modules. Anything below indicates tests that pass but don't actually verify correctness.

---

## Execution Priority

| Phase | Effort | Value | When |
|-------|--------|-------|------|
| **Phase 1** — Complete lib coverage | S | High | Now |
| **Phase 2** — Snapshot tests | S-M | High | Now |
| **Phase 7** — Performance benchmarks | S | Medium | Now |
| **Phase 3** — Hook & component tests | M | High | Next |
| **Phase 4** — E2E tests (smoke first) | M-L | Very High | Next |
| **Phase 5** — Accessibility tests | S | High | With Phase 4 |
| **Phase 6** — Visual regression | M | Medium | Later |
| **Phase 8** — Mutation testing | M | Medium | Later |

---

## Test Scripts (Final State)

```json
{
  "test": "tsx scripts/test.ts && tsx scripts/property.test.ts",
  "test:components": "vitest run",
  "test:e2e": "playwright test",
  "test:e2e:mobile": "playwright test --project=mobile",
  "test:bench": "tsx scripts/bench.ts",
  "test:a11y": "playwright test --grep @a11y",
  "test:visual": "playwright test --grep @visual",
  "test:all": "pnpm test && pnpm test:components && pnpm test:e2e",
  "test:update-snapshots": "tsx scripts/test.ts --update && playwright test --update-snapshots"
}
```

Pre-push hook runs: `lint:biome → typecheck → test` (lib tests only — fast).
CI runs: `test:all` (everything including E2E).

---

## File Structure (Final State)

```
scripts/
  test.ts                          # Unit tests (existing)
  property.test.ts                 # Property-based tests (existing)
  bench.ts                         # Performance benchmarks (Phase 7)
  __snapshots__/                   # Output snapshots (Phase 2)
    shareCard-twitter.svg.snap
    export-observed.csv.snap
    ...
src/
  hooks/
    useConvergence.test.ts         # Hook tests (Phase 3)
    useTheme.test.ts
    ...
  components/
    CountryPickerModal.test.tsx    # Component tests (Phase 3)
    GrowthRateSlider.test.tsx
    ExportModal.test.tsx
    ...
e2e/
  smoke.spec.ts                   # Smoke tests (Phase 4)
  country-comparison.spec.ts      # User flow tests (Phase 4)
  region-comparison.spec.ts
  export.spec.ts
  implications.spec.ts
  accessibility.spec.ts           # a11y tests (Phase 5)
  visual-regression.spec.ts       # Screenshot tests (Phase 6)
  __screenshots__/                # Visual baselines (Phase 6)
vitest.config.ts                  # Component test config (Phase 3)
playwright.config.ts              # E2E config (Phase 4)
```
