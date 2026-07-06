# KnitStitch Tests Map

Short summaries of current test coverage.

Tests live at the repository root under `tests/knit-stitch/`, not inside `web/knitstitch/`. Run them from there:

```bash
cd tests/knit-stitch
npx vitest run          # unit tests
npx playwright test     # e2e tests
```

## Unit tests (`tests/knit-stitch/unit/`)

| File | What it covers |
| --- | --- |
| `constraintSolver.test.js` | `canAddPerpendicularConstraint` — shared-point requirement, no-duplicate, triangle over-constraint, independent quad. |
| `closedShapeFill.test.js` | Closed-loop detection from sketch lines and 50%+ area cell fill computation. |
| `equalConstraint.test.js` | Equal length constraint creation, solver enforcement, and undo. |
| `FinishedSizeCalculator.test.js` | Finished size calculation from gauge and pattern dimensions. |
| `GridService.test.js` | Preview cell rebuild, toggle, grid fitting, and cell sizing. |
| `midpointConstraint.test.js` | Midpoint constraint creation, solver enforcement, and endpoint/midpoint dragging. |
| `SketchService.test.js` | Broad SketchService coverage: tool dispatch, selection, line drawing, deletion, constraints, dimensions. |
| `Store.test.js` | Store get/set/subscribe behaviour. |
| `StorePersistence.test.js` | localStorage hydration round-trip. |
| `undoHistory.test.js` | Undo/redo history for lines, dimensions, constraints, point moves, deletions, and clear. |

## E2E tests (`tests/knit-stitch/e2e/`)

| File | What it covers |
| --- | --- |
| `SketchConstraints.spec.js` | Playwright end-to-end sketch constraint creation and interaction. |

## Planned coverage

| Area | Priority |
| --- | --- |
| `constraintSolver` — `enforcePerpendicularConstraint` | High — verify geometry moves correctly when constraint is applied |
| `constraintSolver` — `solveConstraintsForPoint` drag | High — verify point drag respects active perpendicular constraints |
| `sketchStateHelpers` — selection helpers | Medium |
| `deleteSketchSelection` — cascade deletion | Medium |
| `dimensionTool` — driven-value application | Medium |
| `templateTool` — template generation | Medium — verify outline points/lines are created and scaled to grid |
| `zoomService` — coordinate transforms | Medium — verify zoomAt, fitToView, screenToContent math |
| E2E — perpendicular constraint creation and rejection | High — Playwright, using `window.__knitstitchSketchService` for state verification |

## Notes

- Unit tests use plain object stubs (no Konva, no DOM) — keep it that way.
- Playwright E2E tests go in `tests/knit-stitch/e2e/`.
- Constraint-related behavior should have both unit and E2E coverage when a new constraint type is added.
