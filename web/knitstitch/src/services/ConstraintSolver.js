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
    this._applyPerpendicularConstraints(sketch, movedPoint);

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

  _applyPerpendicularConstraints(sketch, movedPoint) {
    for (const constraint of sketch.constraints || []) {
      if (constraint?.type !== 'Perpendicular') continue;

      const anchor = constraint.pointA ?? this._findSharedPoint(constraint.lineA, constraint.lineB);
      if (!anchor) continue;

      const movedLine = this._findLineUsingPoint(constraint, movedPoint);
      if (!movedLine) continue;

      if (movedPoint === anchor) continue;

      const referenceLine = movedLine === constraint.lineA ? constraint.lineB : constraint.lineA;
      if (!referenceLine) continue;

      const referencePoint = this._otherLinePoint(referenceLine, anchor);
      if (!referencePoint) continue;

      const distance = Math.hypot(movedPoint.x - anchor.x, movedPoint.y - anchor.y);
      if (distance < EPSILON) continue;

      const refDx = referencePoint.x - anchor.x;
      const refDy = referencePoint.y - anchor.y;
      const refLength = Math.hypot(refDx, refDy);
      if (refLength < EPSILON) continue;

      const ux = refDx / refLength;
      const uy = refDy / refLength;
      const currentDx = movedPoint.x - anchor.x;
      const currentDy = movedPoint.y - anchor.y;

      const candidates = [
        { x: -uy * distance, y: ux * distance },
        { x: uy * distance, y: -ux * distance },
      ];

      const chosen = candidates[0].x * currentDx + candidates[0].y * currentDy
        >= candidates[1].x * currentDx + candidates[1].y * currentDy
        ? candidates[0]
        : candidates[1];

      movedPoint.x = anchor.x + chosen.x;
      movedPoint.y = anchor.y + chosen.y;
    }
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

  _findLineUsingPoint(constraint, point) {
    if (this._lineUsesPoint(constraint.lineA, point)) return constraint.lineA;
    if (this._lineUsesPoint(constraint.lineB, point)) return constraint.lineB;
    return null;
  }

  _lineUsesPoint(line, point) {
    return !!line && (line.start === point || line.end === point);
  }

  _otherLinePoint(line, point) {
    if (!line) return null;
    if (line.start === point) return line.end;
    if (line.end === point) return line.start;
    return null;
  }

  _findSharedPoint(lineA, lineB) {
    if (!lineA || !lineB) return null;
    if (lineA.start === lineB.start || lineA.start === lineB.end) return lineA.start;
    if (lineA.end === lineB.start || lineA.end === lineB.end) return lineA.end;
    return null;
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
