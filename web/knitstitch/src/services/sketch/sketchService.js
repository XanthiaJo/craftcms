import { STROKE_COLOR_OPTIONS } from './styleOptions.js';
import { ConstraintSolver } from './constraintSolver.js';
import { DimensionTool } from './dimensionTool.js';
import { ConstraintTool } from './constraintTool.js';
import { LineTool } from './lineTool.js';
import { TemplateTool } from './templateTool.js';
import { HistoryManager } from './historyManager.js';
import { nearestPoint } from '../../utils/geometry.js';
import { restoreSketchSnapshot } from './sketchSnapshot.js';
import {
  ConstraintSubMode,
  SNAP_RADIUS,
  SketchObjectKind,
  SketchTool,
} from './constants.js';
import { deleteSketchSelection } from './deleteSketchSelection.js';
import {
  assignConstraintIds as assignSketchConstraintIds,
  clearSelection as clearSketchSelection,
  findSharedPoint as findSketchSharedPoint,
  flushSketchArrays as flushSketchArraysInStore,
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
    this._dimPendingA = null;
    this._constraintPendingLine = null;
    this._selectedPoints = new Set();
    this._selectedLines = new Set();
    this._suppressNextClick = false;
    this._constraintSolver = new ConstraintSolver();
    this._dimensionTool = new DimensionTool(this);
    this._constraintTool = new ConstraintTool(this);
    this._lineTool = new LineTool(this);
    this._templateTool = new TemplateTool(this);
    this._history = new HistoryManager(this);

    this.strokeColorOptions = STROKE_COLOR_OPTIONS;

    this._syncToStore();
    this._seedIdCountersFromSketch();
  }

  _syncToStore() {
    syncSketchStateToStore(this.store);
  }

  _seedIdCountersFromSketch() {
    seedSketchIdCountersFromSketch(this);
  }

  _recordSnapshot(description) {
    this._history.record(description);
  }

  _nextId(items) {
    return nextSketchId(items);
  }

  get _pendingStart() {
    return this._lineTool.pendingStart;
  }

  set _pendingStart(value) {
    this._lineTool.pendingStart = value;
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
        this._lineTool.onLineClick(position, modifiers);
        break;
      case SketchTool.Select:
        this.clearSelection();
        break;
      case SketchTool.Dimension:
        this._dimensionTool.onDimensionClick(position, modifiers);
        break;
      case SketchTool.Constraint:
        this._constraintTool.onConstraintClick(position, modifiers);
        break;
    }
  }

  onLineClick(line, position, modifiers = {}) {
    if (!this.isActive) return;
    const multiSelect = modifiers.multiSelect ?? false;
    if (this.activeTool === SketchTool.Select) {
      this.selectLine(line, multiSelect);
      return;
    }
    if (this.activeTool === SketchTool.Constraint) {
      this._constraintTool.onConstraintLineClick(line, multiSelect, position);
      return;
    }
    this.onCanvasClick(position, modifiers);
  }

  onPointClick(pt, position, modifiers = {}) {
    if (!this.isActive) return;
    const multiSelect = modifiers.multiSelect ?? false;
    if (this.activeTool === SketchTool.Select) {
      this.selectPoint(pt, multiSelect);
      return;
    }
    if (this.activeTool === SketchTool.Constraint) {
      this._constraintTool.onConstraintPointClick(pt, multiSelect, position);
      return;
    }
    this.onCanvasClick(position ?? { x: pt.x, y: pt.y }, modifiers);
  }

  onCanvasMouseMove(position, modifiers = {}) {
    if (!this.isActive) return;
    switch (this.activeTool) {
      case SketchTool.Line:
        this._lineTool.onLineMouseMove(position, modifiers);
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
      this._history.beginDrag();
    } else {
      this._dragPoint = null;
      this._history.cancelDrag();
    }
  }

  onCanvasMouseUp() {
    this._history.endDrag();
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
    flushSketchArraysInStore(this);
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
    this._lineTool.cancel();
    if (this._dimPendingA) {
      this._removeOrphanPoint(this._dimPendingA);
      this._dimPendingA = null;
      this.clearSelection();
    }
    this._constraintPendingLine = null;
    this.store.set('sketch.pendingDimEdit', null);
  }

  exitToSelect() {
    this.cancelCurrentLine();
    this.clearSelection();
    this.store.set('sketch.activeTool', SketchTool.Select);
  }

  undo() {
    // If there is an in-progress drag, complete it without recording it, then
    // continue with the next undo.
    this._dragPoint = null;
    this._history.cancelDrag();

    const action = this._history.pop();
    if (action) {
      restoreSketchSnapshot(action.snapshot, this);
      return;
    }

    // Fallback for empty history: cancel an in-progress line.
    const sketch = this.store.state.sketch;
    if (this._pendingStart) {
      this._removeOrphanPoint(this._pendingStart);
      this._pendingStart = null;
      setSketchPreviewLine(this, null);
      setSketchSnapCandidate(this, null);
      rebuildSketchObjectsInStore(this);
    } else if (sketch.lines.length > 0) {
      const last = sketch.lines[sketch.lines.length - 1];
      sketch.lines.pop();
      this._removeOrphanPoint(last.start);
      this._removeOrphanPoint(last.end);
      rebuildSketchObjectsInStore(this);
      this.store.set('sketch.lines', [...sketch.lines]);
    }
  }

  clear() {
    this._recordSnapshot('Clear sketch');
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

  _findNearestPoint(position, allowSnap = true, excludePoint = null) {
    const snapRadius = allowSnap ? SNAP_RADIUS : 0.001;
    return nearestPoint(this.store.state.sketch.points, position, snapRadius, excludePoint);
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

  onConstraintLineClick(line, multiSelect = false, position = null) {
    this._constraintTool.onConstraintLineClick(line, multiSelect, position);
  }

  onConstraintPointClick(point, multiSelect = false, position = null) {
    this._constraintTool.onConstraintPointClick(point, multiSelect, position);
  }

  // Proxies so sketchLayer and tests can call these without knowing the sub-tool classes
  _openDimEdit(dim) {
    this._dimensionTool.openDimEdit(dim);
  }

  _applyDimConstraint(dim, targetPx) {
    this._dimensionTool._applyDimConstraint(dim, targetPx);
  }

  _tryCreatePerpendicularConstraint(lineA, lineB, position = null) {
    return this._constraintTool._tryCreatePerpendicularConstraint(lineA, lineB, position);
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
    if (!this.hasSelection) return;
    this._recordSnapshot('Delete selection');
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
    flushSketchArraysInStore(this);
  }

  _applyAngleSnap(start, end) {
    return applyAngleSnap(start, end, SNAP_ANGLE_DEG);
  }

  _rebuildObjects() {
    rebuildSketchObjectsInStore(this);
  }

  _findLinesForPoint(point) {
    return this.store.state.sketch.lines.filter((line) => line.start === point || line.end === point);
  }

  _findSharedPoint(lineA, lineB) {
    return findSketchSharedPoint(lineA, lineB);
  }

  get templates() {
    return this._templateTool.templates;
  }

  applyTemplate(templateId) {
    this._templateTool.generate(templateId);
  }

  regenerateTemplate(measurements) {
    this._templateTool.regenerate(measurements);
  }
}
