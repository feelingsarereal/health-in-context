---
type: kickoff
project: actualizer
app: sdoh-loops
builder_version: "0.1"
created: 2026-10-23
---
<!-- Instantiated from docs/KICKOFF-TEMPLATE.md v0.1 by the Actualizer Cowork project, 2026-10-23. Branches kept: kind=workbench, profile=health, delivery=local. -->

# KICKOFF — SDOH Loop Mapper: map a person's or group's social circumstances with ICD-11 codes and find the loops that hold them in place

You are building **SDOH Loops**, a static web app made from an Actualizer action pack. It is a `workbench` app with safety profile **`health`**. You are the build-and-delivery role. The research is done and sits in `content-pack/`. **You add no facts.**

This is a single-shot build. Work through every section in order without stopping for confirmation, and finish with §6 and §7.

## 0. Ground truth: read in this order

1. `docs/ACTION-SPEC.md`: what the app must be. §6 (provenance) and §8 (acceptance) bind you.
2. `docs/SAFETY.md`: the `health` invariants. Each one is a test you write (§5).
3. `docs/ACTION-PACK.md`: the schema of `content-pack/`.
4. `docs/DESIGN-SYSTEM.md`, then `docs/MI-DESIGN-SYSTEM.md`, which it inherits in full. Copy the `bx-` classes verbatim.
5. `docs/SUSTAIN.md` §4: what `/methods` must say about staleness.
6. `content-pack/manifest.yaml`, `audience.yaml`, `scenarios.yaml` (your acceptance tests), `safety.yaml`, then every module file in `manifest.modules`, `references.yaml`, `glossary.yaml`, `concepts/`, `ui-strings.yaml` and `todo.yaml`. For a workbench or planner, also `app-requirements.md` and `app-methods.md`, which are **normative** for the main surface.
7. The contracts: `../../../CLAUDE.md` (vault) and `../../CLAUDE.md` (team), if present. Your scrum note goes in `notes/Scrums/YYMMDD.md` with frontmatter `type: scrum` · `project: actualizer` · `app: sdoh-loops` · `date:` · `author: claude-code`. The K item is in `../../notes/Backlog/` with `app: sdoh-loops`; set it to `inreview` when you finish.

Reference implementations you may mine for patterns (do **not** copy their data): `../../../manuscript-interrogator/apps/ptsd-inflammation-critique/` (graph analytics with golden fixtures; notepad), `../../../manuscript-interrogator/apps/token-for-granted/` (pathfinder, gates), `../../../manuscript-interrogator/apps/toptechhr/` (action plan), `../../../CountChocula/` (design ancestor).

## 1. Hard rules

- **Never invent facts.** Every definition, mechanism, grade, reference summary, abstract, help entry and interface claim comes from the pack. Gaps render as amber `TODO(author)` (`.bx-todo`) and are listed on `/methods`.
- **Verbatim fields stay verbatim**: scheme titles and definitions, and abstracts. A null definition renders as "No definition in ICD-11" plus the source link.
- **Interim sources are disclosed.** When `situations.scheme.interim_source` is set, `/about` and every code pop-out say where the text came from and link the official entry.
- **Unverified evidence is not evidence.** A link or action that cites a `verified: false` reference is not offered as a suggestion; list it on `/methods`.
- **Heuristics carry their labels** (SAFETY G4) wherever they render.
- **Safety profile `health`:** every invariant in SAFETY §1–§2 is a requirement and a test. In particular:
  - no diagnosis or treatment language anywhere, and the `safety.yaml` lint runs over `dist/`; **nothing the user types leaves the browser**; de-identification nudges on `safety.yaml → deidentify.fields`; "Clear my data"; the not-advice notice; `/help`.
- **No runtime fetches, no telemetry, no third-party runtime assets** (SAFETY G2 and G5). Bundle the fonts or use system fonts.
- **Fail loudly in the content build.** Write errors to `content-pack/BUILD-ERRORS.md`, surface them on `/methods`, and build the rest. Never "fix" the pack.
- **Delivery is `local`** and is not yours to change. Under `local`, there is no remote.
- **GitHub identity:** `feelingsarereal`, checked with `gh auth status` before any push.
- Touch nothing outside this folder except the K item's `state`.

## 2. Scaffold

Vite 5 + React 18 + TypeScript strict + Tailwind 3, `react-router-dom` 6, `react-markdown` + `remark-gfm`, `@floating-ui/react`, `zod`, `js-yaml`; dev: `vitest`, `jsdom`, `@playwright/test`, `@axe-core/playwright`. Add the kind-specific libraries from §8. Repo layout per MI DESIGN-SYSTEM §7, plus `src/lib/storage/` (on-device workspace adapter), `src/lib/analysis/` (workbench), `tests/walkthroughs/` and `tests/safety/`. Wire `BASE_PATH` and the `404.html` fallback.

## 3. Content build: `scripts/build-content.ts` (`npm run build:content`)

1. Validate every pack file with zod schemas that mirror `docs/ACTION-PACK.md`. The same rules as `tools/validate_pack.py`, which must also pass: run it in CI.
2. Resolve every cross-reference: codes, groups, link endpoints, `suggest` codes, `refs` numbers, persona ids in scenarios, term and concept ids.
3. Emit `src/data/*.json` per module, plus `references.json` (with abstracts), `glossary.json`, `concepts.json` and `strings.json`.
4. Emit `public/provenance.json` (ACTION-SPEC §6.6) and `public/staleness.json` (SUSTAIN §4).
5. Run the safety lint over the pack strings (SAFETY H1) and fail on a hit outside `allowed_contexts`.
6. Be idempotent, and print a summary table.

## 4. App

Build in this order so each step is testable: shell + theme + header/footer → `/about` and `/methods` → `/references`, `/glossary`, `/concepts/:id` → `/evidence` → **the main surface for `workbench`** (ACTION-SPEC §3, plus §8 below) → the on-device workspace (ACTION-SPEC §4) → `/help` → `/` last, when there is something to start.

## 5. Tests

- **Vitest:** pack schemas (a fixture with one error per rule fails with the right message), storage adapter (save, load, migrate, clear), every analysis against the **golden fixtures** in §8 (a drift is a failure; never widen a tolerance), export/import round-trip.
- **Safety suite (`tests/safety/`)**, one spec per invariant of `health` (SAFETY tables): the request recorder (G2, H2: a typed sentinel string never appears in any request), the no-telemetry check (G5), the lint over `dist/` (H1), the nudge rendering (H3), clear-my-data (H4), notice and help (H5, H6).
- **Walkthrough suite (`tests/walkthroughs/`)**, one spec per `scenarios.yaml` entry: perform each `do`, assert each `expect`, and assert each `must_not`.
- **Playwright smoke:** every route renders its h1; dark mode persists; 375 px; keyboard-only paths through the main surface; the accessible view (workbench) supports create, edit and delete.
- **Lighthouse:** Accessibility 100 on `/` and the main surface; Performance ≥ 90 on `/`.

## 6. Ship — delivery: **local**

First: `git init`; `.gitignore`; exclude `notes/`, `source/` and the hub via `.git/info/exclude`; `npm run build` (base `/`) and `npm run preview`, then check the root, a deep link and the main surface. Keep `npm ci`, `npm run build` and `npm run preview -- --port 4194 --strictPort` working, and keep `<title>` on one line (the launcher `../../tools/shortcuts/▶ Open SDOH Loops.command` depends on them).

Then the `local` branch:
- **local:** no remote, no `gh repo create`, no `deploy.yml`. The README's quick start is local and ends with a "Publishing this later" recipe. Report the commit SHA and the two local commands.

## 7. Report

Write `notes/Scrums/YYMMDD.md`: what landed, the provenance counts, every `TODO(author)` and build error, the safety-suite and walkthrough results, and a checked copy of ACTION-SPEC §8. Anything unchecked goes under **▶️ Next**. Set the K item to `inreview`.

## 8. App-specific notes

This app is a **workbench** (ACTION-SPEC §3.3). `content-pack/app-requirements.md` (UI-01…UI-16) and `content-pack/app-methods.md` (§1–§5, analyses A1–A8) are **normative** for the main surface. Where they say "How:", it is a proposal you may change if the walkthroughs still pass; say so in the scrum note.

**8.1 Routes.** The main surface is `/map` (the canvas) and `/map/list` (the accessible list and table view with full create, edit and delete parity). The workspace index is `/maps`. The shell routes are as in ACTION-SPEC §2: `/`, `/evidence`, `/references`, `/glossary`, `/concepts/:id`, `/help`, `/methods`, `/about`. Map content is personal data: **never put node or edge text in the URL**. The URL may hold only the map id and the view (for example `?view=loops`).

**8.2 Libraries.** Cytoscape.js with `cytoscape-fcose` (default auto-arrange) and `cytoscape-elk` (ELK "stress" alternative); Tiptap (`@tiptap/react`, starter-kit with only bold, italic, underline, text-style, colour and font-size enabled), stored as JSON and never as HTML; `idb-keyval` behind `src/lib/storage/`; `html-to-image` or Cytoscape's own `png()`/`svg` export. Code-split everything on `/map` so that `/` stays at Lighthouse Performance ≥ 90. Record the choices in the README.

**8.3 Build order for the main surface.**
1. Storage adapter and map model (`planner.yaml → fields`, `enums`): nodes carry `code_status` sdoh/other/undetermined (UI-16).
2. Canvas: add node (double-click or `N`), code picker (search over code, title and `index_terms`), code pop-out (UI-02: title, verbatim definition or "No definition in ICD-11", inclusions, exclusions, coded-elsewhere, the block, the proposed crosswalk chip, the interim-source note, the WHO link).
3. Edges (UI-05) with polarity, weight (sign locked to polarity), delay, confidence and rich-text description.
4. Association menu (UI-03) from `links.yaml`: for a node's code, match links whose `from`/`to` is the code, its parent, `QD71` when the code sits under it (`situations.items[].subgroup`), or its group. Show Leads to / Comes from, ordered by `situations.tiers` (structural first, then material, psychosocial, behavioural), each entry with polarity, grade chip, mechanism and citation fold-out. Choosing one creates the linked node with the `suggest` codes pre-offered. "Show 2nd-degree" expands one more hop (UI-10). Only for `code_status: sdoh`. **Never offer `withheld_links`.**
5. Layout (UI-06–UI-08): fCoSE auto-arrange respecting pins, undoable and animated (honour reduced motion); drag-to-pin; arrange selection; arrange loop as circle.
6. Analyses (`app-methods.md` §3): A1 link inventory, A2 loops (Johnson; caps 12 / 500), A3 R/B, A4 strength (labelled heuristic), A5 SCC (Tarjan), A6 paths (cap 200), A7 leverage (labelled), A8 what-if pulse (P2: build it last; skip it if time runs short and list it under Next).
7. Loops panel and canvas glyphs (UI-09); 1-hop and 2-hop highlight (UI-10); styling (UI-12–UI-14); rich text (UI-15); keyboard map and `?` overlay.
8. Export and import (`planner.yaml`), "Clear my data", the de-identification nudge on `safety.yaml → deidentify.fields`.

**8.4 Golden fixtures (required, `src/lib/analysis/__fixtures__/`).** Write each by hand, with its expected answers in the fixture file:
- *G1 three-node R loop:* A→B(+), B→C(+), C→A(+) → 1 loop, R, strength = product of |w|.
- *G2 mixed:* G1 plus C→D(−), D→C(−) → 2 loops: {A,B,C} R and {C,D} R (two negatives). SCC = {A,B,C,D}.
- *G3 balancing:* X→Y(+), Y→X(−) → 1 loop, B.
- *G4 no loops:* a DAG of 5 nodes → 0 loops, 5 singleton SCCs; paths from source to sink enumerated with net signs.
- *G5 the w1 map:* QD71.1→QD80(+), QD80→QD51(+), QD51→QD71.1(+, 0.75) → 1 R loop of 3.
- *G6 truncation:* a complete digraph on 8 nodes → the loop cap fires, with the "truncated" message.
Polarity is +/−. A weight whose sign disagrees with its polarity is a validation error (app-methods §3). A self-loop is refused.

**8.5 Scheme quirks.** `situations.yaml` carries 113 SDOH codes plus 12 functioning codes (`groups[].functioning: true`). Show the functioning codes in the picker under a separate heading, "Functioning (outside the SDOH set)". `QD71` appears both as a code and as a link-target group; the code's `subgroup` key resolves it. `definition_check` values other than `diff_verified`/`quoted_direct` render a small "check against WHO" note in the pop-out. `residuals` (Y/Z "other specified/unspecified" codes) appear in the picker after the specific codes of their block.

**8.6 Persona checks.** p-caregiver means 375 px: long-press and a visible "⋯" open every context menu, and touch targets are ≥ 44 px. p-student means a screen reader: live-region announcements for analysis results, and every node and edge has an accessible name. p-navigator means keyboard-only: every canvas action is reachable without a mouse.
