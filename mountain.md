# Electricity implications correctness and thread-parity plan

## Purpose

Make the electricity implications understandable, internally consistent, reproducible, and identical everywhere they appear. The panel, implication card, thread caption, downloadable package, and shared URL must all describe one calculation rather than independently rebuilding parts of it.

This work is a model and data-contract correction, not only a wording change. The current arithmetic primitives are mostly sound, but several values are calculated from different denominators or assumptions, current values come from different years without saying so, and the thread reconstructs a different scenario from the panel.

## Outcome

After this work, a user should be able to answer these questions without reverse-engineering the app:

1. What is the current observed electricity consumption?
2. What is the projected end-use electricity demand in the selected horizon year?
3. How much gross electricity supply is required after grid losses?
4. How much of that supply is assumed to be imported?
5. How much additional domestic annual generation is required above the observed domestic-generation baseline?
6. What installed capacity or number of reference units would produce that annual energy under the selected capacity-factor assumptions?
7. Which years, sources, population variant, template, and assumptions produced the result?
8. Does the thread show exactly the same values as the open implications panel?

## Current issues to correct

### 1. The panel and thread do not share one calculation result

`ImplicationsSlideOver.tsx` owns scenario, population, technology, loss, import, and mix state locally. `ThreadGeneratorModal.tsx` separately loads data and calls `useImplicationsComputed` with defaults. Only the template and horizon are currently shared through `App.tsx`.

Consequences:

- A user can change the population assumption, scenario, grid loss, net imports, capacity factors, reference-unit sizes, or generation mix in the panel and then export a thread that silently uses different values.
- Closing the slide-over unmounts it and resets its local assumptions.
- The panel and thread can drift further whenever either implementation changes.

### 2. Three different electricity concepts are blurred together

The current UI uses variants of “demand,” “electricity required,” and “generation needed” for values that are not interchangeable:

- End-use electricity demand is derived from per-capita electricity consumption and population.
- Required gross supply/generation must cover end-use demand plus grid losses.
- Required domestic generation also reflects the assumed share met by net imports.
- New generation buildout is the gap between future required domestic generation and observed current domestic generation.

The UI needs to name each quantity explicitly and preserve its unit as annual energy (`TWh/year`). Average power (`GW average`) and installed nameplate capacity (`GW`) must not be presented as the same quantity.

### 3. Technology comparisons use two different numerators

The headline “New generation needed” uses the buildout calculation:

```text
future required domestic generation - observed current generation
```

But the panel's solar-panel, wind-turbine, and nuclear-unit rows are recomputed from:

```text
future end-use demand - current end-use demand
```

This produces conflicting answers. In the audited Nigeria example, the headline was about 115 TWh/year while the technology rows were based on about 111 TWh/year. Both sets of arithmetic can be internally valid, but comparing them under one label is incorrect.

Every technology comparison must consume the snapshot's one canonical non-negative `newDomesticGenerationTWh` value.

### 4. The thread labels GDP per capita as total GDP

`ThreadGeneratorModal.tsx` currently passes the chart's per-capita GDP values as `gdpCurrent` and `gdpFuture`. `implicationsCardSvg.ts` labels those values `GDP (TOTAL)`. This is factually wrong.

The corrected snapshot must contain separately named `gdpPerCapita` and `gdpTotal` fields. The thread card should preferably show `GDP per capita` because that is the projection driving the template lookup. If it shows total GDP instead, it must render the snapshot's population-adjusted total GDP values and label their constant PPP unit.

### 5. The thread calls a fixed-horizon scenario “convergence”

The implication horizon is configurable and usually 25 years. It is not the calculated convergence year and can exist even when convergence occurs much later or never occurs. “What convergence means by 2048” is therefore misleading.

Replace it with language such as:

```text
Illustrative 25-year electricity scenario for Nigeria
```

or:

```text
Electricity implications at the projected 2048 income level
```

No implication surface should claim that convergence occurs in the implication horizon unless the convergence calculation actually says so.

### 6. Population is extrapolated from a short historical CAGR for as long as 150 years

The current default compounds a trailing ten-year population CAGR, capped between -3% and +5%, across the full implication horizon. This is a weak demographic model and becomes implausible over long horizons.

Replace it with official UN World Population Prospects medium, low, and high variants. WPP 2024 provides annual estimates and projections through 2100 and explicitly describes low and high as deterministic scenarios rather than confidence bounds. Pin and expose the source vintage rather than silently changing results when the upstream dataset changes.

Authoritative references:

- [UN World Population Prospects data portal and downloads](https://population.un.org/wpp/)
- [WPP 2024 methodology](https://www.un.org/development/desa/pd/node/4326)

### 7. “Current” combines observations from different years

For the audited live Nigeria result, electricity consumption, GDP/population, electricity generation, and installed capacity came from different observation years. The panel presents them together as current without showing those years. It can also multiply the latest electricity-consumption observation by a population from another year.

Every observed value must carry an `observedYear`, source, and source vintage. Derived current totals must align their inputs to one stated year. In particular, current end-use demand should use population for the electricity-consumption observation year, not an unrelated latest population value.

### 8. Net-import semantics are ambiguous and the formula is inconsistent

The current calculation is:

```text
future demand / (1 - grid loss fraction) - future demand * net import fraction
```

The import adjustment is applied to end-use demand while the domestic-generation requirement is a gross-supply quantity. The meaning of the percentage is not stated.

Define `netImportShare` as a share of required gross electricity supply:

```text
required gross supply = future end-use demand / (1 - grid loss fraction)
required domestic generation = required gross supply * (1 - net import share)
```

A positive value means imports supply that share; a negative value means net exports add to domestic-generation requirements. Clamp and validate the range in the pure calculation function, and show the definition next to the control.

### 9. Plant counts overstate what the model proves

The technology counts are annual-energy equivalences. They do not model peak demand, hourly matching, storage, firm capacity, reserve margins, outages beyond the capacity-factor assumption, curtailment, transmission, distribution, siting, construction schedules, or system reliability.

Rename all such output to “annual-energy equivalent” or “equivalent annual output.” Examples:

- `Annual-energy equivalent: 14.6 × 1-GW nuclear units at 90% capacity factor`
- `Annual-energy equivalent: 65.7 GW solar at 20% capacity factor`
- `Annual-energy equivalent: 12.4 million 400-W panels at 20% capacity factor`

The UI and thread must state that these alternatives each produce the same annual energy; they are not a recommended build plan and are not mutually additive.

### 10. Source attribution is incomplete

The implication thread footer currently inherits the selected GDP source, usually Penn World Table, even though the result also depends on World Bank electricity consumption, UN population projections, and OWID/Ember electricity generation and capacity data.

The snapshot must contain structured provenance. The card should show a compact source line and the downloadable thread README or caption should include the full source list and observation years.

### 11. Existing tests do not establish empirical correctness or cross-surface parity

The E2E test mainly checks that values are finite and that no `NaN` appears. Snapshot tests freeze rendered strings but do not prove the strings came from the same calculation. `useImplicationsComputed` lacks an exact known-number fixture, and there is no assertion that the panel, SVG, and caption render identical snapshot fields.

The new tests must validate formulas, exact fixture outputs, observation-year alignment, assumption propagation, and panel/thread parity.

## Target calculation contract

### Pure input type

Create a framework-independent module, proposed as `app/src/lib/implicationsSnapshot.ts`. React hooks may prepare inputs, but this module must perform all implication calculations without reading React state or fetching data.

```ts
type PopulationVariant = "medium" | "low" | "high";

type ObservedValue = {
  value: number;
  year: number;
  unit: string;
  source: string;
  sourceCode: string | null;
  sourceVintage: string | null;
};

type ImplicationsAssumptions = {
  horizonYears: number;
  templateId: TemplateId;
  scenarioId: ScenarioId;
  populationVariant: PopulationVariant;
  gridLossPct: number;
  netImportSharePct: number;
  capacityFactors: {
    solar: number;
    wind: number;
    nuclear: number;
    coal: number;
  };
  referenceUnits: {
    solarPanelWatts: number;
    windTurbineMW: number;
    nuclearUnitGW: number;
    coalUnitGW: number;
  };
  generationMixPct: Record<"solar" | "wind" | "nuclear" | "coal", number>;
  householdSize: number;
};

type ImplicationsSnapshotInput = {
  country: { iso3: string; name: string };
  gdpPerCapitaCurrent: ObservedValue;
  gdpPerCapitaGrowthRate: number;
  populationCurrent: ObservedValue;
  populationProjection: ObservedValue;
  electricityUsePerCapitaCurrent: ObservedValue | null;
  populationAtElectricityUseYear: ObservedValue | null;
  electricityGenerationCurrent: ObservedValue | null;
  templateMetricInputs: ...;
  installedCapacityInputs: ...;
  assumptions: ImplicationsAssumptions;
};
```

The concrete types should avoid a generic untyped record where practical. Invalid or missing inputs should produce a typed unavailable result with a reason rather than `NaN`, `Infinity`, or a misleading zero.

### Immutable output type

The output should be the only object consumed by implication renderers:

```ts
type ImplicationsSnapshot = {
  schemaVersion: 1;
  country: { iso3: string; name: string };
  horizon: {
    baseYear: number;
    years: number;
    targetYear: number;
  };
  assumptions: ImplicationsAssumptions;
  gdp: {
    perCapitaCurrent: ObservedValue;
    perCapitaFuture: { value: number; year: number; unit: string };
    totalCurrent: { value: number; year: number; unit: string } | null;
    totalFuture: { value: number; year: number; unit: string } | null;
  };
  population: {
    current: ObservedValue;
    future: ObservedValue;
    variant: PopulationVariant;
  };
  electricity: {
    usePerCapitaCurrent: ObservedValue | null;
    endUseDemandCurrentTWh: DerivedValue | null;
    endUseDemandFutureTWh: DerivedValue | null;
    endUseDemandChangeTWh: DerivedValue | null;
    grossSupplyRequiredFutureTWh: DerivedValue | null;
    importsFutureTWh: DerivedValue | null;
    domesticGenerationRequiredFutureTWh: DerivedValue | null;
    domesticGenerationObservedCurrentTWh: ObservedValue | null;
    domesticGenerationGapTWh: DerivedValue | null;
    newDomesticGenerationTWh: DerivedValue | null;
    newDomesticGenerationAverageGW: DerivedValue | null;
    annualEnergyEquivalents: {
      solar: ...;
      wind: ...;
      nuclear: ...;
      coal: ...;
    } | null;
  };
  otherMetrics: ...;
  provenance: SourceReference[];
  warnings: SnapshotWarning[];
};
```

Important naming rules:

- Use `TWh` for an amount of annual energy and display it as `TWh/year` where ambiguity is possible.
- Use `averageGW` only for energy divided by hours per year.
- Use `installedGW` for capacity adjusted by capacity factor.
- Preserve the signed `domesticGenerationGapTWh` for analytical truth.
- Define `newDomesticGenerationTWh = max(0, domesticGenerationGapTWh)` for buildout displays.
- Do not call an energy value “capacity.”
- Do not expose ambiguous names such as `electricityDeltaTWh` or `nuclearPlants`.

### Canonical equations

All values should be computed at full precision and rounded only by renderers.

```text
targetYear = gdpObservationYear + horizonYears

future GDP per capita
  = current GDP per capita * (1 + annual GDP-per-capita growth rate) ^ horizonYears

current end-use demand (TWh/year)
  = observed electricity use (kWh/person/year)
  * population in that same observation year
  / 1,000,000,000

future end-use demand (TWh/year)
  = implied future electricity use (kWh/person/year)
  * UN population projection for targetYear and selected variant
  / 1,000,000,000

required gross supply (TWh/year)
  = future end-use demand / (1 - grid loss fraction)

net imports (TWh/year)
  = required gross supply * net import share

required domestic generation (TWh/year)
  = required gross supply - net imports
  = required gross supply * (1 - net import share)

signed domestic-generation gap (TWh/year)
  = required domestic generation - observed domestic generation

new domestic generation buildout (TWh/year)
  = max(0, signed domestic-generation gap)

average output (GW average)
  = annual energy (TWh/year) * 1000 / 8760

installed capacity for technology t (GW)
  = new domestic generation (TWh/year) / (8.76 * capacity factor[t])

reference units for technology t
  = installed capacity for technology t / reference unit size in GW
```

For panels and turbines, convert their nameplate rating to GW before division. Every technology calculation must begin with `newDomesticGenerationTWh`; no renderer may calculate an alternative denominator.

### Validation and unavailable states

The pure calculator should validate these invariants:

- All observed values are finite and non-negative where required.
- GDP growth rate is greater than `-1`.
- Grid loss is within the UI-supported range and strictly below 100%.
- Net-import share is within the supported range.
- Capacity factors are greater than zero and at most one.
- Reference-unit sizes are greater than zero.
- Generation-mix entries are non-negative and normalize to 100% for calculation.
- The requested target year exists in the selected WPP vintage.
- Current end-use demand uses a population point for the electricity-use observation year.

If a required observation is absent, return `null` for the affected branch plus a machine-readable warning such as `missing_current_generation`, `population_year_unavailable`, or `electricity_population_year_mismatch`. Do not substitute zero, the latest unrelated point, or a historical CAGR.

## Population data implementation

### Data representation

Use separate indicator codes so the existing `UNIQUE(country_id, indicator_id, year)` constraint remains valid:

- `POPULATION_UN_MEDIUM`
- `POPULATION_UN_LOW`
- `POPULATION_UN_HIGH`

Add all three to `schema.sql` with:

- Unit: `persons`
- Source: `UN World Population Prospects`
- Source code identifying the WPP variant
- Category: `demographic`

Keep `POPULATION` for existing non-implication uses. The implications engine should use the pinned UN series for both its population anchor and future projection so that current/future totals are internally coherent. Where a current value is needed for an older electricity observation year, select the UN estimate for that exact year.

### Ingestion

Add `app/scripts/fetch-un-wpp.ts` and include it in `data:fetch` before the final SQL import. The script should:

1. Download the official bulk CSV rather than scrape the portal.
2. Pin the expected WPP revision and record it as `source_vintage`, initially `un-wpp@2024` unless a deliberately reviewed newer revision is adopted.
3. Validate required columns and variant labels before emitting SQL.
4. Map UN location identifiers/names to the repository's ISO3 countries deterministically.
5. Import annual total population values for medium, low, and high variants through 2100.
6. Reject duplicate country/variant/year rows.
7. Report unmapped countries and fail if coverage falls below an explicit threshold.
8. Add script tests using a small checked-in fixture, not a live network call.

Do not silently follow a moving “latest” download URL in production refreshes. Updating the pinned WPP revision should be its own reviewed data change with fixture and snapshot updates.

### Horizon policy

Implication projections must not extend beyond the latest year in the pinned WPP dataset. With WPP 2024, that is 2100.

- Set the implication-horizon control maximum dynamically to `maxProjectionYear - GDP observation year`.
- Clamp old shared URLs to the supported range and show a non-blocking notice that the horizon was adjusted.
- Keep the main convergence chart's longer horizon independent if desired; only the implication model is constrained.
- Never extrapolate beyond 2100 and never silently revert to CAGR.

### Population control wording

Replace `Population: 10y trend/static` with:

- `UN medium scenario`
- `UN low scenario`
- `UN high scenario`

Add a short note: “Low and high are UN demographic scenarios, not confidence bounds.” Show `WPP 2024` (or the pinned revision) and the target-year population beside the selection.

## Shared assumption state

### Lift state to `App.tsx`

Define one `ImplicationsControlsState` containing:

- Template
- Horizon
- Scenario
- Population variant
- Grid-loss percentage
- Net-import share
- Capacity factors
- Reference-unit sizes
- Household size
- Generation mix
- Active implication card/mode

Initialize it once in `App.tsx` and pass the same state and update callback to both `ImplicationsSlideOver` and `ThreadGeneratorModal`. Remove the slide-over's local copies of scenario, population, assumptions, and mix state.

Scenario buttons should apply a complete, documented preset in one state update. Decide and test whether changing away from a scenario preserves manual edits or resets them; the recommended behavior is:

- Selecting a preset copies its values into controls.
- A later manual change labels the state `Custom` rather than continuing to claim the untouched preset.
- Selecting `Baseline` explicitly restores baseline defaults.

### Shared URLs

Extend `ShareState` so a shared URL can reproduce the implication result. Omit default values to keep URLs compact, but parse and serialize at least:

- Population variant
- Scenario/custom marker
- Grid loss
- Net-import share
- Capacity factors
- Reference-unit sizes
- Generation mix

Version the URL contract and add round-trip tests. Invalid values should be clamped or rejected consistently with the calculator. If URL expansion is intentionally deferred, document that only in-session thread parity is guaranteed; full reproducibility should remain a required follow-up before calling the feature complete.

## Data loading and snapshot construction

### Refactor responsibilities

Use this flow:

```text
App-owned ImplicationsControlsState
              +
useImplicationsData (fetch and normalize observations with metadata)
              +
buildImplicationsSnapshot (pure calculation)
              |
              +--> ImplicationsSlideOver
              +--> implication SVG card
              +--> thread caption
              +--> thread README/source note
```

`useImplicationsData.ts` should return typed series points with source metadata for every implication input, not only total generation. Extend `include_source_vintage` usage to all implication indicators whose provenance is displayed.

Replace the calculation body inside `useImplicationsComputed.ts` with:

1. Data selection and mapping preparation.
2. One call to `buildImplicationsSnapshot`.
3. Memoized presentation-only helpers if still necessary.

Alternatively rename the hook to `useImplicationsSnapshot` once the old return shape is removed. Do not keep a second legacy macro calculation alongside the snapshot.

### Observation-year selection

Apply deterministic selection rules:

- GDP base year: the exact observation represented by `gdpCurrent`, not the UI's nominal `baseYear` when those differ.
- Horizon target year: GDP observation year plus selected horizon.
- Electricity-use baseline: its latest available observation, with its own displayed year.
- Current demand population: UN population for the electricity-use observation year.
- Current domestic generation: latest valid total-generation observation, with its own displayed year.
- Capacity baseline: each source's exact observation year; do not show one maximum year as if all capacity inputs share it.

Because current demand and current generation can legitimately have different years, label both. The buildout comparison should say “above observed generation in YEAR,” not simply “above current generation.” Add a warning when the gap between the two baseline years exceeds a defined threshold such as three years.

## Panel redesign and copy

### Electricity result hierarchy

Present the calculation as a short waterfall rather than disconnected cards:

1. `End-use demand`: current observed-year value → target-year value.
2. `Gross supply required`: target-year demand adjusted for grid losses.
3. `Net imports`: amount supplied by imports under the selected share.
4. `Domestic generation required`: gross supply less net imports.
5. `New domestic generation`: amount above observed generation in its stated year.

For example:

```text
Illustrative electricity scenario to 2048

End-use demand                 31 TWh/yr (2022) → 142 TWh/yr (2048)
Gross supply required          158 TWh/yr         10% grid-loss assumption
Assumed net imports             16 TWh/yr         10% of gross supply
Domestic generation required  142 TWh/yr
Observed domestic generation   43 TWh/yr (2023)
New domestic generation        99 TWh/yr
```

The numbers above are illustrative; tests and UI must use the snapshot values.

### Technology comparisons

Add a visible lead-in:

```text
Ways to produce the same 99 TWh/year of additional annual generation
```

Each row should show:

- Annual-energy-equivalent label
- Installed GW required
- Reference-unit count where useful
- Capacity-factor and unit-size assumptions
- The shared source value, ideally in an accessible details/tooltip line

Do not label these rows “plants needed.” Prefer “equivalent annual output from …”. Retain a disclaimer that system planning requires hourly demand, reliability, storage, networks, reserves, and construction constraints.

### Current-value years and sources

Display years inline, not only in a distant footer:

- `GDP per capita (2023)`
- `Population (2023 estimate)`
- `Electricity use (2022)`
- `Generation (2023)`
- `Installed solar capacity (2024)`

Add a “Sources and assumptions” disclosure with full dataset names, indicator codes, observation years, and source vintages from `snapshot.provenance`.

### Scenario framing

Use “illustrative scenario,” not “forecast” or an unconditional statement of need. Replace language implying precision with language connecting the output to selected assumptions.

Recommended summary:

```text
Under the selected income, population, loss, and import assumptions, annual
end-use electricity demand rises from X TWh in YEAR to Y TWh in TARGET YEAR.
That corresponds to Z TWh/year of additional domestic generation above the
observed YEAR baseline.
```

## Thread-card and caption redesign

### Input contract

Delete the current narrow `ImplicationsData` type from `threadGenerator.ts`. `generateImplicationsCardSvg` and `generateCaptions` should accept either the complete immutable `ImplicationsSnapshot` or a presentation DTO created by one pure `toImplicationsThreadModel(snapshot)` adapter.

The adapter may round or shorten labels, but it must never calculate GDP, demand, buildout, or technology equivalents. This separation makes parity testable.

### Card content

Recommended card structure:

```text
NIGERIA · ILLUSTRATIVE 25-YEAR SCENARIO

End-use demand
31 TWh/yr (2022)  →  142 TWh/yr (2048)

New domestic generation
115 TWh/yr above observed 2023 generation

Annual-energy equivalent
≈14.6 × 1-GW nuclear units at 90% capacity factor

UN medium population · 10% losses · 0% net imports · China-like template
Sources: PWT; World Bank; UN WPP 2024; OWID/Ember
Scenario, not forecast
```

Use the actual selected technology for the highlighted equivalent if the product adds such a control. Until then, nuclear may remain the concise reference, but its capacity factor and unit size must be visible and it must be described as an annual-energy equivalent.

Remove `GDP (TOTAL)` or replace it with correctly typed GDP-per-capita values. Do not add total GDP unless the snapshot's total fields are used.

### Caption content

Recommended format:

```text
4/4 An illustrative 25-year electricity scenario for Nigeria:

⚡ End-use demand: 31 → 142 TWh/year
🏗 New domestic generation: 115 TWh/year above 2023 output
≈ Annual output of 14.6 1-GW nuclear units at 90% capacity factor

Assumptions: UN medium population, 10% grid losses, 0% net imports,
China-like development path. Scenario, not forecast.

APP_URL
```

Do not call this “what convergence means” unless the target year equals a valid convergence year. Include the selected assumptions rather than generic boilerplate.

### Source attribution in exports

The visible card can use a concise list. Add full provenance to `README.txt` in the downloaded thread package, including:

- Dataset and indicator name
- Provider
- Observation year
- Source vintage
- URL where available
- The exact selected assumptions

This makes the export independently interpretable after it leaves the app.

## Testing plan

### 1. Pure formula unit tests

Add `app/src/lib/implicationsSnapshot.test.ts` using Vitest. Cover:

- GDP compounding.
- kWh/person × persons to TWh/year.
- Loss adjustment.
- Net imports as a share of gross supply.
- Required domestic generation.
- Signed generation gap and non-negative buildout.
- TWh/year to average GW.
- Installed GW and reference-unit equivalents at each capacity factor.
- Mix normalization.
- Negative-growth and zero-buildout cases.
- Missing data and invalid assumption errors.
- No extrapolation beyond the WPP data range.

Use `toBeCloseTo` only at an explicitly justified precision for floating-point operations. Also assert exact serialized/rounded presentation values where users see them.

### 2. One canonical numeric fixture

Create a checked-in fixture, proposed as `app/src/test/fixtures/implications-nigeria.ts`, with deliberately simple, fixed inputs and observation years. Include:

- GDP per capita and year.
- GDP growth and horizon.
- Medium/low/high UN population points.
- Electricity-use per-capita observation and same-year population.
- Observed generation and year.
- Loss/import assumptions.
- Capacity factors and reference-unit sizes.
- Template-mapping inputs sufficient to produce a known implied electricity value.

Calculate and document expected full-precision outputs by hand in the fixture comments. Tests should assert every intermediate and final field, not only the headline.

Example fixture math suitable for easy review:

```text
future end-use demand       = 100.000 TWh/year
grid loss                  = 10%
gross supply required      = 111.111111111 TWh/year
net imports                = 11.111111111 TWh/year (10% of gross)
domestic generation needed = 100.000 TWh/year
observed generation        = 40.000 TWh/year
new domestic generation    = 60.000 TWh/year
nuclear equivalent         = 60 / (8.76 * 0.90 * 1.0)
                           = 7.610350076 units
```

Use a second real-shape regression fixture reflecting the audited Nigeria data so accidental changes to production-shaped selection logic are caught.

### 3. Population-variant tests

Assert that:

- Medium, low, and high select the exact target-year series point.
- Current population is selected for the requested observation year.
- Switching the variant changes population-dependent future values but not observed current values.
- A missing country/year/variant produces a typed unavailable state.
- A horizon beyond 2100 is rejected or clamped before calculation, never extrapolated.
- The displayed source vintage is the fixture's pinned WPP revision.

### 4. Cross-surface parity tests

Build the snapshot once from the canonical fixture, then pass that exact object to:

- Panel presentation selectors/components.
- `generateImplicationsCardSvg`.
- `generateCaptions`.
- Thread README/provenance formatter.

Assert that all surfaces contain the same rounded values for:

- Target year.
- Current and future end-use demand.
- New domestic generation buildout.
- Highlighted technology equivalent.
- Population variant.
- Grid-loss and net-import assumptions.
- Relevant observation years.

Add a guard test that searches implication renderer code for forbidden recomputation helpers such as `Math.pow` or TWh/capacity-factor formulas. Rendering modules should format snapshot fields only.

### 5. Assumption propagation component test

Add a React Testing Library test that:

1. Creates App-level implication state.
2. Selects UN low, an efficient scenario, 7% losses, a nonzero import share, and custom capacity factors in the panel.
3. Closes the panel.
4. Opens the thread modal.
5. Asserts that its snapshot/card/caption contains those exact selections and values.

Also test preset-to-custom behavior and reopening the panel without state reset.

### 6. E2E tests

Upgrade `app/e2e/implications.spec.ts` to assert known values from `mockApi.ts`, not only finiteness. Add:

- Inline observation-year assertions.
- Medium/low/high variant switching.
- Exact waterfall values.
- One shared buildout number feeding all technology rows.
- Thread generation after changing assumptions.
- Exact parity between visible panel summary and thread preview/caption.
- No “GDP (TOTAL)” when per-capita values are supplied.
- No “What convergence means” for a fixed non-convergence horizon.

Continue the `NaN`/`undefined` smoke checks as a secondary safeguard.

### 7. Snapshot and property tests

Update `implicationsCard.svg.snap` and `thread-captions.snap` only after numeric assertions pass. Snapshots are presentation regression tests, not calculation proofs.

Extend property tests with invariants:

- Higher future population cannot lower demand when per-capita use is fixed and positive.
- Higher grid losses cannot lower required gross supply.
- Higher net-import share cannot increase required domestic generation.
- Higher capacity factor cannot increase required installed capacity for fixed annual energy.
- Every technology equivalent reconstructs the same buildout TWh within tolerance.
- `newDomesticGenerationTWh` is never negative, while the signed gap may be.

## Implementation sequence

### Phase 0: Lock current behavior and fixture inputs

1. Capture a production-shaped Nigeria fixture with all source years and vintages.
2. Add characterization tests for the current calculation to make intentional changes visible.
3. Record the known current discrepancies in test names/comments so they are not accidentally preserved as desired behavior.

Exit criterion: the team can reproduce the audited current numbers locally from fixed inputs without a network call.

### Phase 1: Add UN WPP data

1. Add the three UN population indicators to `schema.sql`.
2. Implement and test `fetch-un-wpp.ts` with a pinned revision.
3. Add it to `data:fetch` and local/production import procedures.
4. Extend API mocks and implication data loading for all three series and vintages.
5. Verify country coverage and target-year availability through 2100.

Exit criterion: a batch-data request returns medium/low/high annual population points with `source_vintage` for fixture countries.

### Phase 2: Build the pure snapshot engine

1. Introduce explicit observed/derived/source types.
2. Move formula helpers out of the React hook.
3. Implement the canonical electricity waterfall and validation rules.
4. Compute every technology equivalent from one buildout value.
5. Add exact unit tests and property invariants.

Exit criterion: the canonical fixture passes exact intermediate/final assertions without rendering React.

### Phase 3: Centralize controls and data flow

1. Lift all implication controls into `App.tsx`.
2. Implement preset/custom state semantics.
3. Extend share-state parse/serialize behavior.
4. Make one hook create one snapshot from shared controls and normalized data.
5. Pass that snapshot to the panel and thread.

Exit criterion: changing any supported implication control changes one snapshot and survives panel close/reopen.

### Phase 4: Correct the panel

1. Replace the existing electricity summary with the labeled waterfall.
2. Show observation years inline.
3. Replace CAGR controls with UN variants.
4. Rename and reframe technology comparisons as annual-energy equivalents.
5. Add assumptions, provenance, and system-planning limitations.
6. Remove renderer-side technology calculations.

Exit criterion: every electricity number on the panel maps directly to a named snapshot field.

### Phase 5: Correct the thread and exports

1. Remove the old `ImplicationsData` reconstruction.
2. Render the shared snapshot or presentation adapter.
3. Fix GDP per-capita/total labeling.
4. Remove false convergence wording.
5. Add selected assumptions and observation years.
6. Add complete source provenance to the export README.

Exit criterion: the thread has no calculation path independent of the panel snapshot.

### Phase 6: Prove parity and polish

1. Add cross-surface fixture tests.
2. Upgrade component/E2E assertions to exact values.
3. Update SVG and visual snapshots.
4. Run typecheck, Biome, ESLint, unit, component, E2E, accessibility, and visual suites.
5. Run React Doctor and address any score regression before commit.

Exit criterion: all automated checks pass and a manual spot check confirms the panel, card, caption, and README show the same values and assumptions.

## File-level change map

### New files

- `app/src/lib/implicationsSnapshot.ts` — pure types, validation, and calculation.
- `app/src/lib/implicationsSnapshot.test.ts` — exact unit and invariant tests.
- `app/src/lib/implicationsPresentation.ts` — optional pure snapshot-to-panel/thread formatting selectors.
- `app/src/test/fixtures/implications-nigeria.ts` — canonical fixed fixture and expected results.
- `app/scripts/fetch-un-wpp.ts` — pinned UN WPP ingestion.
- `app/scripts/fixtures/un-wpp-sample.csv` — ingestion test fixture.

### Major edits

- `app/schema.sql` — add UN medium/low/high indicators.
- `app/package.json` — add WPP ingestion to `data:fetch` and any focused test script.
- `app/src/App.tsx` — own shared implication controls/snapshot and pass them to both surfaces.
- `app/src/lib/shareState.ts` — serialize and parse reproducible implication assumptions.
- `app/src/components/implications/useImplicationsData.ts` — load UN variants and source metadata.
- `app/src/components/implications/useImplicationsComputed.ts` — shrink to input preparation plus the pure snapshot call, or replace with `useImplicationsSnapshot.ts`.
- `app/src/components/implications/ImplicationsSlideOver.tsx` — remove duplicate formulas, render the waterfall, years, assumptions, and annual-energy equivalents.
- `app/src/components/ThreadGeneratorModal.tsx` — consume the same state/snapshot; remove default-only recomputation.
- `app/src/lib/threadGenerator.ts` — generate captions from the snapshot/presentation model and correct language.
- `app/src/lib/implicationsCardSvg.ts` — render snapshot fields and complete sources; fix GDP labeling.
- `app/functions/api/batch-data.ts` and `app/src/hooks/useBatchData.ts` — only if richer source metadata or projection flags need to be returned consistently.
- `app/e2e/support/mockApi.ts` — add deterministic WPP series, observation years, and vintages.
- `app/e2e/implications.spec.ts` — exact-value and panel/thread-parity assertions.
- `app/scripts/snapshot.test.ts` and implication/thread snapshots — new DTO and corrected copy.
- `app/scripts/property.test.ts` — snapshot invariants.
- `app/src/lib/dataSourceUrls.ts` — UN WPP source URL and metadata.

### Remove or deprecate

- Historical population CAGR as an implication option.
- `PopAssumption = "trend" | "static"` in implication code.
- Renderer-local demand and technology formulas in `ImplicationsSlideOver.tsx`.
- The ambiguous `ImplicationsData.electricityDeltaTWh` and `nuclearPlants` interface.
- Any thread-only call that rebuilds implication values with default assumptions.
- Copy containing `GDP (TOTAL)` for per-capita data or `What convergence means by ...` for a fixed implication horizon.

## Acceptance criteria

The work is complete only when all of the following are true:

- [x] One immutable `ImplicationsSnapshot` is calculated per active implication scenario.
- [x] The panel, SVG card, caption, and export README receive that same snapshot or a pure presentation DTO derived from it.
- [x] No implication renderer recomputes GDP, demand, buildout, capacity, or reference-unit counts.
- [x] End-use demand, gross supply, net imports, domestic generation, and new buildout are separately named and displayed.
- [x] Net imports are explicitly defined as a percentage of gross supply and the formula implements that definition.
- [x] Every technology comparison uses `newDomesticGenerationTWh` as its annual-energy numerator.
- [x] Every plant/panel/turbine comparison says “annual-energy equivalent” or equivalent wording.
- [x] Population comes from a pinned UN WPP medium/low/high series, with no historical-CAGR fallback.
- [x] Implication horizons beyond the UN data range cannot produce a numeric result.
- [x] Current values display their actual observation years.
- [x] Current electricity demand uses population aligned to the electricity-use observation year.
- [x] Thread GDP values are correctly labeled per capita or are true population-adjusted totals.
- [x] Fixed-horizon implication copy does not claim to be the convergence year.
- [x] All selected assumptions survive closing the panel and appear in the generated thread.
- [x] Shared URLs reproduce all material implication assumptions.
- [x] The thread cites every material data family, not only GDP.
- [x] The UI explicitly calls the output an illustrative scenario, not a forecast or complete power-system plan.
- [x] Exact fixture tests assert every major intermediate value.
- [x] Automated tests assert exact panel/card/caption parity.
- [x] Unit, property, component, E2E, accessibility, visual, lint, typecheck, build, and React Doctor checks pass without regression.

## Recommended delivery boundaries

This should be delivered as a small sequence of reviewable commits rather than one mixed change:

1. `Add pinned UN population projection data`
2. `Introduce shared implications snapshot engine`
3. `Centralize implications controls and share state`
4. `Clarify electricity implications panel`
5. `Align implication thread card and captions`
6. `Add exact implication parity coverage`

Do not deploy the corrected thread card before the shared snapshot and parity tests land. Fixing the labels alone would make the output read better while leaving the underlying disagreement intact.
