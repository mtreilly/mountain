import { describe, expect, it } from "vitest";
import { fixtureImplicationsSnapshot } from "../../scripts/implicationsFixture";
import { generateImplicationsCardSvg } from "./implicationsCardSvg";
import { generateCaptions, generateReadmeFile } from "./threadGenerator";

describe("implications panel/thread parity contract", () => {
  const snapshot = fixtureImplicationsSnapshot();
  const captions = generateCaptions({
    chaserName: "Nigeria",
    targetName: "United States",
    yearsToConvergence: 97,
    convergenceYear: 2120,
    chaserGrowthRate: 0.03,
    targetGrowthRate: 0.01,
    optimisticYears: 77,
    pessimisticYears: 127,
    historicalData: null,
    implicationsData: snapshot,
    appUrl: "https://example.test",
  });
  const svg = generateImplicationsCardSvg({
    chaserName: "Nigeria",
    implicationsData: snapshot,
    theme: "light",
  });

  it("uses exact fixture values before presentation rounding", () => {
    expect(snapshot.electricity.endUseDemandCurrentTWh?.value).toBe(50);
    expect(snapshot.electricity.endUseDemandFutureTWh?.value).toBe(360);
    expect(snapshot.electricity.newDomesticGenerationTWh?.value).toBe(320);
    expect(snapshot.electricity.annualEnergyEquivalents?.nuclear.referenceUnits).toBeCloseTo(
      40.5885337392,
      10,
    );
  });

  it("renders the same rounded values and assumptions in card and caption", () => {
    const implicationResult = captions[3];
    const implicationAssumptions = captions[4];
    for (const text of ["50 → 360 TWh/year", "320 TWh/year", "40.6"]) {
      expect(implicationResult).toContain(text);
    }
    for (const text of ["UN medium", "0% grid losses"]) {
      expect(implicationAssumptions).toContain(text);
    }
    for (const text of ["50 → 360 TWh/yr", "320 TWh/yr", "40.6", "MEDIUM population"]) {
      expect(svg).toContain(text);
    }
  });

  it("splits implications into two tweets within the 280-character limit", () => {
    expect(captions).toHaveLength(5);
    expect(captions[3]).toMatch(/^4\/5 /);
    expect(captions[4]).toMatch(/^5\/5 /);
    expect(captions[3].length).toBeLessThanOrEqual(280);
    expect(captions[4].length).toBeLessThanOrEqual(280);
  });

  it("never mislabels per-capita GDP or the implication horizon", () => {
    expect(svg).toContain("GDP PER CAPITA");
    expect(svg).not.toContain("GDP (TOTAL)");
    expect(svg).not.toContain("What convergence means");
    expect(captions[3]).toContain("illustrative 22-year electricity scenario");
  });

  it("exports the full assumption and provenance record", () => {
    const readme = generateReadmeFile("NGA", "USA", snapshot);
    for (const text of [
      "UN medium scenario",
      "Grid losses: 0%",
      "Net imports: 0% of gross supply",
      "Capacity factors:",
      "Generation mix:",
      "Penn World Table",
      "UN World Population Prospects",
      "World Bank",
      "Our World in Data",
      "not a forecast",
    ]) {
      expect(readme).toContain(text);
    }
  });
});
