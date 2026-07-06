import { GaugeSettings } from '../models/gaugeSettings.js';
import { PatternDimensions } from '../models/patternDimensions.js';
import { FinishedSizeCalculator } from '../services/finishedSizeCalculator.js';
import { updateCellSizing, getCombinedBoundingBox, clearManualCellsOutsideSketch } from '../services/gridService.js';
import { computeFilledCellsFromSketch } from '../services/sketch/closedShapeFill.js';
import {
  ZOOM_STEP,
  fitToView,
  resetView,
  zoomAt,
  zoomCentered,
} from '../services/zoomService.js';
import { computeSockCounts, buildSockOutlineInInches } from '../services/sketch/sockMeasurements.js';
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
  element.classList.toggle('button-primary', !!active);
}

export function setupMainUi({ store, sketchService, documentObj = globalThis.document, windowObj = globalThis.window }) {
  const refs = {
    gaugeStitchesInput: getElement(documentObj, 'gauge-stitches'),
    gaugeRowsInput: getElement(documentObj, 'gauge-rows'),
    gridInfo: getElement(documentObj, 'grid-info'),
    cellSizeInfo: getElement(documentObj, 'cell-size-info'),
    finishedWidth: getElement(documentObj, 'finished-width'),
    finishedHeight: getElement(documentObj, 'finished-height'),
    recalcBtn: getElement(documentObj, 'btn-recalculate'),
    clearManualCellsBtn: getElement(documentObj, 'btn-clear-manual-cells'),
    sketchColorSelect: getElement(documentObj, 'sketch-color'),
    sketchThicknessSlider: getElement(documentObj, 'sketch-thickness'),
    sketchUndoBtn: getElement(documentObj, 'sketch-undo'),
    sketchClearBtn: getElement(documentObj, 'sketch-clear'),
    sketchDeleteBtn: getElement(documentObj, 'sketch-delete'),
    sketchObjectList: getElement(documentObj, 'sketch-object-list'),
    toolLineBtn: getElement(documentObj, 'tool-line'),
    toolSelectBtn: getElement(documentObj, 'tool-select'),
    toolAnchorBtn: getElement(documentObj, 'tool-anchor'),
    toolFillBtn: getElement(documentObj, 'tool-fill'),
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
    templateList: getElement(documentObj, 'template-list'),
    zoomInBtn: getElement(documentObj, 'zoom-in'),
    zoomOutBtn: getElement(documentObj, 'zoom-out'),
    zoomFitBtn: getElement(documentObj, 'zoom-fit'),
    zoomResetBtn: getElement(documentObj, 'zoom-reset'),
    zoomLevelDisplay: getElement(documentObj, 'zoom-level'),
    canvasWrapper: documentObj?.querySelector?.('.canvas-wrapper'),
    konvaStage: getElement(documentObj, 'konva-stage'),
    measurementsPanel: getElement(documentObj, 'template-measurements-panel'),
    measFootCirc: getElement(documentObj, 'measurement-foot-circ'),
    measFootLen: getElement(documentObj, 'measurement-foot-len'),
    measLegHeight: getElement(documentObj, 'measurement-leg-height'),
    measEase: getElement(documentObj, 'measurement-ease'),
    measRib: getElement(documentObj, 'measurement-rib'),
    derivedWidth: getElement(documentObj, 'derived-width'),
    derivedRib: getElement(documentObj, 'derived-rib'),
    derivedSectionA: getElement(documentObj, 'derived-section-a'),
    derivedNotch: getElement(documentObj, 'derived-notch'),
    derivedNotch2: getElement(documentObj, 'derived-notch-2'),
    derivedSectionB: getElement(documentObj, 'derived-section-b'),
    derivedSectionC: getElement(documentObj, 'derived-section-c'),
    derivedRib2: getElement(documentObj, 'derived-rib-2'),
    derivedGauge: getElement(documentObj, 'derived-gauge'),
    derivedGaugeRows: getElement(documentObj, 'derived-gauge-rows'),
  };

  const calc = new FinishedSizeCalculator();

  function updateGridSidebar() {
    const gs = store.get('stitchesPer4Inches');
    const gr = store.get('rowsPer4Inches');
    const cw = store.get('cellWidthPx');
    const ch = store.get('cellHeightPx');
    const fw = store.get('finishedWidth');
    const fh = store.get('finishedHeight');

    const filledCells = store.get('filledCells');
    const sketchFilled = computeFilledCellsFromSketch(
      store.get('sketch.lines'),
      cw,
      ch,
      0.3 // Use 30% threshold for consistency
    );
    const bbox = getCombinedBoundingBox(filledCells, sketchFilled);
    const filledCount = filledCells.size + sketchFilled.size;

    if (refs.gaugeStitchesInput) refs.gaugeStitchesInput.value = gs;
    if (refs.gaugeRowsInput) refs.gaugeRowsInput.value = gr;
    if (refs.gridInfo) {
      if (bbox) {
        const w = bbox.maxCol - bbox.minCol + 1;
        const h = bbox.maxRow - bbox.minRow + 1;
        refs.gridInfo.innerHTML = `<strong>Pattern: ${w} x ${h} cells</strong> (${filledCount} filled)`;
      } else {
        refs.gridInfo.innerHTML = `<strong>No cells filled</strong> — click the grid or draw a closed shape`;
      }
    }
    if (refs.cellSizeInfo) refs.cellSizeInfo.textContent = `Cell size: ${cw}px wide x ${ch}px high`;
    if (refs.finishedWidth) refs.finishedWidth.textContent = `Width: ${fw > 0 ? fw.toFixed(2) : '--'} in`;
    if (refs.finishedHeight) refs.finishedHeight.textContent = `Height: ${fh > 0 ? fh.toFixed(2) : '--'} in`;
  }

  function recalculateSize() {
    const gauge = new GaugeSettings(
      store.get('stitchesPer4Inches'),
      store.get('rowsPer4Inches')
    );
    const cw = store.get('cellWidthPx');
    const ch = store.get('cellHeightPx');
    const filledCells = store.get('filledCells');
    const sketchFilled = computeFilledCellsFromSketch(
      store.get('sketch.lines'),
      cw,
      ch,
      0.3 // Use 30% threshold for consistency
    );
    const bbox = getCombinedBoundingBox(filledCells, sketchFilled);
    const stitchCount = bbox ? (bbox.maxCol - bbox.minCol + 1) : 0;
    const rowCount = bbox ? (bbox.maxRow - bbox.minRow + 1) : 0;
    const dims = new PatternDimensions(stitchCount, rowCount);
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
    toggleActive(refs.toolAnchorBtn, sketch.activeTool === SketchTool.Anchor);
    toggleActive(refs.toolFillBtn, sketch.activeTool === SketchTool.Fill);
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

  function updateTemplatesSidebar() {
    if (!refs.templateList) return;
    const templates = sketchService.templates;
    refs.templateList.innerHTML = templates.map((t) =>
      `<button class="button button-sm" data-template-id="${t.id}">${t.label}</button>`
    ).join('');
  }

  function readMeasurementsFromInputs() {
    return {
      footCircumference: Number(refs.measFootCirc?.value) || 0,
      footLength: Number(refs.measFootLen?.value) || 0,
      legHeight: Number(refs.measLegHeight?.value) || 0,
      negativeEasePct: Number(refs.measEase?.value) || 0,
      ribbingLength: Number(refs.measRib?.value) || 0,
    };
  }

  function writeMeasurementsToInputs(m) {
    if (!m) return;
    if (refs.measFootCirc) refs.measFootCirc.value = m.footCircumference;
    if (refs.measFootLen) refs.measFootLen.value = m.footLength;
    if (refs.measLegHeight) refs.measLegHeight.value = m.legHeight;
    if (refs.measEase) refs.measEase.value = m.negativeEasePct;
    if (refs.measRib) refs.measRib.value = m.ribbingLength;
  }

  function updateMeasurementDerived() {
    const templateId = store.get('activeTemplateId');
    if (!templateId) return;

    const gauge = {
      stitchesPer4Inches: store.get('stitchesPer4Inches'),
      rowsPer4Inches: store.get('rowsPer4Inches'),
    };
    const m = store.get('templateMeasurements');
    if (!m) return;

    const counts = computeSockCounts(gauge, m);
    const { sections } = buildSockOutlineInInches(gauge, m);

    const fmt = (inches) => `${inches.toFixed(2)} in`;

    if (refs.derivedWidth) refs.derivedWidth.textContent = `${counts.widthSts} sts / ${fmt(sections.width)}`;
    if (refs.derivedRib) refs.derivedRib.textContent = `${counts.ribRows} rows / ${fmt(sections.topRib)}`;
    if (refs.derivedSectionA) refs.derivedSectionA.textContent = `${counts.legRows} rows / ${fmt(sections.backLeg)}`;
    if (refs.derivedNotch) refs.derivedNotch.textContent = `${counts.notchRowsTotal} rows / ${fmt(sections.heel)}`;
    if (refs.derivedNotch2) refs.derivedNotch2.textContent = `${counts.notchRowsTotal} rows / ${fmt(sections.toe)}`;
    if (refs.derivedSectionB) refs.derivedSectionB.textContent = `${counts.soleRows} rows / ${fmt(sections.sole)}`;
    if (refs.derivedSectionC) refs.derivedSectionC.textContent = `${counts.instepRows} rows / ${fmt(sections.instep)}`;
    if (refs.derivedRib2) refs.derivedRib2.textContent = `${counts.ribRows} rows / ${fmt(sections.bottomRib)}`;
    if (refs.derivedGauge) refs.derivedGauge.textContent = gauge.stitchesPer4Inches;
    if (refs.derivedGaugeRows) refs.derivedGaugeRows.textContent = gauge.rowsPer4Inches;
  }

  function updateMeasurementsPanelVisibility() {
    const templateId = store.get('activeTemplateId');
    if (refs.measurementsPanel) {
      refs.measurementsPanel.style.display = templateId ? '' : 'none';
    }
    if (templateId) {
      const m = store.get('templateMeasurements');
      writeMeasurementsToInputs(m);
      updateMeasurementDerived();
    }
  }

  function updateZoomDisplay() {
    const level = store.get('zoomLevel');
    if (refs.zoomLevelDisplay) {
      refs.zoomLevelDisplay.textContent = `${Math.round(level * 100)}%`;
    }
  }

  function syncAll() {
    updateGridSidebar();
    updateSketchSidebar();
    updateOverlaySidebar();
    updateTemplatesSidebar();
    updateZoomDisplay();
    updateMeasurementsPanelVisibility();
  }

  bindIfPresent(refs.gaugeStitchesInput, 'change', () => {
    store.set('stitchesPer4Inches', Number(refs.gaugeStitchesInput.value) || 20);
    recalculateSize();
  });

  bindIfPresent(refs.gaugeRowsInput, 'change', () => {
    store.set('rowsPer4Inches', Number(refs.gaugeRowsInput.value) || 28);
    recalculateSize();
  });

  bindIfPresent(refs.recalcBtn, 'click', recalculateSize);

  // Clear manual cells that are not inside a sketch shape
  bindIfPresent(refs.clearManualCellsBtn, 'click', () => {
    const cw = store.get('cellWidthPx');
    const ch = store.get('cellHeightPx');
    const sketchFilled = computeFilledCellsFromSketch(store.get('sketch.lines'), cw, ch);
    clearManualCellsOutsideSketch(store, sketchFilled);
  });

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

  bindIfPresent(refs.toolAnchorBtn, 'click', () => {
    sketchService.activeTool = SketchTool.Anchor;
  });

  bindIfPresent(refs.toolFillBtn, 'click', () => {
    sketchService.activeTool = SketchTool.Fill;
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

  bindIfPresent(refs.templateList, 'click', (event) => {
    const btn = event.target.closest('button[data-template-id]');
    if (!btn) return;
    sketchService.applyTemplate(btn.dataset.templateId);
    updateMeasurementsPanelVisibility();
  });

  // --- Measurement inputs ---

  function onMeasurementInput() {
    const m = readMeasurementsFromInputs();
    store.set('templateMeasurements', m);
    sketchService.regenerateTemplate(m);
    updateMeasurementDerived();
  }

  for (const ref of [refs.measFootCirc, refs.measFootLen, refs.measLegHeight, refs.measEase, refs.measRib]) {
    bindIfPresent(ref, 'input', onMeasurementInput);
  }

  // --- Zoom controls ---

  function applyZoomResult(result) {
    store.set('zoomLevel', result.zoomLevel);
    store.set('panOffsetX', result.panOffsetX);
    store.set('panOffsetY', result.panOffsetY);
  }

  function getViewportSize() {
    if (!refs.konvaStage) return { w: 600, h: 400 };
    const el = refs.konvaStage;
    return { w: el.clientWidth, h: el.clientHeight };
  }

  function getGridPixelSize() {
    const cellW = store.get('cellWidthPx');
    const cellH = store.get('cellHeightPx');
    const filledCells = store.get('filledCells');
    const sketchFilled = computeFilledCellsFromSketch(
      store.get('sketch.lines'),
      cellW,
      cellH,
    );
    const bbox = getCombinedBoundingBox(filledCells, sketchFilled);
    if (!bbox) return { w: 0, h: 0 };
    const w = (bbox.maxCol - bbox.minCol + 1) * cellW;
    const h = (bbox.maxRow - bbox.minRow + 1) * cellH;
    return { w, h };
  }

  bindIfPresent(refs.zoomInBtn, 'click', () => {
    const { w, h } = getViewportSize();
    applyZoomResult(zoomCentered(
      store.get('zoomLevel'), store.get('panOffsetX'), store.get('panOffsetY'),
      w, h, ZOOM_STEP
    ));
  });

  bindIfPresent(refs.zoomOutBtn, 'click', () => {
    const { w, h } = getViewportSize();
    applyZoomResult(zoomCentered(
      store.get('zoomLevel'), store.get('panOffsetX'), store.get('panOffsetY'),
      w, h, 1 / ZOOM_STEP
    ));
  });

  bindIfPresent(refs.zoomResetBtn, 'click', () => {
    applyZoomResult(resetView());
  });

  bindIfPresent(refs.zoomFitBtn, 'click', () => {
    const { w: vw, h: vh } = getViewportSize();
    const { w: gw, h: gh } = getGridPixelSize();
    applyZoomResult(fitToView(gw, gh, vw, vh));
  });

  // Mouse-wheel zoom toward cursor
  bindIfPresent(refs.konvaStage, 'wheel', (e) => {
    e.preventDefault();
    const rect = refs.konvaStage.getBoundingClientRect();
    const focal = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    applyZoomResult(zoomAt(
      store.get('zoomLevel'), store.get('panOffsetX'), store.get('panOffsetY'),
      focal, factor
    ));
  });

  // Right-mouse drag to pan
  let panState = null;
  bindIfPresent(refs.konvaStage, 'contextmenu', (e) => { e.preventDefault(); });
  bindIfPresent(refs.konvaStage, 'mousedown', (e) => {
    if (e.button !== 2) return; // right button
    e.preventDefault();
    panState = { startX: e.clientX, startY: e.clientY, panX: store.get('panOffsetX'), panY: store.get('panOffsetY') };
  });
  bindIfPresent(refs.konvaStage, 'mousemove', (e) => {
    if (!panState) return;
    store.set('panOffsetX', panState.panX + (e.clientX - panState.startX));
    store.set('panOffsetY', panState.panY + (e.clientY - panState.startY));
  });
  bindIfPresent(documentObj, 'mouseup', () => { panState = null; });

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
    windowObj.setWorkspace = function (ws, btn) {
      if (originalSetWorkspace) originalSetWorkspace.call(this, ws, btn);
      store.set('currentWorkspace', ws);
      sketchService.isActive = ws === 'sketch' || ws === 'templates';
    };
  }

  store.subscribe((path) => {
    if (
      path === 'filledCells' ||
      path === 'cellWidthPx' ||
      path === 'cellHeightPx' ||
      path === 'stitchesPer4Inches' ||
      path === 'rowsPer4Inches' ||
      path === 'finishedWidth' ||
      path === 'finishedHeight'
    ) {
      if (path === 'filledCells' || path === 'cellWidthPx' || path === 'cellHeightPx') {
        recalculateSize();
      }
      updateGridSidebar();
    }
  });

  store.subscribe((path) => {
    if (path.startsWith('sketch.')) {
      updateSketchSidebar();
      if (path === 'sketch.lines' || path === 'sketch.isActive') {
        recalculateSize();
        updateGridSidebar();
      }
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

  store.subscribe((path) => {
    if (path === 'zoomLevel') {
      updateZoomDisplay();
    }
  });

  store.subscribe((path) => {
    if (
      path === 'activeTemplateId' ||
      path === 'templateMeasurements' ||
      path === 'stitchesPer4Inches' ||
      path === 'rowsPer4Inches'
    ) {
      updateMeasurementsPanelVisibility();
    }
  });

  return {
    recalculateSize,
    syncAll,
    updateGridSidebar,
    updateSketchSidebar,
    updateOverlaySidebar,
    updateTemplatesSidebar,
    updateZoomDisplay,
    updateMeasurementsPanelVisibility,
  };
}
