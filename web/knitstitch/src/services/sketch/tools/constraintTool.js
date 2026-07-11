import { SketchConstraint } from '../../../models/sketch/sketchConstraint.js';
import { ConstraintSubMode } from '../constants.js';
import { wouldOverconstrain } from '../solver/dofAnalyzer.js';
import {
  assignConstraintIds,
  findSharedPoint,
  flushSketchArrays,
  rebuildSketchObjects,
  showCursorMessage,
} from '../state/sketchStateHelpers.js';

/**
 * Owns the perpendicular and midpoint constraint creation workflows.
 *
 * Receives the SketchService instance so it can call shared helpers
 * (selectLine, clearSelection, store access) without duplicating them.
 */
export class ConstraintTool {
  constructor(service) {
    this.service = service;
  }

  get store() { return this.service.store; }

  onConstraintClick(/* position, modifiers */) {
    // Canvas click in constraint mode — nothing to do for perpendicular
    // (line clicks are handled via onConstraintLineClick from the layer)
  }

  onConstraintLineClick(line, multiSelect = false, position = null) {
    const { activeTool, constraintSubMode } = this.service;
    if (activeTool !== 'Constraint') {
      this.service.selectLine(line, multiSelect);
      return;
    }

    if (constraintSubMode === ConstraintSubMode.Midpoint) {
      this._onMidpointLineClick(line, position);
      return;
    }

    if (constraintSubMode === ConstraintSubMode.Perpendicular
      || constraintSubMode === ConstraintSubMode.Equal) {
      this._onLinePairConstraintClick(line, constraintSubMode, position);
      return;
    }

    if (constraintSubMode === ConstraintSubMode.HorizontalVertical) {
      this._tryCreateAxisConstraint(line, position);
      return;
    }

    this.service.selectLine(line, multiSelect);
  }

  _onMidpointLineClick(line, position = null) {
    if (!this.service._constraintPendingLine) {
      this.service._constraintPendingLine = line;
      this.service.selectLine(line);
      return;
    }

    if (this.service._constraintPendingLine === line) {
      this.service._constraintPendingLine = null;
      this.service.clearSelection();
      return;
    }

    // In midpoint mode the second pick is a point, not a line.
    showCursorMessage(this.service, 'Select a point for the midpoint', position);
  }

  _onLinePairConstraintClick(line, subMode, position = null) {
    if (!this.service._constraintPendingLine) {
      this.service._constraintPendingLine = line;
      this.service.selectLine(line);
      return;
    }

    if (this.service._constraintPendingLine === line) {
      this.service._constraintPendingLine = null;
      this.service.clearSelection();
      if (subMode === ConstraintSubMode.Equal) {
        showCursorMessage(this.service, 'Cannot constrain a line to itself', position);
      }
      return;
    }

    const firstLine = this.service._constraintPendingLine;
    this.service._constraintPendingLine = null;
    if (subMode === ConstraintSubMode.Perpendicular) {
      this._tryCreatePerpendicularConstraint(firstLine, line, position);
    } else if (subMode === ConstraintSubMode.Equal) {
      this._tryCreateEqualConstraint(firstLine, line, position);
    }
  }

  onConstraintPointClick(point, multiSelect = false, position = null) {
    const { activeTool, constraintSubMode } = this.service;
    if (activeTool !== 'Constraint') {
      this.service.selectPoint(point, multiSelect);
      return;
    }

    if (constraintSubMode === ConstraintSubMode.Midpoint) {
      if (!this.service._constraintPendingLine) {
        showCursorMessage(this.service, 'Select a line first', position);
        return;
      }

      const line = this.service._constraintPendingLine;
      this.service._constraintPendingLine = null;
      this._tryCreateMidpointConstraint(line, point, position);
      return;
    }

    this.service.selectPoint(point, multiSelect);
  }

  _tryCreatePerpendicularConstraint(firstLine, secondLine, position = null) {
    if (!firstLine || !secondLine) return false;

    const existing = this._findPerpendicularConstraint(firstLine, secondLine);
    if (existing) {
      this.service.selectConstraint(existing);
      return true;
    }

    if (!this.service._constraintSolver.canAddPerpendicularConstraint(
      this.store.state.sketch, firstLine, secondLine
    )) {
      this.service.clearSelection();
      showCursorMessage(this.service, 'Constraint not possible', position);
      return false;
    }

    const anchor = findSharedPoint(firstLine, secondLine);
    if (!anchor) {
      this.service.clearSelection();
      showCursorMessage(this.service, 'Constraint not possible', position);
      return false;
    }

    const overcheck = wouldOverconstrain(this.store.state.sketch, {
      type: 'Perpendicular',
      lineA: firstLine,
      lineB: secondLine,
    });
    if (overcheck.wouldOverconstrain) {
      this.service.clearSelection();
      showCursorMessage(this.service, 'Over-constrained: this would remove too many degrees of freedom', position);
      return false;
    }

    this.service._recordSnapshot('Add perpendicular constraint');
    const constraint = new SketchConstraint(
      'Perpendicular',
      anchor,
      null,
      firstLine,
      secondLine,
      this.service._nextConstraintId++
    );
    this.store.state.sketch.constraints.push(constraint);
    assignConstraintIds(this.service);
    this.service._constraintSolver.enforcePerpendicularConstraint(
      this.store.state.sketch, constraint, secondLine
    );
    this.service._reconvergeConstraints();
    for (const dim of this.store.state.sketch.dimensions) dim.recompute();
    this.service.selectConstraint(constraint);
    flushSketchArrays(this.service);
    rebuildSketchObjects(this.service);
    return true;
  }

  _tryCreateMidpointConstraint(line, point, position = null) {
    if (!line || !point) return false;

    if (line.start === point || line.end === point) {
      this.service.clearSelection();
      showCursorMessage(this.service, 'Midpoint cannot be an endpoint of the same line', position);
      return false;
    }

    const existing = this._findMidpointConstraint(line, point);
    if (existing) {
      this.service.selectConstraint(existing);
      return true;
    }

    const overcheck = wouldOverconstrain(this.store.state.sketch, {
      type: 'Midpoint',
      pointA: point,
      lineA: line,
    });
    if (overcheck.wouldOverconstrain) {
      this.service.clearSelection();
      showCursorMessage(this.service, 'Over-constrained: this would remove too many degrees of freedom', position);
      return false;
    }

    this.service._recordSnapshot('Add midpoint constraint');
    const constraint = new SketchConstraint(
      'Midpoint',
      point,
      null,
      line,
      null,
      this.service._nextConstraintId++
    );
    this.store.state.sketch.constraints.push(constraint);
    assignConstraintIds(this.service);
    this.service._constraintSolver.enforceMidpointConstraint(
      this.store.state.sketch, constraint
    );
    this.service._reconvergeConstraints();
    for (const dim of this.store.state.sketch.dimensions) dim.recompute();
    this.service.selectConstraint(constraint);
    flushSketchArrays(this.service);
    rebuildSketchObjects(this.service);
    return true;
  }

  _findPerpendicularConstraint(lineA, lineB) {
    return this.store.state.sketch.constraints.find((constraint) => {
      if (constraint?.type !== 'Perpendicular') return false;
      return (
        (constraint.lineA === lineA && constraint.lineB === lineB)
        || (constraint.lineA === lineB && constraint.lineB === lineA)
      );
    }) ?? null;
  }

  _tryCreateEqualConstraint(firstLine, secondLine, position = null) {
    if (!firstLine || !secondLine) return false;
    if (firstLine === secondLine) {
      this.service.clearSelection();
      showCursorMessage(this.service, 'Cannot constrain a line to itself', position);
      return false;
    }

    const existing = this._findEqualConstraint(firstLine, secondLine);
    if (existing) {
      this.service.selectConstraint(existing);
      return true;
    }

    const overcheck = wouldOverconstrain(this.store.state.sketch, {
      type: 'Equal',
      lineA: firstLine,
      lineB: secondLine,
    });
    if (overcheck.wouldOverconstrain) {
      this.service.clearSelection();
      showCursorMessage(this.service, 'Over-constrained: this would remove too many degrees of freedom', position);
      return false;
    }

    this.service._recordSnapshot('Add equal constraint');
    const constraint = new SketchConstraint(
      'Equal',
      null,
      null,
      firstLine,
      secondLine,
      this.service._nextConstraintId++
    );
    this.store.state.sketch.constraints.push(constraint);
    assignConstraintIds(this.service);
    this.service._constraintSolver.enforceEqualConstraint(
      this.store.state.sketch, constraint, secondLine
    );
    this.service._reconvergeConstraints();
    for (const dim of this.store.state.sketch.dimensions) dim.recompute();
    this.service.selectConstraint(constraint);
    flushSketchArrays(this.service);
    rebuildSketchObjects(this.service);
    return true;
  }

  _tryCreateAxisConstraint(line, position = null) {
    if (!line) return false;

    // Auto-detect: if the line is closer to horizontal, apply Horizontal;
    // otherwise apply Vertical. This mirrors Fusion 360's H/V constraint.
    const dx = Math.abs(line.end.x - line.start.x);
    const dy = Math.abs(line.end.y - line.start.y);
    const type = dx >= dy ? 'Horizontal' : 'Vertical';

    const existing = this._findAxisConstraint(line, type);
    if (existing) {
      this.service.selectConstraint(existing);
      return true;
    }

    const overcheck = wouldOverconstrain(this.store.state.sketch, {
      type,
      lineA: line,
    });
    if (overcheck.wouldOverconstrain) {
      this.service.clearSelection();
      showCursorMessage(this.service, 'Over-constrained: this would remove too many degrees of freedom', position);
      return false;
    }

    this.service._recordSnapshot(`Add ${type.toLowerCase()} constraint`);
    const constraint = new SketchConstraint(
      type,
      null,
      null,
      line,
      null,
      this.service._nextConstraintId++
    );
    this.store.state.sketch.constraints.push(constraint);
    assignConstraintIds(this.service);
    if (type === 'Horizontal') {
      this.service._constraintSolver.enforceHorizontalConstraint(
        this.store.state.sketch, constraint
      );
    } else {
      this.service._constraintSolver.enforceVerticalConstraint(
        this.store.state.sketch, constraint
      );
    }
    this.service._reconvergeConstraints();
    for (const dim of this.store.state.sketch.dimensions) dim.recompute();
    this.service.selectConstraint(constraint);
    flushSketchArrays(this.service);
    rebuildSketchObjects(this.service);
    return true;
  }

  _findAxisConstraint(line, type) {
    return this.store.state.sketch.constraints.find((constraint) => {
      if (constraint?.type !== type) return false;
      return constraint.lineA === line;
    }) ?? null;
  }

  _findEqualConstraint(lineA, lineB) {
    return this.store.state.sketch.constraints.find((constraint) => {
      if (constraint?.type !== 'Equal') return false;
      return (
        (constraint.lineA === lineA && constraint.lineB === lineB)
        || (constraint.lineA === lineB && constraint.lineB === lineA)
      );
    }) ?? null;
  }

  _findMidpointConstraint(line, point) {
    return this.store.state.sketch.constraints.find((constraint) => {
      if (constraint?.type !== 'Midpoint') return false;
      return constraint.lineA === line && constraint.pointA === point;
    }) ?? null;
  }
}
