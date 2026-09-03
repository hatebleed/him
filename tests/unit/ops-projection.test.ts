import { describe, expect, it } from "vitest";

import { binByDayAndHour, declutter, distance, extendBounds, flattenMatrix, layoutGraph, padBounds, project } from "@/components/ops/projection";

describe("sector projection", () => {
  it("grows bounds to include every point", () => {
    let bounds = null;
    bounds = extendBounds(bounds, { lat: 51.5, lng: -0.1 });
    bounds = extendBounds(bounds, { lat: 51.6, lng: -0.2 });
    bounds = extendBounds(bounds, { lat: 51.4, lng: 0.1 });
    expect(bounds).toEqual({ minLat: 51.4, maxLat: 51.6, minLng: -0.2, maxLng: 0.1 });
  });

  it("keeps degenerate bounds usable (a single point still projects)", () => {
    const bounds = padBounds({ minLat: 51.5, maxLat: 51.5, minLng: -0.1, maxLng: -0.1 });
    expect(bounds.maxLat).toBeGreaterThan(bounds.minLat);
    const point = project({ lat: 51.5, lng: -0.1 }, bounds, { width: 400, height: 300 }, 0);
    expect(point.x).toBeGreaterThanOrEqual(0);
    expect(point.x).toBeLessThanOrEqual(400);
  });

  it("projects inside the viewport and preserves relative order", () => {
    const bounds = padBounds({ minLat: 51.4, maxLat: 51.6, minLng: -0.3, maxLng: 0.1 });
    const south = project({ lat: 51.4, lng: 0 }, bounds, { width: 800, height: 600 }, 20);
    const north = project({ lat: 51.6, lng: 0 }, bounds, { width: 800, height: 600 }, 20);
    // Latitude increases upwards on screen.
    expect(north.y).toBeLessThan(south.y);
    expect(north.y).toBeGreaterThanOrEqual(20);
    expect(south.y).toBeLessThanOrEqual(580);
  });

  it("pushes overlapping marks apart", () => {
    const items = [
      { id: "a", x: 100, y: 100 },
      { id: "b", x: 101, y: 100 },
      { id: "c", x: 400, y: 300 },
    ];
    const spread = declutter(items, 40);
    expect(distance(spread[0]!, spread[1]!)).toBeGreaterThan(30);
    expect(spread[2]!.x).toBeCloseTo(400, 5);
  });
});

describe("temporal binning", () => {
  it("bins dates by weekday and hour with Monday first", () => {
    // 2026-09-02 is a Wednesday; 14:30 local-independent UTC hour.
    const { matrix, max, total } = binByDayAndHour([new Date("2026-09-02T14:30:00Z"), new Date("2026-09-02T14:59:00Z"), new Date("2026-09-05T03:00:00Z")]);
    expect(matrix).toHaveLength(7);
    expect(matrix[0]).toHaveLength(24);
    const wednesday = 2;
    expect(matrix[wednesday]![14]).toBe(2);
    expect(total).toBe(3);
    expect(max).toBe(2);
    // Every value lands somewhere in the matrix.
    expect(flattenMatrix(matrix).reduce((sum, cell) => sum + cell.value, 0)).toBe(3);
  });

  it("ignores empty values", () => {
    const { total } = binByDayAndHour([null, undefined, ""]);
    expect(total).toBe(0);
  });
});

describe("graph layout", () => {
  it("places the centre first and keeps every node on screen", () => {
    const nodes = [
      { id: "a", label: "A", type: "person", depth: 0, weight: 1 },
      { id: "b", label: "B", type: "incident", depth: 1, weight: 1 },
      { id: "c", label: "C", type: "vehicle", depth: 1, weight: 1 },
      { id: "d", label: "D", type: "case", depth: 2, weight: 1 },
    ];
    const edges = [
      { source: "a", target: "b", relation: "witness" },
      { source: "a", target: "c", relation: "driver" },
      { source: "b", target: "d", relation: "case" },
    ];
    const { nodes: placed, edges: kept } = layoutGraph(nodes, edges, { width: 800, height: 600 });
    expect(placed).toHaveLength(4);
    expect(kept).toHaveLength(3);
    for (const node of placed) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(800);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(600);
    }
  });

  it("is deterministic for the same input", () => {
    const nodes = [
      { id: "a", label: "A", type: "person", depth: 0, weight: 1 },
      { id: "b", label: "B", type: "incident", depth: 1, weight: 1 },
    ];
    const edges = [{ source: "a", target: "b", relation: "witness" }];
    const first = layoutGraph(nodes, edges, { width: 600, height: 400 });
    const second = layoutGraph(nodes, edges, { width: 600, height: 400 });
    expect(second.nodes).toEqual(first.nodes);
  });
});
