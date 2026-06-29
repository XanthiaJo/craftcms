import { GaugeSettings } from '../models/gaugeSettings.js';
import { PatternDimensions } from '../models/patternDimensions.js';
import { FinishedSizeCalculator } from '../services/finishedSizeCalculator.js';
import { rebuildPreviewCells, updateCellSizing } from '../services/gridService.js';
import { SketchTool } from '../services/sketch/sketchService.js';

function getElement(documentObj, id) {
  return documentObj?.getElementById?.(id) ?? null;
}

function bindIfPresent(element, eventName, handler) {
  if (!element) return;
  element.addEventListener(eventName, handler);
}

function toggleActive(element, active) {
  if (!element) return;
  element.classList.toggle('active', !!active);
}

export function setupMainUi({ store, sketchService, documentObj = globalThis.document, windowObj = globalThis.window }) {
  const refs = {
    gaugeStitchesInput: getElement(documentObj, 'gauge-stitches'),
    gaugeRowsInput: getElement(documentObj, 'gauge-rows'),
    gridColsInput: getElement(documentObj, 'grid-cols'),
    gridRowsInput: getElement(documentObj, 'grid-rows'),
    gridInfo: getElement(documentObj, 'grid-info'),
    cellSizeInfo: getElement(documentObj, 'cell-size-info'),
    finishedWidth: getElement(documentObj, 'finished-width'),
    finishedHeight: getElement(documentObj, 'finished-height'),
    recalcBtn: getElement(documentObj, 'btn-recalculate'),
    sketchColorSelect: getElement(documentObj, 'sketch-color'),
    sketchThicknessSlider: getElement(documentObj, 'sketch-thickness'),
    sketchUndoBtn: getElement(documentObj, 'sketch-undo'),
    sketchClearBtn: getElement(documentObj, 'sketch-clear'),
    sketchDeleteBtn: getElement(documentObj, 'sketch-delete'),
    sketchObjectList: getElement(documentObj, 'sketch-object-list'),
    toolLineBtn: getElement(documentObj, 'tool-line'),
    toolSelectBtn: getElement(documentObj, 'tool-select'),
    toolDimensionBtn: getElement(documentObj, 'tool-dimension'),
    toolPerpendicularBtn: getElement(documentObj, 'tool-perpendicular'),
    toolMidpointBtn: getElement(documentObj, 'tool-midpoint'),
    toolEqualBtn: getElement(documentObj, 'tool-equal'),
    overlayFileInput: getElement(documentObj, 'overlay-file'),
    overlayBrowseBtn: getElement(documentObj, 'overlay-browse'),
    overlayClearBtn: getElement(documentObj, 'overlay-clear'),
    overlayShowCheck: getElement(documentObj, 'overlay-show'),
    overlayOpacitySlider: getElement(documentObj, 'overlay-opacity'),
    overlayPathText: getElement(documentObj, 'overlay-path'),
  };

  const calc = new FinishedSizeCalculator();

  function updateGridSidebar() {
    const gs = store.get('stitchesPer4Inches');
    const gr = store.get('rowsPer4Inches');
    const cols = store.get('gridColumns');
    const rows = store.get('gridRows');
    const cw = store.get('cellWidthPx');
    const ch = store.get('cellHeightPx');
    const fw = store.get('finishedWidth');
    const fh = store.get('finishedHeight');

    if (refs.gaugeStitchesInput) refs.gaugeStitchesInput.value = gs;
    if (refs.gaugeRowsInput) refs.gaugeRowsInput.value = gr;
    if (refs.gridColsInput) refs.gridColsInput.value = cols;
    if (refs.gridRowsInput) refs.gridRowsInput.value = rows;
    if (refs.gridInfo) refs.gridInfo.innerHTML = `<strong>Grid: ${cols} x ${rows} cells</strong> (${cols * rows} total cells)`;
    if (refs.cellSizeInfo) refs.cellSizeInfo.textContent = `Cell size: ${cw}px wide x ${ch}px high`;
    if (refs.finishedWidth) refs.finishedWidth.textContent = `Width: ${fw > 0 ? fw.toFixed(2) : '--'} in`;
    if (refs.finishedHeight) refs.finishedHeight.textContent = `Height: ${fh > 0 ? fh.toFixed(2) : '--'} in`;
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
    const result = calc.calculate(gauge, dims);
    store.set('finishedWidth', Math.round(result.widthInches * 100) / 100);
    store.set('finishedHeight', Math.round(result.heightInches * 100) / 100);
    updateCellSizing(store, gauge.stitchesPer4Inches, gauge.rowsPer4Inches);
  }

  function updateSketchSidebar() {
    const sketch = store.state.sketch;
    if (refs.sketchColorSelect) refs.sketchColorSelect.value = sketch.strokeColor;
    if (refs.sketchThicknessSlider) refs.sketchThicknessSlider.value = sketch.strokeThickness;
    if (refs.sketchUndoBtn) refs.sketchUndoBtn.disabled = sketch.lines.length === 0 && !sketchService._pendingStart;
    if (refs.sketchClearBtn) refs.sketchClearBtn.disabled = sketch.lines.length === 0;
    if (refs.sketchDeleteBtn) refs.sketchDeleteBtn.disabled = !sketchService.hasSelection;

    toggleActive(refs.toolLineBtn, sketch.activeTool === SketchTool.Line);
    toggleActive(refs.toolSelectBtn, sketch.activeTool === SketchTool.Select);
    toggleActive(refs.toolDimensionBtn, sketch.activeTool === SketchTool.Dimension);
    toggleActive(
      refs.toolPerpendicularBtn,
      sketch.activeTool === SketchTool.Constraint && sketch.constraintSubMode === 'Perpendicular'
    );
    toggleActive(
      refs.toolMidpointBtn,
      sketch.activeTool === SketchTool.Constraint && sketch.constraintSubMode === 'Midpoint'
    );
    toggleActive(
      refs.toolEqualBtn,
      sketch.activeTool === SketchTool.Constraint && sketch.constraintSubMode === 'Equal'
    );

    if (refs.sketchObjectList) {
      refs.sketchObjectList.innerHTML = sketch.objects.map((o) =>
        `<li class="${o.isSelected ? 'selected' : ''} ${o.refType ? 'is-selectable' : 'is-readonly'}"
             data-ref-type="${o.refType ?? ''}"
             data-ref-id="${o.refId ?? ''}">
          <span>${
            o.kind === 'Line' ? '&#9473;'
              : o.kind === 'Perpendicular' ? '&#8869;'
              : o.kind === 'Equal' ? '&#8801;'
              : '&#9679;'
          }</span> ${o.label}
        </li>`
      ).join('');
    }
  }

  function updateOverlaySidebar() {
    const src = store.get('overlayImageSrc');
    const visible = store.get('overlayVisible');
    const opacity = store.get('overlayOpacity');
    if (refs.overlayPathText) refs.overlayPathText.value = src ? 'Image loaded' : 'No image selected';
    if (refs.overlayShowCheck) refs.overlayShowCheck.checked = visible;
    if (refs.overlayOpacitySlider) refs.overlayOpacitySlider.value = Math.round((opacity ?? 0.5) * 100);
  }

  function syncAll() {
    updateGridSidebar();
    updateSketchSidebar();
    updateOverlaySidebar();
  }

  bindIfPresent(refs.gaugeStitchesInput, 'change', () => {
    store.set('stitchesPer4Inches', Number(refs.gaugeStitchesInput.value) || 20);
    recalculateSize();
  });

  bindIfPresent(refs.gaugeRowsInput, 'change', () => {
    store.set('rowsPer4Inches', Number(refs.gaugeRowsInput.value) || 28);
    recalculateSize();
  });

  bindIfPresent(refs.gridColsInput, 'change', () => {
    store.set('gridColumns', Math.max(1, Number(refs.gridColsInput.value) || 30));
    rebuildPreviewCells(store);
    recalculateSize();
  });

  bindIfPresent(refs.gridRowsInput, 'change', () => {
    store.set('gridRows', Math.max(1, Number(refs.gridRowsInput.value) || 30));
    rebuildPreviewCells(store);
    recalculateSize();
  });

  bindIfPresent(refs.recalcBtn, 'click', recalculateSize);

  bindIfPresent(refs.sketchColorSelect, 'change', () => {
    sketchService.strokeColor = refs.sketchColorSelect.value;
  });

  bindIfPresent(refs.sketchThicknessSlider, 'input', () => {
    sketchService.strokeThickness = Number(refs.sketchThicknessSlider.value);
  });

  bindIfPresent(refs.sketchUndoBtn, 'click', () => sketchService.undo());
  bindIfPresent(refs.sketchClearBtn, 'click', () => sketchService.clear());
  bindIfPresent(refs.sketchDeleteBtn, 'click', () => sketchService.deleteSelected());

  bindIfPresent(refs.sketchObjectList, 'click', (event) => {
    const row = event.target.closest('li[data-ref-type]');
    if (!row) return;
    const refType = row.dataset.refType;
    const rawRefId = row.dataset.refId;
    if (!refType || rawRefId === '') return;
    sketchService.selectObjectByRef(refType, Number(rawRefId), event.ctrlKey);
  });

  bindIfPresent(refs.toolLineBtn, 'click', () => {
    sketchService.activeTool = SketchTool.Line;
  });

  bindIfPresent(refs.toolSelectBtn, 'click', () => {
    sketchService.activeTool = SketchTool.Select;
  });

  bindIfPresent(refs.toolDimensionBtn, 'click', () => {
    sketchService.activeTool = SketchTool.Dimension;
  });

  bindIfPresent(refs.toolPerpendicularBtn, 'click', () => {
    sketchService.activeTool = SketchTool.Constraint;
    sketchService.constraintSubMode = 'Perpendicular';
  });

  bindIfPresent(refs.toolMidpointBtn, 'click', () => {
    sketchService.activeTool = SketchTool.Constraint;
    sketchService.constraintSubMode = 'Midpoint';
  });

  bindIfPresent(refs.toolEqualBtn, 'click', () => {
    sketchService.activeTool = SketchTool.Constraint;
    sketchService.constraintSubMode = 'Equal';
  });

  bindIfPresent(refs.overlayBrowseBtn, 'click', () => refs.overlayFileInput?.click());
  bindIfPresent(refs.overlayFileInput, 'change', () => {
    const file = refs.overlayFileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      store.set('overlayImageSrc', e.target.result);
      store.set('overlayVisible', true);
    };
    reader.readAsDataURL(file);
  });

  bindIfPresent(refs.overlayClearBtn, 'click', () => {
    store.set('overlayImageSrc', null);
    store.set('overlayVisible', false);
    if (refs.overlayFileInput) refs.overlayFileInput.value = '';
  });

  bindIfPresent(refs.overlayShowCheck, 'change', () => {
    store.set('overlayVisible', refs.overlayShowCheck.checked);
  });

  bindIfPresent(refs.overlayOpacitySlider, 'input', () => {
    store.set('overlayOpacity', Number(refs.overlayOpacitySlider.value) / 100);
  });

  bindIfPresent(documentObj, 'keydown', (e) => {
    if (e.key === 'Escape') {
      sketchService.exitToSelect();
      return;
    }

    if (e.key !== 'Delete') return;
    if (!store.get('sketch.isActive')) return;

    const activeEl = documentObj.activeElement;
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

  if (windowObj && typeof windowObj.setWorkspace === 'function') {
    const originalSetWorkspace = windowObj.setWorkspace;
    windowObj.setWorkspace = function (ws) {
      if (originalSetWorkspace) originalSetWorkspace.call(this, ws);
      sketchService.isActive = ws === 'sketch';
    };
  }

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
      updateGridSidebar();
    }
  });

  store.subscribe((path) => {
    if (path.startsWith('sketch.')) {
      updateSketchSidebar();
    }
  });

  store.subscribe((path) => {
    if (
      path === 'overlayImageSrc' ||
      path === 'overlayVisible' ||
      path === 'overlayOpacity'
    ) {
      updateOverlaySidebar();
    }
  });

  return {
    recalculateSize,
    syncAll,
    updateGridSidebar,
    updateSketchSidebar,
    updateOverlaySidebar,
  };
}
