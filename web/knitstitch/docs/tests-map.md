# Knitstitch Tests Map

Short summaries of the current test coverage.

| File | Summary |
| --- | --- |
| `tests/FinishedSizeCalculator.test.js` | Verifies finished size calculations from gauge and pattern dimensions. |
| `tests/GridService.test.js` | Covers grid sizing, preview cells, and related grid logic. |
| `tests/SketchService.test.js` | Covers sketch tools, selection, constraints, and mutation behavior. |
| `tests/Store.test.js` | Verifies the reactive store behavior. |
| `tests/StorePersistence.test.js` | Covers persistence, hydration, and state normalization. |
| `tests/e2e/SketchConstraints.spec.js` | End-to-end coverage for sketch constraint interactions in the browser. |
| `tests/fixtures/knitstitch-playwright.html` | Static fixture page used by Playwright tests. |

## Coverage Notes

- The unit tests focus on model and service behavior.
- The Playwright spec exercises the actual UI and canvas interaction path.
- Constraint-related behavior should keep both unit and E2E coverage when extended.

