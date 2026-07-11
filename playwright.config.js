const { defineConfig } = require('@playwright/test');

// KnitStitch E2E tests run against the live DDEV site, so DDEV must be up
// and the KnitStitch bundle must be built (`npm run build` in web/knitstitch)
// before running `npm run test:knit:e2e`.
const KNITSTITCH_BASE_URL = process.env.KNITSTITCH_BASE_URL || 'https://craftcms.ddev.site';

module.exports = defineConfig({
  fullyParallel: false,
  reporter: [
    ['list'],
    ['./KnitStitch.Tests/reporters/flatArtifactReporter.cjs'],
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
    // KnitStitch E2E tests (run against the live DDEV site)
    {
      name: 'knitstitch',
      testDir: './KnitStitch.Tests/e2e',
      outputDir: './KnitStitch.Tests/test-results',
      testIgnore: '**/sketchConstraints*.spec.js',
      use: {
        baseURL: KNITSTITCH_BASE_URL,
        trace: 'retain-on-failure',
        // DDEV serves over HTTPS with a self-signed cert.
        ignoreHTTPSErrors: true,
      },
    },
    // KnitStitch constraint tests — full traces + screenshots on every run while debugging
    {
      name: 'knitstitch-constraints',
      testDir: './KnitStitch.Tests/e2e',
      outputDir: './KnitStitch.Tests/test-results-constraints',
      testMatch: '**/sketchConstraints*.spec.js',
      use: {
        baseURL: KNITSTITCH_BASE_URL,
        screenshot: 'on',
        trace: 'on',
        // DDEV serves over HTTPS with a self-signed cert.
        ignoreHTTPSErrors: true,
      },
    },
  ],
});
