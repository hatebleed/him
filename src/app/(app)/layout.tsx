import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { resolveOptionalContext } from "@/server/context";
import { getShellData } from "@/server/shell";

/**
 * Authenticated application area.
 *
 * The operator is resolved on the server on every request: an unauthenticated
 * visitor never receives application markup, and no page is baked at build time
 * with another account's data.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await resolveOptionalContext();
  if (!context) redirect("/login");

  let shell;
  try {
    shell = await getShellData(context);
  } catch {
    shell = null;
  }

  return (
    <AppShell initialSession={shell ? JSON.parse(JSON.stringify(shell)) : null}>{children}</AppShell>
  );
}
