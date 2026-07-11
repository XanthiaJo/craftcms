# KnitStitch Sketch Architecture

How the sketch system fits together: state, rendering, interaction, and constraints.

## Overview

KnitStitch is a Konva.js sketch surface embedded inside a Craft CMS page. The sketch layer sits on top of an infinite grid and an optional reference-image overlay. Sketch entities are persistent geometric objects (points, lines, dimensions, constraints), not just drawing strokes.

The intended interaction model is Fusion 360 / FreeCAD-style parametric sketching:

- Entities stay after creation.
- Constraints are relationships that immediately affect geometry.
- Dimensions are driving values when confirmed.
- Impossible constraint combinations should be rejected.

## Sketch state

The sketch owns four arrays on the reactive store at `store.state.sketch`:

| Array | Contents |
| --- | --- |
| `points` | `SketchPoint` instances: `{ id, x, y, isSelected, isAnchor }` |
| `lines` | `SketchLine` instances: `{ id, start, end, isConstruction, isSelected }` |
| `dimensions` | `SketchDimension` instances between two points |
| `constraints` | `SketchConstraint` instances: Perpendicular, Coincident, Midpoint, Equal |

### Construction lines

Lines can be marked as construction (`isConstruction = true`). They render with a dashed stroke and are excluded from closed-shape cell filling, but their endpoints are still real points and can participate in constraints.

IDs are sequential integers managed by `SketchService`. Selection is tracked both in the models (`isSelected`) and in private `Set`s inside `SketchService`.

## Coordinate system

All sketch geometry is stored in canvas pixels. The grid and cell fills use cell units, but the sketch uses the pixel space Konva renders into. A point at `(0, 0)` is the top-left of the Konva stage; negative coordinates are valid and supported.

## Constraint types

### Perpendicular

A line-to-line constraint. Two lines must meet at 90° at their shared endpoint (the anchor). When created, the geometry moves immediately so the relation is true. The solver rejects impossible combinations (e.g., a triangle with two perpendicular constraints on the same line).

### Coincident

Two points occupy the same location. Coincident points propagate like a connected component: moving any member moves the whole group. Anchors win — if one point in the group is an anchor, all others snap to it.

### Midpoint

A point is constrained to the midpoint of a line. The point must not be an endpoint of that line.

### Equal

Two non-identical lines must have the same length. The solver scales the second line around its midpoint to match the first.

### Horizontal / Vertical

A single line is forced to be horizontal (`start.y === end.y`) or vertical (`start.x === end.x`). These are added as soft error terms in the global solver and are also enforced locally when the constraint is created.

## Selection sync

Selecting an entity in the object list (`selectObjectByRef`) selects the underlying model, which rebuilds the object list and re-renders the sketch layer. This keeps the highlighted list row and the highlighted canvas entity (line, point, anchor, dimension label, or constraint icon) in sync. Constraint icons use `iconColor(constraint)` to switch to the accent color when `constraint.isSelected` is true.

The object list includes every sketch point, not just anchors, so regular points can be selected and highlighted too.

## Dimensions

A dimension measures the distance between two points. When confirmed with a value it becomes **driven** (`drivenValue !== null`) and is displayed with a lock icon. The dimension kind is derived from the current geometry:

- `Horizontal` when the line is within 10° of horizontal
- `Vertical` when within 10° of vertical
- `Aligned` otherwise

Driven dimensions are the primary way to lock real-world measurements (inches) in the sock template.

## Solver architecture

There are two solvers. `SketchService._useGlobalSolver` is `true` by default, so the global solver runs first.

### GlobalConstraintSolver

A numerical optimizer inspired by FreeCAD/OpenCASCADE sketch solvers. It minimizes total constraint error using gradient descent and then enforces driven dimensions and coincident constraints as hard constraints after every step.

Error terms (squared):

- `Perpendicular`: `(dot product of the two line vectors)^2`
- `Coincident`: `(distance between the two points)^2`
- `Midpoint`: `(distance from point to line midpoint)^2`
- `Equal`: `(length(lineA) - length(lineB))^2`

The dragged point is the only point the user directly controls; anchors are fixed. All other points are free and adjusted by the optimizer.

After each gradient step, `_applyDrivenDimensions` repositions the driven endpoint of every dimension relative to its driver. `_propagateCoincident` then collapses coincident groups onto their leader (anchor, then moved point, then first member).

If the dimension graph looks infeasible (a single non-moved point would be driven by more than two dimensions), the solver returns `null` and `SketchService` falls back to the local solver.

### Local ConstraintSolver

The original per-point solver. It applies constraints one at a time for the dragged point:

1. Snap to a nearby point and create a Coincident constraint if within radius.
2. Propagate Coincident constraints.
3. Apply Perpendicular, Midpoint, and Equal constraints.
4. Apply driven dimensions that touch the dragged point.
5. Re-apply geometric constraints to any points moved by those dimensions.

It does not propagate driven dimensions through chains. It is kept as a fallback when the global solver reports an infeasible graph.

## Why some points can still move

A point is movable when the set of active constraints and dimensions does not fully determine its position. Two common cases in the current implementation:

### 1. A point is only constrained by `Equal` length

`Equal` locks the length of a line but not its position or angle. A line can rotate around its midpoint and still satisfy an `Equal` constraint. Therefore the endpoints remain free unless other constraints or dimensions pin them down.

### 2. A point is not reached by any driven dimension chain

The global solver treats driven dimensions as a graph rooted at the moved/fixed point. Points that are not reachable from that root are only affected by soft geometric constraints and can drift.

## Sock template example

The sock template creates:

- 20 outline points connected into a closed loop.
- One horizontal width dimension across the top (points 0→19).
- Vertical section dimensions down both sides for the non-notch segments (ribbing, leg, sole, instep, ribbing). The heel/toe span dimensions that skipped the notch points are omitted because they over-constrain the region.
- Aligned dimensions for the left-side heel and toe notches.
- `Perpendicular` constraints at the four corners.
- `Equal` constraints making the right-side notch lines match the left-side notch lines.

### Top width being violated

When a point on the right edge such as point 18 (end of top ribbing) is dragged, both the width dimension (0→19) and the right top-rib dimension (19→18) try to drive point 19. With fixed-order sequential enforcement, the later dimension overrides the earlier one, so the top line stretches even though its dimension is still displayed as locked.

The global solver now uses BFS propagation from the dragged/anchored point instead of a fixed creation order. When an anchor exists, propagation starts from the anchor (and points coincident with it) so the entire constrained chain is positioned from the fixed root, keeping every dimension locked.

### Origin anchor

When the grid first loads, `AppStage` creates an anchor point at `(0, 0)` and pans the viewport so the origin sits at the centre of the canvas. This gives every sketch a fixed reference point. Templates generate their reference corner coincident with this anchor, so the template is rooted to the origin and becomes fully constrained.

### Equal Length constraints

`Equal` is now treated as a hard constraint during dimension propagation. When one line in an Equal pair has a known length (because both of its endpoints are positioned by dimensions or by earlier propagation), the solver positions the free endpoint of the other line at the same distance.

This is only half the story for mirrored geometry: Equal locks length, but not position. The right-side toe notch initially had no dimensioned link to the right edge, so those points were still free-floating. The sock template adds aligned dimensions on both sides of each notch to fully lock the shape.

### Dimension re-enforcement and driver/driven assignment

The solver now tracks the BFS depth of each reachable point from the anchor (or dragged point). For every dimension, the shallower endpoint is the driver and the deeper endpoint is driven. Dimensions are re-enforced in every iteration by moving only the driven point, which keeps the entire constraint chain locked while still allowing gradient descent to clean up residual soft-constraint error.

### Solver structure

The global solver is split into three focused pieces to keep it maintainable:

- `constraintErrorTerms.js` — error functions and analytical gradients for Perpendicular, Coincident, Midpoint, and Equal constraints.
- `hardConstraintPropagator.js` — exact enforcement of driven dimensions, Coincident constraints, and Equal Length propagation.
- `globalConstraintSolver.js` — the gradient-descent loop that orchestrates the above.

## FreeCAD-style semantics

FreeCAD and Fusion 360 treat the sketch as a geometric constraint problem (GCP). Each constraint removes degrees of freedom:

- A point in 2D has 2 DOF.
- A line has 4 DOF (two endpoints).
- A dimension removes 1 DOF.
- A perpendicular constraint removes 1 DOF.
- A coincident constraint removes 2 DOF.
- An equal-length constraint removes 1 DOF.

A sketch is well-constrained when the remaining DOF count equals zero (ignoring the sketch’s overall position, which is usually anchored). If DOF > 0, points can move while keeping all constraints true — exactly what happens with the under-constrained right-side notch points.

The current KnitStitch solver does not compute a DOF count. It either finds a numerical solution or returns `null`. That means under-constrained sketches can silently remain editable instead of being flagged.

## Current limitations

- Driven dimensions are enforced by BFS propagation from moved/anchored points. This fixes cases where a shared endpoint (e.g., point 19) was overwritten by a later dimension, but interdependent dimension clusters (e.g., heel/toe notches dimensioned both vertically and diagonally) are still solved sequentially, leaving small residual errors.
- The global solver bails out and falls back to the local solver when a point appears to be overdriven. This fallback does not enforce dimension chains, so dragging can stretch lines in complex templates.
- `Equal` constraints preserve midpoint but do not lock orientation, leaving endpoints free to rotate.
- There is no DOF analysis or visual indication of which points are under-constrained.

## File responsibilities

| File | Role |
| --- | --- |
| `src/services/sketch/sketchService.js` | Top-level coordinator: tool dispatch, selection, drag, undo/redo, solver invocation. |
| `src/services/sketch/solver/globalConstraintSolver.js` | Global numerical solver: gradient descent + hard dimension/coincident enforcement. |
| `src/services/sketch/solver/constraintSolver.js` | Local per-point solver: snap, coincident, perpendicular, midpoint, equal, dimensions. Fallback only. |
| `src/services/sketch/tools/constraintTool.js` | Creation workflow for perpendicular, midpoint, and equal constraints. |
| `src/services/sketch/tools/dimensionTool.js` | Dimension placement and driven-value confirmation. |
| `src/services/sketch/templates/templateTool.js` | Generates templates (sock) with points, lines, dimensions, and constraints. |
| `src/models/sketch/sketchDimension.js` | Dimension model and rendering geometry. |
| `src/models/sketch/sketchConstraint.js` | Constraint model. |
