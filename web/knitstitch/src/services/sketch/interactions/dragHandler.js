export function startDrag(service, position, modifiers = {}) {
    const near = service._findNearestPoint(position, modifiers.snapEnabled !== false);
    if (near) {
      service._dragPoint = near;
      service.selectPoint(near);
      service._history.beginDrag();
    } else {
      service._dragPoint = null;
      service._history.cancelDrag();
    }
}
export function onCanvasMouseUp(service, ) {
    service._history.endDrag();
    const draggedPoint = service._dragPoint;
    service._dragPoint = null;
    if (draggedPoint) {
      // Recompute dimension kinds once the drag is finished so Horizontal/Vertical
      // kinds only take effect after the user has released the point.
      for (const dim of service.store.state.sketch.dimensions) dim.recompute();
      const movedPoints = new Set([draggedPoint]);
      if (service._useGlobalSolver) {
        service._globalConstraintSolver.solve(service.store.state.sketch, movedPoints);
      } else {
        service._constraintSolver.solveConstraintsForPoint(
          service.store.state.sketch,
          draggedPoint,
          null,
          {}
        );
      }
      service._flushSketchArrays(this);
      service._rebuildObjects(this);
    }
}
export function onSelectMouseMove(service, position, modifiers = {}) {
    if (!service._dragPoint) return;
    const originalPosition = { x: service._dragPoint.x, y: service._dragPoint.y };
    service._dragPoint.x = position.x;
    service._dragPoint.y = position.y;
    
    if (service._useGlobalSolver) {
      // Global solver handles all constraints simultaneously
      const movedPoints = new Set([service._dragPoint]);
      const result = service._globalConstraintSolver.solve(service.store.state.sketch, movedPoints);

      // If global solver returns null (too many driven dimensions), fall back to local solver
      if (result === null) {
        service._constraintSolver.solveConstraintsForPoint(
          service.store.state.sketch,
          service._dragPoint,
          originalPosition,
          modifiers
        );
      }
    } else {
      // Local solver (current approach)
      service._constraintSolver.solveConstraintsForPoint(
        service.store.state.sketch,
        service._dragPoint,
        originalPosition,
        modifiers
      );
    }

    service._assignConstraintIds(this);
    // During a drag, preserve the dimension kind so the solver doesn't switch a
    // dimension to Horizontal/Vertical and lock the line before the user releases.
    for (const dim of service.store.state.sketch.dimensions) dim.recompute(true);

    service._flushSketchArrays(this);
    service._rebuildObjects(this);
}