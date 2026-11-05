# Changelog — @feelingsarereal/sdoh-loops-core

[Semantic Versioning](https://semver.org/). Each release names the `@feelingsarereal/sdoh-loops-pack` version it was
tested with; that version is the exact `peerDependency`, so a consumer pins both.

- **Major:** a breaking change to `<SdohMap>`'s props, the `MapStore` adapter, an exported function's signature, or the
  map file format (a migration that older cores cannot read).
- **Minor:** a new feature, prop, export or analysis; existing behaviour unchanged.
- **Patch:** fixes, wording, performance.

While the version is 0.x, a minor bump may break; consumers should pin an exact version.

## [0.9.0] — 2026-11-04

Minor (SL28, S7.1 slice 4): traceability everywhere — a notebook passage can point at every item kind and every item
shows the passages behind it; @ mentions; the trace view; notes collapse; Export case and the complete case report. The
notebook is available to hosts. Pack: `0.2.0` (unchanged). New props `notebookTargets` and `passage`; new optional
map-file fields (`span.chip`); existing behavior unchanged except as listed.

- **Notebook → anything (point 1).** The action bar's **Link to…** is now one picker over every kind: circumstances,
  links, loops (by their node cycle), clusters, ICD-11 codes, references (the pack's and user-entered ones), glossary
  terms, 101s, other notes and passages, and a host's own kinds (`notebookTargets`). Drawing a new link between two
  circumstances (the 0.8.0 behavior) is its first choice. **@** at the start of a word opens the same picker and
  inserts a chip — an annotation on an empty span, anchored by the text around it; typing after it leaves it in place,
  an edit that removes its context orphans it; Esc types a plain @ (an @ inside a word, as in an email address, is just
  an @). A click on a target opens it: on the map, in the Loops or Clusters tab, or in a dialog with WHO's text, the
  reference card, the term or the 101.
- **Anything → notebook (point 2).** The case summary gains a **Sources** column (n passages, Go to passage) and a
  passages fold-out under each loop; the Loops and Clusters tabs show each loop's and cluster's passages, grouped by
  circumstance; the selection card (Read) also lists the passages that cite the circumstance's code or the link's
  references. References, codes, glossary terms and 101s show **Cited in your notebook (n)** wherever they open — in
  the map, and (with `<NotebookCitations>`) on the standalone app's References, Glossary and 101 pages, linking back
  to the passage in its map (`?passage=`).
- **Cross-highlighting (point 3).** Selecting an item on the map rings its passages (as in 0.8.0); the caret in a passage
  selects what it supports, through the controlled selection. **Trace** (beside Notebook) dims everything not
  connected to the current passage or selection, on the canvas and in the notes (a muted colour, not transparency, so
  dimmed text still meets contrast).
- **Case export and import (point 4).** **Export case (.json)** writes the map with its notebook and a `provenance`
  block: counts of notes, passages, mentions, annotations and comments, identifiers labelled per category (never the
  values), and the pins. Open a map file restores both sides with their links; the block is written fresh each time.
- **The case report (point 4).** **Export report…** makes, in the browser, the notes in order, then the case summary
  with each circumstance's quoted sources ("In the notebook (n)", note title and page or heading) and each loop's
  passages, then the references the notebook cites, numbered with full citations — as **Print / Save as PDF** (a print
  stylesheet: a page break before each note, black on white), one self-contained **HTML** file, **Markdown** or
  **Word (.docx)** (a small in-browser ZIP writer; no new dependency). Options: the notes, the map picture, the
  annotations. The cover gives the map name, subject label, date, the pins (core, pack, ICD-11 release) and the counts,
  and says the identifier check is a heuristic; the report goes through the identifier warning, and a flagged value is
  in it only if the user chose to continue as it is (the cover then says so). The report's code loads on first use.
- **Embedding (point 5).** `<SdohMap notebook>` is for hosts now. `notebookTargets` adds a host's own item kinds;
  `passage` opens the notebook at a passage. New exports: the target model (`searchTargets`, `targetName`,
  `passagesBehind`, `traceSet`, `loopTargetId`, `clusterTargetId`, `NotebookTargetKind`), `exportCase` /
  `caseProvenance`, `summaryRow` / `linkSummary`, `CitedInNotebook`, `NotebookCitations`, `CitationsContext`,
  `CORE_VERSION`.
- **Notes collapse (point 6).** No note is open until the viewer opens one, or the one they last left open (kept with the
  dock state, never in the map). A click on the open note's row, the ⌃ **Collapse** button beside its title, or Esc in the
  note list collapses it; each row has `aria-expanded`; Alt+↑ / Alt+↓ still reorder; Go to passage, a search result, a
  new note or an import opens its note as before. A free note left untitled and empty goes when it is collapsed or
  another note opens (and any left from before when the notebook next opens), with an Undo toast.

**For hosts (S4.1):** bump the pin to `0.9.0` (pack unchanged). Nothing changes until you pass `notebook`; with it on,
add `<NotebookHelp />` to your Help page, consider `notebookTargets` for your own entries, and note that the
notebook's per-viewer state (the open note, Trace) is kept under your store's slug.

## [0.8.0] — 2026-11-04

Minor (SL27, S7.1 slice 3): select, annotate and create circumstances from notebook text, with suggested codes and the
extension point for assisted extraction; the selection card and peek list a circumstance's passages; PDF imports read
private-use glyphs. Pack: `0.2.0` (unchanged). New props and optional map-file fields (`notebook.spans`,
`notebook.annotations`, `sources`, `suggested_by`) in schema 3; existing behavior unchanged except as listed.

- **Select → span.** A text selection in a note (free, structured or imported) opens an action bar: Create
  circumstance and Add as evidence to… (two equal actions), Link to…, Annotate, Copy quote; Ctrl+Enter or Shift+F10
  moves into it from the keyboard, Esc back. A span keeps its quote, prefix, suffix and offsets (a W3C
  TextQuoteSelector with a position hint), taken from the editor's own text. Edits before or after it move it; an edit
  inside it, or deleting its text, orphans it — listed under **Orphaned selections**, never re-pointed. A label that
  replaces an identifier replaces it in a span's copies and comments too.
- **Highlights** use the Interrogator reader's span classes (DESIGN-SYSTEM §0 D0.1), moved into the core's styles:
  solid underline for spans the user made, dashed or dotted with "≈" for ones accepted as inferred, a thin underline for
  a span that backs nothing; told apart by line style in grayscale. The selected circumstance's spans get the focus
  ring. A click (or a double click) on a highlight selects its circumstance or link, opens the card in the viewer's own
  mode, and brings it into view; overlapping spans open a chooser.
- **Annotate:** a comment on a span, in the margin beside the text on a wide notebook (640 px and up) and inline on a
  narrow one; comments are covered by the identifier check.
- **Create circumstance:** the selected words pre-fill the label; the panel shows the local suggester's top five codes
  (pack titles, index terms and `search_aliases`; Chapter 24 only), matched words marked, each "suggested", plus Not
  sure yet, Other and Search all codes; nothing is chosen until the user picks. **Add as evidence to…** lists the map's
  circumstances and links, those the selection suggests first. **Link to…** opens the usual form (both ends, the
  polarity, the evidence check). Each attaches the span both ways in one step, so Undo restores both sides.
- **Integrity:** deleting a circumstance or link backed by passages asks whether to keep them as plain highlights or
  remove them; sources and targets are reconciled on every load and import.
- **The passages on the item (point 8):** the selection card shows **In the notebook (n)** in Read and in Edit — each
  quote (two lines), its note and anchor ("eviction-letter · p. 2", "Contact note · What was discussed"), **Go to
  passage** (opens the notebook, scrolls the highlight into view inside it and focuses it) and **Remove as evidence**
  (one Undo step; the highlight stays only if something else uses it). The peek says "In the notebook: 2 passages",
  with a link that opens the card.
- **Assisted extraction (extension point):** `NotebookExtractor` and `Proposal` (the SDOH-EXTRACTION record shape);
  **Suggest circumstances in this note** runs one (an engine picker only when there are several) into a proposal queue —
  Accept, Edit then accept, Reject; nothing applied without a click. Every proposal and accepted item says "suggested by:
  <extractor>", kept in the map file (`suggested_by`, `span.by`). The core's **local code matcher** is first. New props
  `extractors` and `allowRemoteExtractors`; a `remote` extractor is refused unless the host allows it **and** the note
  has no unresolved identifier flags.
- **PDF import reads private-use glyphs (point 9).** A browser's print to PDF can name some glyphs by a private-use code
  point (Inter's alternates next to digits; icon fonts), which showed as boxes and lost "(2024)"'s parentheses. The text
  is now NFC-normalized; a private-use glyph takes its character from its glyph name, or (in a Type 3 font) from a glyph
  with the same outline, or — a flat bar — a dash; anything still unreadable, U+FFFD and control characters are left out
  and counted ("4 characters could not be read and were left out", in the review step and on the note).
- Fixes found on the way: the notebook's new-note title no longer takes focus back from where the user moved meanwhile;
  a quick edit's deferred focus no longer undoes a selection made in it.

## [0.7.0] — 2026-11-04

Minor (SL29, S7.1 slice 2): import files into the case manager notebook, and cities in the identifier check.
Pack: `0.2.0` (unchanged). New prop, new note kind (in schema 3: older cores read an imported note as a free note); existing
behavior unchanged.

- **Import a file…** in the notebook header, **Import into the notebook…** in the Map menu, a drop on the notebook
  (with a drop zone), and **Paste as a note**. Formats: `.txt`, `.md` (front matter dropped), `.html`/`.htm`
  (sanitized to text, headings and lists; head, title, meta, scripts and styles dropped), `.rtf` (font, color and style
  tables and the `\info` group dropped), `.csv` (a table note), `.docx` (bundled mammoth; the body only, so its
  properties are never read), `.pdf` (bundled pdf.js 4.10.38, its worker served from the app's own origin, the text
  layer page by page; the document info is never read). A scanned PDF reports "This PDF has no text layer (it looks
  scanned), so nothing could be read", with OCR named as a later option; any other type is refused with the list of
  supported types. Several files at once, each one note; a failure in one never blocks the others.
- **Kept:** the text, as a note of kind `imported` with `source: { filename, type, size, imported, pages?, review,
  kept? }`; PDF page starts as `anchors` (drawn as "p. N" markers) and DOCX/HTML/Markdown headings, so `anchorOf(note,
  block)` says "p. 3" or "under Housing". **The original file is not stored**, nor its metadata; the dialog says so and
  suggests keeping the original where it already lives. Imported text is verbatim: shown read-only (selectable, with
  its flags), with title and tags editable; labels still replace identifiers in it.
- **The identifier check runs before saving.** Each file opens in a review step with the flags shown and a count by
  category: **Label all**, **Review one by one** (Replace with a label / Not an identifier, flag by flag), **Keep as is**
  (asks once; recorded as `review: 'kept'` with the count kept), or Skip this file. Labelling happens on the unsaved copy,
  so a replaced value never reaches storage; label counts by category are recorded as in SL26.
- **Limits:** 20 MB per file and 300 PDF pages by default, set with the new **`notebookImport`** prop. A progress bar runs
  while files are read; reading runs in workers, so the page stays responsive.
- **Cities in the identifier check** (HIPAA Safe Harbor: a unit smaller than a state): "City, ST", "City, State" and a
  city followed by a state and ZIP ("Huntsville AL 35801") become `[city]`; a state alone, "the AL East" and "St. Louis
  Blues" are not flagged; a name before a state stays a name. Help lists cities among what is caught.
- **Bundle:** the parsers load on first import only (import entry 2.4 kB gzip; pdf.js 121 kB gzip; the import worker
  393 kB and the pdf.js worker 1.4 MB, both lazy); the standalone app's map route grew 3.1 kB gzip; the consumer
  fixture's first chunk is unchanged (SL21).

## [0.6.0] — 2026-11-04

Minor (SL31): quick field edit in Read mode (a new prop), the page-scroll leak left after 0.5.1, and three more kinds of
identifier. Pack: `0.2.0` (unchanged). No map-file change; existing behavior unchanged except as listed.

- **Quick field edit (`quickEdit`, new prop, default `true` where the map is editable).** In the selection card's Read
  mode, hovering or focusing an editable row shows a small ✎ ("Edit Label", always in the tab order, always visible on a
  touch screen). It turns only that field into an editor in place, focused, while the card stays in Read mode: **Enter**
  saves (Shift+Enter is a new line in the longer fields), a click away saves, **Esc** cancels; each save is one Undo step
  and autosaves; the live region says "Label saved."; focus returns to the ✎. Fields: a circumstance's **Label** (one
  line), **Circumstance** and **Notes** (a compact editor: bold, italic, underline, and "More formatting", which saves
  and opens Edit mode; formatting already in the text, such as a color or size, is kept), **Pinned in place** (a
  switch), and a link's **Description** and **Delay** (a switch). **Not quick-editable, by design:** code and code status,
  polarity, weight, confidence, ⚑ override reasons, and delete — each changes what the evidence check vouches for or
  needs a reason, so their rows have no ✎. A read-only map (a host's built original) shows none of it.
- **The page no longer scrolls under the map (SL30 leak).** The fitted workspace now also leaves room for what the page
  lays out below it when that is footer-sized (up to 15% of the window; more is the host's page carrying on, left to
  scroll as before), so in the standalone app the document is exactly the window: wheel scrolling past the
  notebook's end and tabbing through note fields leave `scrollY` at 0. A screen-reader-only caption in the case summary
  had been stretching the page to almost twice the window; the notebook's scroll box now contains it. The canvas
  container also has `overscroll-behavior: contain`.
- **Identifier check: dates of birth, ages, bare ZIP codes.** New categories `dob` ("DOB", "D.O.B.", "date of birth",
  "born on" and a date → `[date of birth]`, the lead word kept) and `age` ("34-year-old", "34 years old", "34 y/o",
  "34 years of age", "age 34", "aged 34" → `[age]`); and a bare 5-digit ZIP next to a state or a city and state
  ("Huntsville, AL 35801", "New York 10012") → `[ZIP code]`. "5 years", "the 10012 form", "born in 1961" and "page 34"
  stay unflagged. Names without a title or "my name is" stay out of scope; Help now says so plainly and tells the user
  to read their notes for names. A key a field already handled (`defaultPrevented`) is no longer also a map key.

## [0.5.1] — 2026-11-04

Patch (SL30, review fixes from the 0.5.0 walkthrough). Pack: `0.2.0` (unchanged). No prop, export or map-file change.

- **Identifier check: numeric dates before a period (privacy fix).** "on 03/14/2026." and "03/14/2026..." were not
  flagged: the numeric date patterns refused any `.` next to the date, so a date at the end of a sentence, or before a
  typed ellipsis, passed and stayed in the stored note. Now only a further digit, or a separator followed by a digit,
  rules a match out, and one date uses one separator throughout. Covered and unit-tested, positive and negative:
  `MM/DD/YYYY`, `M/D/YY`, `DD-MM-YYYY` (also `.`), `YYYY-MM-DD` (also `/`), `Month D, YYYY`, `D Month YYYY`, `Month D`
  without a year; a bare year, "3/4 of the rent" and "1/2 cup" stay unflagged. The label stays `[date]`. Flags are
  computed from the stored notebook each time a map loads (nothing is cached), so notes saved under 0.5.0 are flagged
  on first open under 0.5.1.
- **"Color", not "Colour", in the rich-text toolbar:** the menu reads **Color** (`aria-label` "Text color") and the
  picker "Custom text color", in the notebook fields and the Add circumstance and Link to… dialogs; the dock's fill menu
  reads "Block color". The US-spelling unit test now scans the strings written in every component as well as `copy.ts`.
- **The workspace fills the viewport** from lg up on the canvas (see the README's "Workspace height"); the notebook and
  the dock contain their own scrolling (`overscroll-behavior: contain`), so typing or scrolling in a note never scrolls
  the page or pushes the toolbar out of view.
- **The dock folds once for the notebook:** the first time the notebook opens on a screen under 1600 px, the dock folds
  to its rail, remembered per viewer; unfolding it again sticks.
- **The code line carries WHO's title:** in the selection card (Read) and the peek, the small line above the label reads
  "⚡ QE8Z · Problems associated with harmful or traumatic events, unspecified" — the code, then WHO's title from the
  pinned pack. One line, cut with an ellipsis; the full line is its tooltip and accessible name, and it wraps to show
  all of it on keyboard focus. "Other" and "Not sure yet" show their type as before; the canvas box is unchanged. Links
  have no code line in either place, so they are unchanged. Internal helper: `codeLine()` in `components/map/nodeText.ts`.

## [0.5.0] — 2026-11-04

Minor (SL26, S7.1 slice 1): the case manager notebook, map schema 3, and the identifier check. Pack: `0.2.0`
(unchanged). New props, new exports, one new optional block in the map file; existing props and behavior unchanged.
The notebook is **off unless the host passes `notebook`**: embedding apps keep it off until SL28.

- **`<SdohMap notebook>`** (new prop, default off) shows a **Notebook** toggle beside List view. From lg up the notebook is
  a column between the canvas (or list) and the dock, with its own resize handle (same keys as the dock's: ← →, Home,
  double-click); below lg, **Map** and **Notebook** are tabs (arrow keys move between them). Whether it is shown and its
  width are per-viewer view state, kept with the dock's under `<slug>:view:dock` (`notebook`, `nbWidth`), never in the map.
  **`notebookTemplates`** (new prop): the host's own `NoteTemplate`s, offered after the core's four.
- **Notes:** create, rename, reorder (drag, or Alt+↑ / Alt+↓ on a focused note; Move up / Move down), duplicate and delete
  with an undo toast. **Free notes** use the map notes editor (bold, italic, underline, size, color) plus headings (H2, H3)
  and bulleted and numbered lists. **Structured notes** come from a template with headed fields, each a short rich-text
  block: *Intake*, *Contact note*, *Case conference*, *Plan review*. Each starts with a **Date** field that takes a year by
  default; "Use a full date" switches it to a date picker, and a full date is flagged. Search across notes (title, tags,
  text, fields); tags with a tag filter.
- **Storage:** the notebook lives in the map's new **`notebook`** block (`{ notes, dismissed, replaced }`) and autosaves
  through the map's store; the toolbar's Undo / Redo cover notebook edits. **Schema 3**: `SCHEMA_VERSION` is 3; schema 1
  and 2 files open unchanged (no notebook block is added). A map with notes exports as schema 3; a map without notes, and
  **"Save a copy without the notebook"** (a new Map menu item when the notebook has notes), export as **schema 2**, so
  released 0.4.x cores — which refuse any schema above 2 — still open them. A 0.4.x core cannot open a schema 3 file; it
  says so and imports nothing. "Save a copy" is the map plus its notebook by default. **Clear my data** empties notebooks
  with the maps that hold them (H4).
- **Identifier flags (a local heuristic, labeled so on screen and in Help; it never blocks typing):** as the user types,
  possible identifiers are underlined — names after an honorific or "my name is", dates other than a bare year, phone
  numbers, email and street addresses, ZIP+4, SSN-like and record-like numbers. The notebook header reads "3 possible
  identifiers"; the list offers **Replace with a label** and **Not an identifier** (remembered per notebook, as
  `category:value`) for each, and **Label them all**. A label replaces every copy of that value in the notebook, so the
  same person is the same **[Person A]** throughout (the bare surname after "Mr." too); the other labels are `[date]`,
  `[phone]`, `[email]`, `[address]`, `[ZIP code]`, `[ID number]` and `[record no.]`. **Only the category and count of what
  was replaced are stored (`replaced`), never the value**, and the replacement is applied to every step of the undo
  history and resets the field's own history, so Undo cannot bring it back (the Interrogator's `deid.yaml` rule).
- **Case summary (point 5, Daniel 13:54):** always the last section of the notebook, below every note; it cannot be
  deleted or moved, it updates live from the map, and it is read only (no editing control). **Tiles:** circumstances
  (by code status), links (evidence · ⚑), loops (reinforcing · balancing), Needs a code, and possible identifiers still
  flagged. **Circumstances table:** the list view's own table, now a shared component (`NodesTable`), so the two are
  identical row for row — circumstance, code and WHO title, code status · type, description, and links out and in with
  polarity and evidence; sort (map order, name, code, code status, most links), filter by code status or block, and a
  row click selects the circumstance on the map (on a phone it switches to the Map tab). **Loops** with their kind and
  members (a click highlights the loop), and **Leverage, top 5** (the Leverage tab's order, labeled a heuristic). It
  works on the map as shown: with `hideNode` it leaves those circumstances out and says "2 hidden circumstances not
  shown." Print includes it, so the notebook prints as a report.
- **List view:** its circumstances table is `NodesTable` too, which adds a **Code status · type** column and a **Links
  out and in** column (the row's test id, `data-node` and actions are unchanged).
- **Export warnings:** every Map menu export (Save a copy, CSV, loop report, PNG, SVG), the notebook's **Print**, and any
  host `mapMenuItems` entry marked **`exports: true`** (e.g. an Interrogator app's "Open in SDOH Loops") warn while flags
  remain: **Label them all, then continue**, **Continue anyway** or **Cancel**.
- **Exports:** `NotebookHelp` (the Help page section: what the notebook is for, that it stays on this device, what the
  check can and cannot catch), the notebook model (`Notebook`, `Note`, `NoteTemplate`, `CORE_TEMPLATES`, `notebookFlags`,
  `labelFlag`, `labelAll`, `dismissFlag`, `sanitizeNotebook`, …), `findIdentifiers` and `IDENTIFIER_CATEGORIES`, and from
  the map model `hasNotebook`, `withoutNotebook` and `SCHEMA_NO_NOTEBOOK`. `MapMenuItem` gains `exports?`.
- **Rich text:** the formatting buttons keep the caret in the text (they no longer take focus on mousedown), in every
  rich-text field.
- **Copy:** US English, new keys under `notebook.*`.
- **Upkeep for an embedding app** bumping to 0.5.0: nothing changes unless it passes `notebook`. Its built maps (no
  notebook) migrate to schema 3 in memory and still export as schema 2; its drift test should see no difference.

## [0.4.1] — 2026-11-04

Patch: tested with, and pinned to, the new pack (SL19). Pack: `0.2.0`. No change to the core's code or props.

- `peerDependencies` names `@feelingsarereal/sdoh-loops-pack` `0.2.0`. That pack adds L30–L33 (QE04 → QE10, QE11, QE13,
  QE23), so the evidence check now backs those links and their descendants (e.g. QE04 → QE11.1), and the association menu
  offers them under QE04's "Leads to". QE04 → QE20 and QE03 → any behaviour stay unmatched. Unit tests cover all of these.
- An embedding app that bumps to 0.4.1 must pin pack 0.2.0 as well. Its drift test will report new links, and possibly
  new loops, on maps that use QE04.

## [0.4.0] — 2026-11-04

Minor (SL20 + SL21 + SL22 + SL23, with SL24's shared wording): a light theme entry, `<Notice text>`, the dock's
selection and Whole map cards with Read / Edit, the Map menu, US spelling, and tappable loop glyphs. Pack: `0.1.1`
(unchanged). No change to the map file. **Breaking for 0.x consumers:** the `Panel` ids, the `E` key, a few copy keys
and test ids changed (below); the map props are otherwise unchanged.

- **Loop glyphs you can tap (SL20, WCAG 2.5.8):** the glyph's button is now its hit target, never under 24 × 24 CSS px,
  with the visible face inside it (it still scales with the zoom on a phone). Glyphs are placed and kept apart by that
  target. Axe's `target-size` rule is clean on a phone, zoomed out, in the consumer fixture.
- **`@feelingsarereal/sdoh-loops-core/theme` (SL21):** `ThemeProvider`, `useTheme` and `styles.css`, with no import of
  the pack data (`sideEffects` names it so the styles survive tree-shaking). An app shell imports only this and lazy-loads
  the root entry on its map route; the consumer fixture now does, and its first chunk carries no `situations.json` or
  `references.json` (a bundle test).
- **`<Notice text>` (SL22):** an optional `text` (plain text or a short node) for an embedding app's own
  `safety.yaml → notice`; without it, the pack's notice. The consumer fixture shows its own.
- **The dock, by what each card is for (SL23):**
  - **The selection card** is titled by what is selected — "Selected circumstance", "Selected canvas note",
    "Selected link", "Selected: 3 circumstances" (or "…, 1 link"), "Nothing selected" — and has no tab row. It sizes
    to its content, up to half the dock.
  - **Read / Edit**, a segmented control in its header. **Read** (the default) shows the selection as text: code and
    WHO title, label, circumstance, code status, type, links in and out (each with its basis, evidence id and grade),
    loops, pinned state, notes, and the code's WHO text; a link's polarity, weight, delay, confidence, basis with grade,
    and its mechanism with SDOH Loops references. No editing control is in the DOM. **Edit** adds the controls and
    fields of 0.3.0. `E` toggles it. The mode is kept per viewer with the dock state (`mode`), never in the map.
    A read-only original hides the toggle and stays in Read. The peek's "Open in editor" opens the card in Edit, and
    Enter on the canvas does too.
  - **Whole map:** the "Evidence-backed links only" toggle, then Loops (count), Links, Paths, Leverage, What-if,
    Clusters, Legend, **Needs a code** and **About this map**. `PANELS` is now those nine ids; `inspect`, `tocode`
    and `map` are gone, and the default tab is `loops`.
  - **Needs a code** (was "To code"): a count badge for "Not sure yet" circumstances, a first line saying what the list
    is for, and — while there is nothing to list (no such circumstance and no link to review) — greyed out with
    `aria-disabled` and the tooltip "Every circumstance has a code status". The links to review stay listed there.
  - **About this map:** the map's name, subject (with the de-identification hint), notes and its two display settings
    (thickness, Node text). It is editable in Edit mode only; Read shows text.
  - Stored card ids are `selection` and `whole` (`edit` / `analyse` from 0.3.0 are ignored).
- **The Map menu (SL23):** a "Map" menu button beside the map's title (the ARIA menu-button pattern: Enter, Space or
  ↓ open it on the first item, ↑ on the last; arrows, Home, End; Esc returns to the button). Items, each with a
  one-line description: **Open a map file…** (first; the same import and validation as before, into a new map, then
  `onOpenMap`), **Save a copy** (.json), the CSV, loop report, PNG and SVG exports, **Print / grayscale** (moved off
  the toolbar row, a `menuitemcheckbox`), then the host's own `mapMenuItems` (new prop). `⌘O` / `Ctrl+O` and
  `⌘S` / `Ctrl+S` work from anywhere in the map but a dialog. The export test ids (`export-json` …) and
  `import-file` are kept, on the menu items and the hidden file input.
- **Keys:** `E` is Read / Edit, `K` is a new link from the selection (the toolbar's Link to… is unchanged). The
  pack 0.1.1 key list still says `E` for a new link; the core drops that line and lists `E`, `K` and `⌘O / ⌘S` itself.
- **US English (SL23):** the core's copy is US spelling ("color", "grayscale", "neighborhood", "Analyze"); the few
  British UI strings the pack 0.1.1 still carries under `app:` are respelled in the core until the pack's own change.
  WHO's titles and definitions are verbatim and untouched. A unit test checks a denylist of British forms over `C`.
- **Copy keys:** new `dock.selection.*`, `dock.read`, `dock.edit` (now the mode), `dock.mode`, `dock.wholeMap`,
  `panels.needsCode`, `panels.about`, `needsCode.*`, `read.*`, `mapMenu.*`, and (SL24) `maps.start`, `maps.openFile`,
  `maps.openFileHint`, `maps.dropHere`; `maps.new` is "Create a blank map". Gone: `dock.analyse`, `panels.inspect`,
  `panels.tocode`, `panels.map`, `node.toCode`, `maps.import`.

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
