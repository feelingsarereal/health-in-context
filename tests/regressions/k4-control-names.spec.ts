/**
 * K4 defect D4 — the override confirmation, the To-list radios, the polarity radios and the "Evidence-backed links only"
 * toggle read as "on" in the accessibility tree. axe passed, so this asks the browser itself: every checkbox and radio
 * on /map (side panel, link form, node dialog, inspector) has a real accessible name.
 */
import { test, expect, type Page } from '@playwright/test';
import { addNode, dismissFirstRun, newMap, panel, selectNodeByName } from '../helpers';

/** Every checkbox and radio in Chromium's accessibility tree, with its computed name. */
async function controlNames(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: { ignored: boolean; role?: { value: string }; name?: { value: string } }[] };
  await cdp.detach();
  return nodes.filter((n) => !n.ignored && ['checkbox', 'radio'].includes(n.role?.value ?? '')).map((n) => ({ role: n.role!.value, name: (n.name?.value ?? '').trim() }));
}
const bad = (c: { name: string }) => c.name.length < 2 || /^(on|off|true|false)$/i.test(c.name);

test('D4: every checkbox and radio on /map has a real accessible name', async ({ page }) => {
  await page.goto('/');
  await dismissFirstRun(page);
  await newMap(page, 'D4');
  await addNode(page, { code: 'QD85', search: 'burnout' });
  await addNode(page, { code: 'QD80', search: 'unemployment' });
  const seen: { where: string; role: string; name: string }[] = [];
  const scan = async (where: string) => seen.push(...(await controlNames(page)).map((c) => ({ where, ...c })));

  await scan('side panel');
  await page.getByTestId('add-edge').click(); // QD80 → QD85 has no link (K9: QD80 → QE01 is evidence now, L22): the override block shows
  await expect(page.getByTestId('override-checkbox')).toBeVisible();
  await scan('link form');
  await page.keyboard.press('Escape');
  await page.getByTestId('add-node').click();
  await scan('node dialog');
  await page.keyboard.press('Escape');
  await selectNodeByName(page, 'Problem associated with unemployment');
  await panel(page, 'inspect');
  await scan('inspector');
  for (const p of ['clusters', 'map']) {
    await panel(page, p);
    await scan(p);
  }

  const kinds = new Set(seen.map((c) => `${c.where}:${c.role}`));
  for (const k of ['side panel:checkbox', 'link form:checkbox', 'link form:radio', 'node dialog:radio']) expect(kinds, k).toContain(k);
  expect(seen.filter(bad)).toEqual([]);
  // the ones K4 named, by the names a screen reader now announces
  const names = seen.map((c) => c.name);
  expect(names).toContain('Evidence-backed links only');
  expect(names.some((n) => n.startsWith('I want this link on the map anyway'))).toBe(true);
  expect(names).toContain('Burnout · QD85'); // a To-list radio (From is the selected QD80)
});
