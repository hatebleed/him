import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { createdAt, id, updatedAt } from "./shared";

/**
 * External identities linked to platform users.
 *
 * An in-game character (a FiveM citizen id, a CAD account, an SSO subject) is
 * not a user: it is a claim about one. Linking is explicit (or explicitly
 * enabled auto-provisioning), so a player can never pick their own account.
 */
export const integrationIdentities = pgTable(
  "integration_identities",
  {
    id: id(),
    /** Integration that owns the identity, e.g. "fivem". */
    provider: text("provider").notNull(),
    /** Identifier within that provider (FiveM citizen id). */
    externalId: text("external_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Display name seen in the game at link time, kept for auditing. */
    displayName: text("display_name"),
    /** Provider payload: job, grade, callsign, character name, last server id. */
    metadata: text("metadata"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("integration_identity_unique").on(table.provider, table.externalId),
    index("integration_identity_user_idx").on(table.userId),
  ],
);

export const integrationIdentityRelations = relations(integrationIdentities, ({ one }) => ({
  user: one(users, { fields: [integrationIdentities.userId], references: [users.id] }),
}));

export type IntegrationIdentity = typeof integrationIdentities.$inferSelect;
