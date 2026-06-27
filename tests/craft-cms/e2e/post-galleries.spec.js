const { expect, test } = require('@playwright/test');

const BASE = 'https://craftcms.ddev.site';

test.describe('post gallery images', () => {
  test('skeleton-lamp gallery has the expected number of images', async ({ page }) => {
    await page.goto(`${BASE}/posts/skeleton-lamp`);

    const gallery = page.locator('.gallery[aria-label="Post image gallery"]');
    await expect(gallery).toBeVisible();

    const galleryLinks = gallery.locator('a');
    await expect(galleryLinks).toHaveCount(10);
  });

  test('gallery images load without 404 errors', async ({ page }) => {
    const brokenImages = [];

    page.on('response', (response) => {
      if (response.url().includes('/uploads/posts/') && response.status() === 404) {
        brokenImages.push(response.url());
      }
    });

    await page.goto(`${BASE}/posts/skeleton-lamp`);
    await expect(page.locator('.gallery img').first()).toBeVisible();

    expect(brokenImages, 'no gallery images should return 404').toEqual([]);
  });

  test('gallery image src URLs point to the correct uploads path', async ({ page }) => {
    await page.goto(`${BASE}/posts/skeleton-lamp`);

    const srcs = await page.locator('.gallery img').evaluateAll((imgs) =>
      imgs.map((img) => img.getAttribute('src')),
    );

    for (const src of srcs) {
      expect(src).toMatch(/\/uploads\/posts\/\d+\/.+\.(jpg|jpeg|png|gif|webp)$/i);
    }
  });

  test('gallery includes the featured image as the first image', async ({ page }) => {
    await page.goto(`${BASE}/posts/skeleton-lamp`);

    const featuredSrc = await page.locator('img.thumb').first().getAttribute('src');
    const firstGallerySrc = await page.locator('.gallery img').first().getAttribute('src');

    expect(firstGallerySrc).toBe(featuredSrc);
  });
});

test.describe('post inline images (mens boxers tutorial)', () => {
  test('boxers page loads and has inline images in the body', async ({ page }) => {
    await page.goto(`${BASE}/posts/mens-boxers-and-custom-sheath-hack`);

    const bodyImages = page.locator('.panel img:not(.thumb)');
    const count = await bodyImages.count();
    expect(count, 'should have inline body images').toBeGreaterThan(0);
  });

  test('boxers inline images load without 404 errors', async ({ page }) => {
    const brokenImages = [];

    page.on('response', (response) => {
      if (response.url().includes('/uploads/posts/') && response.status() === 404) {
        brokenImages.push(response.url());
      }
    });

    await page.goto(`${BASE}/posts/mens-boxers-and-custom-sheath-hack`);
    await expect(page.locator('.panel img').first()).toBeVisible();

    expect(brokenImages, 'no inline images should return 404').toEqual([]);
  });
});
