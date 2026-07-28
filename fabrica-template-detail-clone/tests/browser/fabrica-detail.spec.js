import { test, expect } from '@playwright/test';

test('mobile opens search and pauses the preview', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile-only interaction coverage');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Search templates' }).click();
  await expect(page.getByRole('dialog', { name: 'Search templates' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation' }).click();

  await page.getByRole('button', { name: 'Pause video' }).click();
  await expect(page.getByRole('button', { name: 'Play video' })).toBeVisible();
  await expect(page.getByText('Overall score')).toBeVisible();

  const cookieBanner = page.getByText('We use cookies').locator('..');
  await expect(cookieBanner).toBeVisible();
  const cookieBox = await cookieBanner.boundingBox();
  expect(cookieBox.y).toBeGreaterThan(700);
});

test('desktop shows source-visible navigation and detail content', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop-only layout coverage');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fabrica' })).toBeVisible();
  await expect(page.getByText('Overall score')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'MORE LIKE THIS' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();

  const cookieBanner = page.getByText('We use cookies').locator('..');
  await expect(cookieBanner).toBeVisible();
  const cookieBox = await cookieBanner.boundingBox();
  expect(cookieBox.x).toBeGreaterThan(900);
  expect(cookieBox.y).toBeGreaterThan(600);
});
