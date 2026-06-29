# KnitStitch Roadmap

Last updated: 2026-06-29

This document tracks the current state of the KnitStitch app, what has been done, and what is next.

---

## Constraint and Button Expansion

The current UI has active support for:

- Select
- Line
- Dimension
- Perpendicular constraint mode
- Midpoint constraint mode

### Midpoint

- [x] add the midpoint creation workflow in `constraintTool.js`
- [x] add solver support in `constraintSolver.js` so the midpoint stays centred when endpoints move
- [x] render midpoint constraints in the sketch object list and canvas overlay
- [x] add unit coverage for creation and dragging
- [ ] add e2e coverage for creation and dragging

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
