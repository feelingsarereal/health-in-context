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
- **The notebook** (0.5.0, opt-in; for hosts from 0.9.0): free and structured notes beside the map, with the identifier
  check and its labels; spans and @ mentions tied to every item kind, case export and the case report (0.9.0).
- **The pack loader**: the pinned content pack's data (`@feelingsarereal/sdoh-loops-pack`) and its pin check.

## Using it

```bash
npm install --save-exact @feelingsarereal/sdoh-loops-core@0.8.0 @feelingsarereal/sdoh-loops-pack@0.2.0
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
| `mapMenuItems` | 0.4.0 (SL23). `{ id, label, description?, onSelect, exports? }[]`: your own file actions (e.g. "Reset to the built map") at the end of the toolbar's Map menu, instead of buttons beside the canvas. Since 0.5.0, `exports: true` marks an item that sends the map somewhere (e.g. "Open in SDOH Loops"): with the notebook on, it warns first while possible identifiers remain. |
| `missing` | What to show when `map` is an id that is not in `storage`. |
| `notebook` | 0.5.0 (SL26). `true` shows the case manager notebook: a toggle beside List view (a column with its own resize handle from lg up; Map / Notebook tabs below). Off by default; from 0.9.0 (SL28) it is available to hosts — see "Traceability, case file and report" below. Notes live in the map's `notebook` block (schema 3). |
| `notebookTemplates` | 0.5.0 (SL26). `NoteTemplate[]` (`{ id, name, fields: { key, label }[] }`): your templates, after the core's Intake, Contact note, Case conference and Plan review. Each note from one starts with a Date field (a year by default). |
| `quickEdit` | 0.6.0 (SL31). Default `true` wherever the map is editable: in the selection card's Read mode a ✎ edits the label, the description, the notes and a link's description in place (Enter or a click away saves as one Undo step, Esc cancels), and "Pinned in place" and a link's delay are switches. Codes, code status, polarity, weight, confidence, overrides and delete stay in Edit mode. `false` turns it off; a read-only map never shows it. |
| `notebookImport` | 0.7.0 (SL29). `{ maxMB?, maxPages? }` (defaults 20 and 300): limits for importing files into the notebook. |
| `notebookTargets` | 0.9.0 (SL28). `NotebookTargetKind[]` (`{ kind, label, search(q) → { id, label, detail? }[], open(id), name?(id) }`): your own item kinds for the notebook's Link to… and @ mentions (e.g. an Interrogator app's `/code` entries and sections). `kind` must not be one of the core's (`node`, `edge`, `loop`, `cluster`, `code`, `reference`, `glossary`, `concept`, `note`, `span`); a click on such a target calls `open(id)`. |
| `passage` | 0.9.0 (SL28). A span id: once the map loads, the notebook opens at that passage (for "Cited in your notebook" links from pages outside the map). |
| `extractors` / `allowRemoteExtractors` | 0.8.0 (SL27). `NotebookExtractor[]` (`{ id, label, kind: 'local' \| 'remote', describe, run(note, context) → Promise<Proposal[]> }`), after the core's local code matcher; an engine picker appears with more than one. A `remote` extractor runs only with `allowRemoteExtractors` and only on a note with no unresolved identifier flags; keep it off under the health profile until a SAFETY ruling (S7.2). |

The keyboard map listens on `window` while the component is mounted, and ignores keys typed into fields and dialogs.
Since 0.2.0 it adds `F` (full screen), `]` (fold or open the side dock; since 0.3.0 also the » / « buttons on the dock and its rail) and Shift+F10 / the ContextMenu key (peek at
the selection). Right-click, Ctrl-click and long-press open the peek; the association menu is its "Associations…"
button (and `A`, the toolbar, the selection card's Edit mode and the ⋯ handle). Since 0.4.0, `E` toggles the selection
card between Read and Edit, `K` is a new link (it was `E`), and `⌘O` / `Ctrl+O` and `⌘S` / `Ctrl+S` open a map file and
save a copy. The dock's collapse state, since 0.3.0 its width (the resize handle on its left edge) and since 0.4.0 the
Read / Edit mode are kept per viewer under `<storage slug>:view:dock`; the per-map Node text setting is
`layout.nodeText` in the map file. A read-only original always shows Read, with no toggle: the first edit made
elsewhere (a drag, a new circumstance, Print / grayscale) forks the copy, and the toggle appears on it.

### The notebook (0.5.0, SL26)

One notebook per map, saved inside the map file (`notebook: { notes, dismissed, replaced }`, schema 3) and autosaved with
it; Undo / Redo cover it, and "Clear my data" (your store's `clearAll()`) empties it. Free notes (rich text with headings
and lists) and structured notes (a template's headed fields). The identifier check is a local heuristic: it underlines
possible identifiers as the user types, counts them in the notebook header, and offers **Replace with a label**
([Person A], [date], [phone] …; only the category and count are kept, never the value, and Undo cannot restore it) or
**Not an identifier**. Every export, Print and an `exports: true` host menu item warn while flags remain. A map without
notes — or "Save a copy without the notebook" — exports as schema 2, which 0.4.x cores open. Put `<NotebookHelp />` on
your Help page when you turn the notebook on.

The notebook ends with a live, read-only **case summary** of the map as shown: tiles, the list view's circumstances table
(sortable, filterable; a row click selects on the map), the loops, and the top 5 by leverage.

### Selections, circumstances from text, and suggestions (0.8.0, SL27)

Selecting text in a note opens an action bar — **Create circumstance**, **Add as evidence to…**, **Link to…**,
**Annotate**, **Copy quote** (Ctrl+Enter or Shift+F10 from the keyboard). A selection becomes a span in the notebook
(`spans`, anchored by quote, prefix, suffix and offsets; `orphaned` when its text is edited away, never re-pointed) with
an annotation (`annotations`: comment and targets); a circumstance or link made from or backed by it gets
`sources: [{ note, span }]`, and both sides are kept in step on load and import. Highlights use the Interrogator
reader's classes, now in the core's `styles.css`: `.sx-span` (made by the user), `.sx-span-inferred` / `.sx-span-low`
with "≈" (accepted as inferred), plus `.sx-span-plain` for a span that backs nothing; the selected item's spans get the
focus ring. Create circumstance offers the local code suggester's top five (pack titles, index terms and aliases,
Chapter 24 only, "suggested", nothing chosen). The selection card (Read and Edit) lists an item's passages ("In the
notebook (n)", Go to passage, Remove as evidence), and the peek counts them. **Suggest circumstances in this note** runs
the extractors (`extractors` prop) into a proposal queue; accepted items keep `suggested_by` in the map file.

### Traceability, case file and report (0.9.0, SL28)

**Notebook → anything.** A selection's **Link to…** opens one picker over every item kind — circumstances, links,
loops (by their node cycle: target id `nodeA>nodeB>…`), clusters (`a+b+…`, sorted), ICD-11 codes, references (the
pack's `n`, or `map:<nodeId>` for a user-entered one), glossary terms, 101s, other notes and passages, and your
`notebookTargets`; "Draw a new link between two circumstances…" is its first choice. Typing **@** at the start of a word
opens the same picker and inserts a chip: an empty span (`chip: true`, `quote: ''`, start = end) anchored by the text
around it, with an annotation naming its target; Esc types the @. **Anything → notebook.** The case summary has a
**Sources** column and each loop a passages fold-out; the Loops and Clusters tabs show each one's passages, grouped by
circumstance; the selection card lists a circumstance's, its code's and a link's references' passages; references,
codes, glossary terms and 101s show **Cited in your notebook (n)** wherever they open (inside the map from the map's
notebook; on your own pages wrap them in `<NotebookCitations store href>` and place `<CitedInNotebook t>`). The caret in
a passage selects what it supports (the controlled `selection`), and **Trace** dims everything not connected to the
current passage or selection, on the canvas and in the notes. **Notes collapse:** no note is open until the viewer opens
one; a click on the open row, the ⌃ Collapse button or Esc in the list closes it (kept with the dock state); a free note
left untitled and empty goes when it is collapsed, with an Undo. **Export case (.json)** writes the map file with its
notebook and a `provenance` block (counts of notes, passages, mentions, annotations, labels by category, and the pins);
Open a map file restores both sides. **Export report…** makes the case report — the notes in order, the case summary with
each circumstance's quoted sources and each loop's passages, the references the notebook cites — as Print / Save as PDF,
one HTML file, Markdown or Word, in the browser (loaded on first use), with options for the notes, the map picture and
the annotations; the cover gives the map, subject label, date, pins and counts, and says the identifier check is a
heuristic. Both go through the identifier warning.

### Importing files into the notebook (0.7.0, SL29)

With `notebook` on, **Import a file…** (the notebook header, the Map menu's "Import into the notebook…", or a drop on
the notebook) and **Paste as a note** turn `.txt`, `.md`, `.html`/`.htm`, `.rtf`, `.csv`, `.docx` and `.pdf` files into
notes of kind `imported` (`source: { filename, type, size, imported, pages?, review, kept? }`; a PDF's page starts in
`anchors`; a CSV as `table`). Several files at once; one failing never stops the others. Each opens in a review step with
the identifier check's flags before it is saved — Label all, Review one by one, or Keep as is (confirmed, and recorded
in `source.review`). The original file is not stored, nor its metadata. Imported text is kept verbatim (title and tags
stay editable). Scanned PDFs (no text layer) are reported, not OCR'd.

Everything runs on the device and loads on first import only: the text formats and Word (mammoth) in a worker
bundled with your app, PDFs in pdf.js's worker, emitted as a file of your own origin. Your Vite build must process the
core's source (the default for this package, which ships TypeScript; do not pre-bundle it with `optimizeDeps.include`),
so the core's `?worker` and `?url` imports resolve.

### Workspace height (0.5.1, SL30)

From lg up, on the canvas, the workspace (toolbar, canvas, notebook, dock) fills the viewport below where it starts, less
what your page lays out below it in normal flow (since 0.6.0: a site footer up to 15% of the window high), so the document is exactly the
window and never scrolls; it keeps that height as the window or the page around it changes size; the notebook and the dock scroll inside
themselves, and the page does not scroll while someone works in the map. A sticky site header counts as "above". When
that would leave under 480 px (a map placed far down a long page), the workspace keeps the older fixed height and the
page scrolls to it. Below lg, and in the list view, nothing changed. The first time the notebook opens on a screen under
1600 px, the dock folds to its rail, once per viewer (`nbAutoFolded` in `<slug>:view:dock`).

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

### `canvasHeight` (0.12.0, SL35)

`canvasHeight="viewport"` makes the canvas fill the window below your header and the toolbar, with your footer below
the fold. Leave it at the default, `"auto"`, when the map sits inside a page of your own.

### No mapping to other code sets (0.11.0, SL33)

Codes are shown as WHO publishes them; no mapping to other code sets is included. WHO's reply to request 202611431
says to proceed under the existing ICD-11 licence and to postpone any mapping until WHO publishes its mapping
agreement, so pack 0.4.0 carries none and the code card shows none.

**Deprecated, and safe to remove from a host:** the `crosswalk` prop on `<SdohMap>` is accepted and ignored.
`sdohCrosswalk` from `/vite` is a no-op that logs one deprecation line, and `xwalkOn` still answers but nothing reads it.

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
