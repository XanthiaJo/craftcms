import Konva from 'konva';
import { toggleCell } from '../services/gridService.js';
import { computeFilledCellsFromSketch } from '../services/sketch/closedShapeFill.js';

const FILL_COLOR = '#ca9b52';
const GRID_PADDING = 2; // extra cells rendered beyond viewport edges

export class GridLayer {
  constructor(store) {
    this.store = store;
    this.layer = new Konva.Layer({ name: 'gridLayer' });
    this._offscreen = document.createElement('canvas');
    this._imageNode = new Konva.Image({
      image: this._offscreen,
      listening: true,
    });
    this._imageNode.on('click tap', (e) => this._onGridClick(e));
    this._imageNode.on('mouseenter', () => {
      document.body.style.cursor = 'pointer';
    });
    this._imageNode.on('mouseleave', () => {
      document.body.style.cursor = 'default';
    });
    this.layer.add(this._imageNode);
    this._unsubscribe = store.subscribe((path) => this._onStoreChange(path));
    this._drawGrid();
  }

  mount(stage) {
    stage.add(this.layer);
    this.layer.batchDraw();
  }

  destroy() {
    this._unsubscribe();
    this.layer.destroy();
  }

  _onStoreChange(path) {
    if (
      path === 'cellWidthPx' ||
      path === 'cellHeightPx' ||
      path === 'filledCells' ||
      path === 'sketch.lines' ||
      path === 'sketch.isActive' ||
      path === 'zoomLevel' ||
      path === 'panOffsetX' ||
      path === 'panOffsetY'
    ) {
      this._drawGrid();
    }
  }

  /**
   * Returns the stage dimensions, falling back to the offscreen canvas
   * dimensions if the stage is not yet mounted.
   */
  _getViewportSize() {
    const stage = this.layer.getStage();
    if (stage) {
      return { width: stage.width(), height: stage.height() };
    }
    return { width: 800, height: 600 };
  }

  /**
   * Calculates which cells are visible in the current viewport (accounting
   * for zoom and pan) and returns the cell range to render.
   */
  _getVisibleCellRange(cellW, cellH) {
    const zoom = this.store.get('zoomLevel') || 1;
    const panX = this.store.get('panOffsetX') || 0;
    const panY = this.store.get('panOffsetY') || 0;
    const { width, height } = this._getViewportSize();

    // Convert screen-space viewport corners to content-space cell indices
    const contentLeft = (-panX) / zoom;
    const contentTop = (-panY) / zoom;
    const contentRight = (width - panX) / zoom;
    const contentBottom = (height - panY) / zoom;

    const minCol = Math.floor(contentLeft / cellW) - GRID_PADDING;
    const maxCol = Math.ceil(contentRight / cellW) + GRID_PADDING;
    const minRow = Math.floor(contentTop / cellH) - GRID_PADDING;
    const maxRow = Math.ceil(contentBottom / cellH) + GRID_PADDING;

    return { minCol, maxCol, minRow, maxRow };
  }

  _drawGrid() {
    const cellW = this.store.get('cellWidthPx');
    const cellH = this.store.get('cellHeightPx');
    const filledCells = this.store.get('filledCells');

    const sketchFilled = computeFilledCellsFromSketch(
      this.store.get('sketch.lines'),
      cellW,
      cellH,
    );

    const { minCol, maxCol, minRow, maxRow } = this._getVisibleCellRange(cellW, cellH);
    const cols = maxCol - minCol + 1;
    const rows = maxRow - minRow + 1;

    if (cols <= 0 || rows <= 0) return;

    const w = cols * cellW;
    const h = rows * cellH;
    const offsetX = minCol * cellW;
    const offsetY = minRow * cellH;

    this._offscreen.width = w;
    this._offscreen.height = h;
    const ctx = this._offscreen.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const key = `${r},${c}`;
        const isFilled = filledCells.has(key) || sketchFilled.has(key);
        const x = (c - minCol) * cellW;
        const y = (r - minRow) * cellH;

        ctx.fillStyle = isFilled ? FILL_COLOR : '#ffffff';
        ctx.fillRect(x, y, cellW, cellH);

        ctx.strokeStyle = '#bdbdbd';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellW, cellH);
      }
    }

    this._imageNode.width(w);
    this._imageNode.height(h);
    this._imageNode.x(offsetX);
    this._imageNode.y(offsetY);
    this.layer.batchDraw();
  }

  _onGridClick(e) {
    if (this.store.get('sketch.isActive')) {
      return;
    }
    if (e.evt && e.evt.button !== 0) {
      return;
    }
    const stage = this.layer.getStage();
    if (!stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    const cellW = this.store.get('cellWidthPx');
    const cellH = this.store.get('cellHeightPx');
    const c = Math.floor(pos.x / cellW);
    const r = Math.floor(pos.y / cellH);
    toggleCell(this.store, r, c);
  }
}
