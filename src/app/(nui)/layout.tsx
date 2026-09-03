import { Providers } from "@/components/providers";
import { NuiShell } from "@/components/nui/shell";

/**
 * In-game layout.
 *
 * A separate route group with no application chrome: the MDT that loads inside
 * FiveM's browser is this tree and nothing else. It is rendered on demand
 * because the operator it resolves to depends on the request.
 */
export const dynamic = "force-dynamic";

export default function NuiLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <NuiShell>{children}</NuiShell>
    </Providers>
  );
}
