import { defineConfig } from '@playwright/test';

// E2E tests run against the Craft CMS DDEV site. Start DDEV first (`ddev start`)
// so that http://craftcms.ddev.site/knit-stitch is reachable. No fixture file
// or local Vite server is required.
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://craftcms.ddev.site',
    trace: 'on-first-retry',
  },
});
