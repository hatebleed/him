import { redirect } from "next/navigation";

import { resolveOptionalContext } from "@/server/context";
import { getBranding } from "@/server/configuration/service";

export const dynamic = "force-dynamic";

/**
 * Authentication shell: a split layout with the organisation's branding on
 * one side and the form on the other.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const context = await resolveOptionalContext();
  if (context) redirect("/dashboard");

  let branding = null;
  try {
    branding = await getBranding();
  } catch {
    /* defaults apply */
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="hero-glow relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-elevated">
            {(branding?.organisationShort ?? "OP").slice(0, 3).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold">{branding?.organisationName ?? "Operations Platform"}</p>
            <p className="text-xs text-muted-foreground">{branding?.tagline ?? "Operational information platform"}</p>
          </div>
        </div>

        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            One workspace for records, operations and reporting.
          </h1>
          <p className="text-sm text-muted-foreground">
            Configurable modules, statuses, fields, workflows and terminology — adapted to how your organisation
            operates, without writing code.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {["Records and relationships", "Dispatch and live operations", "Approvals and audit trail", "Administration without deployments"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          {branding?.contactEmail ? <span>{branding.contactEmail}</span> : null}
          {branding?.contactPhone ? <span> · {branding.contactPhone}</span> : null}
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
