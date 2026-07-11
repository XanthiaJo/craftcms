# KnitStitch Project Map

Short summaries of every source file, grouped by role.

For architecture, data flow, interaction model, and the constraint system,
see [architecture.md](architecture.md).

## Root Files

| File | Summary |
| --- | --- |
| `AGENTS.md` | App-specific working instructions for the coding agent. |
| `package.json` | App metadata, scripts, and dependency list. |
| `vite.config.js` | Vite build and dev-server configuration. |

## Docs

| File | Summary |
| --- | --- |
| `docs/architecture.md` | How the app fits together: state, rendering, interaction, constraints. Read first. |
| `docs/project-map.md` | This file — a flat index of every source file. |
| `docs/roadmap.md` | Human-readable feature roadmap: shipped, in progress, planned. |
| `docs/roadmap-agent.md` | Agent-level roadmap with implementation details, refactor phases, and working rules. |
| `docs/tests-map.md` | Index of test files and coverage notes. |
| `docs/testing.md` | How to run unit and E2E tests, plus current setup notes. |

## Bootstrap & Stage

| File | Summary |
| --- | --- |
| `src/main.js` | App bootstrap: creates Store, SketchService, persistence, stage, and UI. |
| `src/konva/appStage.js` | Creates the Konva stage, mounts grid/overlay/sketch layers, handles resize and zoom/pan transform. |

## Konva Layers

| File | Summary |
| --- | --- |
| `src/konva/gridLayer.js` | Infinite grid rendered as viewport-culled off-screen canvas → Konva.Image. Handles cell toggle on click (respects `cellFillEnabled`). |
| `src/konva/overlayLayer.js` | Renders the optional reference image overlay. |
| `src/konva/sketchLayer.js` | Renders sketch points, lines (solid or dashed for construction), dimensions, constraints. Handles all canvas interactions (click, drag, mouse move). Full re-render on store change. |
| `src/konva/sketchOverlay.js` | Floating DOM overlays: dimension edit input and cursor error messages. Projects canvas coords to screen via zoom/pan. |
| `src/konva/constraintIcons.js` | Registry of per-type constraint icon renderers (Perpendicular, Midpoint, Equal, Horizontal, Vertical) with shared click handler. Icons use the selection color when the constraint is selected. |
| `src/konva/dimensionRenderer.js` | Renders dimension witness lines, dim line, arrowheads, and clickable label. |

## Models

| File | Summary |
| --- | --- |
| `src/models/gaugeSettings.js` | Stores gauge inputs (stitches/rows per 4 inches) and exposes per-inch conversions. |
| `src/models/patternDimensions.js` | Stores pattern dimensions (stitch count and row count) for finished-size calc. |
| `src/models/point.js` | Legacy simple point model kept for compatibility. |
| `src/models/sketch/sketchPoint.js` | Sketch point: `{ id, x, y, isSelected, isAnchor }`. IDs are sequential integers. |
| `src/models/sketch/sketchLine.js` | Sketch line: `{ id, start, end, isConstruction, isSelected }`. Start/end are SketchPoint refs. |
| `src/models/sketch/sketchDimension.js` | Dimension between two points. Snaps to H/V/Aligned. Supports driven values and display overrides (for inch labels). |
| `src/models/sketch/sketchConstraint.js` | Constraint model: Coincident, Perpendicular, Midpoint, Equal. Holds point/line refs. |
| `src/models/sketch/sketchColorOption.js` | Color triplet (stroke, fill, select) for sketch strokes. |

## Services

| File | Summary |
| --- | --- |
| `src/services/finishedSizeCalculator.js` | Calculates finished size in inches from gauge and pattern dimensions. |
| `src/services/gridService.js` | Sparse cell toggle, bounding box, cell sizing from gauge, clear-manual-cells-outside-sketch. |
| `src/services/zoomService.js` | Pure zoom/pan helpers: zoom-at-focal, fit-to-view, screen-to-content transform. |

## Sketch Services

| File | Summary |
| --- | --- |
| `src/services/sketch/sketchService.js` | Coordinator: dispatches tools, manages selection, drag, undo/redo, lifecycle. Entry point for all sketch actions. |
| `src/services/sketch/solver/constraintSolver.js` | Local constraint solver: applies constraint rules when points move. Snap, coincident BFS, perpendicular, midpoint, equal, horizontal, vertical, driven dimensions. Perpendicular feasibility check via bipartite graph. |
| `src/services/sketch/solver/globalConstraintSolver.js` | Global gradient-descent solver orchestrator. Delegates error/gradient computation and hard-constraint propagation. |
| `src/services/sketch/solver/constraintErrorTerms.js` | Error functions and analytical gradients for soft constraints (Perpendicular, Coincident, Midpoint, Equal, Horizontal, Vertical). |
| `src/services/sketch/solver/hardConstraintPropagator.js` | Exact enforcement of hard constraints: driven dimensions, Coincident points, and Equal Length propagation. |
| `src/services/sketch/tools/constraintTool.js` | Owns perpendicular, midpoint, equal, horizontal, and vertical constraint creation workflows (line/point picking, validation, commit). |
| `src/services/sketch/tools/dimensionTool.js` | Owns dimension placement, edit overlay, and driven-value application. Converts inch display values to pixels. |
| `src/services/sketch/tools/lineTool.js` | Owns the line/polyline and construction-line drawing workflow (click-to-place, preview, angle snap). |
| `src/services/sketch/templates/templateTool.js` | Generates predefined templates (sock) as sketch points/lines/dimensions/constraints from inch measurements. |
| `src/services/sketch/templates/sockMeasurements.js` | Pure functions: gauge + body measurements → stitch/row counts, inch outline, section dimensions. Based on the Zoom Yummy sock pattern. |
| `src/services/sketch/fill/closedShapeFill.js` | Detects closed loops in non-construction sketch lines and computes which grid cells are 50%+ inside for fill rendering. Returns sparse cell keys. |
| `src/services/sketch/state/historyManager.js` | Action-based undo/redo stack for sketch state. |
| `src/services/sketch/state/sketchSnapshot.js` | Captures and restores full sketch state for undo/redo. |
| `src/services/sketch/state/deleteSketchSelection.js` | Removes selected sketch items and dependent geometry (cascades to constraints/dims). |
| `src/services/sketch/render/buildSketchObjects.js` | Builds the sidebar object list from sketch state, including lines, points, anchors, dimensions, and constraints. |
| `src/services/sketch/state/sketchStateHelpers.js` | Shared helpers: store sync, selection, cursor messages, constraint ID assignment. |
| `src/services/sketch/constants.js` | Shared constants: SketchTool, ConstraintSubMode, SketchObjectKind, snap radius/angle. |
| `src/services/sketch/render/styleOptions.js` | Default stroke colour triplets, thickness defaults, renderer colour constants, slider limits. |

## State

| File | Summary |
| --- | --- |
| `src/state/store.js` | Minimal reactive store: `get(path)` / `set(path, value)` / `subscribe(fn)`. Holds filledCells Set, gauge, zoom/pan, and all sketch state. |
| `src/state/storePersistence.js` | Hydrates and saves app state to localStorage (debounced 300ms). Migrates legacy previewCells to sparse Set. Restores dimension display values. |

## UI

| File | Summary |
| --- | --- |
| `src/ui/mainUi.js` | Main UI bootstrap: binds sidebar inputs, wires workspace switching, handles wheel zoom and middle-mouse pan, subscribes to store for sidebar updates. Calculates finished size from filled cell bounding box. Wires fill-mode toggle and clear-manual button. |

## Utils

| File | Summary |
| --- | --- |
| `src/utils/geometry.js` | Pure geometry helpers: `distance`, `nearestPoint`, `applyAngleSnap`. |

## Template (Craft CMS)

| File | Summary |
| --- | --- |
| `templates/knitstitch.twig` | Page template: workspace tabs (sketch, overlay, templates, options), sidebar panels, zoom controls, measurement inputs. CSS from `web/css/site.css`. |
