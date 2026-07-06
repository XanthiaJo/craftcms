# KnitStitch Roadmap

Last updated: 2026-07-06 (sketchLayer refactor: click dispatch + Set lookup)

This document tracks the current state of the KnitStitch app, what has been done, and what is next.

---

## Constraint and Button Expansion

The current UI has active support for:

- Select
- Line
- Dimension
- Perpendicular constraint mode
- Midpoint constraint mode
- Equal length constraint mode

### Midpoint

- [x] add the midpoint creation workflow in `constraintTool.js`
- [x] add solver support in `constraintSolver.js` so the midpoint stays centred when endpoints move
- [x] render midpoint constraints in the sketch object list and canvas overlay
- [x] add unit coverage for creation and dragging
- [ ] add e2e coverage for creation and dragging

### Equal length

- [x] add the equal length creation workflow in `constraintTool.js`
- [x] add solver support in `constraintSolver.js` so constrained lines stay the same length
- [x] render equal constraints in the sketch object list and canvas overlay
- [x] add unit coverage for creation, dragging, and undo
- [ ] add e2e coverage for creation and dragging

### Future constraint buttons

These are candidate controls for later phases:

- Coincident
- Parallel
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

---

## Templates

Predefined pattern templates are generated onto the grid as sketch lines via `templateTool.js`.

Current templates:

- [x] Sock — flat one-piece fold-and-seam sock outline with two top notches and two bottom notches

### Template rules

- templates generate sketch entities (points + lines) so they can be selected, moved, and constrained like hand-drawn geometry
- template outlines are defined in normalized grid coordinates (0-1) and scaled to current grid pixel dimensions at generation time
- generating a template clears existing sketch content first so the template starts clean
- new templates belong in `templateTool.js` (outline definition + generation), not in `sketchService.js`

---

## Measurement-Driven Templates — Plan of Action

Goal: add a measurements panel under the template panel in the righthand sidebar. The user enters sock measurements (foot circumference, foot length, leg height, ease, ribbing length), the template lines auto-resolve to those measurements in real stitch/row counts, and the grid grows to fit the template when needed.

### Why phases are ordered this way

The current sock template uses **normalized coordinates (0-1)** that stretch to fill whatever grid size exists. To make it measurement-driven, the template must be defined in **stitch/row units** (the natural knitting units), which means the grid often needs to be much larger than the viewport (e.g. 60 stitches x 250 rows for an adult sock). Without zoom/pan that larger grid is unusable, so viewport improvements must come first. The measurement model must replace the normalized model before the measurements panel can drive it. Grid auto-resize depends on the measurement model knowing how big the template is. The measurements panel is the last, user-facing layer on top of all three.

The app already has the right mapping for stitch/row units: `cellWidthPx = stitchesPer4Inches` and `cellHeightPx = rowsPer4Inches`, so 1 cell = 1 stitch wide x 1 row tall. A measurement-driven template defines its outline in stitch/row coordinates, then multiplies by cell size to get pixel coordinates.

### Phase 1 — Grid zoom and pan  *(prerequisite for everything else)*

Without zoom, any grid larger than the viewport is unusable. This phase makes the grid viewable and navigable at any size.

- [x] add zoom state to the store (`zoomLevel`, `panOffsetX`, `panOffsetY`)
- [x] add zoom controls to the UI (zoom in, zoom out, fit-to-screen, reset/100%) — floating bubble top-left of canvas
- [x] apply Konva stage `scale` and `position` from the zoom state in `appStage.js`
- [x] support mouse-wheel zoom (zoom toward cursor position)
- [x] support drag-to-pan (middle-mouse drag)
- [x] make `sketchLayer` pointer math account for stage scale/position (using `getRelativePointerPosition()`)
- [x] make `gridLayer` click math account for stage scale/position (already used `getRelativePointerPosition()`)
- [x] persist zoom level (not pan offset — pan is transient)
- [ ] add unit tests for zoom/pan coordinate transforms
- [ ] add e2e test for zoom controls changing the stage scale

**Files touched:** `store.js`, `appStage.js`, `gridLayer.js`, `sketchLayer.js`, `mainUi.js`, `knitstitch.twig`, `app.css`, `storePersistence.js`

### Phase 2 — Measurement-driven template model

Replaces the normalized (0-1) coordinate system with a real measurement model. The sock template becomes defined in stitch/row units derived from gauge + body measurements.

- [ ] create `src/services/sketch/sockMeasurements.js` — pure functions that convert gauge + body measurements into stitch/row counts (port the math from the reference sock-template.html: `commonWidthSts`, `sectionCRows`, `sectionBRows`, `legRows`, `ribRows`, `notchDepthSts`, `notchRowsEachSide`)
- [ ] add measurement state to the store (`sketch.templateMeasurements` — foot circumference, foot length, leg height, ease %, ribbing length, plus the active template id)
- [ ] redefine the sock template in `templateTool.js` to build its outline from stitch/row counts instead of normalized coordinates
- [ ] template generation converts stitch/row coordinates to pixel coordinates by multiplying by `cellWidthPx` / `cellHeightPx`
- [ ] template generation computes its required grid size (min cols = total stitches, min rows = total rows including ribbing)
- [ ] add unit tests for `sockMeasurements.js` (gauge conversion, ease, roundEven, section math, notch derivation)
- [ ] add unit tests for measurement-driven template generation (correct pixel positions, correct line count, required grid size)

**Sock measurement math** (from the reference, adapted to the app's per-4-inch gauge):

```
stitchPerInch = stitchesPer4Inches / 4
rowPerInch    = rowsPer4Inches / 4
easeFactor    = 1 - easePct / 100
fittedCirc    = footCirc * easeFactor
flatWidthIn   = fittedCirc / 2
widthSts      = roundEven(flatWidthIn * stitchPerInch)
legRows       = max(1, round(legHeight * rowPerInch))
sectionCRows  = max(1, round(footLen * rowPerInch))
sectionBRows  = max(1, sectionCRows - legRows)    // C = A + B
ribRows       = max(0, round(ribLen * rowPerInch))
notchDepthSts = max(2, round(widthSts / 4))
notchRowsEach = notchDepthSts
```

**Files touched:** `templateTool.js` (new), `sockMeasurements.js` (new), `store.js`, `storePersistence.js`

### Phase 3 — Grid auto-resize to fit template

When a template is applied or measurements change, grow the grid if the template needs more columns or rows than currently available.

- [ ] add a `ensureGridFits(store, minCols, minRows)` helper in `gridService.js` — grows `gridColumns` / `gridRows` if needed, calls `rebuildPreviewCells`, never shrinks below the current size
- [ ] call `ensureGridFits` from `templateTool.generate()` after computing the required grid size
- [ ] call `ensureGridFits` when measurements change and the template is regenerated
- [ ] add a "fit grid to template" button that shrinks the grid to exactly the template size (optional — user may want extra margin)
- [ ] add unit tests for `ensureGridFits` (grow when needed, no-op when big enough, preview cells preserved)

**Files touched:** `gridService.js`, `templateTool.js`

### Phase 4 — Measurements panel UI

The user-facing layer. Adds the measurements group box under the template panel in the righthand sidebar.

- [ ] add a "Measurements" group box in `panel-templates` in `knitstitch.twig`, below the template selection buttons
- [ ] input fields for: foot circumference, foot length, leg height, negative ease %, ribbing length (units: inches, since the app uses per-4-inch gauge)
- [ ] read-only derived-value display: width (sts), ribbing (rows), section A (rows), notch (rows), section B (rows), section C (rows) — updates live as inputs change
- [ ] on input change: update measurement state in the store, recompute derived values, regenerate the active template, auto-resize the grid
- [ ] gauge display: show the current gauge (stitches/rows per 4 inches) so the user knows what's being used; link or note that gauge is edited in the Grid panel
- [ ] only show measurement fields relevant to the active template (sock fields for sock, etc.)
- [ ] add e2e test: enter measurements, verify template lines appear at the right pixel positions, verify grid grew

**Files touched:** `knitstitch.twig`, `mainUi.js`, `app.css`

### Phase 5 — Persistence and polish

- [ ] persist `sketch.templateMeasurements` and active template id in `storePersistence.js`
- [ ] on hydrate, if a template was active, regenerate it from persisted measurements
- [ ] add undo/redo support for measurement changes (each measurement change records a snapshot before regenerating)
- [ ] add a "clear template" button that removes the template lines and resets measurements to defaults
- [ ] add unit tests for measurement persistence round-trip

**Files touched:** `storePersistence.js`, `templateTool.js`, `sketchService.js`, `knitstitch.twig`, `mainUi.js`

### Future template candidates

After the measurement-driven model is in place, adding new templates follows the same pattern:

- Mitten — thumb gusset outline
- Hat — brim + crown shaping
- Sleeve — tapered outline with cuff
- Sweater body — raglan or set-in sleeve outline

Each needs: a measurements model (`<name>Measurements.js`), an outline builder in `templateTool.js`, measurement fields in the sidebar, and unit tests.

---

## SketchLayer Refactor Plan

`sketchLayer.js` has grown to ~550 lines and mixes Konva rendering, DOM overlay management, tool-dispatch logic, and hard-coded colours. The following refactor items are ordered by impact and effort.

### 1. Extract DOM overlays into `sketchOverlay.js`

`_showDimEditOverlay`, `_hideDimEditOverlay`, `_showCursorMessage`, `_hideCursorMessage` (~110 lines) build floating DOM elements with inline HTML/CSS. They have no dependency on the Konva layer — only the stage container and zoom/pan values. Extracting them into a `SketchOverlay` class makes them testable in isolation and drops ~110 lines from `sketchLayer.js`.

- [x] create `src/konva/sketchOverlay.js` with `showDimEdit`, `hideDimEdit`, `showCursorMessage`, `hideCursorMessage`, `destroy`
- [x] compose `SketchOverlay` in `SketchLayer` and delegate
- [x] reconcile overlay inline styles with the existing `#dim-edit-overlay` CSS classes in `app.css`
- [x] extract shared `_toScreen` and `_getCanvasRect` helpers (also closes item #7)

### 2. Move hard-coded colours into `styleOptions.js`

The renderer is littered with magic colours (`#0078D7`, `#2D9E4F`, `#1D70B8`, `#2A2A2A`, `#444`, `#888`, `#808080`, `#B22222`) that don't live in the shared style module. Centralizing them in `styleOptions.js` alongside the existing stroke colours makes theming consistent and DRYs up the renderer.

- [x] add selection, dimension, constraint, preview, witness, label, and error colour constants to `styleOptions.js`
- [x] replace all hard-coded colours in `sketchLayer.js` with the constants
- [x] use the site CSS palette (`--primary`, `--primary-dark`, `--body`, `--body-light`, `--body-dark`, `--color-pair-rust-text`) instead of the old blue/green scheme

### 3. Replace constraint-icon methods with a registry

`_renderPerpendicularIcon`, `_renderMidpointIcon`, `_renderEqualIcon` (~120 lines) each compute an anchor, build a `Konva.Group`, attach the same `selectConstraint` click handler, and add to the parent group. A registry pattern collapses `_renderConstraintIcons` into a lookup and makes adding a new constraint icon a one-function addition.

- [x] create `src/konva/constraintIcons.js` with a renderer function per constraint type and a shared click-handler helper
- [x] replace the three methods in `sketchLayer.js` with a registry lookup

### 4. Extract dimension rendering into `dimensionRenderer.js`

`_renderDimensions` (~84 lines) is self-contained Konva construction — witness lines, dim line, arrowheads, label group, handlers. Moving it to a pure function `renderDimensions(group, dimensions, pendingEdit, service)` parallels the constraint-icon extraction and leaves `_render` as a thin orchestrator.

- [x] create `src/konva/dimensionRenderer.js`
- [x] replace `_renderDimensions` in `sketchLayer.js` with a call to the extracted function

### 5. Extract line/point click-dispatch into `sketchService`

The click handlers built inside the `_render` loop embed tool-dispatch logic (`if activeTool === 'Select'`, `if activeTool === 'Constraint' && subMode === 'Perpendicular'`) that belongs in the coordinator, not the renderer. Single `service.onLineClick(line, position, modifiers)` and `service.onPointClick(pt, position, modifiers)` methods would move that branching into `sketchService` alongside the existing `onCanvasClick` dispatch.

- [x] add `onLineClick` and `onPointClick` to `SketchService`
- [x] simplify the renderer click handlers to forward events
- [x] fix latent bug: Equal constraint line clicks now route through `onConstraintLineClick` (was falling through to empty-space click)

### 6. Replace `_onStoreChange` path chain with a Set

The 13-clause `if`-chain in `_onStoreChange` is a maintenance annoyance. A `Set` of trigger paths is shorter and easier to extend.

- [x] replace the `if`-chain with a `RENDER_TRIGGERS` Set lookup

### 7. De-duplicate the canvas-rect + zoom/pan projection

Both `_showDimEditOverlay` and `_showCursorMessage` repeat the same "get canvas rect, multiply by zoom, add pan" projection. Extract a `_toScreen(point)` helper (or fold it into `sketchOverlay.js` if #1 is done first).

- [x] extract shared screen-projection helper (done in `sketchOverlay.js` as `_toScreen` + `_getCanvasRect`)
