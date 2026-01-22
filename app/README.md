# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Project notes (data + imports)

This app imports country indicators into a local Cloudflare D1 database (and can be deployed to Pages).

### Data import
- Generate import SQL: `pnpm data:fetch`
- Initialize local DB: `pnpm db:init`
- Import data into local DB: `pnpm db:import`

### Optional: Ember electricity datasets (generation + installed capacity)
Some UI features (e.g., “× today’s fleet” multipliers and newer “today” baselines) can use Ember datasets when an API key is provided.

- Create `./.env` from `./.env.example` and set `EMBER_API_KEY`.
- Re-run `pnpm data:fetch && pnpm db:import`.

Notes:
- Ember installed capacity is currently solar/wind only (and limited country coverage).
- IRENA provides broad coverage for solar/wind capacity baselines (yearly, via PXWeb).

Environment variables (all optional unless noted):
- `EMBER_API_KEY` (required to fetch Ember data)
- `IRENA_ELECSTAT_TABLE` (PXWeb table id for capacity baselines)
- `IRENA_CAPACITY_START_YEAR` / `IRENA_CAPACITY_END_YEAR` (year filter)
- `IRENA_CAPACITY_VINTAGE` (string recorded into `data_points.source_vintage`)
- `EMBER_GENERATION_YEAR` (pin to `YYYY`)
- `EMBER_GENERATION_MIN_YEAR` (default `2024`; avoids overwriting OWID)
- `EMBER_GENERATION_VINTAGE` (string recorded into `data_points.source_vintage`)
- `EMBER_CAPACITY_DATE` (pin to `YYYY-MM`)
- `EMBER_CAPACITY_VINTAGE` (string recorded into `data_points.source_vintage`)
- `OWID_ENERGY_REF` (pin OWID energy to a git ref)
- `OWID_ENERGY_VINTAGE` (string recorded into `data_points.source_vintage`)

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
