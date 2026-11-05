# The manual's screenshots

`../USER-MANUAL.md` uses the screenshots in `../img/` and the example map `../household-f.sdohmap.json`. All three
come from these scripts, run against the public Pages build (crosswalk off, prototype banner on), served under
`/sdoh-loops/` as on GitHub Pages. Run them from the app folder:

```bash
npm run build:pages
npx playwright test --config docs/manual/tools/playwright.manual.config.ts
docs/manual/tools/to-webp.sh
```

- `01-build.shots.ts` builds Household F through the interface, step by step, and saves `household-f.sdohmap.json`
  with the manual's layout (`example.ts`).
- `02-map.shots.ts`, `03-notebook.shots.ts` and `04-pages.shots.ts` open that file and photograph the map screen,
  the notebook and the other pages.
- `lib.ts` also writes an inventory of every visible control for each shot (to `test-results/manual-inventory/`, or
  `SDOH_MANUAL_INV`). It was used to check that the manual names every button, link and toggle.

Household F is fictional. Its contact note contains a made-up name after "Ms." and a 555 phone number, only so the
identifier check has something to flag.
