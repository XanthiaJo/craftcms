# KnitStitch Agent Notes

This file contains the app-specific guidance for the KnitStitch Grid page.
Use it together with the repository root [AGENT.md](</E:/Coding Projects/craftcms/AGENT.md>), not instead of it.

## Scope

Applies to work under:

- [web/knitstitch/](</E:/Coding Projects/craftcms/web/knitstitch/>)
- [web/dist/](</E:/Coding Projects/craftcms/web/dist/>)
- [templates/knitstitch.twig](</E:/Coding Projects/craftcms/templates/knitstitch.twig>)

## Product Model

KnitStitch Grid is a Konva.js web conversion of the original KnitStichGrid WPF desktop app. It is served inside the Craft CMS site as a self-contained front-end app.

- URL: `/knitstitch`
- Template: [templates/knitstitch.twig](</E:/Coding Projects/craftcms/templates/knitstitch.twig>)
- Source project: [web/knitstitch/](</E:/Coding Projects/craftcms/web/knitstitch/>)
- Built assets consumed by Craft:
  - [web/dist/main.js](</E:/Coding Projects/craftcms/web/dist/main.js>)
  - [web/dist/main.css](</E:/Coding Projects/craftcms/web/dist/main.css>)

## Architecture

Primary source layout:

- [src/main.js](</E:/Coding Projects/craftcms/web/knitstitch/src/main.js>) - bootstrap and stage init
- [src/ui/mainUi.js](</E:/Coding Projects/craftcms/web/knitstitch/src/ui/mainUi.js>) - sidebar wiring and store subscriptions
- [src/konva/](</E:/Coding Projects/craftcms/web/knitstitch/src/konva/>) - stage and render layers
- [src/models/](</E:/Coding Projects/craftcms/web/knitstitch/src/models/>) - sketch/grid data models
- [src/services/](</E:/Coding Projects/craftcms/web/knitstitch/src/services/>) - grid sizing and finished size calculation
- [src/services/sketch/](</E:/Coding Projects/craftcms/web/knitstitch/src/services/sketch/>) - all sketch logic: service, solver, helpers, constants, deletion
- [src/state/store.js](</E:/Coding Projects/craftcms/web/knitstitch/src/state/store.js>) - reactive store
- [src/utils/geometry.js](</E:/Coding Projects/craftcms/web/knitstitch/src/utils/geometry.js>) - pure geometry helpers (distance, nearestPoint, applyAngleSnap)
- [tests/](</E:/Coding Projects/craftcms/web/knitstitch/tests/>) - Vitest and Playwright coverage
- [docs/](</E:/Coding Projects/craftcms/web/knitstitch/docs/>) - project map, roadmap, tests map

## DRY Rules

For KnitStitch work, prefer these rules before adding logic:

- keep tool constants and object-kind constants centralized
- move sketch-specific helpers into `src/services/sketch/` instead of growing `sketchService.js`
- extract pure projection logic and graph/deletion logic into standalone modules before splitting event-flow code
- avoid repeating store sync sequences; when a mutation path repeats, prefer a shared helper
- avoid duplicating geometry helpers like nearest-point lookup, shared-point lookup, and angle snap

The current direction is:

- `sketchService.js` acts as the coordinator
- extracted helpers under `src/services/sketch/` own pure or policy-heavy logic
- `constraintSolver.js` owns geometric enforcement, not UI selection flow
- `dimensionTool.js` owns the dimension lifecycle (placement, edit overlay, driven-value application)
- `constraintTool.js` owns the constraint creation workflow (line selection, feasibility check, commit)
- pure geometry helpers (`distance`, `nearestPoint`, `applyAngleSnap`) live in `src/utils/geometry.js`

## Sketch Interaction Model

The sketch behavior should follow the mental model of Fusion 360 sketching as closely as is practical in this app.

That means:

- sketch entities are persistent geometric objects, not temporary drawing strokes
- constraints are relationships between entities and should immediately affect geometry when applied
- dimensions are driving constraints when confirmed, not passive labels
- selecting sketch entities should feel entity-based first: point, line, dimension label, constraint marker
- deleting a constrained entity should cascade to dependent constraints or dimensions where required
- impossible constraints should be rejected rather than stored in a broken state

For perpendicular constraints specifically:

- they are line-to-line constraints, not point constraints
- creation should mirror CAD behavior: choose one line, then the second line
- when the constraint is accepted, the geometry should move immediately so the relation is true
- the feasibility check matters; constraint graphs that cannot be satisfied should be rejected on creation

If behavior is ambiguous, prefer Fusion 360 style sketch semantics over lightweight drawing-app semantics.

## Workspace Model

The page has three workspaces:

- Grid
- Sketch
- Overlay

The Sketch workspace is the one governed by the Fusion-style rules above.

## Rendering Notes

- `GridLayer` uses an off-screen canvas promoted into a `Konva.Image`
- `SketchLayer` redraws sketch shapes from store state
- `OverlayLayer` handles reference image display
- stage layer order is grid -> overlay -> sketch

## Testing Rules

Run from [web/knitstitch/](</E:/Coding Projects/craftcms/web/knitstitch/>):

```bash
npm test
npm run test:e2e
npm run build
```

Testing expectations:

- use Vitest for geometry, state, solver, deletion, and store rules
- use Playwright for canvas interaction, pointer behavior, and end-to-end UI workflows
- when Konva hit-testing is flaky in headless browser runs, it is acceptable for Playwright to activate the real tool via UI and then use `window.__knitstitchSketchService` or `window.__knitstitchStore` for the final state-driving step

## Local Artifacts

Keep these untracked:

- `coverage/`
- `test-results/`
- `vite.config.js.timestamp-*.mjs`
- `web/dist/` (built by `npm run build` and generated during deploy)

