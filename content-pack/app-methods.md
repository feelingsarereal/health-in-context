---
project: actualizer
app: sdoh-loops
type: research-note
as_of: 2026-10-23
---
# Causal-loop analysis — methods spec for the SDOH Loop Mapper

Everything here is standard system-dynamics and graph theory, cited to verified sources (see `bibliography.yaml`, group `methods`). The build must implement it exactly; where the spec says "heuristic" the UI must say so too.

## 1. What a node is

A **node** is one *circumstance instance*: a specific, described situation in a specific person's or group's life, tagged with one ICD-11 SDOH code, or is marked *other* or *undetermined* (below).

- Fields: `id`, `code` (ICD-11 MMS code, e.g. `QD71.0`), `label` (short), `circumstance` (free text), `subject` (person / household / group label — de-identified), `severity` (optional 0–3 ordinal), `since` (optional date or "unknown"), `notes`, `created`, `updated`.
- **Variable framing.** CLD links are defined between *variables*, so every node is read as the **degree or severity of that circumstance** (e.g. "Housing instability (QD71.1) — severity"). This is Richardson's (1986) fix for the classic ambiguity of event-labelled boxes. The node editor shows a one-line hint: *"Read this box as 'how much of this is present'."*
- A node can be re-coded at any time; recoding keeps its edges.
- `code_status`: `sdoh` | `other` | `undetermined` (UI-16). `code` is required only for `sdoh`; `other` nodes carry an optional `type` (outcome · policy · event · resource · personal · other) and an optional user-entered `ref`. Analyses A1–A8 treat all three alike; only the association menu needs an SDOH code.

## 2. What an edge is

A directed **edge** A → B says "a change in A causes a change in B, all else equal".

- `polarity`: `+` (B moves in the same direction as A) or `−` (B moves in the opposite direction). This is the standard CLD polarity definition (Richardson 1986; Sterman 2000 — Sterman pending verification).
- `weight`: a signed number in [−1, +1]. Its sign must equal the polarity. Default magnitude is 0.5. The UI offers a 5-step slider (0.1 · 0.25 · 0.5 · 0.75 · 1.0) as well as free entry. The weight is the user's judgement of relative influence, the same semantics as a fuzzy-cognitive-map edge weight (Kosko 1986; Özesmi & Özesmi 2004). **It is not an effect size.**
- `delay`: boolean (drawn as ‖ on the arrow, the CLD convention).
- `confidence`: low / medium / high (the user's own).
- `description`: free text describing the mechanism.
- `evidence`: optional list of bibliography ids. Edges created from the association menu carry the menu entry's citations automatically.
- `basis`: `evidence` | `override` | `needs-review` (UI-18). An edge is `evidence` only when a shipped link in `links.yaml` lists the edge's **from** code in `codes.from` and its **to** code in `codes.to` (a listed code also covers its descendants), in the same direction **and** polarity — matching never widens to the whole block (Daniel, 2026-10-24, option B); then `link` holds the link id and `evidence` its refs. Every other edge is an `override` with a required `override_reason`, an `override_at` date and the `check` result (`no-link` · `outside-codes:<id>` · `opposite-polarity` · `withheld:<id>` · `uncoded-end`). `outside-codes` means a link connects the two blocks but its evidence names other codes; the form names that link and its codes as the nearest supported alternative.

## 3. Analyses ("interrogate the map")

All analyses run in the browser on the current graph. Results list items that are clickable and highlight on the canvas.

| # | Analysis | Algorithm | Output |
|---|---|---|---|
| A1 | Link inventory | filter edges by polarity | lists of `+` and `−` links, sortable by \|weight\| |
| A2 | Feedback loops | Johnson (1975) elementary circuits; cap: length ≤ 12, count ≤ 500, with a "results truncated" warning past either cap | every loop with its node sequence |
| A3 | Loop polarity | product of edge signs: an even number of `−` → **R** (reinforcing); odd → **B** (balancing) (Richardson 1995) | an R/B badge, R/B counts |
| A4 | Loop strength *(heuristic)* | product of \|weights\| along the loop; rank loops by it | "strongest loops" list, labelled *structural heuristic — not loop dominance*. Dominance depends on behaviour over time (Richardson 1995), which this tool does not simulate |
| A5 | Feedback clusters | strongly connected components (Tarjan); Oliva (2004) partition | groups of nodes that sit inside shared feedback, shown as hulls |
| A6 | Paths between two nodes | all simple paths, cap 200; path sign = product of signs; path weight = product of weights | "How does X affect Y?": a net-sign summary (all +, all −, or mixed) |
| A7 | Leverage hints *(heuristic)* | per node: weighted in/out degree, betweenness, and loop-participation count (McGlashan et al. 2016) | a ranked table, labelled *hints for discussion*; never presented as "the cause" |
| A0 | Evidence filter | drop edges whose `basis` ≠ `evidence`, then re-run A1–A8 | every analysis panel has an "Evidence-backed links only" toggle; each loop shows its override count |
| A8 | What-if pulse *(P2, heuristic)* | FCM iteration x(t+1) = tanh(x(t) + Wᵀx(t)), clamped stimulus node, ≤ 30 steps or until converged (Kosko 1986) | a direction-of-change bar per node, labelled *qualitative exploration, not prediction* |

**Validation rules.** Blocking: an edge whose weight sign disagrees with its polarity cannot be saved, and self-loops are refused. Warnings: an `undetermined` node shows a "?" badge and is listed under "To code"; two edges A→B with different polarity are flagged as an ambiguity, since Richardson (1986) recommends splitting the variable instead.

## 4. Reading aids built into the UI

- **Loop naming:** each detected loop gets an editable name (default "R1", "B2", …), shown at the loop's centroid as the conventional ↻R / ↺B glyph.
- **Archetype hints** (text-only callouts, P2): if an R loop passes through income/finance codes *and* housing or employment codes, offer the reading "possible poverty-trap loop"; if a B loop contains a QE30 (welfare) node, offer "possible benefits-cliff/eligibility loop". These are prompts for discussion, each with a citation, never auto-labels.
- **Why polarity is hard:** a "?" popover summarising Richardson (1986) — say links in terms of variables, and keep "all else equal" in mind.

## 5. Interchange

- Native: `.sdohmap.json` (versioned schema: nodes, edges, loops-named, layout, code release `icd11_release`).
- Export: PNG/SVG of the canvas; CSV edge list (from, to, polarity, weight, delay, description); a loop report (Markdown/PDF) listing all loops with R/B, members and strength.
- Import: the app's own JSON; a CSV edge list.

## Sources
Richardson 1986 (doi:10.1002/sdr.4260020207) · Richardson 1995 (doi:10.1002/sdr.4260110106) · Johnson 1975 (doi:10.1137/0204007) · Oliva 2004 (doi:10.1002/sdr.298) · McGlashan et al. 2016 (doi:10.1371/journal.pone.0165459) · Kosko 1986 (doi:10.1016/S0020-7373(86)80040-2) · Özesmi & Özesmi 2004 (doi:10.1016/j.ecolmodel.2003.10.027) · Homer & Hirsch 2006 (doi:10.2105/AJPH.2005.062059) · Sterman 2000 (pending verification).
