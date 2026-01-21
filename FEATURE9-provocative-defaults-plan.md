# Feature 9: Provocative Default Landing States

> No one lands on a blank slate; always something interesting.

## Overview

Replace the static default comparison (Nigeria vs Ireland) with a dynamic, rotating "Comparison of the Week" system that hooks visitors with compelling, editorially-curated insights tied to current events and seasonal contexts.

---

## Current State

**File:** `app/src/lib/shareState.ts`

```typescript
export const DEFAULT_SHARE_STATE: ShareState = {
  chaser: "NGA",      // Nigeria
  target: "IRL",      // Ireland
  indicator: "GDP_PCAP_PPP",
  cg: 0.035,          // 3.5% growth
  tg: 0.015,          // 1.5% growth
  // ... rest of defaults
};
```

**Problem:** Every visitor sees the same comparison. No hook, no surprise, no reason to explore further.

---

## Goals

1. **Dynamic defaults:** Rotate featured comparison weekly (or event-based)
2. **Editorial curation:** Tie comparisons to news cycles (Davos, COP, IMF meetings)
3. **Trending visibility:** Show what others are exploring
4. **Return engagement:** Give users a reason to come back

---

## Architecture Decision

### Option A: Client-Side Rotation (MVP) ✓ Recommended

- Zero backend complexity
- Deterministic (same day = same comparison for all users)
- Instant load, no network dependency
- Hard-coded rotation schedule

### Option B: Backend-Driven Rotation (Future)

- Real-time event switching
- Editorial scheduling UI
- Actual trending data from analytics
- Requires CMS/database for scheduling

**Decision:** Start with Option A (MVP), extend to Option B if editorial needs grow.

---

## Implementation Plan

### Phase 1: Weekly Rotation System

**Goal:** Rotate default comparison weekly using Feature 2's curated scenarios.

#### 1.1 Create Default Rotation Module

**New file:** `app/src/lib/defaultRotation.ts`

```typescript
import { scenarios, type Scenario } from "./scenarios";
import type { ShareState } from "./shareState";

// Get ISO week number (1-52)
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Get year for rotation (handles year boundaries)
function getRotationYear(date: Date): number {
  return date.getFullYear();
}

// Curated weekly rotation - editorially selected for max engagement
const WEEKLY_ROTATION: string[] = [
  // Q1: New Year / Davos / Post-holiday
  "china-vs-usa",           // Week 1: Big picture start
  "india-vs-china",         // Week 2: The race everyone watches
  "brics-vs-g7",            // Week 3: Davos week - global power
  "eastern-europe-eu",      // Week 4: EU convergence

  // Q1 continued
  "korea-miracle",          // Week 5: Success story
  "russia-stagnation",      // Week 6: Geopolitical
  "ireland-transformation", // Week 7: Small country success
  "southeast-asia-tigers",  // Week 8: Regional growth

  // Q2: Spring / IMF meetings
  "nigeria-vs-indonesia",   // Week 9: Provocative
  "mexico-vs-korea",        // Week 10: Surprising divergence
  "baltic-tigers",          // Week 11: Post-Soviet success
  "argentina-decline",      // Week 12: Cautionary tale
  "latin-america-divergence", // Week 13: Regional split

  // Q2 continued
  "bangladesh-miracle",     // Week 14: Unexpected success
  "japan-stagnation",       // Week 15: Rich country trap
  "africa-rising",          // Week 16: Optimistic future
  "gulf-diversification",   // Week 17: Oil transition

  // Q3: Summer / Pre-election coverage
  "china-vs-usa",           // Week 18: Repeat top performer
  "philippines-stagnation", // Week 19: What went wrong
  "botswana-success",       // Week 20: African success
  "india-vs-china",         // Week 21: Repeat engagement driver
  "vietnam-rise",           // Week 22: Manufacturing shift

  // Continue pattern - 52 weeks total
  // Repeat high-performers, mix categories
  "korea-miracle",          // Week 23
  "eastern-europe-eu",      // Week 24
  "nigeria-vs-indonesia",   // Week 25
  "brics-vs-g7",            // Week 26: Mid-year

  // Q3 continued
  "russia-stagnation",      // Week 27
  "ireland-transformation", // Week 28
  "southeast-asia-tigers",  // Week 29
  "bangladesh-miracle",     // Week 30
  "mexico-vs-korea",        // Week 31
  "china-vs-usa",           // Week 32

  // Q4: Fall / UN meetings / COP
  "africa-rising",          // Week 33
  "gulf-diversification",   // Week 34
  "latin-america-divergence", // Week 35
  "japan-stagnation",       // Week 36
  "baltic-tigers",          // Week 37
  "argentina-decline",      // Week 38
  "india-vs-china",         // Week 39
  "botswana-success",       // Week 40

  // Q4: November COP / Pre-holiday
  "korea-miracle",          // Week 41
  "vietnam-rise",           // Week 42
  "eastern-europe-eu",      // Week 43
  "nigeria-vs-indonesia",   // Week 44
  "philippines-stagnation", // Week 45
  "brics-vs-g7",            // Week 46

  // Q4: Holiday season - engaging comparisons
  "china-vs-usa",           // Week 47
  "ireland-transformation", // Week 48
  "bangladesh-miracle",     // Week 49
  "southeast-asia-tigers",  // Week 50
  "russia-stagnation",      // Week 51
  "india-vs-china",         // Week 52: Year end
];

export interface FeaturedComparison {
  scenario: Scenario;
  weekNumber: number;
  year: number;
  label: string;  // "This Week's Comparison"
}

export function getFeaturedComparison(date: Date = new Date()): FeaturedComparison {
  const weekNumber = getISOWeek(date);
  const year = getRotationYear(date);
  const scenarioId = WEEKLY_ROTATION[(weekNumber - 1) % WEEKLY_ROTATION.length];

  const scenario = scenarios.find(s => s.id === scenarioId);
  if (!scenario) {
    // Fallback to first scenario if not found
    return {
      scenario: scenarios[0],
      weekNumber,
      year,
      label: "Featured Comparison",
    };
  }

  return {
    scenario,
    weekNumber,
    year,
    label: "This Week's Comparison",
  };
}

export function scenarioToShareState(scenario: Scenario): ShareState {
  return {
    chaser: scenario.chaser,
    target: scenario.target,
    indicator: scenario.indicator,
    cg: scenario.chaserGrowth,
    tg: scenario.targetGrowth,
    tmode: scenario.targetMode,
    baseYear: 2023,
    view: "chart",
    adjC: true,
    adjT: true,
    goal: 25,
    ms: true,
    tpl: scenario.implicationsTemplate ?? "china",
    ih: 25,
    mode: scenario.mode ?? "countries",
    cr: scenario.chaserRegion ?? "UKC",
    tr: scenario.targetRegion ?? "UKI",
  };
}

export function getDefaultShareState(date: Date = new Date()): ShareState {
  const featured = getFeaturedComparison(date);
  return scenarioToShareState(featured.scenario);
}
```

#### 1.2 Update ShareState Defaults

**File:** `app/src/lib/shareState.ts`

```typescript
import { getDefaultShareState } from "./defaultRotation";

// Replace static DEFAULT_SHARE_STATE with dynamic getter
export const DEFAULT_SHARE_STATE: ShareState = getDefaultShareState();

// Keep a truly static fallback for edge cases
export const STATIC_FALLBACK_STATE: ShareState = {
  chaser: "CHN",
  target: "USA",
  indicator: "GDP_PCAP_PPP",
  cg: 0.045,
  tg: 0.015,
  tmode: "growing",
  baseYear: 2023,
  view: "chart",
  adjC: true,
  adjT: true,
  goal: 25,
  ms: true,
  tpl: "china",
  ih: 25,
  mode: "countries",
  cr: "UKC",
  tr: "UKI",
};
```

#### 1.3 Files to Modify

| File | Change |
|------|--------|
| `app/src/lib/defaultRotation.ts` | **NEW** - Rotation logic |
| `app/src/lib/shareState.ts` | Import and use dynamic default |
| `app/src/lib/scenarios.ts` | Ensure scenarios exist (Feature 2 dependency) |

---

### Phase 2: Featured Comparison Badge

**Goal:** Show users they're seeing a curated comparison.

#### 2.1 Add Badge to AppHeader

**File:** `app/src/components/AppHeader.tsx`

Add a subtle badge when viewing the week's featured comparison:

```tsx
import { getFeaturedComparison, scenarioToShareState } from "../lib/defaultRotation";

interface AppHeaderProps {
  currentShareState: ShareState;
  // ... other props
}

export function AppHeader({ currentShareState, ...props }: AppHeaderProps) {
  const featured = getFeaturedComparison();
  const featuredState = scenarioToShareState(featured.scenario);

  // Check if current view matches featured comparison
  const isViewingFeatured =
    currentShareState.chaser === featuredState.chaser &&
    currentShareState.target === featuredState.target &&
    currentShareState.indicator === featuredState.indicator;

  return (
    <header>
      {/* ... existing header content */}

      {isViewingFeatured && (
        <Badge variant="outline" className="ml-2 text-xs">
          <Sparkles className="w-3 h-3 mr-1" />
          {featured.label}
        </Badge>
      )}
    </header>
  );
}
```

#### 2.2 Add "Explore Featured" Reset Button

**File:** `app/src/components/ExportModal.tsx` or new component

When user has navigated away from featured:

```tsx
{!isViewingFeatured && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => loadComparison(featuredState)}
  >
    <Sparkles className="w-4 h-4 mr-1" />
    See This Week's Featured
  </Button>
)}
```

---

### Phase 3: Event-Based Overrides (Optional Enhancement)

**Goal:** Override weekly rotation for major events (Davos, COP, etc.).

#### 3.1 Event Calendar

**File:** `app/src/lib/eventOverrides.ts`

```typescript
interface EventOverride {
  name: string;
  startDate: string;  // ISO date "2025-01-20"
  endDate: string;    // ISO date "2025-01-24"
  scenarioId: string;
  label: string;      // "Davos 2025 Special"
}

const EVENT_OVERRIDES: EventOverride[] = [
  // Davos World Economic Forum (late January)
  {
    name: "Davos 2025",
    startDate: "2025-01-20",
    endDate: "2025-01-24",
    scenarioId: "brics-vs-g7",
    label: "Davos 2025: Global Power Shift",
  },
  {
    name: "Davos 2026",
    startDate: "2026-01-19",
    endDate: "2026-01-23",
    scenarioId: "china-vs-usa",
    label: "Davos 2026: The Big Picture",
  },

  // IMF/World Bank Spring Meetings (April)
  {
    name: "IMF Spring 2025",
    startDate: "2025-04-21",
    endDate: "2025-04-26",
    scenarioId: "africa-rising",
    label: "IMF Spring: Development Outlook",
  },

  // COP Climate Conference (November)
  {
    name: "COP30 Brazil",
    startDate: "2025-11-10",
    endDate: "2025-11-21",
    scenarioId: "india-vs-china",
    label: "COP30: Emerging Emitters",
  },

  // IMF/World Bank Annual Meetings (October)
  {
    name: "IMF Annual 2025",
    startDate: "2025-10-20",
    endDate: "2025-10-26",
    scenarioId: "latin-america-divergence",
    label: "IMF Annual: Regional Trajectories",
  },
];

export function getEventOverride(date: Date = new Date()): EventOverride | null {
  const dateStr = date.toISOString().split("T")[0];

  return EVENT_OVERRIDES.find(event =>
    dateStr >= event.startDate && dateStr <= event.endDate
  ) ?? null;
}
```

#### 3.2 Integrate with Rotation

Update `defaultRotation.ts`:

```typescript
import { getEventOverride } from "./eventOverrides";

export function getFeaturedComparison(date: Date = new Date()): FeaturedComparison {
  // Check for event override first
  const eventOverride = getEventOverride(date);
  if (eventOverride) {
    const scenario = scenarios.find(s => s.id === eventOverride.scenarioId);
    if (scenario) {
      return {
        scenario,
        weekNumber: getISOWeek(date),
        year: getRotationYear(date),
        label: eventOverride.label,
      };
    }
  }

  // Fall back to weekly rotation
  // ... existing rotation logic
}
```

---

### Phase 4: Trending Comparisons (Future - Requires Analytics)

**Goal:** Show actual trending comparisons based on user behavior.

#### 4.1 Prerequisites

- [ ] Analytics integration (Plausible, Vercel Analytics, or custom)
- [ ] Event tracking on comparison loads
- [ ] Database table for aggregated stats
- [ ] Cache strategy for trending data

#### 4.2 Analytics Event

**File:** `app/src/lib/analytics.ts` (NEW)

```typescript
export function trackComparison(shareState: ShareState): void {
  // Only track if analytics enabled
  if (typeof window === "undefined") return;

  const event = {
    name: "comparison_view",
    properties: {
      chaser: shareState.chaser,
      target: shareState.target,
      indicator: shareState.indicator,
      comparison_key: `${shareState.chaser}-${shareState.target}-${shareState.indicator}`,
    },
  };

  // Send to analytics provider
  // plausible?.trackEvent(event.name, event.properties);
  // or custom endpoint
}
```

#### 4.3 Trending API Endpoint

**File:** `app/functions/api/trending.ts` (NEW)

```typescript
export async function onRequestGet(context: EventContext<Env, string, unknown>) {
  const { env } = context;

  // Query aggregated comparison stats from last 7 days
  const trending = await env.DB.prepare(`
    SELECT
      chaser,
      target,
      indicator,
      COUNT(*) as view_count
    FROM comparison_views
    WHERE created_at > datetime('now', '-7 days')
    GROUP BY chaser, target, indicator
    ORDER BY view_count DESC
    LIMIT 5
  `).all();

  return Response.json({
    data: trending.results,
    generated_at: new Date().toISOString(),
  });
}
```

#### 4.4 Trending UI Component

**File:** `app/src/components/TrendingComparisons.tsx` (NEW)

```tsx
interface TrendingComparisonProps {
  onSelect: (comparison: ShareState) => void;
}

export function TrendingComparisons({ onSelect }: TrendingComparisonProps) {
  const { data: trending } = useTrending();

  if (!trending?.length) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        <TrendingUp className="w-4 h-4 inline mr-1" />
        Trending This Week
      </h3>
      <div className="flex flex-wrap gap-2">
        {trending.map((item) => (
          <Button
            key={`${item.chaser}-${item.target}`}
            variant="outline"
            size="sm"
            onClick={() => onSelect(item)}
          >
            {item.chaserName} → {item.targetName}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

---

## Dependency on Feature 2

Feature 9 requires Feature 2's scenario infrastructure:

```
Feature 2 (Scenarios)          Feature 9 (Defaults)
┌──────────────────────┐       ┌──────────────────────┐
│ • Scenario interface │──────▶│ • Weekly rotation    │
│ • 25 curated items   │       │ • Event overrides    │
│ • scenarios.ts       │       │ • Badge display      │
│ • Scenario gallery   │       │ • Trending (future)  │
└──────────────────────┘       └──────────────────────┘
```

**If Feature 2 not yet implemented:**
- Create minimal `scenarios.ts` with subset of scenarios
- Implement full scenario gallery later

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `app/src/lib/defaultRotation.ts` | Weekly rotation logic |
| `app/src/lib/eventOverrides.ts` | Event-based overrides |
| `app/src/lib/analytics.ts` | Analytics tracking (Phase 4) |
| `app/functions/api/trending.ts` | Trending endpoint (Phase 4) |
| `app/src/components/TrendingComparisons.tsx` | Trending UI (Phase 4) |

### Modified Files

| File | Change |
|------|--------|
| `app/src/lib/shareState.ts` | Use dynamic default |
| `app/src/components/AppHeader.tsx` | Add featured badge |
| `app/src/App.tsx` | Pass currentShareState to header |

---

## Testing Criteria

### Phase 1: Weekly Rotation

- [ ] Different weeks return different default comparisons
- [ ] Same week always returns same comparison (deterministic)
- [ ] All 52 weeks have valid scenarios
- [ ] Fallback works if scenario not found
- [ ] URL with no params loads weekly default
- [ ] URL with params overrides weekly default

### Phase 2: Badge Display

- [ ] Badge shows when viewing featured comparison
- [ ] Badge hidden when user changes comparison
- [ ] "See Featured" button appears when not viewing featured
- [ ] Clicking "See Featured" loads correct comparison

### Phase 3: Event Overrides

- [ ] Event override takes precedence over weekly rotation
- [ ] Event label displays correctly
- [ ] Events don't overlap (handled correctly if they do)
- [ ] Past events don't affect current date

### Phase 4: Trending (Future)

- [ ] Analytics events fire on comparison view
- [ ] Trending endpoint returns valid data
- [ ] Trending UI loads without blocking main app
- [ ] Caching prevents excessive API calls

---

## Rollout Strategy

### Phase 1 (MVP)

1. Implement `defaultRotation.ts`
2. Update `shareState.ts` to use dynamic default
3. Test across multiple weeks (mock dates)
4. Deploy - users see weekly rotation

### Phase 2 (Badge)

1. Add badge component
2. Integrate with AppHeader
3. A/B test badge visibility impact
4. Deploy

### Phase 3 (Events)

1. Add `eventOverrides.ts`
2. Populate with 2025-2026 events
3. Test date range logic
4. Deploy before first major event

### Phase 4 (Trending)

1. Choose analytics provider
2. Implement tracking
3. Create trending endpoint
4. Add trending UI
5. Monitor data quality
6. Deploy when data is meaningful

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Exploration rate | +20% | Users who change from default |
| Return visitors | +15% | Weekly return rate |
| Engagement depth | +2 comparisons | Avg comparisons per session |
| Event correlation | Visible | Traffic spikes during events |

---

## What's Next

After Feature 9:

1. **Feature 5: Thread Generator** - Multi-image export for Twitter threads
2. **Feature 3: Historical Counterfactuals** - Extends Feature 2's scenarios with historical data

---

## Notes

- Weekly rotation is deterministic - all users see same default on same day
- Event overrides are hard-coded but can be updated with each deploy
- Trending requires analytics infrastructure not yet present
- Consider A/B testing different rotation strategies
