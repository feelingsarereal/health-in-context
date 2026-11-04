/** K11: every reference is verified — /methods lists none as unverified, and card [52] (Richardson 1986) shows its abstract's source line. */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const refs = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../packages/sdoh-loops-pack/data/references.json'), 'utf8')) as { verified: boolean }[];

test('/methods lists no unverified references', async ({ page }) => {
  await page.goto('/methods');
  await expect(page.getByTestId('todo-list')).toBeVisible();
  await expect(page.getByTestId('todo-unverified')).toHaveCount(0);
  await expect(page.getByTestId('todo-list')).not.toContainText('not verified');
  // every reference the pack carries (64 at K11, 69 since pack 0.2.0 / SL19)
  expect(refs.every((r) => r.verified)).toBe(true);
  await expect(page.locator('main')).toContainText(`${refs.length} verified, 0 not verified`);
});

test('reference card [52] is verified, with a summary and its abstract source line', async ({ page }) => {
  await page.goto('/references');
  const card = page.locator('#ref-52');
  await expect(card).toContainText('Problems with causal');
  await expect(card).not.toContainText('not verified');
  await expect(card).toContainText('Summary:');
  await card.getByText('Abstract, verbatim').click();
  await expect(card.getByTestId('abstract-verbatim')).toContainText('The first system dynamics work did not include the use of causal-loop diagrams.');
  await expect(card).toContainText("Source: no author abstract — the editor's introduction by John D. Sterman");
  await expect(card).toContainText('harvested 2026-11-02.');
});
