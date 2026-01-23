# Convergence Explorer

Interactive visualization tool for exploring economic and demographic convergence between regions. How long would it take Nigeria to match Ireland's GDP per capita?

## Quick Start

```bash
cd app
pnpm install

# Initialize database with schema
pnpm db:init

# Fetch data from World Bank API and import (takes ~30 seconds)
pnpm data:fetch
pnpm db:import

# Start local server with D1 database
pnpm start
```

Open http://localhost:8788 to view the app.

## Project Structure

```
mountain/
├── README.md               # This file
├── SCHEMA.md               # Database schema documentation
├── API.md                  # API endpoints documentation
└── app/                    # React + Vite frontend
    ├── src/
    │   ├── components/     # React components
    │   ├── hooks/          # Custom hooks
    │   ├── lib/            # Utilities
    │   └── types/          # TypeScript types
    ├── functions/api/      # Cloudflare Pages Functions
    ├── scripts/            # Data fetching scripts
    ├── schema.sql          # Database schema
    └── wrangler.toml       # Cloudflare config
```

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Cloudflare D1 (SQLite-compatible)
- **Hosting**: Cloudflare Pages
- **Data**: World Bank Open Data API

## Available Scripts

```bash
pnpm dev          # Start Vite dev server (no database)
pnpm start        # Build and start with Cloudflare Pages + D1
pnpm pages:dev    # Start Cloudflare Pages dev server
pnpm build        # Build for production

pnpm db:init      # Initialize database schema
pnpm db:import    # Import World Bank data
pnpm data:fetch   # Fetch fresh data from World Bank API
```

## Repo Hygiene

- `app/.wrangler/` is Cloudflare Wrangler local state and should not be committed.
- If it ever gets tracked, untrack it with `git rm -r --cached app/.wrangler` (then ensure `app/.gitignore` contains `.wrangler`).

## Data

The database contains:
- **217 countries** with region and income group classification
- **34,760 data points** across 5 indicators:
  - GDP per capita (PPP, constant 2021 int$)
  - Total population
  - Life expectancy at birth
  - Internet users (% of population)
  - Fertility rate

Data spans 1990-2023 from the World Bank Open Data API.

## Deployment

```bash
# Create D1 database on Cloudflare
npx wrangler d1 create convergence-db

# Update wrangler.toml with database_id

# Deploy to Cloudflare Pages
pnpm pages:deploy
```

## Inspiration

- [The Mountain to Climb](https://oliverwkim.com/The-Mountain-To-Climb/) by Oliver Kim
- [Explorable Explanations](http://worrydream.com/ExplorableExplanations/) by Bret Victor
- [Gapminder](https://www.gapminder.org/tools/) by Hans Rosling
