/**
 * Pure geometry helpers shared across sketch services.
 */

/**
 * Euclidean distance between two points.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @returns {number}
 */
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Returns the nearest point in `points` within `snapRadius` of `position`,
 * optionally excluding one point. Returns null if none found.
 * @param {Array<{x:number,y:number}>} points
 * @param {{x:number,y:number}} position
 * @param {number} snapRadius
 * @param {{x:number,y:number}|null} excludePoint
 * @returns {{x:number,y:number}|null}
 */
export function nearestPoint(points, position, snapRadius, excludePoint = null) {
  let best = null;
  let bestDist = snapRadius;
  for (const p of points || []) {
    if (p === excludePoint) continue;
    const d = distance(p, position);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/**
 * Snaps `end` to horizontal or vertical relative to `start` when within
 * `thresholdDeg` of those axes. Returns the (possibly snapped) position.
 * @param {{x:number,y:number}} start
 * @param {{x:number,y:number}} end
 * @param {number} thresholdDeg
 * @returns {{x:number,y:number}}
 */
export function applyAngleSnap(start, end, thresholdDeg) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angleDeg = Math.abs(Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI);
  if (angleDeg <= thresholdDeg) return { x: end.x, y: start.y };
  if (angleDeg >= 90 - thresholdDeg) return { x: start.x, y: end.y };
  return { x: end.x, y: end.y };
}
export function findSharedPoint(lineA, lineB) {
  if (!lineA || !lineB) return null;
  if (lineA.start === lineB.start || lineA.start === lineB.end) return lineA.start;
  if (lineA.end === lineB.start || lineA.end === lineB.end) return lineA.end;
  return null;
}
export function findLinesForPoint(point, lines) {
  return lines.filter((line) => line.start === point || line.end === point);
}
