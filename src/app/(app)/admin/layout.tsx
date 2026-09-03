import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { resolveOptionalContext } from "@/server/context";

/** Administration area: server-side guarded by the `admin.access` permission. */
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await resolveOptionalContext();
  if (!context) redirect("/login");
  if (!context.permissions.has("admin.access")) redirect("/dashboard");

  return (
    <AdminShell
      permissions={[...context.permissions]}
      userName={context.user.name}
    >
      {children}
    </AdminShell>
  );
}
