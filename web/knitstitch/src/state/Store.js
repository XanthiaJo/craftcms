// Store.js - Central reactive state (replaces ViewModelBase)
// TODO: Implement reactive store with subscribe, set, get methods

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
      // Sketch state
      sketch: {
        isActive: false,
        activeTool: 'Select',   // 'Select' | 'Line' | 'Dimension' | 'Constraint'
        constraintSubMode: null, // 'Perpendicular' | 'Midpoint'
        strokeColor: '#E63946',
        strokeThickness: 2,
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

  set(path, value) {
    // TODO: Implement deep-set, then notify all listeners
  }

  get(path) {
    // TODO: Implement deep-get
  }
}

export { Store };
