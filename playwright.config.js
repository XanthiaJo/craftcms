const { defineConfig } = require('@playwright/test');

// KnitStitch E2E tests run against the live DDEV site, so DDEV must be up
// and the KnitStitch bundle must be built (`npm run build` in web/knitstitch)
// before running `npm run test:knit:e2e`.
const KNITSTITCH_BASE_URL = process.env.KNITSTITCH_BASE_URL || 'https://craftcms.ddev.site';

module.exports = defineConfig({
  outputDir: './test-results',
  fullyParallel: false,
  reporter: 'list',
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
      testDir: './tests/craft-cms/e2e',
      use: {
        browserName: 'chromium',
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
    // KnitStitch E2E tests (run against the live DDEV site)
    {
      name: 'knitstitch',
      testDir: './tests/knit-stitch/e2e',
      use: {
        baseURL: KNITSTITCH_BASE_URL,
        trace: 'on-first-retry',
        // DDEV serves over HTTPS with a self-signed cert.
        ignoreHTTPSErrors: true,
      },
    },
  ],
});
