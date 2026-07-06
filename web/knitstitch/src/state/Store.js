// Store.js - Central reactive state (replaces ViewModelBase)

import { DEFAULT_STROKE_COLOR, DEFAULT_STROKE_THICKNESS } from '../services/sketch/styleOptions.js';

class Store {
  constructor() {
    this.state = {
      gridColumns: 30,
      gridRows: 30,
      cellWidthPx: 20,
      cellHeightPx: 28,
      previewCells: [],       // Array of { isFilled: bool }
      stitchesPer4Inches: 20,
      rowsPer4Inches: 28,
      finishedWidth: 0,
      finishedHeight: 0,
      overlayImageSrc: null,
      overlayOpacity: 0.5,
      overlayVisible: false,
      // Viewport zoom/pan
      zoomLevel: 1,
      panOffsetX: 0,
      panOffsetY: 0,
      // Sketch state
      sketch: {
        isActive: false,
        activeTool: 'Select',   // 'Select' | 'Line' | 'Dimension' | 'Constraint'
        constraintSubMode: null, // 'Perpendicular' | 'Midpoint'
        strokeColor: DEFAULT_STROKE_COLOR,
        strokeThickness: DEFAULT_STROKE_THICKNESS,
        lines: [],
        points: [],
        dimensions: [],
        constraints: [],
        objects: [],
        previewLine: null,
        snapCandidate: null,
        pendingDimEdit: null,
        isPerpendicularSnapActive: false,
      }
    };
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _notify(path, value) {
    for (const fn of this.listeners) {
      fn(path, value, this.state);
    }
  }

  set(path, value) {
    const keys = path.split('.');
    let target = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]];
    }
    const last = keys[keys.length - 1];
    if (target[last] !== value) {
      target[last] = value;
      this._notify(path, value);
    }
  }

  get(path) {
    const keys = path.split('.');
    let target = this.state;
    for (const key of keys) {
      if (target == null) return undefined;
      target = target[key];
    }
    return target;
  }
}

export { Store };
