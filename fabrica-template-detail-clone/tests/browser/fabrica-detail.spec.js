import { test, expect } from '@playwright/test';

test('mobile opens search and pauses the preview', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile-only interaction coverage');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Search templates' }).click();
  await expect(page.getByRole('dialog', { name: 'Search templates' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Pause video' }).click();
  await expect(page.getByRole('button', { name: 'Play video' })).toBeVisible();
});

test('desktop shows source-visible navigation and detail content', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop-only layout coverage');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recommended templates' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
});
