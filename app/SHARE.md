# Shareable Charts & Exports — Implementation Plan

This document defines the end-to-end plan for making charts linkable, exportable, accessible, and “unfurlable” (OpenGraph/Twitter preview cards) for the Mountain app.

## Goals
- Linkable views: full chart state encoded in URL, stable and share-ready.
- First-class sharing: one-click “Copy share link” that unfurls nicely in Slack/Twitter/Discord/iMessage.
- High-quality exports: SVG (vector), PNG (social), Copy Image, and Print.
- Data reuse: CSV/JSON downloads with metadata (indicator/unit/source and latest observed year).
- Accessibility: keyboard support, non-color encoding, good contrast in day/night mode, text alternatives.
- Responsive + stable: no content reflow, readable axes on mobile, consistent formatting.
- Trust: explicit baseline/year, assumptions, handling of missing data, no misleading smoothing.
- Performance: debounced URL updates, small render payloads, fast exports and unfurl generation.

## Non-goals (for initial release)
- Arbitrary user-uploaded datasets.
- Full interactive chart editing within the OG image.
- Perfect “pixel parity” between on-screen and OG images (OG is a designed summary card).
- Analytics-heavy sharing funnels (can be added later).

## Definitions
- **App Link**: The interactive SPA URL (what users see and edit).
- **Share Link**: A crawler-friendly URL that serves OG meta tags and redirects humans into the SPA.
- **State**: The minimal set of inputs required to reproduce a view (countries, metric, rates, etc.).

## Canonical State (URL Schema)
We will support both an app URL and a share URL. Both encode the same state via query params.

### Query params
- `chaser`: ISO3 (e.g. `NGA`)
- `target`: ISO3 (e.g. `IRL`)
- `indicator`: indicator code (e.g. `GDP_PCAP_PPP`, `POPULATION`)
- `cg`: chaser growth rate as decimal (e.g. `0.035`)
- `tg`: target growth rate as decimal (e.g. `0.015`)
- `tmode`: `growing` or `static`
- `baseYear`: integer (e.g. `2023`)
- Optional:
  - `view`: `chart` or `table` (for shared links that open directly to table view)
  - `theme`: `light` or `dark` (optional; default respects user preference)

### Validation + normalization rules
- Clamp `cg` and `tg` to configured ranges, round to `0.001` for URL stability.
- If `tmode=static`, force `tg=0` for display/calculation; remember last nonzero target rate in app state.
- Reject/ignore invalid ISO3/indicator; fall back to defaults.
- If `chaser === target`, auto-adjust (swap to default target) and show a non-blocking notice.

### Canonicalization
- The app will canonicalize URLs after parsing (stable ordering and normalized values) to avoid “URL drift”.

## UX: Share / Export Surface
Add a compact “Share” button near the header.

### Popover actions
- **Copy share link** (uses `/share?...` to ensure unfurls work)
- **Copy app link** (optional; the interactive URL)
- **Download SVG** (vector export of chart)
- **Download PNG** (with presets)
  - `1200×630` (OpenGraph/Twitter)
  - `1080×1080` (Square)
  - `1600×900` (Wide)
- **Copy image** (PNG to clipboard; fallback to download if unsupported)
- **Download CSV** (observed + projection; see formats)
- **Download JSON** (report bundle; see formats)
- **Print** (print-optimized layout)

### Action availability
- Disable export/share actions when:
  - data is loading, OR
  - one or both countries have no recent data for the selected indicator, OR
  - indicator/country lookup failed.

### Notifications
- Toast feedback: success/failure for copy and downloads.

## Exports

### SVG export (vector)
Approach:
- Keep chart rendering as pure SVG.
- Serialize chart SVG with `XMLSerializer`.
- Ensure exported SVG includes:
  - explicit `width`, `height`, `viewBox`
  - `<title>` and `<desc>` for accessibility
  - inlined critical styles (avoid relying on external CSS for portability)

### PNG export (social)
Approach:
- Convert the serialized SVG to an image and paint onto a `<canvas>` at 2–3× scale.
- `canvas.toBlob()` for download.
- Include a lightweight export “frame” option:
  - title/subtitle (countries + metric)
  - assumptions line (rates/baseYear/tmode)
  - source + timestamp

### Copy image
Approach:
- Use `navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])`.
- Fall back to download if unsupported or denied.

### Print stylesheet
Approach:
- Add print CSS that:
  - hides controls (selectors, sliders, share popover)
  - shows chart + summary + assumptions + source/footer
  - forces white background and high-contrast text

## Data Downloads
We will export both “observed” and “projection” data, plus a combined report format.

### CSV formats
1) `observed.csv`
- Columns: `country_iso3,country_name,indicator,year,value,unit,source,last_observed_year`

2) `projection.csv`
- Columns: `year,chaser_iso3,chaser_value,target_iso3,target_value,indicator,unit,baseYear,cg,tg,tmode`

### JSON formats
1) `observed.json`
- `{ indicator, countries: { [iso3]: { name, unit, source, lastObservedYear, series:[{year,value}] } } }`

2) `projection.json`
- `{ state, projection:[{year,chaser,target}], derived:{ yearsToConvergence, convergenceYear, gap } }`

3) `report.json` (recommended default)
- `{ generatedAt, state, indicator:{code,name,unit,source,category}, countries:{chaser:{iso3,name},target:{...}}, observedSummary, projection, derived }`

### Provenance
Every export includes:
- indicator code + name + unit + source
- per-country latest observed year used for “current value”
- generated timestamp

## Accessibility Plan
- SVG chart:
  - `role="img"` + `<title>/<desc>`
  - keyboard focus on chart container
  - optional keyboard “scrub” across years (arrow keys) with tooltip on focus
- Tooltip:
  - appears on hover and focus
  - does not cause layout reflow
  - uses readable text contrast in both themes
- Non-color encoding:
  - line dash patterns and/or point markers so meaning isn’t color-only
- Table alternative:
  - “Show data table” toggle rendering an accessible `<table>`
  - supports screen readers and copy/paste
- Respect `prefers-reduced-motion`.

## Responsive + Stable Layout
- Use `ResizeObserver` to measure chart container.
- Adjust:
  - tick density based on width
  - label formatting and truncation
- Keep chart aspect ratio stable to prevent content reflow.
- Ensure popovers/tooltips are portaled/fixed-position and never push content.

## Annotations + Story Cues
- Convergence year vertical line + label (already) remains the primary annotation.
- Add explicit “Outcome” chip near the chart:
  - `Converges in X years (by YYYY)` OR `No convergence at these rates` OR `Already ahead`
- Minimal gridlines; clear legend; avoid clutter.

## Trust & Comparability
- Always display:
  - baseline year used for projection
  - growth assumptions for both countries
  - target mode (static vs growing)
  - indicator name + unit + source
- Missing data:
  - clearly indicate when current values are unavailable
  - avoid showing computed convergence when either side lacks data
- No smoothing unless explicitly labeled (default: none).

## Social Previews (OpenGraph/Twitter)
This is required for reliable “paste link → rich preview” behavior, because many crawlers do not execute SPA JavaScript.

### 1) `/share` HTML endpoint (Pages Function)
Add a server-rendered HTML route that:
- parses and validates the query params (same schema as the app)
- computes title/description deterministically
- returns minimal HTML with:
  - `og:title`, `og:description`, `og:type`, `og:url`
  - `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`
  - `og:image` pointing to `/api/og.png?...`
  - `link rel="canonical"` pointing to the share URL
  - a redirect for humans into the SPA (e.g., `<meta http-equiv="refresh">` and a small script)

Notes:
- Provide a plain-text fallback in body for very strict crawlers.
- Ensure correct caching headers (see below).

### 2) `/api/og.png` dynamic image endpoint (Pages Function)
Add an endpoint that generates a `1200×630` PNG summarizing the view:
- Countries + metric name/unit
- Key takeaway line (converges / no convergence / already ahead)
- Assumptions line (rates/baseYear/mode)
- Source + small footer

Implementation approach (recommended):
- Use `satori` to render an SVG card layout.
- Convert SVG → PNG using `resvg-wasm` (or a compatible Cloudflare-runtime renderer).
- Cache by querystring.

Fallback:
- If PNG rendering is not viable on the runtime, serve an SVG (`image/svg+xml`) and set `og:image:type` if needed, but note some platforms prefer PNG.

### Caching strategy
- `share` HTML: cacheable but short TTL (e.g., 5–15 minutes) since it’s cheap and parameterized.
- `og.png`: longer TTL (e.g., 1–7 days) with cache key = full querystring. These images are deterministic.
- Add `Cache-Control` and allow Cloudflare edge caching; avoid user-specific content.

### Security / abuse considerations
- Strictly validate and clamp all parameters.
- Ensure no HTML injection in meta tags (escape strings).
- Consider basic rate limiting at the edge (optional later).

## Implementation Breakdown (Phases)

### Phase A — URL state foundation
Deliverables:
- `parseUrlState()` / `serializeUrlState()` with unit tests.
- Debounced URL syncing and one-time hydration on initial load.
- “Reset” action.

### Phase B — Share UI
Deliverables:
- Share popover + toasts.
- Copy share link (uses `/share?...`).
- Copy app link (optional).

### Phase C — Data export
Deliverables:
- CSV/JSON generators + download helpers.
- Include metadata and last observed year.
- Unit tests for export generation.

### Phase D — SVG/PNG export + print
Deliverables:
- SVG download.
- PNG download presets.
- Copy image.
- Print CSS.

### Phase E — Accessibility + table view
Deliverables:
- Accessible SVG labeling + tooltip improvements.
- “Show data table” toggle.
- Non-color line styles.

### Phase F — Responsive improvements
Deliverables:
- ResizeObserver-driven ticks and layout.
- Mobile readability pass.

### Phase G — Social previews (unfurl)
Deliverables:
- `/share` HTML route with OG/Twitter meta tags.
- `/api/og.png` generator and caching.
- Manual verification across Slack/Twitter/Discord/iMessage.

### Phase H — QA / polish
Deliverables:
- Validate export correctness (SVG opens in browser/Illustrator/Figma; PNG crisp).
- Check contrast in both themes.
- Check missing-data behavior.
- Perf check: no excessive renders; URL updates debounced.

## Testing & Verification
- Unit tests:
  - URL parsing + clamping + canonicalization.
  - CSV/JSON generation output.
- Manual checks:
  - “Copy share link” unfurls correctly in Slack and Twitter validator.
  - `/share` renders OG tags without requiring JS.
  - `/api/og.png` returns valid PNG quickly and caches.
  - Exports work in Chrome/Safari/Firefox.

## Open Questions
- Do we want short links (`/s/<id>`) backed by D1/KV (for prettier URLs and fewer params)?
- Should OG images always render in light theme (most common) or match `theme` param?
- Should the share link open the app at `/share` (with redirect) or a dedicated SPA route like `/#/share`?
- Do we want embedded “mini chart” in OG image (more complex) or just a designed summary card (recommended)?

