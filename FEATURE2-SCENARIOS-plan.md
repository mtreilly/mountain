# Feature 2: Pre-built "Hot Take" Scenarios - Implementation Plan

> Curated, debate-sparking comparisons that lower the barrier to engagement

## Overview

**Goal:** Create a scenarios gallery that showcases compelling country comparisons, drives exploration, and makes the tool immediately interesting to first-time visitors.

**Key Outcome:** User lands on scenarios page → browses curated comparisons → clicks one → tool loads with that comparison ready to explore and share.

---

## Technical Context

Based on codebase analysis:

- **No React Router** - App uses URL state via `window.history.replaceState()`
- **ShareState structure** exists in `/app/src/lib/shareState.ts` - scenarios are just curated ShareState values
- **Modal patterns** established - can reference `CountryPickerModal.tsx` for accessible overlays
- **State lives in App.tsx** - all useState calls at top level, props flow down

---

## Data Structures

### Scenario Interface

```typescript
// /app/src/types/scenario.ts

export type ScenarioCategory =
  | "geopolitical"
  | "historical"
  | "regional"
  | "provocative";

export interface Scenario {
  id: string;                    // URL-safe slug: "india-vs-china"
  title: string;                 // "India vs China: The Race to Middle-Income"
  subtitle: string;              // Short hook: "Can India close the gap?"
  description: string;           // 2-3 sentence editorial blurb
  category: ScenarioCategory;

  // Core comparison state (matches ShareState)
  chaser: string;                // ISO3: "IND"
  target: string;                // ISO3: "CHN"
  indicator: string;             // "GDP_PCAP_PPP"
  chaserGrowth: number;          // 0.06 (6%)
  targetGrowth: number;          // 0.04 (4%)
  targetMode: "growing" | "static";

  // Optional overrides
  mode?: "countries" | "regions";
  chaserRegion?: string;         // For regional comparisons
  targetRegion?: string;
  implicationsTemplate?: "china" | "us" | "eu";

  // Metadata
  tags: string[];                // ["asia", "development", "brics"]
  featured?: boolean;            // Show in hero/featured section
  sortOrder?: number;            // Manual ordering within category
}
```

### Category Metadata

```typescript
// /app/src/lib/scenarioCategories.ts

export interface CategoryMeta {
  id: ScenarioCategory;
  label: string;
  description: string;
  icon: string;  // Emoji or icon identifier
}

export const SCENARIO_CATEGORIES: CategoryMeta[] = [
  {
    id: "geopolitical",
    label: "Geopolitical",
    description: "Great power rivalries and shifting global dynamics",
    icon: "🌍"
  },
  {
    id: "historical",
    label: "Historical",
    description: "Long-run convergence and divergence patterns",
    icon: "📜"
  },
  {
    id: "regional",
    label: "Regional",
    description: "Intra-continental comparisons and blocs",
    icon: "🗺️"
  },
  {
    id: "provocative",
    label: "Provocative",
    description: "Surprising comparisons that challenge assumptions",
    icon: "🔥"
  }
];
```

---

## Curated Scenarios Dataset

```typescript
// /app/src/data/scenarios.ts

import type { Scenario } from "../types/scenario";

export const SCENARIOS: Scenario[] = [
  // ═══════════════════════════════════════════════════════════════
  // GEOPOLITICAL
  // ═══════════════════════════════════════════════════════════════
  {
    id: "china-vs-usa",
    title: "When Will China's GDP/Capita Match the US?",
    subtitle: "The great convergence question",
    description: "China's rapid growth has transformed it into the world's second-largest economy. But GDP per capita tells a different story—can China close the living standards gap with America?",
    category: "geopolitical",
    chaser: "CHN",
    target: "USA",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.045,
    targetGrowth: 0.018,
    targetMode: "growing",
    implicationsTemplate: "us",
    tags: ["great-powers", "us-china", "development"],
    featured: true,
    sortOrder: 1
  },
  {
    id: "india-vs-china",
    title: "India vs China: The Race to Middle-Income",
    subtitle: "Can India follow China's path?",
    description: "India is now the world's most populous country. With China's growth slowing, can India's trajectory mirror the Chinese miracle—or will it chart its own course?",
    category: "geopolitical",
    chaser: "IND",
    target: "CHN",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.06,
    targetGrowth: 0.04,
    targetMode: "growing",
    implicationsTemplate: "china",
    tags: ["asia", "development", "brics", "demographics"],
    featured: true,
    sortOrder: 2
  },
  {
    id: "brics-vs-g7-avg",
    title: "BRICS Convergence with G7",
    subtitle: "The emerging market catch-up",
    description: "The BRICS nations represent a challenge to Western economic dominance. Track how these economies are closing the gap with the developed world.",
    category: "geopolitical",
    chaser: "BRA",  // Use Brazil as BRICS representative
    target: "DEU",  // Germany as G7 representative
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.025,
    targetGrowth: 0.012,
    targetMode: "growing",
    tags: ["brics", "g7", "global-order"],
    sortOrder: 3
  },
  {
    id: "russia-stagnation",
    title: "Russia's Lost Decades",
    subtitle: "From superpower to stagnation",
    description: "Once a rival superpower, Russia's economic trajectory has diverged sharply from the West. Explore the widening gap since the Soviet collapse.",
    category: "geopolitical",
    chaser: "RUS",
    target: "DEU",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.015,
    targetGrowth: 0.012,
    targetMode: "growing",
    tags: ["europe", "post-soviet", "stagnation"],
    sortOrder: 4
  },

  // ═══════════════════════════════════════════════════════════════
  // HISTORICAL
  // ═══════════════════════════════════════════════════════════════
  {
    id: "korea-miracle",
    title: "South Korea: From War to Wealth",
    subtitle: "The original tiger economy",
    description: "In 1960, South Korea was poorer than many African nations. Today it rivals Japan. One of history's most dramatic convergence stories.",
    category: "historical",
    chaser: "KOR",
    target: "JPN",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.025,
    targetGrowth: 0.008,
    targetMode: "growing",
    tags: ["asia", "tigers", "miracle-growth"],
    featured: true,
    sortOrder: 1
  },
  {
    id: "ireland-transformation",
    title: "Ireland: The Celtic Tiger",
    subtitle: "From emigration to immigration",
    description: "Ireland went from one of Western Europe's poorest nations to one of its richest in a single generation. A story of policy, luck, and timing.",
    category: "historical",
    chaser: "IRL",
    target: "GBR",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.035,
    targetGrowth: 0.012,
    targetMode: "growing",
    tags: ["europe", "celtic-tiger", "convergence"],
    sortOrder: 2
  },
  {
    id: "post-soviet-baltics",
    title: "Baltic Tigers vs Post-Soviet Stagnation",
    subtitle: "The great post-1991 divergence",
    description: "Estonia, Latvia, and Lithuania chose a different path than their former Soviet peers. The results speak for themselves.",
    category: "historical",
    chaser: "EST",
    target: "POL",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.03,
    targetGrowth: 0.035,
    targetMode: "growing",
    tags: ["post-soviet", "baltics", "transition"],
    sortOrder: 3
  },
  {
    id: "argentina-decline",
    title: "Argentina: A Century of Decline",
    subtitle: "From top 10 to emerging market",
    description: "In 1900, Argentina was among the world's richest nations. What happened? A cautionary tale of policy failures and missed opportunities.",
    category: "historical",
    chaser: "ARG",
    target: "AUS",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.01,
    targetGrowth: 0.018,
    targetMode: "growing",
    tags: ["latin-america", "decline", "policy-failure"],
    sortOrder: 4
  },
  {
    id: "japan-stagnation",
    title: "Japan's Lost Decades",
    subtitle: "From miracle to stagnation",
    description: "Japan was supposed to overtake America. Instead came the bubble burst and 30 years of stagnation. Will China follow the same path?",
    category: "historical",
    chaser: "JPN",
    target: "USA",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.008,
    targetGrowth: 0.018,
    targetMode: "growing",
    tags: ["asia", "stagnation", "demographics"],
    sortOrder: 5
  },

  // ═══════════════════════════════════════════════════════════════
  // REGIONAL
  // ═══════════════════════════════════════════════════════════════
  {
    id: "eastern-western-europe",
    title: "Eastern Europe → Western EU Convergence",
    subtitle: "The EU accession dividend",
    description: "Since joining the EU, Eastern European nations have been catching up with their Western neighbors. How long until they reach parity?",
    category: "regional",
    chaser: "POL",
    target: "DEU",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.035,
    targetGrowth: 0.012,
    targetMode: "growing",
    implicationsTemplate: "eu",
    tags: ["europe", "eu", "convergence"],
    featured: true,
    sortOrder: 1
  },
  {
    id: "southeast-asia-tigers",
    title: "Southeast Asia's New Tigers",
    subtitle: "Vietnam, Indonesia, and the next wave",
    description: "Vietnam and Indonesia are following the path blazed by Korea and Taiwan. Are they the next Asian tigers?",
    category: "regional",
    chaser: "VNM",
    target: "THA",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.055,
    targetGrowth: 0.03,
    targetMode: "growing",
    tags: ["asia", "tigers", "manufacturing"],
    sortOrder: 2
  },
  {
    id: "latin-america-divergence",
    title: "Latin America's Lost Decades",
    subtitle: "Chile pulls ahead, others stagnate",
    description: "Chile has become Latin America's success story while others struggle. What explains the divergence within the region?",
    category: "regional",
    chaser: "BRA",
    target: "CHL",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.02,
    targetGrowth: 0.025,
    targetMode: "growing",
    tags: ["latin-america", "divergence"],
    sortOrder: 3
  },
  {
    id: "africa-rising",
    title: "Africa Rising: Ethiopia vs Kenya",
    subtitle: "The new growth frontiers",
    description: "Ethiopia and Kenya represent different models of African development. Which approach will win in the long run?",
    category: "regional",
    chaser: "ETH",
    target: "KEN",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.065,
    targetGrowth: 0.045,
    targetMode: "growing",
    tags: ["africa", "development", "frontier"],
    sortOrder: 4
  },
  {
    id: "gulf-diversification",
    title: "Gulf States: Beyond Oil",
    subtitle: "UAE vs Saudi diversification race",
    description: "The Gulf states are racing to diversify before oil runs out. Compare their paths to a post-carbon future.",
    category: "regional",
    chaser: "SAU",
    target: "ARE",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.025,
    targetGrowth: 0.03,
    targetMode: "growing",
    tags: ["middle-east", "oil", "diversification"],
    sortOrder: 5
  },

  // ═══════════════════════════════════════════════════════════════
  // PROVOCATIVE
  // ═══════════════════════════════════════════════════════════════
  {
    id: "nigeria-vs-indonesia",
    title: "Nigeria vs Indonesia: Tale of Two Giants",
    subtitle: "Same population, different trajectories",
    description: "Both countries have 270+ million people. But Indonesia's GDP per capita is 5x Nigeria's. What went wrong—and can Nigeria catch up?",
    category: "provocative",
    chaser: "NGA",
    target: "IDN",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.04,
    targetGrowth: 0.045,
    targetMode: "growing",
    tags: ["development", "demographics", "institutions"],
    featured: true,
    sortOrder: 1
  },
  {
    id: "bangladesh-miracle",
    title: "Bangladesh: The Quiet Miracle",
    subtitle: "Outpacing Pakistan, catching India",
    description: "Once dismissed as a 'basket case,' Bangladesh now has higher GDP per capita than India and Pakistan. The most underrated growth story?",
    category: "provocative",
    chaser: "BGD",
    target: "IND",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.055,
    targetGrowth: 0.06,
    targetMode: "growing",
    tags: ["asia", "development", "surprise"],
    sortOrder: 2
  },
  {
    id: "mexico-vs-korea",
    title: "Mexico vs South Korea: The Divergence",
    subtitle: "They started equal in 1960",
    description: "In 1960, Mexico and South Korea had similar GDP per capita. Today Korea is 3x richer. The starkest tale of divergent development.",
    category: "provocative",
    chaser: "MEX",
    target: "KOR",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.018,
    targetGrowth: 0.025,
    targetMode: "growing",
    tags: ["divergence", "policy", "institutions"],
    sortOrder: 3
  },
  {
    id: "philippines-stagnation",
    title: "The Philippines: Asia's Underperformer",
    subtitle: "Why did the Philippines fall behind?",
    description: "The Philippines was once richer than Thailand, Malaysia, and South Korea. Now it lags all of them. A puzzle of unrealized potential.",
    category: "provocative",
    chaser: "PHL",
    target: "THA",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.045,
    targetGrowth: 0.03,
    targetMode: "growing",
    tags: ["asia", "underperformance", "puzzle"],
    sortOrder: 4
  },
  {
    id: "botswana-success",
    title: "Botswana: Africa's Hidden Gem",
    subtitle: "Richer than South Africa",
    description: "Botswana has higher GDP per capita than South Africa and has been one of the world's fastest-growing economies since independence. Africa's quiet success story.",
    category: "provocative",
    chaser: "BWA",
    target: "ZAF",
    indicator: "GDP_PCAP_PPP",
    chaserGrowth: 0.035,
    targetGrowth: 0.015,
    targetMode: "growing",
    tags: ["africa", "success", "institutions"],
    sortOrder: 5
  }
];

// Helper functions
export const getScenarioById = (id: string): Scenario | undefined =>
  SCENARIOS.find(s => s.id === id);

export const getScenariosByCategory = (category: ScenarioCategory): Scenario[] =>
  SCENARIOS.filter(s => s.category === category).sort((a, b) =>
    (a.sortOrder ?? 999) - (b.sortOrder ?? 999)
  );

export const getFeaturedScenarios = (): Scenario[] =>
  SCENARIOS.filter(s => s.featured).sort((a, b) =>
    (a.sortOrder ?? 999) - (b.sortOrder ?? 999)
  );

export const searchScenarios = (query: string): Scenario[] => {
  const q = query.toLowerCase();
  return SCENARIOS.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.subtitle.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.tags.some(t => t.toLowerCase().includes(q))
  );
};
```

---

## Component Architecture

### New Components

```
/app/src/components/
├── scenarios/
│   ├── ScenariosView.tsx        # Main scenarios page container
│   ├── ScenarioCard.tsx         # Individual scenario preview card
│   ├── ScenarioGrid.tsx         # Responsive grid of cards
│   ├── CategoryFilter.tsx       # Category tabs/pills
│   └── ScenarioSearch.tsx       # Search input with debounce
```

### Component Specifications

#### 1. ScenariosView.tsx

Main container that orchestrates the scenarios page.

```typescript
// /app/src/components/scenarios/ScenariosView.tsx

interface ScenariosViewProps {
  onLoadScenario: (scenario: Scenario) => void;
  onClose: () => void;
}

export function ScenariosView({ onLoadScenario, onClose }: ScenariosViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter scenarios based on category and search
  const filteredScenarios = useMemo(() => {
    let results = selectedCategory === "all"
      ? SCENARIOS
      : getScenariosByCategory(selectedCategory);

    if (searchQuery) {
      results = searchScenarios(searchQuery);
    }

    return results;
  }, [selectedCategory, searchQuery]);

  const featured = getFeaturedScenarios();

  return (
    <div className="scenarios-view">
      <header>
        <h1>Explore Scenarios</h1>
        <p>Curated comparisons that spark insight and debate</p>
        <button onClick={onClose}>Back to Tool</button>
      </header>

      {/* Featured section (only when no search/filter) */}
      {!searchQuery && selectedCategory === "all" && (
        <section className="featured">
          <h2>Featured</h2>
          <ScenarioGrid
            scenarios={featured}
            onSelect={onLoadScenario}
            variant="featured"
          />
        </section>
      )}

      {/* Filters */}
      <div className="filters">
        <CategoryFilter
          selected={selectedCategory}
          onChange={setSelectedCategory}
        />
        <ScenarioSearch
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </div>

      {/* Main grid */}
      <ScenarioGrid
        scenarios={filteredScenarios}
        onSelect={onLoadScenario}
      />
    </div>
  );
}
```

#### 2. ScenarioCard.tsx

Individual scenario preview with hover state and click action.

```typescript
// /app/src/components/scenarios/ScenarioCard.tsx

interface ScenarioCardProps {
  scenario: Scenario;
  onSelect: (scenario: Scenario) => void;
  variant?: "default" | "featured";
}

export function ScenarioCard({ scenario, onSelect, variant = "default" }: ScenarioCardProps) {
  const categoryMeta = SCENARIO_CATEGORIES.find(c => c.id === scenario.category);

  return (
    <button
      onClick={() => onSelect(scenario)}
      className={cn(
        "scenario-card",
        variant === "featured" && "scenario-card--featured"
      )}
    >
      {/* Category badge */}
      <span className="category-badge">
        {categoryMeta?.icon} {categoryMeta?.label}
      </span>

      {/* Content */}
      <h3>{scenario.title}</h3>
      <p className="subtitle">{scenario.subtitle}</p>
      <p className="description">{scenario.description}</p>

      {/* Country flags preview */}
      <div className="countries-preview">
        <CountryFlag iso={scenario.chaser} />
        <span>→</span>
        <CountryFlag iso={scenario.target} />
      </div>

      {/* Tags */}
      <div className="tags">
        {scenario.tags.slice(0, 3).map(tag => (
          <span key={tag} className="tag">#{tag}</span>
        ))}
      </div>

      {/* CTA */}
      <span className="cta">Explore this scenario →</span>
    </button>
  );
}
```

#### 3. ScenarioGrid.tsx

Responsive grid layout for scenario cards.

```typescript
// /app/src/components/scenarios/ScenarioGrid.tsx

interface ScenarioGridProps {
  scenarios: Scenario[];
  onSelect: (scenario: Scenario) => void;
  variant?: "default" | "featured";
}

export function ScenarioGrid({ scenarios, onSelect, variant = "default" }: ScenarioGridProps) {
  if (scenarios.length === 0) {
    return (
      <div className="empty-state">
        <p>No scenarios match your search.</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "scenario-grid",
      variant === "featured" && "scenario-grid--featured"
    )}>
      {scenarios.map(scenario => (
        <ScenarioCard
          key={scenario.id}
          scenario={scenario}
          onSelect={onSelect}
          variant={variant}
        />
      ))}
    </div>
  );
}
```

#### 4. CategoryFilter.tsx

Category selection pills/tabs.

```typescript
// /app/src/components/scenarios/CategoryFilter.tsx

interface CategoryFilterProps {
  selected: ScenarioCategory | "all";
  onChange: (category: ScenarioCategory | "all") => void;
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="category-filter" role="tablist">
      <button
        role="tab"
        aria-selected={selected === "all"}
        onClick={() => onChange("all")}
        className={cn("filter-pill", selected === "all" && "active")}
      >
        All
      </button>

      {SCENARIO_CATEGORIES.map(cat => (
        <button
          key={cat.id}
          role="tab"
          aria-selected={selected === cat.id}
          onClick={() => onChange(cat.id)}
          className={cn("filter-pill", selected === cat.id && "active")}
        >
          {cat.icon} {cat.label}
        </button>
      ))}
    </div>
  );
}
```

#### 5. ScenarioSearch.tsx

Debounced search input.

```typescript
// /app/src/components/scenarios/ScenarioSearch.tsx

interface ScenarioSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function ScenarioSearch({ value, onChange }: ScenarioSearchProps) {
  const [localValue, setLocalValue] = useState(value);

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => onChange(localValue), 200);
    return () => clearTimeout(timeout);
  }, [localValue, onChange]);

  return (
    <div className="scenario-search">
      <SearchIcon className="search-icon" />
      <input
        type="search"
        placeholder="Search scenarios..."
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        aria-label="Search scenarios"
      />
      {localValue && (
        <button
          onClick={() => setLocalValue("")}
          aria-label="Clear search"
          className="clear-button"
        >
          <XIcon />
        </button>
      )}
    </div>
  );
}
```

---

## App.tsx Integration

### View State Management

```typescript
// Add to App.tsx state
const [view, setView] = useState<"tool" | "scenarios">("tool");

// Parse view from URL on mount
const initialView = useMemo(() => {
  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "scenarios" ? "scenarios" : "tool";
}, []);
```

### Scenario Loading Handler

```typescript
// Add to App.tsx
const handleLoadScenario = useCallback((scenario: Scenario) => {
  // Load all scenario state
  setChaserIso(scenario.chaser);
  setTargetIso(scenario.target);
  setIndicatorCode(scenario.indicator);
  setChaserGrowth(scenario.chaserGrowth);
  setTargetGrowth(scenario.targetGrowth);
  setTargetMode(scenario.targetMode);

  // Optional overrides
  if (scenario.mode) setMode(scenario.mode);
  if (scenario.chaserRegion) setChaserRegion(scenario.chaserRegion);
  if (scenario.targetRegion) setTargetRegion(scenario.targetRegion);
  if (scenario.implicationsTemplate) setImplicationsTemplate(scenario.implicationsTemplate);

  // Switch to tool view
  setView("tool");

  // Show toast confirmation
  toast.success(`Loaded: ${scenario.title}`);
}, []);
```

### Navigation Functions

```typescript
// Add to App.tsx
const navigateToScenarios = useCallback(() => {
  setView("scenarios");
  // Update URL without full state
  const url = new URL(window.location.href);
  url.search = "?view=scenarios";
  window.history.pushState(null, "", url);
}, []);

const navigateToTool = useCallback(() => {
  setView("tool");
  // Restore full state URL
  const nextSearch = toSearchString(shareState);
  const url = new URL(window.location.href);
  url.search = nextSearch;
  window.history.pushState(null, "", url);
}, [shareState]);
```

### Render Conditional

```typescript
// In App.tsx render
return (
  <>
    <Toaster />

    {view === "scenarios" ? (
      <ScenariosView
        onLoadScenario={handleLoadScenario}
        onClose={navigateToTool}
      />
    ) : (
      // Existing tool UI
      <div className="layout-two-col">
        {/* ... existing content ... */}
      </div>
    )}
  </>
);
```

---

## URL Structure

### Scenarios Page

```
/                          → Tool (default)
/?view=scenarios           → Scenarios gallery
/?view=scenarios&cat=geopolitical → Filtered by category
/?view=scenarios&q=china   → Search results
```

### Direct Scenario Links

```
/?scenario=india-vs-china  → Load scenario directly into tool
```

### Implementation

```typescript
// In App.tsx initialization
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  // Handle direct scenario link
  const scenarioId = params.get("scenario");
  if (scenarioId) {
    const scenario = getScenarioById(scenarioId);
    if (scenario) {
      handleLoadScenario(scenario);
    }
  }
}, []);
```

---

## Styling

### CSS Structure

```css
/* /app/src/index.css - Add scenarios section */

/* ═══════════════════════════════════════════════════════════════
   SCENARIOS VIEW
   ═══════════════════════════════════════════════════════════════ */

.scenarios-view {
  min-height: 100vh;
  padding: var(--spacing-6) var(--spacing-4);
  max-width: 1200px;
  margin: 0 auto;
}

.scenarios-view header {
  text-align: center;
  margin-bottom: var(--spacing-8);
}

.scenarios-view header h1 {
  font-family: var(--font-display);
  font-size: var(--text-4xl);
  font-weight: 600;
  margin-bottom: var(--spacing-2);
}

.scenarios-view header p {
  color: var(--color-text-secondary);
  font-size: var(--text-lg);
}

/* Category filter */
.category-filter {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  justify-content: center;
  margin-bottom: var(--spacing-6);
}

.filter-pill {
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-pill:hover {
  border-color: var(--color-primary);
}

.filter-pill.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

/* Scenario grid */
.scenario-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-4);
}

@media (min-width: 640px) {
  .scenario-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .scenario-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.scenario-grid--featured {
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .scenario-grid--featured {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Scenario card */
.scenario-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: var(--spacing-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
}

.scenario-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px var(--color-shadow);
  transform: translateY(-2px);
}

.scenario-card h3 {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  margin: var(--spacing-3) 0 var(--spacing-1);
  line-height: 1.3;
}

.scenario-card .subtitle {
  font-size: var(--text-sm);
  color: var(--color-primary);
  font-weight: 500;
  margin-bottom: var(--spacing-2);
}

.scenario-card .description {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
  flex-grow: 1;
}

.scenario-card .category-badge {
  font-size: var(--text-xs);
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
}

.scenario-card .countries-preview {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin: var(--spacing-3) 0;
}

.scenario-card .tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1);
  margin-top: auto;
}

.scenario-card .tag {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.scenario-card .cta {
  font-size: var(--text-sm);
  color: var(--color-primary);
  font-weight: 500;
  margin-top: var(--spacing-3);
}

/* Search */
.scenario-search {
  position: relative;
  max-width: 320px;
  margin: 0 auto var(--spacing-6);
}

.scenario-search input {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  padding-left: var(--spacing-10);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  font-size: var(--text-sm);
}

.scenario-search .search-icon {
  position: absolute;
  left: var(--spacing-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-tertiary);
}

/* Featured section */
.scenarios-view .featured {
  margin-bottom: var(--spacing-8);
  padding-bottom: var(--spacing-8);
  border-bottom: 1px solid var(--color-border);
}

.scenarios-view .featured h2 {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  margin-bottom: var(--spacing-4);
  text-align: center;
}

.scenario-card--featured {
  background: linear-gradient(
    135deg,
    var(--color-surface) 0%,
    var(--color-surface-alt) 100%
  );
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: var(--spacing-12);
  color: var(--color-text-secondary);
}
```

---

## Entry Point: "Explore Scenarios" Button

Add to AppHeader or create a new nav element:

```typescript
// In AppHeader.tsx or SelectorsPanel.tsx
<button
  onClick={navigateToScenarios}
  className="scenarios-button"
>
  <SparklesIcon className="icon" />
  Explore Scenarios
</button>
```

---

## Implementation Phases

### Phase 2.1: Data Foundation
**Files to create:**
1. `/app/src/types/scenario.ts` - TypeScript interfaces
2. `/app/src/lib/scenarioCategories.ts` - Category metadata
3. `/app/src/data/scenarios.ts` - Curated scenarios dataset

**Testable outcome:** Can import scenarios data and helper functions, types compile correctly.

---

### Phase 2.2: Core Components
**Files to create:**
1. `/app/src/components/scenarios/ScenarioCard.tsx`
2. `/app/src/components/scenarios/ScenarioGrid.tsx`
3. `/app/src/components/scenarios/CategoryFilter.tsx`
4. `/app/src/components/scenarios/ScenarioSearch.tsx`
5. `/app/src/components/scenarios/ScenariosView.tsx`

**Testable outcome:** Components render in isolation, props work correctly.

---

### Phase 2.3: App Integration
**Files to modify:**
1. `/app/src/App.tsx` - Add view state, handlers, conditional rendering
2. `/app/src/index.css` - Add scenarios styles

**Testable outcome:**
- Navigate to `/?view=scenarios` shows gallery
- Clicking a scenario loads it into the tool
- Back button returns to scenarios

---

### Phase 2.4: URL Support & Polish
**Features:**
1. Direct scenario links (`/?scenario=india-vs-china`)
2. Category filter in URL (`/?view=scenarios&cat=geopolitical`)
3. Browser history navigation (back/forward)
4. Entry point button in main UI

**Testable outcome:**
- Share a scenario URL → loads correctly
- Browser back button works between views
- "Explore Scenarios" button visible and functional

---

### Phase 2.5: Accessibility & Mobile
**Checklist:**
- [ ] Keyboard navigation through cards (Tab + Enter)
- [ ] Focus management when switching views
- [ ] ARIA labels on interactive elements
- [ ] Mobile-first responsive grid
- [ ] Touch-friendly tap targets (min 44px)
- [ ] Screen reader announcements for view changes

**Testable outcome:** Pass WCAG AA, works at 320px width.

---

## File Change Summary

### New Files (8)
```
/app/src/types/scenario.ts
/app/src/lib/scenarioCategories.ts
/app/src/data/scenarios.ts
/app/src/components/scenarios/ScenariosView.tsx
/app/src/components/scenarios/ScenarioCard.tsx
/app/src/components/scenarios/ScenarioGrid.tsx
/app/src/components/scenarios/CategoryFilter.tsx
/app/src/components/scenarios/ScenarioSearch.tsx
```

### Modified Files (2)
```
/app/src/App.tsx          - View state, handlers, conditional render
/app/src/index.css        - Scenarios styles
```

---

## Success Criteria

1. **Discoverability:** Users can find and browse scenarios from the main tool
2. **One-click loading:** Clicking a scenario loads all state immediately
3. **Shareability:** Direct scenario URLs work for sharing
4. **Editorial quality:** Scenarios feel curated, not auto-generated
5. **Performance:** Instant view switching, no loading states needed
6. **Mobile:** Full functionality at 320px width

---

## Data Source Clarification

### Available Data
- **Source:** World Bank Open Data API
- **Range:** 1990-2023 (imported via `scripts/fetch-worldbank.ts`)
- **Indicators:** GDP per capita (PPP/USD), population, life expectancy, etc.

### How Scenarios Use Data

Scenarios are **forward projections**, not historical visualizations:

1. **Historical context is editorial** - Descriptions like "In 1960, Korea was poorer than Ghana" provide narrative context but don't require 1960 data
2. **Charts project forward** - The tool takes the latest data point (2023) and projects convergence into the future based on growth rate assumptions
3. **No backward projection** - The app doesn't show historical trajectories, only future scenarios

```
                    Editorial provides        Tool projects
                    historical context        forward from here
                           ↓                        ↓
Timeline: ──1960──────1990────────2023────────2050────→
                       │                        │
                       └── Available data ──────┘
```

### Scenarios That Reference Pre-1990 History

These scenarios work fine because the historical context is in the **description text**, not the data:

| Scenario | Historical Reference | What Chart Shows |
|----------|---------------------|------------------|
| Korea Miracle | "In 1960, poorer than Africa" | Korea → Japan convergence from 2023 |
| Argentina Decline | "In 1900, top 10 economy" | Argentina → Australia gap from 2023 |
| Mexico vs Korea | "Equal in 1960" | Mexico → Korea divergence from 2023 |

---

## Linked Feature: Historical Counterfactuals (Feature 3)

> **See:** `TOOZE.md` → Feature 3: Historical Counterfactuals

Feature 2 (Scenarios) and Feature 3 (Historical Counterfactuals) are **complementary but independent**:

| Aspect | Feature 2 (This Plan) | Feature 3 (Future) |
|--------|----------------------|-------------------|
| **Focus** | Forward projections | Backward analysis |
| **Question** | "When will X catch Y?" | "What if X had grown like Y since 1970?" |
| **Data needed** | World Bank 1990-2023 ✅ | Maddison Project 1960+ (new) |
| **Visualization** | Future trajectory | Historical + counterfactual overlay |
| **Editorial** | Description text provides history | Chart shows actual history |

### How They Connect

1. **Scenarios → Counterfactuals upgrade path:**
   - Feature 2 scenarios have a `category: "historical"`
   - When Feature 3 ships, historical scenarios can optionally enable a "Show History" toggle
   - This would overlay the actual 1960-2023 trajectory on the forward projection

2. **Shared scenario data structure:**
   - Feature 3 can extend the `Scenario` interface:
   ```typescript
   interface Scenario {
     // ... existing fields ...

     // Feature 3 additions (optional)
     historicalStartYear?: number;     // e.g., 1960 for Korea
     counterfactualBenchmark?: string; // ISO3 of comparison country
     keyEvents?: HistoricalEvent[];    // Timeline markers
   }
   ```

3. **UI integration:**
   - Historical scenarios in Feature 2 can show a badge: "Historical data available" (once Feature 3 ships)
   - Clicking loads the scenario with historical view enabled

### Data Source Requirements for Feature 3

| Source | Coverage | Notes |
|--------|----------|-------|
| **Maddison Project Database** | 1820-2018 | GDP per capita (PPP), ~170 countries |
| **Penn World Table** | 1950-2019 | More detailed economic indicators |
| **Our World in Data** | Varies | Aggregates multiple sources |

### Implementation Order

```
Feature 2 (Now)                    Feature 3 (Later)
─────────────────                  ─────────────────
✓ Scenario data structure    ───►  Extend with historical fields
✓ Gallery UI                 ───►  Add "Show History" toggle
✓ Forward projections        ───►  Add backward trajectory
✓ Editorial descriptions     ───►  Replace with actual data viz
```

**Recommendation:** Build Feature 2 first. The scenario infrastructure (data structure, gallery, loading) will be reused by Feature 3. Historical data integration is additive, not a rewrite.

---

## Future Enhancements (Out of Scope for Feature 2)

- Trending/popular scenarios based on analytics
- User-submitted scenarios
- Scenario versioning (as data updates)
- Newsletter integration ("Scenario of the week")
- A/B testing different featured scenarios
- **Historical trajectory visualization** → See Feature 3

---

## Dependencies

- **None** - Can start immediately
- Does not require Feature 1 (Share Cards) to be complete
- Uses existing ShareState infrastructure
- Uses existing World Bank data (1990-2023) - no new data sources needed

---

## Estimated Complexity

**Low-Medium** - Scenarios are curated data + gallery UI. No new APIs, no complex state management, no external dependencies.
