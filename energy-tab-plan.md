# Energy tab plan

## Why

The Convergence Explorer shows *when* a country catches up. The energy tab shows *what that catch-up path needs in electricity*: how much demand grows, how much new generation has to be built each year, and how much of it could be clean. It gives the energy-growth connection its own viewport, instead of burying it in the implications slide-over.

## The question the tab answers

> "What does this catch-up path need in electricity?"

It does **not** ask when the chaser will match the target's electricity use. That comparison is meaningless: in 2024 Poland already used more electricity per person than the United Kingdom (4,370 vs 4,195 kWh), and Norway used 23,700. Rich countries' electricity use depends on industry, climate, heating and hydro, not only income. So the target country sets the **income** goal, and the tab asks what reaching that income has meant for electricity elsewhere.

## What already exists

Most of the model is built. This work is mainly presentation and state.

| Piece | Where | Reuse |
| --- | --- | --- |
| Income to electricity mapping along a template country's path (China-like, US-like, Europe-like) | `src/lib/templatePaths.ts` | As is: it draws the template path on the chart and gives the projected electricity use per person |
| End-use demand, gross supply, imports, domestic generation gap, new generation TWh, average GW, annual-energy equivalents | `src/lib/implicationsSnapshot.ts` (`buildImplicationsSnapshot`) | As is: it drives the headline and stats |
| Scenarios and generation-mix presets | `implicationsScenarios.ts`, `useImplicationsComputed.ts` (`MIX_PRESETS`) | As is |
| URL state for template, horizon, mix and scenario (`tpl`, `ih`, `imix`, `isc`, …) | `src/lib/shareState.ts` | Add one key (`tab`) |
| Electricity data | `ELECTRICITY_USE_PCAP` (World Bank, 150 countries, mostly 2023–24), `ELECTRICITY_GEN_*` (OWID + Ember, 203 countries, 2024–25), `INSTALLED_CAPACITY_*` (IRENA, Ember), `POPULATION_UN_*` | As is |

The electricity-correctness work in `mountain.md` already guarantees that the panel, thread and URL describe one calculation. The energy tab has to keep that guarantee: it reads the same `implicationsComputed.snapshot` that `App.tsx` already builds, and never recomputes anything.

## Layout (single viewport, 1440×900)

```
┌ Header (unchanged) ─────────────────────────────────────────────┬──────────────┐
│ [Countries|Regions] [Chaser] ⇄ [Target] [Growth | Energy]       │ Sidebar      │
├──────────────────────────────────────────────────────────────────┤ growth       │
│ Poland's path to UK income needs ~X TWh more a year by 2031     │ sliders      │
│ ≈ Y GW of new solar and wind every year                         │ (shared)     │
│  [demand now → then]  [new generation / yr]  [clean share]      │              │
├──────────────────────────────────────────────────────────────────┤ Template     │
│  kWh/person (log)                                                │ path picker  │
│    ·  ·   ·  all countries, latest year (faint)                  │              │
│        ·  ·  ╱ template path (China-like)                        │ Mix preset   │
│   ·  ●━━━━━━○ chaser: trail since 2000 → projection to horizon   │              │
│        ·   ◆ target (for reference only)                         │              │
│  GDP per capita, PPP (log)                     [Chart | Table]   │              │
└──────────────────────────────────────────────────────────────────┴──────────────┘
```

- The **tab switch** sits in the selectors row, next to the metric picker. The metric picker is hidden on the Energy tab, because the x axis is always GDP per capita (PPP).
- **Growth sliders are shared.** Changing the chaser's growth rate on either tab moves both charts.
- The **sidebar** keeps the growth card and replaces "Set a deadline" and the implications trigger with the template picker and mix preset. Everything more technical (grid losses, imports, capacity factors) stays in the existing slide-over, reached from a "Show assumptions" link.
- **Chart | Table** works as on the Growth tab. The table is also the screen-reader alternative to the scatter.

## Decisions to make before building

1. **Y axis series.** World Bank electricity use per person is the right concept (consumption, which the snapshot already uses), but it covers only 150 countries. Generation per person covers 203, but it inflates exporters (Norway, Paraguay, Laos). **Recommendation:** plot consumption, and list the countries it's missing below the table rather than filling them in.
2. **Horizon.** The implications horizon (`ih`, default 25 years) is separate from the convergence year. **Recommendation:** default `ih` to the years to convergence, capped at 50, so the energy tab describes the same path as the headline on the Growth tab. Keep the explicit `ih` in the URL when someone changes it.
3. **Regions mode.** OECD regions have no electricity data. **Recommendation:** disable the Energy tab in regions mode, with a tooltip explaining why, rather than hiding it.
4. **What happens to the slide-over.** **Recommendation:** keep it for now as "Show assumptions". Once the tab ships, decide whether the urbanisation and CO2 cards move to the tab or go.

## Phases

### Phase 1: tab state and routing (v0.2.0)

- Add `tab?: "growth" | "energy"` to `ShareState`, parsed and serialised in `shareState.ts`. Leave it out of the URL when it's `growth`, so existing links don't change.
- Add a `ViewTabs` component in `SelectorsPanel` (a `role="tablist"` with arrow-key navigation) and wire it through `App.tsx`.
- Energy tab body renders a placeholder that reads the existing snapshot.

**Testable:** `?tab=energy` survives reload, back/forward and the share link. Arrow keys move between tabs. Existing share links produce byte-identical URLs. `pnpm test` and the unit tests for `shareState` pass.

### Phase 2: build-time scatter dataset (v0.2.1)

- In `scripts/build-static-data.ts`, emit `energy-scatter.json` into the versioned snapshot. Per country: latest paired `{ gdp, kwh, year }`, plus a yearly trail from 2000, with GDP and electricity joined on the same year.
- Keep it small: about 150 countries × 25 years, well under 100 KB gzipped. Lazy-load it only when the Energy tab opens.

**Testable:** a snapshot test covers the shape. Poland's 2024 point matches the series files. The Growth tab's network requests don't change.

### Phase 3: energy chart (v0.3.0)

- `EnergyChart.tsx`, hand-rolled SVG in the same style as `ConvergenceChart.tsx`, with log-log axes.
- Layers, from back to front: all countries (faint dots), template path (line from `buildTemplateMapping(...).points`), target (reference marker), chaser trail (solid), chaser projection to the horizon (dashed, ending at `electricity.usePerCapitaFuture`).
- Hover or focus on a dot shows country, year, GDP and kWh. Dots are keyboard-reachable only for the chaser, the target and the template countries, not all 150.
- The table view lists the same series.

**Testable:** visual regression snapshots at 375, 768 and 1440 px in light and dark themes. The axe audit passes. The projection end point equals `snapshot.electricity.usePerCapitaFuture` exactly (unit test).

### Phase 4: headline and stats (v0.3.1)

- A `headlineGenerator`-style function turns the snapshot into one sentence: "Poland's path to UK income needs about X TWh more electricity a year by 2031."
- Three stats, all read straight from the snapshot:
  - End-use demand now → at the horizon (TWh/year).
  - New domestic generation per year of the horizon (`newDomesticGenerationTWh / horizonYears`), with its capacity equivalent for the chosen mix from `annualEnergyEquivalents`.
  - Clean share of the new generation under the chosen mix.
- Name each quantity exactly as `mountain.md` does: annual energy (TWh/year) is not average power (GW average), and neither is nameplate capacity (GW).
- Show snapshot warnings (for example, mismatched baseline years) inline under the stats.

**Testable:** the headline and stats match the slide-over and the thread for the same URL (a parity test like the existing one in `implicationsSnapshot.test.ts`). Negative build-out, where demand falls, reads "no new generation needed" and never shows a negative number.

### Phase 5: sidebar controls (v0.4.0)

- On the Energy tab, the sidebar shows the growth card (shared), a template path picker (`tpl`) and a mix preset (`imix`), plus the "Show assumptions" link to the slide-over.
- Everything must fit in 1440×900 with no page scroll, and stack under the chart on mobile, as the current sidebar does.

**Testable:** there's no vertical scroll at 1440×900 or at 1280×800. Keyboard-only use gets through the tab switch → sliders → template → mix → chart → table.

### Phase 6: sharing parity (v0.4.1)

- Share card, OG image (`worker/api/og.png.ts`) and embed get an energy variant when `tab=energy`.
- The thread generator already has electricity cards. Point them at the same snapshot.
- Add all new strings to `public/locales/en/translation.json`.

**Testable:** the OG image for an energy URL shows the energy headline. The e2e share test covers both tabs. No hardcoded strings (the i18n extraction check passes).

### Phase 7: cleanup (v0.5.0)

- Decide the slide-over's future (decision 4). Remove the "Development implications" trigger from the Growth tab if the Energy tab now covers it.
- Update `README.md` features and the data table.

## Out of scope

- **Compute build-out.** No reliable national data yet. Epoch AI's data centre dataset is facility-level, 93 sites. If it's added later, it would be an extra demand layer on this tab.
- **Hourly or system planning.** The tab keeps the existing disclaimer: annual-energy equivalents are not a build plan, and storage, grids and reliability aren't modelled.
- **Regional electricity data.** The OECD regions dataset has none.

## What's next

- Once the tab ships, write it up on actually-maybe as a follow-on to the Convergence Explorer post.
- A possible second chart on the same tab: clean share of generation against GDP per capita, using the Ember generation data that's already loaded.
- Revisit compute as a demand layer if a national data source appears.
