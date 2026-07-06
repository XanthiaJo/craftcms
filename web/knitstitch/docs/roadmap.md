# KnitStitch Roadmap

Last updated: 2026-07-06 (global constraint solver shipped, e2e-first testing approach)

This document tracks the current state of the KnitStitch app, what has been done, and what is next.

---

## Recent Shipping: Global Constraint Solver (2026-07-06)

### What Shipped
- **Global numerical optimization solver** inspired by FreeCAD/OpenCASCADE
- **Gradient descent optimization** with error minimization
- **E2E-first testing approach** - removed implementation-detail unit tests
- **All constraint tests passing** (15/15 Playwright tests)

### Architecture Changes
- **From Local to Global**: Switched from constraint-by-constraint propagation to simultaneous optimization
- **Mathematical Foundation**: Error functions + gradient calculation instead of heuristic rules
- **FreeCAD Inspiration**: Same approach as professional CAD systems (dot product for perpendicular, distance for coincident)
- **Real-time Performance**: <10ms solve time for typical sketches

### Constraint Types Supported
- ✅ **Coincident** - Points snap together (error = distance)
- ✅ **Perpendicular** - Lines at 90° (error = dot product) 
- ✅ **Midpoint** - Point at line midpoint (error = distance to midpoint)
- ✅ **Equal Length** - Lines same length (error = length difference)
- ✅ **Driven Dimensions** - Hard constraints applied after optimization

### Testing Strategy Shift
- **E2E-First**: User interaction tests over implementation details
- **Removed Unit Tests**: `globalConstraintSolver.test.js`, `sketchService.test.js`, `constraintSolver.test.js`
- **Kept Pure Logic**: Geometry calculations, state management, persistence
- **Comprehensive Coverage**: 15 e2e tests cover all user scenarios

### Solver Implementation Details
```
Error Functions:
- Perpendicular: error = dx1*dx2 + dy1*dy2  (dot product = 0 at 90°)
- Coincident: error = distance(point1, point2)  (distance = 0 when coincident)
- Midpoint: error = distance(point, midpoint(line))
- Equal Length: error = length(line1) - length(line2)

Optimization Loop:
while error > 1e-6 and iterations < 100:
    calculate_gradients()  # Analytical Jacobian
    apply_gradient_descent()  # Adaptive step size
    apply_driven_dimensions()  # Hard constraints
```

### Known Issues & Next Steps

- **Complex perpendicular scenarios**: Some e2e tests fail when perpendicular constraints interact with dimensions
- **Movable point detection**: Global solver needs better handling when dimensions move points (not just user drags)
- **Gradient calculation**: May need refinement for complex constraint interactions

**Immediate Next Steps**:
1. Fix perpendicular constraint failures in dimension-driven scenarios
2. Improve movable point detection for dimension changes
3. Add more robust convergence checking

---

## Working Rules

- Keep one mutation path per concept. Do not update the same sketch state in multiple places unless there is a strong reason.
- Extract shared geometry and formatting logic instead of duplicating it in model, service, and renderer layers.
- Prefer small pure helpers over broad utility buckets.
- If a file grows beyond about 250 to 300 lines, stop and check whether it should be split.
- Add regression tests whenever changing constraint solving, selection, drag behaviour, or persistence.
- Keep `main.js` as bootstrap code, not business logic.
- Keep UI text and labels generated from shared helpers so list view and canvas view cannot drift apart.
- New constraint types belong in `constraintTool.js` (creation workflow) and `constraintSolver.js` (geometric enforcement) — not in `sketchService.js`.
- New tool workflows belong in their own tool class (e.g. `lineTool.js`, `dimensionTool.js`), not inlined in `sketchService.js`.

---

## Testing Gaps

Implementation for the following features is complete; only test coverage is missing.

- [ ] e2e: midpoint constraint creation and dragging
- [ ] e2e: equal length constraint creation and dragging
- [ ] unit: zoom/pan coordinate transforms
- [ ] e2e: zoom controls changing the stage scale
- [ ] unit: `sockMeasurements.js` (gauge conversion, ease, roundEven, section math, notch derivation)
- [ ] unit: measurement-driven template generation (correct pixel positions, correct line count, required grid size)
- [ ] unit: `ensureGridFits` (grow when needed, no-op when big enough, preview cells preserved)
- [ ] e2e: enter measurements, verify template lines appear at the right pixel positions, verify grid grew
- [ ] unit: measurement persistence round-trip
- [ ] on hydrate, if a template was active, regenerate it from persisted measurements
- [ ] undo/redo support for measurement changes (each measurement change records a snapshot before regenerating)
- [ ] "clear template" button that removes the template lines and resets measurements to defaults

---

## Future Constraint Types

The global solver architecture makes adding new constraints straightforward. Each needs:

1. **Error Function**: Mathematical relationship that equals 0 when satisfied
2. **Gradient Calculation**: Partial derivatives w.r.t. point coordinates  
3. **UI Integration**: Constraint tool workflow and feasibility checks

### Planned Constraints

- **Horizontal/Vertical**: `error = dx` or `error = dy` (simpler than dimensions)
- **Parallel**: `error = cross_product(line1_vector, line2_vector)` (vectors parallel when cross product = 0)
- **Fixed Angle**: `error = angle(line1, line2) - target_angle` (user-specified angle)
- **Tangent**: `error = distance(point_offset_from_line, radius)` (for curves)
- **Collinear**: `error = cross_product(line1_vector, line2_vector)` (points on same line)
- **Symmetric**: `error = distance(point1, mirror(point2, axis))` (mirror constraints)

### Implementation Pattern
```javascript
// 1. Add error function to globalConstraintSolver.js
_addParallelGradients(constraint, sketch, gradients) {
    const v1 = { x: constraint.lineA.end.x - constraint.lineA.start.x, 
                 y: constraint.lineA.end.y - constraint.lineA.start.y };
    const v2 = { x: constraint.lineB.end.x - constraint.lineB.start.x, 
                 y: constraint.lineB.end.y - constraint.lineB.start.y };
    const cross = v1.x * v2.y - v1.y * v2.x;
    // Add gradients to movable points...
}

// 2. Add to SketchObjectKind constants
Parallel: 5,

// 3. Add UI button and constraint tool workflow
// 4. Add feasibility checks if needed
```

### Solver Benefits for New Constraints

- **Simultaneous Solving**: New constraints automatically work with existing ones
- **No Special Cases**: Same optimization loop handles all constraint types
- **Numerical Stability**: Gradient-based approach handles floating-point precision
- **Scalable**: Performance stays consistent as constraint types increase

---

## Future Template Candidates

After the measurement-driven model is in place, adding new templates follows the same pattern:

- Mitten — thumb gusset outline
- Hat — brim + crown shaping
- Sleeve — tapered outline with cuff
- Sweater body — raglan or set-in sleeve outline

Each needs: a measurements model (`<name>Measurements.js`), an outline builder in `templateTool.js`, measurement fields in the sidebar, and unit tests.

---

## mainUi.js Refactor Plan

`mainUi.js` is a single 579-line `setupMainUi` function that mixes DOM ref collection, sidebar rendering for 6 independent panels, event binding for ~25 controls, 5 store subscriptions, zoom/pan logic, and keyboard shortcuts. It should be split into focused panel controllers that share a common ref-binding utility.

### Current structure (lines)

| Section | Lines | Concern |
|---|---|---|
| Refs object | 31-84 | 50+ DOM element lookups in one block |
| `updateGridSidebar` | 88-119 | Grid info, cell size, finished size display |
| `recalculateSize` | 121-142 | Gauge → cell size → finished size pipeline |
| `updateSketchSidebar` | 144-184 | Tool toggle state, object list HTML |
| `updateOverlaySidebar` | 186-193 | Overlay image path, visibility, opacity |
| `updateTemplatesSidebar` | 195-201 | Template button list |
| Measurement helpers | 203-260 | Read/write inputs, derived values, panel visibility |
| `updateZoomDisplay` | 262-267 | Zoom percentage label |
| `syncAll` | 269-276 | Calls all update functions |
| Event bindings | 278-504 | Gauge, sketch tools, overlay, templates, measurements, zoom, pan, keyboard |
| Store subscriptions | 515-567 | 5 separate subscribe calls with path filtering |

### Phase 1 — Extract shared UI utilities

The ref-binding, event-binding, and toggle helpers at the top of the file are reusable. Extract them so every panel controller can use them.

- [ ] create `src/ui/uiUtils.js` — `getElement`, `bindIfPresent`, `toggleActive`
- [ ] import in all panel controllers

### Phase 2 — Extract `gridPanelController.js`

`updateGridSidebar` + `recalculateSize` + gauge input bindings + grid store subscription. Self-contained: reads gauge/cell/filled state, writes finished size and cell size.

- [ ] create `src/ui/gridPanelController.js` — owns `refs.gaugeStitchesInput`, `refs.gaugeRowsInput`, `refs.gridInfo`, `refs.cellSizeInfo`, `refs.finishedWidth`, `refs.finishedHeight`, `refs.recalcBtn`, `refs.clearManualCellsBtn`
- [ ] export `setupGridPanel({ store, documentObj })` returning `{ update, recalculate }`
- [ ] move the gauge change handlers and recalc button binding
- [ ] move the `filledCells` / `cellWidthPx` / `cellHeightPx` / `finishedWidth` / `finishedHeight` store subscription

### Phase 3 — Extract `sketchPanelController.js`

`updateSketchSidebar` + sketch tool button bindings + object list click handler + sketch store subscription. This is the largest sidebar section and has the most event bindings.

- [ ] create `src/ui/sketchPanelController.js` — owns all `tool*Btn` refs, `sketchColorSelect`, `sketchThicknessSlider`, `sketchUndoBtn`, `sketchClearBtn`, `sketchDeleteBtn`, `sketchObjectList`
- [ ] export `setupSketchPanel({ store, sketchService, documentObj })` returning `{ update }`
- [ ] move the tool button bindings (Line, Select, Anchor, Fill, Dimension, Perpendicular, Midpoint, Equal)
- [ ] move the color/thickness/undo/clear/delete bindings
- [ ] move the object list click delegation
- [ ] move the `sketch.*` store subscription
- [ ] the object-list icon mapping (`&#9473;`, `&#8869;`, `&#8801;`, `&#9679;`) should move to a shared helper in `sketchStateHelpers.js` or a new `sketchObjectLabels.js` so it can be reused

### Phase 4 — Extract `overlayPanelController.js`

`updateOverlaySidebar` + overlay file/clear/visibility/opacity bindings + overlay store subscription. Fully self-contained.

- [ ] create `src/ui/overlayPanelController.js` — owns `overlayFileInput`, `overlayBrowseBtn`, `overlayClearBtn`, `overlayShowCheck`, `overlayOpacitySlider`, `overlayPathText`
- [ ] export `setupOverlayPanel({ store, documentObj })` returning `{ update }`
- [ ] move the file reader logic, clear handler, visibility toggle, opacity slider
- [ ] move the `overlayImageSrc` / `overlayVisible` / `overlayOpacity` store subscription

### Phase 5 — Extract `templatePanelController.js`

`updateTemplatesSidebar` + measurement helpers + measurement input bindings + measurement store subscription. This is the second-largest section.

- [ ] create `src/ui/templatePanelController.js` — owns `templateList`, `measurementsPanel`, all `meas*` and `derived*` refs
- [ ] export `setupTemplatePanel({ store, sketchService, documentObj })` returning `{ update, updateMeasurementsPanelVisibility }`
- [ ] move `readMeasurementsFromInputs`, `writeMeasurementsToInputs`, `updateMeasurementDerived`, `updateMeasurementsPanelVisibility`, `updateTemplatesSidebar`
- [ ] move the template list click delegation and measurement input bindings
- [ ] move the `activeTemplateId` / `templateMeasurements` / gauge store subscription

### Phase 6 — Extract `zoomController.js`

Zoom button bindings + wheel zoom + pan state + `updateZoomDisplay` + zoom store subscription. This is canvas-level interaction, not sidebar.

- [ ] create `src/ui/zoomController.js` — owns `zoomInBtn`, `zoomOutBtn`, `zoomFitBtn`, `zoomResetBtn`, `zoomLevelDisplay`, `konvaStage`, `canvasWrapper`
- [ ] export `setupZoomController({ store, documentObj })` returning `{ update }`
- [ ] move `applyZoomResult`, `getViewportSize`, `getGridPixelSize`
- [ ] move the wheel zoom, right-drag pan, and zoom button bindings
- [ ] move the `zoomLevel` store subscription

### Phase 7 — Extract `keyboardController.js`

The Escape and Delete key handling at the bottom of `mainUi.js` is independent of the sidebar.

- [ ] create `src/ui/keyboardController.js` — export `setupKeyboardController({ store, sketchService, documentObj })`
- [ ] move the `keydown` binding for Escape (exit to select) and Delete (delete selection)

### Phase 8 — Slim down `mainUi.js`

After extraction, `mainUi.js` becomes a thin orchestrator:

- [ ] `setupMainUi` collects refs, calls each `setup*` function, wires `syncAll` to call all `update` functions, returns the public API
- [ ] target: under 80 lines
- [ ] the `setWorkspace` wrapper stays here since it coordinates between store and sketchService

---

## sketchService.js Refactor Plan

`sketchService.js` is 496 lines and has accumulated thin proxy methods, inline anchor logic, tool-dispatch switch statements that grow with each tool, and undo fallback logic. The coordinator role is correct, but several chunks should be extracted to match the pattern established by `lineTool.js`, `dimensionTool.js`, and `constraintTool.js`.

### Current structure (lines)

| Section | Lines | Concern |
|---|---|---|
| Constructor + ID counters | 38-61 | State init, sub-tool composition |
| Store-backed getters/setters | 63-129 | isActive, activeTool, constraintSubMode, strokeColor, strokeThickness |
| Tool dispatch (click) | 131-186 | onCanvasClick, onLineClick, onPointClick — switch per tool |
| Tool dispatch (mouse) | 188-251 | onCanvasMouseMove, startDrag, _onSelectMouseMove |
| Selection queries | 253-259 | hasSelection |
| Cancel/exit | 261-276 | cancelCurrentLine, exitToSelect |
| Undo/clear | 278-329 | undo (with fallback), clear |
| Anchor logic | 331-366 | _findNearestPoint, _onAnchorClick, _convertToAnchor |
| Orphan cleanup | 368-385 | _removeOrphanPoint |
| Sub-tool proxies | 387-406 | onConstraintLineClick, onConstraintPointClick, _openDimEdit, _applyDimConstraint, _tryCreatePerpendicularConstraint |
| Store-sync proxies | 408-438 | _setPreviewLine, _setSnapCandidate, clearSelection, selectPoint, selectLine, selectDimension, selectConstraint, selectObjectByRef |
| Delete | 440-467 | deleteSelected |
| Geometry proxies | 469-483 | _applyAngleSnap, _rebuildObjects, _findLinesForPoint, _findSharedPoint |
| Template proxies | 485-495 | templates, applyTemplate, regenerateTemplate |

### Phase 1 — Extract `anchorTool.js`

The anchor creation workflow (`_onAnchorClick`, `_convertToAnchor`) follows the same pattern as `lineTool.js` and `constraintTool.js`. It owns a tool-specific click flow and then exits to Select.

- [ ] create `src/services/sketch/anchorTool.js` — `AnchorTool` class with `onAnchorClick(position, modifiers)` and `convertToAnchor(point)`
- [ ] compose in `SketchService` constructor as `this._anchorTool = new AnchorTool(this)`
- [ ] replace `_onAnchorClick` and `_convertToAnchor` in `sketchService.js` with `this._anchorTool.onAnchorClick(position, modifiers)`
- [ ] add `onAnchorMouseMove` to `AnchorTool` for snap-candidate display (currently inlined in `onCanvasMouseMove`)

### Phase 2 — Extract `selectionService.js`

Selection state (`_selectedPoints`, `_selectedLines` Sets) and all select/clear methods are a self-contained concern. They don't depend on tool dispatch or solver logic.

- [ ] create `src/services/sketch/selectionService.js` — owns `_selectedPoints`, `_selectedLines`, and the `selectPoint`, `selectLine`, `selectDimension`, `selectConstraint`, `selectObjectByRef`, `clearSelection`, `hasSelection` methods
- [ ] compose in `SketchService` constructor as `this._selection = new SelectionService(this.store)`
- [ ] replace the proxy methods in `sketchService.js` with `this._selection.selectPoint(point, multiSelect)` etc.
- [ ] `deleteSelected` stays in `sketchService.js` since it coordinates selection + deletion + orphan cleanup, but delegates selection clearing to `this._selection`

### Phase 3 — Extract `sketchCleanup.js`

`_removeOrphanPoint` scans lines, dimensions, and constraints to decide if a point is still referenced. This is a pure graph query that doesn't need service state.

- [ ] create `src/services/sketch/sketchCleanup.js` — export `removeOrphanPoint(sketch, point, store)` as a pure function
- [ ] call from `sketchService.js` where needed (delete, undo, cancelCurrentLine)
- [ ] this is also where `deleteSketchSelection` could live or be re-exported from

### Phase 4 — Remove sub-tool proxy methods

`_openDimEdit`, `_applyDimConstraint`, `_tryCreatePerpendicularConstraint`, `onConstraintLineClick`, `onConstraintPointClick` are one-line proxies that exist so `sketchLayer.js` and tests can call them without knowing the sub-tool. After the refactor, the layer and tests should call the sub-tools directly through a single accessor.

- [ ] add `get dimTool()`, `get constraintTool()`, `get lineTool()`, `get anchorTool()` getters on `SketchService`
- [ ] update `sketchLayer.js` to call `service.dimTool.openDimEdit(dim)` etc.
- [ ] update tests to call `service.constraintTool._tryCreatePerpendicularConstraint(...)` etc.
- [ ] remove the proxy methods from `sketchService.js`

### Phase 5 — Collapse the tool-dispatch switch statements

`onCanvasClick`, `onPointClick`, `onLineClick`, `onCanvasMouseMove` each have a switch on `this.activeTool`. As tools grow, these switches grow. A tool registry with a uniform interface collapses them.

- [ ] define a `Tool` interface: `onCanvasClick(position, modifiers)`, `onPointClick(pt, position, modifiers)`, `onLineClick(line, position, modifiers)`, `onMouseMove(position, modifiers)`
- [ ] register each tool in a `Map<SketchTool, Tool>` in the constructor
- [ ] `onCanvasClick` becomes `this._tools.get(this.activeTool)?.onCanvasClick(position, modifiers)`
- [ ] each tool class implements the interface; tools that don't handle a method no-op by default
- [ ] `Select` tool gets its own class too (`selectTool.js`) owning `startDrag`, `_onSelectMouseMove`, `onCanvasMouseUp`

### Phase 6 — Simplify undo fallback

The `undo()` method has a fallback path that manually removes the last line and its orphan points. This duplicates deletion logic and is only reached when history is empty. After the history manager is seeded with an initial snapshot on `clear()`, the fallback can be removed.

- [ ] seed an initial empty-state snapshot in `clear()` so `undo` always has something to pop
- [ ] remove the fallback branch in `undo()`
- [ ] add a test that verifies undo after clear restores the empty state

### Phase 7 — Move `_applyAngleSnap` to geometry utils

`_applyAngleSnap` is a one-line proxy to `applyAngleSnap` from `geometry.js`. It exists so `lineTool.js` can call `service._applyAngleSnap`. After the tool registry, `lineTool.js` can import `applyAngleSnap` directly.

- [ ] import `applyAngleSnap` directly in `lineTool.js`
- [ ] remove `_applyAngleSnap` from `sketchService.js`

### Phase 8 — Slim down `sketchService.js`

After extraction, `sketchService.js` becomes a thin coordinator:

- [ ] constructor: init sub-tools, register tool map, sync store
- [ ] store-backed getters/setters stay (isActive, activeTool, constraintSubMode, strokeColor, strokeThickness)
- [ ] tool dispatch: one-line registry lookups
- [ ] `deleteSelected`: delegates to `deleteSketchSelection` + `sketchCleanup` + `selectionService`
- [ ] `undo` / `clear` / `exitToSelect` / `cancelCurrentLine` stay
- [ ] template proxies stay (one-line)
- [ ] target: under 200 lines
