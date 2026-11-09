# SDOH Loops

Map a person's or group's social circumstances with ICD-11 codes and find the loops that hold them in place.
A static, on-device workbench built from the Actualizer action pack in `content-pack/` (workbench · safety profile
`health` · delivery `pages`: a public prototype at https://feelingsarereal.github.io/sdoh-loops/, SL32). Everything a person types stays in this browser (IndexedDB) and leaves only through an
export they start.

## Quick start (local)

```bash
npm ci
npm run build          # content build + typecheck + vite build → dist/
npm run preview -- --port 4194 --strictPort
```

Open http://localhost:4194/. The launcher `../../tools/shortcuts/▶ Open SDOH Loops.command` runs the same three
commands. `npm run dev` gives a hot-reloading dev server.

### Checks

```bash
npm run validate:pack  # tools/validate_pack.py (the Cowork validator) — must report 0 errors
npm test               # Vitest: pack schemas (one error per rule), storage, golden fixtures G1–G6, round-trips, versions
npm run test:e2e       # Playwright: walkthroughs w1–w3, safety suite (G2–G5, H1–H6), smoke + axe, the core consumer fixture
npm run record:tests   # writes tests/safety/last-run.json → provenance.json on the next build
npm run check          # all of the above, in order
```

## Packages (K13)

The map lives in two workspace packages that this app consumes, so SDOH Interrogator apps embed the same map:

| Package | What |
|---|---|
| [`packages/sdoh-loops-core`](packages/sdoh-loops-core/README.md) | `<SdohMap>` (canvas, list view, association menu, Link to… and the evidence gate, side-panel analyses A1–A8, greyscale, keyboard, exports and import), the storage adapters, the pack loader, the pure analyses. Semantic versions, [CHANGELOG](packages/sdoh-loops-core/CHANGELOG.md). |
| [`packages/sdoh-loops-pack`](packages/sdoh-loops-pack/README.md) | The content pack as built JSON plus `pin.json`, versioned on its own, [CHANGELOG](packages/sdoh-loops-pack/CHANGELOG.md). Consumers pin both. |

`/map` is `src/pages/MapPage.tsx`, a thin frame (URL, last map, the maps list) around `<SdohMap>`. The consumer fixture
`packages/sdoh-loops-core/fixtures/consumer/` (`npm run build:consumer`, part of `npm run build`) embeds the core as
another app would, and `tests/consumer/` checks it. The packages publish to GitHub Packages on a `pack-v*` / `core-v*` tag
(`.github/workflows/publish-packages.yml`); setup and release steps are in the core README.

## How it is built

| Layer | Choice |
|---|---|
| App | Vite 5, React 18, TypeScript strict, Tailwind 3 (MI design system `bx-` classes + Actualizer `ax-` canvas classes), react-router 6 |
| Content | `scripts/build-content.ts` validates the pack with zod (the same rules as `tools/validate_pack.py`), resolves every cross-reference, runs the SAFETY H1 lint, and emits the pack asset (`packages/sdoh-loops-pack/data/*.json`, `pin.json`) and this app's build facts (`src/data/{provenance,staleness,build-errors}.json`, `public/provenance.json`, `public/staleness.json`). Errors go to `content-pack/BUILD-ERRORS.md` and `/methods`; the rest still builds. |
| Canvas | Cytoscape.js; **fCoSE** for auto-arrange (respects pins via fixed-node constraints), **ELK stress** as the alternative (loaded only when chosen; ELK has no pin constraint, so pinned nodes are put back after it runs); `cytoscape-svg` and Cytoscape's own `png()` for picture export. |
| Rich text | Tiptap 2 (starter-kit trimmed to paragraphs, bold, italic, underline + text-style, colour and a font-size attribute). Stored as a restricted JSON document, sanitised on load and import, never stored or rendered as HTML. |
| Storage | `idb-keyval` behind the core's `src/lib/storage/` (database `sdoh-loops`), localStorage fallback. "Clear my data" deletes the database and every `sdoh-loops:*` key. |
| Analyses | the core's `src/lib/analysis/` — A1 inventory, A2 Johnson loops (caps 12 / 500), A3 R/B, A4 strength (heuristic), A5 Tarjan SCC, A6 paths (cap 200), A7 leverage (heuristic), A8 FCM what-if pulse (heuristic). Golden fixtures in `src/lib/analysis/__fixtures__/`. |

Routes: `/` · `/map` (canvas) · `/map/list` (accessible list and table view) · `/maps` · `/evidence` · `/references` ·
`/glossary` · `/concepts` · `/concepts/:id` · `/help` · `/methods` · `/about`. Map URLs carry only the map id and the
panel (`?id=…&view=loops`), never map text. The canvas, its layouts and the editor are code-split away from `/`.

## Editing the content

The pack is the only source of facts. Change `content-pack/` (or rebuild it from `source/` with
`python3 source/pack-src/build_pack.py …`), then `npm run build:content`. Interface labels not yet in
`content-pack/ui-strings.yaml` live in the core's `src/lib/copy.ts` for review. A change to the pack's data needs a new
pack version (`packages/sdoh-loops-pack/README.md`); `npm test` says so when it is missing.

## The public prototype (GitHub Pages, SL32)

`main` deploys to https://feelingsarereal.github.io/sdoh-loops/ through `.github/workflows/pages.yml`. The workflow
runs `npm ci`, then `npm test`, then `npm run build:pages`, then `npm run check:xwalk`, then deploys, then runs the
dist test again against the live site.

Codes are shown as WHO publishes them, with no mapping to other code sets, in every build. WHO's reply to request
202611431 (2026-11-09) says to proceed under the existing ICD-11 licence and to postpone any mapping until WHO
publishes its mapping agreement (SL33, todo T-LIC-01).

- **The dist test** (`scripts/check-xwalk-dist.ts`) ends every `npm run build` and `npm run build:pages`. No text in
  the output may match `/ICD-10-CM|\bZ[0-9]{2}(\.[0-9A-Z]+)?\b/` outside `xwalk-allowlist.txt`, which lists general
  mentions that map no code, each with its reason. A `crosswalk` key, a Healthy People 2030 domain id as a value and
  the label "Builder topic" fail it outright. Cowork reviews the allowlist before publishing.
- **The prototype banner** (`VITE_SDOH_PAGES=on`) above the header on every page. Hiding it lasts for the visit;
  a reload brings it back.

WHO's §1.3 citation is in every page's footer and on About, in both builds.

```bash
npm run build:pages && npm run check:xwalk && npm run test:pages   # locally, under /sdoh-loops/
SDOH_LIVE_URL=https://feelingsarereal.github.io/sdoh-loops/ npx playwright test --config playwright.pages.config.ts
npx tsx scripts/check-xwalk-dist.ts https://feelingsarereal.github.io/sdoh-loops/
```

When WHO publishes its mapping agreement, a new item can bring the mapping back under that agreement's terms.

## Publishing history

Before SL32, delivery was `local`. These were the original steps for publishing (now done by `pages.yml`):

1. Confirm `gh auth status` shows the `feelingsarereal` account.
2. `gh repo create feelingsarereal/sdoh-loops --private --source . --push`.
3. Add a Pages workflow: `npm ci → npm run validate:pack → npm test → BASE_PATH=/sdoh-loops/ npm run build → upload dist/` (the build already writes `dist/404.html` for deep links).
4. Change `manifest.delivery` to `pages` in the pack and re-run the H2 request recorder against the published URL.
