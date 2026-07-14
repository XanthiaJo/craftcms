const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  fullyParallel: false,
  reporter: [
    ['list'],
  ],
  use: {
    headless: false,
    screenshot: 'only-on-failure',
    // Open Chromium on the second 2K monitor (assumed to the right of the
    // primary), top-left corner, modest size so it stays out of the way.
    // Adjust --window-position if your second monitor is on the left
    // (use a negative x) or below.
    launchOptions: {
      args: [
        '--window-position=2570,50',
        '--window-size=1280,720',
      ],
    },
  },
  projects: [
    // Craft CMS E2E tests (self-contained fixtures via page.setContent)
    {
      name: 'craftcms',
      testDir: './CraftCms.Tests/e2e',
      outputDir: './CraftCms.Tests/test-results',
      use: {
        browserName: 'chromium',
        trace: 'retain-on-failure',
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-position=2570,50',
            '--window-size=1280,720',
          ],
        },
      },
    },
  ],
});
