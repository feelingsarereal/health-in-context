# @feelingsarereal/sdoh-loops-pack

The SDOH Loops content pack as a versioned asset (K13): the ICD-11 codes, the evidence-graded links, the references
with their abstracts, the glossary, the primers, the interface strings and the pack manifest, as built JSON.
`@feelingsarereal/sdoh-loops-core` reads it; a consumer pins the version it wants next to the core.

Do not edit `data/` by hand. The source is `content-pack/` at this repo's root (Cowork's pack), and
`npm run build:content` writes `data/*.json` and `pin.json`. `pin.json` holds the pack slug, this package's version, the
pack's `as_of` and a SHA-256 over `data/*.json`. A consumer hands it to `<SdohMap pack>`, which refuses to open a map
when the bundle resolved a different pack.

To release new pack data: bump `version` here (see [CHANGELOG.md](CHANGELOG.md) for which part to bump), bump the
core's exact `peerDependencies` pin and the app's dependency to match, run `npm run build:content`, and record the new
`sha256` from `pin.json` in the CHANGELOG. `npm test` checks all of this.
