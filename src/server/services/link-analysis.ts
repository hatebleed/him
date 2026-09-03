import "server-only";

import { and, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { caseIncidents, cases, evidence, incidentParticipants, incidentVehicles, incidents, persons, recordRelationships, vehicles } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { assertCan, type RequestContext } from "@/server/context";

/**
 * Association analysis.
 *
 * Walks the links around one record - participation, vehicle involvement, case
 * membership and recorded relationships - and returns a graph. Types the
 * operator cannot view are dropped, so the graph can never be used to reach a
 * record they could not open.
 */

export type GraphNode = { id: string; label: string; type: string; depth: number; weight: number };
export type GraphEdge = { source: string; target: string; relation: string };

const VIEW_PERMISSION: Record<string, string> = {
  person: "people.view",
  vehicle: "vehicles.view",
  incident: "incidents.view",
  case: "cases.view",
  evidence: "evidence.view",
};

const TABLE_BY_TYPE = {
  person: persons,
  vehicle: vehicles,
  incident: incidents,
  case: cases,
  evidence: evidence,
} as const;

export type RecordType = keyof typeof TABLE_BY_TYPE;

function visible(ctx: RequestContext, type: string): boolean {
  const permission = VIEW_PERMISSION[type];
  return permission ? ctx.permissions.has(permission) : false;
}

async function loadLabel(type: RecordType, id: string): Promise<string | null> {
  if (type === "person") {
    const [row] = await db
      .select({ label: sql<string>`concat_ws(' ', ${persons.firstName}, ${persons.lastName})` })
      .from(persons)
      .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
      .limit(1);
    return row?.label ?? null;
  }
  if (type === "vehicle") {
    const [row] = await db
      .select({ label: sql<string>`concat_ws(' ', ${vehicles.make}, ${vehicles.model}, ${vehicles.registration})` })
      .from(vehicles)
      .where(and(eq(vehicles.id, id), isNull(vehicles.deletedAt)))
      .limit(1);
    return row?.label ?? null;
  }
  const table = TABLE_BY_TYPE[type];
  const [row] = await db
    .select({ label: type === "case" ? cases.title : type === "incident" ? incidents.title : evidence.description, reference: "reference" in table ? table.reference : sql<string>`null` })
    .from(table)
    .where(and(eq(table.id, id), isNull(table.deletedAt)))
    .limit(1);
  if (!row) return null;
  return row.reference ? `${row.reference}` : (row.label ?? null);
}

/** Records linked to one record, one hop. */
async function neighboursOf(ctx: RequestContext, type: RecordType, id: string): Promise<Array<{ node: GraphNode; relation: string }>> {
  const found: Array<{ node: GraphNode; relation: string }> = [];
  const push = (node: GraphNode, relation: string) => {
    if (node.id === id && node.type === type) return;
    if (!visible(ctx, node.type)) return;
    found.push({ node, relation });
  };

  if (type === "incident") {
    const [people, cars, caseLinks] = await Promise.all([
      db
        .select({ id: persons.id, label: sql<string>`concat_ws(' ', ${persons.firstName}, ${persons.lastName})`, role: incidentParticipants.role })
        .from(incidentParticipants)
        .innerJoin(persons, eq(persons.id, incidentParticipants.personId))
        .where(and(eq(incidentParticipants.incidentId, id), isNull(persons.deletedAt)))
        .limit(50),
      db
        .select({ id: vehicles.id, label: sql<string>`concat_ws(' ', ${vehicles.make}, ${vehicles.model}, ${vehicles.registration})` })
        .from(incidentVehicles)
        .innerJoin(vehicles, eq(vehicles.id, incidentVehicles.vehicleId))
        .where(and(eq(incidentVehicles.incidentId, id), isNull(vehicles.deletedAt)))
        .limit(50),
      db
        .select({ id: cases.id, label: cases.title, reference: cases.reference })
        .from(caseIncidents)
        .innerJoin(cases, eq(cases.id, caseIncidents.caseId))
        .where(and(eq(caseIncidents.incidentId, id), isNull(cases.deletedAt)))
        .limit(20),
    ]);
    for (const row of people) push({ id: row.id, label: row.label, type: "person", depth: 1, weight: 1 }, row.role.toLowerCase());
    for (const row of cars) push({ id: row.id, label: row.label, type: "vehicle", depth: 1, weight: 1 }, "vehicle");
    for (const row of caseLinks) push({ id: row.id, label: row.reference ?? row.label, type: "case", depth: 1, weight: 1 }, "case");
  }

  if (type === "person") {
    const links = await db
      .select({ id: incidents.id, label: incidents.reference, role: incidentParticipants.role })
      .from(incidentParticipants)
      .innerJoin(incidents, eq(incidents.id, incidentParticipants.incidentId))
      .where(and(eq(incidentParticipants.personId, id), isNull(incidents.deletedAt)))
      .limit(50);
    for (const row of links) push({ id: row.id, label: row.label, type: "incident", depth: 1, weight: 1 }, row.role.toLowerCase());
  }

  if (type === "vehicle") {
    const links = await db
      .select({ id: incidents.id, label: incidents.reference })
      .from(incidentVehicles)
      .innerJoin(incidents, eq(incidents.id, incidentVehicles.incidentId))
      .where(and(eq(incidentVehicles.vehicleId, id), isNull(incidents.deletedAt)))
      .limit(50);
    for (const row of links) push({ id: row.id, label: row.label, type: "incident", depth: 1, weight: 1 }, "incident");
  }

  if (type === "case") {
    const links = await db
      .select({ id: incidents.id, label: incidents.reference })
      .from(caseIncidents)
      .innerJoin(incidents, eq(incidents.id, caseIncidents.incidentId))
      .where(and(eq(caseIncidents.caseId, id), isNull(incidents.deletedAt)))
      .limit(50);
    for (const row of links) push({ id: row.id, label: row.label, type: "incident", depth: 1, weight: 1 }, "incident");
  }

  // Explicitly recorded relationships, in both directions.
  const explicit = await db
    .select({
      fromType: recordRelationships.fromType,
      fromId: recordRelationships.fromId,
      toType: recordRelationships.toType,
      toId: recordRelationships.toId,
      relationType: recordRelationships.relationType,
    })
    .from(recordRelationships)
    .where(or(sql`(${recordRelationships.fromType} = ${type} and ${recordRelationships.fromId} = ${id})`, sql`(${recordRelationships.toType} = ${type} and ${recordRelationships.toId} = ${id})`))
    .limit(50);

  for (const row of explicit) {
    const otherType = row.fromId === id && row.fromType === type ? row.toType : row.fromType;
    const otherId = row.fromId === id && row.fromType === type ? row.toId : row.fromId;
    if (!(otherType in TABLE_BY_TYPE)) continue;
    const label = await loadLabel(otherType as RecordType, otherId);
    if (!label) continue;
    push({ id: otherId, label, type: otherType, depth: 1, weight: 1 }, row.relationType.toLowerCase());
  }

  return found;
}

export const linkAnalysisService = {
  async graph(ctx: RequestContext, params: { type: string; id: string; depth?: number }) {
    assertCan(ctx, "search.use");

    const type = params.type as RecordType;
    if (!(type in TABLE_BY_TYPE)) throw AppError.badRequest("Unknown record type.");
    if (!visible(ctx, type)) throw AppError.forbidden("You cannot view this record type.");

    const depth = Math.max(1, Math.min(2, params.depth ?? 1));
    const centreLabel = await loadLabel(type, params.id);
    if (!centreLabel) throw AppError.notFound("That record was not found.");

    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const centreId = `${type}:${params.id}`;
    nodes.set(centreId, { id: centreId, label: centreLabel, type, depth: 0, weight: 1 });

    type Frontier = { type: RecordType; id: string; key: string; depth: number };
    let frontier: Frontier[] = [{ type, id: params.id, key: centreId, depth: 0 }];
    const visited = new Set<string>([centreId]);

    while (frontier.length > 0 && frontier[0]!.depth < depth) {
      const next: Frontier[] = [];
      for (const current of frontier) {
        const related = await neighboursOf(ctx, current.type, current.id);
        for (const { node, relation } of related) {
          const key = `${node.type}:${node.id}`;
          const existing = nodes.get(key);
          if (existing) {
            existing.weight += 1;
          } else {
            nodes.set(key, { ...node, id: key, depth: current.depth + 1 });
          }
          edges.push({ source: current.key, target: key, relation });
          if (!visited.has(key) && current.depth + 1 < depth) {
            visited.add(key);
            next.push({ type: node.type as RecordType, id: node.id, key, depth: current.depth + 1 });
          }
        }
      }
      frontier = next;
    }

    // De-duplicate edges and keep the strongest nodes if the graph is large.
    const uniqueEdges: GraphEdge[] = [];
    const seen = new Set<string>();
    for (const edge of edges) {
      const key = `${edge.source}->${edge.target}`;
      const reverse = `${edge.target}->${edge.source}`;
      if (seen.has(key) || seen.has(reverse)) continue;
      seen.add(key);
      uniqueEdges.push(edge);
    }

    const allNodes = [...nodes.values()].sort((a, b) => b.weight - a.weight || a.depth - b.depth).slice(0, 60);
    const kept = new Set(allNodes.map((node) => node.id));

    return {
      centre: { type, id: params.id, label: centreLabel },
      nodes: allNodes,
      edges: uniqueEdges.filter((edge) => kept.has(edge.source) && kept.has(edge.target)),
      types: [...new Set(allNodes.map((node) => node.type))].sort(),
    };
  },
};
