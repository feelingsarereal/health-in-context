/**
 * G2 (no runtime content fetches) and H2 (no personal data leaves the device): type a sentinel string into every
 * text field the app has, use every feature, and assert the sentinel appears in no request and nothing is requested
 * from another origin.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { addEdge, addNode, dismissFirstRun, newMap, offOrigin, panel, recordRequests, selectNodeByName, typeRich } from '../helpers';

const SENTINEL = 'ZQX-SENTINEL-7731';

test('G2/H2: a typed sentinel never appears in any request; no off-origin requests', async ({ page, baseURL }) => {
  const reqs = recordRequests(page);
  await page.goto('/');
  await dismissFirstRun(page);
  for (const r of ['/evidence', '/references', '/glossary', '/concepts', '/concepts/reading-clds', '/help', '/methods', '/about']) await page.goto(r);

  await newMap(page, `Map ${SENTINEL}`, `S ${SENTINEL}`);
  await addNode(page, { code: 'QD71.1', search: 'inadequate housing', label: `L ${SENTINEL}`, circumstance: `C ${SENTINEL}` });
  await addNode(page, { code: 'QD80', search: 'unemployment', circumstance: `C2 ${SENTINEL}` });
  await addNode(page, { status: 'other', type: 'policy', label: `O ${SENTINEL}` });
  await addEdge(page, `L ${SENTINEL}`, 'Problem associated with unemployment', { description: `D ${SENTINEL}` });
  await addEdge(page, 'Problem associated with unemployment', `L ${SENTINEL}`, { polarity: '−', weight: -0.25, override: `R ${SENTINEL}` });
  // node notes, map notes, canvas note, loop rename
  const insp = page.getByTestId('inspector');
  await selectNodeByName(page, `L ${SENTINEL}`);
  await panel(page, 'inspect');
  await typeRich(page, insp, 'Notes', `N ${SENTINEL}`);
  await page.getByRole('button', { name: 'Add a canvas note' }).click();
  await typeRich(page, page.getByTestId('node-dialog'), 'Canvas note', `Note ${SENTINEL}`);
  await page.getByTestId('node-dialog').getByTestId('node-submit').click();
  await panel(page, 'map');
  await typeRich(page, page.getByTestId('map-panel'), 'Map notes', `MN ${SENTINEL}`);
  await panel(page, 'loops');
  await page.getByTestId('loop-item').first().getByRole('button', { name: 'Rename' }).click();
  await page.getByLabel('Loop name').fill(`Loop ${SENTINEL}`);
  await page.getByRole('button', { name: 'Save' }).click();
  // every analysis and layout
  await page.getByTestId('loop-pick').first().click();
  for (const p of ['links', 'paths', 'leverage', 'pulse', 'tocode', 'clusters', 'legend']) await panel(page, p);
  await panel(page, 'paths');
  await page.getByTestId('paths-find').click();
  await panel(page, 'pulse');
  await page.getByRole('button', { name: 'Run pulse' }).click();
  await panel(page, 'clusters');
  await page.getByLabel('Show clusters on the canvas').check();
  await page.getByTestId('arrange').click();
  await page.getByRole('combobox', { name: 'Layout' }).selectOption('elk-stress');
  await page.getByTestId('arrange').click();
  await page.waitForTimeout(800);
  await selectNodeByName(page, `L ${SENTINEL}`);
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await page.keyboard.press('a');
  await page.getByTestId('second-degree-toggle').click();
  await page.keyboard.press('Escape');
  // exports and import
  await panel(page, 'map');
  for (const id of ['export-json', 'export-csv', 'export-md', 'export-png', 'export-svg']) {
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId(id).click()]);
    const p = test.info().outputPath(d.suggestedFilename());
    await d.saveAs(p);
    if (id === 'export-json') {
      expect(fs.readFileSync(p, 'utf8')).toContain(SENTINEL); // the export is the one way out, and it is user-initiated
      await page.getByTestId('import-file').setInputFiles(p);
      await expect(page.getByTestId('map-name')).toContainText('(imported)');
      await panel(page, 'map');
    }
  }
  await page.getByTestId('switch-view').click();
  await expect(page.getByTestId('list-view')).toBeVisible();
  await page.reload();

  expect(reqs.length).toBeGreaterThan(0);
  const leaks = reqs.filter((r) => decodeURIComponent(r.url).includes(SENTINEL) || (r.body ?? '').includes(SENTINEL));
  expect(leaks).toEqual([]);
  expect(offOrigin(reqs, baseURL!)).toEqual([]);
  expect(reqs.filter((r) => r.method !== 'GET')).toEqual([]);
  // no service worker, no beacons
  expect(await page.evaluate(() => navigator.serviceWorker?.controller ?? null)).toBeNull();
});
