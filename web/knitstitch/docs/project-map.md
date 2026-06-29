# KnitStitch Project Map

Short summaries of the main project files.

## Root Files

| File | Summary |
| --- | --- |
| `AGENTS.md` | Repo-specific working instructions for the coding agent. |
| `README.md` | Project overview, setup, and usage notes. |
| `package.json` | App metadata, scripts, and dependency list. |
| `package-lock.json` | Locked dependency tree for npm installs. |
| `vite.config.js` | Vite build and dev-server configuration. |

## Docs

| File | Summary |
| --- | --- |
| `docs/project-map.md` | This file — an index of project files. |
| `docs/roadmap.md` | Product roadmap, refactor phases, constraint expansion, and working rules. |
| `docs/refactor-plan.md` | Tracked refactor work items with progress checkboxes. |
| `docs/tests-map.md` | Index of test files and coverage notes. |

## Source Files

| File | Summary |
| --- | --- |
| `src/main.js` | App bootstrap, stage setup, persistence, and top-level UI wiring. |
| `src/konva/appStage.js` | Creates the Konva stage and mounts the app layers. |
| `src/konva/gridLayer.js` | Renders the grid and preview cells. |
| `src/konva/overlayLayer.js` | Renders the optional overlay image. |
| `src/konva/sketchLayer.js` | Renders sketch geometry and handles canvas interactions. |
| `src/models/gaugeSettings.js` | Stores gauge inputs and exposes per-inch conversions. |
| `src/models/patternDimensions.js` | Stores pattern grid dimensions. |
| `src/models/point.js` | Legacy/simple point model kept for compatibility. |
| `src/models/sketch/sketchColorOption.js` | Color swatch model for sketch strokes. |
| `src/models/sketch/sketchConstraint.js` | Constraint model with labels and references. |
| `src/models/sketch/sketchDimension.js` | Dimension geometry and label calculation. |
| `src/models/sketch/sketchLine.js` | Sketch line model with start/end points. |
| `src/models/sketch/sketchPoint.js` | Sketch point model with selection state. |
| `src/services/finishedSizeCalculator.js` | Calculates finished size from gauge and pattern dimensions. |
| `src/services/gridService.js` | Builds grid preview cells and calculates cell sizing. |
| `src/services/sketch/constraintSolver.js` | Applies constraint rules when points move. |
| `src/services/sketch/constraintTool.js` | Owns the perpendicular constraint creation workflow. |
| `src/services/sketch/dimensionTool.js` | Owns the dimension placement, edit overlay, and driven-value workflow. |
| `src/services/sketch/sketchService.js` | Coordinator: dispatches tools, manages line drawing, selection, and lifecycle. |
| `src/services/sketch/buildSketchObjects.js` | Builds the sidebar object list from sketch state. |
| `src/services/sketch/constants.js` | Shared sketch tool, mode, and object constants. |
| `src/services/sketch/deleteSketchSelection.js` | Removes selected sketch items and dependent geometry. |
| `src/services/sketch/sketchStateHelpers.js` | Shared sketch state, selection, and store-sync helpers. |
| `src/state/store.js` | Small reactive state store used across the app. |
| `src/state/storePersistence.js` | Hydrates and saves app state to localStorage. |
| `src/ui/mainUi.js` | Main UI bootstrap — binds sidebar inputs and subscribes to store. |
| `src/utils/geometry.js` | Pure geometry helpers: distance, nearestPoint, applyAngleSnap. |
| `css/app.css` | App-level styles for the KnitStitch page. |
