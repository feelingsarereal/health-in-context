# SDOH Loops

Map a person's or group's social circumstances with ICD-11 codes and find the loops that hold them in place.
A static, on-device workbench built from the Actualizer action pack in `content-pack/` (workbench · safety profile
`health` · delivery `local`). Everything a person types stays in this browser (IndexedDB) and leaves only through an
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
npm test               # Vitest: pack schemas (one error per rule), storage, golden fixtures G1–G6, round-trips
npm run test:e2e       # Playwright: walkthroughs w1–w3, safety suite (G2–G5, H1–H6), smoke + axe
npm run record:tests   # writes tests/safety/last-run.json → provenance.json on the next build
npm run check          # all of the above, in order
```

## How it is built

| Layer | Choice |
|---|---|
| App | Vite 5, React 18, TypeScript strict, Tailwind 3 (MI design system `bx-` classes + Actualizer `ax-` canvas classes), react-router 6 |
| Content | `scripts/build-content.ts` validates the pack with zod (the same rules as `tools/validate_pack.py`), resolves every cross-reference, runs the SAFETY H1 lint, and emits `src/data/*.json`, `public/provenance.json`, `public/staleness.json`. Errors go to `content-pack/BUILD-ERRORS.md` and `/methods`; the rest still builds. |
| Canvas | Cytoscape.js; **fCoSE** for auto-arrange (respects pins via fixed-node constraints), **ELK stress** as the alternative (loaded only when chosen; ELK has no pin constraint, so pinned nodes are put back after it runs); `cytoscape-svg` and Cytoscape's own `png()` for picture export. |
| Rich text | Tiptap 2 (starter-kit trimmed to paragraphs, bold, italic, underline + text-style, colour and a font-size attribute). Stored as a restricted JSON document, sanitised on load and import, never stored or rendered as HTML. |
| Storage | `idb-keyval` behind `src/lib/storage/` (database `sdoh-loops`), localStorage fallback. "Clear my data" deletes the database and every `sdoh-loops:*` key. |
| Analyses | `src/lib/analysis/` — A1 inventory, A2 Johnson loops (caps 12 / 500), A3 R/B, A4 strength (heuristic), A5 Tarjan SCC, A6 paths (cap 200), A7 leverage (heuristic), A8 FCM what-if pulse (heuristic). Golden fixtures in `src/lib/analysis/__fixtures__/`. |

Routes: `/` · `/map` (canvas) · `/map/list` (accessible list and table view) · `/maps` · `/evidence` · `/references` ·
`/glossary` · `/concepts` · `/concepts/:id` · `/help` · `/methods` · `/about`. Map URLs carry only the map id and the
panel (`?id=…&view=loops`), never map text. The canvas, its layouts and the editor are code-split away from `/`.

## Editing the content

The pack is the only source of facts. Change `content-pack/` (or rebuild it from `source/` with
`python3 source/pack-src/build_pack.py …`), then `npm run build:content`. Interface labels not yet in
`content-pack/ui-strings.yaml` live in `src/lib/copy.ts` for review.

## Publishing this later

Delivery is `local`; nothing is pushed. To publish on GitHub Pages later (Daniel's decision, and only after todo
T-LIC-01 and T-ICD-01 are closed):

1. Confirm `gh auth status` shows the `feelingsarereal` account.
2. `gh repo create feelingsarereal/sdoh-loops --private --source . --push`.
3. Add a Pages workflow: `npm ci → npm run validate:pack → npm test → BASE_PATH=/sdoh-loops/ npm run build → upload dist/` (the build already writes `dist/404.html` for deep links).
4. Change `manifest.delivery` to `pages` in the pack and re-run the H2 request recorder against the published URL.
