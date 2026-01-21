# Feature 8: Citation-Ready Exports

> Making Convergence Explorer academically credible and easy to reference.

## Overview

This feature adds citation generation capabilities so academics, journalists, and researchers can properly cite both the tool and its underlying data sources. The goal is to make citations effortless—one click generates properly formatted references.

**Priority:** P2
**Complexity:** Low-Medium
**Dependencies:** Stable URL scheme (already in place via `shareState.ts`)

---

## Current State Analysis

### What Already Exists

| Component | Status | Location |
|-----------|--------|----------|
| Source field in database | ✅ Ready | `indicators.source` column |
| Source in API responses | ✅ Ready | All endpoints return `source` |
| Source in CSV exports | ✅ Ready | `dataExport.ts:toObservedCsv()` |
| Source in JSON reports | ✅ Ready | `dataExport.ts:toReportJson()` |
| Share URL system | ✅ Ready | `shareState.ts` |
| Export modal infrastructure | ✅ Ready | `ExportModal.tsx` |
| Embed footer | ✅ Ready | `EmbedFooter.tsx` |

### What Needs Building

1. **Citation format generators** (BibTeX, APA, Chicago, Plain text)
2. **"Cite This" UI** in export flow
3. **Data source attribution panel** with indicator codes
4. **Permanent URL scheme** for specific comparisons
5. **License display** for generated visualizations
6. **Methodology notes** access

---

## Technical Design

### Phase 1: Citation Generators

#### New File: `app/src/lib/citations.ts`

```typescript
export type CitationFormat = 'bibtex' | 'apa' | 'chicago' | 'plaintext';

export interface CitationContext {
  // Tool citation
  toolName: string;
  toolUrl: string;
  accessDate: Date;

  // Comparison context
  chaserName: string;
  targetName: string;
  indicatorName: string;

  // Data source
  dataSource: string;
  dataSourceCode?: string;
  dataVintage?: string;

  // Permanent link
  permalinkUrl: string;
}

export function generateCitation(
  context: CitationContext,
  format: CitationFormat
): string;

export function generateDataSourceCitation(
  source: string,
  sourceCode: string,
  accessDate: Date,
  format: CitationFormat
): string;
```

#### Citation Format Examples

**BibTeX (Tool):**
```bibtex
@misc{convergenceexplorer2024,
  title = {Convergence Explorer: {India} to {China} GDP per capita comparison},
  url = {https://convergence.example.com/?chaser=IND&target=CHN&indicator=GDP_PCAP_PPP},
  note = {Interactive economic convergence visualization tool},
  urldate = {2024-01-15}
}
```

**BibTeX (Data Source):**
```bibtex
@misc{worldbank2024gdp,
  author = {{World Bank}},
  title = {GDP per capita, PPP (constant 2021 international \$)},
  url = {https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD},
  note = {World Development Indicators},
  urldate = {2024-01-15}
}
```

**APA:**
```
Convergence Explorer. (n.d.). India to China: GDP per capita convergence analysis.
  Retrieved January 15, 2024, from https://convergence.example.com/?chaser=IND&target=CHN

World Bank. (2024). GDP per capita, PPP (constant 2021 international $) [Data set].
  World Development Indicators. https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD
```

**Chicago:**
```
"India to China: GDP per capita convergence analysis." Convergence Explorer.
  Accessed January 15, 2024. https://convergence.example.com/?chaser=IND&target=CHN

World Bank. "GDP per capita, PPP (constant 2021 international $)." World Development
  Indicators. Accessed January 15, 2024. https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD
```

**Plain Text:**
```
Convergence Explorer - India to China GDP per capita comparison
URL: https://convergence.example.com/?chaser=IND&target=CHN
Accessed: January 15, 2024

Data Source: World Bank - GDP per capita, PPP (NY.GDP.PCAP.PP.KD)
```

---

### Phase 2: Citation UI Component

#### New File: `app/src/components/CitationPanel.tsx`

A panel/modal that displays:

1. **Tool Citation Section**
   - Format selector (BibTeX | APA | Chicago | Plain)
   - Generated citation text in monospace box
   - Copy button

2. **Data Source Section**
   - Current indicator's source with code
   - Link to original data source
   - Data vintage/last updated info
   - Separate copy button for data citation

3. **License Section**
   - Visualization license (CC-BY 4.0 recommended)
   - Data license (inherited from source)
   - Usage guidance

#### UI Mockup (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│  Cite This Comparison                                   [×] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FORMAT:  [BibTeX] [APA] [Chicago] [Plain]                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ @misc{convergenceexplorer2024,                      │    │
│  │   title = {Convergence Explorer: India to China...  │    │
│  │   url = {https://convergence.example.com/?chaser... │    │
│  │   urldate = {2024-01-15}                            │    │
│  │ }                                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                            [Copy Citation]  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  DATA SOURCE                                                │
│  World Bank · NY.GDP.PCAP.PP.KD                             │
│  GDP per capita, PPP (constant 2021 international $)        │
│  Last updated: 2023-12-01                                   │
│  ↗ View on World Bank                                       │
│                                            [Copy Data Cite] │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  LICENSE                                                    │
│  Visualizations: CC-BY 4.0 (attribution required)           │
│  Underlying data: Subject to World Bank Terms of Use        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 3: Integration Points

#### 3.1 Entry Points for Citation Panel

| Location | Trigger | Implementation |
|----------|---------|----------------|
| Export Modal | New "Cite" tab | Add tab to existing `ExportModal.tsx` |
| Share Menu | "Cite this" option | Add item to `ShareMenu.tsx` popover |
| Embed Footer | "Cite" link | Add to `EmbedFooter.tsx` |
| Keyboard shortcut | `Cmd/Ctrl + Shift + C` | Add to App.tsx key handlers |

#### 3.2 Data Source URLs

Create mapping for linking to original sources:

```typescript
// app/src/lib/dataSourceUrls.ts

export const DATA_SOURCE_URLS: Record<string, (code: string) => string> = {
  'World Bank': (code) => `https://data.worldbank.org/indicator/${code}`,
  'UNDP': () => 'https://hdr.undp.org/data-center/human-development-index',
  'Our World in Data': (code) => `https://ourworldindata.org/grapher/${code}`,
};
```

#### 3.3 Permanent URL Scheme

Current URL structure is already suitable for permanent links:
```
https://convergence.example.com/?chaser=IND&target=CHN&indicator=GDP_PCAP_PPP&cg=5&tg=2
```

**Enhancements:**
- Add `v=1` parameter for URL schema versioning
- Document URL parameter stability commitment
- Consider short URL generation (future enhancement)

---

### Phase 4: Export Enhancements

#### 4.1 Enhanced CSV Export

Add citation header to CSV files:

```csv
# Convergence Explorer Data Export
# Generated: 2024-01-15T10:30:00Z
# URL: https://convergence.example.com/?chaser=IND&target=CHN&indicator=GDP_PCAP_PPP
# Data Source: World Bank (NY.GDP.PCAP.PP.KD)
# License: CC-BY 4.0 (visualizations), World Bank Terms (data)
#
country,indicator,year,value,unit,source
IND,GDP_PCAP_PPP,1990,1234.56,constant 2021 int$,World Bank
...
```

#### 4.2 Enhanced JSON Export

Add `citation` block to JSON reports:

```json
{
  "meta": {
    "generated": "2024-01-15T10:30:00Z",
    "tool": "Convergence Explorer",
    "version": "1.0",
    "permalink": "https://convergence.example.com/?chaser=IND&target=CHN&indicator=GDP_PCAP_PPP&v=1"
  },
  "citation": {
    "bibtex": "@misc{convergenceexplorer2024,...}",
    "apa": "Convergence Explorer. (n.d.). ...",
    "chicago": "\"India to China...\" Convergence Explorer...",
    "plaintext": "Convergence Explorer - India to China..."
  },
  "dataSource": {
    "name": "World Bank",
    "code": "NY.GDP.PCAP.PP.KD",
    "url": "https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD",
    "license": "CC-BY 4.0",
    "vintage": "2023-12-01"
  },
  "comparison": { ... },
  "data": { ... }
}
```

#### 4.3 Share Card Attribution

Add subtle attribution to generated share cards:

```
┌─────────────────────────────────────────┐
│                                         │
│         [CONVERGENCE CHART]             │
│                                         │
│  India → China: Convergence by 2067     │
│                                         │
├─────────────────────────────────────────┤
│ convergence.example.com · Data: World Bank │
└─────────────────────────────────────────┘
```

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `app/src/lib/citations.ts` | Citation format generators |
| `app/src/lib/dataSourceUrls.ts` | Data source URL mappings |
| `app/src/components/CitationPanel.tsx` | Citation UI component |

### Modified Files

| File | Changes |
|------|---------|
| `app/src/components/ExportModal.tsx` | Add "Cite" tab |
| `app/src/components/ShareMenu.tsx` | Add "Cite this" option |
| `app/src/components/EmbedFooter.tsx` | Add cite link |
| `app/src/lib/dataExport.ts` | Add citation headers to CSV/JSON |
| `app/src/lib/shareCardSvg.ts` | Add attribution line |
| `app/src/lib/shareState.ts` | Add `v` parameter for versioning |

---

## Implementation Phases

### Phase 1: Core Citation Logic (Foundation)
- [ ] Create `citations.ts` with format generators
- [ ] Create `dataSourceUrls.ts` with source mappings
- [ ] Add unit tests for citation generation
- [ ] Test all four formats with edge cases

**Testable Outcome:** `generateCitation()` produces valid BibTeX/APA/Chicago/Plain for any comparison.

### Phase 2: Citation Panel UI
- [ ] Create `CitationPanel.tsx` component
- [ ] Implement format selector tabs
- [ ] Add copy-to-clipboard for each section
- [ ] Style to match existing modal patterns
- [ ] Add keyboard navigation (arrow keys between formats)

**Testable Outcome:** Panel renders correctly, copy buttons work, format switching is instant.

### Phase 3: Integration
- [ ] Add "Cite" tab to ExportModal
- [ ] Add "Cite this" to ShareMenu popover
- [ ] Add cite link to EmbedFooter
- [ ] Add `Cmd/Ctrl+Shift+C` keyboard shortcut
- [ ] Track citation copies in analytics (if applicable)

**Testable Outcome:** Citation panel accessible from all entry points.

### Phase 4: Export Enhancements
- [ ] Add citation headers to CSV exports
- [ ] Add citation block to JSON exports
- [ ] Add attribution line to share cards
- [ ] Add `v=1` to share URLs for versioning

**Testable Outcome:** All exports include proper attribution; share cards show data source.

### Phase 5: Polish & Documentation
- [ ] Add methodology notes page/section (optional)
- [ ] Document URL stability commitment
- [ ] Add "How to Cite" to help/about section
- [ ] Test with screen readers for accessibility

**Testable Outcome:** Complete, accessible, documented citation system.

---

## Data Requirements

### Indicator Metadata Enhancements

Current `indicators` table has:
- `source` (e.g., "World Bank")
- `source_code` (e.g., "NY.GDP.PCAP.PP.KD")

**Consider adding:**
- `source_url` - Direct link template
- `data_vintage` - Last data update date
- `license` - Data license type

These can be derived at runtime initially, then migrated to DB if needed.

---

## Accessibility Considerations

- All citation text in `<code>` or `<pre>` with proper `aria-label`
- Copy buttons announce success via `aria-live` region
- Format tabs keyboard navigable with arrow keys
- Focus management when panel opens/closes
- High contrast for code blocks in both light/dark modes

---

## Testing Criteria

### Unit Tests
- [ ] Each citation format generates valid output
- [ ] Special characters escaped properly (& in BibTeX, etc.)
- [ ] Date formatting correct for each style
- [ ] URL encoding handled correctly

### Integration Tests
- [ ] Citation panel opens from all entry points
- [ ] Copy to clipboard works in all browsers
- [ ] Format switching preserves scroll position
- [ ] Panel closes on ESC and click-outside

### Visual Tests
- [ ] Panel renders correctly at 320px, 768px, 1440px
- [ ] Light and dark mode styling correct
- [ ] Code blocks readable and scrollable
- [ ] Attribution on share cards legible

### Accessibility Tests
- [ ] Screen reader announces panel content
- [ ] Keyboard-only navigation works
- [ ] Focus trapped in modal when open
- [ ] WCAG AA contrast ratios met

---

## Success Metrics

- **Citation copies:** Number of times citation is copied
- **Format preference:** Which format is most popular
- **Entry point usage:** Where users access citations from
- **Academic mentions:** Tracked via alerts/search

---

## Future Enhancements (Out of Scope)

- DOI registration for specific comparisons
- Short URL service (convergence.example.com/c/abc123)
- Citation export to reference managers (Zotero, Mendeley)
- QR code on share cards linking to full citation
- Methodology documentation page with equations

---

## Notes

- Keep citations concise—academics know how to expand them
- BibTeX key format: `convergenceexplorer{year}` for tool, `{source}{year}{indicator}` for data
- Consider caching generated citations if performance becomes an issue
- URL versioning (`v=1`) provides future flexibility for schema changes

---

## What's Next

After completing Feature 8, the natural progression is:
- **Feature 5 (Thread Generator):** Can include citation in thread captions
- **Feature 3 (Historical Counterfactuals):** Will need citations for Maddison/Penn World Table data sources
