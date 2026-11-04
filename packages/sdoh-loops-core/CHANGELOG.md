# Changelog — @feelingsarereal/sdoh-loops-core

[Semantic Versioning](https://semver.org/). Each release names the `@feelingsarereal/sdoh-loops-pack` version it was
tested with; that version is the exact `peerDependency`, so a consumer pins both.

- **Major:** a breaking change to `<SdohMap>`'s props, the `MapStore` adapter, an exported function's signature, or the
  map file format (a migration that older cores cannot read).
- **Minor:** a new feature, prop, export or analysis; existing behaviour unchanged.
- **Patch:** fixes, wording, performance.

While the version is 0.x, a minor bump may break; consumers should pin an exact version.

## [0.3.0] — 2026-11-04

Minor (SL17 review findings 1–4, Daniel's click-through of 0.2.0): the side dock and the layout picker. Pack: `0.1.1`
(unchanged). No new props and no change to the map file; one new per-viewer setting (the dock's width). Minor rather
than patch because the resize handle is a new feature, and a toolbar button and a copy key are gone.

- **Fold control on the dock (finding 1):** a » button at the dock's top right, beside the first card's header
  (`aria-label` "Fold the side dock", tooltip "Fold the side dock (])"). On the rail a « button at the top reopens it
  ("Open the side dock (])"). Focus follows to the counterpart each way, so reopening puts focus back in the dock.
  `]` still folds and opens. The toolbar button "Hide the side panels" (`data-testid="dock-toggle"`) is removed, so
  the action has one name. The canvas refits after a fold or a reopen.
- **Layout picker (finding 2):** a visible "Layout" label and plain option names, each with a one-line tooltip:
  **Clustered** (fCoSE) and **Evenly spaced** (ELK stress). The engine ids in the map file (`layout.engine`) are unchanged.
  Picking a layout re-arranges the unpinned boxes at once, as Auto-arrange does; pinned boxes stay put. The engine change
  and the new positions share one undo step when the layout settles within a second, so Undo puts both back. The
  picker is grouped (`role="group"`, "Arrange") with Auto-arrange, Re-arrange all and Arrange selection. The picker now
  reads the map's own engine, so Undo also resets it.
- **Edit and Analyse (finding 3):** the dock's "Editor" card is split into two collapsible cards, each with its own
  tab row. **Edit** has Selected, To code, and Map & export. **Analyse** has the "Evidence-backed links only" toggle, then
  Loops (with its count), Links, Paths, Leverage, What-if, Clusters and Legend. The host's `sideCards` stay below both.
  Copy keys are now `dock.edit` and `dock.analyse`; `dock.editor`, `dock.collapse` and `dock.expand` are gone, and new
  keys are `dock.fold`, `dock.unfold`, `dock.resize` (+ tips) and `layoutPick.*`. The `panel` / `onPanelChange` props are
  unchanged: `panel` is the tab chosen last, and each card shows the tab it last had. Card ids in the stored dock
  state are `edit` and `analyse`; an `editor` entry stored by 0.2.0 is ignored.
- **Resize handle (finding 4):** on the dock's left edge, `role="separator"` with `aria-orientation="vertical"`,
  `aria-valuenow`, `aria-valuemin` and `aria-valuemax`. Pointer drag works between 280 px and half the workspace. ←/→
  move it 16 px (Shift: 64 px), and Home or double-click resets the default 400 px. The canvas refits while it moves,
  throttled to one refit per 120 ms plus one at the end. The width is kept per viewer, in the same
  `<storage slug>:view:dock` entry as the collapse state (`width`, written only once changed), never in the map. It
  survives a reload and a fold to the rail.

## [0.2.0] — 2026-11-04

Minor (SL16 + SL17): two props embedding apps asked for, and the map-readability work (S6.1 Part A). Pack: `0.1.1`
(unchanged). No change to the map file format beyond one optional layout field that older cores ignore.

- **`selection` (SL16):** a controlled selection. Pass it with `onSelectionChange` and the map shows what the host
  selects (reader → map cross-highlighting); a host-set selection outside the view is brought into view (centred, zoom
  kept). Ids not on the map are ignored. `onSelectionChange` now fires once per real change and never for a no-op (a
  click that selects one circumstance used to report twice).
- **`hideNode(node)` (SL16):** circumstances it returns true for are left out of the canvas, the list view and every
  analysis, with their links. They stay in the map, its edits and its file exports (JSON, CSV, loop report); the PNG
  and SVG show the canvas. Change the predicate to show or hide them; nothing is saved by doing so.
- **Full screen (SL17):** a toolbar button and `F` put the whole workspace (toolbar, canvas, dock with host cards)
  in full screen through the Fullscreen API, or a fixed overlay when that is refused or does not answer. `Esc` and the
  button leave; the canvas refits both ways. A view state, never saved.
- **Node titles (SL17):** the box's text is drawn in an HTML layer over the canvas, in three weights: the code line
  small above, the title (the label, or the code's title) bold and larger, the circumstance smallest and muted. Each
  box is sized to its measured text; a title over 42 characters is cut with "…", as the label was in 0.1.1, and the
  peek shows it whole. A per-map **Node text** setting in the Map panel (`layout.nodeText`): *Title*,
  *Title + code* (the default, written only once changed) or *Full*. The circumstance text is left off by default
  (Daniel, 2026-11-04) and shows in the peek and in *Full*. A label's own italic, size and colour still win; greyscale
  and dark mode keep working. PNG and SVG exports draw the same text flat, from the canvas's own (otherwise
  transparent) label.
- **Peek (SL17):** right-click, Ctrl-click or long-press on a circumstance or a link — or the ContextMenu key or
  Shift+F10 on the canvas's selection — opens a read-only popover: for a circumstance its code and title, label,
  circumstance text, code status, links in and out, and loops; for a link from → to, polarity, weight, delay, basis
  (evidence link id and grade, or ⚑ with the reason) and the mechanism with its [n] as SDOH Loops references.
  `renderPeek(target)` appends the host's lines. "Open in editor" selects the target. Click-away and `Esc` close it.
  **Changed:** right-click and long-press no longer open the association menu (Daniel, 2026-11-04: keep); it is the
  peek's "Associations…" button, and `A`, the toolbar, the editor's button and the ⋯ handle are unchanged.
- **Side dock (SL17):** the single side panel is a stack of cards: the core's editor (evidence toggle, tabs, tab body)
  on top, then the host's cards from `sideCards: { id, title, render(selection) }[]`. Each card collapses by its
  header and scrolls inside itself. From 1024 px up the whole dock collapses to a rail (button, `]`) that lists the
  cards and reopens the dock. Collapse state is per viewer, in browser storage under the store's slug
  (`<slug>:view:dock`, so the host's Clear my data removes it), never in the map. Narrow screens keep the panels below
  the canvas.
- **Also:** `MapStore.slug` (set by `browserStore`, `idbStore`, `localStore`, kept by `withOriginals`), `viewPref` /
  `setViewPref`, `nodeTextParts` / `nodeLines` and `peekFacts` are exported; a `Popover` in full screen portals into
  the full-screen element.

## [0.1.1] — 2026-11-03

Patch (K14): four fixes from the 261103 user-guide capture, and the pack's wording release. Pack: `0.1.1`.

- **Loop glyphs on a phone:** under 768 px wide, the ↻R / ↺B glyphs scale with the canvas zoom, as the boxes do
  (between 0.3× and 1.5×). On wider screens they keep their size, as before.
- **Loop names on glyphs:** a renamed loop shows up to 24 characters, cut at a word with "…", and wraps onto a second
  line past 12 (K7 cut it to 8). The full name stays in the tooltip, and the glyph still avoids ⚑, ‖ and polarity marks.
- **Selected panel:** "Select a circumstance or a link to edit it." on a map with circumstances; the
  add-the-first-circumstance hint only on an empty map.
- **`<Notice plain>`:** the not-advice notice as a page section rather than the "Before you start" banner, for a page
  that must keep the words after the first-run panel is dismissed (the standalone app's /about, SAFETY H5).

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
