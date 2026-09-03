import "server-only";

import { and, asc, count, desc, eq, isNull, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/db/client";
import { paginationSchema, type PaginationInput } from "@/lib/validation/common";

export type ListParams = PaginationInput & {
  filters: Record<string, string | string[] | undefined>;
};

export type ListResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export function parseListParams(searchParams: URLSearchParams): ListParams {
  const parsed = paginationSchema.parse(Object.fromEntries(searchParams.entries()));
  const { page, pageSize, search, sort, dir } = parsed;
  const filters: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of searchParams.entries()) {
    if (["page", "pageSize", "search", "sort", "dir", "view"].includes(key)) continue;
    const existing = filters[key];
    if (existing === undefined) filters[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else filters[key] = [existing, value];
  }
  return { page, pageSize, search, sort, dir, filters };
}

export function multi(values: string | string[] | undefined): string[] {
  if (!values) return [];
  return Array.isArray(values) ? values : [values];
}

export function single(values: string | string[] | undefined): string | undefined {
  if (!values) return undefined;
  return Array.isArray(values) ? values[0] : values;
}

/** Soft-deleted rows are excluded unless a filter explicitly asks for them. */
export function notDeleted(column: PgColumn): SQL {
  return isNull(column);
}

export function combine(...conditions: Array<SQL | undefined>): SQL | undefined {
  const defined = conditions.filter((condition): condition is SQL => Boolean(condition));
  if (defined.length === 0) return undefined;
  if (defined.length === 1) return defined[0];
  return and(...defined);
}

export function orderByDirection(column: PgColumn, direction: "asc" | "desc") {
  return direction === "asc" ? asc(column) : desc(column);
}

/** Runs a paged query and returns the standard list envelope. */
export async function paginate<T>(
  table: PgTable,
  options: {
    where?: SQL;
    params: ListParams;
    defaultSort: PgColumn;
    sortable?: Record<string, PgColumn>;
    extraSelect?: (qb: ReturnType<typeof db.select>) => void;
  },
): Promise<ListResult<T>> {
  const { params, where, defaultSort, sortable = {} } = options;
  const sortColumn = (params.sort && sortable[params.sort]) || defaultSort;
  const rows = (await db
    .select()
    .from(table)
    .where(where)
    .orderBy(orderByDirection(sortColumn, params.dir))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize)) as T[];

  const [totalRow] = await db.select({ value: count() }).from(table).where(where);
  const total = Number(totalRow?.value ?? 0);

  return {
    rows,
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export { and, asc, desc, eq, isNull, count };
