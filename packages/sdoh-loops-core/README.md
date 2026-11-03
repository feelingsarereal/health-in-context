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
npm install @feelingsarereal/sdoh-loops-core@0.1.0 @feelingsarereal/sdoh-loops-pack@0.1.0
```

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
| `onSelectionChange`, `onMapChange`, `onLoad`, `onOpenMap` | Events. `onOpenMap(id)` follows an import in the Map panel. |
| `view` / `onViewChange` / `viewHref` | Canvas or list; uncontrolled when left out. `viewHref` gives the switch a real URL if you route views. |
| `panel` / `onPanelChange` | The side-panel tab; uncontrolled when left out. |
| `missing` | What to show when `map` is an id that is not in `storage`. |

The keyboard map listens on `window` while the component is mounted, and ignores keys typed into fields and dialogs.

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

## Publishing

**Open, for Daniel to decide.** Both packages are ready for either method, and no token or secret is in the repo:

1. **GitHub Packages** under `feelingsarereal`: add `"publishConfig": { "registry": "https://npm.pkg.github.com" }` to
   both `package.json` files, then `npm publish -w @feelingsarereal/sdoh-loops-pack -w @feelingsarereal/sdoh-loops-core`
   with a token from `gh auth token` held in the shell or in `~/.npmrc` (never in the repo). Consumers add
   `@feelingsarereal:registry=https://npm.pkg.github.com` to their `.npmrc`.
2. **A git tag consumed by URL**: tag a release (`git tag core-v0.1.0 && git tag pack-v0.1.0`), push it once the repo
   is on GitHub, and consumers depend on it by URL. Because both packages live in one repo, a URL install needs each
   package on its own path: either `npm pack` each into a release asset and depend on the tarball URL, or use a git
   subdirectory install where the consumer's package manager supports it.
