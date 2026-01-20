# Mountain to Climb - Feature Improvements

Planned enhancements organized by category with implementation details.

---

## Multiple Comparisons (Discoverable)

### 1. "+ Add Chaser" Button

**Concept**: After making an initial comparison, a subtle "+ Add country" button appears, allowing users to add 2-3 additional chasers racing toward the same target.

**UI/UX**:
- Button appears below the chaser selector after data loads
- Muted style: ghost button with dashed border, "+" icon
- On click: adds another CountrySelector row (max 4 chasers total)
- Each additional chaser gets a unique color from an extended palette
- "×" button to remove added chasers
- Chart legend expands to show all chasers

**Data Model Changes**:
```typescript
// Current
chaserIso: string
chaserGrowthRate: number

// New
chasers: Array<{
  iso: string;
  growthRate: number;
  color: string;
}>
```

**URL Schema**:
```
?chasers=NGA,KEN,GHA&target=IRL&cg=0.035,0.04,0.03&...
```

**Files to Modify**:
- `App.tsx` - state management for multiple chasers
- `shareState.ts` - URL parsing/serialization for arrays
- `useConvergence.ts` - calculate projections for multiple chasers
- `ConvergenceChart.tsx` - render multiple lines with legend
- `ResultSummary.tsx` - show comparison table for all chasers
- `GrowthRateControls.tsx` - sliders for each chaser

**Color Palette Extension**:
```typescript
const CHASER_COLORS = [
  { name: "terracotta", hex: "#c2410c" },  // Original
  { name: "indigo", hex: "#4f46e5" },
  { name: "rose", hex: "#e11d48" },
  { name: "amber", hex: "#d97706" },
];
```

**Implementation Order**:
1. Update data model and state
2. Update URL schema
3. Add UI for adding/removing chasers
4. Update chart to render multiple lines
5. Update summary and controls

---

### 2. Preset Bundles

**Concept**: Curated comparison groups accessible via dropdown, showcasing interesting economic narratives.

**Preset Data**:
```typescript
interface ComparisonPreset {
  id: string;
  label: string;
  description: string;
  target: string;
  chasers: string[];
  indicator: string;
  suggestedGrowthRates?: Record<string, number>;
}

const PRESETS: ComparisonPreset[] = [
  {
    id: "brics-usa",
    label: "BRICS vs USA",
    description: "Emerging economies chasing the world's largest",
    target: "USA",
    chasers: ["BRA", "RUS", "IND", "CHN", "ZAF"],
    indicator: "GDP_PCAP_PPP",
  },
  {
    id: "east-africa-korea",
    label: "East Africa vs South Korea",
    description: "Can East Africa replicate the Korean miracle?",
    target: "KOR",
    chasers: ["KEN", "TZA", "UGA", "RWA"],
    indicator: "GDP_PCAP_PPP",
  },
  {
    id: "eu-candidates",
    label: "EU Candidates vs Germany",
    description: "Convergence path for EU accession candidates",
    target: "DEU",
    chasers: ["UKR", "MDA", "GEO", "SRB"],
    indicator: "GDP_PCAP_PPP",
  },
  {
    id: "southeast-asia-japan",
    label: "Southeast Asia vs Japan",
    description: "ASEAN tigers on the development path",
    target: "JPN",
    chasers: ["VNM", "THA", "IDN", "PHL"],
    indicator: "GDP_PCAP_PPP",
  },
  {
    id: "latin-america-spain",
    label: "Latin America vs Spain",
    description: "Former colonies vs former colonizer",
    target: "ESP",
    chasers: ["MEX", "COL", "PER", "CHL"],
    indicator: "GDP_PCAP_PPP",
  },
];
```

**UI/UX**:
- Dropdown in header area or near selectors: "Try a preset..."
- Each preset shows label + short description
- Selecting a preset populates all fields and navigates
- "Customize" appears after loading preset

**Files to Create**:
- `lib/presets.ts` - preset definitions
- `components/PresetSelector.tsx` - dropdown UI

**Files to Modify**:
- `App.tsx` - handler to apply preset

---

### 3. "Compare with Neighbors"

**Concept**: One-click action to add regional peers to the current chaser.

**Data Requirements**:
```typescript
// In a new file: lib/regions.ts
interface RegionData {
  code: string;
  name: string;
  countries: string[]; // ISO3 codes
}

const REGIONS: RegionData[] = [
  { code: "WEST_AFRICA", name: "West Africa", countries: ["NGA", "GHA", "SEN", "CIV", "MLI", ...] },
  { code: "EAST_AFRICA", name: "East Africa", countries: ["KEN", "TZA", "UGA", "RWA", "ETH", ...] },
  { code: "SOUTHERN_AFRICA", name: "Southern Africa", countries: ["ZAF", "BWA", "NAM", "ZMB", ...] },
  { code: "SOUTHEAST_ASIA", name: "Southeast Asia", countries: ["VNM", "THA", "IDN", "PHL", "MYS", ...] },
  { code: "SOUTH_ASIA", name: "South Asia", countries: ["IND", "PAK", "BGD", "LKA", "NPL", ...] },
  { code: "CENTRAL_AMERICA", name: "Central America", countries: ["MEX", "GTM", "HND", "SLV", ...] },
  { code: "SOUTH_AMERICA", name: "South America", countries: ["BRA", "ARG", "COL", "PER", "CHL", ...] },
  { code: "EASTERN_EUROPE", name: "Eastern Europe", countries: ["POL", "UKR", "ROU", "HUN", "CZE", ...] },
  { code: "MIDDLE_EAST", name: "Middle East", countries: ["SAU", "ARE", "ISR", "TUR", "IRN", ...] },
  // ... etc
];

function getRegionForCountry(iso: string): RegionData | null
function getNeighbors(iso: string, limit?: number): string[]
```

**UI/UX**:
- Small link/button near chaser selector: "Compare with neighbors"
- On click: identifies region, adds top 3-4 peers (excluding target)
- Tooltip explains what it does on hover

**Implementation**:
1. Create `lib/regions.ts` with region mapping
2. Add "Compare with neighbors" button to UI
3. Wire to multi-chaser functionality

---

## Additional Data

### 1. "What Growth Rate Needed?" Calculator

**Concept**: Reverse calculator showing required growth rate to catch up within a specified timeframe.

**Math**:
```typescript
// To find required chaser growth rate to converge in Y years:
// chaserValue * (1 + cg)^Y = targetValue * (1 + tg)^Y
//
// Solving for cg:
// cg = ((targetValue / chaserValue) * (1 + tg)^Y)^(1/Y) - 1

function calculateRequiredGrowthRate(
  chaserValue: number,
  targetValue: number,
  targetGrowthRate: number,
  yearsToConverge: number
): number {
  const ratio = targetValue / chaserValue;
  const targetMultiplier = Math.pow(1 + targetGrowthRate, yearsToConverge);
  const requiredMultiplier = ratio * targetMultiplier;
  return Math.pow(requiredMultiplier, 1 / yearsToConverge) - 1;
}
```

**UI/UX**:
- New section below ResultSummary or in sidebar
- Input: "Catch up in ___ years" (slider or input, default: 25)
- Output: "Nigeria would need 8.2% annual growth"
- Visual indicator comparing to historical growth rates
- Color coding: green (achievable), amber (ambitious), red (unprecedented)

**Historical Context**:
```typescript
const GROWTH_BENCHMARKS = {
  unprecedented: 0.10,    // >10% - very rare, China peak
  exceptional: 0.07,      // 7-10% - Asian tigers
  strong: 0.05,           // 5-7% - good developing economy
  moderate: 0.03,         // 3-5% - typical
  slow: 0.02,             // <3% - developed economy typical
};
```

**Files to Create**:
- `components/GrowthCalculator.tsx`
- `lib/growthBenchmarks.ts`

**Files to Modify**:
- `App.tsx` - add component to layout
- `useConvergence.ts` - add reverse calculation

---

### 2. Milestone Markers

**Concept**: Visual markers on chart showing when chaser reaches 25%, 50%, 75% of target's value.

**Implementation**:
```typescript
interface Milestone {
  percentage: number;
  year: number;
  chaserValue: number;
  targetValue: number;
}

function calculateMilestones(
  projection: ProjectionPoint[],
  milestonePercentages: number[] = [0.25, 0.5, 0.75]
): Milestone[]
```

**Chart Visualization**:
- Small diamond or circle markers on chaser line at milestone points
- Horizontal dashed lines from target line to show the threshold
- Tooltip on hover: "Nigeria reaches 50% of Ireland's GDP in 2045"
- Optional: celebration animation when milestone is recent

**UI Options**:
- Toggle to show/hide milestones
- Milestones listed in summary: "Milestones: 25% (2030), 50% (2048), 75% (2067)"

**Files to Modify**:
- `useConvergence.ts` - calculate milestones
- `ConvergenceChart.tsx` - render milestone markers
- `ResultSummary.tsx` - list milestones in text

---

### 3. Alternative Indicators

**Concept**: Expand beyond GDP to include other development metrics.

**New Indicators**:
```typescript
const INDICATORS = [
  // Economic (existing)
  { code: "GDP_PCAP_PPP", name: "GDP per capita (PPP)", unit: "$", category: "Economic" },
  { code: "GDP_PCAP_USD", name: "GDP per capita (USD)", unit: "$", category: "Economic" },

  // Human Development
  { code: "HDI", name: "Human Development Index", unit: null, category: "Development" },
  { code: "LIFE_EXP", name: "Life Expectancy", unit: "years", category: "Health" },
  { code: "INFANT_MORT", name: "Infant Mortality Rate", unit: "per 1,000", category: "Health", inverted: true },

  // Education
  { code: "LITERACY", name: "Literacy Rate", unit: "%", category: "Education" },
  { code: "SCHOOL_YEARS", name: "Mean Years of Schooling", unit: "years", category: "Education" },

  // Infrastructure
  { code: "INTERNET", name: "Internet Penetration", unit: "%", category: "Infrastructure" },
  { code: "ELECTRICITY", name: "Electricity Access", unit: "%", category: "Infrastructure" },
];
```

**Data Sources**:
- World Bank API (existing)
- UN Human Development Reports
- WHO Global Health Observatory

**UI Changes**:
- MetricSelector grouped by category
- Category tabs or accordion
- "Popular" section with most-used metrics

**Special Handling**:
- Some metrics are "inverted" (lower is better, e.g., infant mortality)
- Some have natural caps (100% for percentages)
- Adjust convergence logic for inverted metrics

**Files to Modify**:
- `hooks/useIndicators.ts` - fetch additional indicators
- `components/MetricSelector.tsx` - grouped display
- `useConvergence.ts` - handle inverted metrics

---

### 4. Total GDP Toggle (Population Adjusted)

**Concept**: Toggle between per-capita and total GDP views.

**Implementation**:
```typescript
// New state
const [perCapita, setPerCapita] = useState(true);

// Calculation
const displayValue = perCapita
  ? gdpPerCapita
  : gdpPerCapita * population;
```

**UI/UX**:
- Toggle switch near metric selector: "Per capita / Total"
- Automatic label updates: "$23,400" vs "$5.2 trillion"
- Chart Y-axis adjusts accordingly

**Data Requirements**:
- Population data for each country (available from World Bank)
- Cache population alongside GDP data

**Files to Modify**:
- `useCountryData.ts` - fetch population data
- `App.tsx` - toggle state
- `lib/convergence.ts` - formatting for large numbers (trillions)

---

## Virality Features

### 1. Animated "Race" Mode

**Concept**: Play button that animates the projection lines growing year by year, creating a shareable "race" visualization.

**Implementation**:
```typescript
interface RaceState {
  isPlaying: boolean;
  currentYear: number;
  speed: number; // years per second
}

function useRaceAnimation(
  projection: ProjectionPoint[],
  options: { speed?: number; onComplete?: () => void }
) {
  const [state, setState] = useState<RaceState>({ ... });

  // Animation loop using requestAnimationFrame
  // Progressively reveal projection data up to currentYear
  // Fire confetti or celebration when convergence reached
}
```

**UI/UX**:
- Play/pause button below or on chart
- Speed controls: 1x, 2x, 4x
- Progress bar showing timeline
- Year counter display during animation
- Celebration animation at convergence (confetti, flash, sound?)
- "Share this race" button after animation completes

**Chart Changes**:
- Lines draw progressively up to current animation year
- Smooth interpolation between years
- Optional: trailing glow effect on line ends

**Shareable Output**:
- Generate GIF or short video of the race
- Or: share link with `?autoplay=1` parameter

**Files to Create**:
- `hooks/useRaceAnimation.ts`
- `components/RaceControls.tsx`

**Files to Modify**:
- `ConvergenceChart.tsx` - support partial rendering
- `ConvergenceChartInteractive.tsx` - integrate race mode

---

### 2. Headline Generator

**Concept**: Auto-generate shareable, tweet-ready text summarizing the comparison.

**Templates**:
```typescript
const HEADLINE_TEMPLATES = [
  // Convergence scenarios
  "At current growth rates, {chaser} catches {target} in {years} years ({convergenceYear})",
  "🏔️ {chaser}'s mountain to climb: {gap}x gap with {target}, closing in {years} years",
  "{chaser} → {target}: {years} years at {chaserGrowth}% growth",

  // No convergence
  "At {chaserGrowth}% vs {targetGrowth}%, {chaser} won't catch {target}",
  "The gap widens: {chaser} falls further behind {target} at current rates",

  // Already ahead
  "{chaser} is already ahead of {target} in {metric}!",

  // Multi-chaser
  "Race to {target}: {chaser1} ({years1}y), {chaser2} ({years2}y), {chaser3} ({years3}y)",
];

function generateHeadline(data: ComparisonData): string {
  // Select appropriate template based on scenario
  // Fill in values
  // Add relevant emoji
}
```

**UI/UX**:
- "Share" section with generated headline
- One-click copy button
- Twitter/X share button with pre-filled text
- LinkedIn share button
- Option to customize before sharing

**Character Limits**:
- Twitter: 280 chars
- LinkedIn: longer form available
- Generate both short and long versions

**Files to Create**:
- `lib/headlineGenerator.ts`
- `components/ShareHeadline.tsx`

---

### 3. Embeddable Widget

**Concept**: Provide `<iframe>` code for embedding the chart in blogs and articles.

**Implementation**:

**Embed Route**:
```typescript
// New route: /embed?chaser=NGA&target=IRL&...
// Renders minimal UI: just the chart with small attribution
```

**Embed Page Features**:
- Minimal chrome: chart only, small "Mountain to Climb" attribution
- Responsive sizing
- Click anywhere opens full site in new tab
- Optional: interactive vs static mode

**Embed Code Generator**:
```html
<iframe
  src="https://mountain.example.com/embed?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP"
  width="600"
  height="400"
  frameborder="0"
  title="Nigeria vs Ireland GDP Convergence"
></iframe>
```

**UI/UX**:
- "Embed" button in share menu
- Preview of embedded widget
- Customization options: size, theme
- Copy code button

**Files to Create**:
- `pages/Embed.tsx` or `routes/embed.tsx`
- `components/EmbedCodeGenerator.tsx`

**Files to Modify**:
- Router configuration
- `ShareMenu.tsx` - add embed option

---

## Quick UX Wins

### 1. Swap Button

**Concept**: Single click to swap chaser and target countries.

**Implementation**:
```typescript
const handleSwap = useCallback(() => {
  const tempChaser = chaserIso;
  const tempChaserRate = chaserGrowthRate;

  setChaserIso(targetIso);
  setTargetIso(tempChaser);
  setChaserGrowthRate(targetGrowthRate);
  setTargetGrowthRate(tempChaserRate);
}, [chaserIso, targetIso, chaserGrowthRate, targetGrowthRate]);
```

**UI/UX**:
- Button between chaser and target selectors
- Icon: ⇄ or swap arrows
- Subtle animation on swap
- Tooltip: "Swap chaser and target"

**Files to Modify**:
- `App.tsx` - add swap handler and button

**Estimated Effort**: 30 minutes

---

### 2. "Surprise Me"

**Concept**: Random comparison generator for discovery and engagement.

**Implementation**:
```typescript
interface InterestingPair {
  chaser: string;
  target: string;
  reason: string; // "Historic rivals", "Same continent", "Similar population"
}

const INTERESTING_PAIRS: InterestingPair[] = [
  { chaser: "VNM", target: "KOR", reason: "Following the Korean path?" },
  { chaser: "NGA", target: "IND", reason: "Population giants" },
  { chaser: "POL", target: "DEU", reason: "European neighbors" },
  { chaser: "MEX", target: "USA", reason: "NAFTA partners" },
  { chaser: "ETH", target: "CHN", reason: "New manufacturing hub?" },
  // ... 50+ curated pairs
];

function getRandomComparison(): InterestingPair {
  return INTERESTING_PAIRS[Math.floor(Math.random() * INTERESTING_PAIRS.length)];
}
```

**UI/UX**:
- Dice icon button in header or near selectors
- On click: animates briefly, then loads new comparison
- Shows the "reason" as a brief toast or subtitle
- "Another!" link to keep exploring

**Files to Create**:
- `lib/interestingPairs.ts`

**Files to Modify**:
- `App.tsx` - add button and handler

**Estimated Effort**: 1-2 hours

---

### 3. Type-to-Search Countries

**Concept**: Replace or enhance dropdown with searchable input.

**Current**: Select dropdown requires scrolling through 200+ countries.

**New Behavior**:
- Click selector → opens searchable dropdown
- Type to filter: "nig" shows Nigeria, Niger
- Keyboard navigation: arrow keys + enter to select
- Recent selections shown at top
- Grouped by region or alphabetical

**Implementation Options**:

**Option A: Combobox Pattern**
```typescript
// Using headless UI or custom implementation
<Combobox value={selected} onChange={setSelected}>
  <Combobox.Input onChange={(e) => setQuery(e.target.value)} />
  <Combobox.Options>
    {filteredCountries.map((country) => (
      <Combobox.Option key={country.iso} value={country.iso}>
        {country.name}
      </Combobox.Option>
    ))}
  </Combobox.Options>
</Combobox>
```

**Option B: Command Palette Style**
- ⌘K or "/" to open global search
- Search countries, indicators, presets all in one
- More discoverable features

**Files to Modify**:
- `components/CountrySelector.tsx` - replace or enhance

**Dependencies**:
- Consider: `@headlessui/react` Combobox, `cmdk`, or custom

**Estimated Effort**: 2-4 hours

---

### 4. Keyboard Shortcuts

**Concept**: Power-user keyboard navigation for quick adjustments.

**Shortcuts**:
```typescript
const SHORTCUTS = {
  // Growth rate adjustments
  "ArrowUp": "Increase chaser growth +0.5%",
  "ArrowDown": "Decrease chaser growth -0.5%",
  "Shift+ArrowUp": "Increase target growth +0.5%",
  "Shift+ArrowDown": "Decrease target growth -0.5%",

  // Navigation
  "s": "Swap chaser and target",
  "r": "Random comparison (Surprise me)",
  "c": "Focus chaser selector",
  "t": "Focus target selector",

  // View
  "v": "Toggle chart/table view",
  "d": "Toggle dark mode",
  "?": "Show keyboard shortcuts",

  // Sharing
  "Cmd+c": "Copy share link",
};
```

**Implementation**:
```typescript
// Global keyboard handler
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    // Ignore if typing in input
    if (e.target instanceof HTMLInputElement) return;

    switch (e.key) {
      case "s":
        handleSwap();
        break;
      case "ArrowUp":
        if (!e.shiftKey) {
          setChaserGrowthRate(r => Math.min(r + 0.005, 0.15));
        } else {
          setTargetGrowthRate(r => Math.min(r + 0.005, 0.15));
        }
        break;
      // ... etc
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);
```

**UI/UX**:
- "?" opens shortcuts modal/overlay
- Shortcuts shown in tooltips
- Visual feedback when shortcut activated

**Files to Create**:
- `hooks/useKeyboardShortcuts.ts`
- `components/ShortcutsModal.tsx`

**Files to Modify**:
- `App.tsx` - integrate keyboard handler

**Estimated Effort**: 2-3 hours

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. ✅ Swap button
2. ✅ Type-to-search countries
3. ✅ Keyboard shortcuts
4. ✅ Headline generator

### Phase 2: Depth (3-5 days)
1. "What growth rate needed?" calculator
2. Milestone markers on chart
3. "Surprise me" with curated pairs

### Phase 3: Multiple Comparisons (1 week)
1. Multi-chaser data model and URL schema
2. Multi-line chart rendering
3. "+ Add chaser" UI
4. Preset bundles
5. "Compare with neighbors"

### Phase 4: Virality (1 week)
1. Animated race mode
2. Embeddable widget
3. Alternative indicators

### Phase 5: Polish
1. Total GDP toggle
2. Additional presets
3. Performance optimization for multi-chaser

---

## Technical Considerations

### State Management
- Current: useState in App.tsx
- Consider: Zustand for complex multi-chaser state
- URL sync becomes more complex with arrays

### Performance
- Multi-chaser projections: memoize heavily
- Chart rendering: consider canvas for many lines
- Bundle size: lazy load embed/share features

### Testing
- Unit tests for convergence calculations
- E2E tests for multi-chaser flows
- Visual regression for chart changes
