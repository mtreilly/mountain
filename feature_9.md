# Feature 9 Plan: Provocative Default Landing States

> “No one lands on a blank slate; always something interesting.”

This plan defines how to replace the static default comparison with a deterministic, editorial “Featured comparison” system, while keeping the application’s core promise intact: **the URL fully describes what you’re looking at**.

Related docs:
- `FEATURE9-provocative-defaults-plan.md` (original draft)
- `FEATURE2-SCENARIOS-plan.md` (source of curated scenarios this feature should reuse)

---

## Status

⏳ Planned (not implemented yet).

---

## Goals

- Hook first-time visitors with a compelling comparison immediately.
- Keep behavior **deterministic** (everyone sees the same featured comparison for a given week/day).
- Preserve clarity and trust: **never override an explicit URL state**.
- Reuse the curated scenarios infrastructure from Feature 2 (single source of truth).
- Make the “editorial” nature explicit (what is featured, why, and what assumptions are in play).

## Non-goals (MVP)

- Real-time trending comparisons (requires analytics/backend).
- Server-side editorial CMS/scheduling UI.
- A/B testing infrastructure.

---

## Core UX Principles (Clarity)

1. **Only apply “featured defaults” when no state is provided.**
   - If the user arrives with any meaningful comparison params (`chaser`, `target`, `indicator`, etc.), do nothing special.
2. **Always label featured content as editorial.**
   - “Featured this week” + short rationale (“Why this comparison?”).
3. **Always disclose assumptions.**
   - Base year, growth rates, target mode (static/growing), and data source should be visible or one click away.
4. **Always provide an escape hatch.**
   - “Pick your own”, “Browse scenarios”, and “Try another” (or “Show classic default”).

---

## Feature Behavior

### When it triggers

Feature 9 triggers only when the landing URL does **not** specify a comparison state (e.g. visiting `/` or `/share` with no relevant query params).

### What it does

- Select a scenario from a curated rotation list (weekly by default).
- Convert the scenario → `ShareState`.
- Initialize the app with that state (and thus produce a shareable URL once state sync runs).
- Display a small “Featured” banner explaining what you’re seeing and why.

### When it stops showing UI

- As soon as the user changes chaser/target/metric/growth assumptions, the “Featured” banner should collapse or disappear (but the comparison remains).

---

## Data Model

Feature 9 should not invent a second dataset. It should reuse Feature 2’s scenario model.

### Scenario type (reuse)

Source of truth should be introduced via Feature 2:
- `app/src/types/scenario.ts`
- `app/src/data/scenarios.ts` exporting `SCENARIOS`

Feature 9 will use:
- `Scenario.id`, `title`, `subtitle`, `description`, `category`
- `chaser`, `target`, `indicator`
- `chaserGrowth`, `targetGrowth`, `targetMode`
- (optional) `mode`, `chaserRegion`, `targetRegion`, `implicationsTemplate`

### Rotation metadata (new)

Add a small rotation module:

- `app/src/lib/defaultRotation.ts`
  - `getISOWeek(date): number`
  - `getFeaturedScenarioId(date): string`
  - `getFeaturedScenario(date): Scenario | null`
  - `scenarioToShareState(s: Scenario): ShareState`
  - `getDefaultShareState(date): ShareState`

#### Rotation list strategy (MVP)

- A curated `WEEKLY_ROTATION: string[]` of `Scenario.id`s.
- Deterministic mapping: `weekNumber -> index`.

Rationale:
- No backend.
- Same “featured” for everyone.
- Easy to tune editorially (reorder/replace IDs).

---

## App Integration Plan

### A. Shared default state (recommended)

Use the rotation in the shared parsing default so both:
- the SPA default view (`/`)
- and the social share page (`/share`)
agree on what “default” is.

Implementation approach:

1. Implement `getDefaultShareState()` in `app/src/lib/defaultRotation.ts`.
2. Update `app/src/lib/shareState.ts` to use the dynamic default:
   - Keep a static fallback constant (`STATIC_FALLBACK_STATE`) for safety.
   - Set `DEFAULT_SHARE_STATE` from `getDefaultShareState(new Date())`.

This ensures:
- `parseShareStateFromSearch(search)` remains the single entry point for “state from URL”
- defaults are consistent across client + server functions that import `shareState.ts`

### B. “Featured” banner (UI)

Add a small banner/component (name is flexible):
- `app/src/components/FeaturedComparisonBanner.tsx`

Inputs:
- `scenario: Scenario`
- `isDismissed: boolean` (local state)
- `onTryAnother(): void` (optional, cycles within the rotation list)
- `onBrowseScenarios(): void` (wires to Feature 2 later)
- `onUseClassicDefault(): void` (optional)

Display:
- Label: “Featured this week”
- Title/subtitle
- Short description (1–2 sentences)
- “Assumptions” line:
  - metric
  - `cg`, `tg`, `tmode`
  - base year
  - data source (World Bank / OECD)

Placement:
- Above `SelectorsPanel` (first content block) so it sets context.

Dismissal:
- Allow “Dismiss”.
- Auto-dismiss when user changes any selector/slider (optional; dismissal can be purely manual for MVP).

### C. “Try another” (optional but high-value)

Implement “Try another” as a deterministic “next”:
- `getFeaturedScenario(date)` uses ISO week.
- “Try another” uses `(rotationIndex + 1) % WEEKLY_ROTATION.length` to avoid randomness while still feeling explorative.

---

## Share Page / OG Consistency

The `/share` route is what social scrapers hit. It currently derives the comparison from `parseShareStateFromSearch()`.

Requirement:
- `/share` with no params should describe the same featured comparison as `/`.

Using the shared default strategy above satisfies this without special-casing `share.ts`.

---

## Open Questions (decide before coding)

1. **Rotation cadence:** weekly (recommended) vs daily.
2. **“Featured” banner dismissal:** manual only vs auto-dismiss on any interaction.
3. **Do we keep a “classic default” option?**
   - Useful for debugging and for users who prefer a stable reference comparison.
4. **Does “Try another” cycle within the curated list, or select from a second “overflow” list?**

---

## Acceptance Criteria (MVP)

- Visiting `/` with no search params loads the featured scenario state.
- Visiting `/` with explicit params never overrides them.
- Visiting `/share` with no params shows OG metadata for the featured scenario (not the old static default).
- UI clearly labels featured content and exposes assumptions.
- User can immediately switch to their own comparison without friction.

---

## Implementation Steps (Concrete)

1. **Prereq:** land Scenario dataset module (minimum viable subset) shared with Feature 2.
   - `app/src/types/scenario.ts`
   - `app/src/data/scenarios.ts` exporting `SCENARIOS`
2. Create `app/src/lib/defaultRotation.ts` (deterministic selection + scenario→state).
3. Update `app/src/lib/shareState.ts` to use rotated default state (with static fallback).
4. Add `FeaturedComparisonBanner` component and render it only when:
   - the app booted from a “no-params” landing, and
   - the current state still matches the initially applied featured scenario (or until dismissed).
5. Add a simple unit-ish test coverage in `app/scripts/test.ts`:
   - rotation determinism (same date → same scenario)
   - default state shape is valid
6. (Optional) Add “Try another” behavior.

---

## Future Extensions

- Backend-driven schedule (CMS) for timely editorial updates.
- Real trending section (analytics-backed).
- Seasonal rotations tied to events (COP, IMF meetings) with a small JSON calendar.
- Pair with Feature 2 Scenarios UI:
  - “Browse scenarios” opens the scenarios gallery.
  - Featured comparison appears as the hero card on that page.

