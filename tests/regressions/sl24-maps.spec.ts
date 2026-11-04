/**
 * SL24: My maps — "Start a map" with two equal actions, Create a blank map and Open a map file (a button, the
 * consumer fixture's exported JSON and CSV, a dropped file, a bad file's error); the bottom import card is gone.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dismissFirstRun, menuItem } from '../helpers';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXAMPLE = path.join(ROOT, 'packages/sdoh-loops-core/fixtures/consumer/collinson2024.sdohmap.json');
const NAME = JSON.parse(fs.readFileSync(EXAMPLE, 'utf8')).name as string;

async function maps(page: Page) {
  await page.goto('/');
  await dismissFirstRun(page);
  await page.goto('/maps');
  await expect(page.getByTestId('start-map')).toBeVisible();
}

test('with 10 saved maps at 1440×900, "Open a map file" sits beside Create map, in view; the bottom import card is gone; axe clean', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await maps(page);
  for (let i = 0; i < 10; i++) {
    await page.getByTestId('new-map-name').fill(`Map ${i}`);
    await page.getByTestId('create-map').click();
    await expect(page.getByTestId('map-name')).toHaveText(`Map ${i}`);
    await page.goto('/maps');
  }
  await expect(page.getByTestId('map-row')).toHaveCount(10);
  const card = page.getByTestId('start-map');
  await expect(card.getByRole('heading', { level: 2 })).toHaveText('Start a map');
  await expect(card.getByRole('heading', { level: 3 })).toHaveText(['Create a blank map', 'Open a map file']);
  const open = page.getByTestId('open-map-file');
  await expect(open).toBeInViewport();
  await expect(open).toHaveAccessibleDescription(/A map exported from SDOH Loops or an SDOH Interrogator app/);
  // side by side
  const cb = (await page.getByTestId('create-map').boundingBox())!;
  const ob = (await open.boundingBox())!;
  expect(ob.x).toBeGreaterThan(cb.x + cb.width);
  // no bare file input, no bottom card
  await expect(page.getByText(/Import a map/)).toHaveCount(0);
  await expect(page.locator('input[type="file"]:visible')).toHaveCount(0);
  const rows = (await page.getByTestId('map-list').boundingBox())!;
  expect(ob.y).toBeLessThan(rows.y);
  const res = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(res.violations.map((v) => v.id)).toEqual([]);
});

test('narrow screens stack the two actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await maps(page);
  const cb = (await page.getByTestId('create-map').boundingBox())!;
  const ob = (await page.getByTestId('open-map-file').boundingBox())!;
  expect(ob.y).toBeGreaterThan(cb.y + cb.height);
});

test('the button opens the picker from the keyboard; the fixture’s JSON and CSV each open as a map', async ({ page }) => {
  await maps(page);
  await page.getByTestId('open-map-file').focus();
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  await fc.setFiles(EXAMPLE);
  await expect(page.getByTestId('map-name')).toHaveText(`${NAME} (imported)`);
  await expect(page.getByTestId('link-counts')).toHaveText(/^9 links/);
  // its CSV edge list, exported from the map, opens too
  const [d] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'export-csv')]);
  const csv = test.info().outputPath('example-edges.csv');
  await d.saveAs(csv);
  await page.goto('/maps');
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('open-map-file').click()]);
  await fc2.setFiles(csv);
  await expect(page.getByTestId('map-name')).toHaveText('example-edges');
  await expect(page.getByTestId('link-counts')).toHaveText(/^9 links/);
});

test('a dropped file opens, with a visible drop zone while dragging; a bad file shows its error under the button', async ({ page }) => {
  await maps(page);
  const text = fs.readFileSync(EXAMPLE, 'utf8');
  const drag = async (type: 'dragenter' | 'dragover' | 'drop', name: string, body: string) =>
    page.evaluate(([t, n, b]) => {
      const dt = new DataTransfer();
      dt.items.add(new File([b], n, { type: n.endsWith('.json') ? 'application/json' : 'text/plain' }));
      window.dispatchEvent(new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, [type, name, body] as const);
  // a bad file first
  await drag('dragenter', 'bad.json', '{not json');
  await expect(page.getByTestId('drop-zone')).toBeVisible();
  await expect(page.getByTestId('drop-zone')).toHaveText('Drop a map file here to open it');
  await drag('drop', 'bad.json', '{not json');
  await expect(page.getByTestId('drop-zone')).toHaveCount(0);
  const err = page.getByTestId('open-map-error');
  await expect(err).toBeVisible();
  await expect(err).toHaveAttribute('role', 'alert');
  const eb = (await err.boundingBox())!;
  const bb = (await page.getByTestId('open-map-file').boundingBox())!;
  expect(eb.y).toBeGreaterThan(bb.y);
  // then the fixture's map
  await drag('dragenter', 'example.sdohmap.json', text);
  await drag('dragover', 'example.sdohmap.json', text);
  await drag('drop', 'example.sdohmap.json', text);
  await expect(page.getByTestId('map-name')).toHaveText(`${NAME} (imported)`);
});

test('the map’s Map menu opens files with the same wording', async ({ page }) => {
  await maps(page);
  await page.getByTestId('new-map-name').fill('Menu');
  await page.getByTestId('create-map').click();
  await page.getByTestId('map-menu').click();
  await expect(page.getByRole('menuitem').first()).toHaveText(/^Open a map file…/);
  await expect(page.getByRole('menuitem').first()).toHaveAccessibleDescription('A map exported from SDOH Loops or an SDOH Interrogator app');
});
