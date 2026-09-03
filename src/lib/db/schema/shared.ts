import { randomUUID } from "node:crypto";
import { jsonb, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Column helpers so every table shares identical conventions:
 *  - `id`            cuid-style unique text primary key
 *  - `created_at`    set on insert
 *  - `updated_at`    maintained on insert and update
 *  - `deleted_at`    soft deletion (nullable)
 *  - audit columns   created_by / updated_by, resolved server-side only
 */
export const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

export const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull();

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

export const softDelete = () => timestamp("deleted_at", { withTimezone: true, mode: "date" });

export const createdBy = () => text("created_by_id");
export const updatedBy = () => text("updated_by_id");

export const json = <T>(name: string) => jsonb(name).$type<T>();
