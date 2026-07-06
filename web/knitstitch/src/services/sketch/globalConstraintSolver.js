// globalConstraintSolver.js
// Global numerical optimization solver for sketch constraints.
//
// Inspired by FreeCAD/OpenCASCADE: instead of applying constraints one at a
// time (the local ConstraintSolver approach), this solver minimizes the total
// constraint error across all points simultaneously using gradient descent.
//
// Error functions (squared):
//   Perpendicular: (dot product of the two line vectors at the shared anchor)^2
//   Coincident:    (distance between the two points)^2
//   Midpoint:      (distance from point to line midpoint)^2
//   Equal length:  (length(lineA) - length(lineB))^2
//
// After each gradient step, driven dimensions and coincident constraints are
// applied as hard constraints (exact enforcement), then the loop repeats until
// the error drops below tolerance or the iteration cap is reached.
//
// Anchor points (isAnchor === true) are immovable. The dragged point starts at
// the user's position but is adjustable by the solver to satisfy constraints.

const EPSILON = 1e-9;
const MAX_ITERATIONS = 100;
const ERROR_TOLERANCE = 1e-6;
const INITIAL_STEP = 5.0; // max pixels moved per iteration
const STEP_SHRINK = 0.5;
const STEP_GROW = 1.2;
const MIN_STEP = 1e-4;

export class GlobalConstraintSolver {
  /**
   * Solves all constraints simultaneously.
   *
   * @param {object} sketch - { points, lines, dimensions, constraints }
   * @param {Set} movedPoints - points directly manipulated by the user
   * @returns {number|null} iteration count on success, null if over-constrained
   */
  solve(sketch, movedPoints) {
    if (!sketch) return null;
    const points = sketch.points || [];
    const constraints = sketch.constraints || [];
    const dimensions = sketch.dimensions || [];

    const hasDriven = dimensions.some((d) => d?.isConstrained);
    if (points.length === 0 || (constraints.length === 0 && !hasDriven)) {
      return 0;
    }

    // Fixed points: anchors only.
    const fixed = new Set();
    for (const p of points) {
      if (p.isAnchor) fixed.add(p);
    }
    const free = points.filter((p) => !fixed.has(p));
    if (free.length === 0) return 0;

    // Feasibility: a single non-moved point pulled by too many driven dims
    if (!this._isFeasible(dimensions, movedPoints, fixed)) return null;

    const terms = this._buildErrorTerms(constraints);

    // Apply hard constraints to the initial state so the error reflects only
    // the soft (geometric) constraints that gradient descent must resolve.
    this._applyDrivenDimensions(dimensions, movedPoints, fixed);
    this._propagateCoincident(constraints, fixed, movedPoints);

    let step = INITIAL_STEP;
    let prevError = this._totalError(terms);

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      if (prevError < ERROR_TOLERANCE) return iter;

      const grads = this._computeGradients(terms);
      if (grads.size === 0) return iter;

      const saved = this._savePositions(free);
      this._applyGradients(free, grads, step);
      this._applyDrivenDimensions(dimensions, movedPoints, fixed);
      this._propagateCoincident(constraints, fixed, movedPoints);

      const newError = this._totalError(terms);
      if (newError < prevError) {
        step *= STEP_GROW;
        prevError = newError;
      } else {
        this._restorePositions(saved);
        step *= STEP_SHRINK;
        if (step < MIN_STEP) return iter;
      }
    }
    return MAX_ITERATIONS;
  }

  // -- Feasibility ---------------------------------------------------------

  _isFeasible(dimensions, movedPoints, fixed) {
    const drivenCount = new Map();
    for (const dim of dimensions) {
      if (!dim?.isConstrained) continue;
      const a = dim.a, b = dim.b;
      if (!a || !b) continue;

      let driven = null;
      if (movedPoints.has(a) && !movedPoints.has(b)) driven = b;
      else if (movedPoints.has(b) && !movedPoints.has(a)) driven = a;
      else if (!movedPoints.has(a) && !movedPoints.has(b)) {
        driven = fixed.has(b) ? a : b;
      }
      if (!driven || fixed.has(driven)) continue;

      drivenCount.set(driven, (drivenCount.get(driven) || 0) + 1);
    }
    for (const count of drivenCount.values()) {
      if (count > 2) return false;
    }
    return true;
  }

  // -- Error terms ---------------------------------------------------------

  _buildErrorTerms(constraints) {
    const terms = [];
    for (const c of constraints) {
      if (!c) continue;
      switch (c.type) {
        case 'Perpendicular': {
          const anchor = c.pointA ?? this._findSharedPoint(c.lineA, c.lineB);
          if (!anchor || !c.lineA || !c.lineB) continue;
          const otherA = this._otherPoint(c.lineA, anchor);
          const otherB = this._otherPoint(c.lineB, anchor);
          if (!otherA || !otherB) continue;
          terms.push({ kind: 'Perpendicular', anchor, otherA, otherB });
          break;
        }
        case 'Coincident': {
          if (!c.pointA || !c.pointB) continue;
          terms.push({ kind: 'Coincident', a: c.pointA, b: c.pointB });
          break;
        }
        case 'Midpoint': {
          if (!c.pointA || !c.lineA) continue;
          if (c.lineA.start === c.pointA || c.lineA.end === c.pointA) continue;
          terms.push({ kind: 'Midpoint', point: c.pointA, line: c.lineA });
          break;
        }
        case 'Equal': {
          if (!c.lineA || !c.lineB || c.lineA === c.lineB) continue;
          terms.push({ kind: 'Equal', lineA: c.lineA, lineB: c.lineB });
          break;
        }
      }
    }
    return terms;
  }

  _totalError(terms) {
    let total = 0;
    for (const t of terms) total += this._errorForTerm(t);
    return total;
  }

  _errorForTerm(t) {
    switch (t.kind) {
      case 'Perpendicular': {
        const ax = t.otherA.x - t.anchor.x, ay = t.otherA.y - t.anchor.y;
        const bx = t.otherB.x - t.anchor.x, by = t.otherB.y - t.anchor.y;
        const dot = ax * bx + ay * by;
        return dot * dot;
      }
      case 'Coincident': {
        const dx = t.a.x - t.b.x, dy = t.a.y - t.b.y;
        return dx * dx + dy * dy;
      }
      case 'Midpoint': {
        const mx = (t.line.start.x + t.line.end.x) / 2;
        const my = (t.line.start.y + t.line.end.y) / 2;
        const dx = t.point.x - mx, dy = t.point.y - my;
        return dx * dx + dy * dy;
      }
      case 'Equal': {
        const d = this._lineLength(t.lineA) - this._lineLength(t.lineB);
        return d * d;
      }
    }
    return 0;
  }

  // -- Gradients -----------------------------------------------------------

  _computeGradients(terms) {
    const grads = new Map();
    const acc = (p, gx, gy) => {
      if (!p) return;
      const g = grads.get(p);
      if (g) { g.x += gx; g.y += gy; }
      else grads.set(p, { x: gx, y: gy });
    };

    for (const t of terms) {
      switch (t.kind) {
        case 'Perpendicular': {
          const ax = t.otherA.x - t.anchor.x, ay = t.otherA.y - t.anchor.y;
          const bx = t.otherB.x - t.anchor.x, by = t.otherB.y - t.anchor.y;
          const dot = ax * bx + ay * by;
          const f = 2 * dot;
          acc(t.otherA, f * bx, f * by);
          acc(t.otherB, f * ax, f * ay);
          acc(t.anchor, f * (-bx - ax), f * (-by - ay));
          break;
        }
        case 'Coincident': {
          const dx = t.a.x - t.b.x, dy = t.a.y - t.b.y;
          acc(t.a, 2 * dx, 2 * dy);
          acc(t.b, -2 * dx, -2 * dy);
          break;
        }
        case 'Midpoint': {
          const mx = (t.line.start.x + t.line.end.x) / 2;
          const my = (t.line.start.y + t.line.end.y) / 2;
          const dx = t.point.x - mx, dy = t.point.y - my;
          acc(t.point, 2 * dx, 2 * dy);
          acc(t.line.start, -dx, -dy);
          acc(t.line.end, -dx, -dy);
          break;
        }
        case 'Equal': {
          const la = this._lineLength(t.lineA);
          const lb = this._lineLength(t.lineB);
          const diff = 2 * (la - lb);
          if (la > EPSILON) {
            const ux = (t.lineA.end.x - t.lineA.start.x) / la;
            const uy = (t.lineA.end.y - t.lineA.start.y) / la;
            acc(t.lineA.start, -diff * ux, -diff * uy);
            acc(t.lineA.end, diff * ux, diff * uy);
          }
          if (lb > EPSILON) {
            const ux = (t.lineB.end.x - t.lineB.start.x) / lb;
            const uy = (t.lineB.end.y - t.lineB.start.y) / lb;
            acc(t.lineB.start, diff * ux, diff * uy);
            acc(t.lineB.end, -diff * ux, -diff * uy);
          }
          break;
        }
      }
    }
    return grads;
  }

  _applyGradients(free, grads, step) {
    let maxMag = 0;
    for (const g of grads.values()) {
      const mag = Math.sqrt(g.x * g.x + g.y * g.y);
      if (mag > maxMag) maxMag = mag;
    }
    if (maxMag < EPSILON) return;

    const scale = step / maxMag;
    for (const p of free) {
      const g = grads.get(p);
      if (!g) continue;
      p.x -= scale * g.x;
      p.y -= scale * g.y;
    }
  }

  // -- Hard constraints ----------------------------------------------------

  _applyDrivenDimensions(dimensions, movedPoints, fixed) {
    for (const dim of dimensions) {
      if (!dim?.isConstrained) continue;
      const target = Number(dim.drivenValue);
      if (!Number.isFinite(target) || target <= 0) continue;

      const a = dim.a, b = dim.b;
      if (!a || !b) continue;

      let driver, driven;
      if (movedPoints.has(a) && !movedPoints.has(b)) {
        driver = a; driven = b;
      } else if (movedPoints.has(b) && !movedPoints.has(a)) {
        driver = b; driven = a;
      } else if (!movedPoints.has(a) && !movedPoints.has(b)) {
        if (fixed.has(b) && !fixed.has(a)) { driver = b; driven = a; }
        else { driver = a; driven = b; }
      } else {
        continue;
      }
      if (fixed.has(driven)) continue;

      this._setDimensionDistance(dim, driver, driven, target);
    }
  }

  _setDimensionDistance(dim, driver, driven, target) {
    const dx = driven.x - driver.x;
    const dy = driven.y - driver.y;

    if (dim.kind === 'Horizontal') {
      driven.x = driver.x + (Math.sign(dx) || 1) * target;
      driven.y = driver.y;
      return;
    }
    if (dim.kind === 'Vertical') {
      driven.x = driver.x;
      driven.y = driver.y + (Math.sign(dy) || 1) * target;
      return;
    }
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < EPSILON) {
      driven.x = driver.x + target;
      driven.y = driver.y;
      return;
    }
    driven.x = driver.x + (dx / len) * target;
    driven.y = driver.y + (dy / len) * target;
  }

  _propagateCoincident(constraints, fixed, movedPoints) {
    const adj = new Map();
    for (const c of constraints) {
      if (c?.type !== 'Coincident' || !c.pointA || !c.pointB) continue;
      if (!adj.has(c.pointA)) adj.set(c.pointA, new Set());
      if (!adj.has(c.pointB)) adj.set(c.pointB, new Set());
      adj.get(c.pointA).add(c.pointB);
      adj.get(c.pointB).add(c.pointA);
    }

    const visited = new Set();
    for (const start of adj.keys()) {
      if (visited.has(start)) continue;

      const component = [];
      const queue = [start];
      let leader = null;
      while (queue.length > 0) {
        const p = queue.shift();
        if (visited.has(p)) continue;
        visited.add(p);
        component.push(p);
        if (fixed.has(p)) leader = p;
        else if (!leader && movedPoints?.has(p)) leader = p;
        for (const partner of adj.get(p) || []) {
          if (!visited.has(partner)) queue.push(partner);
        }
      }

      if (!leader) leader = component[0];
      for (const p of component) {
        if (p === leader) continue;
        p.x = leader.x;
        p.y = leader.y;
      }
    }
  }

  // -- Utilities -----------------------------------------------------------

  _savePositions(points) {
    return points.map((p) => ({ point: p, x: p.x, y: p.y }));
  }

  _restorePositions(saved) {
    for (const s of saved) {
      s.point.x = s.x;
      s.point.y = s.y;
    }
  }

  _lineLength(line) {
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _findSharedPoint(lineA, lineB) {
    if (!lineA || !lineB) return null;
    if (lineA.start === lineB.start || lineA.start === lineB.end) return lineA.start;
    if (lineA.end === lineB.start || lineA.end === lineB.end) return lineA.end;
    return null;
  }

  _otherPoint(line, point) {
    if (!line) return null;
    if (line.start === point) return line.end;
    if (line.end === point) return line.start;
    return null;
  }
}
