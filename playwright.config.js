const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  outputDir: './test-results',
  fullyParallel: false,
  reporter: 'list',
  use: {
    headless: false,
    screenshot: 'only-on-failure',
  },
  projects: [
    // Craft CMS E2E tests
    {
      name: 'craftcms',
      testConfig: './tests/craft-cms/playwright.config.js',
    },
    // KnitStitch E2E tests
    {
      name: 'knitstitch',
      testConfig: './tests/knit-stitch/playwright.config.js',
    },
  ],
});
