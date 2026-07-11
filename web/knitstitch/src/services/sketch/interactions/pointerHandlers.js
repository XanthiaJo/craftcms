import { SketchTool } from '../constants.js';

export function onCanvasClick(service, position, modifiers = {}) {
    if (!service.isActive) return;
    if (service._suppressNextClick) {
      service._suppressNextClick = false;
      return;
    }
    switch (service.activeTool) {
      case SketchTool.Line:
      case SketchTool.ConstructionLine:
        service._lineTool.onLineClick(position, modifiers);
        break;
      case SketchTool.Select:
        service.clearSelection();
        break;
      case SketchTool.Dimension:
        service._dimensionTool.onDimensionClick(position, modifiers);
        break;
      case SketchTool.Constraint:
        service._constraintTool.onConstraintClick(position, modifiers);
        break;
      case SketchTool.Anchor:
        service._anchorTool.onClick(position, modifiers);
        break;
    }
}
export function onLineClick(service, line, position, modifiers = {}) {
    if (!service.isActive) return;
    const multiSelect = modifiers.multiSelect ?? false;
    if (service.activeTool === SketchTool.Select) {
      service.selectLine(line, multiSelect);
      return;
    }
    if (service.activeTool === SketchTool.Constraint) {
      service._constraintTool.onConstraintLineClick(line, multiSelect, position);
      return;
    }
    service.onCanvasClick(position, modifiers);
}
export function onPointClick(service, pt, position, modifiers = {}) {
    if (!service.isActive) return;
    const multiSelect = modifiers.multiSelect ?? false;
    if (service.activeTool === SketchTool.Select) {
      service.selectPoint(pt, multiSelect);
      return;
    }
    if (service.activeTool === SketchTool.Constraint) {
      service._constraintTool.onConstraintPointClick(pt, multiSelect, position);
      return;
    }
    if (service.activeTool === SketchTool.Anchor) {
      service._anchorTool.convertToAnchor(pt);
      return;
    }
    service.onCanvasClick(position ?? { x: pt.x, y: pt.y }, modifiers);
}
export function onCanvasMouseMove(service, position, modifiers = {}) {
    if (!service.isActive) return;
    switch (service.activeTool) {
      case SketchTool.Line:
      case SketchTool.ConstructionLine:
        service._lineTool.onLineMouseMove(position, modifiers);
        break;
      case SketchTool.Select:
        service._onSelectMouseMove(position, modifiers);
        break;
      case SketchTool.Dimension:
        service._setSnapCandidate(service._findNearestPoint(position, modifiers.snapEnabled !== false));
        break;
      case SketchTool.Constraint:
        service._setSnapCandidate(null);
        break;
      case SketchTool.Anchor:
        service._anchorTool.onMouseMove(position, modifiers);
        break;
    }
}
export function onRightMouseDown(service, ) {
    if (!service.isActive) return;
    service._suppressNextClick = true;
}
export function onCanvasMouseDown(service, position, modifiers = {}) {
    if (!service.isActive || service.activeTool !== SketchTool.Select) return;
    service.startDrag(position, modifiers);
}
export function exitToSelect(service, ) {
    service.cancelCurrentLine();
    service.clearSelection();
    service.store.set('sketch.activeTool', SketchTool.Select);
}