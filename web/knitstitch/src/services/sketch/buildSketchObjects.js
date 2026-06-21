import { SketchObjectKind } from './constants.js';

export function buildSketchObjects(sketch, { findSharedPoint }) {
  const objects = [];

  for (const line of sketch.lines) {
    objects.push({
      kind: SketchObjectKind.Line,
      label: `Line ${line.id + 1}  (${line.start.x.toFixed(0)},${line.start.y.toFixed(0)}) -> (${line.end.x.toFixed(0)},${line.end.y.toFixed(0)})`,
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
    const names = ids.map((id) => `Line ${id + 1}`).join(' & ');
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
      const pivot = constraint.pointA ?? findSharedPoint(constraint.lineA, constraint.lineB);
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

  return objects;
}
