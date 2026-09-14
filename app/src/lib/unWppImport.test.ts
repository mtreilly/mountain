import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsvLine, populationSql, WPP_VINTAGE } from "../../scripts/fetch-un-wpp";

describe("UN WPP importer", () => {
  it("parses quoted CSV fields", () => {
    expect(parseCsvLine('1,"Congo, Dem. Rep.",NGA,"High"')).toEqual([
      "1",
      "Congo, Dem. Rep.",
      "NGA",
      "High",
    ]);
  });

  it("converts WPP thousands to persons and records projection metadata", () => {
    const sql = populationSql({
      iso3: "NGA",
      variant: "Medium",
      year: 2048,
      populationThousands: 350_123.5,
    });
    expect(sql).toContain("POPULATION_UN_MEDIUM");
    expect(sql).toContain("350123500");
    expect(sql).toContain(", 1,");
    expect(sql).toContain(WPP_VINTAGE);
  });

  it("marks WPP estimate-period rows as observations", () => {
    const sql = populationSql({
      iso3: "NGA",
      variant: "Low",
      year: 2023,
      populationThousands: 223_800,
    });
    expect(sql).toContain(", 0,");
  });

  it("parses the checked-in official-shape fixture", () => {
    const fixture = readFileSync(
      resolve(process.cwd(), "scripts/fixtures/un-wpp-sample.csv"),
      "utf8",
    );
    const [headerLine, ...rows] = fixture.trim().split("\n");
    const header = parseCsvLine(headerLine);
    const parsed = rows.map((line) =>
      Object.fromEntries(header.map((key, index) => [key, parseCsvLine(line)[index]])),
    );
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ ISO3_code: "NGA", Variant: "Medium", Time: "2023" });
    expect(parsed[2].PopTotal).toBe("326673.934");
  });
});
