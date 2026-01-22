# Context: “Implications” Card Improvements

## Goal
When a user picks a country (e.g., Nigeria) and an aspirational “catch-up” path (China-like / US-like / Europe-like), the Implications card should communicate—viscerally and quantitatively—what 25 years of high growth implies for:
- Electricity generation (and equivalent buildout in solar, wind, nuclear, coal)
- Urbanization (and implied housing/homes)
- Emissions and other macro “pressure” metrics

The output should feel like: “To get there, you need *this much more stuff*,” with clear assumptions and uncertainty framing.

## Current State (in app today)
`src/components/ImplicationsPanel.tsx` estimates implied levels for a small set of metrics using template GDP/cap → metric relationships:
- Energy use per capita
- Electricity use per capita
- CO₂ per capita
- Urbanization (%)
- Industry share of GDP (%)
- Capital formation share of GDP (%)

It already converts those to totals using population assumptions (trend/static). It now also displays a “Buildout” summary that converts electricity deltas into intuitive equivalents (solar panels, wind turbines, 1‑GW plants) and converts urbanization deltas into “homes” via household size.

## Product Requirements
### What users should learn (top-line story)
1) **Scale**: the absolute magnitude of additional electricity required (TWh/year) and average power (GWavg).
2) **Translation**: what that means in buildout terms:
   - Solar: GW and panel count (assumption: typical panel watts, capacity factor).
   - Wind: GW and turbine count (assumption: turbine MW rating, capacity factor).
   - Nuclear: number of 1‑GW plants (assumption: capacity factor).
   - Coal: number of 1‑GW plants (assumption: capacity factor).
3) **Urban shift**: additional urban residents and rough housing units required (assumption: people per home).
4) **Pressure/side-effects**: CO₂ implications (and later: land use, materials, grid, peak demand).

### Non-goals (for now)
- Forecasting tech mix, costs, or policy outcomes.
- Claiming causal relationships (“GDP causes X”) beyond a template-based empirical mapping.

## Key Metrics and Conversions (MVP)
### Electricity buildout (already implemented, refine over time)
Inputs:
- Current and implied future *total electricity* (TWh/year), derived from per-capita electricity × population.

Derived:
- ΔTWh/year and ΔGWavg (ΔTWh × 1000 / 8760).
- Capacity equivalents for each technology given assumed capacity factor (CF):
  - Required GW = ΔTWh / (8.76 × CF)
  - 1‑GW plants = required GW (for nuclear/coal)
  - Solar panels = ΔTWh / (panel_kW × CF × 8760) converted into counts
  - Wind turbines = (required GW × 1000) / turbine_MW

Assumptions (displayed in UI and configurable later):
- Solar CF ~ 20%
- Wind CF ~ 35%
- Coal CF ~ 60%
- Nuclear CF ~ 90%
- Solar panel ~ 400 W
- Wind turbine ~ 3 MW

### Urbanization / homes (already implemented, refine over time)
Inputs:
- Current and implied future *urban population* (persons), derived from urban % × total population.

Derived:
- Δ urban residents
- Homes needed ≈ Δ urban residents / household size

Assumption:
- Household size (default 4, user-adjustable).

### CO₂ (already displayed, upgrade later)
Inputs:
- Current and implied future total CO₂ (MtCO₂/year), derived from per-capita CO₂ × population.

Near-term additions:
- Show ΔMtCO₂/year and per-capita implied.
- Later: translate into “coal-equivalent emissions” or “abatement required” scenarios.

## Data: Where to get it (what we should use)
### Import strategy (how it fits this repo)
This repo already uses an offline ingestion pattern:
- `scripts/fetch-worldbank.ts` calls the World Bank API and prints SQL.
- `scripts/fetch-owid-co2.ts` streams an OWID CSV and prints SQL.
- `pnpm data:fetch` composes these into `data-import-fixed.sql` for D1 import.

We follow the same approach for energy-by-source:
- `scripts/fetch-owid-energy.ts` streams OWID energy CSV, maps selected columns to indicator codes, and prints SQL inserts.

### Future-proofing (high priority)
- Pin external datasets to a specific version (Git commit SHA or tagged release) rather than tracking `master` by default. Record this in `data_points.source_vintage`.
- Keep ingestion scripts strict about required columns, but tolerant of extra columns (OWID adds columns over time).
- Prefer sources that are: (1) open and linkable, (2) stable URLs, (3) widely used in research/media, and (4) consistently country-coded (ISO3).

Implementation note:
- `scripts/fetch-owid-energy.ts` supports pinning via `OWID_ENERGY_REF=<commit-or-tag>` and records `OWID_ENERGY_VINTAGE` (defaults to `owid-energy-data@<ref>`) into `data_points.source_vintage`.

### Future-proofing (high priority)
- Pin external datasets to a specific version (Git commit SHA or tagged release) rather than tracking `master` by default. Record this in `data_points.source_vintage`.
- Keep the ingestion scripts strict about required columns, but tolerant of extra columns (OWID adds columns over time).
- Prefer sources that are: (1) open and linkable, (2) stable URLs, (3) widely used in research/media, and (4) consistently country-coded (ISO3).

### Electricity by source (TWh)
Best sources:
- Our World in Data energy dataset (often Ember/IEA/EIA/EIA-backed): electricity generation by source by country-year.
  - CSV: https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv
  - Relevant columns for this feature: `solar_electricity`, `wind_electricity`, `coal_electricity`, `nuclear_electricity`, plus optionally `electricity_generation`, `electricity_demand`, and `*_share_elec`.
- Ember directly (strong for recent years and source splits; can be used if we want a smaller/more energy-specific import).

Use cases:
- Validation/benchmarking of implied totals.
- Optional: show current mix and what “source split” looks like today vs. implied total.

Recommended choice:
- Use OWID energy as the default “observed source mix” dataset because it is open, broad coverage, and easy to ingest as CSV like our OWID CO₂ pipeline.
- Optional augmentation (implemented): ingest the latest available year from Ember’s `electricity-generation/yearly` and insert it as additional year-level points (default `>= 2024`) so “today” baselines can extend beyond OWID’s latest year without overwriting OWID history.

Indicator mapping (OWID → D1):
- `electricity_generation` → `ELECTRICITY_GEN_TOTAL` (TWh)
- `solar_electricity` → `ELECTRICITY_GEN_SOLAR` (TWh)
- `wind_electricity` → `ELECTRICITY_GEN_WIND` (TWh)
- `coal_electricity` → `ELECTRICITY_GEN_COAL` (TWh)
- `nuclear_electricity` → `ELECTRICITY_GEN_NUCLEAR` (TWh)

### Installed capacity by source (GW)
Best sources:
- IRENA Renewable Capacity Statistics (solar/wind by country-year; typically published as downloadable spreadsheets/CSVs rather than a simple unauthenticated API).
- Ember (capacity where provided).

Note: OWID’s `owid-energy-data.csv` is primarily energy (TWh) and per-capita/share fields; it does not reliably contain installed capacity for all sources, so capacity will likely need a second ingestion source if we want “× current capacity” comparisons.

Use cases:
- Ground “equivalents” in real country baselines (e.g., “you’d need +X× your current wind fleet”).

Recommended choice:
- Add IRENA solar/wind capacity as the first “capacity baseline” step because it unlocks a very compelling user-facing message (“+X× today’s fleet”) while keeping scope limited to renewables.
  - Implementation: `scripts/fetch-irena-capacity.ts` (PXWeb table `Country_ELECSTAT_2025_H2_PX.px`, installed capacity in MW → stored as GW; wind = onshore + offshore)

Practical interim (implemented now):
- Until we ingest an explicit capacity dataset, we estimate “today’s fleet GW” from observed generation (TWh) using the same capacity-factor assumptions as the buildout equivalents:
  - estimated GW ≈ TWh / (8.76 × CF)
  - This is explicitly labeled as an estimate and uses our CF assumptions for internal consistency.

Practical next step (implemented now, requires API key):
- Ember provides installed capacity data (GW) via `GET /v1/installed-capacity/monthly` (requires `api_key`).
- We ingest solar/wind capacity for the latest available month and store it as a single year-level point with a `source_vintage` like `ember-installed-capacity@YYYY-MM`.
- This enables “× today’s fleet” multipliers based on reported installed GW rather than inferred GW.
  - Implementation: `scripts/fetch-ember-capacity.ts`

Practical “newest year” step (implemented now, requires API key):
- Ember provides electricity generation data (TWh) via `GET /v1/electricity-generation/yearly` (requires `api_key` for higher limits).
- We ingest a single target year (default: latest available, but only if `>= 2024`) and store it as year-level points with `source_vintage` like `ember-electricity-generation@YYYY`.
  - Implementation: `scripts/fetch-ember-generation.ts`

### Nuclear & coal plant/unit counts
Best sources:
- IAEA PRIS (reactor-level nuclear data: unit counts and capacities; confirm export/API terms).
- Global Energy Monitor trackers (plant-level, unit counts, capacity, status; confirm download format + license).

Use cases:
- More realistic plant equivalents (e.g., use typical unit sizes per region).
- Optional: “under construction” and retirement dynamics.

Recommended choice:
- Defer plant/unit ingestion until after the OWID+IRENA pipeline is stable; keep nuclear/coal as “1‑GW plant equivalents” for MVP. Add GEM/PRIS only if we want unit-level storytelling and are comfortable with ongoing data maintenance and license diligence.

### Housing stock / household size
Best sources:
- UN / World Bank for urbanization and population (already used).
- Household size: UN household size tables; OECD/Eurostat for subsets; national statistics where needed.

Use cases:
- Make “homes needed” more realistic by country (default to country’s observed household size if available).

## APIs / Endpoints we will use (MVP)
- World Bank API (already in use): `https://api.worldbank.org/v2/country/all/indicator/<INDICATOR>?format=json&date=1990:2023&per_page=20000`
- OWID CO2 CSV (already in use): `https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv`
- OWID Energy CSV (in use): `https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv`
- IRENASTAT PXWeb API (capacity baselines): `https://pxweb.irena.org/api/v1/en/IRENASTAT/`
- Ember API (optional, requires key): `https://api.ember-energy.org/v1/installed-capacity/monthly`
- Ember API (optional, requires key): `https://api.ember-energy.org/v1/electricity-generation/yearly`

## Documentation we still need to write (or decide)
1) **Indicator mapping table** (doc + code): OWID column → our indicator code → unit → category → source_code string.
2) **Attribution + license notes**: OWID is CC-BY; but OWID energy is a compilation of upstream sources—decide what attribution text we show in-app and where.
3) **Source precedence rules**: if we have both WB electricity per-cap and OWID electricity totals, which is “truth” for each view?
4) **Update cadence**: how often we regenerate/import `data-import-fixed.sql` and how we record `source_vintage` for reproducibility.
5) **Assumptions registry**: a single place to define/display defaults (CFs, panel watts, turbine MW, household size), including rationale and how users can override.
6) **Version pinning policy**: do we pin to a commit by default and bump intentionally, or always track latest and alert on schema changes?
7) **Secrets management**: where `EMBER_API_KEY` lives in CI/local and how we avoid checking it into the repo.

## Visual Design Plan (compelling, minimal clutter)
### Tier 1: “Big-number” summary (within Implications card)
Keep the current per-metric list, but lead with a compact summary block:
- **Electricity**: ΔTWh/year, ΔGWavg, plus 4 “chips” (Solar / Wind / Nuclear / Coal) with equivalents.
- **Urbanization**: Δ urban residents, homes needed (total and per year).
- **CO₂**: ΔMtCO₂/year (with a warning label about uncertainty).

### Tier 2: Small chartlets (sparklines / deltas)
Add one small, high-signal visual per domain:
- Electricity: a “waterfall” or “current → implied” bar with Δ highlighted.
- Tech equivalents: a stacked horizontal bar where each segment is a chosen technology equivalent (user can toggle which tech they’re imagining).
- Urbanization: “urban residents now vs implied” bar, plus homes/year annotation.

### Tier 3: Contextual comparison visuals (optional)
Make the numbers feel real by comparing to known baselines:
- “As many as your current X” (e.g., “+3× current wind capacity”).
- “Equivalent to building X per year” (already partly shown).

### Interaction patterns
- A single “Assumptions” popover (CFs, panel watts, turbine MW, household size) with defaults + reset.
- A toggle for “Show per-year build rate” vs “Total change”.
- A toggle for “Capacity view (GW)” vs “Energy view (TWh/year)” for electricity.

### Most interesting UX extension (recommended)
- Implemented (v1): an optional “technology mix” control (presets + inputs) that allocates ΔTWh across solar/wind/nuclear/coal and converts that into build rates (GW/yr, plants/yr, turbines/yr, panels/yr), plus “× today” multipliers.
- Implemented (v1): “pace realism” by comparing required average annual generation build (TWh/yr) to the country’s best historical 5-year average growth in that source’s generation (computed from OWID electricity-by-source series).

## Engineering Roadmap
### Phase 1 (done / immediate tweaks)
- Wind equivalents included in Electricity buildout.
- Keep assumptions explicit and conservative.

### Phase 2 (data enrichment: OWID/Ember/IRENA)
- Extend importer to include:
  - Electricity generation by source (TWh)
  - Installed capacity by source (GW) where available
- Add “baseline multipliers”: implied delta expressed as “× current solar/wind capacity” and “× current generation”.

Recommended approach:
- Implement OWID energy ingestion first (TWh by source). Then add IRENA solar/wind capacity ingestion for “× today’s fleet” visuals.

### Phase 3 (plant/unit realism)
- Add optional nuclear/coal unit sources (IAEA PRIS / GEM).
- Replace “1‑GW plants” with:
  - “reactors” sized by country/region typical median (configurable)
  - “coal units” sized by country/region typical median

### Phase 4 (built environment + grid)
Add additional macro implications (requires new datasets):
- Peak demand approximation (from load factor heuristics or operator datasets).
- Grid buildout proxy: km transmission/distribution per capita/GDP (if obtainable).
- Building stock proxy: floor area per capita, cement/steel demand (where obtainable).

## Copy / Messaging Guidelines
- Always label as “what-if context” and “template-based estimate”.
- Put assumptions next to equivalents (not hidden).
- Prefer deltas and “per year” rates for visceral impact.
- Avoid overstating precision; show ranges if/when we can support them.

## Open Questions
1) Technology mix control: implemented (v1) with presets + custom mix.
2) Homes needed: default is *net new dwellings* (Δ urban residents / people-per-home). Gross construction (replacement/upgrade) is deferred.
3) Scenario variants: implemented (v1) as explicit multipliers/presets (efficient growth / electrify everything / high industry / high growth horizon preset).
