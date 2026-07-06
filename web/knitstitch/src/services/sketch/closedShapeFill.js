/**
 * Closed-shape cell fill logic.
 *
 * Given the current sketch lines, finds closed loops (cycles) in the line
 * graph and determines which grid cells are 50%+ inside any closed polygon.
 *
 * A cell is counted as filled when at least half of its area falls inside a
 * closed shape.  This naturally handles cells that a line crosses: if the
 * line cuts a cell so that 50%+ of the cell is inside the shape, the whole
 * cell is filled.
 */

const EPSILON = 0.01;

/**
 * Compute the set of grid cell indices that should be filled because they
 * are 50%+ inside a closed shape formed by the sketch lines.
 *
 * @param {Array<{start:{x:number,y:number},end:{x:number,y:number}}>} lines
 * @param {number} cols
 * @param {number} rows
 * @param {number} cellW
 * @param {number} cellH
 * @returns {Set<number>} indices of cells to fill
 */
export function computeFilledCellsFromSketch(lines, cols, rows, cellW, cellH) {
  if (!lines || lines.length < 3 || cols <= 0 || rows <= 0 || cellW <= 0 || cellH <= 0) {
    return new Set();
  }

  const polygons = findClosedPolygons(lines);
  if (polygons.length === 0) return new Set();

  const filled = new Set();
  const samples = 4;
  const total = samples * samples;
  const half = total / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * cellW;
      const y0 = r * cellH;
      let insideCount = 0;
      for (let sy = 0; sy < samples && insideCount < half; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x0 + (sx + 0.5) * cellW / samples;
          const py = y0 + (sy + 0.5) * cellH / samples;
          if (pointInAnyPolygon(px, py, polygons)) {
            insideCount++;
          }
        }
      }
      if (insideCount >= half) {
        filled.add(r * cols + c);
      }
    }
  }
  return filled;
}

/**
 * Finds all minimal closed polygons (cycles) in the line graph.
 *
 * Points are matched by coordinates (within a small epsilon) so the result
 * is robust even when object identity is lost (e.g. after undo restore).
 *
 * @param {Array<{start:{x:number,y:number},end:{x:number,y:number}}>} lines
 * @returns {Array<Array<{x:number,y:number}>>}
 */
export function findClosedPolygons(lines) {
  if (!lines || lines.length < 3) return [];

  // Build a coordinate-keyed node map and an adjacency list.
  const nodeKey = (p) => `${round(p.x)},${round(p.y)}`;
  const nodes = new Map(); // key -> { x, y }
  const adj = new Map(); // key -> Array<{ key, line }>

  const ensureNode = (p) => {
    const key = nodeKey(p);
    if (!nodes.has(key)) {
      nodes.set(key, { x: p.x, y: p.y });
      adj.set(key, []);
    }
    return key;
  };

  for (const line of lines) {
    const sk = ensureNode(line.start);
    const ek = ensureNode(line.end);
    if (sk === ek) continue; // degenerate zero-length line
    adj.get(sk).push({ key: ek, line });
    adj.get(ek).push({ key: sk, line });
  }

  const polygons = [];
  const seen = new Set();

  for (const line of lines) {
    const sk = nodeKey(line.start);
    const ek = nodeKey(line.end);
    if (sk === ek) continue;

    const path = bfsShortestPath(adj, ek, sk, line);
    if (!path || path.length < 2) continue;

    // path goes from ek to sk; polygon = [sk, ek, ...intermediate]
    const polyKeys = [sk, ...path.slice(0, -1)];
    const sig = signature(polyKeys);
    if (seen.has(sig)) continue;
    seen.add(sig);

    polygons.push(polyKeys.map((k) => nodes.get(k)));
  }

  return polygons;
}

/**
 * Breadth-first shortest path from `fromKey` to `toKey` that does not use
 * `excludedLine`. Returns an array of node keys (including both endpoints)
 * or null if no path exists.
 */
function bfsShortestPath(adj, fromKey, toKey, excludedLine) {
  const queue = [fromKey];
  const visited = new Set([fromKey]);
  const parent = new Map();

  while (queue.length > 0) {
    const node = queue.shift();
    if (node === toKey) {
      const path = [node];
      let cur = node;
      while (parent.has(cur)) {
        cur = parent.get(cur);
        path.unshift(cur);
      }
      return path;
    }
    const neighbors = adj.get(node) || [];
    for (const { key, line } of neighbors) {
      if (line === excludedLine) continue;
      if (visited.has(key)) continue;
      visited.add(key);
      parent.set(key, node);
      queue.push(key);
    }
  }
  return null;
}

/**
 * Ray-casting point-in-polygon test.
 */
function pointInPolygon(px, py, poly) {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = (yi > py) !== (yj > py)
      && px < (xj - xi) * (py - yi) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInAnyPolygon(px, py, polygons) {
  for (const poly of polygons) {
    if (pointInPolygon(px, py, poly)) return true;
  }
  return false;
}

/**
 * Produces a rotation- and direction-independent signature for a cycle so
 * duplicate detections of the same polygon can be skipped.
 */
function signature(keys) {
  const n = keys.length;
  let min = 0;
  for (let i = 1; i < n; i++) {
    if (keys[i] < keys[min]) min = i;
  }
  const fwd = [];
  const bwd = [];
  for (let i = 0; i < n; i++) {
    fwd.push(keys[(min + i) % n]);
    bwd.push(keys[(min - i + n) % n]);
  }
  const fwdStr = fwd.join('|');
  const bwdStr = bwd.join('|');
  return fwdStr < bwdStr ? fwdStr : bwdStr;
}

function round(v) {
  return Math.round(v / EPSILON) * EPSILON;
}
