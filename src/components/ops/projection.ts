/**
 * Geometry and aggregation helpers for the operations console.
 *
 * Pure and dependency-free so the layout maths can be unit tested: turning
 * coordinates into screen positions, binning incidents into a day/hour matrix
 * and laying out a relationship graph.
 */

export type Point = { lat: number; lng: number };
export type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };
export type Size = { width: number; height: number };
export type XY = { x: number; y: number };

/** Expands bounds to include a point. */
export function extendBounds(bounds: Bounds | null, point: Point): Bounds {
  if (!bounds) return { minLat: point.lat, maxLat: point.lat, minLng: point.lng, maxLng: point.lng };
  return {
    minLat: Math.min(bounds.minLat, point.lat),
    maxLat: Math.max(bounds.maxLat, point.lat),
    minLng: Math.min(bounds.minLng, point.lng),
    maxLng: Math.max(bounds.maxLng, point.lng),
  };
}

/**
 * Pads bounds by a fraction of their span, and gives degenerate bounds
 * (a single point, or none) a usable area so nothing divides by zero.
 */
export function padBounds(bounds: Bounds | null, fraction = 0.12): Bounds {
  if (!bounds) return { minLat: 51.4, maxLat: 51.6, minLng: -0.25, maxLng: 0.05 };
  const latSpan = bounds.maxLat - bounds.minLat || 0.05;
  const lngSpan = bounds.maxLng - bounds.minLng || 0.05;
  return {
    minLat: bounds.minLat - latSpan * fraction,
    maxLat: bounds.maxLat + latSpan * fraction,
    minLng: bounds.minLng - lngSpan * fraction,
    maxLng: bounds.maxLng + lngSpan * fraction,
  };
}

/**
 * Equirectangular projection into a box, preserving the aspect ratio of the
 * bounds so the sector view is not distorted.
 */
export function project(point: Point, bounds: Bounds, size: Size, padding = 0): XY {
  const latSpan = bounds.maxLat - bounds.minLat || 1;
  const lngSpan = bounds.maxLng - bounds.minLng || 1;
  const usableW = Math.max(size.width - padding * 2, 1);
  const usableH = Math.max(size.height - padding * 2, 1);

  const rawX = ((point.lng - bounds.minLng) / lngSpan) * usableW;
  const rawY = ((bounds.maxLat - point.lat) / latSpan) * usableH;

  return { x: rawX + padding, y: rawY + padding };
}

/** Distance in screen units, used for de-clustering overlapping markers. */
export function distance(a: XY, b: XY): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Nudges overlapping markers apart so every unit stays readable.
 * Deterministic: the same input always produces the same output.
 */
export function declutter<T extends { id: string; x: number; y: number }>(items: T[], minDistance = 22, iterations = 60): T[] {
  const points = items.map((item) => ({ ...item }));
  for (let pass = 0; pass < iterations; pass += 1) {
    let moved = false;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i]!;
        const b = points[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        if (dist >= minDistance) continue;
        const push = (minDistance - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return points;
}

// ---------------------------------------------------------------------------
// Temporal heat map
// ---------------------------------------------------------------------------

export type HeatmapCell = { day: number; hour: number; value: number };

/**
 * Bins timestamps into a 7 x 24 matrix (day of week x hour of day).
 * Week starts on Monday to match an operational week.
 */
export function binByDayAndHour(dates: Array<Date | string | null | undefined>): { matrix: number[][]; max: number; total: number } {
  const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  let total = 0;

  for (const value of dates) {
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    // JS day: 0 = Sunday. Shift so Monday is index 0.
    const day = (date.getDay() + 6) % 7;
    const hour = date.getHours();
    matrix[day]![hour]! += 1;
    total += 1;
  }

  let max = 0;
  for (const row of matrix) for (const cell of row) max = Math.max(max, cell);
  return { matrix, max, total };
}

/** Flattens a matrix into labelled cells for rendering. */
export function flattenMatrix(matrix: number[][]): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  matrix.forEach((row, day) => row.forEach((value, hour) => cells.push({ day, hour, value })));
  return cells;
}

// ---------------------------------------------------------------------------
// Relationship graph layout
// ---------------------------------------------------------------------------

export type GraphNode = { id: string; label: string; type: string; depth: number; weight: number };
export type GraphEdge = { source: string; target: string; relation: string };
export type PositionedNode = GraphNode & XY;

/** Stable pseudo-random value from a string, so layouts do not jump between renders. */
function hashUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

/**
 * Lays a relationship graph out radially by depth, then relaxes it with a
 * short deterministic force pass: rings keep the structure legible, the
 * relaxation stops labels colliding.
 */
export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  size: Size,
  options: { ringGap?: number; iterations?: number } = {},
): { nodes: PositionedNode[]; edges: GraphEdge[] } {
  const ringGap = options.ringGap ?? Math.min(size.width, size.height) * 0.19;
  const iterations = options.iterations ?? 140;
  const cx = size.width / 2;
  const cy = size.height / 2;

  const byDepth = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    const list = byDepth.get(node.depth) ?? [];
    list.push(node);
    byDepth.set(node.depth, list);
  }

  const positioned: PositionedNode[] = [];
  for (const [depth, group] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) {
      for (const node of group) positioned.push({ ...node, x: cx, y: cy });
      continue;
    }
    const radius = ringGap * depth;
    // Nodes with more connections sit at a stable angle; the rest spread evenly.
    group.forEach((node, index) => {
      const jitter = (hashUnit(node.id) - 0.5) * 0.22;
      const angle = ((index + 0.5) / group.length + jitter) * Math.PI * 2;
      positioned.push({
        ...node,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.82,
      });
    });
  }

  const index = new Map(positioned.map((node, i) => [node.id, i]));
  const centre = positioned.find((node) => node.depth === 0);

  for (let pass = 0; pass < iterations; pass += 1) {
    // Attraction along edges keeps related nodes near each other.
    for (const edge of edges) {
      const a = positioned[index.get(edge.source)!];
      const b = positioned[index.get(edge.target)!];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const target = Math.abs(a.depth - b.depth) === 0 ? 90 : ringGap;
      const force = ((dist - target) / dist) * 0.06;
      a.x += dx * force;
      a.y += dy * force;
      b.x -= dx * force;
      b.y -= dy * force;
    }

    // Repulsion between every pair keeps labels readable.
    for (let i = 0; i < positioned.length; i += 1) {
      for (let j = i + 1; j < positioned.length; j += 1) {
        const a = positioned[i]!;
        const b = positioned[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const min = a.depth === b.depth ? 96 : 68;
        if (dist >= min) continue;
        const push = ((min - dist) / dist) * 0.18;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }

    // The focal record stays pinned to the middle.
    if (centre) {
      centre.x += (cx - centre.x) * 0.25;
      centre.y += (cy - centre.y) * 0.25;
    }
  }

  // Keep everything inside the viewport.
  const margin = 46;
  for (const node of positioned) {
    node.x = Math.min(Math.max(node.x, margin), size.width - margin);
    node.y = Math.min(Math.max(node.y, margin), size.height - margin);
  }

  return { nodes: positioned, edges };
}
