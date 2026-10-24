---
type: spec
project: actualizer
version: 0.1
status: ratified-set (A0.1, 2026-10-23) · first draft
---

# SAFETY — profiles, invariants and how each is tested

**Version 0.1 · 2026-10-23.** New, seeded from Here for You's four INVARIANTs: no diagnosis · no PHI on a server · grounded resources only · the crisis rail is code, not a model. Every Actualizer app declares one profile in `manifest.safety_profile`. Profiles are cumulative: `health` includes everything in `general`, and `crisis-adjacent` includes everything in `health`.

An invariant is a property the **validator** and the **build's test suite** both enforce. A good intention in the prompt is not an invariant. If an invariant can't be tested, it gets rewritten until it can.

## 1. `general`: every app

| ID | Invariant | Validator | Build test |
|---|---|---|---|
| G1 | **Nothing factual is invented at build time.** Every fact the app renders comes from the pack; gaps render as `TODO(author)`. | pack completeness; todo items never rendered as fact | provenance counts; a fixture fact removed from the pack disappears from the app |
| G2 | **No runtime content fetches.** Content ships in `dist/`; the only network calls are user-initiated external links. | — | Playwright records every request after load and fails on any non-same-origin request that wasn't a click on an external link |
| G3 | **Provenance is visible.** `as_of` on `/`, `/about` and `/methods`; every graded item shows its grade and refs; interim sources are named. | `as_of` and `scheme.interim_source` present | `as_of` visible on the three routes |
| G4 | **Heuristics say so.** Any computed ranking, score or suggestion that is not a published result carries the label the pack gives it. | each `rule`/heuristic has a `label` | the label text is present wherever the result renders |
| G5 | **No telemetry.** No analytics, no error reporters, no third-party fonts or scripts loaded at runtime. | — | the bundle has no known analytics hosts; no external `<script>`/`<link>` in `dist/index.html` |

## 2. `health`: adds

| ID | Invariant | Validator | Build test |
|---|---|---|---|
| H1 | **No diagnosis, no treatment advice.** The app never states or implies that a person has a condition, and never recommends a clinical action. Codes describe **circumstances**; the copy says "describes", never "diagnoses". | a lint over every pack string for the profile's blocked phrases (`safety.yaml → blocked_phrases`) | the same lint runs over `dist/` text; the `must_not` lists in scenarios are asserted |
| H2 | **No personal data leaves the device.** Whatever the user types about a person stays in the browser (IndexedDB/localStorage) and leaves only through a user-initiated export. No server, no sync, no account. | `manifest.storage: device` | Playwright: type a sentinel string, use every feature, and assert it appears in no request; with `delivery: pages`, run the same over the built site |
| H3 | **De-identify by default.** Where a person is described (persona `acts_for: other`/`group`), the subject field prompts for initials or a label, and a one-line nudge says not to enter names, dates of birth, addresses or record numbers. | `safety.yaml → deidentify.fields` lists them | the nudge text renders on each listed field |
| H4 | **Clear my data.** One visible control deletes everything the app stored on this device, after a confirm. | — | Playwright: create data, clear it, reload; storage is empty |
| H5 | **Not-advice notice.** `/about` and the first-run panel say what the tool is and is not, in words from `safety.yaml → notice` (cited where it makes claims). | `notice` present | the notice renders on first run and on `/about` |
| H6 | **Where to get help.** A static help page lists the pack's `help` entries (name, how to reach, source, `verified_on`). There is no triage logic. | each entry has a source and `verified_on`, and is within its recheck interval | the page renders every entry; there are no conditional branches on user input |

## 3. `crisis-adjacent`: adds (HFY)

| ID | Invariant | Validator | Build test |
|---|---|---|---|
| C1 | **The crisis rail is code, not a model.** A fixed, always-reachable control (keyboard and touch) leads to the crisis entries in `safety.yaml → crisis`. Its content is static, from the pack, and never generated or ranked. | crisis entries are sourced and verified within 30 days | the rail is present on every route at 375 px and 1280 px; reachable in ≤ 2 Tab stops from page top |
| C2 | **Grounded resources only.** Every resource, number or service shown comes from `resources.yaml`/`safety.yaml` with a source and `verified_on`. Nothing is shown past its recheck date without a stale label. | resource sources and dates | a stale fixture renders with the stale label |
| C3 | **No PHI on a server**, with no exceptions for "anonymous" analytics or crash logs. This is H2 and G5 made non-waivable. | — | as H2 and G5, plus a review item in the walkthrough |
| C4 | **No diagnosis**, with H1's lint extended to symptom-to-condition phrasing. | extended phrase list | extended lint |

## 4. safety.yaml: what a pack declares

```yaml
profile: health
notice: >                       # H5: what this tool is and is not
  …
blocked_phrases:                # H1, case-insensitive whole-phrase lint (extend per app)
  - "you have"
  - "diagnos"                   # stem match: diagnose/diagnosis/diagnosed
  - "you should take"
  - "treatment for you"
allowed_phrases:                # exact phrases removed before the lint runs, e.g. the app's own "does not diagnose".
  - "does not diagnose"         # There is NO general negation exemption: a negation test would also pass
                                # "you don't need a diagnosis, you have …" (Daniel, 2026-10-23)
allowed_contexts:               # where a blocked stem is legitimate (e.g. quoting ICD's own title text, verbatim abstracts)
  - field: situations.items[].definition
deidentify:
  fields: [subject, circumstance]
  nudge: "Use initials or a label. Don't enter names, dates of birth, addresses or record numbers."
help:                           # H6
  - { name: "…", how: "…", source: "…", verified_on: 2026-10-23, recheck_days: 90 }
crisis: []                      # C1 (crisis-adjacent only)
```

## 5. Choosing a profile

Daniel decides at intake. The builder recommends:

- `general`: the user's inputs are about organisations, money or work, not a person's health or circumstances.
- `health`: the user describes a person's or a group's health-related circumstances (the SDOH Loop Mapper).
- `crisis-adjacent`: the app may be used by, or for, someone in acute distress (HFY Compass and Navigator).

## History
- v0.1.1 (2026-10-23): `allowed_phrases` (exact-phrase exemptions) added to H1; a general negation exemption is ruled out (Daniel, on the SDOH Loop Mapper K1 report).
- v0.1 (2026-10-23): first draft after A0.1. Three cumulative profiles; G1–G5, H1–H6 and C1–C4, each with a validator rule and a build test; the `safety.yaml` shape. The first `health` pilot is the SDOH Loop Mapper.
