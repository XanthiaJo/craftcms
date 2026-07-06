const { expect, test } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const { buildPostsLayoutFixture } = require('../support/posts-layout-fixture');

const rootDir = path.resolve(__dirname, '..', '..', '..');
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
    const cards = page.locator('.panel');
    await expect(cards).toHaveCount(2);

    const firstCard = cards.first();
    await expect(firstCard.locator('.thumb')).toBeVisible();
    await expect(firstCard.locator('h3 a')).toHaveText('A long title that should wrap onto two lines and stop there rather than growing forever');
    await expect(firstCard.locator('.chip')).toHaveText(['Crochet', 'Pattern/File', 'Wearables']);
    await expect(firstCard.locator('.panel-date')).toHaveText('November 2023');

    const secondCard = cards.nth(1);
    await expect(secondCard.locator('.thumb')).toBeVisible();
    await expect(secondCard.locator('h3 a')).toHaveText('Short title');
    await expect(secondCard.locator('.chip').nth(0)).toHaveText('3D Print');
    await expect(secondCard.locator('.chip').nth(1)).toHaveText('Accessories');
    await expect(secondCard.locator('.panel-date')).toHaveText('October 2023');
  });

  test('keeps the archive typography and color tokens applied', async ({ page }) => {
    const firstHeading = page.locator('.panel').first().locator('h3');
    const firstThumb = page.locator('.panel').first().locator('.thumb');
    const chips = page.locator('.panel').first().locator('.chip');
    const firstTypeChip = chips.nth(0);
    const firstDesignChip = chips.nth(1);
    const firstCategoryChip = chips.nth(2);
    const firstDate = page.locator('.panel').first().locator('.panel-date');

    await expect(firstHeading).toHaveCSS('font-family', /Open Sans/);
    await expect(firstHeading).toHaveCSS('-webkit-line-clamp', '2');
    await expect(firstThumb).toHaveCSS('object-fit', 'cover');
    await expect(firstThumb).toHaveCSS('aspect-ratio', '4 / 3');
    await expect(firstTypeChip).toHaveCSS('background-color', 'rgb(246, 230, 226)');
    await expect(firstDesignChip).toHaveCSS('background-color', 'rgb(243, 239, 230)');
    await expect(firstCategoryChip).toHaveCSS('background-color', 'rgb(231, 238, 226)');
    await expect(firstDate).toHaveCSS('color', 'rgb(138, 138, 138)');
    await expect(firstDate).toHaveCSS('font-size', '12px');
  });

  test('aligns the card dates at the bottom of the content block', async ({ page }) => {
    const cardBoxes = await page.locator('.panel').evaluateAll((cards) =>
      cards.map((card) => {
        const date = card.querySelector('.panel-date');
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
