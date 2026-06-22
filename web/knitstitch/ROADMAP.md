# Knitstitch Refactor Roadmap

Last updated: 2026-06-22

This roadmap tracks the main duplication and growth points in the Knitstitch app, with an emphasis on keeping the codebase DRY, testable, and easy to extend.

## Current Hotspots

- `src/main.js`
- `src/services/sketch/SketchService.js`
- `src/konva/SketchLayer.js`
- `src/services/ConstraintSolver.js`
- `src/state/StorePersistence.js`

## Refactor Phases

### 1. Extract UI wiring from `main.js`

Break the bootstrap file into smaller controllers:

- grid sidebar sync
- sketch sidebar sync
- overlay sidebar sync
- workspace activation wiring

Target outcome:

- `main.js` should only bootstrap the app and connect the top-level pieces.
- Event binding should be data-driven where possible.
- Repeated `if (el) el.addEventListener(...)` blocks should collapse into helper functions.

### 2. Split `SketchService` by responsibility

`SketchService.js` currently mixes:

- line creation
- dimension creation
- selection state
- constraint creation
- deletion behavior
- store synchronization

Target outcome:

- keep orchestration in `SketchService`
- move repeated mutations into helper functions
- extract tool-specific logic into smaller modules when it crosses a natural boundary

### 3. Break up `SketchLayer` rendering

`SketchLayer.js` has separate render paths for lines, points, dimensions, and constraints, but most of the work follows the same pattern.

Target outcome:

- `renderLines`
- `renderPoints`
- `renderDimensions`
- `renderConstraints`
- shared event setup helpers for Konva nodes

### 4. Consolidate persistence and display helpers

`StorePersistence.js` and `buildSketchObjects.js` both do serialization-style work and label formatting.

Target outcome:

- one schema for persisted sketch data
- one helper for sketch object labels
- one place for constraint descriptions and pivot formatting

### 5. Keep solver logic isolated

`ConstraintSolver.js` should stay pure where possible and own the geometric rules for sketch constraints.

Target outcome:

- solver functions accept sketch state and mutate only the minimum required points
- any new constraint type gets its own solver branch and tests

## Constraint and Button Expansion

The current UI has active support for:

- Select
- Line
- Dimension
- Perpendicular constraint mode
- Midpoint placeholder mode

The next steps for constraint-related controls are:

### Midpoint

- add the midpoint creation workflow in `SketchService`
- add solver support so the midpoint stays centered when endpoints move
- render midpoint constraints in the sketch object list and canvas overlay
- add unit and e2e coverage for creation, dragging, and persistence

### Future constraint buttons

These are candidate controls for later phases:

- Coincident
- Parallel
- Equal length
- Fixed angle
- Horizontal lock
- Vertical lock

Implementation rule for each new button:

- add the UI button only when there is a corresponding solver path
- keep the control disabled or hidden until the behavior is real
- add persistence and regression tests in the same change if the control becomes user-facing

## Working Rules

- Keep one mutation path per concept. Do not update the same sketch state in multiple places unless there is a strong reason.
- Extract shared geometry and formatting logic instead of duplicating it in model, service, and renderer layers.
- Prefer small pure helpers over broad utility buckets.
- If a file grows beyond about 250 to 300 lines, stop and check whether it should be split.
- Add regression tests whenever changing constraint solving, selection, drag behavior, or persistence.
- Keep `main.js` as bootstrap code, not business logic.
- Keep UI text and labels generated from shared helpers so list view and canvas view cannot drift apart.

## Suggested Execution Order

1. Extract shared UI helpers from `main.js`.
2. Factor repeated state-sync helpers in `SketchService`.
3. Split Konva render helpers in `SketchLayer`.
4. Consolidate persistence normalization.
5. Add midpoint support.
6. Add later constraint buttons only after the solver exists.

