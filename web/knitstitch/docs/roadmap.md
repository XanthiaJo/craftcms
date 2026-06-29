# KnitStitch Roadmap

Last updated: 2026-06-29

This document tracks the current state of the KnitStitch app, what has been done, and what is next.

---

## Refactor Phases

### 1. Extract UI wiring from `main.js` — done

The UI wiring was extracted into `src/ui/mainUi.js`. `main.js` now only bootstraps the app and connects top-level pieces.

### 2. Split `sketchService` by responsibility — done

`sketchService.js` was mixing line creation, dimension creation, selection state, constraint creation, deletion, and store synchronisation. Work completed:

- `flushSketchArrays` helper extracted into `sketchStateHelpers.js` — eliminates repeated 4-line store flush
- `dimensionTool.js` — owns dimension placement, edit overlay, and driven-value application
- `constraintTool.js` — owns perpendicular constraint creation workflow
- `geometry.js` — pure helpers (`distance`, `nearestPoint`, `applyAngleSnap`) shared across services

`sketchService.js` is now a coordinator: event dispatch, line-tool drawing, selection delegation, and lifecycle.

### 3. Break up `sketchLayer` rendering — done

`_render()` was a ~250 line monolith. Two private methods now own the heavy work:

- `_renderDimensions(group, dimensions, pendingEdit)`
- `_renderConstraintIcons(group, constraints)`

`_render()` is a short orchestration loop.

### 4. Consolidate persistence and display helpers

`storePersistence.js` and `buildSketchObjects.js` both do serialisation-style work and label formatting.

Target outcome:

- one schema for persisted sketch data
- one helper for sketch object labels
- one place for constraint descriptions and pivot formatting

### 5. Keep solver logic isolated — done

`constraintSolver.js` owns the geometric rules for sketch constraints. It is in `src/services/sketch/` alongside the other sketch modules. Geometry helpers shared with the service layer live in `src/utils/geometry.js`.

---

## Constraint and Button Expansion

The current UI has active support for:

- Select
- Line
- Dimension
- Perpendicular constraint mode
- Midpoint placeholder mode (UI present, no solver)

### Midpoint

- add the midpoint creation workflow in `constraintTool.js`
- add solver support in `constraintSolver.js` so the midpoint stays centred when endpoints move
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
- keep the control disabled or hidden until the behaviour is real
- add persistence and regression tests in the same change if the control becomes user-facing

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
