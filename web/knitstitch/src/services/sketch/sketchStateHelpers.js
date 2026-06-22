import { buildSketchObjects } from './buildSketchObjects.js';

export function syncSketchStateToStore(store) {
  const sketch = store.get('sketch');
  store.set('sketch.lines', sketch.lines);
  store.set('sketch.points', sketch.points);
  store.set('sketch.objects', sketch.objects);
  store.set('sketch.previewLine', sketch.previewLine);
  store.set('sketch.snapCandidate', sketch.snapCandidate);
}

export function nextId(items) {
  let maxId = -1;
  for (const item of items || []) {
    if (Number.isFinite(item?.id) && item.id > maxId) {
      maxId = item.id;
    }
  }
  return maxId + 1;
}

export function seedIdCountersFromSketch(service) {
  const sketch = service.store.get('sketch');
  service._nextPointId = nextId(sketch.points);
  service._nextLineId = nextId(sketch.lines);
  service._nextDimId = nextId(sketch.dimensions);
  service._nextConstraintId = nextId(sketch.constraints);
}

export function assignConstraintIds(service) {
  for (const constraint of service.store.state.sketch.constraints || []) {
    if (!Number.isFinite(constraint?.id)) {
      constraint.id = service._nextConstraintId++;
    }
  }
}

export function findSharedPoint(lineA, lineB) {
  if (!lineA || !lineB) return null;
  if (lineA.start === lineB.start || lineA.start === lineB.end) return lineA.start;
  if (lineA.end === lineB.start || lineA.end === lineB.end) return lineA.end;
  return null;
}

export function rebuildSketchObjects(service) {
  const sketch = service.store.state.sketch;
  assignConstraintIds(service);
  service.store.set('sketch.objects', buildSketchObjects(sketch, {
    findSharedPoint: (lineA, lineB) => findSharedPoint(lineA, lineB),
  }));
}

export function setPreviewLine(service, line) {
  service.store.set('sketch.previewLine', line);
}

export function setSnapCandidate(service, point) {
  service.store.set('sketch.snapCandidate', point);
}

export function clearSelection(service) {
  for (const p of service._selectedPoints) p.isSelected = false;
  for (const l of service._selectedLines) l.isSelected = false;
  for (const d of service.store.state.sketch.dimensions) d.isSelected = false;
  for (const c of service.store.state.sketch.constraints) {
    if (c) c.isSelected = false;
  }
  service._selectedPoints.clear();
  service._selectedLines.clear();
  rebuildSketchObjects(service);
  service.store.set('sketch.points', [...service.store.state.sketch.points]);
  service.store.set('sketch.lines', [...service.store.state.sketch.lines]);
  service.store.set('sketch.dimensions', [...service.store.state.sketch.dimensions]);
  service.store.set('sketch.constraints', [...service.store.state.sketch.constraints]);
}

export function selectPoint(service, point, multiSelect = false) {
  if (!multiSelect) clearSelection(service);
  point.isSelected = true;
  service._selectedPoints.add(point);
  rebuildSketchObjects(service);
  service.store.set('sketch.points', [...service.store.state.sketch.points]);
}

export function selectLine(service, line, multiSelect = false) {
  if (!multiSelect) clearSelection(service);
  line.isSelected = true;
  service._selectedLines.add(line);
  rebuildSketchObjects(service);
  service.store.set('sketch.lines', [...service.store.state.sketch.lines]);
}

export function selectDimension(service, dim, multiSelect = false) {
  if (!multiSelect) clearSelection(service);
  dim.isSelected = true;
  rebuildSketchObjects(service);
  service.store.set('sketch.dimensions', [...service.store.state.sketch.dimensions]);
}

export function selectConstraint(service, constraint, multiSelect = false) {
  if (!multiSelect) clearSelection(service);
  constraint.isSelected = true;
  rebuildSketchObjects(service);
  service.store.set('sketch.constraints', [...service.store.state.sketch.constraints]);
}

export function selectObjectByRef(service, refType, refId, multiSelect = false) {
  if (refType === 'line') {
    const line = service.store.state.sketch.lines.find((candidate) => candidate.id === refId);
    if (line) selectLine(service, line, multiSelect);
    return;
  }
  if (refType === 'dimension') {
    const dim = service.store.state.sketch.dimensions.find((candidate) => candidate.id === refId);
    if (dim) selectDimension(service, dim, multiSelect);
    return;
  }
  if (refType === 'constraint') {
    const constraint = service.store.state.sketch.constraints.find((candidate) => candidate.id === refId);
    if (constraint) selectConstraint(service, constraint, multiSelect);
  }
}
