import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

/**
 * A single pooled PostgreSQL connection shared by the whole process.
 *
 * Connection pooling matters here: every request performs several small
 * queries (session, permissions, configuration) and creating a new connection
 * per request would be the dominant cost.
 */
const globalForDb = globalThis as unknown as {
  __himPool?: Pool;
  __himDb?: ReturnType<typeof drizzle<typeof schema>>;
};

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/him?schema=public";

export const pool =
  globalForDb.__himPool ??
  new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__himPool = pool;

export const db = globalForDb.__himDb ?? drizzle(pool, { schema, casing: "snake_case" });

if (process.env.NODE_ENV !== "production") globalForDb.__himDb = db;

export type Database = typeof db;
export { schema };
