import { countrySlug } from "./_lib/countrySlugs";
import { CURATED_PAIRS } from "./_lib/curatedPairs";
import { esc } from "./_lib/pageShell";
import { loadCountries, type StaticDataEnv } from "./_lib/staticData";

export const onRequestGet: PagesFunction<StaticDataEnv> = async (context) => {
  const { origin } = new URL(context.request.url);
  const countries = await loadCountries(context.env, context.request.url);
  const slug = (iso: string) => {
    const country = countries.find((c) => c.iso_alpha3 === iso);
    return country ? countrySlug(country) : null;
  };
  const paths = [
    "/",
    "/methodology",
    "/llms.txt",
    "/openapi.json",
    ...CURATED_PAIRS.flatMap(([a, b]) => {
      const [sa, sb] = [slug(a), slug(b)];
      return sa && sb ? [`/compare/${sa}/${sb}`] : [];
    }),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${esc(origin + p)}</loc></url>`).join("\n")}
</urlset>
`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
};
