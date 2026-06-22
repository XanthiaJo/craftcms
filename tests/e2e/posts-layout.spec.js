const { expect, test } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const { buildPostsLayoutFixture } = require('../support/posts-layout-fixture');

const rootDir = path.resolve(__dirname, '..', '..');
const siteCssPath = path.join(rootDir, 'web', 'css', 'site.css');
const siteCss = fs.readFileSync(siteCssPath, 'utf8');

async function loadFixture(page) {
  await page.setViewportSize({ width: 1280, height: 1080 });
  await page.setContent(buildPostsLayoutFixture());
  await page.addStyleTag({ content: siteCss });
}

test.describe('posts archive layout', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixture(page);
  });

  test('renders the archive cards with featured images, titles, categories, and dates', async ({ page }) => {
    const cards = page.locator('.card');
    await expect(cards).toHaveCount(2);

    const firstCard = cards.first();
    await expect(firstCard.locator('.thumb')).toBeVisible();
    await expect(firstCard.locator('h3 a')).toHaveText('A long title that should wrap onto two lines and stop there rather than growing forever');
    await expect(firstCard.locator('.subtitle')).toHaveText('Wearables');
    await expect(firstCard.locator('.card-date')).toHaveText('November 2023');

    const secondCard = cards.nth(1);
    await expect(secondCard.locator('.thumb')).toBeVisible();
    await expect(secondCard.locator('h3 a')).toHaveText('Short title');
    await expect(secondCard.locator('.subtitle')).toHaveText('Accessories');
    await expect(secondCard.locator('.card-date')).toHaveText('October 2023');
  });

  test('keeps the archive typography and color tokens applied', async ({ page }) => {
    const firstHeading = page.locator('.card').first().locator('h3');
    const firstThumb = page.locator('.card').first().locator('.thumb');
    const firstTypeChip = page.locator('.card').first().locator('.card-type-chip');
    const firstDate = page.locator('.card').first().locator('.card-date');
    const firstSubtitle = page.locator('.card').first().locator('.subtitle');

    await expect(firstHeading).toHaveCSS('font-family', /Open Sans/);
    await expect(firstHeading).toHaveCSS('-webkit-line-clamp', '2');
    await expect(firstThumb).toHaveCSS('object-fit', 'cover');
    await expect(firstThumb).toHaveCSS('aspect-ratio', '4 / 3');
    await expect(firstTypeChip).toHaveCSS('background-color', 'rgb(247, 221, 216)');
    await expect(firstDate).toHaveCSS('color', 'rgb(138, 138, 138)');
    await expect(firstDate).toHaveCSS('font-size', '12px');
    await expect(firstSubtitle).toHaveCSS('text-transform', 'uppercase');
    await expect(firstSubtitle).toHaveCSS('letter-spacing', '1px');
  });

  test('aligns the card dates at the bottom of the content block', async ({ page }) => {
    const cardBoxes = await page.locator('.card').evaluateAll((cards) =>
      cards.map((card) => {
        const date = card.querySelector('.card-date');
        const heading = card.querySelector('h3');
        const cardRect = card.getBoundingClientRect();
        const dateRect = date.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        const headingStyle = getComputedStyle(heading);

        return {
          cardBottomGap: cardRect.bottom - dateRect.bottom,
          dateTop: dateRect.top,
          headingHeight: headingRect.height,
          lineHeight: parseFloat(headingStyle.lineHeight),
        };
      }),
    );

    expect(cardBoxes).toHaveLength(2);
    expect(Math.abs(cardBoxes[0].dateTop - cardBoxes[1].dateTop)).toBeLessThan(8);
    expect(cardBoxes[0].cardBottomGap).toBeGreaterThanOrEqual(0);
    expect(cardBoxes[1].cardBottomGap).toBeGreaterThanOrEqual(0);
    expect(cardBoxes[0].headingHeight).toBeGreaterThan(cardBoxes[0].lineHeight);
    expect(cardBoxes[0].headingHeight).toBeLessThanOrEqual(cardBoxes[0].lineHeight * 2.3);
  });
});
