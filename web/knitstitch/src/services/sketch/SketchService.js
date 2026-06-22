import { SketchPoint } from '../../models/sketch/SketchPoint.js';
import { SketchLine } from '../../models/sketch/SketchLine.js';
import { SketchColorOption } from '../../models/sketch/SketchColorOption.js';
import { SketchDimension } from '../../models/sketch/SketchDimension.js';
import { SketchConstraint } from '../../models/sketch/SketchConstraint.js';
import { ConstraintSolver } from '../ConstraintSolver.js';
import {
  ConstraintSubMode,
  SNAP_ANGLE_DEG,
  SNAP_RADIUS,
  SketchObjectKind,
  SketchTool,
} from './constants.js';
import { deleteSketchSelection } from './deleteSketchSelection.js';
import {
  assignConstraintIds as assignSketchConstraintIds,
  clearSelection as clearSketchSelection,
  findSharedPoint as findSketchSharedPoint,
  nextId as nextSketchId,
  rebuildSketchObjects as rebuildSketchObjectsInStore,
  seedIdCountersFromSketch as seedSketchIdCountersFromSketch,
  selectConstraint as selectSketchConstraint,
  selectDimension as selectSketchDimension,
  selectLine as selectSketchLine,
  selectObjectByRef as selectSketchObjectByRef,
  selectPoint as selectSketchPoint,
  setPreviewLine as setSketchPreviewLine,
  setSnapCandidate as setSketchSnapCandidate,
  syncSketchStateToStore,
} from './sketchStateHelpers.js';

export { ConstraintSubMode, SketchObjectKind, SketchTool } from './constants.js';

export class SketchService {
  constructor(store) {
    this.store = store;
    this._nextPointId = 0;
    this._nextLineId = 0;
    this._nextDimId = 0;
    this._nextConstraintId = 0;
    this._pendingStart = null;
    this._dimPendingA = null;
    this._constraintPendingLine = null;
    this._selectedPoints = new Set();
    this._selectedLines = new Set();
    this._suppressNextClick = false;
    this._constraintSolver = new ConstraintSolver();

    this.strokeColorOptions = [
      new SketchColorOption('Red', '#E63946'),
      new SketchColorOption('Orange', '#FF6B35'),
      new SketchColorOption('Yellow', '#F4C430'),
      new SketchColorOption('Green', '#2D9E4F'),
      new SketchColorOption('Teal', '#0A8A8A'),
      new SketchColorOption('Blue', '#1D70B8'),
      new SketchColorOption('Purple', '#6A3D9A'),
      new SketchColorOption('Pink', '#E75480'),
      new SketchColorOption('Black', '#1A1A1A'),
      new SketchColorOption('Dark grey', '#555555'),
      new SketchColorOption('Grey', '#999999'),
      new SketchColorOption('White', '#F5F5F5'),
    ];

    this._syncToStore();
    this._seedIdCountersFromSketch();
  }

  _syncToStore() {
    syncSketchStateToStore(this.store);
  }

  _seedIdCountersFromSketch() {
    seedSketchIdCountersFromSketch(this);
  }

  _nextId(items) {
    return nextSketchId(items);
  }

  get isActive() {
    return this.store.get('sketch.isActive');
  }

  set isActive(value) {
    this.store.set('sketch.isActive', value);
    if (!value) this.cancelCurrentLine();
  }

  get activeTool() {
    return this.store.get('sketch.activeTool');
  }

  set activeTool(value) {
    this.store.set('sketch.activeTool', value);
    this.cancelCurrentLine();
  }

  get constraintSubMode() {
    return this.store.get('sketch.constraintSubMode');
  }

  set constraintSubMode(value) {
    this.store.set('sketch.constraintSubMode', value);
  }

  get strokeColor() {
    return this.store.get('sketch.strokeColor');
  }

  set strokeColor(value) {
    this.store.set('sketch.strokeColor', value);
  }

  get strokeThickness() {
    return this.store.get('sketch.strokeThickness');
  }

  set strokeThickness(value) {
    this.store.set('sketch.strokeThickness', value);
  }

  onCanvasClick(position, modifiers = {}) {
    if (!this.isActive) return;
    if (this._suppressNextClick) {
      this._suppressNextClick = false;
      return;
    }
    switch (this.activeTool) {
      case SketchTool.Line:
        this._onLineClick(position, modifiers);
        break;
      case SketchTool.Select:
        this.clearSelection();
        break;
      case SketchTool.Dimension:
        this._onDimensionClick(position, modifiers);
        break;
      case SketchTool.Constraint:
        this._onConstraintClick(position, modifiers);
        break;
    }
  }

  onCanvasMouseMove(position, modifiers = {}) {
    if (!this.isActive) return;
    switch (this.activeTool) {
      case SketchTool.Line:
        this._onLineMouseMove(position, modifiers);
        break;
      case SketchTool.Select:
        this._onSelectMouseMove(position, modifiers);
        break;
      case SketchTool.Dimension:
        this._setSnapCandidate(this._findNearestPoint(position, modifiers.snapEnabled !== false));
        break;
      case SketchTool.Constraint:
        this._setSnapCandidate(null);
        break;
    }
  }

  onRightMouseDown() {
    if (!this.isActive) return;
    this._suppressNextClick = true;
  }

  onCanvasMouseDown(position, modifiers = {}) {
    if (!this.isActive || this.activeTool !== SketchTool.Select) return;
    this.startDrag(position, modifiers);
  }

  startDrag(position, modifiers = {}) {
    const near = this._findNearestPoint(position, modifiers.snapEnabled !== false);
    if (near) {
      this._dragPoint = near;
      this.selectPoint(near);
    } else {
      this._dragPoint = null;
    }
  }

  onCanvasMouseUp() {
    this._dragPoint = null;
  }

  _onSelectMouseMove(position, modifiers = {}) {
    if (!this._dragPoint) return;
    const originalPosition = { x: this._dragPoint.x, y: this._dragPoint.y };
    this._dragPoint.x = position.x;
    this._dragPoint.y = position.y;
    this._constraintSolver.solveConstraintsForPoint(
      this.store.state.sketch,
      this._dragPoint,
      originalPosition,
      modifiers
    );
    assignSketchConstraintIds(this);
    for (const dim of this.store.state.sketch.dimensions) dim.recompute();
    this.store.set('sketch.points', [...this.store.state.sketch.points]);
    this.store.set('sketch.dimensions', [...this.store.state.sketch.dimensions]);
    this.store.set('sketch.constraints', [...this.store.state.sketch.constraints]);
    rebuildSketchObjectsInStore(this);
  }

  get hasSelection() {
    const sketch = this.store.state.sketch;
    return this._selectedPoints.size > 0
      || this._selectedLines.size > 0
      || sketch.dimensions.some((d) => d.isSelected)
      || sketch.constraints.some((c) => c?.isSelected);
  }

  cancelCurrentLine() {
    if (this._pendingStart) {
      this._removeOrphanPoint(this._pendingStart);
      this._pendingStart = null;
    }
    if (this._dimPendingA) {
      this._removeOrphanPoint(this._dimPendingA);
      this._dimPendingA = null;
      this.clearSelection();
    }
    this._constraintPendingLine = null;
    setSketchPreviewLine(this, null);
    setSketchSnapCandidate(this, null);
    this.store.set('sketch.pendingDimEdit', null);
  }

  exitToSelect() {
    this.cancelCurrentLine();
    this.clearSelection();
    this.store.set('sketch.activeTool', SketchTool.Select);
  }

  undo() {
    const sketch = this.store.state.sketch;
    if (sketch.lines.length > 0) {
      const last = sketch.lines[sketch.lines.length - 1];
      sketch.lines.pop();
      this._removeOrphanPoint(last.start);
      this._removeOrphanPoint(last.end);
      rebuildSketchObjectsInStore(this);
      this.store.set('sketch.lines', [...sketch.lines]);
    }
    if (this._pendingStart) {
      this._removeOrphanPoint(this._pendingStart);
      this._pendingStart = null;
      setSketchPreviewLine(this, null);
      setSketchSnapCandidate(this, null);
      rebuildSketchObjectsInStore(this);
    }
  }

  clear() {
    const sketch = this.store.state.sketch;
    sketch.lines = [];
    sketch.points = [];
    sketch.dimensions = [];
    sketch.constraints = [];
    this._nextPointId = 0;
    this._nextLineId = 0;
    this._nextDimId = 0;
    this._nextConstraintId = 0;
    this._pendingStart = null;
    setSketchPreviewLine(this, null);
    setSketchSnapCandidate(this, null);
    this._selectedPoints.clear();
    this._selectedLines.clear();
    rebuildSketchObjectsInStore(this);
    this.store.set('sketch.lines', []);
    this.store.set('sketch.points', []);
    this.store.set('sketch.dimensions', []);
    this.store.set('sketch.constraints', []);
  }

  _onLineClick(position, modifiers = {}) {
    const snapEnabled = modifiers.snapEnabled !== false;
    if (!this._pendingStart) {
      this._pendingStart = this._resolveOrCreatePoint(position, snapEnabled);
      const temp = new SketchPoint(-1, position.x, position.y);
      setSketchPreviewLine(this, new SketchLine(-1, this._pendingStart, temp));
      setSketchSnapCandidate(this, null);
    } else {
      const near = this._findNearestPoint(position, snapEnabled);
      let resolved = near ? { x: near.x, y: near.y } : this._applyAngleSnap(this._pendingStart, position);
      const end = this._resolveOrCreatePoint(resolved, snapEnabled);
      this._commitLine(this._pendingStart, end);
      this._pendingStart = end;
      const temp = new SketchPoint(-1, end.x, end.y);
      setSketchPreviewLine(this, new SketchLine(-1, this._pendingStart, temp));
      setSketchSnapCandidate(this, null);
    }
  }

  _onLineMouseMove(position, modifiers = {}) {
    const snapEnabled = modifiers.snapEnabled !== false;
    if (!this._pendingStart) return;
    const near = this._findNearestPoint(position, snapEnabled);
    setSketchSnapCandidate(this, near ?? null);
    const resolved = near ? { x: near.x, y: near.y } : this._applyAngleSnap(this._pendingStart, position);
    const temp = new SketchPoint(-1, resolved.x, resolved.y);
    setSketchPreviewLine(this, new SketchLine(-1, this._pendingStart, temp));
  }

  _resolveOrCreatePoint(position, snapEnabled = true) {
    return snapEnabled
      ? this._findNearestPoint(position, true) ?? this._createPoint(position)
      : this._createPoint(position);
  }

  _findNearestPoint(position, allowSnap = true, excludePoint = null) {
    const snapRadius = allowSnap ? SNAP_RADIUS : 0.001;
    const points = this.store.state.sketch.points;
    let best = null;
    let bestDist = snapRadius;
    for (const p of points) {
      if (p === excludePoint) continue;
      const d = Math.sqrt((p.x - position.x) ** 2 + (p.y - position.y) ** 2);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  _createPoint(position) {
    const p = new SketchPoint(this._nextPointId++, position.x, position.y);
    this.store.state.sketch.points.push(p);
    this.store.set('sketch.points', [...this.store.state.sketch.points]);
    return p;
  }

  _removeOrphanPoint(point) {
    if (point.id < 0) return;
    const sketch = this.store.state.sketch;
    for (const line of sketch.lines) {
      if (line.start === point || line.end === point) return;
    }
    for (const dim of sketch.dimensions) {
      if (dim.a === point || dim.b === point) return;
    }
    for (const constraint of sketch.constraints) {
      if (constraint?.pointA === point || constraint?.pointB === point) return;
    }
    const idx = sketch.points.indexOf(point);
    if (idx >= 0) {
      sketch.points.splice(idx, 1);
      this.store.set('sketch.points', [...sketch.points]);
    }
  }

  _commitLine(start, end) {
    const line = new SketchLine(this._nextLineId++, start, end);
    this.store.state.sketch.lines.push(line);
    this.store.set('sketch.lines', [...this.store.state.sketch.lines]);
    this._rebuildObjects();
  }

  _onDimensionClick(position, modifiers = {}) {
    const snapped = this._findNearestPoint(position, modifiers.snapEnabled !== false);
    if (!snapped) return;
    const pt = snapped;

    if (!this._dimPendingA) {
      this._dimPendingA = pt;
      this.selectPoint(pt);
      setSketchSnapCandidate(this, null);
    } else {
      if (!Object.is(this._dimPendingA, pt)) {
        this._commitDimension(this._dimPendingA, pt);
      }
      this._dimPendingA = null;
      this.clearSelection();
      setSketchSnapCandidate(this, null);
    }
  }

  _onConstraintClick(position, modifiers = {}) {
    if (this.constraintSubMode !== ConstraintSubMode.Perpendicular) return;
    this._setSnapCandidate(null);
  }

  onConstraintLineClick(line, multiSelect = false) {
    if (this.activeTool !== SketchTool.Constraint || this.constraintSubMode !== ConstraintSubMode.Perpendicular) {
      this.selectLine(line, multiSelect);
      return;
    }

    if (!this._constraintPendingLine) {
      this._constraintPendingLine = line;
      this.selectLine(line);
      return;
    }

    if (this._constraintPendingLine === line) {
      this._constraintPendingLine = null;
      this.clearSelection();
      return;
    }

    const firstLine = this._constraintPendingLine;
    this._constraintPendingLine = null;
    this._tryCreatePerpendicularConstraint(firstLine, line);
  }

  _commitDimension(a, b) {
    const dim = new SketchDimension(this._nextDimId++, a, b);
    this.store.state.sketch.dimensions.push(dim);
    this.store.set('sketch.dimensions', [...this.store.state.sketch.dimensions]);
    this._rebuildObjects();
    this._openDimEdit(dim);
  }

  _openDimEdit(dim) {
    this.store.set('sketch.pendingDimEdit', {
      dimId:      dim.id,
      initialText: dim.labelText.replace(/^[^\d.]*/, ''),
      labelPos:   { ...dim.labelPos },
      onConfirm:  (value) => {
        this._applyDimConstraint(dim, value);
        this.store.set('sketch.pendingDimEdit', null);
      },
      onCancel: () => {
        const sketch = this.store.state.sketch;
        sketch.dimensions = sketch.dimensions.filter((candidate) => candidate !== dim);
        this.clearSelection();
        this.store.set('sketch.dimensions', [...sketch.dimensions]);
        this.store.set('sketch.pendingDimEdit', null);
        this._rebuildObjects();
      },
    });
  }

  _applyDimConstraint(dim, targetPx) {
    const usageA = this._countLineUsage(dim.a);
    const usageB = this._countLineUsage(dim.b);
    const free   = usageA < usageB ? dim.a : dim.b;
    const fixed  = usageA < usageB ? dim.b : dim.a;

    if (dim.kind === 'Horizontal') {
      const signX = Math.sign(free.x - fixed.x) || 1;
      free.x = fixed.x + signX * targetPx;
    } else if (dim.kind === 'Vertical') {
      const signY = Math.sign(free.y - fixed.y) || 1;
      free.y = fixed.y + signY * targetPx;
    } else {
      const dx = free.x - fixed.x;
      const dy = free.y - fixed.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len >= 0.001) {
        free.x = fixed.x + (dx / len) * targetPx;
        free.y = fixed.y + (dy / len) * targetPx;
      }
    }

    dim.setDrivenValue(targetPx);
    for (const d of this.store.state.sketch.dimensions) {
      if (!Object.is(d, dim) && (Object.is(d.a, free) || Object.is(d.b, free)))
        d.recompute();
    }
    this.store.set('sketch.dimensions', [...this.store.state.sketch.dimensions]);
    this.store.set('sketch.points', [...this.store.state.sketch.points]);
    this._rebuildObjects();
  }

  _countLineUsage(pt) {
    let count = 0;
    for (const line of this.store.state.sketch.lines)
      if (Object.is(line.start, pt) || Object.is(line.end, pt)) count++;
    return count;
  }

  _setPreviewLine(line) {
    setSketchPreviewLine(this, line);
  }

  _setSnapCandidate(point) {
    setSketchSnapCandidate(this, point);
  }

  clearSelection() {
    clearSketchSelection(this);
  }

  selectPoint(point, multiSelect = false) {
    selectSketchPoint(this, point, multiSelect);
  }

  selectLine(line, multiSelect = false) {
    selectSketchLine(this, line, multiSelect);
  }

  selectDimension(dim, multiSelect = false) {
    selectSketchDimension(this, dim, multiSelect);
  }

  selectConstraint(constraint, multiSelect = false) {
    selectSketchConstraint(this, constraint, multiSelect);
  }

  selectObjectByRef(refType, refId, multiSelect = false) {
    selectSketchObjectByRef(this, refType, refId, multiSelect);
  }

  deleteSelected() {
    const sketch = this.store.state.sketch;
    const { dimsToRemove, linesToRemove } = deleteSketchSelection({
      sketch,
      selectedLines: this._selectedLines,
      selectedPoints: this._selectedPoints,
    });

    for (const point of this._selectedPoints) {
      this._removeOrphanPoint(point);
    }
    for (const line of linesToRemove) {
      this._removeOrphanPoint(line.start);
      this._removeOrphanPoint(line.end);
    }
    for (const dim of dimsToRemove) {
      this._removeOrphanPoint(dim.a);
      this._removeOrphanPoint(dim.b);
    }

    this._selectedPoints.clear();
    this._selectedLines.clear();
    setSketchSnapCandidate(this, null);
    rebuildSketchObjectsInStore(this);

    this.store.set('sketch.lines', [...sketch.lines]);
    this.store.set('sketch.points', [...sketch.points]);
    this.store.set('sketch.dimensions', [...sketch.dimensions]);
    this.store.set('sketch.constraints', [...sketch.constraints]);
  }

  _applyAngleSnap(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angleDeg = Math.abs(Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI);
    if (angleDeg <= SNAP_ANGLE_DEG) return { x: end.x, y: start.y };
    if (angleDeg >= 90 - SNAP_ANGLE_DEG) return { x: start.x, y: end.y };
    return { x: end.x, y: end.y };
  }

  _rebuildObjects() {
    rebuildSketchObjectsInStore(this);
  }

  _findLinesForPoint(point) {
    return this.store.state.sketch.lines.filter((line) => line.start === point || line.end === point);
  }

  _tryCreatePerpendicularConstraint(firstLine, secondLine) {
    if (!firstLine || !secondLine) return false;
    if (this._findPerpendicularConstraint(firstLine, secondLine)) {
      this.selectConstraint(this._findPerpendicularConstraint(firstLine, secondLine));
      return true;
    }

    if (!this._constraintSolver.canAddPerpendicularConstraint(this.store.state.sketch, firstLine, secondLine)) {
      this.clearSelection();
      return false;
    }

    const anchor = this._findSharedPoint(firstLine, secondLine);
    if (!anchor) {
      this.clearSelection();
      return false;
    }

    const constraint = new SketchConstraint(
      'Perpendicular',
      anchor,
      null,
      firstLine,
      secondLine,
      this._nextConstraintId++
    );
    this.store.state.sketch.constraints.push(constraint);
    assignSketchConstraintIds(this);
    this._constraintSolver.enforcePerpendicularConstraint(this.store.state.sketch, constraint, secondLine);
    for (const dim of this.store.state.sketch.dimensions) dim.recompute();
    this.selectConstraint(constraint);
    this.store.set('sketch.points', [...this.store.state.sketch.points]);
    this.store.set('sketch.dimensions', [...this.store.state.sketch.dimensions]);
    this.store.set('sketch.constraints', [...this.store.state.sketch.constraints]);
    rebuildSketchObjectsInStore(this);
    return true;
  }

  _assignConstraintIds() {
    assignSketchConstraintIds(this);
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

  _findSharedPoint(lineA, lineB) {
    return findSketchSharedPoint(lineA, lineB);
  }
}
