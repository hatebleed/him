import { redirect } from "next/navigation";

import { resolveOptionalContext } from "@/server/context";

export const dynamic = "force-dynamic";

/** The root path sends the user to their working area or to sign-in. */
export default async function IndexPage() {
  const context = await resolveOptionalContext();
  redirect(context ? "/dashboard" : "/login");
}
