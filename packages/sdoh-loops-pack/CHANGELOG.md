# Changelog — @feelingsarereal/sdoh-loops-pack

The SDOH Loops content pack as a versioned asset ([Semantic Versioning](https://semver.org/)). It is built from
`content-pack/` by `npm run build:content`; the content's own ledger is `content-pack/changes.yaml`. Each release
records the SHA-256 that `pin.json` carries, and `npm test` fails when the built data no longer matches the current
version's entry — so any change to the pack's data needs a new version here first.

- **Major:** a field is removed or renamed, or a meaning changes (a consumer's code or maps could break).
- **Minor:** codes, links, references, terms or strings are added; nothing a consumer reads is taken away.
- **Patch:** wording, corrections, re-verification dates.

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
