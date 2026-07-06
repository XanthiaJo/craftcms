import { SketchLine } from '../../models/sketch/sketchLine.js';
import { SketchPoint } from '../../models/sketch/sketchPoint.js';
import {
  flushSketchArrays,
  rebuildSketchObjects,
} from './sketchStateHelpers.js';

/**
 * Predefined pattern templates expressed as normalized outlines.
 * Each outline is a list of points in normalized grid coordinates (0-1).
 * Points are connected in order as a closed polyline.
 */
const TEMPLATES = {
  sock: {
    id: 'sock',
    label: 'Sock',
    outline: buildSockOutline(),
  },
};

/**
 * Builds the sock template outline in normalized coordinates (0-1).
 *
 * The sock is a horizontal strip with two V-shaped notches cut into the
 * top edge and two V-shaped notches cut into the bottom edge (offset by
 * half a notch width from the top ones). This mirrors the flat one-piece
 * fold-and-seam sock shape.
 */
function buildSockOutline() {
  const margin = 0.10;
  const yMid = 0.50;
  const stripHalf = 0.30;
  const notchDepth = stripHalf * 0.72;
  const notchHalf = 0.05;

  const x0 = margin;
  const x3 = 1 - margin;
  const span = x3 - x0;
  const x1 = x0 + span * 0.33;
  const x2 = x0 + span * 0.67;

  const top = yMid - stripHalf;
  const bottom = yMid + stripHalf;

  return [
    { x: x0, y: top },                         // 0  top-left
    { x: x1 - notchHalf, y: top },             // 1  top before notch 1
    { x: x1, y: top + notchDepth },            // 2  notch 1 point (top)
    { x: x1 + notchHalf, y: top },             // 3  top after notch 1
    { x: x2 - notchHalf, y: top },             // 4  top before notch 2
    { x: x2, y: top + notchDepth },            // 5  notch 2 point (top)
    { x: x2 + notchHalf, y: top },             // 6  top after notch 2
    { x: x3, y: top },                         // 7  top-right
    { x: x3, y: bottom },                      // 8  bottom-right
    { x: x2 + notchHalf, y: bottom },          // 9  bottom after notch 2
    { x: x2, y: bottom - notchDepth },         // 10 notch 2 point (bottom)
    { x: x2 - notchHalf, y: bottom },          // 11 bottom before notch 2
    { x: x1 + notchHalf, y: bottom },          // 12 bottom after notch 1
    { x: x1, y: bottom - notchDepth },         // 13 notch 1 point (bottom)
    { x: x1 - notchHalf, y: bottom },          // 14 bottom before notch 1
    { x: x0, y: bottom },                      // 15 bottom-left
  ];
}

/**
 * Owns the template generation workflow. Given a template id, creates the
 * outline as sketch points and connected lines on the grid, scaled to the
 * current grid pixel dimensions.
 *
 * Receives the SketchService instance so it can reuse shared helpers (point
 * creation, store access, object rebuild) without duplicating them.
 */
export class TemplateTool {
  constructor(service) {
    this.service = service;
  }

  get templates() {
    return Object.values(TEMPLATES);
  }

  /**
   * Generates the named template onto the grid as sketch entities.
   * Clears any existing sketch content first so the template starts clean.
   */
  generate(templateId) {
    const template = TEMPLATES[templateId];
    if (!template) return;

    this.service._recordSnapshot(`Apply template: ${template.label}`);
    this._clearSketch();

    const gridW = this.service.store.get('gridColumns') * this.service.store.get('cellWidthPx');
    const gridH = this.service.store.get('gridRows') * this.service.store.get('cellHeightPx');

    const points = template.outline.map((np) => {
      const p = new SketchPoint(this.service._nextPointId++, np.x * gridW, np.y * gridH);
      this.service.store.state.sketch.points.push(p);
      return p;
    });

    for (let i = 0; i < points.length; i++) {
      const start = points[i];
      const end = points[(i + 1) % points.length];
      const line = new SketchLine(this.service._nextLineId++, start, end);
      this.service.store.state.sketch.lines.push(line);
    }

    flushSketchArrays(this.service);
    rebuildSketchObjects(this.service);
  }

  _clearSketch() {
    const sketch = this.service.store.state.sketch;
    sketch.lines = [];
    sketch.points = [];
    sketch.dimensions = [];
    sketch.constraints = [];
    this.service._selectedPoints.clear();
    this.service._selectedLines.clear();
  }
}
