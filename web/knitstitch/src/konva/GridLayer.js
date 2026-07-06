import Konva from 'konva';
import { togglePreviewCell } from '../services/gridService.js';
import { computeFilledCellsFromSketch } from '../services/sketch/closedShapeFill.js';

const FILL_COLOR = '#ca9b52';

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
      path === 'gridColumns' ||
      path === 'gridRows' ||
      path === 'cellWidthPx' ||
      path === 'cellHeightPx' ||
      path === 'previewCells' ||
      path === 'sketch.lines' ||
      path === 'sketch.isActive'
    ) {
      this._drawGrid();
    }
  }

  _drawGrid() {
    const cols = this.store.get('gridColumns');
    const rows = this.store.get('gridRows');
    const cellW = this.store.get('cellWidthPx');
    const cellH = this.store.get('cellHeightPx');
    const cells = this.store.get('previewCells');
    const w = cols * cellW;
    const h = rows * cellH;

    const sketchFilled = computeFilledCellsFromSketch(
      this.store.get('sketch.lines'),
      cols,
      rows,
      cellW,
      cellH,
    );

    this._offscreen.width = w;
    this._offscreen.height = h;
    const ctx = this._offscreen.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const isFilled = (cells[idx]?.isFilled ?? false) || sketchFilled.has(idx);
        const x = c * cellW;
        const y = r * cellH;

        ctx.fillStyle = isFilled ? FILL_COLOR : '#ffffff';
        ctx.fillRect(x, y, cellW, cellH);

        ctx.strokeStyle = '#bdbdbd';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellW, cellH);
      }
    }

    this._imageNode.width(w);
    this._imageNode.height(h);
    this.layer.batchDraw();
  }

  _onGridClick(e) {
    if (this.store.get('sketch.isActive')) {
      return;
    }
    const pos = this._imageNode.getRelativePointerPosition();
    if (!pos) return;
    const cellW = this.store.get('cellWidthPx');
    const cellH = this.store.get('cellHeightPx');
    const cols = this.store.get('gridColumns');
    const c = Math.floor(pos.x / cellW);
    const r = Math.floor(pos.y / cellH);
    const idx = r * cols + c;
    togglePreviewCell(this.store, idx);
  }
}
