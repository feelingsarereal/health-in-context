# @feelingsarereal/sdoh-loops-core

The SDOH Loops map as one React component, `<SdohMap>`, plus the pure analyses and the map model. The standalone
SDOH Loops app (this repo's root) is its first consumer; every SDOH Interrogator app embeds the same component, so a
change to the map lands in all of them by a version bump (K13).

Everything stays on the device: no runtime fetches, no telemetry, maps in the browser (IndexedDB, localStorage
fallback). The health-profile invariants are tested inside a consumer: `fixtures/consumer/` and
`tests/consumer/k13-consumer.spec.ts`.

## What is in it

- **Canvas and list view**: Cytoscape canvas (fCoSE, ELK stress), the accessible list and table view, greyscale
  (print) mode, the keyboard map.
- **Association menu** and **Link to…** with the evidence gate and overrides (UI-17, UI-18).
- **Side panel**: Inspect, Loops, Links, Paths, Leverage, What-if, To code, Clusters, Legend, Map; analyses A1–A8.
- **Exports and import**: JSON, CSV, Markdown loop report, PNG, SVG; import of `.json` / `.csv` into a new map.
- **The pack loader**: the pinned content pack's data (`@feelingsarereal/sdoh-loops-pack`) and its pin check.

## Using it

```bash
npm install --save-exact @feelingsarereal/sdoh-loops-core@0.4.1 @feelingsarereal/sdoh-loops-pack@0.2.0
```

Both come from GitHub Packages: see "Publishing" below for the `.npmrc` a consumer needs.

Pin both exactly. The core's `peerDependencies` names the one pack version it was tested with.

```tsx
import pin from '@feelingsarereal/sdoh-loops-pack/pin.json';
import { SdohMap, browserStore, importJSON } from '@feelingsarereal/sdoh-loops-core';
import '@feelingsarereal/sdoh-loops-core/styles.css';
import built from './my-built-map.sdohmap.json';

const original = importJSON(JSON.stringify(built));
const storage = await browserStore('sdoh-interrogator'); // your own slug: your maps never mix with SDOH Loops'

<SdohMap
  map={original}               // a built map opens read-only; the first edit saves a copy
  pack={pin}                   // refuses to open if the bundle resolved a different pack
  storage={storage}
  onSelectionChange={(s) => …} // { nodes: string[], edges: string[] }
  onMapChange={(m, { copiedFrom }) => …}
/>
```

| Prop | |
|---|---|
| `map` | A map id in `storage`, or a map document. A document is a **read-only original**: it opens as is, is never saved, and the first edit forks a copy with a new id (named "… (copy)") that is saved and stays open. Undo stays on the copy. Remember the copy's id from `onMapChange` (`copiedFrom` is set on the forking change) and pass it next time. |
| `pack` | The `pin.json` of the pack you pinned. |
| `storage` | A `MapStore`: `browserStore(slug)`, or your own adapter with the same five methods. `withOriginals(store, maps)` gives several read-only originals at once (for a maps list). |
| `onSelectionChange`, `onMapChange`, `onLoad`, `onOpenMap` | Events. `onOpenMap(id)` follows an import (since 0.4.0, the Map menu's "Open a map file…"). `onSelectionChange` fires once per real change. |
| `selection` | 0.2.0 (SL16). The selection, controlled: pass it with `onSelectionChange` and set it from your reader (click a passage → its circumstance is selected and brought into view). Ids not on the map are ignored. Uncontrolled when left out. |
| `hideNode` | 0.2.0 (SL16). `(node) => boolean`: circumstances it returns true for (and their links) are left out of the canvas, the list view and every analysis; they stay in the map, its edits and its file exports. Change the function to toggle them (e.g. low-confidence inferences, D5). |
| `sideCards` | 0.2.0 (SL17). `{ id, title, render(selection) }[]`: your cards in the side dock, stacked below the core's selection and Whole map cards (0.4.0), each collapsible; they come along into full screen. Use this instead of a column of your own. |
| `renderPeek` | 0.2.0 (SL17). `(target) => ReactNode`, `target` is `{ kind: 'node', node }` or `{ kind: 'edge', edge }`: your lines in the read-only peek, below the core's (e.g. the passages behind it). |
| `view` / `onViewChange` / `viewHref` | Canvas or list; uncontrolled when left out. `viewHref` gives the switch a real URL if you route views. |
| `panel` / `onPanelChange` | The Whole map card's tab (`PANELS`: loops, links, paths, leverage, pulse, clusters, legend, needsCode, about; 0.4.0 dropped `inspect`, `tocode` and `map`); uncontrolled when left out. |
| `mapMenuItems` | 0.4.0 (SL23). `{ id, label, description?, onSelect }[]`: your own file actions (e.g. "Reset to the built map") at the end of the toolbar's Map menu, instead of buttons beside the canvas. |
| `missing` | What to show when `map` is an id that is not in `storage`. |

The keyboard map listens on `window` while the component is mounted, and ignores keys typed into fields and dialogs.
Since 0.2.0 it adds `F` (full screen), `]` (fold or open the side dock; since 0.3.0 also the » / « buttons on the dock and its rail) and Shift+F10 / the ContextMenu key (peek at
the selection). Right-click, Ctrl-click and long-press open the peek; the association menu is its "Associations…"
button (and `A`, the toolbar, the selection card's Edit mode and the ⋯ handle). Since 0.4.0, `E` toggles the selection
card between Read and Edit, `K` is a new link (it was `E`), and `⌘O` / `Ctrl+O` and `⌘S` / `Ctrl+S` open a map file and
save a copy. The dock's collapse state, since 0.3.0 its width (the resize handle on its left edge) and since 0.4.0 the
Read / Edit mode are kept per viewer under `<storage slug>:view:dock`; the per-map Node text setting is
`layout.nodeText` in the map file. A read-only original always shows Read, with no toggle: the first edit made
elsewhere (a drag, a new circumstance, Print / grayscale) forks the copy, and the toggle appears on it.

### The light entry: `/theme` (0.4.0, SL21)

`@feelingsarereal/sdoh-loops-core/theme` exports `ThemeProvider` and `useTheme` and imports `styles.css`, with no import
of the pack data. Import it in your app shell (every page), and import the root entry — which carries the pack — only
on the map route, behind `lazy()`, so the first chunk of every other page carries no `situations.json` or
`references.json`:

```tsx
// main.tsx
import { ThemeProvider } from '@feelingsarereal/sdoh-loops-core/theme';
const MapRoute = lazy(() => import('./routes/MapRoute')); // imports '@feelingsarereal/sdoh-loops-core'
```

The consumer fixture is built this way, and `tests/consumer/sl20-sl23.spec.ts` checks its first chunk.

### `<Notice text>` (0.4.0, SL22)

`<Notice>` (H5) takes an optional `text` (plain text or a short node): pass your app's own `safety.yaml → notice` and
drop the local copy of its markup. Without it, it shows the pinned pack's notice, the standalone app's wording.

### Build settings a consumer needs

The package ships TypeScript source (Vite and TypeScript compile it), so a consumer needs:

```ts
// vite.config.ts
import { sdohCoreAlias } from '@feelingsarereal/sdoh-loops-core/vite';
export default defineConfig({ resolve: { alias: { ...sdohCoreAlias } } }); // ELK's optional web-worker → an empty module
```

```js
// tailwind.config.js
import preset from '@feelingsarereal/sdoh-loops-core/tailwind-preset';
import { sdohCoreContent } from '@feelingsarereal/sdoh-loops-core/vite';
export default { presets: [preset], content: ['./index.html', './src/**/*.{ts,tsx}', ...sdohCoreContent] };
```

`styles.css` holds the MI design-system `bx-` and Actualizer canvas `ax-` classes with Tailwind's directives; import it
once. Wrap the app in `ThemeProvider` for dark mode (without it the map is drawn light).

### The pure analyses

```ts
import { findLoops, scc, paths, leverage, pulse } from '@feelingsarereal/sdoh-loops-core/analysis';
import { toGraph } from '@feelingsarereal/sdoh-loops-core'; // a map document → the graph the analyses take
```

## Versions

[Semantic Versioning](https://semver.org/), recorded in [CHANGELOG.md](CHANGELOG.md); the pack's own versions are in
`packages/sdoh-loops-pack/CHANGELOG.md`. `tests/unit/versions.test.ts` checks that the core pins the pack exactly, that
the app pins both, that each current version has a CHANGELOG entry, and that the built pack data is the one its
CHANGELOG entry records. Change the pack's data, and the pack needs a new version.

## Publishing (GitHub Packages)

Daniel chose GitHub Packages (2026-11-03). Both packages publish to `https://npm.pkg.github.com` under the
`feelingsarereal` scope (`publishConfig` in each `package.json`). No token or secret is stored in the repo.

**One-time setup**, once T-LIC-01 and T-ICD-01 allow the repo onto GitHub (app README, "Publishing this later"):

1. Create and push the repo: `gh repo create feelingsarereal/sdoh-loops --private --source . --push`. A package
   published from a private repo is private, and it is linked to the repo by each `package.json`'s `repository` field.
2. Nothing else: `.github/workflows/publish-packages.yml` publishes with the workflow's own `GITHUB_TOKEN`.

**A release:**

```bash
npm run release:dry                   # what each tarball will contain
git tag pack-v0.1.0 && git tag core-v0.1.0
git push origin pack-v0.1.0 core-v0.1.0
```

Tag the pack first when both change. The workflow checks that the tag matches the package version, that the pack data is
what `content-pack/` builds to, and that the validator and `npm test` pass, and only then publishes. A version can be
published once; the next change needs a new version (CHANGELOG).

Publishing by hand instead needs a classic token with `write:packages`. The `feelingsarereal` token in `gh` has `repo`
but not `write:packages`, so run `gh auth refresh -s write:packages` first, then
`NODE_AUTH_TOKEN=$(gh auth token) npm publish -w @feelingsarereal/sdoh-loops-pack`, and the same for the core.

**A consumer** (an SDOH Interrogator app) adds an `.npmrc` beside its `package.json`. The token comes from the
environment, never from the file:

```ini
@feelingsarereal:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Locally, `NODE_AUTH_TOKEN=$(gh auth token)` works after `gh auth refresh -s read:packages`. In the consumer's own GitHub
Actions, its `GITHUB_TOKEN` can read the packages once each package's settings (Manage Actions access) grant that repo
access.
