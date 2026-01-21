# Phase 1 Implementation Plan: Shareability Foundation

> Feature 1 (Share Cards) + Feature 10 (Dynamic OG/Twitter Cards)

---

## Codebase Analysis Summary

### What Already Exists

| Component | Location | Status |
|-----------|----------|--------|
| OG Image Generation | `/app/functions/api/og.png.ts` | ✅ Exists - uses `@resvg/resvg-wasm` |
| Share Page with Meta Tags | `/app/functions/share.ts` | ✅ Exists - redirects after meta scrape |
| Client-Side PNG Export | `/app/src/lib/chartExport.ts` | ✅ Exists - SVG→Canvas→PNG pipeline |
| URL State Serialization | `/app/src/lib/shareState.ts` | ✅ Exists - full state in URL params |
| Chart Rendering | `/app/src/components/ConvergenceChart.tsx` | ✅ Pure SVG, forwardRef exposed |
| Headline Generation | `/app/src/lib/headlineGenerator.ts` | ✅ Exists - generates insight text |

### What Needs Enhancement

1. **OG card design** - Currently stats-focused, not chart-focused
2. **No Share Card UI** - No dedicated modal for generating Twitter images
3. **No branded overlay** - Missing headline + watermark on share images
4. **Regional mode not supported** in OG generation
5. **No dark mode toggle** for share cards

---

## Technical Architecture

### Image Generation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     SHARE CARD GENERATION                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CLIENT-SIDE (ShareCardModal)         SERVER-SIDE (OG)      │
│  ┌─────────────────────────┐         ┌──────────────────┐   │
│  │ generateShareCardSvg()  │         │ /api/og.png      │   │
│  │         ↓               │         │       ↓          │   │
│  │ svgToPngBlob()         │         │ @resvg/resvg-wasm│   │
│  │         ↓               │         │       ↓          │   │
│  │ Clipboard / Download    │         │ PNG Response     │   │
│  └─────────────────────────┘         └──────────────────┘   │
│                                                             │
│  Shared: shareCardSvg.ts (SVG template generation)          │
└─────────────────────────────────────────────────────────────┘
```

### Share Card Layout (1200x675)

```
┌────────────────────────────────────────────────────────────────┐
│                                                          12px  │
│   INDIA → CHINA                                    [metric]    │
│   "Converges in 42 years (by 2067)"                           │
│                                                                │
│   ┌──────────────────────────────────────────────────────┐    │
│   │                                                      │    │
│   │              [CONVERGENCE CHART]                     │    │
│   │                                                      │    │
│   │     ▬▬▬ India (5.2% growth)                         │    │
│   │     ▬▬▬ China (2.1% growth)                         │    │
│   │                     ↑                                │    │
│   │              convergence marker                      │    │
│   │                                                      │    │
│   └──────────────────────────────────────────────────────┘    │
│                                                                │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│   │ 42 YEARS │  │ 4.2× gap │  │ 5.2%/2.1%│                    │
│   │ to catch │  │ current  │  │ growth   │                    │
│   └──────────┘  └──────────┘  └──────────┘                    │
│                                                                │
│   ─────────────────────────────────────────────────────────   │
│   convergence-explorer.com              Data: World Bank 2023  │
└────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Shared SVG Template Generator

**File:** `/app/src/lib/shareCardSvg.ts`

```typescript
export interface ShareCardParams {
  chaserName: string;
  targetName: string;
  chaserCode: string;
  targetCode: string;
  metricLabel: string;
  headline: string;
  subheadline?: string;
  projection: Array<{ year: number; chaser: number; target: number }>;
  convergenceYear: number | null;
  currentGap: number;
  chaserGrowth: number;
  targetGrowth: number;
  theme: 'light' | 'dark';
  dimensions?: { width: number; height: number };
}

export function generateShareCardSvg(params: ShareCardParams): string
```

**Tasks:**
- [ ] Define color palettes for light/dark themes (match existing CSS vars)
- [ ] Build SVG string with embedded fonts (system fonts for compatibility)
- [ ] Generate chart path from projection data
- [ ] Add convergence marker if applicable
- [ ] Add stat cards at bottom
- [ ] Add branded footer with URL

---

### Step 2: Create ShareCardPreview Component

**File:** `/app/src/components/ShareCardPreview.tsx`

```typescript
interface ShareCardPreviewProps {
  params: ShareCardParams;
  scale?: number; // For fitting in modal (e.g., 0.5)
}

export function ShareCardPreview({ params, scale = 0.5 }: ShareCardPreviewProps)
```

**Tasks:**
- [ ] Render SVG inline using `dangerouslySetInnerHTML`
- [ ] Apply scale transform for modal preview
- [ ] Add loading state while generating

---

### Step 3: Create ShareCardModal Component

**File:** `/app/src/components/ShareCardModal.tsx`

```typescript
interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  // All data needed comes from app state context
}
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ Create Share Card                    ✕  │
├─────────────────────────────────────────┤
│                                         │
│   [═══════ LIVE PREVIEW ═══════]       │
│                                         │
├─────────────────────────────────────────┤
│ Theme:  ○ Light  ● Dark                 │
│                                         │
│ Size:   ● Twitter (1200×675)            │
│         ○ LinkedIn (1200×627)           │
│         ○ Square (1080×1080)            │
├─────────────────────────────────────────┤
│                                         │
│  [📋 Copy to Clipboard]  [⬇ Download]   │
│                                         │
└─────────────────────────────────────────┘
```

**Tasks:**
- [ ] Theme toggle (light/dark)
- [ ] Size selector (Twitter, LinkedIn, Square)
- [ ] Copy to clipboard button with success feedback
- [ ] Download PNG button
- [ ] Loading states during generation

---

### Step 4: Extend chartExport.ts

**File:** `/app/src/lib/chartExport.ts`

**New exports:**
```typescript
export async function generateShareCardPng(
  params: ShareCardParams
): Promise<Blob>

export async function copyShareCardToClipboard(
  params: ShareCardParams
): Promise<void>

export async function downloadShareCardPng(
  params: ShareCardParams,
  filename?: string
): Promise<void>
```

**Tasks:**
- [ ] Add `generateShareCardPng` using existing SVG→Canvas→Blob pattern
- [ ] Add clipboard wrapper with fallback for older browsers
- [ ] Add download wrapper with auto-generated filename

---

### Step 5: Integrate Modal into App

**Files to modify:**
- `/app/src/App.tsx` - Add modal state
- `/app/src/components/AppHeader.tsx` - Add "Share" button

**Tasks:**
- [ ] Add `isShareCardModalOpen` state to App.tsx
- [ ] Import and render ShareCardModal
- [ ] Add share button to header (icon + dropdown or direct modal trigger)
- [ ] Pass required data from app state to modal

---

### Step 6: Enhance OG Image Endpoint

**File:** `/app/functions/api/og.png.ts`

**Current endpoint:** `/api/og.png?chaser=IND&target=CHN&...`

**Enhancements:**

1. **New layout** - Chart-focused instead of stats-focused
2. **Regional support** - Parse `mode=regions` and query OECD data
3. **Theme support** - Parse `theme=dark` for dark mode variant

**New parameters:**
```
?chaser=IND
&target=CHN
&indicator=gdp
&chaserGrowth=5.2
&targetGrowth=2.1
&baseYear=2024
&theme=dark       // NEW
&mode=regions     // NEW (for OECD regions)
```

**Tasks:**
- [ ] Refactor to use shared template logic (may need edge-compatible version)
- [ ] Add regional mode data fetching
- [ ] Add theme parameter parsing
- [ ] Update SVG layout to match new design
- [ ] Test with Twitter Card Validator

---

### Step 7: Update Share Page Meta Tags

**File:** `/app/functions/share.ts`

**Tasks:**
- [ ] Add regional mode to meta tag generation
- [ ] Include theme in OG image URL
- [ ] Improve `og:description` with more context
- [ ] Add `twitter:creator` if known

---

### Step 8: Add ExportModal Integration

**File:** `/app/src/components/ExportModal.tsx`

**Tasks:**
- [ ] Add "Share Card" section in Images grid
- [ ] Show mini preview with "Create Full Card" link
- [ ] Quick copy-to-clipboard action

---

## File Summary

### New Files

| File | Purpose |
|------|---------|
| `/app/src/lib/shareCardSvg.ts` | SVG template generation |
| `/app/src/components/ShareCardModal.tsx` | Main share card UI |
| `/app/src/components/ShareCardPreview.tsx` | Live preview component |

### Modified Files

| File | Changes |
|------|---------|
| `/app/src/App.tsx` | Add modal state, render modal |
| `/app/src/components/AppHeader.tsx` | Add Share button |
| `/app/src/components/ExportModal.tsx` | Add share card section |
| `/app/src/lib/chartExport.ts` | Add share card export functions |
| `/app/functions/api/og.png.ts` | New design, regional/theme support |
| `/app/functions/share.ts` | Enhanced meta tags |

---

## Theme Palettes

```typescript
export const SHARE_CARD_PALETTES = {
  light: {
    background: '#faf8f5',
    card: '#fffffe',
    border: '#e5e0d8',
    text: '#1a1815',
    muted: '#5c574f',
    chaser: '#ea580c',    // terracotta
    target: '#059669',    // verdigris
    convergence: '#8b5cf6', // violet
    grid: '#e5e0d8',
  },
  dark: {
    background: '#0f0e0d',
    card: '#1a1918',
    border: '#2a2826',
    text: '#f5f3ef',
    muted: '#a8a49c',
    chaser: '#fb923c',    // lighter terracotta
    target: '#34d399',    // lighter verdigris
    convergence: '#a78bfa', // lighter violet
    grid: '#2a2826',
  },
} as const;
```

---

## Testing Checklist

### Manual Testing

- [ ] Twitter Card Validator: https://cards-dev.twitter.com/validator
- [ ] Facebook Debugger: https://developers.facebook.com/tools/debug/
- [ ] LinkedIn Inspector: https://www.linkedin.com/post-inspector/

### Scenarios to Test

| Scenario | Expected |
|----------|----------|
| Convergence exists | Shows year + marker on chart |
| No convergence | Shows "never converges" messaging |
| Already ahead | Shows "already ahead" messaging |
| Very long country names | Text truncates gracefully |
| Regional mode | Shows region names, OECD attribution |
| Dark theme | All colors properly inverted |
| Mobile share | Modal works on small screens |

### Browser Testing

- [ ] Chrome (clipboard API)
- [ ] Safari (clipboard API fallback)
- [ ] Firefox (clipboard API)
- [ ] Mobile Safari (download behavior)

---

## Success Criteria

1. **User can generate share card in < 3 clicks** from any comparison
2. **Shared links show chart preview** in Twitter/LinkedIn/Facebook
3. **Images look professional** - clean typography, proper contrast, branded
4. **Both themes work** - light for formal, dark for engagement
5. **Regional mode supported** in OG images
6. **Fast generation** - < 500ms client-side, < 1s server-side

---

## Dependencies

```json
{
  "existing": [
    "@resvg/resvg-wasm"  // Already in use for OG images
  ],
  "no new dependencies needed": true
}
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| WASM fails on some edge nodes | SVG fallback already implemented |
| Clipboard API not supported | Fallback to download |
| Large SVG slow to render | Simplify chart paths, reduce points |
| Font rendering differs | Use system font stack |

---

## Next Steps

After Phase 1 completion, this enables:
- **Feature 5 (Thread Generator)** - builds on share card generation
- **Feature 4 (Embed Mode)** - uses same SVG rendering
- **Feature 2 (Scenarios)** - each scenario links to shareable state
