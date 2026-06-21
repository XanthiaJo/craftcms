import { SketchPoint } from '../models/SketchPoint.js';
import { SketchLine } from '../models/SketchLine.js';
import { SketchColorOption } from '../models/SketchColorOption.js';
import { SketchDimension } from '../models/SketchDimension.js';
import { SketchConstraint } from '../models/SketchConstraint.js';
import { ConstraintSolver } from './ConstraintSolver.js';

const SNAP_RADIUS = 10.0;
const SNAP_ANGLE_DEG = 10.0;

export const SketchTool = {
  Select: 'Select',
  Line: 'Line',
  Dimension: 'Dimension',
  Constraint: 'Constraint'
};

export const ConstraintSubMode = {
  None: 'None',
  Perpendicular: 'Perpendicular',
  Midpoint: 'Midpoint'
};

export const SketchObjectKind = {
  Line: 'Line',
  Coincident: 'Coincident',
  Constraint: 'Constraint',
  Dimension: 'Dimension',
  Perpendicular: 'Perpendicular',
};

export class SketchService {
  constructor(store) {
    this.store = store;
    this._nextPointId = 0;
    this._nextLineId = 0;
    this._nextDimId = 0;
    this._nextConstraintId = 0;
    this._pendingStart = null;
    this._dimPendingA = null;
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
    const sketch = this.store.get('sketch');
    this.store.set('sketch.lines', sketch.lines);
    this.store.set('sketch.points', sketch.points);
    this.store.set('sketch.objects', sketch.objects);
    this.store.set('sketch.previewLine', sketch.previewLine);
    this.store.set('sketch.snapCandidate', sketch.snapCandidate);
  }

  _seedIdCountersFromSketch() {
    const sketch = this.store.get('sketch');
    this._nextPointId = this._nextId(sketch.points);
    this._nextLineId = this._nextId(sketch.lines);
    this._nextDimId = this._nextId(sketch.dimensions);
    this._nextConstraintId = this._nextId(sketch.constraints);
  }

  _nextId(items) {
    let maxId = -1;
    for (const item of items || []) {
      if (Number.isFinite(item?.id) && item.id > maxId) {
        maxId = item.id;
      }
    }
    return maxId + 1;
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
        this._setSnapCandidate(this._findNearestPoint(position, modifiers.snapEnabled !== false));
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
    this._assignConstraintIds();
    for (const dim of this.store.state.sketch.dimensions) dim.recompute();
    this.store.set('sketch.points', [...this.store.state.sketch.points]);
    this.store.set('sketch.dimensions', [...this.store.state.sketch.dimensions]);
    this.store.set('sketch.constraints', [...this.store.state.sketch.constraints]);
    this._rebuildObjects();
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
    this._setPreviewLine(null);
    this._setSnapCandidate(null);
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
      this._rebuildObjects();
      this.store.set('sketch.lines', [...sketch.lines]);
    }
    if (this._pendingStart) {
      this._removeOrphanPoint(this._pendingStart);
      this._pendingStart = null;
      this._setPreviewLine(null);
      this._setSnapCandidate(null);
      this._rebuildObjects();
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
    this._setPreviewLine(null);
    this._setSnapCandidate(null);
    this._selectedPoints.clear();
    this._selectedLines.clear();
    this._rebuildObjects();
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
      this._setPreviewLine(new SketchLine(-1, this._pendingStart, temp));
      this._setSnapCandidate(null);
    } else {
      const near = this._findNearestPoint(position, snapEnabled);
      let resolved = near ? { x: near.x, y: near.y } : this._applyAngleSnap(this._pendingStart, position);
      const end = this._resolveOrCreatePoint(resolved, snapEnabled);
      this._commitLine(this._pendingStart, end);
      this._pendingStart = end;
      const temp = new SketchPoint(-1, end.x, end.y);
      this._setPreviewLine(new SketchLine(-1, this._pendingStart, temp));
      this._setSnapCandidate(null);
    }
  }

  _onLineMouseMove(position, modifiers = {}) {
    const snapEnabled = modifiers.snapEnabled !== false;
    if (!this._pendingStart) return;
    const near = this._findNearestPoint(position, snapEnabled);
    this._setSnapCandidate(near ?? null);
    const resolved = near ? { x: near.x, y: near.y } : this._applyAngleSnap(this._pendingStart, position);
    const temp = new SketchPoint(-1, resolved.x, resolved.y);
    this._setPreviewLine(new SketchLine(-1, this._pendingStart, temp));
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
      this._setSnapCandidate(null);
    } else {
      if (!Object.is(this._dimPendingA, pt)) {
        this._commitDimension(this._dimPendingA, pt);
      }
      this._dimPendingA = null;
      this.clearSelection();
      this._setSnapCandidate(null);
    }
  }

  _onConstraintClick(position, modifiers = {}) {
    if (this.constraintSubMode !== ConstraintSubMode.Perpendicular) return;

    const point = this._findNearestPoint(position, modifiers.snapEnabled !== false);
    if (!point) return;

    const connectedLines = this._findLinesForPoint(point);
    if (connectedLines.length !== 2) return;
    if (this._findPerpendicularConstraint(connectedLines[0], connectedLines[1])) return;

    const constraint = new SketchConstraint(
      'Perpendicular',
      point,
      null,
      connectedLines[0],
      connectedLines[1],
      this._nextConstraintId++
    );
    this.store.state.sketch.constraints.push(constraint);
    this._assignConstraintIds();
    this.selectConstraint(constraint);
    this.store.set('sketch.constraints', [...this.store.state.sketch.constraints]);
    this._rebuildObjects();
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
    this.store.set('sketch.previewLine', line);
  }

  _setSnapCandidate(point) {
    this.store.set('sketch.snapCandidate', point);
  }

  clearSelection() {
    for (const p of this._selectedPoints) p.isSelected = false;
    for (const l of this._selectedLines) l.isSelected = false;
    for (const d of this.store.state.sketch.dimensions) d.isSelected = false;
    for (const c of this.store.state.sketch.constraints) {
      if (c) c.isSelected = false;
    }
    this._selectedPoints.clear();
    this._selectedLines.clear();
    this._rebuildObjects();
    this.store.set('sketch.points', [...this.store.state.sketch.points]);
    this.store.set('sketch.lines', [...this.store.state.sketch.lines]);
    this.store.set('sketch.dimensions', [...this.store.state.sketch.dimensions]);
    this.store.set('sketch.constraints', [...this.store.state.sketch.constraints]);
  }

  selectPoint(point, multiSelect = false) {
    if (!multiSelect) this.clearSelection();
    point.isSelected = true;
    this._selectedPoints.add(point);
    this._rebuildObjects();
    this.store.set('sketch.points', [...this.store.state.sketch.points]);
  }

  selectLine(line, multiSelect = false) {
    if (!multiSelect) this.clearSelection();
    line.isSelected = true;
    this._selectedLines.add(line);
    this._rebuildObjects();
    this.store.set('sketch.lines', [...this.store.state.sketch.lines]);
  }

  selectDimension(dim, multiSelect = false) {
    if (!multiSelect) this.clearSelection();
    dim.isSelected = true;
    this._rebuildObjects();
    this.store.set('sketch.dimensions', [...this.store.state.sketch.dimensions]);
  }

  selectConstraint(constraint, multiSelect = false) {
    if (!multiSelect) this.clearSelection();
    constraint.isSelected = true;
    this._rebuildObjects();
    this.store.set('sketch.constraints', [...this.store.state.sketch.constraints]);
  }

  selectObjectByRef(refType, refId, multiSelect = false) {
    if (refType === 'line') {
      const line = this.store.state.sketch.lines.find((candidate) => candidate.id === refId);
      if (line) this.selectLine(line, multiSelect);
      return;
    }
    if (refType === 'dimension') {
      const dim = this.store.state.sketch.dimensions.find((candidate) => candidate.id === refId);
      if (dim) this.selectDimension(dim, multiSelect);
      return;
    }
    if (refType === 'constraint') {
      const constraint = this.store.state.sketch.constraints.find((candidate) => candidate.id === refId);
      if (constraint) this.selectConstraint(constraint, multiSelect);
    }
  }

  deleteSelected() {
    const sketch = this.store.state.sketch;
    const removedPoints = new Set(this._selectedPoints);
    const linesToRemove = new Set(this._selectedLines);

    for (const point of this._selectedPoints) {
      for (const line of sketch.lines) {
        if (line.start === point || line.end === point) {
          linesToRemove.add(line);
        }
      }
    }

    for (const line of linesToRemove) {
      removedPoints.add(line.start);
      removedPoints.add(line.end);
    }

    const dimsToRemove = new Set();
    for (const dim of sketch.dimensions) {
      if (dim.isSelected || removedPoints.has(dim.a) || removedPoints.has(dim.b)) {
        dimsToRemove.add(dim);
        removedPoints.add(dim.a);
        removedPoints.add(dim.b);
      }
    }
    sketch.dimensions = sketch.dimensions.filter((dim) => !dimsToRemove.has(dim));

    if (sketch.constraints.length > 0) {
      sketch.constraints = sketch.constraints.filter((constraint) => {
        if (constraint?.isSelected) return false;
        const usesRemovedPoint =
          (constraint?.pointA && removedPoints.has(constraint.pointA))
          || (constraint?.pointB && removedPoints.has(constraint.pointB));
        const usesRemovedLine =
          (constraint?.lineA && linesToRemove.has(constraint.lineA))
          || (constraint?.lineB && linesToRemove.has(constraint.lineB));
        return !usesRemovedLine && !usesRemovedPoint;
      });
    }

    sketch.lines = sketch.lines.filter((line) => !linesToRemove.has(line));

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
    this._setSnapCandidate(null);
    this._rebuildObjects();

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
    const sketch = this.store.state.sketch;
    this._assignConstraintIds();
    const objects = [];
    for (const line of sketch.lines) {
      objects.push({
        kind: SketchObjectKind.Line,
        label: `Line ${line.id + 1}  (${line.start.x.toFixed(0)},${line.start.y.toFixed(0)}) → (${line.end.x.toFixed(0)},${line.end.y.toFixed(0)})`,
        refType: 'line',
        refId: line.id,
        isSelected: line.isSelected,
      });
    }
    const usage = new Map();
    for (const line of sketch.lines) {
      if (!usage.has(line.start)) usage.set(line.start, []);
      if (!usage.has(line.end)) usage.set(line.end, []);
      usage.get(line.start).push(line.id);
      usage.get(line.end).push(line.id);
    }
    for (const [pt, ids] of usage) {
      if (ids.length < 2) continue;
      const names = ids.map(id => `Line ${id + 1}`).join(' & ');
      objects.push({
        kind: SketchObjectKind.Coincident,
        label: `Coincident  ${names}  @ (${pt.x.toFixed(0)},${pt.y.toFixed(0)})`,
        refType: null,
        refId: null,
        isSelected: false,
      });
    }

    for (const constraint of sketch.constraints || []) {
      let label = constraint?.description ?? 'Constraint';
      let kind = SketchObjectKind.Constraint;
      if (constraint?.type === 'Coincident') {
        const a = constraint.pointA;
        const b = constraint.pointB;
        label = a && b
          ? `Coincident P${a.id + 1} & P${b.id + 1}  @ (${a.x.toFixed(0)},${a.y.toFixed(0)})`
          : 'Coincident';
        kind = SketchObjectKind.Coincident;
      } else if (constraint?.type === 'Perpendicular') {
        const pivot = constraint.pointA ?? this._findSharedPoint(constraint.lineA, constraint.lineB);
        label = pivot
          ? `Perpendicular L${constraint.lineA.id + 1} & L${constraint.lineB.id + 1}  @ (${pivot.x.toFixed(0)},${pivot.y.toFixed(0)})`
          : `Perpendicular L${constraint.lineA.id + 1} & L${constraint.lineB.id + 1}`;
        kind = SketchObjectKind.Perpendicular;
      }
      objects.push({
        kind,
        label,
        refType: 'constraint',
        refId: constraint.id,
        isSelected: !!constraint.isSelected,
      });
    }

    for (const dim of sketch.dimensions) {
      const kindLabel = dim.kind === 'Horizontal' ? 'H' : dim.kind === 'Vertical' ? 'V' : 'Aligned';
      objects.push({
        kind: SketchObjectKind.Dimension,
        label: `Dim ${dim.id + 1}  [${kindLabel}]  ${dim.labelText}`,
        refType: 'dimension',
        refId: dim.id,
        isSelected: dim.isSelected,
      });
    }

    this.store.set('sketch.objects', objects);
  }

  _findLinesForPoint(point) {
    return this.store.state.sketch.lines.filter((line) => line.start === point || line.end === point);
  }

  _assignConstraintIds() {
    for (const constraint of this.store.state.sketch.constraints || []) {
      if (!Number.isFinite(constraint?.id)) {
        constraint.id = this._nextConstraintId++;
      }
    }
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
    if (!lineA || !lineB) return null;
    if (lineA.start === lineB.start || lineA.start === lineB.end) return lineA.start;
    if (lineA.end === lineB.start || lineA.end === lineB.end) return lineA.end;
    return null;
  }
}
