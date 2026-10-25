# Prospect Finder project guidance

- Keep the product branded as Prospect Finder. Apollo is an optional data provider, not the product brand.
- Run the local server and open the preview in the available browser when making substantial UI changes. Do not give the user server-start instructions when you can run it.
- Before substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. Record durable prototype-specific design feedback and decisions here.
- When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.
- Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the prototype can be handed to Sites.
- Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product behavior boundary

- Keep sample records and demo-only behavior explicit. Do not imply live research, verification, enrichment, sending, credit usage, or external account changes without a connected provider capability.
- Show review and approval before connected actions that can change account data or spend credits.
