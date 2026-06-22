// main.js - App bootstrap, stage setup, and top-level UI wiring

import '../css/app.css';
import { AppStage } from './konva/AppStage.js';
import { Store } from './state/Store.js';
import { StorePersistence } from './state/StorePersistence.js';
import { rebuildPreviewCells, fitGridToCanvas } from './services/GridService.js';
import { SketchService } from './services/sketch/SketchService.js';
import { setupMainUi } from './ui/mainUi.js';

const store = new Store();
const persistence = new StorePersistence(store);
persistence.hydrate();

const sketchService = new SketchService(store);
persistence.attach();

if (typeof window !== 'undefined') {
  window.__knitstitchStore = store;
  window.__knitstitchSketchService = sketchService;
}

if (store.get('previewCells').length === 0) {
  rebuildPreviewCells(store);
}

const mainUi = setupMainUi({ store, sketchService });

let appStage = null;
if (document.getElementById('konva-stage')) {
  appStage = new AppStage('konva-stage', store, sketchService);
  const wrapper = document.querySelector('.canvas-wrapper');
  if (wrapper) {
    fitGridToCanvas(store, wrapper.clientWidth - 24, wrapper.clientHeight - 24);
  }
}

mainUi.recalculateSize();
mainUi.syncAll();

console.log('KnitStichGrid Web - Loaded');
