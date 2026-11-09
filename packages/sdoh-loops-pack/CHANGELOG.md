# Changelog — @feelingsarereal/sdoh-loops-pack

The SDOH Loops content pack as a versioned asset ([Semantic Versioning](https://semver.org/)). It is built from
`content-pack/` by `npm run build:content`; the content's own ledger is `content-pack/changes.yaml`. Each release
records the SHA-256 that `pin.json` carries, and `npm test` fails when the built data no longer matches the current
version's entry — so any change to the pack's data needs a new version here first.

- **Major:** a field is removed or renamed, or a meaning changes (a consumer's code or maps could break).
- **Minor:** codes, links, references, terms or strings are added; nothing a consumer reads is taken away.
- **Patch:** wording, corrections, re-verification dates.

## [0.4.0] — 2026-11-09

Minor by Daniel's decision, 2026-11-09: the `crosswalk` field is removed; hosts at core 0.10.0 or earlier that still read it get `undefined`, which the code card already tolerates.

SL33 (T-LIC-01, WHO's reply to request 202611431): WHO says to proceed under the existing ICD-11 licence and to
postpone any mapping to other terminologies until it publishes its mapping agreement, so the pack carries none.
Logged in `content-pack/changes.yaml`.

- sha256: `cd47f8b8e4f72a937fb2dd4f2e88355bbf9e77bd47abc0203d9c8f3e3c9e231c`
- **Removed:** `situations.items[].crosswalk` on all 114 codes that had it (both halves, their titles, sources and
  `proposed`). The proposed table is held outside the pack, for the record, under to-do `T-XWALK-02`.
- **Text:** the two pairing sentences of the `icd11-chapter24` primer are deleted, with their markers. The Z codes
  glossary entry and references [62] and [63] stay; [63] is no longer used by that primer.
- **Strings:** `codes.builder_topic` is dropped; `prototype_banner` now says codes are shown as WHO publishes them.
  `codes.who_citation` is unchanged.
- **To-dos:** `T-LIC-01` records WHO's reply; `T-XWALK-02` is new and, like `T-XWALK-01`, carries `xwalk: true`.
- **Manifest:** `permissions.text` says the pack carries no mapping between ICD-11 and any other classification.

## [0.3.0] — 2026-11-04

Minor (SL32, T-LIC-01): the pack marks what pairs ICD-11 with ICD-10-CM, so a build with the crosswalk off can leave it
out (core 0.10.0's `sdohCrosswalk` Vite plugin); adds WHO's required citation and the public prototype's banner as
strings. Nothing a consumer reads is taken away, and no code, link, reference or term changes. Logged in
`content-pack/changes.yaml`.

- sha256: `c8b6a6eff68a6436aff90c74ca788fafbe674ae8f30fb268a319d0b956ad58f8`
- **Crosswalk sources per half:** every code's `crosswalk` gains `hp2030_sources` (`[62]`, Healthy People 2030) and
  `icd10cm_sources` (`[63]`, CMS Z codes). `sources` stays `[62, 63]`.
- **Marked text:** the `icd11-chapter24` primer wraps two sentences in `<!-- xwalk -->…<!-- /xwalk -->`. They are
  "In the United States … Z55–Z65 play the same role [63]" and "The crosswalk to Healthy People 2030 domains and to
  ICD-10-CM categories is marked as a proposed mapping…". The core removes the markers at load time; core 0.9.0 and
  earlier render the body as Markdown, where the comments don't show.
- **Marked record:** to-do `T-XWALK-01` (replace the proposed crosswalk with WHO's mapping tables) gains `xwalk: true`.
- **Strings:** `codes.who_citation` holds WHO's §1.3 citation, verbatim ("… Licensed under CC BY-ND 3.0 IGO.").
  `codes.builder_topic` is "Builder topic, not from WHO". `prototype_banner` holds the banner's text, its link
  label and its dismiss label.
- **Manifest:** `delivery: pages`; `permissions.text` carries the citation's licence wording and says the crosswalk
  is left out of the public build until WHO's written agreement.

## [0.2.0] — 2026-11-04

Minor (SL19, finding F02 of the S5.2 primer fact-check; Daniel's decision "add all four"): four links and five
references are added. Nothing a consumer reads is taken away. Logged in `content-pack/changes.yaml`.

- sha256: `978c2a8a97a742fc40953c8d60e1ca82dfca38cecd283e56c5edef6b95ceafaf`
- **New links**, all from QE04 (perceived discrimination), `+`, grade S, with code-level `codes` and `suggest`. Each mechanism
  cites its references in place:
  - **L30** → QE10 Hazardous alcohol use (Gates 2025, Gilbert & Zemore 2016, Ebrahimi 2024).
  - **L31** → QE11 Hazardous drug use, and its descendants such as QE11.1 cannabis (Gates 2025, Ebrahimi 2024).
  - **L32** → QE13 Tobacco use (Ebrahimi 2024, Gates 2025). The mechanism says the adult association varies by group.
  - **L33** → QE23 Inappropriate diet or eating habits (Rodrigues 2022).
- **L14** stays withheld with an updated reason: physical activity (QE20) and QE03 → any behaviour still have no
  review-level evidence. Pascoe & Smart Richman 2009 is added to its refs.
- **New references 65–69**: `gates2025`, `ebrahimi2024`, `gilbert_zemore2016`, `rodrigues2022` and
  `pascoe_smartrichman2009`. Each has a verbatim abstract (OpenAlex or PubMed), a PMID (new optional `pmid` field),
  `verified_on: 2026-11-04` and `used_by` from the links. 69 references, all verified.
- Shipped links: 19 → 23. No existing reference is renumbered.

## [0.1.1] — 2026-11-03

Wording only (K14): Cowork's deploys of 2026-11-02 and 2026-11-03, logged in `content-pack/changes.yaml`. No codes,
links or references are added or removed.

- sha256: `dbf7b5736e72f0bca88e2c0406454da91db58e8125fcfc4b475f2cf82b774e67`
- The T-LINKS to-do reads "Links withheld after evidence review" (no reference is unverified any more).
- The primers cite the verified methods papers: Richardson 1986 and 1995 (reading-clds), Kosko 1986 and Özesmi &
  Özesmi 2004 (weights-fcm).
- Glossary and reading-clds: link polarity uses Richardson's "higher than it would otherwise have been"; reinforcing and
  balancing loops "come back pushing the same way / against itself"; the sign gives direction, not strength.
- References: Richardson 1986 and 1995, Kosko 1986 and Özesmi & Özesmi 2004 now list the primers and glossary entries
  that cite them (`used_by`).
- `content-pack/app-methods.md` (the methods spec; not in `data/`): the Homer & Hirsch sentence now says what the paper
  says, and loop dominance can shift as behaviour unfolds.

## [0.1.0] — 2026-11-03

First release as its own asset (K13). The pack as built for K11 (all references verified): 7 data files (situations,
links, references, glossary, concepts, strings, manifest).

- sha256: `76e69bb13f723525e82c758232ef2675a85b505f799f515df5410f063349940f`
- Not yet included: the Cowork wording deploys of 2026-11-02/03 (`primers-2026-11-03`, `tutorial-wording-2026-11-03`,
  the T-LINKS to-do), which ride with the next rebuild and a pack release of their own.
