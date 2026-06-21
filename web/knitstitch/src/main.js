// main.js - App bootstrap, stage setup, sidebar wiring

import '../css/app.css';
import { AppStage } from './konva/AppStage.js';
import { Store } from './state/Store.js';
import { StorePersistence } from './state/StorePersistence.js';
import { rebuildPreviewCells, updateCellSizing, fitGridToCanvas } from './services/GridService.js';
import { SketchService, SketchTool } from './services/SketchService.js';
import { FinishedSizeCalculator } from './services/FinishedSizeCalculator.js';
import { GaugeSettings } from './models/GaugeSettings.js';
import { PatternDimensions } from './models/PatternDimensions.js';

const store = new Store();
const persistence = new StorePersistence(store);
persistence.hydrate();

const sketchService = new SketchService(store);
persistence.attach();

if (typeof window !== 'undefined') {
  window.__knitstitchStore = store;
  window.__knitstitchSketchService = sketchService;
}

// Build initial preview cells (only if not restored from storage)
if (store.get('previewCells').length === 0) {
  rebuildPreviewCells(store);
}

// Sidebar element refs
const gaugeStitchesInput = document.getElementById('gauge-stitches');
const gaugeRowsInput = document.getElementById('gauge-rows');
const gridColsInput = document.getElementById('grid-cols');
const gridRowsInput = document.getElementById('grid-rows');
const gridInfo = document.getElementById('grid-info');
const cellSizeInfo = document.getElementById('cell-size-info');
const finishedWidth = document.getElementById('finished-width');
const finishedHeight = document.getElementById('finished-height');
const recalcBtn = document.getElementById('btn-recalculate');

// Sketch sidebar refs
const sketchColorSelect = document.getElementById('sketch-color');
const sketchThicknessSlider = document.getElementById('sketch-thickness');
const sketchUndoBtn = document.getElementById('sketch-undo');
const sketchClearBtn = document.getElementById('sketch-clear');
const sketchDeleteBtn = document.getElementById('sketch-delete');
const sketchObjectList = document.getElementById('sketch-object-list');
const toolLineBtn = document.getElementById('tool-line');
const toolSelectBtn = document.getElementById('tool-select');
const toolDimensionBtn = document.getElementById('tool-dimension');
const toolPerpendicularBtn = document.getElementById('tool-perpendicular');
const toolMidpointBtn = document.getElementById('tool-midpoint');

// Overlay sidebar refs
const overlayFileInput = document.getElementById('overlay-file');
const overlayBrowseBtn = document.getElementById('overlay-browse');
const overlayClearBtn = document.getElementById('overlay-clear');
const overlayShowCheck = document.getElementById('overlay-show');
const overlayOpacitySlider = document.getElementById('overlay-opacity');
const overlayPathText = document.getElementById('overlay-path');

function updateSidebarFromStore() {
  const gs = store.get('stitchesPer4Inches');
  const gr = store.get('rowsPer4Inches');
  const cols = store.get('gridColumns');
  const rows = store.get('gridRows');
  const cw = store.get('cellWidthPx');
  const ch = store.get('cellHeightPx');
  const fw = store.get('finishedWidth');
  const fh = store.get('finishedHeight');

  if (gaugeStitchesInput) gaugeStitchesInput.value = gs;
  if (gaugeRowsInput) gaugeRowsInput.value = gr;
  if (gridColsInput) gridColsInput.value = cols;
  if (gridRowsInput) gridRowsInput.value = rows;
  if (gridInfo) gridInfo.innerHTML = `<strong>Grid: ${cols} x ${rows} cells</strong> (${cols * rows} total cells)`;
  if (cellSizeInfo) cellSizeInfo.textContent = `Cell size: ${cw}px wide x ${ch}px high`;
  if (finishedWidth) finishedWidth.textContent = `Width: ${fw > 0 ? fw.toFixed(2) : '--'} in`;
  if (finishedHeight) finishedHeight.textContent = `Height: ${fh > 0 ? fh.toFixed(2) : '--'} in`;
}

function recalculateSize() {
  const gauge = new GaugeSettings(
    store.get('stitchesPer4Inches'),
    store.get('rowsPer4Inches')
  );
  const dims = new PatternDimensions(
    store.get('gridColumns'),
    store.get('gridRows')
  );
  const calc = new FinishedSizeCalculator();
  const result = calc.calculate(gauge, dims);
  store.set('finishedWidth', Math.round(result.widthInches * 100) / 100);
  store.set('finishedHeight', Math.round(result.heightInches * 100) / 100);
  updateCellSizing(store, gauge.stitchesPer4Inches, gauge.rowsPer4Inches);
}

// Wire inputs
if (gaugeStitchesInput) {
  gaugeStitchesInput.addEventListener('change', () => {
    store.set('stitchesPer4Inches', Number(gaugeStitchesInput.value) || 20);
    recalculateSize();
  });
}

if (gaugeRowsInput) {
  gaugeRowsInput.addEventListener('change', () => {
    store.set('rowsPer4Inches', Number(gaugeRowsInput.value) || 28);
    recalculateSize();
  });
}

if (gridColsInput) {
  gridColsInput.addEventListener('change', () => {
    store.set('gridColumns', Math.max(1, Number(gridColsInput.value) || 30));
    rebuildPreviewCells(store);
    recalculateSize();
  });
}

if (gridRowsInput) {
  gridRowsInput.addEventListener('change', () => {
    store.set('gridRows', Math.max(1, Number(gridRowsInput.value) || 30));
    rebuildPreviewCells(store);
    recalculateSize();
  });
}

if (recalcBtn) {
  recalcBtn.addEventListener('click', recalculateSize);
}

// Keep sidebar in sync with store changes
store.subscribe((path) => {
  if (
    path === 'gridColumns' ||
    path === 'gridRows' ||
    path === 'cellWidthPx' ||
    path === 'cellHeightPx' ||
    path === 'stitchesPer4Inches' ||
    path === 'rowsPer4Inches' ||
    path === 'finishedWidth' ||
    path === 'finishedHeight'
  ) {
    updateSidebarFromStore();
  }
});

// Sketch sidebar wiring
function updateSketchSidebar() {
  const sketch = store.state.sketch;
  if (sketchColorSelect) sketchColorSelect.value = sketch.strokeColor;
  if (sketchThicknessSlider) sketchThicknessSlider.value = sketch.strokeThickness;
  if (sketchUndoBtn) sketchUndoBtn.disabled = sketch.lines.length === 0 && !sketchService._pendingStart;
  if (sketchClearBtn) sketchClearBtn.disabled = sketch.lines.length === 0;
  if (sketchDeleteBtn) sketchDeleteBtn.disabled = !sketchService.hasSelection;

  if (toolLineBtn) {
    toolLineBtn.classList.toggle('active', sketch.activeTool === SketchTool.Line);
  }
  if (toolSelectBtn) {
    toolSelectBtn.classList.toggle('active', sketch.activeTool === SketchTool.Select);
  }
  if (toolDimensionBtn) {
    toolDimensionBtn.classList.toggle('active', sketch.activeTool === SketchTool.Dimension);
  }
  if (toolPerpendicularBtn) {
    toolPerpendicularBtn.classList.toggle('active',
      sketch.activeTool === SketchTool.Constraint &&
      sketch.constraintSubMode === 'Perpendicular'
    );
  }
  if (toolMidpointBtn) {
    toolMidpointBtn.classList.toggle('active',
      sketch.activeTool === SketchTool.Constraint &&
      sketch.constraintSubMode === 'Midpoint'
    );
  }

  if (sketchObjectList) {
    sketchObjectList.innerHTML = sketch.objects.map(o =>
      `<li class="${o.isSelected ? 'selected' : ''} ${o.refType ? 'is-selectable' : 'is-readonly'}"
           data-ref-type="${o.refType ?? ''}"
           data-ref-id="${o.refId ?? ''}">
        <span>${o.kind === 'Line' ? '&#9473;' : o.kind === 'Perpendicular' ? '&#8869;' : '&#9679;'}</span> ${o.label}
      </li>`
    ).join('');
  }
}

if (sketchColorSelect) {
  sketchColorSelect.addEventListener('change', () => {
    sketchService.strokeColor = sketchColorSelect.value;
  });
}

if (sketchThicknessSlider) {
  sketchThicknessSlider.addEventListener('input', () => {
    sketchService.strokeThickness = Number(sketchThicknessSlider.value);
  });
}

if (sketchUndoBtn) {
  sketchUndoBtn.addEventListener('click', () => sketchService.undo());
}

if (sketchClearBtn) {
  sketchClearBtn.addEventListener('click', () => sketchService.clear());
}

if (sketchDeleteBtn) {
  sketchDeleteBtn.addEventListener('click', () => sketchService.deleteSelected());
}

if (sketchObjectList) {
  sketchObjectList.addEventListener('click', (event) => {
    const row = event.target.closest('li[data-ref-type]');
    if (!row) return;
    const refType = row.dataset.refType;
    const rawRefId = row.dataset.refId;
    if (!refType || rawRefId === '') return;
    sketchService.selectObjectByRef(refType, Number(rawRefId), event.ctrlKey);
  });
}

if (toolLineBtn) {
  toolLineBtn.addEventListener('click', () => {
    sketchService.activeTool = SketchTool.Line;
  });
}

if (toolSelectBtn) {
  toolSelectBtn.addEventListener('click', () => {
    sketchService.activeTool = SketchTool.Select;
  });
}

if (toolDimensionBtn) {
  toolDimensionBtn.addEventListener('click', () => {
    sketchService.activeTool = SketchTool.Dimension;
  });
}

if (toolPerpendicularBtn) {
  toolPerpendicularBtn.addEventListener('click', () => {
    sketchService.activeTool = SketchTool.Constraint;
    sketchService.constraintSubMode = 'Perpendicular';
  });
}

if (toolMidpointBtn) {
  toolMidpointBtn.addEventListener('click', () => {
    sketchService.activeTool = SketchTool.Constraint;
    sketchService.constraintSubMode = 'Midpoint';
  });
}

// Overlay sidebar wiring
function updateOverlaySidebar() {
  const src = store.get('overlayImageSrc');
  const visible = store.get('overlayVisible');
  const opacity = store.get('overlayOpacity');
  if (overlayPathText) overlayPathText.value = src ? 'Image loaded' : 'No image selected';
  if (overlayShowCheck) overlayShowCheck.checked = visible;
  if (overlayOpacitySlider) overlayOpacitySlider.value = Math.round((opacity ?? 0.5) * 100);
}

if (overlayBrowseBtn && overlayFileInput) {
  overlayBrowseBtn.addEventListener('click', () => overlayFileInput.click());
  overlayFileInput.addEventListener('change', () => {
    const file = overlayFileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      store.set('overlayImageSrc', e.target.result);
      store.set('overlayVisible', true);
    };
    reader.readAsDataURL(file);
  });
}

if (overlayClearBtn) {
  overlayClearBtn.addEventListener('click', () => {
    store.set('overlayImageSrc', null);
    store.set('overlayVisible', false);
    if (overlayFileInput) overlayFileInput.value = '';
  });
}

if (overlayShowCheck) {
  overlayShowCheck.addEventListener('change', () => {
    store.set('overlayVisible', overlayShowCheck.checked);
  });
}

if (overlayOpacitySlider) {
  overlayOpacitySlider.addEventListener('input', () => {
    store.set('overlayOpacity', Number(overlayOpacitySlider.value) / 100);
  });
}

// Escape key cancels current line
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    sketchService.exitToSelect();
    return;
  }

  if (e.key !== 'Delete') return;
  if (!store.get('sketch.isActive')) return;

  const activeEl = document.activeElement;
  const isEditingField = !!activeEl && (
    activeEl.tagName === 'INPUT'
    || activeEl.tagName === 'TEXTAREA'
    || activeEl.tagName === 'SELECT'
    || activeEl.isContentEditable
  );
  if (isEditingField) return;
  if (!sketchService.hasSelection) return;

  e.preventDefault();
  sketchService.deleteSelected();
});

// Workspace switching: enable sketch input only when on the sketch tab
const originalSetWorkspace = window.setWorkspace;
window.setWorkspace = function (ws) {
  if (originalSetWorkspace) originalSetWorkspace.call(this, ws);
  sketchService.isActive = ws === 'sketch';
  // Note: sketch geometry always renders regardless of isActive —
  // isActive only gates mouse input events on the sketch layer.
};

// Keep sketch sidebar in sync
store.subscribe((path) => {
  if (
    path.startsWith('sketch.') ||
    path === 'sketch.lines' ||
    path === 'sketch.points' ||
    path === 'sketch.objects' ||
    path === 'sketch.activeTool' ||
    path === 'sketch.strokeColor' ||
    path === 'sketch.strokeThickness' ||
    path === 'sketch.previewLine'
  ) {
    updateSketchSidebar();
  }
});

// Keep overlay sidebar in sync
store.subscribe((path) => {
  if (
    path === 'overlayImageSrc' ||
    path === 'overlayVisible' ||
    path === 'overlayOpacity'
  ) {
    updateOverlaySidebar();
  }
});

// Initialize Konva stage
let appStage = null;
if (document.getElementById('konva-stage')) {
  appStage = new AppStage('konva-stage', store, sketchService);
  const wrapper = document.querySelector('.canvas-wrapper');
  if (wrapper) {
    fitGridToCanvas(store, wrapper.clientWidth - 24, wrapper.clientHeight - 24);
  }
}

// Initial sidebar sync + size calc
recalculateSize();
updateSidebarFromStore();
updateSketchSidebar();
updateOverlaySidebar();

console.log('KnitStichGrid Web - Loaded');
