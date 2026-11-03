# Changelog — @feelingsarereal/sdoh-loops-core

[Semantic Versioning](https://semver.org/). Each release names the `@feelingsarereal/sdoh-loops-pack` version it was
tested with; that version is the exact `peerDependency`, so a consumer pins both.

- **Major:** a breaking change to `<SdohMap>`'s props, the `MapStore` adapter, an exported function's signature, or the
  map file format (a migration that older cores cannot read).
- **Minor:** a new feature, prop, export or analysis; existing behaviour unchanged.
- **Patch:** fixes, wording, performance.

While the version is 0.x, a minor bump may break; consumers should pin an exact version.

## [0.1.0] — 2026-11-03

First release (K13), extracted from the SDOH Loops app with no change in behaviour. Pack: `0.1.0`.

- `<SdohMap>`: canvas and list view, association menu, Link to… with the evidence gate and overrides, the side-panel
  tabs and analyses A1–A8, greyscale, keyboard, exports (JSON, CSV, Markdown loop report, PNG, SVG) and import. Props:
  `map` (an id, or a built map opened as a read-only original), `pack` (the pinned `pin.json`), `storage`,
  `onSelectionChange`, `onMapChange`, `onLoad`, `onOpenMap`, and optional controlled `view` and `panel`.
- Storage: `browserStore(slug)` (IndexedDB, localStorage fallback), `withOriginals(store, maps)` for read-only
  originals; the first edit to an original saves a copy with a new id, and undo stays on the copy.
- The pack loader: the pinned pack's data (`data/core`, `scheme`, `refs`) and `pinMismatch()`; `<SdohMap>` refuses to
  open a map when the loaded pack is not the pinned one.
- The pure analyses (`findLoops`, `scc`, `paths`, `leverage`, `pulse`, …) and the map model, also at
  `@feelingsarereal/sdoh-loops-core/analysis`.
- `styles.css`, `tailwind-preset` and `vite` (the `web-worker` alias and Tailwind content globs) for consumers.
- Published to GitHub Packages (`npm.pkg.github.com`, scope `@feelingsarereal`) by a `core-v*` tag.
