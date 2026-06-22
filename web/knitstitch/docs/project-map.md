# Knitstitch Project Map

Short summaries of the main project files.

## Root Files

| File | Summary |
| --- | --- |
| `AGENT.md` | Repo-specific working instructions for the coding agent. |
| `README.md` | Project overview, setup, and usage notes. |
| `ROADMAP.md` | Refactor plan and working rules for the knitstitch codebase. |
| `package.json` | App metadata, scripts, and dependency list. |
| `package-lock.json` | Locked dependency tree for npm installs. |
| `vite.config.js` | Vite build and dev-server configuration. |
| `vitest.config.js` | Vitest test runner configuration. |
| `playwright.config.js` | Playwright E2E test configuration. |

## Source Files

| File | Summary |
| --- | --- |
| `src/main.js` | App bootstrap, stage setup, persistence, and top-level UI wiring. |
| `src/konva/AppStage.js` | Creates the Konva stage and mounts the app layers. |
| `src/konva/GridLayer.js` | Renders the grid and preview cells. |
| `src/konva/OverlayLayer.js` | Renders the optional overlay image. |
| `src/konva/SketchLayer.js` | Renders sketch geometry and handles canvas interactions. |
| `src/models/GaugeSettings.js` | Stores gauge inputs and exposes per-inch conversions. |
| `src/models/PatternDimensions.js` | Stores pattern grid dimensions. |
| `src/models/Point.js` | Legacy/simple point model kept for compatibility. |
| `src/models/sketch/SketchColorOption.js` | Color swatch model for sketch strokes. |
| `src/models/sketch/SketchConstraint.js` | Constraint model with labels and references. |
| `src/models/sketch/SketchDimension.js` | Dimension geometry and label calculation. |
| `src/models/sketch/SketchLine.js` | Sketch line model with start/end points. |
| `src/models/sketch/SketchPoint.js` | Sketch point model with selection state. |
| `src/services/ConstraintSolver.js` | Applies constraint rules when points move. |
| `src/services/FinishedSizeCalculator.js` | Calculates finished size from gauge and pattern dimensions. |
| `src/services/GridService.js` | Builds grid preview cells and calculates cell sizing. |
| `src/services/sketch/SketchService.js` | Main sketch interaction service for tools, selection, and mutations. |
| `src/services/sketch/buildSketchObjects.js` | Builds the sidebar object list from sketch state. |
| `src/services/sketch/constants.js` | Shared sketch tool, mode, and object constants. |
| `src/services/sketch/deleteSketchSelection.js` | Removes selected sketch items and dependent geometry. |
| `src/services/sketch/sketchStateHelpers.js` | Shared sketch state, selection, and store-sync helpers. |
| `src/state/Store.js` | Small reactive state store used across the app. |
| `src/state/StorePersistence.js` | Hydrates and saves app state to localStorage. |
| `src/ui/GridPanel.js` | Placeholder for a dedicated grid panel component. |
| `src/ui/OverlayPanel.js` | Placeholder for a dedicated overlay panel component. |
| `src/ui/Sidebar.js` | Placeholder for sidebar shell and tab management. |
| `src/ui/SketchPanel.js` | Placeholder for a dedicated sketch panel component. |
| `src/ui/mainUi.js` | Main UI bootstrap helper used by `main.js`. |
| `src/utils/math.js` | Placeholder for shared math helpers. |

## Notes

- The `src/ui/*.js` placeholder files are kept for future component extraction.
- `src/ui/mainUi.js` is the first real UI extraction from `src/main.js`.
- `ROADMAP.md` is the canonical place for refactor progress.
