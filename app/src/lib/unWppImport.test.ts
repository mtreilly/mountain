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
});
