import { HTML_HEADERS, MARKDOWN_HEADERS, pageShell, wantsMarkdown } from "./_lib/pageShell";

const TITLE = "How economic convergence is calculated";
const DESCRIPTION =
  "The maths behind catch-up growth: how many years a poorer economy needs to match a richer one, given a growth rate for each, and where the data comes from.";

const MARKDOWN = `# ${TITLE}

Mountain to Climb is an economic convergence calculator. It answers one question: if a poorer economy (the *chaser*) and a richer one (the *target*) each grow at a stated annual rate, when does the chaser catch up?

## The formula

If the chaser starts at value C and grows at rate g, and the target starts at T and grows at rate h, the gap closes when C(1+g)^t = T(1+h)^t. Solving for t:

    t = ln(T / C) / ln((1 + g) / (1 + h))

The answer depends only on the starting ratio T/C and the growth differential. If g is not greater than h the chaser never catches up. If C is already at or above T, the chaser is ahead and t = 0.

## Start year

Projections start the year after the latest year for which both countries have observed data (or a chosen base year, if later). Values are grown forward from the latest shared observation using the stated rates.

## Scenarios, not forecasts

Results follow only from the growth rates you choose. Compare pages default each country to its own trailing 10-year compound annual growth rate, which describes the past, not the future.

## Required growth by a deadline

To match the target by year Y, starting n years after the latest shared data, the chaser needs growth g = (T / C)^(1/n) x (1 + h) - 1.

## Indicators and data

The default indicator is GDP per capita, PPP (constant 2021 international dollars, World Bank NY.GDP.PCAP.PP.KD). PPP adjusts for local price levels and suits comparing living standards; nominal US-dollar GDP per capita moves with exchange rates. Other indicators come from the World Bank, OECD, UN World Population Prospects, Our World in Data, Ember and IRENA.

## Data caveats

Some countries' GDP per capita is distorted by structural factors: Ireland (multinational profit booking), Luxembourg (cross-border commuters), Qatar and the UAE (large non-citizen workforce), Singapore (financial hub). API and compare pages use the published figures by default and list these caveats; the interactive app can apply adjustment factors.

## Access

- Calculator: https://mountaintoclimb.com/
- API description: https://mountaintoclimb.com/openapi.json
- For agents: https://mountaintoclimb.com/llms.txt
`;

function html() {
  const body = MARKDOWN.split("\n\n")
    .map((block) => {
      if (block.startsWith("# ")) return `<h1>${block.slice(2)}</h1>`;
      if (block.startsWith("## ")) return `<h2>${block.slice(3)}</h2>`;
      if (block.startsWith("    ")) return `<pre>${block.trim()}</pre>`;
      if (block.startsWith("- "))
        return `<ul>${block
          .split("\n")
          .map((l) => `<li>${l.slice(2).replace(/(https:\/\/\S+)/g, '<a href="$1">$1</a>')}</li>`)
          .join("")}</ul>`;
      return `<p>${block.replace(/\*(.+?)\*/g, "<em>$1</em>")}</p>`;
    })
    .join("\n");
  return pageShell(
    {
      title: `${TITLE} — Mountain to Climb`,
      description: DESCRIPTION,
      canonicalUrl: "https://mountaintoclimb.com/methodology",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: TITLE,
          description: DESCRIPTION,
          url: "https://mountaintoclimb.com/methodology",
        },
      ],
    },
    body,
  );
}

export const onRequestGet: PagesFunction = async (context) =>
  wantsMarkdown(context.request)
    ? new Response(MARKDOWN, { headers: MARKDOWN_HEADERS })
    : new Response(html(), { headers: HTML_HEADERS });
