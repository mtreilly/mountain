import type { StaticCountry } from "../../src/lib/staticDataFormat";

// World Bank names read badly in prose and URLs ("Korea, Rep."), so a few get friendlier ones.
const FRIENDLY: Record<string, { slug: string; name: string }> = {
  BHS: { slug: "bahamas", name: "The Bahamas" },
  COD: { slug: "democratic-republic-of-the-congo", name: "Democratic Republic of the Congo" },
  COG: { slug: "republic-of-the-congo", name: "Republic of the Congo" },
  EGY: { slug: "egypt", name: "Egypt" },
  FSM: { slug: "micronesia", name: "Micronesia" },
  GMB: { slug: "gambia", name: "The Gambia" },
  HKG: { slug: "hong-kong", name: "Hong Kong" },
  IRN: { slug: "iran", name: "Iran" },
  KGZ: { slug: "kyrgyzstan", name: "Kyrgyzstan" },
  KOR: { slug: "south-korea", name: "South Korea" },
  LAO: { slug: "laos", name: "Laos" },
  MAC: { slug: "macao", name: "Macao" },
  PRK: { slug: "north-korea", name: "North Korea" },
  RUS: { slug: "russia", name: "Russia" },
  SVK: { slug: "slovakia", name: "Slovakia" },
  SYR: { slug: "syria", name: "Syria" },
  VEN: { slug: "venezuela", name: "Venezuela" },
  VNM: { slug: "vietnam", name: "Vietnam" },
  YEM: { slug: "yemen", name: "Yemen" },
};

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function countrySlug(country: StaticCountry): string {
  return FRIENDLY[country.iso_alpha3]?.slug ?? slugify(country.name);
}

export function countryDisplayName(country: StaticCountry): string {
  return FRIENDLY[country.iso_alpha3]?.name ?? country.name;
}

/** Finds a country by its canonical slug or, as a convenience, its ISO3 code. */
export function findCountryBySlug(
  countries: StaticCountry[],
  slug: string,
): { country: StaticCountry; canonical: boolean } | null {
  const wanted = slug.toLowerCase();
  const bySlug = countries.find((c) => countrySlug(c) === wanted);
  if (bySlug) return { country: bySlug, canonical: true };
  const byIso = countries.find((c) => c.iso_alpha3.toLowerCase() === wanted);
  return byIso ? { country: byIso, canonical: false } : null;
}
