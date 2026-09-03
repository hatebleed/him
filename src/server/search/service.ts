import "server-only";

import { type Column } from "drizzle-orm";
import { and, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/db/client";
import {
  alerts,
  bolos,
  calls,
  cases,
  evidence,
  incidents,
  persons,
  reports,
  savedSearches,
  tasks,
  units,
  vehicles,
  warrants,
} from "@/lib/db/schema";
import { assertCan, type RequestContext } from "@/server/context";

/**
 * Search abstraction.
 *
 * Modules never query a search engine directly - they call this service.
 * The default provider uses PostgreSQL (ILIKE + exact-match ranking). An
 * OpenSearch/Elasticsearch/Meilisearch provider can implement the same
 * interface and be selected with `SEARCH_PROVIDER` without touching modules.
 */
export type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  reference: string | null;
  status: string | null;
  priority?: string | null;
  href: string;
  score: number;
  meta?: Record<string, string | null>;
};

export type SearchFilters = {
  types?: string[];
  status?: string[];
  from?: Date | null;
  to?: Date | null;
  departmentId?: string | null;
  limit?: number;
};

export interface SearchProvider {
  readonly name: string;
  search(ctx: RequestContext, term: string, filters?: SearchFilters): Promise<SearchResult[]>;
}

type AnyTable = PgTable & { id: PgColumn; createdAt: PgColumn };

/** A column or an arbitrary SQL expression - both can be searched/selected. */
type SqlLike = SQL | Column;

type SearchTarget = {
  type: string;
  permission: string;
  href: (row: Record<string, unknown>) => string;
  table: PgTable;
  titleColumn: SqlLike;
  referenceColumn?: SqlLike;
  statusColumn?: SqlLike;
  searchColumns: SqlLike[];
  where?: SQL;
  subtitle?: (row: Record<string, unknown>) => string | null;
};

const text = (value: unknown) => (value === null || value === undefined ? null : String(value));

export class PostgresSearchProvider implements SearchProvider {
  readonly name = "postgres";

  private targets(): SearchTarget[] {
    return [
      {
        type: "person",
        permission: "people.view",
        table: persons,
        titleColumn: sql<string>`concat(${persons.firstName}, ' ', ${persons.lastName})`,
        referenceColumn: persons.reference,
        statusColumn: persons.status,
        searchColumns: [persons.firstName, persons.lastName, persons.reference, persons.alias, persons.occupation],
        where: isNull(persons.deletedAt),
        href: (row) => `/people/${text(row.id)}`,
        subtitle: (row) => [text(row.reference), text(row.occupation)].filter(Boolean).join(" · ") || null,
      },
      {
        type: "vehicle",
        permission: "vehicles.view",
        table: vehicles,
        titleColumn: vehicles.registration,
        referenceColumn: vehicles.reference,
        statusColumn: vehicles.status,
        searchColumns: [vehicles.registration, vehicles.reference, vehicles.make, vehicles.model, vehicles.vin],
        where: isNull(vehicles.deletedAt),
        href: (row) => `/vehicles/${text(row.id)}`,
        subtitle: (row) => [text(row.make), text(row.model), text(row.colour)].filter(Boolean).join(" · ") || null,
      },
      {
        type: "incident",
        permission: "incidents.view",
        table: incidents,
        titleColumn: incidents.title,
        referenceColumn: incidents.reference,
        statusColumn: incidents.status,
        searchColumns: [incidents.reference, incidents.title, incidents.description, incidents.location],
        where: isNull(incidents.deletedAt),
        href: (row) => `/incidents/${text(row.id)}`,
        subtitle: (row) => [text(row.priority), text(row.location)].filter(Boolean).join(" · ") || null,
      },
      {
        type: "case",
        permission: "cases.view",
        table: cases,
        titleColumn: cases.title,
        referenceColumn: cases.reference,
        statusColumn: cases.status,
        searchColumns: [cases.reference, cases.title, cases.description],
        where: isNull(cases.deletedAt),
        href: (row) => `/cases/${text(row.id)}`,
      },
      {
        type: "report",
        permission: "reports.view",
        table: reports,
        titleColumn: reports.title,
        referenceColumn: reports.reference,
        statusColumn: reports.status,
        searchColumns: [reports.reference, reports.title, reports.body],
        where: isNull(reports.deletedAt),
        href: (row) => `/reports/${text(row.id)}`,
      },
      {
        type: "task",
        permission: "tasks.view",
        table: tasks,
        titleColumn: tasks.title,
        referenceColumn: tasks.reference,
        statusColumn: tasks.status,
        searchColumns: [tasks.reference, tasks.title, tasks.description],
        where: isNull(tasks.deletedAt),
        href: (row) => `/tasks/${text(row.id)}`,
      },
      {
        type: "warrant",
        permission: "warrants.view",
        table: warrants,
        titleColumn: sql<string>`concat('Warrant · ', ${warrants.type})`,
        referenceColumn: warrants.reference,
        statusColumn: warrants.status,
        searchColumns: [warrants.reference, warrants.description, warrants.issuingAuthority],
        where: isNull(warrants.deletedAt),
        href: (row) => `/warrants/${text(row.id)}`,
      },
      {
        type: "alert",
        permission: "alerts.view",
        table: alerts,
        titleColumn: alerts.subject,
        referenceColumn: alerts.reference,
        statusColumn: alerts.status,
        searchColumns: [alerts.reference, alerts.subject, alerts.description],
        where: isNull(alerts.deletedAt),
        href: (row) => `/alerts/${text(row.id)}`,
      },
      {
        type: "bolo",
        permission: "bolos.view",
        table: bolos,
        titleColumn: bolos.subject,
        referenceColumn: bolos.reference,
        statusColumn: bolos.status,
        searchColumns: [bolos.reference, bolos.subject, bolos.description],
        where: isNull(bolos.deletedAt),
        href: (row) => `/bolos/${text(row.id)}`,
      },
      {
        type: "evidence",
        permission: "evidence.view",
        table: evidence,
        titleColumn: evidence.description,
        referenceColumn: evidence.itemNumber,
        statusColumn: evidence.status,
        searchColumns: [evidence.itemNumber, evidence.description, evidence.location],
        where: isNull(evidence.deletedAt),
        href: (row) => `/evidence/${text(row.id)}`,
      },
      {
        type: "call",
        permission: "calls.view",
        table: calls,
        titleColumn: sql<string>`coalesce(${calls.description}, ${calls.reference})`,
        referenceColumn: calls.reference,
        statusColumn: calls.status,
        searchColumns: [calls.reference, calls.description, calls.location, calls.callerName],
        href: (row) => `/dispatch?call=${text(row.id)}`,
      },
      {
        type: "unit",
        permission: "units.view",
        table: units,
        titleColumn: units.callsign,
        statusColumn: units.status,
        searchColumns: [units.callsign, units.name, units.location],
        where: isNull(units.deletedAt),
        href: (row) => `/units/${text(row.id)}`,
        subtitle: (row) => text(row.name),
      },
    ];
  }

  async search(ctx: RequestContext, term: string, filters: SearchFilters = {}): Promise<SearchResult[]> {
    assertCan(ctx, "search.use");
    const query = term.trim();
    if (query.length < 2) return [];

    const requested = filters.types?.length ? new Set(filters.types) : null;
    const limit = Math.min(50, filters.limit ?? 25);
    const pattern = `%${query}%`;
    const results: SearchResult[] = [];

    // Permission filtering happens per target: a user never sees results for
    // a record type they cannot open.
    const targets = this.targets().filter(
      (target) => ctx.permissions.has(target.permission) && (!requested || requested.has(target.type)),
    );

    for (const target of targets) {
      const conditions: SQL[] = target.searchColumns.map((column) => ilike(column as SQL, pattern));
      const searchCondition = or(...conditions);
      if (!searchCondition) continue;

      const extra: SQL[] = [searchCondition];
      if (target.where) extra.push(target.where);

      const table = target.table as unknown as AnyTable;
      const rows = await db
        .select({
          id: table.id,
          title: target.titleColumn as SQL<string>,
          reference: (target.referenceColumn ?? sql<string>`null`) as SQL<string>,
          status: (target.statusColumn ?? sql<string>`null`) as SQL<string>,
        })
        .from(table)
        .where(and(...extra))
        .orderBy(desc(table.createdAt))
        .limit(limit);

      for (const row of rows as unknown as Array<Record<string, unknown>>) {
        if (filters.status?.length && !filters.status.includes(text(row.status) ?? "")) continue;
        const reference = text(row.reference);
        const title = text(row.title) ?? "Untitled";
        // Exact reference matches rank above partial text matches.
        const score = reference && reference.toLowerCase() === query.toLowerCase() ? 100 : title.toLowerCase() === query.toLowerCase() ? 90 : title.toLowerCase().startsWith(query.toLowerCase()) ? 70 : 50;
        results.push({
          id: text(row.id) ?? "",
          type: target.type,
          title,
          subtitle: target.subtitle?.(row) ?? null,
          reference,
          status: text(row.status),
          href: target.href(row),
          score,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

class NullSearchProvider implements SearchProvider {
  readonly name = "none";
  async search(): Promise<SearchResult[]> {
    return [];
  }
}

export function getSearchProvider(): SearchProvider {
  return process.env.SEARCH_PROVIDER === "none" ? new NullSearchProvider() : new PostgresSearchProvider();
}

export const searchService = {
  search(ctx: RequestContext, term: string, filters?: SearchFilters) {
    return getSearchProvider().search(ctx, term, filters);
  },

  /** Persists a query so the user can re-run it later. */
  async save(ctx: RequestContext, term: string, filters: SearchFilters) {
    assertCan(ctx, "search.use");
    await db.insert(savedSearches).values({ userId: ctx.user.id, query: term, filters: filters as never });
    return { ok: true };
  },

  async recent(ctx: RequestContext, limit = 8) {
    assertCan(ctx, "search.use");
    return db
      .select({ id: savedSearches.id, query: savedSearches.query, createdAt: savedSearches.createdAt })
      .from(savedSearches)
      .where(eq(savedSearches.userId, ctx.user.id))
      .orderBy(desc(savedSearches.createdAt))
      .limit(limit);
  },
};
