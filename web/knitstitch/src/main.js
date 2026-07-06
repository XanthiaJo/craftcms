// main.js - App bootstrap, stage setup, and top-level UI wiring

import { AppStage } from './konva/appStage.js';
import { Store } from './state/store.js';
import { StorePersistence } from './state/storePersistence.js';
import { rebuildPreviewCells } from './services/gridService.js';
import { SketchService } from './services/sketch/sketchService.js';
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
}

mainUi.recalculateSize();
mainUi.syncAll();

console.log('KnitStichGrid Web - Loaded');
