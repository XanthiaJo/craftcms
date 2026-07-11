# KnitStitch Tests Map

Short summaries of current test coverage.

Tests live at the repository root under `tests/knit-stitch/`, not inside `web/knitstitch/`. Run them from there:

```bash
cd tests/knit-stitch
npx vitest run          # unit tests (67 tests, 12 files)
npx playwright test     # e2e tests (19 tests, 2 files)
```

## Unit tests (`tests/knit-stitch/unit/`)

| File | What it covers |
| --- | --- |
| `axisConstraint.test.js` | Horizontal/Vertical constraint creation and solver enforcement. |
| `closedShapeFill.test.js` | Closed-loop detection from sketch lines and 50%+ area cell fill computation. |
| `equalConstraint.test.js` | Equal length constraint creation, solver enforcement, and undo. |
| `finishedSizeCalculator.test.js` | Finished size calculation from gauge and pattern dimensions. |
| `globalConstraintSolver.test.js` | Global solver: perpendicular, coincident, midpoint, equal, driven dimensions, BFS propagation. |
| `gridService.test.js` | Preview cell rebuild, toggle, grid fitting, and cell sizing. |
| `midpointConstraint.test.js` | Midpoint constraint creation, solver enforcement, and endpoint/midpoint dragging. |
| `overconstraintChecker.test.js` | Over-constraint detection and error reporting. |
| `selectionSync.test.js` | Selection state sync between models and store. |
| `store.test.js` | Store get/set/subscribe behaviour. |
| `storePersistence.test.js` | localStorage hydration round-trip. |
| `undoHistory.test.js` | Undo/redo history for lines, dimensions, constraints, point moves, deletions, and clear. |

## E2E tests (`tests/knit-stitch/e2e/`)

| File | What it covers |
| --- | --- |
| `sketchConstraints.spec.js` | 17 tests: perpendicular creation/drag/deletion, driven dimensions, coincident snapping, midpoint, object panel selection/deletion, sock template constraints, impossible combination rejection. |
| `sketchCellFill.spec.js` | 2 tests: cell fill updates when dragging points, negative coordinate fill verification. |

## Planned coverage

| Area | Priority |
| --- | --- |
| Midpoint and equal-length constraint creation E2E | High |
| Zoom/pan coordinate transforms | Medium |
| `sockMeasurements.js` unit tests | Medium |
| Measurement-driven template generation | Medium |
| Template persistence and regenerate-on-hydrate | Medium |

## Notes

- Unit tests use plain object stubs (no Konva, no DOM) — keep it that way.
- Playwright E2E tests go in `tests/knit-stitch/e2e/`.
- Constraint-related behavior should have both unit and E2E coverage when a new constraint type is added.
- The `tests/knit-stitch/package.json` declares `"type": "module"` so Node loads Vite's ESM build, avoiding the CJS deprecation warning.
