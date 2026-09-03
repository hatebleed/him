import { redirect } from "next/navigation";

import { AdminOverview } from "@/components/admin/admin-overview";
import { resolveOptionalContext } from "@/server/context";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

/** Administration overview with live platform statistics. */
export default async function AdminPage() {
  const context = await resolveOptionalContext();
  if (!context) redirect("/login");

  const counts = await db.execute<{ resource: string; value: number }>(sql`
    select 'users' as resource, count(*)::int as value from users where deleted_at is null
    union all select 'people', count(*)::int from persons where deleted_at is null
    union all select 'vehicles', count(*)::int from vehicles where deleted_at is null
    union all select 'incidents', count(*)::int from incidents where deleted_at is null
    union all select 'cases', count(*)::int from cases where deleted_at is null
    union all select 'reports', count(*)::int from reports where deleted_at is null
    union all select 'tasks', count(*)::int from tasks where deleted_at is null
    union all select 'audit', count(*)::int from audit_logs
  `);

  const stats = Object.fromEntries((counts.rows ?? []).map((row) => [row.resource, Number(row.value ?? 0)]));

  return (
    <AdminOverview
      stats={stats}
      permissions={[...context.permissions]}
    />
  );
}
