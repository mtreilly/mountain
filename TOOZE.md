# TOOZE.md - Viral Features Roadmap

> Making Convergence Explorer irresistible to academic economists and econ Twitter

## Overview

Ten features designed to maximize shareability among heavy Twitter users in the academic economics space (Adam Tooze, Noah Smith, Matt Yglesias, Branko Milanovic, etc.).

---

## Feature 1: One-Click Share Cards

**Goal:** Generate Twitter/X-optimized images that look professional and spread organically.

**Scope:**
- Canvas-based chart screenshot generation
- Clean typography overlay with key stat headline
- Subtle watermark/branding with tool URL
- Dark mode and light mode variants
- Optimized dimensions for Twitter (1200x675) and LinkedIn (1200x627)
- "Copy to clipboard" and "Download PNG" options

**Key Deliverable:** User clicks "Share" → gets a ready-to-post image with the insight baked in.

**Dependencies:** None (can start immediately)

**Complexity:** Medium

---

## Feature 2: Pre-built "Hot Take" Scenarios

**Goal:** Lower the barrier to engagement with curated, debate-sparking comparisons.

**Scope:**
- Scenarios gallery/landing page
- Categories: Geopolitical, Historical, Regional, Provocative
- Example scenarios:
  - "When will China's GDP/capita match the US?"
  - "India vs China: The race to middle-income"
  - "Eastern Europe → Western EU convergence"
  - "Post-Soviet divergence: Baltics vs Central Asia"
  - "The Great Divergence reversed? Africa scenarios"
  - "Tiger economies: Who's next?"
  - "Latin America's lost decades"
  - "BRICS convergence with G7"
- Each scenario has a short editorial blurb explaining why it matters
- One-click load into the main tool

**Key Deliverable:** A "Scenarios" page that drives exploration and sharing.

**Dependencies:** None

**Data Note:** Scenarios use forward projections from current data (World Bank 1990-2023). Historical context in the "Historical" category is provided via editorial descriptions, not historical data visualization. For actual historical trajectory charts, see Feature 3.

**Linkage to Feature 3 (Historical Counterfactuals):**
> The `Scenario` data structure is designed to be extended for Feature 3. Historical scenarios can be upgraded with actual pre-1990 data visualization once Maddison Project data is integrated. See `FEATURE2-SCENARIOS-plan.md` for detailed integration plan.

**Complexity:** Low-Medium

---

## Feature 3: Historical Counterfactuals

**Goal:** Enable "what if" analysis that historians and economists love to debate.

**Scope:**
- "What if [Country A] had grown at [Country B]'s rate since [Year]?"
- Counterfactual projection line overlaid on actual trajectory
- Historical event markers on timeline:
  - Oil shocks (1973, 1979, 2008)
  - Financial crises (1997 Asian, 2008 GFC, 2020 COVID)
  - Political transitions (Fall of USSR, China WTO entry, Brexit)
  - Wars and conflicts
- "Projection accuracy" mode: show what IMF/World Bank predicted vs reality
- Toggle between actual and counterfactual views

**Key Deliverable:** Rich historical context that invites scholarly engagement.

**Dependencies:**
- Additional historical events dataset
- **Extended historical data** (current World Bank data is 1990-2023 only)
  - Maddison Project Database (1820-2018) for long-run GDP comparisons
  - Penn World Table (1950-2019) for detailed economic indicators

**Linkage to Feature 2 (Scenarios):**
> Feature 2's "historical" category scenarios provide editorial context about pre-1990 history. Feature 3 would upgrade these with actual historical data visualization. The `Scenario` interface from Feature 2 can be extended to support historical fields. See `FEATURE2-SCENARIOS-plan.md` → "Linked Feature" section for integration details.

**Complexity:** Medium-High

---

## Feature 4: Embed Mode

**Goal:** Let bloggers, journalists, and Substack writers embed live charts.

**Scope:**
- `?embed=true` URL parameter
- Minimal chrome: chart only, small attribution footer
- Responsive iframe sizing
- Optional interactivity toggle (`?embed=true&interactive=false` for static)
- Embed code generator in UI: `<iframe src="..." />`
- Works in:
  - Substack
  - WordPress
  - Ghost
  - Medium (via image fallback)
  - Notion

**Key Deliverable:** Copy-paste embed code that "just works" in popular platforms.

**Dependencies:** Feature 1 (for image fallback on platforms that don't support iframes)

**Complexity:** Medium

---

## Feature 5: Thread Generator

**Goal:** Export a complete Twitter thread package with multiple charts and captions.

**Scope:**
- Multi-image export sequence:
  1. Main convergence chart with headline stat
  2. Sensitivity analysis: "What if growth is ±1%?"
  3. Historical context: "Where they started"
  4. Key implications summary card
- Auto-generated caption suggestions for each image
- Thread preview in-app
- Export as ZIP (images + captions.txt)
- Optional: Direct Twitter/X integration (if API accessible)

**Key Deliverable:** User can go from insight to published thread in under 2 minutes.

**Dependencies:** Feature 1 (share card generation)

**Complexity:** Medium-High

---

## Feature 6: Inequality/Distribution Overlays

**Goal:** Add depth that serious economists demand.

**Scope:**
- New metrics to add:
  - Gini coefficient
  - Income share of top 10% / bottom 50%
  - Median income (not just mean GDP/capita)
  - Poverty headcount ratio
- Data sources: World Bank, WID (World Inequality Database)
- Dual-axis or overlay visualization options
- "Beyond GDP" mode that emphasizes welfare metrics
- Comparison tooltips: "GDP grew 50%, but median income only grew 20%"

**Key Deliverable:** Nuanced visualizations that tell the inequality story.

**Dependencies:** WID data integration

**Complexity:** High

---

## Feature 7: Climate-Economy Nexus

**Goal:** Connect to the energy transition discourse that dominates econ Twitter.

**Scope:**
- New metrics:
  - CO2 emissions per capita
  - CO2 intensity of GDP (emissions per $ output)
  - Renewable energy share
  - Energy consumption per capita
- "Green growth" scenario toggle:
  - Baseline (historical trends)
  - Paris-aligned trajectory
  - Net-zero by 2050 scenario
- Decoupling visualization: GDP growth vs emissions growth
- Carbon convergence: "When will India's per-capita emissions match the EU's?"

**Key Deliverable:** Tool becomes relevant to climate economics discussions.

**Dependencies:** Climate data sources (Our World in Data, IEA)

**Complexity:** High

---

## Feature 8: Citation-Ready Exports

**Goal:** Make the tool academically credible and easy to reference.

**Scope:**
- "Cite this" button generating:
  - BibTeX entry
  - APA format
  - Chicago format
  - Plain text
- Data source attribution panel:
  - World Bank indicator codes
  - Data vintage/last updated date
  - Methodology notes
- Footnote-style annotations on exported charts
- DOI or permanent URL scheme for specific comparisons
- License clarity (CC-BY for generated visualizations?)

**Key Deliverable:** Academics can cite the tool in papers without hesitation.

**Dependencies:** Stable URL scheme

**Complexity:** Low-Medium

---

## Feature 9: Provocative Default Landing States

**Goal:** Hook visitors immediately with a compelling comparison.

**Scope:**
- "Comparison of the week" rotation system
- Editorial curation: pick comparisons tied to current news
- A/B testing different defaults for engagement
- Seasonal/topical awareness:
  - Davos week: inequality comparisons
  - COP meetings: climate metrics
  - IMF/World Bank meetings: development comparisons
- "Trending comparisons" section showing what others are exploring
- Newsletter-style "This week in convergence" (optional, future)

**Key Deliverable:** No one lands on a blank slate; always something interesting.

**Dependencies:** Editorial/curation process

**Complexity:** Low

---

## Feature 10: Dynamic Open Graph / Twitter Cards

**Goal:** Shared links show the actual chart in previews, not a generic logo.

**Scope:**
- Server-side (or edge) OG image generation
- URL structure: `yoursite.com/?from=India&to=China` → preview shows India vs China chart
- Meta tags:
  - `og:image` - dynamically generated chart image
  - `og:title` - "India → China: Convergence in 2067?"
  - `og:description` - Key insight summary
  - `twitter:card` - "summary_large_image"
- Edge function to generate/cache OG images
- Fallback for complex/unsupported states

**Key Deliverable:** Every shared link is a compelling visual preview.

**Dependencies:** Feature 1 (image generation logic), edge function capability

**Complexity:** Medium-High

---

## Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| 1. Share Cards | High | Medium | P0 |
| 10. OG/Twitter Cards | High | Medium-High | P0 |
| 2. Pre-built Scenarios | High | Low | P1 |
| 9. Provocative Defaults | Medium | Low | P1 |
| 4. Embed Mode | Medium | Medium | P1 |
| 8. Citation Exports | Medium | Low | P2 |
| 5. Thread Generator | High | Medium-High | P2 |
| 3. Historical Counterfactuals | High | Medium-High | P2 |
| 6. Inequality Overlays | High | High | P3 |
| 7. Climate-Economy Nexus | High | High | P3 |

### Feature Linkages

```
Feature 2 (Scenarios) ──────► Feature 3 (Historical Counterfactuals)
        │                              │
        │  Provides:                   │  Extends with:
        │  • Scenario data structure   │  • Historical data (1960+)
        │  • Gallery UI                │  • Counterfactual overlays
        │  • Editorial descriptions    │  • Event markers
        │  • Forward projections       │  • Backward trajectories
        └──────────────────────────────┘
```

**Build Order:** Feature 2 first. Its infrastructure (data structures, gallery, scenario loading) will be reused and extended by Feature 3. Historical data integration is additive.

---

## Suggested Implementation Phases

### Phase 1: Shareability Foundation (P0)
- Feature 1: Share Cards
- Feature 10: Dynamic OG/Twitter Cards

*Outcome: Every share looks professional and compelling*

### Phase 2: Discovery & Engagement (P1)
- Feature 2: Pre-built Scenarios *(foundation for Feature 3)*
- Feature 9: Provocative Defaults
- Feature 4: Embed Mode

*Outcome: Easy to explore, easy to embed, always interesting*

*Note: Feature 2 establishes the scenario infrastructure that Feature 3 will extend. See `FEATURE2-SCENARIOS-plan.md` for detailed implementation plan.*

### Phase 3: Power User Features (P2)
- Feature 8: Citation Exports
- Feature 5: Thread Generator
- Feature 3: Historical Counterfactuals *(extends Feature 2's scenario infrastructure)*

*Outcome: Academics and serious users become advocates*

*Note: Feature 3 builds on Feature 2's `Scenario` data structure and gallery UI. Historical scenarios from Phase 2 can be upgraded with actual historical data visualization. Requires Maddison Project Database integration.*

### Phase 4: Domain Expansion (P3)
- Feature 6: Inequality Overlays
- Feature 7: Climate-Economy Nexus

*Outcome: Tool becomes essential for broader economic discourse*

---

## Success Metrics

- **Shares:** Number of times share card is generated/downloaded
- **Embeds:** Unique domains embedding the tool
- **Referral traffic:** Clicks from Twitter, Substack, etc.
- **Scenario engagement:** Which pre-built scenarios get most traffic
- **Return visitors:** Users who come back to explore more
- **Academic citations:** Mentions in papers, blogs, newsletters
- **Influencer mentions:** Tweets/posts from target accounts (Tooze, etc.)

---

## Notes

- Each feature above will be expanded into a detailed `{FEATURE}-plan.md` with:
  - Technical implementation steps
  - Component/file changes
  - Data requirements
  - Testing criteria
  - Rollout strategy

- Design principle: Every feature should make sharing *easier*, not harder. Remove friction relentlessly.

- Voice/tone: The tool should feel like a trusted academic resource, not a startup growth hack. Credibility matters.
