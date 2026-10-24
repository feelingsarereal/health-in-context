---
project: actualizer
app: sdoh-loops
type: requirements
as_of: 2026-10-23
source: Daniel, 2026-10-23 (two messages); Research Editor wording
---
# SDOH Loop Mapper — canvas & editing requirements

Every UI-* requirement below is Daniel's (2026-10-23). Each "how" line is the Research Editor's proposed implementation, which Claude Code may change if the walkthrough still passes.

## Building the map
- **UI-01 Add node.** Create a node (double-click the canvas, or press `N`), assign an ICD-11 SDOH code from a searchable picker, and describe the circumstance.
- **UI-02 Code popout.** Selecting or hovering a node's code opens a panel with the code title, the WHO definition, inclusions and exclusions, the parent block, the crosswalk (HP2030 domain, ICD-10-CM Z category) and a link to the WHO ICD-11 browser entry.
- **UI-03 Association menu.** Right-click a node, or press `A` (long-press on touch), to see the abstracted set of associated and dependent SDOH from `associations.yaml`, grouped by **Leads to** (downstream) and **Comes from** (upstream). Each entry shows its polarity, evidence grade and citation. Clicking an entry creates a new circumstance node under that code, pre-linked with the suggested polarity, ready to describe.
- **UI-04 Recode anything.** Every node, whether added freeform or from the menu, can be recoded. Recoding keeps its edges.
- **UI-05 Describe edges.** Every edge has a direction, a polarity (±), a weight (signed, −1…+1), a delay flag, a confidence level and a rich-text description (see `cld-methods.md` §2).

- **UI-16 Non-SDOH and undetermined nodes** (Daniel, 2026-10-23). A node's code status is one of:
  - **SDOH**: an ICD-11 code from `situations.yaml`.
  - **Other**: deliberately outside the SDOH set (a health outcome, a policy, an event, a resource or service, a personal factor). It takes an optional user-chosen **type** (`outcome · policy · event · resource · personal · other`) and an optional free-text reference (for example a code from another ICD-11 chapter, entered by the user and shown as "user-entered").
  - **Undetermined**: not yet decided. It shows a "?" badge and appears in a "To code" list in the side panel.
  All three take part equally in edges, loops, paths and the leverage hints. Other and undetermined nodes are drawn with a neutral fill and a dashed outline, so the map shows at a glance which parts are coded. The association menu (UI-03) is offered only on SDOH nodes; on the others it says "Assign an SDOH code to see associations". Recoding between the three states keeps all edges. The loop report and CSV export carry `code_status` and `type`.

## Layout
- **UI-06 Auto-arrange for readability.** One click re-lays out the map to minimise edge crossings and overlaps, spread loops apart and keep labels legible. *How:* Cytoscape.js with fCoSE (force-directed, compound-aware) as the default and ELK "stress" as an alternative, with node-overlap avoidance and label-size-aware spacing. Animate the transition, and keep the result undoable.
- **UI-07 Grab and drag.** Nodes can be dragged freely, and a dragged node stays **pinned** (shown by a small pin). Auto-arrange respects pins unless the user chooses "Re-arrange all". Multi-select uses box-drag or Shift-click. Pan and zoom use the trackpad, mouse wheel and pinch.
- **UI-08 Arrange a selection or a loop.** Auto-arrange can run on the current selection only. "Arrange loop as circle" lays out a chosen loop as a ring, the CLD convention, so it reads as a loop.

## Interrogating the map
- **UI-09 Clickable loop identification.** The Loops panel lists every detected loop with its R/B badge, members, length and strength heuristic. Clicking a loop highlights its nodes and edges and dims everything else. The canvas shows each loop's ↻R / ↺B glyph at its centroid, and clicking the glyph also selects the loop. Loops can be renamed, and the panel can filter by R/B and by node.
- **UI-10 First- and second-degree associations.** Selecting a node and pressing `1` or `2` (or using the toolbar toggle) highlights its 1-hop or 2-hop neighbourhood in the **user's map**, incoming and outgoing shown in separate tints. The association menu (UI-03) can also step one level further: "Show 2nd-degree" expands each evidence entry to its own downstream and upstream links, still with citations.
- **UI-11 Positive and negative link inventory, paths, leverage hints** as specified in `cld-methods.md` §3 (A1, A6, A7).

## Styling
- **UI-12 Colours.** Node fill defaults to a colour per ICD-11 block (a colour-blind-safe categorical palette, with a legend). The user can override the colour per node or per selection. Edge colour defaults by polarity and can be overridden per edge. Colour is never the only carrier of meaning: polarity is always also shown as a +/− glyph at the arrowhead.
- **UI-13 Line type selector.** Each edge offers solid, dashed or dotted lines and a curved or straight route. Thickness maps to |weight| by default and can be switched off. A delay is drawn as the ‖ mark.
- **UI-14 Map themes.** Light and dark themes, plus a "print / greyscale" theme in which polarity relies on the glyphs and line types.

## Rich text
- **UI-15 Basic rich text** in the node label, the circumstance description, the edge description and free **canvas notes** (sticky text boxes):
  - font size selector (S / M / L / XL, or 10–28 pt),
  - **bold**, *italic*, underline,
  - text colour (the same palette, plus custom),
  - bulleted list and link (optional, P2).
  *How:* a small Tiptap/ProseMirror editor limited to those marks, stored as a restricted JSON document, never as raw HTML. It is sanitised on import and rendered to the canvas label with the same marks. Long descriptions are truncated on the canvas with "…" and shown in full in the side panel.

## Keyboard map (initial — shown in a `?` overlay)
`N` new node · `E` new edge from selection · `A` association menu · `1` / `2` neighbourhood · `L` loops panel · `R` auto-arrange · `P` pin/unpin · `Del` delete · `⌘Z` / `⌘⇧Z` undo/redo · `⌘B` / `⌘I` / `⌘U` bold/italic/underline while editing text.

## Constraints carried from the pack
On-device storage only (IndexedDB, with JSON export and import). No server. Health safety profile: no diagnosis language, de-identification nudges on the `subject` field, and the analyses labelled as heuristics wherever `cld-methods.md` says so.
