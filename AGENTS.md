# Agent Rules (Mountain)

## QA / Regression Rules (keep the UI stable)
- If you change anything that impacts URL parsing, selectors, theme, modals, exports, or embed mode, do a headed Playwright click-through of the full left column + right sidebar and all share/export flows.
- Always validate URL params *after* async lists load (countries + indicators) and normalize invalid values to defaults.
- For invalid URL params:
  - normal app / interactive embed: show a single (deduped) toast and reset
  - static embed (`embed=true&interactive=false`): reset silently (no toasts) and stay minimal

## Embed Mode Guardrails
- When `embed=true`, render the minimal embed surface (no full app header/selectors), regardless of whether data is ready yet.
- In embed, represent “not ready” states explicitly (`loading` / `no-data`) instead of falling back to full UI.
- Keep embed theme behavior deterministic: `embedTheme` must control `documentElement.dark` and clean up on unmount.

## Keyboard + Accessibility Guardrails
- All interactive controls must be reachable by keyboard and have an accessible name (label/`aria-label`).
- Dropdowns: keyboard search + Enter select + Escape close must work without losing focus.
- Modals: Escape closes and focus restores to the trigger; no “focus traps” that strand keyboard users.

## Exports / Share Guardrails
- Downloads must be non-empty and filenames should encode the current selection state.
- Copy actions must show clear user feedback (toast) in non-static contexts.

## Repo Hygiene
- Never commit local Cloudflare Wrangler state: `app/.wrangler` must remain ignored and untracked.

