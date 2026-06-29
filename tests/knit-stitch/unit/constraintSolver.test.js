import { describe, it, expect, beforeEach } from 'vitest';
import { ConstraintSolver } from '../../../web/knitstitch/src/services/sketch/constraintSolver.js';

// ---------------------------------------------------------------------------
// Minimal sketch-object helpers — mirrors the shape used in production but
// without pulling in the full model classes or Konva.
// ---------------------------------------------------------------------------

function makePoint(x, y) {
  return { x, y };
}

function makeLine(start, end) {
  return { start, end };
}

function makeSketch(lines = [], constraints = []) {
  return { points: [], lines, dimensions: [], constraints };
}

function makePerpendicularConstraint(lineA, lineB, anchor) {
  return { type: 'Perpendicular', lineA, lineB, lineC: null, pointA: anchor, pointB: null };
}

// ---------------------------------------------------------------------------
// canAddPerpendicularConstraint
// ---------------------------------------------------------------------------

describe('ConstraintSolver.canAddPerpendicularConstraint', () => {
  let solver;

  beforeEach(() => {
    solver = new ConstraintSolver();
  });

  it('allows the first perpendicular constraint on two sharing lines', () => {
    // Two lines sharing a corner: A—B and B—C
    const A = makePoint(0, 0);
    const B = makePoint(100, 0);
    const C = makePoint(100, 100);

    const AB = makeLine(A, B);
    const BC = makeLine(B, C);

    const sketch = makeSketch([AB, BC]);

    expect(solver.canAddPerpendicularConstraint(sketch, AB, BC)).toBe(true);
  });

  it('rejects a constraint between lines that do not share a point', () => {
    const A = makePoint(0, 0);
    const B = makePoint(100, 0);
    const C = makePoint(0, 100);
    const D = makePoint(100, 100);

    const AB = makeLine(A, B);
    const CD = makeLine(C, D);

    const sketch = makeSketch([AB, CD]);

    expect(solver.canAddPerpendicularConstraint(sketch, AB, CD)).toBe(false);
  });

  it('rejects a duplicate perpendicular constraint on the same pair', () => {
    const A = makePoint(0, 0);
    const B = makePoint(100, 0);
    const C = makePoint(100, 100);

    const AB = makeLine(A, B);
    const BC = makeLine(B, C);

    const existing = makePerpendicularConstraint(AB, BC, B);
    const sketch = makeSketch([AB, BC], [existing]);

    // Same pair again — bipartite check catches this (odd cycle of length 2)
    expect(solver.canAddPerpendicularConstraint(sketch, AB, BC)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Triangle over-constraint — this is the scenario from the bug report.
  //
  // A triangle has three vertices and three lines.  Adding two perpendicular
  // constraints on different pairs of lines in the same triangle is
  // geometrically impossible: two 90° angles inside a triangle would require
  // the third angle to be 0°.
  //
  // The bipartite-graph check alone does NOT catch this because the two
  // constraint pairs form a path (A—B—C), not an odd cycle.  The solver must
  // also detect that two perpendicular constraints share the same anchor point
  // and collectively exhaust both lines meeting at that anchor.
  // -------------------------------------------------------------------------

  describe('triangle over-constraint', () => {
    let A, B, C, AB, BC, CA;

    beforeEach(() => {
      //   A
      //  / \
      // B---C
      A = makePoint(50, 0);
      B = makePoint(0, 100);
      C = makePoint(100, 100);

      AB = makeLine(A, B);
      BC = makeLine(B, C);
      CA = makeLine(C, A);
    });

    it('allows the first perpendicular constraint (AB ⊥ BC, anchor B)', () => {
      const sketch = makeSketch([AB, BC, CA]);
      expect(solver.canAddPerpendicularConstraint(sketch, AB, BC)).toBe(true);
    });

    it('rejects a second perpendicular constraint sharing the same anchor (BC ⊥ CA, anchor C)', () => {
      // AB⊥BC already committed at anchor B; now attempting BC⊥CA at anchor C.
      // Both constraints involve BC.  With AB⊥BC, BC is already forced to a
      // direction — adding BC⊥CA would require CA to be perpendicular to BC,
      // making AB∥CA, which closes the triangle only if A = B (impossible).
      const existing = makePerpendicularConstraint(AB, BC, B);
      const sketch = makeSketch([AB, BC, CA], [existing]);

      expect(solver.canAddPerpendicularConstraint(sketch, BC, CA)).toBe(false);
    });

    it('rejects a second perpendicular constraint on the remaining pair (AB ⊥ CA, anchor A)', () => {
      // AB⊥BC already committed; now attempting AB⊥CA at anchor A.
      // Same triangle, different corner — still geometrically impossible.
      const existing = makePerpendicularConstraint(AB, BC, B);
      const sketch = makeSketch([AB, BC, CA], [existing]);

      expect(solver.canAddPerpendicularConstraint(sketch, AB, CA)).toBe(false);
    });

    it('allows a second perpendicular constraint on two lines that do NOT share a line with the first', () => {
      // Quad (four points, four lines).  AB⊥BC at B; then CD⊥DA at D.
      // These are independent pairs — no shared line — so both are possible.
      const D = makePoint(150, 0);
      const CD = makeLine(C, D);
      const DA = makeLine(D, A);

      const existing = makePerpendicularConstraint(AB, BC, B);
      const sketch = makeSketch([AB, BC, CD, DA], [existing]);

      expect(solver.canAddPerpendicularConstraint(sketch, CD, DA)).toBe(true);
    });
  });
});
