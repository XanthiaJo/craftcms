import { SketchLine } from '../../models/sketch/sketchLine.js';
import { SketchPoint } from '../../models/sketch/sketchPoint.js';
import { SketchDimension } from '../../models/sketch/sketchDimension.js';
import {
  flushSketchArrays,
  rebuildSketchObjects,
} from './sketchStateHelpers.js';
import {
  DEFAULT_SOCK_MEASUREMENTS,
  buildSockOutlineInInches,
} from './sockMeasurements.js';

/**
 * Template registry. Each template defines:
 * - id, label
 * - defaultMeasurements: the default body measurements for this template
 * - buildOutline(gauge, measurements): returns { outline, sections, minCols, minRows }
 *   where outline is an array of {x, y} in INCH coordinates,
 *   sections is { width, topRib, backLeg, heel, sole, toe, instep, bottomRib } in inches,
 *   and minCols/minRows are the grid size needed (in stitch/row units).
 */
const TEMPLATES = {
  sock: {
    id: 'sock',
    label: 'Sock',
    defaultMeasurements: { ...DEFAULT_SOCK_MEASUREMENTS },
    buildOutline(gauge, measurements) {
      return buildSockOutlineInInches(gauge, measurements);
    },
  },
};

const INCH_SUFFIX = ' in';

/**
 * Owns the template generation workflow. Given a template id, creates the
 * outline as sketch points and connected lines on the grid, using true inch
 * measurements converted to pixels via the gauge.
 *
 * The template geometry is defined in inches (real-world measurements), not
 * in stitch/row counts. This means changing the cell size or gauge changes
 * how many grid cells the template occupies, but the physical measurements
 * stay the same.
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
   * Returns the default measurements for a template.
   */
  getDefaultMeasurements(templateId) {
    const template = TEMPLATES[templateId];
    if (!template) return null;
    return { ...template.defaultMeasurements };
  }

  /**
   * Generates the named template onto the grid as sketch entities.
   * Clears any existing sketch content first, ensures the grid is large
   * enough, then creates points and lines from the inch-driven outline.
   */
  generate(templateId, measurements = null) {
    const template = TEMPLATES[templateId];
    if (!template) return;

    const store = this.service.store;
    const gauge = {
      stitchesPer4Inches: store.get('stitchesPer4Inches'),
      rowsPer4Inches: store.get('rowsPer4Inches'),
    };
    const m = measurements ?? store.get('templateMeasurements') ?? template.defaultMeasurements;

    // Store the active template + measurements so re-generation is possible
    store.set('activeTemplateId', templateId);
    store.set('templateMeasurements', { ...m });

    const { outline, sections } = template.buildOutline(gauge, m);

    this.service._recordSnapshot(`Apply template: ${template.label}`);
    this._clearSketch();

    const cellW = store.get('cellWidthPx');
    const cellH = store.get('cellHeightPx');

    // Convert inches to pixels using gauge:
    //   pxX = inches × stitchesPerInch × cellWidthPx
    //   pxY = inches × rowsPerInch × cellHeightPx
    const stitchPerInch = gauge.stitchesPer4Inches / 4;
    const rowPerInch = gauge.rowsPer4Inches / 4;
    const pxPerInchX = stitchPerInch * cellW;
    const pxPerInchY = rowPerInch * cellH;

    const points = outline.map((pt) => {
      const p = new SketchPoint(
        this.service._nextPointId++,
        pt.x * pxPerInchX,
        pt.y * pxPerInchY,
      );
      store.state.sketch.points.push(p);
      return p;
    });

    for (let i = 0; i < points.length; i++) {
      const start = points[i];
      const end = points[(i + 1) % points.length];
      const line = new SketchLine(this.service._nextLineId++, start, end);
      store.state.sketch.lines.push(line);
    }

    // Add driving dimensions showing inch values
    this._addSockDimensions(points, sections, pxPerInchX, pxPerInchY);

    flushSketchArrays(this.service);
    rebuildSketchObjects(this.service);
  }

  /**
   * Regenerates the currently active template using updated measurements.
   * Called when the user edits measurement inputs.
   */
  regenerate(measurements) {
    const templateId = this.service.store.get('activeTemplateId');
    if (!templateId) return;
    this.generate(templateId, measurements);
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

  /**
   * Creates driving dimensions for the sock template:
   * - 1 horizontal width dimension across the top
   * - 7 vertical section dimensions on the left edge
   *
   * All dimensions show inch values (with " in" suffix) and have driven pixel
   * values set so the lock icon appears.
   *
   * Outline point indices (see buildSockOutlineInInches):
   *   Left edge:  0(top) 1(end rib) 2(end leg) 3(heel) 4(end heel) 5(end sole)
   *               6(toe) 7(end toe) 8(end instep) 9(bottom)
   *   Right edge: 19(top) 18(end rib) 17(end leg) 16(heel) 15(end heel)
   *               14(end sole) 13(toe) 12(end toe) 11(end instep) 10(bottom)
   *
   * @param {SketchPoint[]} points - pixel-coordinate sketch points
   * @param {object} sections - { width, topRib, backLeg, heel, sole, toe, instep, bottomRib } in inches
   * @param {number} pxPerInchX - pixels per inch horizontally
   * @param {number} pxPerInchY - pixels per inch vertically
   */
  _addSockDimensions(points, sections, pxPerInchX, pxPerInchY) {
    const store = this.service.store;
    const dims = store.state.sketch.dimensions;

    const addDim = (a, b, offsetSign, inches, pxPerInch) => {
      const dim = new SketchDimension(this.service._nextDimId++, a, b, offsetSign);
      dim.setDrivenDisplay(inches * pxPerInch, inches, INCH_SUFFIX);
      dims.push(dim);
    };

    // Width (horizontal, offset above the top edge)
    addDim(points[0], points[19], -1, sections.width, pxPerInchX);

    // Section lengths (vertical, offset to the left of the left edge)
    addDim(points[0], points[1],  -1, sections.topRib,    pxPerInchY); // top ribbing
    addDim(points[1], points[2],  -1, sections.backLeg,   pxPerInchY); // back leg
    addDim(points[2], points[4],  -1, sections.heel,      pxPerInchY); // heel (skips notch point 3)
    addDim(points[4], points[5],  -1, sections.sole,      pxPerInchY); // sole
    addDim(points[5], points[7],  -1, sections.toe,       pxPerInchY); // toe (skips notch point 6)
    addDim(points[7], points[8],  -1, sections.instep,    pxPerInchY); // instep + front leg
    addDim(points[8], points[9],  -1, sections.bottomRib, pxPerInchY); // bottom ribbing
  }
}
