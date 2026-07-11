import { defineConfig } from '@playwright/test';

// E2E tests run against the Craft CMS DDEV site. Start DDEV first (`ddev start`)
// so that http://craftcms.ddev.site/knit-stitch is reachable. No fixture file
// or local Vite server is required.
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://craftcms.ddev.site',
  },
  reporter: [
    ['list'],
    ['./reporters/flatArtifactReporter.cjs'],
  ],
  projects: [
    {
      name: 'knitstitch',
      testIgnore: '**/sketchConstraints*.spec.js',
      outputDir: './test-results',
      use: {
        trace: 'retain-on-failure',
      },
    },
    {
      name: 'knitstitch-constraints',
      testMatch: '**/sketchConstraints*.spec.js',
      outputDir: './test-results-constraints',
      use: {
        screenshot: 'on',
        trace: 'on',
      },
    },
  ],
});
