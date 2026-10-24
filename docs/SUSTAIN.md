---
type: spec
project: actualizer
version: 0.1
status: ratified-set (A0.1, 2026-10-23) · first draft
---

# SUSTAIN — keeping an app true

**Version 0.1 · 2026-10-23.** New. An Actualizer app is not finished when it ships: its facts age. Upkeep is a phase (ACTUALIZER-WORKFLOW U8) with its own files, report and schedule.

## 1. The freshness model

Every fact the app renders belongs to a **fact class**, and every class has a re-check interval. A fact's age is measured from its `verified_on` (or `harvested_on`). A fact past its interval is **stale**: it still renders, with a quiet "checked <date>" chip, and is listed on `/methods`.

## 2. upkeep.yaml

```yaml
classes:
  - { id: scheme,     what: "Classification codes and verbatim definitions (e.g. ICD-11 MMS)", recheck_days: 365, how: "compare against the scheme's new release" }
  - { id: reference,  what: "DOI metadata and abstracts",                               recheck_days: 365, how: "tools/harvest_openalex.py" }
  - { id: link,       what: "Evidence-graded links and actions",                        recheck_days: 730, how: "re-sweep for new systematic reviews" }
  - { id: resource,   what: "Services, programmes, lines",                              recheck_days: 90,  how: "re-read the source page" }
  - { id: help,       what: "Help and crisis entries",                                  recheck_days: 90,  how: "re-read the source page" }   # crisis: 30
  - { id: web-source, what: "Framework pages (WHO, ODPHP, CMS)",                        recheck_days: 365, how: "re-read; record changes" }
harvests:                         # public feeds that can be pulled mechanically
  - { id: openalex, script: tools/harvest_openalex.py, writes: source/literature.json }
sweeps:
  - { id: annual, every_days: 365, scope: "new SR/MA on each link pair; scheme release notes" }
```

The validator checks that every rendered record names a class, either directly or through its file, and has a date.

## 3. changes.yaml: the ledger

Every change to a shipped pack is logged with `date`, `what`, `why`, `records` (the ids touched), `source` and `by`. The app's `/methods` shows the last ten entries. The ledger is how a reader learns that "QD71.1's definition changed in ICD-11 2027-01" without diffing YAML.

## 4. The staleness report

`python3 tools/validate_pack.py <pack> --staleness [--as-of YYYY-MM-DD]` lists every stale fact, by class, with its age. The Cowork project runs it at every sweep and before any re-kickoff, and the build writes the same list into `provenance.json` for `/methods`.

## 5. Scheduled re-sweeps

At U8 the Cowork project creates a scheduled task (not a cron job inside a session) that runs the staleness report and opens a backlog item when anything is stale. The schedule comes from `upkeep.yaml → sweeps`.

## History
- v0.1 (2026-10-23): first draft after A0.1. Fact classes and intervals, `upkeep.yaml`, the change ledger, the staleness report, scheduled re-sweeps.
