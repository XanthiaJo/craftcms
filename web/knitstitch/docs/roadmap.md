# KnitStitch Roadmap

_Last updated: 2026-07-06 (global constraint solver shipped, e2e-first testing approach)_

This document tracks the current state of the KnitStitch app, what has been done, and what is next.

> This file is the single source of truth. It is rendered on the site from the repository's raw GitHub URL.

## Contents

- Status at a Glance
- Recent Shipping: Global Constraint Solver
- Working Rules
- Testing Gaps
- Future Constraint Types
- Future Template Candidates
- Refactor Plans
  - mainUi.js
  - sketchService.js

---

## Status at a Glance

| Area | Status |
|---|---|
| Global constraint solver | Shipped |
| Constraint types | 5 shipped (Coincident, Perpendicular, Midpoint, Equal Length, Driven Dimensions) |
| E2E test coverage | 15/15 passing |
| Testing gaps | 12 items pending |
| UI refactor (mainUi.js) | Not started |
| Sketch service refactor (sketchService.js) | Not started |

---

## Recent Shipping: Global Constraint Solver (2026-07-06)

> A global numerical optimization solver inspired by FreeCAD/OpenCASCADE, using gradient descent with error minimization.

### What Shipped

| Feature | Notes |
|---|---|
| Global numerical optimization solver | Inspired by FreeCAD/OpenCASCADE |
| Gradient descent optimization | Error minimization across all constraints simultaneously |
| E2E-first testing approach | Removed implementation-detail unit tests |
| Constraint test suite | 15/15 Playwright tests passing |

### Architecture Changes

| Change | Description |
|---|---|
| From Local to Global | Constraint-by-constraint propagation replaced with simultaneous optimization |
| Mathematical Foundation | Error functions + gradient calculation instead of heuristic rules |
| FreeCAD Inspiration | Dot product for perpendicular, distance for coincident |
| Real-time Performance | <10ms solve time for typical sketches |

### Constraint Types Supported

| Constraint | Status | Error Definition |
|---|---|---|
| Coincident | Shipped | Distance between points |
| Perpendicular | Shipped | Dot product of line vectors |
| Midpoint | Shipped | Distance from point to line midpoint |
| Equal Length | Shipped | Difference in line lengths |
| Driven Dimensions | Shipped | Hard constraints applied after optimization |

### Testing Strategy Shift

| Decision | Detail |
|---|---|
| E2E-first | User interaction tests over implementation details |
| Removed unit tests | `globalConstraintSolver.test.js`, `sketchService.test.js`, `constraintSolver.test.js` |
| Kept pure logic | Geometry calculations, state management, persistence |
| Coverage | 15 e2e tests cover all user scenarios |

### Solver Implementation Details

```text
Error Functions:
- Perpendicular: error = dx1*dx2 + dy1*dy2  (dot product = 0 at 90°)
- Coincident:    error = distance(point1, point2)  (distance = 0 when coincident)
- Midpoint:      error = distance(point, midpoint(line))
- Equal Length:  error = length(line1) - length(line2)

Optimization Loop:
while error > 1e-6 and iterations < 100:
    calculate_gradients()       # Analytical Jacobian
    apply_gradient_descent()    # Adaptive step size
    apply_driven_dimensions()   # Hard constraints
```

### Known Issues & Next Steps

| Issue | Description |
|---|---|
| Complex perpendicular scenarios | Some e2e tests fail when perpendicular constraints interact with dimensions |
| Movable point detection | Global solver needs better handling when dimensions move points |
| Gradient calculation | May need refinement for complex constraint interactions |

**Immediate next steps:**

1. Fix perpendicular constraint failures in dimension-driven scenarios.
2. Improve movable point detection for dimension changes.
3. Add more robust convergence checking.

---

## Working Rules

| Rule | Rationale |
|---|---|
| One mutation path per concept | Do not update the same sketch state in multiple places unless there is a strong reason. |
| Extract shared geometry/formatting logic | Avoid duplicating logic across model, service, and renderer layers. |
| Prefer small pure helpers | Avoid broad utility buckets. |
| Watch file size | If a file grows beyond 250–300 lines, consider splitting it. |
| Add regression tests | Whenever changing constraint solving, selection, drag behaviour, or persistence. |
| Keep `main.js` as bootstrap | Do not put business logic in `main.js`. |
| Generate UI text from shared helpers | Keep list view and canvas view in sync. |
| New constraint types | Belong in `constraintTool.js` (creation) and `constraintSolver.js` (enforcement), not `sketchService.js`. |
| New tool workflows | Belong in their own tool class, not inlined in `sketchService.js`. |

---

## Testing Gaps

Implementation for the following features is complete; only test coverage is missing.

| Test | Type | Coverage Needed |
|---|---|---|
| Midpoint constraint creation and dragging | E2E | Creation + drag interaction |
| Equal length constraint creation and dragging | E2E | Creation + drag interaction |
| Zoom/pan coordinate transforms | Unit | Projection math |
| Zoom controls changing stage scale | E2E | Button/wheel zoom |
| `sockMeasurements.js` | Unit | Gauge conversion, ease, roundEven, section math, notch derivation |
| Measurement-driven template generation | Unit | Pixel positions, line count, grid size |
| `ensureGridFits` | Unit | Grow when needed, no-op when big enough, preview preserved |
| Enter measurements → template/grid | E2E | Lines appear at correct pixel positions, grid grows |
| Measurement persistence round-trip | Unit | Save/load correctness |
| Regenerate template on hydrate | Unit/Integration | Restore from persisted measurements |
| Undo/redo for measurement changes | Unit/Integration | Snapshot before regenerate |
| Clear template button | E2E | Removes template lines and resets measurements |

---

## Future Constraint Types

The global solver architecture makes adding new constraints straightforward. Each needs:

1. **Error Function** — mathematical relationship that equals 0 when satisfied.
2. **Gradient Calculation** — partial derivatives w.r.t. point coordinates.
3. **UI Integration** — constraint tool workflow and feasibility checks.

### Planned Constraints

| Constraint | Error Function |
|---|---|
| Horizontal/Vertical | `error = dx` or `error = dy` (simpler than dimensions) |
| Parallel | `error = cross_product(line1_vector, line2_vector)` (vectors parallel when cross product = 0) |
| Fixed Angle | `error = angle(line1, line2) - target_angle` (user-specified angle) |
| Tangent | `error = distance(point_offset_from_line, radius)` (for curves) |
| Collinear | `error = cross_product(line1_vector, line2_vector)` (points on same line) |
| Symmetric | `error = distance(point1, mirror(point2, axis))` (mirror constraints) |

### Implementation Pattern

```javascript
// 1. Add error function to globalConstraintSolver.js
_addParallelGradients(constraint, sketch, gradients) {
    const v1 = {
        x: constraint.lineA.end.x - constraint.lineA.start.x,
        y: constraint.lineA.end.y - constraint.lineA.start.y
    };
    const v2 = {
        x: constraint.lineB.end.x - constraint.lineB.start.x,
        y: constraint.lineB.end.y - constraint.lineB.start.y
    };
    const cross = v1.x * v2.y - v1.y * v2.x;
    // Add gradients to movable points...
}

// 2. Add to SketchObjectKind constants
Parallel: 5,

// 3. Add UI button and constraint tool workflow
// 4. Add feasibility checks if needed
```

### Solver Benefits for New Constraints

| Benefit | Description |
|---|---|
| Simultaneous Solving | New constraints automatically work with existing ones |
| No Special Cases | Same optimization loop handles all constraint types |
| Numerical Stability | Gradient-based approach handles floating-point precision |
| Scalable | Performance stays consistent as constraint types increase |

---

## Future Template Candidates

After the measurement-driven model is in place, adding new templates follows the same pattern.

| Template | Outline |
|---|---|
| Mitten | Thumb gusset outline |
| Hat | Brim + crown shaping |
| Sleeve | Tapered outline with cuff |
| Sweater body | Raglan or set-in sleeve outline |

Each template needs:

- Measurements model (`<name>Measurements.js`)
- Outline builder in `templateTool.js`
- Measurement fields in the sidebar
- Unit tests

---

## Refactor Plans

### mainUi.js Refactor Plan

`mainUi.js` is a single 579-line `setupMainUi` function that mixes DOM ref collection, sidebar rendering for 6 independent panels, event binding for ~25 controls, 5 store subscriptions, zoom/pan logic, and keyboard shortcuts. It should be split into focused panel controllers that share a common ref-binding utility.

#### Current Structure

| Section | Lines | Concern |
|---|---|---|
| Refs object | 31–84 | 50+ DOM element lookups in one block |
| `updateGridSidebar` | 88–119 | Grid info, cell size, finished size display |
| `recalculateSize` | 121–142 | Gauge → cell size → finished size pipeline |
| `updateSketchSidebar` | 144–184 | Tool toggle state, object list HTML |
| `updateOverlaySidebar` | 186–193 | Overlay image path, visibility, opacity |
| `updateTemplatesSidebar` | 195–201 | Template button list |
| Measurement helpers | 203–260 | Read/write inputs, derived values, panel visibility |
| `updateZoomDisplay` | 262–267 | Zoom percentage label |
| `syncAll` | 269–276 | Calls all update functions |
| Event bindings | 278–504 | Gauge, sketch tools, overlay, templates, measurements, zoom, pan, keyboard |
| Store subscriptions | 515–567 | 5 separate subscribe calls with path filtering |

#### Phases

| Phase | Action | Target |
|---|---|---|
| 1 — Shared UI utilities | Create `src/ui/uiUtils.js` with `getElement`, `bindIfPresent`, `toggleActive`; import in all panel controllers | Reusable helpers |
| 2 — Grid panel | Create `src/ui/gridPanelController.js` owning grid refs and subscription | Self-contained grid sidebar |
| 3 — Sketch panel | Create `src/ui/sketchPanelController.js` owning tool buttons, object list, sketch subscription | Largest sidebar section split out |
| 4 — Overlay panel | Create `src/ui/overlayPanelController.js` owning overlay controls and subscription | Fully self-contained |
| 5 — Template panel | Create `src/ui/templatePanelController.js` owning template/measurement refs and subscription | Second-largest section split out |
| 6 — Zoom controller | Create `src/ui/zoomController.js` owning zoom buttons, wheel zoom, pan state | Canvas-level interaction |
| 7 — Keyboard controller | Create `src/ui/keyboardController.js` for Escape/Delete key handling | Independent of sidebar |
| 8 — Slim mainUi.js | Thin orchestrator calling each setup function; keep `setWorkspace` wrapper | Under 80 lines |

### sketchService.js Refactor Plan

`sketchService.js` is 496 lines and has accumulated thin proxy methods, inline anchor logic, tool-dispatch switch statements that grow with each tool, and undo fallback logic. The coordinator role is correct, but several chunks should be extracted to match the pattern established by `lineTool.js`, `dimensionTool.js`, and `constraintTool.js`.

#### Current Structure

| Section | Lines | Concern |
|---|---|---|
| Constructor + ID counters | 38–61 | State init, sub-tool composition |
| Store-backed getters/setters | 63–129 | isActive, activeTool, constraintSubMode, strokeColor, strokeThickness |
| Tool dispatch (click) | 131–186 | onCanvasClick, onLineClick, onPointClick — switch per tool |
| Tool dispatch (mouse) | 188–251 | onCanvasMouseMove, startDrag, _onSelectMouseMove |
| Selection queries | 253–259 | hasSelection |
| Cancel/exit | 261–276 | cancelCurrentLine, exitToSelect |
| Undo/clear | 278–329 | undo (with fallback), clear |
| Anchor logic | 331–366 | _findNearestPoint, _onAnchorClick, _convertToAnchor |
| Orphan cleanup | 368–385 | _removeOrphanPoint |
| Sub-tool proxies | 387–406 | Proxies for constraint/dimension tool methods |
| Store-sync proxies | 408–438 | Selection, preview line, snap candidate helpers |
| Delete | 440–467 | deleteSelected |
| Geometry proxies | 469–483 | _applyAngleSnap, _rebuildObjects, _findLinesForPoint, _findSharedPoint |
| Template proxies | 485–495 | templates, applyTemplate, regenerateTemplate |

#### Phases

| Phase | Action | Notes |
|---|---|---|
| 1 — Anchor tool | Extract `_onAnchorClick`/`_convertToAnchor` into `src/services/sketch/anchorTool.js`; compose in `SketchService` | Includes `onAnchorMouseMove` for snap candidate |
| 2 — Selection service | Extract selection state and select/clear methods into `src/services/sketch/selectionService.js` | `deleteSelected` stays but delegates clearing |
| 3 — Sketch cleanup | Extract `_removeOrphanPoint` into a pure `sketchCleanup.js` function | Also a home for `deleteSketchSelection` |
| 4 — Remove sub-tool proxies | Add getters (`dimTool`, `constraintTool`, `lineTool`, `anchorTool`); call sub-tools directly from `sketchLayer.js` and tests | Remove one-line proxies |
| 5 — Tool registry | Replace switch statements with a `Map<SketchTool, Tool>` and uniform `Tool` interface | `Select` becomes `selectTool.js` |
| 6 — Simplify undo fallback | Seed initial empty-state snapshot in `clear()`; remove fallback branch | Test undo after clear |
| 7 — Geometry utils | Import `applyAngleSnap` directly in `lineTool.js`; remove proxy | Pure helper |
| 8 — Slim sketchService.js | Thin coordinator with registry lookups and delegation | Target under 200 lines |
