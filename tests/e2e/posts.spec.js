// @ts-check
import { test, expect } from '@playwright/test';

const POSTS_URL = '/posts';

test.describe('Posts archive — card rendering', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(POSTS_URL);
    await page.waitForSelector('ul[aria-label="Completed project list"]');
  });

  // -------------------------------------------------------------------------
  // Images
  // -------------------------------------------------------------------------

  test('at least one card renders a thumbnail image', async ({ page }) => {
    const thumbs = page.locator('.card img.thumb');
    await expect(thumbs.first()).toBeVisible();
  });

  test('every visible thumbnail has a non-empty src', async ({ page }) => {
    const thumbs = page.locator('.card img.thumb');
    const count = await thumbs.count();
    expect(count, 'expected at least one thumbnail').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const src = await thumbs.nth(i).getAttribute('src');
      expect(src, `card ${i} thumbnail src is empty`).toBeTruthy();
    }
  });

  test('every visible thumbnail loads without a broken-image error', async ({ page }) => {
    const thumbs = page.locator('.card img.thumb');
    const count = await thumbs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const naturalWidth = await thumbs.nth(i).evaluate(
        (img) => /** @type {HTMLImageElement} */ (img).naturalWidth
      );
      expect(naturalWidth, `card ${i} thumbnail did not load (naturalWidth=0)`).toBeGreaterThan(0);
    }
  });

  test('thumbnail images link to the single-post page', async ({ page }) => {
    const thumbLinks = page.locator('.card a[aria-label]');
    const count = await thumbLinks.count();
    expect(count).toBeGreaterThan(0);
    const href = await thumbLinks.first().getAttribute('href');
    expect(href).toMatch(/\/posts\//);
  });

  // -------------------------------------------------------------------------
  // Titles
  // -------------------------------------------------------------------------

  test('every card renders a non-empty title', async ({ page }) => {
    const titles = page.locator('.card .card-title a');
    const count = await titles.count();
    expect(count, 'expected at least one card title').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = (await titles.nth(i).textContent())?.trim();
      expect(text, `card ${i} title is empty`).toBeTruthy();
    }
  });

  test('no card title reads "Untitled entry"', async ({ page }) => {
    const untitled = page.locator('.card .card-title a', { hasText: 'Untitled entry' });
    await expect(untitled).toHaveCount(0);
  });

  test('no card title reads "No posts imported yet"', async ({ page }) => {
    const fallback = page.locator('.card .card-title', { hasText: 'No posts imported yet' });
    await expect(fallback).toHaveCount(0);
  });

  test('card title links point to the post URL', async ({ page }) => {
    const titles = page.locator('.card .card-title a');
    const href = await titles.first().getAttribute('href');
    expect(href).toMatch(/\/posts\//);
  });

  // -------------------------------------------------------------------------
  // Project Type chips
  // -------------------------------------------------------------------------

  test('at least one card renders a project-type chip', async ({ page }) => {
    const chips = page.locator('.card .card-type-chip');
    await expect(chips.first()).toBeVisible();
  });

  test('every project-type chip has non-empty text', async ({ page }) => {
    const chips = page.locator('.card .card-type-chip');
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = (await chips.nth(i).textContent())?.trim();
      expect(text, `project-type chip ${i} is empty`).toBeTruthy();
    }
  });

  test('project-type chips carry a colour modifier class', async ({ page }) => {
    const chips = page.locator('.card .card-type-chip');
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const className = await chips.nth(i).getAttribute('class');
      expect(className, `project-type chip ${i} has no colour modifier`).toMatch(
        /card-type-chip--[a-z]/
      );
    }
  });

  // -------------------------------------------------------------------------
  // Design Source chips (present only on cards that have a designSource relation)
  // -------------------------------------------------------------------------

  test('design-source chips have non-empty text when present', async ({ page }) => {
    const chips = page.locator('.card [class*="card-design-source-chip"]');
    const count = await chips.count();
    if (count === 0) {
      test.skip();
      return;
    }
    for (let i = 0; i < count; i++) {
      const text = (await chips.nth(i).textContent())?.trim();
      expect(text, `design-source chip ${i} is empty`).toBeTruthy();
    }
  });

  test('design-source chips carry a colour modifier class when present', async ({ page }) => {
    const chips = page.locator('.card [class*="card-design-source-chip--"]');
    const count = await chips.count();
    if (count === 0) {
      test.skip();
      return;
    }
    for (let i = 0; i < count; i++) {
      const className = await chips.nth(i).getAttribute('class');
      expect(className).toMatch(
        /card-design-source-chip--(original|pattern|model|reference)/
      );
    }
  });

});

test.describe('Posts archive — filtering preserves rendering', () => {

  test('project-type filter keeps thumbnails visible', async ({ page }) => {
    await page.goto(POSTS_URL);
    await page.waitForSelector('ul[aria-label="Completed project list"]');

    const firstCheckbox = page.locator('input[name="projectType[]"]').first();
    const hasCheckbox = await firstCheckbox.count();
    if (!hasCheckbox) {
      test.skip();
      return;
    }

    await firstCheckbox.check();
    await page.waitForURL(/projectType/);
    await page.waitForSelector('ul[aria-label="Completed project list"]');

    const thumbs = page.locator('.card img.thumb');
    await expect(thumbs.first()).toBeVisible();
  });

  test('filtered results still render card titles', async ({ page }) => {
    await page.goto(POSTS_URL);
    await page.waitForSelector('ul[aria-label="Completed project list"]');

    const firstCheckbox = page.locator('input[name="projectType[]"]').first();
    if (!(await firstCheckbox.count())) {
      test.skip();
      return;
    }

    await firstCheckbox.check();
    await page.waitForURL(/projectType/);

    const titles = page.locator('.card .card-title a');
    const count = await titles.count();
    expect(count).toBeGreaterThan(0);
    const text = (await titles.first().textContent())?.trim();
    expect(text).toBeTruthy();
  });

  test('URL stays on /posts after filter is applied', async ({ page }) => {
    await page.goto(POSTS_URL);
    await page.waitForSelector('ul[aria-label="Completed project list"]');

    const firstCheckbox = page.locator('input[name="projectType[]"]').first();
    if (!(await firstCheckbox.count())) {
      test.skip();
      return;
    }

    await firstCheckbox.check();
    await page.waitForURL(/\/posts\?/);
    expect(page.url()).toContain('/posts?');
    expect(page.url()).not.toMatch(/\/posts\/[^?]/);
  });

});
