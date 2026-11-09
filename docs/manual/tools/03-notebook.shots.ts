/** Part 3: the notebook with Household F — notes, the identifier check, passages, links, mentions, trace, report. */
import { test, expect, type Page } from '@playwright/test';
import { tool, shot, openExample, tall, clickNode, readMode, menuItem } from './lib';

/** select `text` inside a note field (a mouse-style selection) */
async function selectText(page: Page, text: string, field = 'nb-body') {
  await page.getByTestId(field).evaluate((el, t) => {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (!n.parentElement?.closest('.sx-approx, .nb-page, .sx-chip')) nodes.push(n as Text);
    const all = nodes.map((n) => n.textContent!).join('');
    const i = all.indexOf(t);
    if (i < 0) throw new Error(`not found: ${t}`);
    const at = (off: number): [Text, number] => {
      for (const n of nodes) {
        if (off <= n.textContent!.length) return [n, off];
        off -= n.textContent!.length;
      }
      return [nodes[nodes.length - 1], nodes[nodes.length - 1].textContent!.length];
    };
    (el as HTMLElement).focus();
    const r = document.createRange();
    r.setStart(...at(i));
    r.setEnd(...at(i + t.length));
    const sel = getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
  }, text);
  await expect(page.getByTestId('nb-action-bar')).toBeVisible();
}

const NOTE =
  'Visit in week 3. Ms. Rivera says the family has slept in the car since the fire. With no shower or laundry she missed two job interviews. Food spoils without a fridge. She is worried the children are falling behind at school. Call back on 256-555-0142.';

test('part 3: the notebook', async ({ page }) => {
  await openExample(page);
  await page.keyboard.press('Escape');
  await tool(page, 'notebook-toggle');
  await expect(page.getByTestId('notebook')).toBeVisible();
  await shot(page, '50-notebook');

  await test.step('a template note', async () => {
    await page.getByTestId('nb-template').selectOption({ label: 'Intake' });
    await page.waitForTimeout(400);
    await tall(page, () => shot(page, '51-template', page.getByTestId('notebook')));
  });

  await test.step('a free note, flagged', async () => {
    await page.getByTestId('nb-new').click();
    await page.getByTestId('nb-title').fill('Visit, week 3');
    await page.getByTestId('nb-tags').fill('visit');
    await page.getByTestId('nb-tags').press('Enter');
    await page.getByTestId('nb-body').click();
    await page.keyboard.type(NOTE, { delay: 2 });
    await page.waitForTimeout(800);
    await shot(page, '52-note-flags');
    // the list of possible identifiers, opened from the header count
    await page.getByTestId('notebook').getByRole('button', { name: /possible identifier/ }).first().click();
    await expect(page.getByTestId('nb-flags')).toBeVisible();
    await shot(page, '52c-flag-list', page.getByTestId('nb-flags'));
    await page.getByTestId('notebook').getByRole('button', { name: /possible identifier/ }).first().click();
    // every export warns while flags remain
    await menuItem(page, 'export-json');
    await expect(page.getByTestId('nb-warn-count')).toBeVisible();
    await shot(page, '53-export-warning', page.getByRole('dialog'));
    await page.getByTestId('nb-warn-label').click();
    await page.waitForTimeout(600);
    await shot(page, '54-labelled');
  });

  await test.step('passages: evidence, link, comment, create, mention', async () => {
    await selectText(page, 'she missed two job interviews');
    await shot(page, '55-action-bar', { around: page.getByTestId('nb-action-bar'), pad: 8 });
    await page.getByTestId('nb-act-evidence').click();
    const ev = page.getByTestId('evidence-picker');
    await expect(ev).toBeVisible();
    await ev.getByTestId('ev-search').fill('shower');
    await page.waitForTimeout(300);
    await shot(page, '56-evidence-picker', ev);
    await ev.getByTestId('ev-edge').filter({ hasText: 'Work lost' }).first().click();

    await selectText(page, 'Food spoils without a fridge');
    await page.getByTestId('nb-act-link').click();
    const la = page.getByTestId('link-any-dialog');
    await expect(la).toBeVisible();
    await la.getByTestId('picker-search').fill('food');
    await page.waitForTimeout(300);
    await shot(page, '57-link-picker', la);
    await la.getByTestId('picker-item').first().click();

    await selectText(page, 'slept in the car since the fire');
    await page.getByTestId('nb-act-annotate').click();
    await page.getByTestId('nb-annot-text').fill('Ask how many nights a week.');
    await shot(page, '58-comment', { around: page.getByTestId('nb-annot-text'), pad: 60 });
    await page.getByTestId('nb-annot-save').click();

    await selectText(page, 'the children are falling behind at school');
    await page.getByTestId('nb-act-create').click();
    const nd = page.getByTestId('node-dialog');
    await expect(nd.getByTestId('from-suggest-panel')).toBeVisible();
    await shot(page, '59-create-from-text', nd);
    await page.keyboard.press('Escape');

    // an @ mention at the end of the note
    await page.getByTestId('nb-body').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' Next visit: check on @');
    const md = page.getByTestId('mention-dialog');
    await expect(md).toBeVisible();
    await md.getByTestId('picker-search').fill('without');
    await page.waitForTimeout(300);
    await shot(page, '60-mention', md);
    await md.getByTestId('picker-item').first().click();
    await page.waitForTimeout(400);
    await shot(page, '61-note-marked');
  });

  await test.step('suggestions', async () => {
    await page.getByTestId('nb-suggest').click();
    await expect(page.getByTestId('nb-proposal').first()).toBeVisible();
    await tall(page, () => shot(page, '62-suggestions', page.getByTestId('notebook')));
    for (let i = await page.getByTestId('nb-proposal').count(); i > 0; i--) await page.getByTestId('nb-proposal-reject').first().click();
  });

  await test.step('passages on the map, trace', async () => {
    await tool(page, 'trace-toggle');
    await selectText(page, 'she missed two job interviews');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(600);
    await shot(page, '63-trace');
    await tool(page, 'trace-toggle');
    await clickNode(page, 'No shower, laundry or kitchen');
    await readMode(page);
    await tall(page, () => shot(page, '64-read-passages', page.getByTestId('side-dock')));
  });

  await test.step('case summary', async () => {
    await page.getByTestId('nb-collapse').click().catch(() => {});
    await page.getByTestId('case-summary').scrollIntoViewIfNeeded();
    await tall(page, () => shot(page, '65-case-summary', page.getByTestId('notebook')));
  });

  await test.step('import, report, map menu', async () => {
    await page.getByTestId('nb-paste-open').click();
    await page.getByTestId('nb-paste-title').fill('Letter from the shelter');
    await page.getByTestId('nb-paste-text').fill('The household stayed at the county shelter from 3 March to 17 March. Contact: shelter office.');
    await page.getByTestId('nb-paste-go').click();
    await expect(page.getByTestId('nb-review')).toBeVisible();
    await shot(page, '66-import-review', page.getByTestId('nb-review'));
    await page.getByTestId('nb-review-label-all').click();
    if (await page.getByTestId('nb-review-save').isVisible()) await page.getByTestId('nb-review-save').click();
    if (await page.getByTestId('nb-import-done').isVisible()) await page.getByTestId('nb-import-done').click();
    await page.getByTestId('map-menu').click();
    await page.getByTestId('export-report').click();
    await expect(page.getByTestId('report-go')).toBeVisible();
    await shot(page, '68-report-dialog', page.getByRole('dialog'));
    await page.keyboard.press('Escape');
  });
});
