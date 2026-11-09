/** SL36, SL38, SL39: the new evidence, the name, and the Little Orange Fish brand in the shell. */
import { expect, test } from '@playwright/test';

test.describe('SL38: the name', () => {
  test('title on the home page and a subpage', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveTitle('Health in Context');
    await page.goto('./references');
    await expect(page).toHaveTitle('References · Health in Context');
  });
});

for (const [w, h] of [[390, 844], [768, 1024], [1440, 900]] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`SL39: header and footer at ${w} px, ${scheme}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('./about');
      await expect(page.getByTestId('brand-mark')).toBeVisible();
      await expect(page.getByTestId('wordmark')).toHaveText('Health in Context');
      await expect(page.getByTestId('wordmark-line-2')).toHaveText('Here for You · Little Orange Fish');
      await expect(page.getByTestId('home-link')).toHaveAccessibleName('Health in Context — home');
      await expect(page.getByTestId(scheme === 'light' ? 'lof-logo-light' : 'lof-logo-dark')).toBeVisible();
      await expect(page.getByTestId(scheme === 'light' ? 'lof-logo-dark' : 'lof-logo-light')).toBeHidden();
      await expect(page.getByTestId('footer-lockup')).toHaveText('Health in Context is a Here for You resource from Little Orange Fish.');
      await expect(page.getByTestId('tagline')).toHaveText('Good health starts with a healthy mind.');
      await expect(page.getByTestId('footer-who-citation')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
}

test('SL39: the logo follows the manual theme toggle, against the OS setting', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./about');
  await expect(page.getByTestId('lof-logo-light')).toBeVisible();
  await page.getByTestId('theme-toggle').click();
  await expect(page.getByTestId('lof-logo-dark')).toBeVisible();
  await expect(page.getByTestId('lof-logo-light')).toBeHidden();
  const filter = await page.getByTestId('lof-logo-dark').evaluate((e) => getComputedStyle(e).filter);
  expect(filter).toBe('none');
});

test('SL39: type stacks; American Typewriter is named but never shipped', async ({ page }) => {
  await page.goto('./about');
  const font = (sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).fontFamily);
  expect(await font('h1')).toMatch(/^"American Typewriter", "Roboto Slab"/);
  expect(await font('body')).toMatch(/^Roboto/);
  const faces = await page.evaluate(() => [...document.fonts].map((f) => f.family.replace(/"/g, '')));
  expect(faces).not.toContain('American Typewriter');
  expect(new Set(faces)).toEqual(new Set(['Roboto', 'Roboto Slab', 'Poppins']));
});

test('SL39: favicons and the web manifest are served', async ({ request }) => {
  for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-512.png', 'og-image.png', 'brand/lof-logo.svg', 'brand/lof-logo-white.png']) {
    expect((await request.get(f)).status(), f).toBe(200);
  }
  const m = await (await request.get('site.webmanifest')).json();
  expect(m).toMatchObject({ name: 'Health in Context', theme_color: '#ff7d2f', background_color: '#ffffff' });
});

test('SL39: About opens with the lead, then the program; More holds it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./about');
  await expect(page.getByText("Health in Context maps the circumstances around a person's health, not their health itself.")).toBeVisible();
  await expect(page.getByTestId('about-program')).toHaveText("Health in Context is part of Here for You, Little Orange Fish's resource-navigation program.");
  await page.getByTestId('more-menu').click();
  await expect(page.locator('#more-nav').getByRole('link', { name: 'About' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#more-nav')).toBeHidden();
  await expect(page.getByTestId('more-menu')).toBeFocused();
});

test('SL36: L36 and L37 are withheld with reasons, and [24] is now Shafer 2022', async ({ page }) => {
  await page.goto('./methods');
  await expect(page.locator('[data-withheld="L36"]')).toContainText('Housing First did not raise the odds');
  await expect(page.locator('[data-withheld="L37"]')).toContainText('L26');
  await expect(page.getByTestId('withheld-list')).not.toContainText('[@');
  await page.goto('./references');
  await expect(page.getByText(/Shafer PR/).first()).toBeVisible();
  await expect(page.getByText(/Seligman HK/)).toHaveCount(0);
});
