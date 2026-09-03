"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Button, Card, Input, Skeleton } from "@/components/ui/overlays-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";

type Branding = {
  organisationName: string;
  organisationShort: string | null;
  tagline: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  logoUrl: string | null;
  primaryColour: string;
  accentColour: string;
  sidebarColour: string;
};

/** Organisation branding: name, contact details and colour tokens. */
export default function AdminBrandingPage() {
  const queryClient = useQueryClient();
  const { refresh } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "branding"],
    queryFn: () => api.get<Branding>("/api/admin/branding"),
  });

  const [form, setForm] = React.useState<Branding | null>(null);
  React.useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put("/api/admin/branding", form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "branding"] });
      await refresh();
      toast.success("Branding saved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading || !form) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Branding"
        description="Organisation identity shown in the shell, sidebar and sign-in screen."
        actions={
          <Button size="sm" onClick={() => save.mutate()} loading={save.isPending}>
            Save branding
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Organisation</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["organisationName", "Name"],
                ["organisationShort", "Short name"],
                ["tagline", "Tagline"],
                ["contactEmail", "Contact email"],
                ["contactPhone", "Contact phone"],
                ["address", "Address"],
                ["logoUrl", "Logo URL"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <Input
                  value={(form[field] as string | null) ?? ""}
                  onChange={(event) => setForm({ ...form, [field]: event.target.value || null })}
                />
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Colours</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["primaryColour", "Primary"],
                ["accentColour", "Accent"],
                ["sidebarColour", "Sidebar"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <Input
                  type="color"
                  value={form[field]}
                  onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                  className="h-10"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-border/70 p-4" style={{ background: "linear-gradient(120deg, hsl(var(--card)), hsl(var(--muted)))" }}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                {(form.organisationShort ?? "OP").slice(0, 3).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-semibold">{form.organisationName}</p>
                <p className="text-xs text-muted-foreground">{form.tagline}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
