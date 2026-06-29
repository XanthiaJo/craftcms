// AppStage.js - Stage + layer composition + event wiring

import Konva from 'konva';
import { GridLayer } from './gridLayer.js';
import { OverlayLayer } from './overlayLayer.js';
import { SketchLayer } from './sketchLayer.js';

export class AppStage {
  constructor(containerId, store, sketchService) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`AppStage: container #${containerId} not found`);
    }

    this.store = store;
    this._resizeObserver = null;

    this.stage = new Konva.Stage({
      container: this.container,
      width: 1,
      height: 1,
    });

    this.gridLayer = new GridLayer(store);
    this.overlayLayer = new OverlayLayer(store);
    this.sketchLayer = new SketchLayer(store, sketchService);

    this.gridLayer.mount(this.stage);
    this.overlayLayer.mount(this.stage);
    this.sketchLayer.mount(this.stage);

    // Z-index: grid (0), overlay (1), sketch (2)
    this.gridLayer.layer.zIndex(0);
    this.overlayLayer.layer.zIndex(1);
    this.sketchLayer.layer.zIndex(2);

    this._fitStageToGrid();
    this._setupResizeObserver();

    // Re-fit when grid dimensions change
    this._unsubscribe = store.subscribe((path) => {
      if (
        path === 'gridColumns' ||
        path === 'gridRows' ||
        path === 'cellWidthPx' ||
        path === 'cellHeightPx'
      ) {
        this._fitStageToGrid();
      }
    });
  }

  _fitStageToGrid() {
    const cols = this.store.get('gridColumns');
    const rows = this.store.get('gridRows');
    const cellW = this.store.get('cellWidthPx');
    const cellH = this.store.get('cellHeightPx');
    const w = cols * cellW;
    const h = rows * cellH;
    this.stage.width(w);
    this.stage.height(h);
    this.stage.batchDraw();
  }

  _setupResizeObserver() {
    const parent = this.container.parentElement;
    if (!parent || !window.ResizeObserver) return;

    this._resizeObserver = new ResizeObserver(() => {
      // Stage size tracks the grid, not the container
      // Container scrolling is handled by CSS overflow:auto
    });
    this._resizeObserver.observe(parent);
  }

  destroy() {
    this._unsubscribe();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    this.gridLayer.destroy();
    this.overlayLayer.destroy();
    this.sketchLayer.destroy();
    this.stage.destroy();
  }
}
