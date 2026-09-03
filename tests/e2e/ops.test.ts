import { describe, expect, it } from "vitest";

/**
 * Operations console acceptance checks.
 *
 * Verifies the three new surfaces over HTTP against a running server with a
 * seeded database. Skipped unless:
 *
 *   npm run db:reset && npm run dev &
 *   RUN_E2E=1 E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ENABLED = process.env.RUN_E2E === "1";

async function get<T>(path: string): Promise<{ status: number; body: { data?: T; error?: { code: string } } }> {
  const response = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : undefined;
  return { status: response.status, body };
}

describe.skipIf(!ENABLED)("operations console", () => {
  it("serves the ops wall built from live records", async () => {
    const { status, body } = await get<{
      units: Array<{ id: string; callsign: string }>;
      incidents: Array<{ id: string; reference: string }>;
      calls: Array<{ id: string; assigned: Array<{ callsign: string }> }>;
      events: Array<{ id: string; label: string }>;
      metrics: Record<string, number | null>;
      districts: Array<{ name: string; latitude: number }>;
    }>("/api/ops-wall");

    expect(status).toBe(200);
    expect(body.data?.units.length).toBeGreaterThan(0);
    expect(body.data?.districts.length).toBeGreaterThan(0);
    expect(typeof body.data?.metrics.readiness).toBe("number");
    expect(body.data?.metrics.unitTotal).toBe(body.data?.units.length);
    for (const unit of body.data?.units ?? []) expect(unit.callsign).toBeTruthy();
    for (const incident of body.data?.incidents ?? []) expect(incident.reference).toBeTruthy();
  });

  it("generates a shift briefing for the requested period", async () => {
    const { status, body } = await get<{
      period: { hours: number };
      summary: { incidentsOpened: number; incidentsStillOpen: number; callsReceived: number; byPriority: Array<{ label: string; value: number }> };
      units: { total: number; roster: Array<{ callsign: string }> };
      lookouts: Array<{ id: string }>;
      warrants: Array<{ id: string }>;
    }>("/api/briefing?hours=24");

    expect(status).toBe(200);
    expect(body.data?.period.hours).toBe(24);
    expect(typeof body.data?.summary.incidentsOpened).toBe("number");
    expect(typeof body.data?.summary.incidentsStillOpen).toBe("number");
    expect(body.data?.units.total).toBeGreaterThan(0);
  });

  it("builds an association graph around a real record", async () => {
    const people = await get<{ rows: Array<{ id: string }> }>("/api/people?pageSize=1");
    expect(people.status).toBe(200);
    const person = people.body.data?.rows[0];
    expect(person, "the seed should include at least one person").toBeTruthy();

    const { status, body } = await get<{
      centre: { type: string; label: string };
      nodes: Array<{ id: string; type: string; depth: number }>;
      edges: Array<{ source: string; target: string; relation: string }>;
    }>(`/api/link-analysis?type=person&id=${person!.id}&depth=2`);

    expect(status).toBe(200);
    expect(body.data?.centre.type).toBe("person");
    expect(body.data?.nodes[0]?.depth).toBe(0);
    for (const node of body.data?.nodes ?? []) expect(["person", "vehicle", "incident", "case", "evidence"]).toContain(node.type);
  });

  it("rejects an unknown record type in link analysis", async () => {
    const { status } = await get("/api/link-analysis?type=spaceship&id=123");
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it("serves temporal and per-metric analytics", async () => {
    const { status, body } = await get<{
      heatmap: { matrix: number[][]; max: number; total: number };
      series: { days: string[]; series: Record<string, number[]> };
    }>("/api/analytics?heatmap=true&series=true");

    expect(status).toBe(200);
    expect(body.data?.heatmap.matrix).toHaveLength(7);
    expect(body.data?.heatmap.matrix[0]).toHaveLength(24);
    expect(body.data?.series.days.length).toBeGreaterThan(1);
    for (const values of Object.values(body.data?.series.series ?? {})) {
      expect(values).toHaveLength(body.data!.series.days.length);
      for (const value of values) expect(typeof value).toBe("number");
    }
  });

  it("renders the new console pages", async () => {
    for (const path of ["/ops", "/associations", "/briefing"]) {
      const response = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
      expect(response.status, `${path} should render`).toBe(200);
    }
  });
});
