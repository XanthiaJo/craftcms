// ConstraintSolver.js - Port of ConstraintSolver.cs
// TODO: Port perpendicular and midpoint solver logic verbatim

import { SketchConstraint } from '../../models/sketch/sketchConstraint.js';
import { nearestPoint } from '../../utils/geometry.js';

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
    this._applyPerpendicularConstraints(sketch, movedPoint, originalPosition);

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

  _applyPerpendicularConstraints(sketch, movedPoint, originalPosition = null) {
    const movedEndpointTargets = new Set();

    for (const constraint of sketch.constraints || []) {
      if (constraint?.type !== 'Perpendicular') continue;

      const anchor = constraint.pointA ?? this._findSharedPoint(constraint.lineA, constraint.lineB);
      if (!anchor) continue;

      if (movedPoint === anchor) {
        for (const line of [constraint.lineA, constraint.lineB]) {
          const otherPoint = this._otherLinePoint(line, anchor);
          if (otherPoint) movedEndpointTargets.add(otherPoint);
        }
      }
    }

    if (movedEndpointTargets.size > 0 && originalPosition) {
      const dx = movedPoint.x - originalPosition.x;
      const dy = movedPoint.y - originalPosition.y;
      if (Math.abs(dx) >= EPSILON || Math.abs(dy) >= EPSILON) {
        for (const point of movedEndpointTargets) {
          point.x += dx;
          point.y += dy;
        }
      }
    }

    for (const constraint of sketch.constraints || []) {
      if (constraint?.type !== 'Perpendicular') continue;

      const anchor = constraint.pointA ?? this._findSharedPoint(constraint.lineA, constraint.lineB);
      if (!anchor || movedPoint === anchor) continue;

      const movedLine = this._findLineUsingPoint(constraint, movedPoint);
      if (!movedLine) continue;

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

  canAddPerpendicularConstraint(sketch, lineA, lineB) {
    const anchor = this._findSharedPoint(lineA, lineB);
    if (!anchor) return false;
    if (!this._otherLinePoint(lineA, anchor) || !this._otherLinePoint(lineB, anchor)) return false;

    // Build a constraint adjacency graph from existing perpendicular constraints
    // plus the proposed new edge (lineA—lineB).
    const adjacency = new Map();
    for (const line of sketch.lines || []) {
      adjacency.set(line, new Set());
    }

    for (const constraint of sketch.constraints || []) {
      if (constraint?.type !== 'Perpendicular' || !constraint.lineA || !constraint.lineB) continue;
      if (!adjacency.has(constraint.lineA)) adjacency.set(constraint.lineA, new Set());
      if (!adjacency.has(constraint.lineB)) adjacency.set(constraint.lineB, new Set());
      adjacency.get(constraint.lineA).add(constraint.lineB);
      adjacency.get(constraint.lineB).add(constraint.lineA);
    }

    if (!adjacency.has(lineA)) adjacency.set(lineA, new Set());
    if (!adjacency.has(lineB)) adjacency.set(lineB, new Set());
    adjacency.get(lineA).add(lineB);
    adjacency.get(lineB).add(lineA);

    // Explicit duplicate check: if lineA and lineB are already directly
    // constraint-adjacent (before adding the proposed edge), reject.
    // The bipartite pass cannot catch this because a 2-cycle is bipartite.
    const existingNeighbors = new Set();
    for (const constraint of sketch.constraints || []) {
      if (constraint?.type !== 'Perpendicular') continue;
      if (constraint.lineA === lineA && constraint.lineB === lineB) return false;
      if (constraint.lineA === lineB && constraint.lineB === lineA) return false;
    }

    // 2-color the graph (bipartite check). Each connected component is
    // processed separately and tracked; a conflict means the constraint is
    // impossible.
    const parity = new Map();
    const component = new Map(); // line → component-root (first node in its BFS)
    for (const line of adjacency.keys()) {
      if (parity.has(line)) continue;
      parity.set(line, 0);
      component.set(line, line);
      const queue = [line];
      while (queue.length > 0) {
        const current = queue.shift();
        const currentParity = parity.get(current);
        for (const neighbor of adjacency.get(current) || []) {
          const nextParity = 1 - currentParity;
          if (!parity.has(neighbor)) {
            parity.set(neighbor, nextParity);
            component.set(neighbor, component.get(current));
            queue.push(neighbor);
            continue;
          }
          if (parity.get(neighbor) !== nextParity) {
            return false;
          }
        }
      }
    }

    // Second pass: within the same connected component, two lines that share a
    // sketch point and have the same parity would be forced parallel at that
    // shared corner — geometrically impossible in a closed polygon.
    //
    // Example: triangle AB—BC—CA with AB⊥BC (proposed) and BC⊥CA (existing).
    // After 2-coloring: AB=0, BC=1, CA=0 (all in same component).  AB and CA
    // share point A, have the same parity, and no direct constraint edge →
    // they would need to be parallel at A → contradiction.
    const allLines = [...adjacency.keys()];
    for (let i = 0; i < allLines.length; i++) {
      for (let j = i + 1; j < allLines.length; j++) {
        const la = allLines[i];
        const lb = allLines[j];
        if (!parity.has(la) || !parity.has(lb)) continue;
        if (component.get(la) !== component.get(lb)) continue; // different components — independent
        if (parity.get(la) !== parity.get(lb)) continue;       // different parity — fine
        if (adjacency.get(la)?.has(lb)) continue;              // direct constraint edge already checked
        if (!this._findSharedPoint(la, lb)) continue;          // not geometrically connected
        // Same component + same parity + shared point + no direct edge
        // = forced parallel at the shared corner → contradiction.
        return false;
      }
    }

    return true;
  }

  enforcePerpendicularConstraint(sketch, constraint, preferredLineToMove = null) {
    if (constraint?.type !== 'Perpendicular') return false;

    const anchor = constraint.pointA ?? this._findSharedPoint(constraint.lineA, constraint.lineB);
    if (!anchor) return false;

    const movable = this._resolveMovableLine(constraint, anchor, preferredLineToMove);
    if (!movable) return false;

    const reference = movable === constraint.lineA ? constraint.lineB : constraint.lineA;
    const movedPoint = this._otherLinePoint(movable, anchor);
    const referencePoint = this._otherLinePoint(reference, anchor);
    if (!movedPoint || !referencePoint) return false;

    const radius = Math.hypot(movedPoint.x - anchor.x, movedPoint.y - anchor.y);
    const refDx = referencePoint.x - anchor.x;
    const refDy = referencePoint.y - anchor.y;
    const refLength = Math.hypot(refDx, refDy);
    if (radius < EPSILON || refLength < EPSILON) return false;

    const ux = refDx / refLength;
    const uy = refDy / refLength;
    const currentDx = movedPoint.x - anchor.x;
    const currentDy = movedPoint.y - anchor.y;

    const candidates = [
      { x: -uy * radius, y: ux * radius },
      { x: uy * radius, y: -ux * radius },
    ];
    const chosen = candidates[0].x * currentDx + candidates[0].y * currentDy
      >= candidates[1].x * currentDx + candidates[1].y * currentDy
      ? candidates[0]
      : candidates[1];

    movedPoint.x = anchor.x + chosen.x;
    movedPoint.y = anchor.y + chosen.y;
    return true;
  }

  _findNearestPoint(points, position, snapRadius, excludePoint = null) {
    return nearestPoint(points, position, snapRadius, excludePoint);
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

  _resolveMovableLine(constraint, anchor, preferredLineToMove) {
    const candidates = [];
    if (preferredLineToMove) candidates.push(preferredLineToMove);
    candidates.push(constraint.lineB, constraint.lineA);

    for (const line of candidates) {
      if (!line) continue;
      if (line !== constraint.lineA && line !== constraint.lineB) continue;
      if (this._otherLinePoint(line, anchor)) return line;
    }
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
