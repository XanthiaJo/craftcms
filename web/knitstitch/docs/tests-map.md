# KnitStitch Tests Map

Short summaries of current test coverage. All test files live directly under `tests/`.

| File | What it covers |
| --- | --- |
| `tests/constraintSolver.test.js` | `canAddPerpendicularConstraint` — shared-point requirement, no-duplicate, triangle over-constraint, independent quad. |
| `tests/undoHistory.test.js` | Undo/redo history for lines, dimensions, constraints, point moves, deletions, and clear. |
| `tests/midpointConstraint.test.js` | Midpoint constraint creation, solver enforcement, and endpoint/midpoint dragging. |
| `tests/equalConstraint.test.js` | Equal length constraint creation, solver enforcement, and undo. |

## Planned coverage

| Area | Priority |
| --- | --- |
| `constraintSolver` — `enforcePerpendicularConstraint` | High — verify geometry moves correctly when constraint is applied |
| `constraintSolver` — `solveConstraintsForPoint` drag | High — verify point drag respects active perpendicular constraints |
| `sketchStateHelpers` — selection helpers | Medium |
| `deleteSketchSelection` — cascade deletion | Medium |
| `storePersistence` — hydration round-trip | Medium |
| `dimensionTool` — driven-value application | Medium |
| E2E — perpendicular constraint creation and rejection | High — Playwright, using `window.__knitstitchSketchService` for state verification |

## Notes

- Unit tests use plain object stubs (no Konva, no DOM) — keep it that way.
- Playwright E2E tests go in `tests/e2e/` when added.
- Constraint-related behavior should have both unit and E2E coverage when a new constraint type is added.
