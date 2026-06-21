import Konva from 'konva';

export class SketchLayer {
  constructor(store, sketchService) {
    this.store = store;
    this.service = sketchService;
    this.layer = new Konva.Layer({ name: 'sketchLayer' });
    this._unsubscribe = store.subscribe((path) => this._onStoreChange(path));
  }

  mount(stage) {
    stage.add(this.layer);
    this._setupEvents(stage);
    this._render();
  }

  destroy() {
    this._unsubscribe();
    this._hideDimEditOverlay();
    this.layer.destroy();
  }

  _showDimEditOverlay(pendingEdit) {
    this._hideDimEditOverlay();
    const container = this.layer.getStage().container();
    const stageRect = container.getBoundingClientRect();
    const canvasRect = container.querySelector('canvas')?.getBoundingClientRect() ?? stageRect;

    const el = document.createElement('div');
    el.id = 'dim-edit-overlay';
    el.style.cssText = `
      position: fixed;
      left: ${canvasRect.left + pendingEdit.labelPos.x}px;
      top: ${canvasRect.top + pendingEdit.labelPos.y - 52}px;
      background: #2A2A2A;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 6px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    `;
    el.innerHTML = `
      <span style="font-size:10px;color:#bbb;">Distance (px):</span>
      <div style="display:flex;gap:4px;align-items:center;">
        <input id="dim-edit-input" type="number" min="0.1" step="0.1"
          value="${pendingEdit.initialText}"
          style="width:72px;padding:2px 4px;font-size:12px;background:#1a1a1a;color:white;border:1px solid #555;border-radius:2px;" />
        <button id="dim-edit-confirm" title="Apply (Enter)"
          style="width:22px;height:22px;background:#1D70B8;color:white;border:none;border-radius:2px;cursor:pointer;font-weight:bold;">✓</button>
        <button id="dim-edit-cancel" title="Cancel (Esc)"
          style="width:22px;height:22px;background:#555;color:white;border:none;border-radius:2px;cursor:pointer;font-weight:bold;">✕</button>
      </div>
      <span style="font-size:9px;color:#888;">Enter to apply, Esc to skip</span>
    `;
    document.body.appendChild(el);

    const input = el.querySelector('#dim-edit-input');
    const confirmBtn = el.querySelector('#dim-edit-confirm');
    const cancelBtn = el.querySelector('#dim-edit-cancel');

    const confirm = () => {
      const v = parseFloat(input.value);
      if (v > 0) pendingEdit.onConfirm(v);
      else pendingEdit.onCancel();
    };
    const cancel = () => pendingEdit.onCancel();

    confirmBtn.addEventListener('click', confirm);
    cancelBtn.addEventListener('click', cancel);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });

    requestAnimationFrame(() => { input.focus(); input.select(); });
  }

  _hideDimEditOverlay() {
    const el = document.getElementById('dim-edit-overlay');
    if (el) el.remove();
  }

  _onStoreChange(path) {
    if (
      path === 'sketch.lines' ||
      path === 'sketch.points' ||
      path === 'sketch.previewLine' ||
      path === 'sketch.snapCandidate' ||
      path === 'sketch.strokeColor' ||
      path === 'sketch.strokeThickness' ||
      path === 'sketch.isActive' ||
      path === 'sketch.activeTool' ||
      path === 'sketch.dimensions' ||
      path === 'sketch.constraints' ||
      path === 'sketch.pendingDimEdit'
    ) {
      this._render();
    }
  }

  _setupEvents(stage) {
    // Click on empty space → forward to VM
    stage.on('click tap', (e) => {
      if (!this.store.get('sketch.isActive')) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const target = e.target;
      if (target !== this.layer && target.getLayer() === this.layer) return;
      this.service.onCanvasClick({ x: pos.x, y: pos.y }, { snapEnabled: !e.evt.ctrlKey });
    });

    stage.on('mousemove', (e) => {
      if (!this.store.get('sketch.isActive')) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      this.service.onCanvasMouseMove({ x: pos.x, y: pos.y }, { snapEnabled: !e.evt.ctrlKey });
    });

    stage.on('mousedown', (e) => {
      if (!this.store.get('sketch.isActive')) return;
      if (e.evt.button === 2) {
        this.service.onRightMouseDown();
        return;
      }
      const pos = stage.getPointerPosition();
      if (!pos) return;
      this.service.onCanvasMouseDown({ x: pos.x, y: pos.y }, { snapEnabled: !e.evt.ctrlKey });
    });

    stage.on('mouseup', () => {
      if (!this.store.get('sketch.isActive')) return;
      this.service.onCanvasMouseUp();
      document.body.style.cursor = 'default';
    });

    // Right-click cancels current action and returns to Select tool
    stage.on('contextmenu', (e) => {
      if (!this.store.get('sketch.isActive')) return;
      e.evt.preventDefault();
      this.service.exitToSelect();
    });
  }

  _render() {
    this.layer.destroyChildren();
    const isActive = this.store.get('sketch.isActive');

    const lines = this.store.get('sketch.lines');
    const points = this.store.get('sketch.points');
    const dimensions = this.store.get('sketch.dimensions') || [];
    const constraints = this.store.get('sketch.constraints') || [];
    const preview = this.store.get('sketch.previewLine');
    const snap = this.store.get('sketch.snapCandidate');
    const color = this.store.get('sketch.strokeColor') || '#E63946';
    const thickness = this.store.get('sketch.strokeThickness') || 2;

    const group = new Konva.Group();

    // Committed lines
    for (const line of lines) {
      const kLine = new Konva.Line({
        points: [line.start.x, line.start.y, line.end.x, line.end.y],
        stroke: line.isSelected ? '#0078D7' : color,
        strokeWidth: line.isSelected ? thickness + 1 : thickness,
        hitStrokeWidth: Math.max(10, thickness + 4),
        listening: true,
      });
      kLine.on('click tap', (e) => {
        e.cancelBubble = true;
        const activeTool = this.store.get('sketch.activeTool');
        if (activeTool === 'Select') {
          this.service.selectLine(line, e.evt.ctrlKey);
          return;
        }

        const pointer = this.layer.getStage()?.getPointerPosition();
        if (!pointer) return;
        this.service.onCanvasClick({ x: pointer.x, y: pointer.y }, { snapEnabled: !e.evt.ctrlKey });
      });
      group.add(kLine);
    }

    const pointDisplayColor = '#0078D7';

    // Points
    for (const pt of points) {
      const isSelectTool = this.store.get('sketch.activeTool') === 'Select';
      const isSelected = pt.isSelected;
      const dot = new Konva.Circle({
        x: pt.x,
        y: pt.y,
        radius: isSelected ? 6 : isSelectTool ? 5 : 3,
        fill: isSelected ? pointDisplayColor : color,
        stroke: isSelected ? pointDisplayColor : null,
        strokeWidth: isSelected ? 1 : 0,
        listening: true,
        hitStrokeWidth: 14,
      });
      dot.on('click tap', (e) => {
        e.cancelBubble = true;
        const activeTool = this.store.get('sketch.activeTool');
        if (activeTool === 'Select') {
          this.service.selectPoint(pt, e.evt.ctrlKey);
          return;
        }
        this.service.onCanvasClick({ x: pt.x, y: pt.y }, { snapEnabled: !e.evt.ctrlKey });
      });
      if (isSelectTool) {
        dot.on('mouseenter', () => { document.body.style.cursor = 'grab'; });
        dot.on('mouseleave', () => { document.body.style.cursor = 'default'; });
        dot.on('mousedown', (e) => {
          e.cancelBubble = true;
          document.body.style.cursor = 'grabbing';
          const pos = { x: pt.x, y: pt.y };
          this.service.startDrag(pos, { snapEnabled: !e.evt.ctrlKey });
        });
      }
      group.add(dot);
    }

    // Preview line (only shown when sketch input is active)
    if (isActive && preview) {
      const kPreview = new Konva.Line({
        points: [preview.start.x, preview.start.y, preview.end.x, preview.end.y],
        stroke: '#808080',
        strokeWidth: thickness,
        dash: [5, 5],
        listening: false,
      });
      group.add(kPreview);
    }

    // Snap candidate highlight (only shown when sketch input is active)
    if (isActive && snap) {
      const ring = new Konva.Ring({
        x: snap.x,
        y: snap.y,
        innerRadius: 6,
        outerRadius: 10,
        fill: '#0078D7',
        listening: false,
      });
      group.add(ring);
    }

    // Dimension annotations
    const pendingEdit = this.store.get('sketch.pendingDimEdit');
    for (const dim of dimensions) {
      const dimGroup = new Konva.Group();
      const dimColor = dim.isSelected ? '#1D70B8' : '#2D9E4F';

      // Witness lines (dashed grey)
      for (const [p1, p2] of [
        [dim.witnessA1, dim.witnessA2],
        [dim.witnessB1, dim.witnessB2],
      ]) {
        dimGroup.add(new Konva.Line({
          points: [p1.x, p1.y, p2.x, p2.y],
          stroke: '#888888',
          strokeWidth: 1,
          dash: [3, 2],
          listening: false,
        }));
      }

      // Dimension line
      dimGroup.add(new Konva.Line({
        points: [dim.dimLine1.x, dim.dimLine1.y, dim.dimLine2.x, dim.dimLine2.y],
        stroke: dimColor,
        strokeWidth: 1.5,
        listening: false,
      }));

      // Arrowheads
      for (const pts of [dim.arrowAPoints, dim.arrowBPoints]) {
        if (pts.length === 3) {
          dimGroup.add(new Konva.Line({
            points: pts.flatMap(p => [p.x, p.y]),
            closed: true,
            fill: dimColor,
            listening: false,
          }));
        }
      }

      // Clickable label
      const isEditOpen = pendingEdit && pendingEdit.dimId === dim.id;
      const labelGroup = new Konva.Group({
        x: dim.labelPos.x,
        y: dim.labelPos.y,
        rotation: dim.labelAngle,
        listening: true,
        cursor: 'pointer',
      });
      const labelBg = new Konva.Rect({
        fill: isEditOpen ? '#1D70B8' : '#2A2A2A',
        stroke: dim.isSelected ? '#1D70B8' : '#444444',
        strokeWidth: 1.5,
        cornerRadius: 10,
        listening: true,
      });
      const labelTxt = new Konva.Text({
        text: dim.labelText,
        fontSize: 10,
        fontFamily: 'Open Sans, sans-serif',
        fontStyle: '600',
        fill: 'white',
        padding: 4,
        listening: false,
      });
      labelBg.width(labelTxt.width());
      labelBg.height(labelTxt.height());
      labelBg.offsetX(labelTxt.width() / 2);
      labelBg.offsetY(labelTxt.height() / 2);
      labelTxt.offsetX(labelTxt.width() / 2);
      labelTxt.offsetY(labelTxt.height() / 2);
      labelGroup.add(labelBg, labelTxt);
      labelGroup.on('mousedown touchstart', (e) => {
        e.cancelBubble = true;
        this.service.selectDimension(dim, e.evt.ctrlKey);
      });
      labelGroup.on('dblclick dbltap', (e) => {
        e.cancelBubble = true;
        this.service.selectDimension(dim, e.evt.ctrlKey);
        this.service._openDimEdit(dim);
      });
      dimGroup.add(labelGroup);
      group.add(dimGroup);
    }

    for (const constraint of constraints) {
      if (constraint?.type !== 'Perpendicular') continue;
      const anchor = constraint.pointA ?? this.service._findSharedPoint(constraint.lineA, constraint.lineB);
      if (!anchor || !constraint.lineA || !constraint.lineB) continue;

      const lineAPoint = constraint.lineA.start === anchor ? constraint.lineA.end : constraint.lineA.start;
      const lineBPoint = constraint.lineB.start === anchor ? constraint.lineB.end : constraint.lineB.start;
      if (!lineAPoint || !lineBPoint) continue;

      const vecA = { x: lineAPoint.x - anchor.x, y: lineAPoint.y - anchor.y };
      const vecB = { x: lineBPoint.x - anchor.x, y: lineBPoint.y - anchor.y };
      const lenA = Math.hypot(vecA.x, vecA.y);
      const lenB = Math.hypot(vecB.x, vecB.y);
      if (lenA < 0.001 || lenB < 0.001) continue;

      const unitA = { x: vecA.x / lenA, y: vecA.y / lenA };
      const unitB = { x: vecB.x / lenB, y: vecB.y / lenB };
      const iconSize = 8;
      const iconOrigin = {
        x: anchor.x + (unitA.x + unitB.x) * 8,
        y: anchor.y + (unitA.y + unitB.y) * 8,
      };
      const iconColor = constraint.isSelected ? '#0078D7' : '#2D9E4F';

      const iconGroup = new Konva.Group({ listening: true });
      iconGroup.add(new Konva.Line({
        points: [
          iconOrigin.x + unitA.x * iconSize, iconOrigin.y + unitA.y * iconSize,
          iconOrigin.x + unitA.x * iconSize + unitB.x * iconSize, iconOrigin.y + unitA.y * iconSize + unitB.y * iconSize,
          iconOrigin.x + unitB.x * iconSize, iconOrigin.y + unitB.y * iconSize,
        ],
        stroke: iconColor,
        strokeWidth: 2,
        hitStrokeWidth: 18,
        lineJoin: 'round',
        listening: true,
      }));
      iconGroup.add(new Konva.Circle({
        x: iconOrigin.x + (unitA.x + unitB.x) * (iconSize * 0.5),
        y: iconOrigin.y + (unitA.y + unitB.y) * (iconSize * 0.5),
        radius: 10,
        fill: 'rgba(0,0,0,0)',
        listening: true,
      }));
      iconGroup.on('click tap', (e) => {
        e.cancelBubble = true;
        this.service.selectConstraint(constraint, e.evt.ctrlKey);
      });
      group.add(iconGroup);
    }

    // Floating dim-edit input overlay (rendered as a Konva HTML overlay)
    if (pendingEdit) {
      this._showDimEditOverlay(pendingEdit);
    } else {
      this._hideDimEditOverlay();
    }

    this.layer.add(group);
    this.layer.batchDraw();
  }
}
