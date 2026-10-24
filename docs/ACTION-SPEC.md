---
type: spec
project: actualizer
version: 0.1
status: ratified-set (A0.1, 2026-10-23) · first draft
---

# ACTION-SPEC — what every Actualizer app must be

**Version 0.1 · 2026-10-23 · normative.** Forked from the Manuscript Interrogator's APP-SPEC 0.6. Every Actualizer KICKOFF inherits this spec by reference, and an app is accepted against §8 **by walking its persona scenarios**. To change behaviour, change this file, not the prompts.

## 1. Purpose

One body of research → one static web app that **people act with**. It follows the arc *deep research → action model → tailored experience → upkeep*. The person using it is named in `audience.yaml`; every surface is judged by whether that person, under their constraints, can do their jobs.

## 2. The shell: every app

| Route | Must have |
|---|---|
| `/` | What the app is for (in the persona's words), a "Start" call to the main surface (§3), the not-advice notice where the profile requires one (SAFETY H5), `as_of`. |
| main surface | By `manifest.kind` (§3). |
| `/evidence` | The research. Under `evidence.body: review`, the reader from MI (APP-SPEC §2 `/read`, topic-mode rules). Under `records`, an evidence browser: every graded item (link, action, gate) with its grade, mechanism and reference cards, filterable by grade and group. |
| `/references` | Tiered as MI topic mode, plus each reference's verbatim abstract (folded, labelled "abstract, verbatim") and the records that use it. |
| `/glossary`, `/concepts/:id` | As MI APP-SPEC §2. The 101s are the app's primers. |
| `/help` | SAFETY H6 (health and crisis-adjacent profiles). |
| `/methods` | Provenance: counts, every `TODO(author)`, every heuristic and its label, interim sources, the build errors, the upkeep status (SUSTAIN §4: what is stale). |
| `/about` | Builder and version, `as_of`, licence and permissions, safety profile in plain words, how to report an error. |

Cross-cutting, inherited from MI APP-SPEC §3: popovers before page jumps; URL-addressable state for anything shareable that **is not personal data**; dark mode; reduced motion; 375 px; keyboard parity; Lighthouse Accessibility 100 on `/` and on the main surface; a print stylesheet for any output.

## 3. Main surface by kind

### 3.1 `navigator`
Stage rail → decision prompts (from `pathway.decisions`) → the matching actions and gates, ranked only by the pack's stated `rule`, with the counts behind each result shown ("12 of 15 fit both answers") → resources (when enabled) with availability and access shown separately → "Add to plan".

### 3.2 `planner`
Plan sections from `planner.yaml`; actions added from the pathway carry their `does_not_do` line and sources; placeholders (owner, date, measure) are left for the person to fill in.

### 3.3 `workbench`
A canvas on which the person builds a model of a situation from coded items (`situations.yaml`), with evidence-graded suggestions (`links.yaml`), and then interrogates it. The app's own requirements file (`source/ui-requirements.md`, frozen into the pack as `app-requirements.md`) is normative for the canvas, and the methods file (`app-methods.md`) for the analyses. **Every canvas has an equivalent accessible view**: a list and table of nodes and edges that supports the same create, edit and delete actions, so the canvas is never the only way in.

## 4. The on-device workspace (module `planner`)

- Storage is the browser only (IndexedDB, with a localStorage fallback), keyed by `manifest.slug`. There is no server, no account and no sync (SAFETY H2).
- Autosave on every change; several named workspaces (plans or maps) per device; duplicate, rename, delete.
- Export and import in the formats `planner.yaml` lists. The exported JSON carries `schema_version`, `pack_version` and the scheme release (e.g. ICD-11 2026-01). Import of an older `schema_version` migrates it or refuses with a clear message; it never silently drops fields.
- "Clear my data" (SAFETY H4).
- The MI notepad (APP-SPEC §3.1) is optional. Include it only when the app's requirements ask for it.

## 5. Audience tailoring

- Copy is written at the lowest `reading_level` among the personas the surface serves. Builder-authored strings live in the pack (`ui-strings.yaml`), not in components, so they can be reviewed.
- Every persona constraint maps to something testable: `device: phone` → the 375 px walkthrough; `accessibility: screen-reader` → axe checks and the accessible view; `languages` beyond `en` → i18n keys (v0.1: English only, with the keys in place).

## 6. Provenance rules (bind Claude Code)

1. The pack is the only source of facts. Restructure, link and render it; never add facts. Gaps become `TODO(author)`, listed on `/methods`.
2. Verbatim fields (scheme titles and definitions, abstracts) are rendered verbatim, with their source.
3. A null scheme definition renders as "No definition in <scheme>" plus the link to the source entry.
4. Anything resting on a `verified: false` reference is not rendered as evidence (ACTION-PACK §3.3).
5. Heuristics carry their labels (SAFETY G4).
6. `provenance.json` at build time: counts by module (items, links by grade, actions, gates, resources by freshness), references by tier and verification, abstracts present, todo count, heuristics, and the safety-test summary.

## 7. Engineering bar

As MI APP-SPEC §7 and DESIGN-SYSTEM: Vite + React 18 + TypeScript strict + Tailwind, a static `dist/`, `BASE_PATH`, Vitest and Playwright, plus:
- the **safety suite** (SAFETY tests for the declared profile),
- the **walkthrough suite** (one Playwright spec per `scenarios.yaml` entry),
- for a workbench, **golden fixtures** for every analysis (a small graph with known loops, polarities, paths and SCCs). A drift fails the suite and is never answered by widening a tolerance (MI APP-SPEC §4.1a).

## 8. Acceptance: walk it

- [ ] Every scenario in `scenarios.yaml` passes as a Playwright spec **and** when Daniel walks it in the app.
- [ ] Every `must_not` holds (lint plus the walk).
- [ ] The safety suite for the declared profile is green.
- [ ] Every shell route exists and is in the nav.
- [ ] `/methods` shows provenance counts, heuristics, interim sources, TODOs and staleness.
- [ ] The workspace persists across reloads, exports and re-imports losslessly, and "Clear my data" empties storage.
- [ ] Accessible view parity (workbench): every canvas action is possible from the list and table view by keyboard.
- [ ] Golden fixtures pass (workbench).
- [ ] Dark mode, reduced motion, 375 px; Lighthouse Accessibility 100 on `/` and the main surface, Performance ≥ 90 on `/`.
- [ ] Scrum note per the vault contract, with this checklist copied in and checked.

## History
- v0.1 (2026-10-23): first draft after A0.1, forked from APP-SPEC 0.6. Shell routes, three app kinds, the on-device workspace, audience tailoring, provenance rules, the safety and walkthrough suites, and walkthrough acceptance. Pilot: SDOH Loop Mapper (`workbench`).
