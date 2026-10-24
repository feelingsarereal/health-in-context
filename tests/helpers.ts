import { expect, type Page, type Request } from '@playwright/test';

/** SAFETY G2/H2 request recorder: every request after load, with its body. */
export function recordRequests(page: Page) {
  const reqs: { url: string; method: string; body: string | null; type: string }[] = [];
  page.on('request', (r: Request) => reqs.push({ url: r.url(), method: r.method(), body: r.postData(), type: r.resourceType() }));
  return reqs;
}
export function offOrigin(reqs: { url: string }[], base: string) {
  const origin = new URL(base).origin;
  return reqs.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
}

export async function dismissFirstRun(page: Page) {
  await page.evaluate(() => localStorage.setItem('sdoh-loops:first-run', 'ok'));
}

export async function newMap(page: Page, name: string, subject = '') {
  await page.goto('/maps');
  await page.getByTestId('new-map-name').fill(name);
  if (subject) await page.getByTestId('new-map-subject').fill(subject);
  await page.getByTestId('create-map').click();
  await expect(page.getByTestId('map-name')).toHaveText(name);
}

export async function typeRich(page: Page, dialogOrScope: ReturnType<Page['locator']>, label: string, text: string) {
  const box = dialogOrScope.getByRole('textbox', { name: label, exact: true });
  await box.click();
  await page.keyboard.type(text);
}

export interface NodeSpec {
  search?: string;
  code?: string;
  status?: 'sdoh' | 'other' | 'undetermined';
  type?: string;
  label?: string;
  circumstance?: string;
}
/** Fill the open node dialog (the add dialog, or one opened from the association menu). */
export async function fillNodeDialog(page: Page, n: NodeSpec) {
  const d = page.getByTestId('node-dialog');
  await expect(d).toBeVisible();
  if (n.status && n.status !== 'sdoh') await d.getByTestId(`status-${n.status}`).check({ force: true });
  if (n.code) {
    const sug = d.locator(`[data-suggest="${n.code}"]`);
    if (await sug.count()) await sug.click();
    else {
      await d.getByTestId('code-search').fill(n.search ?? n.code);
      await d.locator(`[data-code="${n.code}"]`).first().click();
    }
    await expect(d.getByTestId('chosen-code')).toContainText(n.code);
  }
  if (n.type) await d.getByTestId('other-type').selectOption(n.type);
  if (n.label) await typeRich(page, d, 'Short label (optional)', n.label);
  if (n.circumstance) await typeRich(page, d, 'Describe the circumstance', n.circumstance);
  await d.getByTestId('node-submit').click();
  await expect(d).toBeHidden();
}
export async function addNode(page: Page, n: NodeSpec) {
  await page.getByTestId('add-node').click();
  await fillNodeDialog(page, n);
}

export interface EdgeOpts {
  polarity?: '+' | '−';
  weight?: number;
  description?: string;
  /** UI-18: the override reason, when the link is not backed by evidence */
  override?: string;
}
/** Fill the open link form (UI-17/18). */
export async function fillLinkForm(page: Page, to: string | null, opts: EdgeOpts = {}) {
  const d = page.getByTestId('edge-dialog');
  await expect(d).toBeVisible();
  if (to) {
    await d.getByTestId('link-search').fill(to);
    await d.locator('label', { has: page.getByTestId('link-target') }).filter({ hasText: to }).first().getByTestId('link-target').check();
  }
  if (opts.polarity === '−') await d.getByTestId('polarity-minus').check({ force: true });
  if (opts.weight !== undefined) {
    const w = Math.abs(opts.weight);
    const step = d.locator(`[data-weight="${w}"]`);
    if (await step.count()) await step.click();
    else await d.getByTestId('weight-free').fill(String(w));
  }
  if (opts.description) await typeRich(page, d, 'Describe how one leads to the other', opts.description);
  if (opts.override !== undefined) {
    await expect(d.getByTestId('edge-submit')).toBeDisabled();
    await d.getByTestId('override-checkbox').check();
    await typeRich(page, d, 'Why keep this link?', opts.override);
  }
  await d.getByTestId('edge-submit').click();
  await expect(d).toBeHidden();
}
export async function addEdge(page: Page, from: string, to: string, opts: EdgeOpts = {}) {
  await page.getByTestId('add-edge').click();
  await page.getByTestId('edge-dialog').getByTestId('edge-from').selectOption({ label: from });
  await fillLinkForm(page, to, opts);
}

export async function panel(page: Page, id: string) {
  await page.getByTestId(`panel-${id}`).click();
}

/** Select a node on the canvas by its outline position: arrow-key navigation from the canvas (keyboard path). */
export async function selectNodeByName(page: Page, name: string) {
  await page.getByTestId('panel-loops').click();
  const n = page.getByTestId('canvas-outline').locator('li[data-node]', { hasText: name }).first();
  const id = await n.getAttribute('data-node');
  await page.getByTestId('canvas').focus();
  for (let i = 0; i < 40; i++) {
    if ((await page.getByTestId('canvas-outline').locator(`li[data-node="${id}"]`).getAttribute('data-selected')) === 'true') return id!;
    await page.keyboard.press('ArrowRight');
  }
  throw new Error(`could not select ${name}`);
}
