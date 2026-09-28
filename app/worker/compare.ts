import { scenarioAttribution } from "./_lib/chartSvg";
import { countryDisplayName, countrySlug, findCountryBySlug } from "./_lib/countrySlugs";
import { CURATED_PAIRS } from "./_lib/curatedPairs";
import {
  esc,
  HTML_HEADERS,
  MARKDOWN_HEADERS,
  notFoundPage,
  pageShell,
  wantsMarkdown,
} from "./_lib/pageShell";
import { enforceRateLimit } from "./_lib/requestGuards";
import {
  appPath,
  computeScenario,
  DEFAULT_BASE_YEAR,
  DEFAULT_INDICATOR,
  isFailure,
  type RateInput,
  type Scenario,
  scenarioSummary,
} from "./_lib/scenario";
import { SCENARIO_DISCLAIMER, scenarioQuery } from "./_lib/scenarioParams";
import { loadCountries, type StaticDataEnv } from "./_lib/staticData";

const PATH = /^\/compare\/([^/]+)\/([^/]+?)(\.md)?$/;

const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;
const money = (value: number, unit: string | null) =>
  `${unit?.includes("$") ? "$" : ""}${Math.round(value).toLocaleString("en-US")}`;

function parseRate(value: string | null): RateInput {
  const n = value == null || value === "" ? Number.NaN : Number(value);
  return Number.isFinite(n) && n > -0.99 && n <= 1 ? n : "trailing";
}

/** Every 5th projected year plus the convergence year, for the static table. */
function tableRows(s: Scenario) {
  const conv = s.outcome.convergenceYear;
  return s.projection.filter(
    (r, i) => i % 5 === 0 || r.year === conv || i === s.projection.length - 1,
  );
}

function related(iso: string, exclude: string) {
  return CURATED_PAIRS.filter(([a, b]) => (a === iso || b === iso) && `${a}-${b}` !== exclude);
}

function markdown(s: Scenario, origin: string, canonicalUrl: string): string {
  const unit = s.indicator.unit;
  const lines = [
    `# ${s.chaser.name} → ${s.target.name} economic convergence`,
    "",
    `Indicator: ${s.indicator.name}${unit ? ` (${unit})` : ""}`,
    `Latest shared data: ${s.handoff.year}`,
    `${s.chaser.name}: ${money(s.handoff.chaser, unit)}`,
    `${s.target.name}: ${money(s.handoff.target, unit)}`,
    `${s.chaser.name} is at ${((s.handoff.chaser / s.handoff.target) * 100).toFixed(0)}% of ${s.target.name}.`,
    "",
    "## Scenario",
    "",
    `${s.chaser.name} annual growth: ${pct(s.rates.chaser)} (${basis(s.rates.chaserBasis)})`,
    `${s.target.name} annual growth: ${pct(s.rates.target)} (${basis(s.rates.targetBasis)})`,
    "",
    "## Result",
    "",
    scenarioSummary(s),
    "",
    "| Year | " + s.chaser.name + " | " + s.target.name + " |",
    "| --- | ---: | ---: |",
    ...tableRows(s).map(
      (r) => `| ${r.year} | ${money(r.chaser, unit)} | ${money(r.target, unit)} |`,
    ),
  ];
  if (s.caveats.length) {
    lines.push("", "## Data caveats", "");
    for (const c of s.caveats) lines.push(`- **${c.title}.** ${c.explanation}`);
  }
  lines.push(
    "",
    "## Links",
    "",
    `- Explore this scenario: ${origin}${appPath(s)}`,
    `- Chart (SVG): ${origin}/api/chart.svg?${scenarioQuery(s)}`,
    `- JSON: ${origin}/api/convergence?${scenarioQuery(s)}`,
    `- Methodology: ${origin}/methodology`,
    `- Canonical: ${canonicalUrl}`,
    "",
    `Source: ${s.indicator.source ?? "World Bank"}${s.indicator.source_code ? ` ${s.indicator.source_code}` : ""}. ${SCENARIO_DISCLAIMER}`,
    "",
  );
  return lines.join("\n");
}

function basis(b: Scenario["rates"]["chaserBasis"]) {
  return b === "given"
    ? "assumed"
    : b === "trailing_10y_cagr"
      ? "trailing 10-year average"
      : "default assumption";
}

export const onRequestGet: PagesFunction<StaticDataEnv> = async (context) => {
  const limited = enforceRateLimit(context.request, {
    keyPrefix: "compare",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(context.request.url);
  const match = PATH.exec(url.pathname);
  if (!match) return notFoundPage("That comparison URL is not valid.");
  const wantMd = match[3] === ".md" || wantsMarkdown(context.request);

  const countries = await loadCountries(context.env, context.request.url);
  const a = findCountryBySlug(countries, decodeURIComponent(match[1]));
  const b = findCountryBySlug(countries, decodeURIComponent(match[2]));
  if (!a || !b || a.country.iso_alpha3 === b.country.iso_alpha3) {
    return notFoundPage("We could not find both countries in that comparison.");
  }

  const scenario = await computeScenario(context.env, context.request.url, {
    chaser: a.country.iso_alpha3,
    target: b.country.iso_alpha3,
    indicator: DEFAULT_INDICATOR,
    chaserRate: parseRate(url.searchParams.get("cg")),
    targetRate: parseRate(url.searchParams.get("tg")),
    baseYear: DEFAULT_BASE_YEAR,
    adjusted: url.searchParams.get("adjusted") === "true",
  });
  if (isFailure(scenario)) return notFoundPage(scenario.message);

  const base = `/compare/${scenario.chaser.slug}/${scenario.target.slug}`;
  if ((!a.canonical || !b.canonical) && !match[3]) {
    return new Response(null, {
      status: 301,
      headers: {
        location: `${url.origin}${base}${url.search}`,
        "cache-control": "public, max-age=3600",
      },
    });
  }
  const canonicalUrl = `${url.origin}${base}`;
  const curated = CURATED_PAIRS.some(
    ([x, y]) => x === scenario.chaser.iso && y === scenario.target.iso,
  );
  const isDefaultView = !url.searchParams.size;

  if (wantMd) {
    return new Response(markdown(scenario, url.origin, canonicalUrl), {
      headers: MARKDOWN_HEADERS,
    });
  }

  const unit = scenario.indicator.unit;
  const summary = scenarioSummary(scenario);
  const share = (scenario.handoff.chaser / scenario.handoff.target) * 100;
  const title = `${scenario.chaser.name} vs ${scenario.target.name}: GDP per capita convergence`;
  const chartUrl = `/api/chart.svg?${scenarioQuery(scenario)}`;
  const relatedLinks = [
    ...related(scenario.chaser.iso, `${scenario.chaser.iso}-${scenario.target.iso}`),
    ...related(scenario.target.iso, `${scenario.chaser.iso}-${scenario.target.iso}`),
  ]
    .slice(0, 6)
    .flatMap(([x, y]) => {
      const cx = countries.find((c) => c.iso_alpha3 === x);
      const cy = countries.find((c) => c.iso_alpha3 === y);
      return cx && cy ? [{ x: cx, y: cy }] : [];
    });

  const caveats = scenario.caveats.length
    ? `<h2>Data caveats</h2><ul>${scenario.caveats
        .map((c) => `<li><strong>${esc(c.title)}.</strong> ${esc(c.explanation)}</li>`)
        .join("")}</ul>`
    : "";

  const body = `      <h1>${esc(scenario.chaser.name)} vs ${esc(scenario.target.name)}: economic convergence</h1>
      <p>${esc(summary)}</p>
      <p><a class="cta" href="${esc(appPath(scenario))}">Explore this scenario in the calculator →</a></p>
      <img class="chart" src="${esc(chartUrl)}" width="800" height="460" alt="${esc(summary)}" />
      <h2>Latest data (${scenario.handoff.year})</h2>
      <div class="scroll"><table>
        <tr><th>Country</th><th>${esc(scenario.indicator.name)}</th></tr>
        <tr><td>${esc(scenario.chaser.name)}</td><td>${money(scenario.handoff.chaser, unit)}</td></tr>
        <tr><td>${esc(scenario.target.name)}</td><td>${money(scenario.handoff.target, unit)}</td></tr>
      </table></div>
      <p>${esc(scenario.chaser.name)} is at ${share.toFixed(0)}% of ${esc(scenario.target.name)}'s level.</p>
      <h2>Scenario</h2>
      <p>${esc(scenario.chaser.name)} grows ${pct(scenario.rates.chaser)} a year (${basis(scenario.rates.chaserBasis)}) and ${esc(scenario.target.name)} grows ${pct(scenario.rates.target)} a year (${basis(scenario.rates.targetBasis)}). ${esc(SCENARIO_DISCLAIMER)}</p>
      <div class="scroll"><table>
        <tr><th>Year</th><th>${esc(scenario.chaser.name)}</th><th>${esc(scenario.target.name)}</th></tr>
        ${tableRows(scenario)
          .map(
            (r) =>
              `<tr><td>${r.year}</td><td>${money(r.chaser, unit)}</td><td>${money(r.target, unit)}</td></tr>`,
          )
          .join("\n        ")}
      </table></div>
      ${caveats}
      <h2>Use this data</h2>
      <ul>
        <li><a href="${esc(base)}.md">Markdown version</a></li>
        <li><a href="${esc(`/api/convergence?${scenarioQuery(scenario)}`)}">JSON API</a> (see <a href="/openapi.json">OpenAPI</a>)</li>
        <li><a href="${esc(chartUrl)}">Chart as SVG</a></li>
        <li><a href="/methodology">How catch-up time is calculated</a></li>
      </ul>
      ${
        relatedLinks.length
          ? `<h2>Related comparisons</h2><ul>${relatedLinks
              .map(
                ({ x, y }) =>
                  `<li><a href="/compare/${esc(countrySlug(x))}/${esc(countrySlug(y))}">${esc(countryDisplayName(x))} vs ${esc(countryDisplayName(y))}</a></li>`,
              )
              .join("")}</ul>`
          : ""
      }
      <p class="note">Source: ${esc(scenario.indicator.source ?? "World Bank")}${scenario.indicator.source_code ? ` (${esc(scenario.indicator.source_code)})` : ""}. ${esc(scenarioAttribution(scenario))}</p>`;

  const html = pageShell(
    {
      title: `${title} — Mountain to Climb`,
      description: summary,
      canonicalUrl,
      noindex: !(curated && isDefaultView),
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: title,
          description: summary,
          url: canonicalUrl,
          isPartOf: { "@type": "WebSite", name: "Mountain to Climb", url: url.origin },
        },
      ],
    },
    body,
  );
  return new Response(html, { headers: HTML_HEADERS });
};
