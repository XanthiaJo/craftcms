import { describe, it, expect, vi } from 'vitest';
import { Store } from '../src/state/Store.js';
import { ConstraintSubMode, SketchObjectKind, SketchService, SketchTool } from '../src/services/SketchService.js';
import { SketchConstraint } from '../src/models/SketchConstraint.js';

describe('SketchService', () => {
  function makeService() {
    const store = new Store();
    store.set('sketch.isActive', true);
    const service = new SketchService(store);
    service.activeTool = SketchTool.Line;
    return { store, service };
  }

  function makeDimensionService(start = { x: 0, y: 0 }, end = { x: 60, y: 0 }) {
    const store = new Store();
    store.set('sketch.isActive', true);
    const service = new SketchService(store);
    service.activeTool = SketchTool.Line;
    service.onCanvasClick(start);
    service.onCanvasClick(end);
    service.activeTool = SketchTool.Dimension;
    return { store, service };
  }

  describe('Line tool', () => {
    it('should create a preview line on first click', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 50, y: 50 });
      expect(store.state.sketch.points.length).toBe(1);
      expect(store.state.sketch.previewLine).not.toBeNull();
    });

    it('should commit a line on second click', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 50, y: 50 });
      service.onCanvasClick({ x: 100, y: 100 });
      expect(store.state.sketch.lines.length).toBe(1);
      expect(store.state.sketch.lines[0].start.x).toBe(50);
      expect(store.state.sketch.lines[0].end.x).toBe(100);
    });

    it('should chain lines (end becomes next start)', () => {
      const { service } = makeService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 50, y: 50 });
      service.onCanvasClick({ x: 100, y: 50 });
      expect(service._pendingStart.x).toBe(100);
      expect(service._pendingStart.y).toBe(50);
    });

    it('should snap to existing points within 10px radius', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 50, y: 50 });   // point at (50,50)
      service.onCanvasClick({ x: 100, y: 100 }); // line 1: (50,50) -> (100,100)
      service.onCanvasClick({ x: 51, y: 51 });   // line 2: snaps back to (50,50)
      service.onCanvasClick({ x: 200, y: 50 });  // line 3: from (50,50) -> (200,50)
      expect(store.state.sketch.lines.length).toBe(3);
      // line 2 starts at line 1's end and ends at line 1's start (shared point)
      expect(store.state.sketch.lines[1].start).toBe(store.state.sketch.lines[0].end);
      expect(store.state.sketch.lines[1].end).toBe(store.state.sketch.lines[0].start);
      // line 3 shares its start with line 1's start / line 2's end
      expect(store.state.sketch.lines[2].start).toBe(store.state.sketch.lines[0].start);
      // only 3 unique points: (50,50), (100,100), (200,50)
      expect(store.state.sketch.points.length).toBe(3);
    });

    it('should not snap to nearby points when ctrl is held', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 8, y: 0 }, { snapEnabled: false });

      expect(store.state.sketch.points.length).toBe(2);
      expect(store.state.sketch.lines[0].start.x).toBe(0);
      expect(store.state.sketch.lines[0].end.x).toBe(8);
    });
  });

  describe('Undo', () => {
    it('should remove the last committed line', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 50, y: 50 });
      expect(store.state.sketch.lines.length).toBe(1);
      service.undo();
      expect(store.state.sketch.lines.length).toBe(0);
    });

    it('should cancel in-progress line placement', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 50, y: 50 });
      expect(store.state.sketch.previewLine).not.toBeNull();
      service.undo();
      expect(store.state.sketch.previewLine).toBeNull();
      expect(store.state.sketch.points.length).toBe(0);
    });
  });

  describe('Clear', () => {
    it('should remove all lines and points', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 50, y: 50 });
      service.clear();
      expect(store.state.sketch.lines.length).toBe(0);
      expect(store.state.sketch.points.length).toBe(0);
      expect(store.state.sketch.dimensions.length).toBe(0);
      expect(store.state.sketch.previewLine).toBeNull();
    });
  });

  describe('Delete selection', () => {
    it('should delete a selected point, its attached line, and dependent dimensions', () => {
      const { service, store } = makeDimensionService({ x: 0, y: 0 }, { x: 60, y: 0 });
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });

      const point = store.state.sketch.points[0];

      service.selectPoint(point);
      service.deleteSelected();

      expect(store.state.sketch.lines.length).toBe(0);
      expect(store.state.sketch.points.length).toBe(0);
      expect(store.state.sketch.dimensions.length).toBe(0);
      expect(store.state.sketch.constraints.length).toBe(0);
      expect(service.hasSelection).toBe(false);
    });

    it('should delete selected lines and orphan points', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 50, y: 50 });
      const line = store.state.sketch.lines[0];
      service.selectLine(line);
      expect(service.hasSelection).toBe(true);

      service.deleteSelected();

      expect(store.state.sketch.lines.length).toBe(0);
      expect(store.state.sketch.points.length).toBe(0);
      expect(service.hasSelection).toBe(false);
    });

    it('should delete constraints that reference points from a deleted line even if the point is shared', () => {
      const { service, store } = makeService();

      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 50, y: 0 });
      service.onCanvasClick({ x: 100, y: 0 });

      const firstLine = store.state.sketch.lines[0];
      const secondLine = store.state.sketch.lines[1];
      const sharedPoint = store.state.sketch.points[1];
      const farPoint = store.state.sketch.points[2];

      store.state.sketch.constraints.push(new SketchConstraint('Coincident', sharedPoint, farPoint));

      service.selectLine(firstLine);
      service.deleteSelected();

      expect(store.state.sketch.lines.length).toBe(1);
      expect(store.state.sketch.points).toContain(sharedPoint);
      expect(store.state.sketch.points).toContain(farPoint);
      expect(store.state.sketch.points).not.toContain(firstLine.start);
      expect(store.state.sketch.constraints.length).toBe(0);
      expect(store.state.sketch.lines[0]).toBe(secondLine);
    });

    it('should delete selected dimensions', () => {
      const { service, store } = makeDimensionService({ x: 0, y: 0 }, { x: 60, y: 0 });
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });
      const dim = store.state.sketch.dimensions[0];

      service.selectDimension(dim);
      expect(service.hasSelection).toBe(true);

      service.deleteSelected();

      expect(store.state.sketch.dimensions.length).toBe(0);
      expect(service.hasSelection).toBe(false);
    });

    it('should delete a selected perpendicular constraint without deleting its lines', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });
      service.onCanvasClick({ x: 60, y: 60 });

      service.activeTool = SketchTool.Constraint;
      service.constraintSubMode = ConstraintSubMode.Perpendicular;
      service.onCanvasClick({ x: 60, y: 0 });

      const constraint = store.state.sketch.constraints[0];
      service.selectConstraint(constraint);
      service.deleteSelected();

      expect(store.state.sketch.constraints.length).toBe(0);
      expect(store.state.sketch.lines.length).toBe(2);
    });

    it('should delete line endpoints and attached dimensions when a constrained line is deleted', () => {
      const { service, store } = makeDimensionService({ x: 0, y: 0 }, { x: 60, y: 0 });
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });

      const line = store.state.sketch.lines[0];
      expect(store.state.sketch.points.length).toBe(2);
      expect(store.state.sketch.dimensions.length).toBe(1);

      service.selectLine(line);
      service.deleteSelected();

      expect(store.state.sketch.lines.length).toBe(0);
      expect(store.state.sketch.points.length).toBe(0);
      expect(store.state.sketch.dimensions.length).toBe(0);
      expect(store.state.sketch.constraints.length).toBe(0);
    });

    it('should delete every line attached to a selected shared point', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 50, y: 0 });
      service.onCanvasClick({ x: 100, y: 0 });

      const sharedPoint = store.state.sketch.points[1];

      service.selectPoint(sharedPoint);
      service.deleteSelected();

      expect(store.state.sketch.lines.length).toBe(0);
      expect(store.state.sketch.points.length).toBe(0);
    });
  });

  describe('Cancel', () => {
    it('should clear pending start and preview', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 50, y: 50 });
      service.cancelCurrentLine();
      expect(store.state.sketch.previewLine).toBeNull();
      expect(store.state.sketch.points.length).toBe(0);
    });
  });

  describe('exitToSelect (right-click / Escape)', () => {
    it('should switch activeTool to Select', () => {
      const { service, store } = makeService();
      expect(store.state.sketch.activeTool).toBe(SketchTool.Line);
      service.exitToSelect();
      expect(store.state.sketch.activeTool).toBe(SketchTool.Select);
    });

    it('should cancel an in-progress line placement', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 50, y: 50 });
      expect(store.state.sketch.previewLine).not.toBeNull();
      service.exitToSelect();
      expect(store.state.sketch.previewLine).toBeNull();
      expect(store.state.sketch.points.length).toBe(0);
    });

    it('should not remove committed lines', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 50, y: 50 });
      expect(store.state.sketch.lines.length).toBe(1);
      service.exitToSelect();
      expect(store.state.sketch.lines.length).toBe(1);
    });

    it('should switch to Select even when no action is in progress', () => {
      const { service, store } = makeService();
      service.exitToSelect();
      expect(store.state.sketch.activeTool).toBe(SketchTool.Select);
    });

    it('should clear a selected point on right-click exit', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 50, y: 50 });
      service.onCanvasClick({ x: 100, y: 100 });
      service.activeTool = SketchTool.Select;

      const point = store.state.sketch.points[0];
      service.selectPoint(point);
      expect(point.isSelected).toBe(true);

      service.onRightMouseDown();
      service.exitToSelect();

      expect(store.state.sketch.activeTool).toBe(SketchTool.Select);
      expect(point.isSelected).toBe(false);
      expect(service.hasSelection).toBe(false);
    });

    it('should clear an existing selection when exiting to Select', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 50, y: 50 });
      const line = store.state.sketch.lines[0];

      service.selectLine(line);
      expect(line.isSelected).toBe(true);

      service.exitToSelect();

      expect(line.isSelected).toBe(false);
      expect(service.hasSelection).toBe(false);
    });

    it('right-click event order: onRightMouseDown sets suppress before click fires', () => {
      const { service } = makeService();
      service.onCanvasClick({ x: 50, y: 50 }); // start a line (pendingStart set)
      // Correct Konva right-click order: mousedown(button=2) → click → contextmenu
      service.onRightMouseDown();               // button=2 mousedown — sets suppress FIRST
      service.onCanvasClick({ x: 60, y: 60 }); // click fires — must be suppressed
      service.exitToSelect();                   // contextmenu fires — cancel + exit tool
      expect(service._pendingStart).toBeNull();
      expect(service.store.state.sketch.points.length).toBe(0);
      expect(service.store.state.sketch.activeTool).toBe(SketchTool.Select);
    });

    it('regression: without onRightMouseDown the click would have committed or started a line', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 50, y: 50 }); // start a line (pendingStart set)
      // Simulate the OLD broken order: click fires before suppress is set
      // exitToSelect() alone (no onRightMouseDown) — suppress flag never set before click
      service.onCanvasClick({ x: 60, y: 60 }); // this would commit a line in the old code
      // Verify the bug existed — a line was committed
      expect(store.state.sketch.lines.length).toBe(1);
      // Now clean up with the correct right-click path
      service.exitToSelect();
    });

    it('should only suppress one click — the next click after that is processed normally', () => {
      const { service, store } = makeService();
      service.onRightMouseDown();               // sets suppress
      service.onCanvasClick({ x: 10, y: 10 }); // suppressed (stray post-contextmenu click)
      service.exitToSelect();
      // Switch back to Line and click — should work normally
      service.activeTool = SketchTool.Line;
      service.onCanvasClick({ x: 20, y: 20 });
      expect(store.state.sketch.points.length).toBe(1);
    });
  });

  describe('Select tool — drag move', () => {
    function makeSelectService() {
      const store = new Store();
      store.set('sketch.isActive', true);
      const service = new SketchService(store);
      service.activeTool = SketchTool.Select;
      return { store, service };
    }

    it('should move a point when dragged with the Select tool', () => {
      const { service, store } = makeSelectService();
      // First place a line using Line tool then switch to Select
      service.activeTool = SketchTool.Line;
      service.onCanvasClick({ x: 10, y: 10 });
      service.onCanvasClick({ x: 50, y: 50 });
      service.activeTool = SketchTool.Select;

      const pt = store.state.sketch.points[0]; // (10, 10)
      service.onCanvasMouseDown({ x: 10, y: 10 }); // grab it
      service.onCanvasMouseMove({ x: 30, y: 20 }); // drag
      service.onCanvasMouseUp();

      expect(pt.x).toBe(30);
      expect(pt.y).toBe(20);
    });

    it('should update connected line endpoints when a point is moved', () => {
      const { service, store } = makeSelectService();
      service.activeTool = SketchTool.Line;
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 100, y: 100 });
      service.activeTool = SketchTool.Select;

      const line = store.state.sketch.lines[0];
      const startPt = line.start; // object reference at (0,0)

      service.onCanvasMouseDown({ x: 0, y: 0 });
      service.onCanvasMouseMove({ x: 40, y: 40 });
      service.onCanvasMouseUp();

      // The line's start object is the same reference — coordinates updated in place
      expect(line.start.x).toBe(40);
      expect(line.start.y).toBe(40);
      expect(startPt).toBe(line.start);
    });

    it('should not move a point when no point is grabbed', () => {
      const { service, store } = makeSelectService();
      service.activeTool = SketchTool.Line;
      service.onCanvasClick({ x: 50, y: 50 });
      service.onCanvasClick({ x: 100, y: 100 });
      service.activeTool = SketchTool.Select;

      // Mouse down far from any point
      service.onCanvasMouseDown({ x: 200, y: 200 });
      service.onCanvasMouseMove({ x: 250, y: 250 });
      service.onCanvasMouseUp();

      const pts = store.state.sketch.points;
      expect(pts[0].x).toBe(50);
      expect(pts[1].x).toBe(100);
    });

    it('should not drag when Line tool is active', () => {
      const { service, store } = makeService(); // Line tool active
      service.onCanvasClick({ x: 50, y: 50 });
      service.onCanvasClick({ x: 100, y: 100 });

      service.onCanvasMouseDown({ x: 50, y: 50 });
      service.onCanvasMouseMove({ x: 99, y: 99 });
      service.onCanvasMouseUp();

      expect(store.state.sketch.points[0].x).toBe(50);
    });

    it('startDrag() called directly with exact point coords initiates drag (dot mousedown path)', () => {
      const { service, store } = makeSelectService();
      service.activeTool = SketchTool.Line;
      service.onCanvasClick({ x: 10, y: 20 });
      service.onCanvasClick({ x: 80, y: 80 });
      service.activeTool = SketchTool.Select;

      const pt = store.state.sketch.points[0]; // (10, 20)
      service.startDrag({ x: pt.x, y: pt.y }); // simulates dot mousedown
      service.onCanvasMouseMove({ x: 55, y: 65 });
      service.onCanvasMouseUp();

      expect(pt.x).toBe(55);
      expect(pt.y).toBe(65);
    });

    it('selects the endpoint when a select drag starts near a line endpoint', () => {
      const { service, store } = makeSelectService();
      service.activeTool = SketchTool.Line;
      service.onCanvasClick({ x: 120, y: 120 });
      service.onCanvasClick({ x: 200, y: 120 });
      service.activeTool = SketchTool.Select;

      const startPoint = store.state.sketch.points[0];
      const line = store.state.sketch.lines[0];

      service.startDrag({ x: 124, y: 120 });

      expect(service._dragPoint).toBe(startPoint);
      expect(startPoint.isSelected).toBe(true);
      expect(line.isSelected).toBe(false);
    });

    it('should snap a dragged point to a nearby point and create a coincident constraint', () => {
      const { service, store } = makeSelectService();
      service.activeTool = SketchTool.Line;
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 50, y: 0 });
      service.onCanvasClick({ x: 100, y: 0 });
      service.onCanvasClick({ x: 150, y: 0 });
      service.activeTool = SketchTool.Select;

      const dragged = store.state.sketch.points[0];
      const target = store.state.sketch.points[2];

      service.onCanvasMouseDown({ x: dragged.x, y: dragged.y });
      service.onCanvasMouseMove({ x: target.x - 4, y: target.y + 1 });
      service.onCanvasMouseUp();

      expect(dragged.x).toBe(target.x);
      expect(dragged.y).toBe(target.y);
      expect(store.state.sketch.constraints.some((c) => c?.type === 'Coincident')).toBe(true);
    });

    it('should not snap a dragged point when ctrl is held', () => {
      const { service, store } = makeSelectService();
      service.activeTool = SketchTool.Line;
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 50, y: 0 });
      service.onCanvasClick({ x: 100, y: 0 });
      service.onCanvasClick({ x: 150, y: 0 });
      service.activeTool = SketchTool.Select;

      const dragged = store.state.sketch.points[0];
      const target = store.state.sketch.points[2];

      service.onCanvasMouseDown({ x: dragged.x, y: dragged.y }, { snapEnabled: false });
      service.onCanvasMouseMove({ x: target.x - 4, y: target.y + 1 }, { snapEnabled: false });
      service.onCanvasMouseUp();

      expect(dragged.x).toBe(96);
      expect(dragged.y).toBe(1);
      expect(store.state.sketch.constraints.some((c) => c?.type === 'Coincident')).toBe(false);
    });
  });

  describe('Angle snap', () => {
    it('should snap near-horizontal to exact horizontal', () => {
      const { service } = makeService();
      service.onCanvasClick({ x: 0, y: 100 }); // start
      service.onCanvasMouseMove({ x: 50, y: 103 }); // ~3deg slope
      // Preview end should be at (50, 100) — snapped to horizontal
      const preview = service.store.state.sketch.previewLine;
      expect(preview.end.y).toBe(100);
    });

    it('should snap near-vertical to exact vertical', () => {
      const { service } = makeService();
      service.onCanvasClick({ x: 100, y: 0 }); // start
      service.onCanvasMouseMove({ x: 97, y: 50 }); // ~3deg slope
      const preview = service.store.state.sketch.previewLine;
      expect(preview.end.x).toBe(100);
    });
  });

  describe('Dimension tool', () => {
    it('ignores clicks that are not on an existing point', () => {
      const store = new Store();
      store.set('sketch.isActive', true);
      const service = new SketchService(store);
      service.activeTool = SketchTool.Dimension;
      service.onCanvasClick({ x: 10, y: 10 });
      expect(store.state.sketch.points.length).toBe(0);
      expect(store.state.sketch.dimensions.length).toBe(0);
      service.onCanvasClick({ x: 20, y: 20 });
      expect(store.state.sketch.points.length).toBe(0);
      expect(store.state.sketch.dimensions.length).toBe(0);
    });

    it('two clicks create a dimension between two points', () => {
      const { service, store } = makeDimensionService();
      service.onCanvasClick({ x: 0, y: 0 });   // first click — sets _dimPendingA
      expect(store.state.sketch.dimensions.length).toBe(0);
      expect(store.state.sketch.points[0].isSelected).toBe(true);
      service.onCanvasClick({ x: 60, y: 0 });  // second click — commits
      expect(store.state.sketch.dimensions.length).toBe(1);
      expect(store.state.sketch.points[0].isSelected).toBe(false);
      expect(store.state.sketch.points[1].isSelected).toBe(false);
    });

    it('horizontal 60px dimension has correct labelText', () => {
      const { service, store } = makeDimensionService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });
      const dim = store.state.sketch.dimensions[0];
      expect(dim.labelText).toBe('60.0');
      expect(dim.kind).toBe('Horizontal');
    });

    it('vertical dimension is detected correctly', () => {
      const { service, store } = makeDimensionService({ x: 0, y: 0 }, { x: 0, y: 80 });
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 0, y: 80 });
      const dim = store.state.sketch.dimensions[0];
      expect(dim.kind).toBe('Vertical');
      expect(dim.labelText).toBe('80.0');
    });

    it('aligned dimension is detected for diagonal', () => {
      const { service, store } = makeDimensionService({ x: 0, y: 0 }, { x: 40, y: 30 });
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 40, y: 30 });
      const dim = store.state.sketch.dimensions[0];
      expect(dim.kind).toBe('Aligned');
      expect(dim.labelText).toBe('50.0'); // 3-4-5 triangle * 10
    });

    it('cancelCurrentLine clears _dimPendingA and removes orphan point', () => {
      const { service, store } = makeDimensionService();
      service.onCanvasClick({ x: 0, y: 0 }); // sets _dimPendingA on an existing point
      expect(store.state.sketch.points.length).toBe(2);
      service.cancelCurrentLine();
      expect(service._dimPendingA).toBeNull();
      expect(store.state.sketch.points.length).toBe(2);
    });

    it('label text live-updates after recompute() when point moves', () => {
      const { service, store } = makeDimensionService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });
      const dim = store.state.sketch.dimensions[0];
      expect(dim.labelText).toBe('60.0');
      dim.b.x = 80;
      dim.recompute();
      expect(dim.labelText).toBe('80.0');
    });

    it('dimension appears in the objects list with kind label', () => {
      const { service, store } = makeDimensionService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });
      const obj = store.state.sketch.objects.find(o => o.kind === 'Dimension');
      expect(obj).toBeDefined();
      expect(obj.label).toContain('[H]');
    });

    it('object list rows can select a dimension by reference', () => {
      const { service, store } = makeDimensionService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });

      const obj = store.state.sketch.objects.find((candidate) => candidate.refType === 'dimension');
      service.selectObjectByRef(obj.refType, obj.refId);

      expect(store.state.sketch.dimensions[0].isSelected).toBe(true);
      expect(service.hasSelection).toBe(true);
    });

    it('keeps a constrained dimension length when an endpoint is dragged', () => {
      const { service, store } = makeDimensionService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });
      const dim = store.state.sketch.dimensions[0];

      service._applyDimConstraint(dim, 80);
      expect(dim.isConstrained).toBe(true);

      const start = dim.a;
      const end = dim.b;
      const originalLength = Math.hypot(end.x - start.x, end.y - start.y);

      service.activeTool = SketchTool.Select;
      service.onCanvasMouseDown({ x: start.x, y: start.y });
      service.onCanvasMouseMove({ x: 20, y: 20 });
      service.onCanvasMouseUp();

      const movedLength = Math.hypot(end.x - start.x, end.y - start.y);
      expect(movedLength).toBeCloseTo(originalLength, 5);
      expect(dim.labelText).toContain('80.0');
    });

    it('removes the dimension when the edit overlay is cancelled', () => {
      const { service, store } = makeDimensionService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });

      expect(store.state.sketch.dimensions.length).toBe(1);
      expect(store.state.sketch.pendingDimEdit).not.toBeNull();

      store.state.sketch.pendingDimEdit.onCancel();

      expect(store.state.sketch.dimensions.length).toBe(0);
      expect(store.state.sketch.pendingDimEdit).toBeNull();
      expect(store.state.sketch.objects.some((object) => object.kind === SketchObjectKind.Dimension)).toBe(false);
    });

    it('keeps the dimension when the edit overlay is confirmed', () => {
      const { service, store } = makeDimensionService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });

      const pendingEdit = store.state.sketch.pendingDimEdit;
      pendingEdit.onConfirm(80);

      expect(store.state.sketch.dimensions.length).toBe(1);
      expect(store.state.sketch.dimensions[0].isConstrained).toBe(true);
      expect(store.state.sketch.pendingDimEdit).toBeNull();
    });

    it('snaps to existing point within snap radius on second click', () => {
      const { service, store } = makeDimensionService({ x: 50, y: 50 }, { x: 100, y: 50 });
      service.onCanvasClick({ x: 50, y: 50 });
      service.onCanvasClick({ x: 99, y: 50 }); // snaps to (100,50)
      const dim = store.state.sketch.dimensions[0];
      expect(dim.b.x).toBe(100);
      expect(dim.b.y).toBe(50);
    });
  });

  describe('Find nearest point', () => {
    it('should reuse an existing point within 12px', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 50, y: 50 });
      service.onCanvasClick({ x: 100, y: 100 });
      const p1 = store.state.sketch.points[0];
      const near = service._findNearestPoint({ x: 52, y: 51 });
      expect(near).toBe(p1);
    });

    it('should return null when no point is within 12px', () => {
      const { service } = makeService();
      service.onCanvasClick({ x: 50, y: 50 });
      const near = service._findNearestPoint({ x: 200, y: 200 });
      expect(near).toBeNull();
    });
  });

  describe('Constraint tool', () => {
    it('creates a perpendicular constraint from a shared endpoint', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });
      service.onCanvasClick({ x: 60, y: 60 });

      service.activeTool = SketchTool.Constraint;
      service.constraintSubMode = ConstraintSubMode.Perpendicular;
      service.onCanvasClick({ x: 60, y: 0 });

      expect(store.state.sketch.constraints).toHaveLength(1);
      expect(store.state.sketch.constraints[0].type).toBe('Perpendicular');
      expect(store.state.sketch.objects.some((object) => object.kind === SketchObjectKind.Perpendicular)).toBe(true);
    });

    it('keeps constrained lines perpendicular when a free endpoint is dragged', () => {
      const { service, store } = makeService();
      service.onCanvasClick({ x: 0, y: 0 });
      service.onCanvasClick({ x: 60, y: 0 });
      service.onCanvasClick({ x: 60, y: 60 });

      service.activeTool = SketchTool.Constraint;
      service.constraintSubMode = ConstraintSubMode.Perpendicular;
      service.onCanvasClick({ x: 60, y: 0 });

      const movedPoint = store.state.sketch.points[2];
      service.activeTool = SketchTool.Select;
      service.onCanvasMouseDown({ x: movedPoint.x, y: movedPoint.y });
      service.onCanvasMouseMove({ x: 95, y: 50 });
      service.onCanvasMouseUp();

      const sharedPoint = store.state.sketch.points[1];
      const fixedPoint = store.state.sketch.points[0];
      const vecA = { x: fixedPoint.x - sharedPoint.x, y: fixedPoint.y - sharedPoint.y };
      const vecB = { x: movedPoint.x - sharedPoint.x, y: movedPoint.y - sharedPoint.y };
      const dot = vecA.x * vecB.x + vecA.y * vecB.y;

      expect(dot).toBeCloseTo(0, 5);
    });
  });
});
