---
type: spec
project: actualizer
version: 0.1
status: ratified-set (A0.1, 2026-10-23) · first draft
---

# DESIGN-SYSTEM — the MI look plus audience theming and canvases

**Version 0.1 · 2026-10-23.** Forked from the Manuscript Interrogator's DESIGN-SYSTEM 0.3, which applies **in full by reference**: stack (§1), tokens (§2), the `bx-` component classes (§3, copied verbatim), layout patterns (§4), interaction and accessibility rules (§5), voice (§6) and repo conventions (§7). The KICKOFF freezes a copy of MI's file into the app as `docs/MI-DESIGN-SYSTEM.md` beside this one. This file says only what Actualizer adds.

## 1. Per-app brand tokens

`manifest.brand` (optional) overrides `--bx-accent`, adds a logo and sets the wordmark. Without it, the MI warm-paper look stands. The account's brand (feelingsarereal/LOF apps) is a brand block in the pack, never hard-coded. Contrast must stay ≥ 4.5:1 for text and ≥ 3:1 for UI marks in both themes; the validator checks hex pairs.

## 2. Audience theming

- `reading_level ≤ grade-9`, or any persona with `stress: high`: body text 17 px minimum, line length ≤ 66ch, one primary action per screen, no jargon without a term popover.
- Persona `device: phone`: touch targets ≥ 44 px; anything opened by a right-click is also reachable by long-press and from a visible "⋯" button.
- `accessibility: screen-reader`: every canvas object has an accessible name; live regions announce analysis results ("4 loops found: 3 reinforcing, 1 balancing").

## 3. Canvas components (workbench)

| Class | Use | Rule |
|---|---|---|
| `.ax-canvas` | the drawing surface | `bg-[color:var(--bx-bg)]` with a 24 px dot grid at 6 % ink; there is always an accessible view beside it (ACTION-SPEC §3.3). |
| `.ax-node` | a node | rounded 10 px, 1.5 px border; fill from the **group palette**; label in body font. Non-coded nodes (`other`, `undetermined`) use a neutral fill and a dashed border. |
| `.ax-edge-pos` / `.ax-edge-neg` | polarity | the polarity glyph (+ / −) always sits at the arrowhead; colour is secondary and user-overridable. |
| `.ax-loop-r` / `.ax-loop-b` | loop glyphs | ↻R / ↺B in a 22 px circle at the loop's centroid; clickable; focusable. |
| `.ax-pin` | a pinned node | a small pin mark top-right; it never hides the label. |
| `.ax-heuristic` | any heuristic result | the `bx-chip` with the word **heuristic**; never amber (amber stays reserved for missing or unverified content). |
| `.ax-rt` | rich-text marks | only the marks the app allows (bold, italic, underline, size, colour); never raw HTML. |

**Group palette.** One hue per scheme group (for the SDOH pilot, 14 ICD-11 blocks), drawn from a colour-blind-safe categorical set. With more than 8 groups, hue is paired with a small group glyph on the node so colour is never the only cue. A legend is always available.

## 4. Engineering additions

- Canvas library: Cytoscape.js (with fCoSE and ELK layouts), or another client-side library the app requirements name. Record the choice in the README.
- A rich-text editor limited to the allowed marks (e.g. Tiptap with a whitelist), stored as JSON.
- Storage: `idb-keyval` or equivalent behind a small adapter with a localStorage fallback.
- Code-split the canvas and layout engines so `/` stays under the Lighthouse bar.

## History
- v0.1 (2026-10-23): first draft after A0.1. Inherits MI DESIGN-SYSTEM 0.3 in full; adds brand tokens, audience theming, canvas components and the group palette rule.
