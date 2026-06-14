// ConstraintSolver.js - Port of ConstraintSolver.cs
// TODO: Port perpendicular and midpoint solver logic verbatim

import { SketchConstraint } from '../models/SketchConstraint.js';

const EPSILON = 0.000001;
const DEFAULT_SNAP_RADIUS = 10.0;

export class ConstraintSolver {
  solveConstraintsForPoint(sketch, movedPoint, originalPosition = null, options = {}) {
    if (!sketch || !movedPoint) return;

    const snapEnabled = options.snapEnabled !== false;
    const snapRadius = options.snapRadius ?? DEFAULT_SNAP_RADIUS;

    if (snapEnabled) {
      this._snapCoincidentPoint(sketch, movedPoint, snapRadius);
    }

    this._propagateCoincidentConstraints(sketch, movedPoint);

    if (!sketch.dimensions?.length) return;

    for (const dim of sketch.dimensions) {
      if (!dim?.isConstrained) continue;
      if (dim.a !== movedPoint && dim.b !== movedPoint) continue;

      const otherPoint = dim.a === movedPoint ? dim.b : dim.a;
      this._maintainDrivenDimension(dim, movedPoint, otherPoint, originalPosition);
    }
  }

  _snapCoincidentPoint(sketch, movedPoint, snapRadius) {
    const nearest = this._findNearestPoint(sketch.points, movedPoint, snapRadius, movedPoint);
    if (!nearest) return;

    this._ensureCoincidentConstraint(sketch, movedPoint, nearest);
    movedPoint.x = nearest.x;
    movedPoint.y = nearest.y;
  }

  _propagateCoincidentConstraints(sketch, movedPoint) {
    const queue = [movedPoint];
    const visited = new Set();

    while (queue.length > 0) {
      const point = queue.shift();
      if (!point || visited.has(point)) continue;
      visited.add(point);

      for (const constraint of sketch.constraints || []) {
        if (constraint?.type !== 'Coincident') continue;
        const partner = constraint.pointA === point
          ? constraint.pointB
          : constraint.pointB === point
            ? constraint.pointA
            : null;
        if (!partner) continue;
        if (partner.x !== point.x || partner.y !== point.y) {
          partner.x = point.x;
          partner.y = point.y;
        }
        queue.push(partner);
      }
    }
  }

  _ensureCoincidentConstraint(sketch, pointA, pointB) {
    if (!sketch.constraints) sketch.constraints = [];
    for (const constraint of sketch.constraints) {
      if (constraint?.type !== 'Coincident') continue;
      const samePair =
        (constraint.pointA === pointA && constraint.pointB === pointB)
        || (constraint.pointA === pointB && constraint.pointB === pointA);
      if (samePair) return constraint;
    }

    const constraint = new SketchConstraint('Coincident', pointA, pointB);
    sketch.constraints.push(constraint);
    return constraint;
  }

  _findNearestPoint(points, position, snapRadius, excludePoint = null) {
    let best = null;
    let bestDist = snapRadius;
    for (const p of points || []) {
      if (p === excludePoint) continue;
      const d = Math.sqrt((p.x - position.x) ** 2 + (p.y - position.y) ** 2);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  _maintainDrivenDimension(dim, movedPoint, otherPoint, originalPosition) {
    const target = Number(dim.drivenValue);
    if (!Number.isFinite(target) || target <= 0) return;

    const source = originalPosition ?? movedPoint;
    const dx = otherPoint.x - source.x;
    const dy = otherPoint.y - source.y;

    if (dim.kind === 'Horizontal') {
      const signX = Math.sign(dx) || 1;
      otherPoint.x = movedPoint.x + signX * target;
      otherPoint.y = movedPoint.y;
      return;
    }

    if (dim.kind === 'Vertical') {
      const signY = Math.sign(dy) || 1;
      otherPoint.x = movedPoint.x;
      otherPoint.y = movedPoint.y + signY * target;
      return;
    }

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < EPSILON) {
      otherPoint.x = movedPoint.x + target;
      otherPoint.y = movedPoint.y;
      return;
    }

    otherPoint.x = movedPoint.x + (dx / len) * target;
    otherPoint.y = movedPoint.y + (dy / len) * target;
  }
}
