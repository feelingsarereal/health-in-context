---
type: spec
project: actualizer
version: 0.1
status: ratified-set (A0.1, 2026-10-23) · first draft
---

# ACTION-PACK — what Claude Code builds an Actualizer app from

**Version 0.1 · 2026-10-23.** Forked from the Manuscript Interrogator's CONTENT-PACK 0.10.2. The pack is written by the Actualizer Cowork project (research role) and is the **only** source of facts in a generated app (ACTION-SPEC §6). Claude Code validates it in `scripts/build-content.ts`, and the Cowork project with `tools/validate_pack.py`. Both fail loudly on any rule below. Everything is UTF-8 YAML or Markdown so Daniel can review it in Obsidian.

An Actualizer pack has two layers:

- **Evidence layer:** what is known and how we know it. This is the MI topic-mode pack, kept at the same rigour.
- **Action layer:** who acts, in what situation, deciding what; what they can do, what stands in the way, and what they leave with. Every app uses the **same action schema**, and an app switches on only the modules it needs.

It also carries three cross-cutting blocks: **safety** (SAFETY.md), **upkeep** (SUSTAIN.md) and **scenarios**, the persona walkthroughs that acceptance is judged by.

## 1. Layout

```
content-pack/
  manifest.yaml        # identity, kind, modules, safety_profile, delivery, storage, account, as_of
  # ── evidence layer (CONTENT-PACK 0.10.2 topic mode, §2) ──
  scope.yaml           # interview, boundary in/out, search strategy, corpus profile
  review.md            # OPTIONAL: a commissioned review (manifest.evidence.body: review)
  references.yaml      # tiered, verified, abstracts harvested verbatim
  glossary.yaml
  concepts/<id>.md     # the 101s (primers)
  figures.yaml         # optional
  # ── action layer (§3) ──
  audience.yaml        # REQUIRED: personas, constraints, jobs
  situations.yaml      # module situations: the coded vocabulary of circumstances
  links.yaml           # module links: evidence-graded relations between situations
  pathway.yaml         # module pathway: stages → decisions → actions → gates → outputs
  resources.yaml       # module resources: dated store; availability kept apart from access
  planner.yaml         # module planner: what the on-device plan/workspace holds and exports
  # ── cross-cutting ──
  safety.yaml          # REQUIRED: profile declarations (SAFETY.md)
  scenarios.yaml       # REQUIRED: persona walkthroughs = acceptance (§5)
  upkeep.yaml          # REQUIRED: re-check intervals, harvests, sweeps (SUSTAIN.md)
  changes.yaml         # REQUIRED once a pack has shipped: change ledger
  ui-strings.yaml      # builder-authored interface copy (reviewable; ACTION-SPEC §5)
  app-requirements.md  # workbench/planner: the app's own normative UI requirements (frozen from source/)
  app-methods.md       # workbench: the normative analysis methods (frozen from source/)
  todo.yaml            # gaps; nothing in it is rendered as fact
```

## 2. manifest.yaml

```yaml
slug: sdoh-loops                    # kebab-case; repo name and storage key
title: "…"
short_title: "SDOH Loops"           # ≤ 3 words, header wordmark
kind: workbench                     # navigator | planner | workbench   (§2.1)
modules: [situations, links, planner]   # action-layer modules switched on (§3)
safety_profile: health              # general | health | crisis-adjacent   (SAFETY.md)
question: >                         # the question behind the app, in Daniel's words
  …
purpose: tool                       # tool | orientation | teaching
as_of: 2026-10-23                   # the date the research closed; shown in the app
authors: ["Actualizer (commissioned research)"]
venue: "Commissioned research — not peer reviewed"
evidence:
  body: records                     # review | records — records = no review.md; the cited prose lives in record fields and the 101s
delivery: local                     # local | pages | private
storage: device                     # device — the only value in v0.1 (SAFETY H2)
github_account: feelingsarereal     # stamped per app (Daniel decides); also in the app hub
builder: { name: "Actualizer", version: "0.1", date: "2026-10-23" }
permissions:
  text: "builder-authored; third-party text only as verbatim definitions with source, or quotations ≤ 25 words"
  figures: "none reproduced"
palette: { … }                      # optional categorical hues for the app's own categories
concept_self_checks: false          # as CONTENT-PACK 0.10
```

Rules: `kind`, `modules`, `safety_profile`, `as_of`, `storage` and `github_account` are required. Every module in `modules` must have its file, and no module file may exist without being listed. `venue` must make the not-peer-reviewed status unmissable.

### 2.1 App kinds

| kind | The person… | Typical modules | Example |
|---|---|---|---|
| `navigator` | moves through stages and decisions towards a service or an outcome | `pathway`, `resources`, `planner` | HFY Navigator; Token for Granted's pathfinder |
| `planner` | assembles a dated plan from graded actions | `pathway`, `planner` | TopTechHR action plan; HFY Compass |
| `workbench` | models a situation and interrogates the model | `situations`, `links`, `planner` | SDOH Loop Mapper (the pilot) |

The kind sets the app's main surface (ACTION-SPEC §3). It never changes the evidence rules.

## 3. Action layer

### 3.1 audience.yaml — required in every pack

The audience comes first. Intake fills this file before any research is aimed (ACTUALIZER-WORKFLOW U0).

```yaml
personas:
  - id: p-navigator
    label: "Community health worker mapping a client's situation"
    acts_for: other               # self | other | group  — a caregiver or worker acting for someone else is `other`
    situation: "…"                # in what situation they arrive
    deciding: "…"                 # what they are deciding
    constraints:
      reading_level: grade-9      # grade-6 | grade-9 | grade-12 | professional
      device: [laptop, tablet]    # phone | tablet | laptop
      stress: moderate            # low | moderate | high (crisis-adjacent apps assume high)
      languages: [en]
      accessibility: [keyboard-only, screen-reader]
      time: "15–30 min"
    jobs:                         # what they need to get done, in their words
      - "Show my supervisor how the client's housing and job problems feed each other"
constraints_global:               # apply to every persona
  min_target: 375px
```

Rules: at least one persona. Every persona has `acts_for`, `constraints.reading_level` and at least one job. A persona with `acts_for: other` makes SAFETY's de-identification rule (H3) apply.

### 3.2 situations.yaml — module `situations`

The coded vocabulary of circumstances a person can be in. Codes come from an external classification when one exists; the pack never invents a code.

```yaml
scheme: { id: icd11-mms, name: "ICD-11 MMS", release: "2026-01", source: "…", verified_on: 2026-10-23, interim_source: "…" }
groups:                            # blocks / families, in the scheme's own order
  - { id: QD50-QD5Z, title: "Problems associated with finances", tier: structural }
items:
  - code: QD71.0
    title: "Homelessness"           # verbatim from the scheme
    group: QD70-QD7Z
    parent: QD71
    definition: null                # verbatim scheme text or null — never written by the builder
    inclusions: []
    exclusions: []
    index_terms: []
    crosswalk: { icd10cm: [Z59], hp2030: [econ, nbe] }
    uri: "http://id.who.int/icd/entity/1325772378"
    source_url: "…"
    verified_on: 2026-10-23
```

Rules: codes are unique. `definition`, `title`, `inclusions` and `exclusions` are verbatim from the scheme or null, and the app shows null as "no definition in ICD-11" plus the link, never as a builder paraphrase. Every item names a `group` that exists. A crosswalk marked `proposed: true` renders with a "proposed mapping" chip.

### 3.3 links.yaml — module `links`

Evidence-graded relations between situations. This is the action layer's "what tends to come with what". For a workbench the links feed suggestions; for a navigator they explain why a stage matters.

```yaml
grades:
  S: "Systematic review, meta-analysis or large cohort"
  M: "Single strong study or field experiment"
  F: "Framework or conceptual source"
links:
  - id: L02
    from: QD50-QD5Z                 # a group or an item code
    to: QD71
    polarity: "+"                   # + | −   (problem framing: more of A ⇒ more of B)
    mechanism: "Low income raises rent burden and eviction risk … [12]"   # cited prose
    grade: M
    refs: [12]
    suggest: [QD71.1, QD71.0]       # items pre-offered when the user follows this link
    counter: false                  # true = a protective/balancing suggestion
```

Rules: `from` and `to` resolve; every `refs` number resolves to a `verified: true` reference; `mechanism` carries `[n]`; `suggest` codes are inside `to`. A link whose evidence is not yet verified is moved to `withheld_links` (same shape, plus `withheld_because`): the app does not offer it, and `/methods` lists it. The validator does not check withheld links.

### 3.4 pathway.yaml — module `pathway`

One shape covers Token for Granted's pathfinder and gates, TopTechHR's moments, actions and plan, and HFY's resolution steps.

```yaml
stages:      [{ id, title, order, describes }]
decisions:   [{ id, stage, prompt, type: single|multi, options: [{ tag, label }] }]
actions:
  - id: a-…
    stage: …
    plain_name: "…"
    what: "… [n]"                   # cited
    evidence: { grade: S|M|F|practice, refs: [n] }
    fit: { personas: [p-…], tags: [...] }     # who it is for, by decision tags
    does_not_do: "… [n]"            # the honest limit (TopTechHR pattern)
    gates: [g-…]
gates:                              # registrations, eligibility, compliance, AND access barriers
  - id: g-…
    kind: requirement | barrier
    barrier: cost | insurance | distance | wait | transport | language | eligibility | hours | other
    what: "… [n]"
    applies_when: "… [n]"
    steps: ["… [n]"]
    time: "… [n]"
    cost: "… [n]"
    verified_on: 2026-10-23
outputs:     [{ id, title, from: [action ids], format: plan|letter|checklist|map }]
rule: >                             # the deterministic ranking/matching rule, stated in words; no model decides
  …
```

### 3.5 resources.yaml — module `resources`

```yaml
enabled: false                      # a pack may ship the store switched off (HFY Compass)
resources:
  - id: r-…
    name: "…"
    kind: service                   # service | program | line | org
    source: "…"
    verified_on: 2026-10-23
    recheck_days: 90
    availability: { area: "…", exists: true }            # it exists within reach
    access:                                              # whether THIS person can obtain it
      cost: "…"
      insurance: []
      eligibility: "…"
      hours: "…"
      languages: []
      transport: "…"
      wait: "…"
```

Rule: availability and access are separate keys and are never merged in the app. A resource past `verified_on + recheck_days` renders as stale (SUSTAIN).

### 3.6 planner.yaml — module `planner`

What the person builds and keeps **on their own device** (SAFETY H2): a plan, a map or both.

```yaml
holds: map                          # plan | map | both
schema_version: 1                   # of the exported file; bump when its shape changes
export: [json, csv-edges, png, svg, md-report]
import: [json, csv-edges]
fields: { … }                       # the per-app record shape (e.g. node/edge fields for a map)
templates: []                       # optional starter plans/maps; each a scenario id
```

## 4. Evidence layer (inherited)

Everything in CONTENT-PACK 0.10.2 for `mode: topic` applies, with these deltas:

- `review.md` is optional (`manifest.evidence.body: records`). When it is absent, **record prose obeys the topic-mode citation rule**: any record field or concept block of 25 words or more with no `[n]` and no `<!-- framing -->` fails validation. This is the extension-file rule from v0.10.1–2.
- references keep `tier`, `year`, `summary`, `why_it_mattered` (seminal), `role_here` and `verified`, and add:
  - `abstract`: verbatim from OpenAlex (`abstract_inverted_index`) or the publisher, or null. Never typed.
  - `harvested_on`, and `openalex` (the work id).
  - `used_by`: the record ids that cite it (situations, links, pathway, concepts), filled by the validator.
- The Research mechanics from MI still apply: sub-agents run sequentially, wait 4 s between fetches, and abstracts come from OpenAlex.

## 5. scenarios.yaml — required: acceptance by walkthrough

```yaml
- id: w1
  persona: p-navigator
  title: "Map Ms. R's housing–work loop"
  starts_with: empty | template:<id>
  steps:
    - do: "Add a node, code QD71.1, describe the leaking flat and the rent arrears"
      expect: "The code pop-out shows the ICD-11 title, the 'no WHO definition' state and the WHO link"
    - …
  must_not: ["any text that diagnoses", "any network request after load"]
```

Rules: at least one scenario per persona; every `expect` must be observable on screen; `must_not` lists come from the safety profile. Claude Code turns each scenario into a Playwright test (KICKOFF §5), and Daniel walks the same scenarios by hand at review.

## 6. Definition of done (Cowork side)

- [ ] Manifest complete; `modules` match the files present; `as_of` set.
- [ ] audience.yaml: every persona has `acts_for`, reading level and jobs.
- [ ] Every verbatim scheme field is sourced, with `verified_on`; any interim source is named in `scheme.interim_source` and on `/about`.
- [ ] Every link and action cites only `verified: true` references; every reference has its abstract or a todo entry.
- [ ] Record prose and the 101s pass the citation-coverage rule.
- [ ] safety.yaml declares the profile's items (SAFETY §4); upkeep.yaml covers every fact class (SUSTAIN §2).
- [ ] scenarios.yaml has at least one walkthrough per persona, with `must_not` from the profile.
- [ ] `python3 tools/validate_pack.py apps/<slug>/content-pack` → 0 errors.

## History
- v0.1 (2026-10-23): first draft, forked from CONTENT-PACK 0.10.2 after Daniel ratified A0.1. Adds app `kind`, `modules`, the action layer (audience · situations · links · pathway · resources · planner), `evidence.body: records`, verbatim harvested abstracts, the required safety, scenarios and upkeep blocks, and the change ledger. Pilot: SDOH Loop Mapper.
