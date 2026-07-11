import { describe, it, expect } from 'vitest';
import { Store } from '../../../web/knitstitch/src/state/store.js';
import { SketchService, SketchTool } from '../../../web/knitstitch/src/services/sketch/sketchService.js';
import { ConstraintSubMode } from '../../../web/knitstitch/src/services/sketch/constants.js';
import { ConstraintSolver } from '../../../web/knitstitch/src/services/sketch/solver/constraintSolver.js';
import { SketchPoint } from '../../../web/knitstitch/src/models/sketch/sketchPoint.js';
import { SketchLine } from '../../../web/knitstitch/src/models/sketch/sketchLine.js';
import { SketchConstraint } from '../../../web/knitstitch/src/models/sketch/sketchConstraint.js';

function makeSolver() {
  return new ConstraintSolver();
}

function makeSketch() {
  const a = new SketchPoint(0, 0, 0);
  const b = new SketchPoint(1, 100, 0);
  const c = new SketchPoint(2, 50, 50);
  const line = new SketchLine(0, a, b);
  return { points: [a, b, c], lines: [line], constraints: [], dimensions: [] };
}

describe('ConstraintSolver midpoint support', () => {
  it('enforces a midpoint constraint by moving the point to the line centre', () => {
    const solver = makeSolver();
    const sketch = makeSketch();
    const [a, b, c] = sketch.points;
    const constraint = new SketchConstraint('Midpoint', c, null, sketch.lines[0], null, 0);
    sketch.constraints.push(constraint);

    solver.enforceMidpointConstraint(sketch, constraint);

    expect(c.x).toBe(50);
    expect(c.y).toBe(0);
    expect(a.x).toBe(0);
    expect(b.x).toBe(100);
  });

  it('moves the midpoint point when a line endpoint is dragged', () => {
    const solver = makeSolver();
    const sketch = makeSketch();
    const [a, b, c] = sketch.points;
    const constraint = new SketchConstraint('Midpoint', c, null, sketch.lines[0], null, 0);
    sketch.constraints.push(constraint);
    solver.enforceMidpointConstraint(sketch, constraint);
    expect(c.x).toBe(50);

    const original = { x: a.x, y: a.y };
    a.x = 50;
    solver.solveConstraintsForPoint(sketch, a, original);

    expect(c.x).toBe(75);
    expect(c.y).toBe(0);
  });

  it('moves the line endpoints when the midpoint point is dragged', () => {
    const solver = makeSolver();
    const sketch = makeSketch();
    const [a, b, c] = sketch.points;
    const constraint = new SketchConstraint('Midpoint', c, null, sketch.lines[0], null, 0);
    sketch.constraints.push(constraint);
    solver.enforceMidpointConstraint(sketch, constraint);

    const original = { x: c.x, y: c.y };
    c.y = 30;
    solver.solveConstraintsForPoint(sketch, c, original);

    expect(a.y).toBe(30);
    expect(b.y).toBe(30);
    expect(c.x).toBe(50);
  });
});

describe('ConstraintTool midpoint creation', () => {
  it('creates a midpoint constraint through line-then-point clicks', () => {
    const store = new Store();
    store.set('sketch.isActive', true);
    const service = new SketchService(store);
    service.activeTool = SketchTool.Line;

    service.onCanvasClick({ x: 0, y: 0 });
    service.onCanvasClick({ x: 100, y: 0 });
    service.onCanvasClick({ x: 100, y: 100 });

    const line = store.state.sketch.lines[0];
    const point = store.state.sketch.points[2];

    service.activeTool = SketchTool.Constraint;
    service.constraintSubMode = ConstraintSubMode.Midpoint;

    service.onConstraintLineClick(line);
    expect(service._constraintPendingLine).toBe(line);

    service.onConstraintPointClick(point);
    expect(store.state.sketch.constraints).toHaveLength(1);
    expect(store.state.sketch.constraints[0].type).toBe('Midpoint');
    expect(point.x).toBe(50);
    expect(point.y).toBe(0);
  });

  it('rejects a midpoint constraint on an endpoint of the same line', () => {
    const store = new Store();
    store.set('sketch.isActive', true);
    const service = new SketchService(store);
    service.activeTool = SketchTool.Line;

    service.onCanvasClick({ x: 0, y: 0 });
    service.onCanvasClick({ x: 100, y: 0 });

    const line = store.state.sketch.lines[0];
    const endpoint = line.start;

    service.activeTool = SketchTool.Constraint;
    service.constraintSubMode = ConstraintSubMode.Midpoint;

    service.onConstraintLineClick(line);
    service.onConstraintPointClick(endpoint);

    expect(store.state.sketch.constraints).toHaveLength(0);
    expect(store.state.sketch.cursorMessage?.text).toBe('Midpoint cannot be an endpoint of the same line');
  });
});
