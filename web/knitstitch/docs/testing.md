# KnitStitch Testing Guide

How the KnitStitch test suite runs and how to add to it.

Tests live at the repository root under `KnitStitch.Tests/`, not inside `web/knitstitch/`. All commands below assume you are in that directory.

```bash
cd KnitStitch.Tests
```

## Quick start

| Suite | Command | Files | Count |
| --- | --- | --- | --- |
| Unit | `npx vitest run` | `KnitStitch.Tests/unit/**/*.test.js` | 67 tests across 12 files |
| E2E | `npx playwright test` | `KnitStitch.Tests/e2e/**/*.spec.js` | 19 tests across 2 files |

## Unit tests (Vitest)

Unit tests exercise pure logic and small service helpers without Konva or a browser. They import source files directly from `web/knitstitch/src/`.

### Running unit tests

```bash
npx vitest run
```

For watch mode during development:

```bash
npx vitest
```

Vitest reads `vitest.config.js` in this directory. That config uses Node environment and only includes `unit/**/*.test.js`. The `package.json` in `KnitStitch.Tests/` declares `"type": "module"` so Node loads Vite's ESM build (avoiding the CJS deprecation warning).

### What to unit test

Good candidates:

- Pure geometry helpers (`utils/geometry.js`)
- State/store logic (`state/store.js`, `state/storePersistence.js`)
- Calculator helpers (`finishedSizeCalculator.js`, `gridService.js`)
- Individual constraint enforcement methods on `ConstraintSolver`
- Sketch model behavior (`SketchPoint`, `SketchLine`, `SketchDimension`, `SketchConstraint`)

Avoid unit tests for:

- Full UI interaction flows
- Solver convergence on complex multi-constraint graphs
- Visual relationships that are easier to assert in the browser

### Creating a unit test

Create a file under `KnitStitch.Tests/unit/` ending in `.test.js`. Import the module under test from `../../web/knitstitch/src/...`.

Example pattern from `equalConstraint.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { ConstraintSolver } from '../../../web/knitstitch/src/services/sketch/solver/constraintSolver.js';
import { SketchPoint } from '../../../web/knitstitch/src/models/sketch/sketchPoint.js';
import { SketchLine } from '../../../web/knitstitch/src/models/sketch/sketchLine.js';
```

Use the real model classes rather than hand-rolled stubs when the logic under test reads model properties such as `line.start`, `dim.drivenValue`, or `constraint.type`.

## E2E tests (Playwright)

E2E tests drive the app through the browser and assert visual/interactive outcomes: perpendicular lines stay perpendicular, dimensions stay locked, points move as expected, and so on.

### Required runtime

The E2E tests navigate to `/knit-stitch`, which is served by the Craft CMS site. Before running E2E tests you need a working DDEV/Craft CMS environment with:

- `craftcms.ddev.site` resolving locally (or overridden via `baseURL`)
- A reachable database
- The KnitStitch page loading without database errors

The tests also pre-set a cookie consent cookie for `craftcms.ddev.site` so the banner does not block clicks.

### Running E2E tests

```bash
npx playwright test
```

Run a single spec file:

```bash
npx playwright test e2e/sketchConstraints.spec.js
```

Run a single test by title:

```bash
npx playwright test e2e/sketchConstraints.spec.js --grep "driven dimensions stay locked"
```

### Current Playwright configuration

`playwright.config.js` is set up to run against the Craft CMS DDEV site:

```js
use: {
  baseURL: 'http://craftcms.ddev.site',
}
```

No `webServer` or fixture file is required. Start DDEV first, then run the tests.

```bash
ddev start
npx playwright test
```

If you need to point at a different host, set the `BASE_URL` environment variable or edit `use.baseURL` in `KnitStitch.Tests/playwright.config.js`.

### Creating an E2E test

Create a file under `KnitStitch.Tests/e2e/` ending in `.spec.js` and import from `@playwright/test`.

Reusable helpers in `sketchConstraints.spec.js`:

- `openSketch(page)` — sets the consent cookie, navigates to `/knit-stitch`, switches to Sketch workspace, clicks Line tool, and returns the canvas bounding box.
- `clickStage(page, box, point)` — clicks a point relative to the canvas box.
- `dragStage(page, box, from, to)` — drags from one relative point to another with intermediate steps.

Use `page.evaluate(() => window.__knitstitchStore?.state?.sketch)` to inspect sketch state (points, lines, dimensions, constraints) from the browser.

Common patterns:

```js
const selection = await page.evaluate(() => {
  const sketch = window.__knitstitchStore?.state?.sketch;
  return {
    selectedPoints: sketch?.points.filter((p) => p.isSelected).map((p) => ({ x: p.x, y: p.y })),
  };
});
```

### Coordinate system

Konva’s `getRelativePointerPosition()` computes coordinates relative to the inner `.konvajs-content` div, not `#konva-stage`. The helpers in `sketchConstraints.spec.js` use the content div’s bounding box as the origin so clicks land where expected. Always use `box.x + point.x` and `box.y + point.y` rather than raw screen coordinates.

## Test coverage notes

- The E2E suite is the source of truth for user-visible constraint behavior.
- Unit tests are the source of truth for isolated logic and model behavior.
- When adding a new constraint type, add both a unit test for the enforcement method and an E2E test for the creation workflow.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `No test files found` when running Vitest | You are in `web/knitstitch/` instead of `KnitStitch.Tests/`. |
| `Process from config.webServer was not able to start` | Playwright is trying to auto-start a Vite server that has no fixture. Start DDEV or adjust `baseURL` and `webServer`. |
| `Error establishing a database connection` in E2E | DDEV is up but the Craft database is not reachable/imported. |
| Canvas clicks miss the intended point | Coordinates are screen-relative instead of content-div-relative. Use the `box` returned by `openSketch()`. |

