# Feature 4: Embed Mode Implementation Plan

> Let bloggers, journalists, and Substack writers embed live charts

---

## Overview

Enable embedding of Convergence Explorer charts into external websites via iframe or static image fallback. This allows content creators to include interactive (or static) visualizations in their posts without users leaving the page.

**Priority:** P1 (Phase 2: Discovery & Engagement)

**Dependencies:** Feature 1 (Share Cards) - for image fallback on platforms that don't support iframes

---

## Requirements Summary

| Requirement | Description |
|-------------|-------------|
| `?embed=true` parameter | Minimal chrome, chart-only view |
| Attribution footer | Small branded footer with link back |
| Responsive iframe | Adapts to container width |
| Interactive toggle | `?interactive=false` for static display |
| Embed code generator | UI to generate copy-paste code |
| Platform support | Substack, WordPress, Ghost, Notion |
| Image fallback | For Medium and other iframe-blocking platforms |

---

## Technical Architecture

### Embed Detection Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      URL PARSING                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  /share?embed=true&chaser=IND&target=CHN&...               │
│                      │                                      │
│                      ▼                                      │
│  ┌───────────────────────────────────────┐                 │
│  │         parseEmbedParams()            │                 │
│  │  - embed: boolean                     │                 │
│  │  - interactive: boolean (default true)│                 │
│  │  - theme: 'light' | 'dark' | 'auto'  │                 │
│  │  - height: number (optional)          │                 │
│  └───────────────────────────────────────┘                 │
│                      │                                      │
│                      ▼                                      │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  embed=false    │    │   embed=true    │                │
│  │  Normal App     │    │   EmbedView     │                │
│  └─────────────────┘    └─────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Embed View Layout

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │                                                   │    │
│   │           [CONVERGENCE CHART]                     │    │
│   │                                                   │    │
│   │     ▬▬▬ India (5.2% growth)                      │    │
│   │     ▬▬▬ China (2.1% growth)                      │    │
│   │                                                   │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
│   India → China · Converges in 42 years                     │
│   ─────────────────────────────────────────────────────    │
│   Explore more at convergence-explorer.com    [↗]          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Dimensions:**
- Default: 100% width, auto height (maintains aspect ratio)
- Minimum height: 320px
- Maximum height: 600px (configurable via `?h=` param)
- Footer height: 48px

---

## Implementation Steps

### Step 1: Extend URL State for Embed Parameters

**File:** `/app/src/lib/shareState.ts`

Add embed-specific parameters to the ShareState interface and parsing:

```typescript
// Add to ShareState interface
interface ShareState {
  // ... existing fields ...

  // Embed-specific (not persisted to main app URL)
  embed?: boolean;           // Trigger embed mode
  interactive?: boolean;     // Enable/disable interactions (default: true)
  embedTheme?: 'light' | 'dark' | 'auto';  // Theme override for embed
  h?: number;               // Custom height in pixels
}
```

**Tasks:**
- [ ] Add `embed`, `interactive`, `embedTheme`, `h` to ShareState interface
- [ ] Update `parseShareStateFromSearch()` to handle new params
- [ ] Create `isEmbedMode()` helper function
- [ ] Ensure embed params don't pollute main app URL sharing

---

### Step 2: Create EmbedView Component

**File:** `/app/src/components/EmbedView.tsx`

Minimal wrapper that renders only the chart with attribution footer:

```typescript
interface EmbedViewProps {
  shareState: ShareState;
  chaserName: string;
  targetName: string;
  projection: ProjectionPoint[];
  convergenceYear: number | null;
  milestones?: Milestone[];
  interactive?: boolean;
  theme?: 'light' | 'dark';
}

export function EmbedView(props: EmbedViewProps): JSX.Element
```

**Layout responsibilities:**
- Full-width chart container with padding
- Compact headline below chart
- Minimal attribution footer with link
- No header, no sidebar, no controls
- Responsive height management

**Tasks:**
- [ ] Create component skeleton with props interface
- [ ] Import and render `ConvergenceChartInteractive` (or static variant)
- [ ] Add compact headline showing comparison summary
- [ ] Add attribution footer with "Explore more" link
- [ ] Handle theme (light/dark/auto based on host preference)
- [ ] Implement responsive container sizing
- [ ] Add `postMessage` API for parent frame communication (optional)

---

### Step 3: Create EmbedChartStatic Component

**File:** `/app/src/components/EmbedChartStatic.tsx`

Non-interactive version of the chart for `?interactive=false`:

```typescript
interface EmbedChartStaticProps {
  projection: ProjectionPoint[];
  chaserName: string;
  targetName: string;
  chaserGrowth: number;
  targetGrowth: number;
  convergenceYear: number | null;
  milestones?: Milestone[];
  theme: 'light' | 'dark';
  width: number;
  height: number;
}

export function EmbedChartStatic(props: EmbedChartStaticProps): JSX.Element
```

**Differences from interactive:**
- No hover states or tooltips
- No mouse tracking
- Simpler SVG without event handlers
- Better performance for multiple embeds on one page

**Tasks:**
- [ ] Fork from `ConvergenceChart.tsx` (remove interactivity)
- [ ] Remove all mouse event handlers
- [ ] Remove tooltip rendering
- [ ] Keep legend, grid, axis labels
- [ ] Optimize for static rendering (CSS `pointer-events: none`)

---

### Step 4: Create EmbedFooter Component

**File:** `/app/src/components/EmbedFooter.tsx`

Minimal branded footer for embeds:

```typescript
interface EmbedFooterProps {
  shareUrl: string;      // Full URL to open in new tab
  chaserName: string;
  targetName: string;
  theme: 'light' | 'dark';
}

export function EmbedFooter(props: EmbedFooterProps): JSX.Element
```

**Design:**
```
┌─────────────────────────────────────────────────────────────┐
│  India → China                    Convergence Explorer  [↗] │
└─────────────────────────────────────────────────────────────┘
```

**Tasks:**
- [ ] Create compact footer layout (48px height)
- [ ] Show comparison summary on left
- [ ] Show branding + external link icon on right
- [ ] Link opens full app in new tab (with same state)
- [ ] Style for light/dark themes
- [ ] Make touch-friendly (min 44px tap target)

---

### Step 5: Add Embed Mode Detection to App.tsx

**File:** `/app/src/App.tsx`

Add conditional rendering based on embed parameter:

```typescript
// Near top of App component
const isEmbed = useMemo(() => {
  const params = new URLSearchParams(window.location.search);
  return params.get('embed') === 'true';
}, []);

// In render
if (isEmbed) {
  return (
    <EmbedView
      shareState={shareState}
      chaserName={chaserName}
      targetName={targetName}
      projection={projection}
      convergenceYear={convergenceYear}
      milestones={showMilestones ? milestones : undefined}
      interactive={shareState.interactive !== false}
      theme={resolvedTheme}
    />
  );
}

// ... rest of normal app
```

**Tasks:**
- [ ] Add `isEmbed` detection at component top
- [ ] Add early return with `EmbedView` when embed mode
- [ ] Pass all necessary data to EmbedView
- [ ] Ensure data hooks still run (useCountryData, useConvergence, etc.)
- [ ] Handle regional mode embeds

---

### Step 6: Add Embed CSS Styles

**File:** `/app/src/index.css`

Add embed-specific styles:

```css
/* Embed mode container */
.embed-container {
  width: 100%;
  min-height: 320px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Remove any unwanted margins/padding in embed */
body.embed-mode {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: transparent;
}

/* Embed footer */
.embed-footer {
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-top: 1px solid var(--color-border);
  font-size: 14px;
}

/* Auto theme detection for embeds */
@media (prefers-color-scheme: dark) {
  body.embed-mode.theme-auto {
    /* dark theme variables */
  }
}
```

**Tasks:**
- [ ] Add `.embed-container` styles
- [ ] Add `body.embed-mode` reset styles
- [ ] Add `.embed-footer` styles
- [ ] Add responsive breakpoints for embed
- [ ] Add theme-auto support using `prefers-color-scheme`
- [ ] Test in iframes at various sizes

---

### Step 7: Create EmbedCodeGenerator Component

**File:** `/app/src/components/EmbedCodeGenerator.tsx`

UI for generating embed code in the main app:

```typescript
interface EmbedCodeGeneratorProps {
  shareState: ShareState;
  onClose?: () => void;
}

export function EmbedCodeGenerator(props: EmbedCodeGeneratorProps): JSX.Element
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ Embed This Chart                     ✕  │
├─────────────────────────────────────────┤
│                                         │
│   [═══════ LIVE PREVIEW ═══════]       │
│                                         │
├─────────────────────────────────────────┤
│ Options:                                │
│   Interactive:  ● Yes  ○ No             │
│   Theme:        ○ Light  ○ Dark  ● Auto │
│   Height:       [400] px                │
│                                         │
├─────────────────────────────────────────┤
│ Embed Code:                             │
│ ┌─────────────────────────────────────┐ │
│ │ <iframe src="..." width="100%"     │ │
│ │   height="400" frameborder="0"     │ │
│ │   allowfullscreen></iframe>        │ │
│ └─────────────────────────────────────┘ │
│                      [📋 Copy Code]     │
│                                         │
├─────────────────────────────────────────┤
│ For Medium or sites without iframes:    │
│                                         │
│   [🖼️ Download Static Image]           │
│   [🔗 Copy Image URL]                   │
│                                         │
└─────────────────────────────────────────┘
```

**Generated code format:**
```html
<iframe
  src="https://convergence-explorer.com/share?embed=true&chaser=IND&target=CHN&..."
  width="100%"
  height="400"
  frameborder="0"
  loading="lazy"
  allowfullscreen
  style="border: 1px solid #e5e5e5; border-radius: 8px;"
></iframe>
```

**Tasks:**
- [ ] Create modal/panel layout
- [ ] Add live preview using actual EmbedView at small scale
- [ ] Add interactive toggle
- [ ] Add theme selector (Light/Dark/Auto)
- [ ] Add height input with validation (min 320, max 800)
- [ ] Generate iframe code dynamically
- [ ] Add copy-to-clipboard for embed code
- [ ] Add image fallback section (uses Feature 1)
- [ ] Add "Download Static Image" using share card generator
- [ ] Add "Copy Image URL" for OG image

---

### Step 8: Integrate into ExportModal

**File:** `/app/src/components/ExportModal.tsx`

Add embed section to existing export modal:

**Tasks:**
- [ ] Add "Embed" tab or section
- [ ] Link to EmbedCodeGenerator or inline the options
- [ ] Show preview of embed appearance
- [ ] Add quick-copy for default iframe code
- [ ] Add link to full embed customization

---

### Step 9: Add Embed Entry Point (Optional)

**File:** `/app/functions/embed.ts` (Cloudflare Pages function)

Server-side handler for embed requests with proper headers:

```typescript
export const onRequest: PagesFunction = async (context) => {
  // Add headers for iframe embedding
  const headers = {
    'X-Frame-Options': 'ALLOWALL',
    'Content-Security-Policy': "frame-ancestors *",
  };

  // Return the SPA with embed-friendly headers
  return context.next();
};
```

**Tasks:**
- [ ] Create edge function for `/embed` or `/share` routes
- [ ] Set appropriate `X-Frame-Options` header
- [ ] Set `Content-Security-Policy` frame-ancestors
- [ ] Handle CORS if needed for cross-origin embeds
- [ ] Add caching headers for embed assets

---

### Step 10: Parent Frame Communication (Optional Enhancement)

**File:** `/app/src/lib/embedMessaging.ts`

Allow parent frames to communicate with embed:

```typescript
interface EmbedMessage {
  type: 'resize' | 'navigate' | 'ready';
  payload: unknown;
}

// Send messages to parent
export function sendToParent(message: EmbedMessage): void {
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

// Auto-resize notification
export function notifyResize(height: number): void {
  sendToParent({ type: 'resize', payload: { height } });
}
```

**Use cases:**
- Auto-resize iframe height based on content
- Notify parent when embed is ready
- Allow parent to update comparison dynamically

**Tasks:**
- [ ] Create messaging utility
- [ ] Add resize observer in EmbedView
- [ ] Send resize messages to parent
- [ ] Document API for advanced integrations

---

## File Summary

### New Files

| File | Purpose |
|------|---------|
| `/app/src/components/EmbedView.tsx` | Main embed container |
| `/app/src/components/EmbedChartStatic.tsx` | Non-interactive chart variant |
| `/app/src/components/EmbedFooter.tsx` | Minimal attribution footer |
| `/app/src/components/EmbedCodeGenerator.tsx` | UI for generating embed code |
| `/app/src/lib/embedMessaging.ts` | Parent frame communication (optional) |
| `/app/functions/embed.ts` | Edge function for embed headers (optional) |

### Modified Files

| File | Changes |
|------|---------|
| `/app/src/lib/shareState.ts` | Add embed params to interface and parsing |
| `/app/src/App.tsx` | Add embed mode detection and conditional render |
| `/app/src/index.css` | Add embed-specific styles |
| `/app/src/components/ExportModal.tsx` | Add embed section |
| `/app/src/components/ShareMenu.tsx` | Add "Embed" option |

---

## URL Parameter Reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `embed` | boolean | false | Enable embed mode |
| `interactive` | boolean | true | Enable hover/click interactions |
| `embedTheme` | string | 'auto' | Theme: 'light', 'dark', or 'auto' |
| `h` | number | 400 | Height in pixels (320-800) |

**Example URLs:**

```
# Interactive embed with auto theme
/share?embed=true&chaser=IND&target=CHN&indicator=GDP_PCAP_PPP&cg=0.052&tg=0.021

# Static embed, dark theme, custom height
/share?embed=true&interactive=false&embedTheme=dark&h=500&chaser=IND&target=CHN...

# Regional mode embed
/share?embed=true&mode=regions&cr=UKC&tr=FR10...
```

---

## Platform Compatibility

| Platform | Iframe Support | Fallback |
|----------|----------------|----------|
| Substack | ✅ Full | Not needed |
| WordPress | ✅ Full | Not needed |
| Ghost | ✅ Full | Not needed |
| Notion | ✅ Full | Not needed |
| Medium | ❌ Blocked | Static image (OG image URL) |
| LinkedIn | ❌ Blocked | Static image |
| Twitter/X | ❌ Blocked | Twitter Card preview |

**Medium fallback instructions:**
1. Copy OG image URL
2. Add as image in Medium
3. Link image to full interactive version

---

## Testing Checklist

### Embed Rendering

- [ ] Embed loads correctly with `?embed=true`
- [ ] Chart renders at correct aspect ratio
- [ ] Footer displays with correct branding
- [ ] "Explore more" link opens full app in new tab
- [ ] Regional mode works in embed

### Interactivity

- [ ] Interactive mode: hover tooltips work
- [ ] Interactive mode: click interactions work (if any)
- [ ] Static mode: no hover states
- [ ] Static mode: better performance with many embeds

### Themes

- [ ] Light theme renders correctly
- [ ] Dark theme renders correctly
- [ ] Auto theme respects `prefers-color-scheme`
- [ ] Theme consistent between chart and footer

### Responsiveness

- [ ] Embed resizes with container width
- [ ] Minimum height (320px) enforced
- [ ] Maximum height (configurable) enforced
- [ ] Touch-friendly on mobile embeds

### Platform Testing

- [ ] Substack: iframe renders inline
- [ ] WordPress (self-hosted): iframe renders
- [ ] Ghost: iframe renders
- [ ] Notion: iframe renders
- [ ] Medium: image fallback works

### Embed Generator

- [ ] Options update preview in real-time
- [ ] Generated code is valid HTML
- [ ] Copy button works
- [ ] Image fallback options work (depends on Feature 1)

### Edge Cases

- [ ] Very long country names truncate gracefully
- [ ] Missing data shows appropriate state
- [ ] Invalid params fall back to defaults
- [ ] Cross-origin embeds work (CORS headers)

---

## Success Criteria

1. **Blogger can embed in < 1 minute** - Copy code, paste, done
2. **Embeds look native** - Clean, minimal, professional
3. **Works everywhere that matters** - Substack, WordPress, Ghost, Notion
4. **Fallback for restricted platforms** - Static image option for Medium
5. **Customizable** - Theme, interactivity, height options
6. **Performant** - Static mode for pages with multiple embeds
7. **Discoverable** - Clear embed option in share/export UI

---

## Dependencies

```json
{
  "existingDependencies": [
    "None - uses existing React components and patterns"
  ],
  "featureDependencies": [
    "Feature 1 (Share Cards) - for static image fallback"
  ],
  "newDependencies": []
}
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Iframe blocked by CSP | Embed won't render | Provide static image fallback |
| Performance with many embeds | Page slowdown | Static mode option |
| Theme mismatch with host | Looks jarring | Auto theme + manual override |
| Height miscalculation | Content cut off | Min/max constraints + resize API |
| CORS issues | Embed fails to load | Proper headers on edge function |

---

## Implementation Order

1. **Step 1-2**: Core embed view (MVP)
2. **Step 3-4**: Static variant + footer
3. **Step 5-6**: App integration + styles
4. **Step 7-8**: Embed code generator
5. **Step 9-10**: Edge function + messaging (enhancements)

---

## Estimated Scope

| Component | Lines of Code (est.) |
|-----------|---------------------|
| EmbedView.tsx | ~120 |
| EmbedChartStatic.tsx | ~150 |
| EmbedFooter.tsx | ~60 |
| EmbedCodeGenerator.tsx | ~200 |
| shareState.ts changes | ~30 |
| App.tsx changes | ~20 |
| index.css changes | ~50 |
| **Total** | **~630 lines** |

---

## Next Steps After Completion

This feature enables:
- **Feature 2 (Scenarios)** - Each scenario can have "Embed this" option
- **Feature 5 (Thread Generator)** - Embeds can be referenced in thread text
- **Analytics tracking** - Embed impressions as success metric

---

## Notes

- Keep embed view as light as possible - minimal JS, fast load
- Consider lazy-loading chart data for better perceived performance
- Document embed API for power users who want custom integrations
- Consider oEmbed standard support for automatic embedding in compatible platforms
