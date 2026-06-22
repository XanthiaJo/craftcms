const { expect, test } = require('@playwright/test');

test.describe('change log page', () => {
  test('loads the generated changelog and exposes its sections', async ({ page }) => {
    await page.goto('http://127.0.0.1:50686/change-log');

    await expect(page).toHaveTitle(/Change Log/);
    await expect(page.locator('body')).toContainText('Build Snapshot');
    await expect(page.locator('body')).toContainText('Change Types');
    await expect(page.locator('body')).toContainText('Features');
    await expect(page.locator('body')).toContainText('Use shared site-footer partial on all pages');
    await expect(page.locator('body')).toContainText('Replace inline footer markup with include');
    await expect(page.locator('body')).not.toContainText('Twig Syntax Error');
  });
});
