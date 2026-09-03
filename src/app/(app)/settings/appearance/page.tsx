"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Button, Card, Label } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { hexToHslTriplet } from "@/components/providers/theme-provider";

const ACCENTS = ["#3b82f6", "#22d3ee", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444"];

/** Appearance settings: theme, density, radius and accent colour. */
export default function AppearanceSettingsPage() {
  const { data, can, refresh } = useSession();
  const theme = data?.config.theme;
  const [mode, setMode] = React.useState(theme?.mode ?? "dark");
  const [density, setDensity] = React.useState(theme?.density ?? "comfortable");
  const [accent, setAccent] = React.useState(data?.config.branding.accentColour ?? "#3b82f6");

  const save = useMutation({
    mutationFn: () => api.put("/api/admin/theme", { mode, density }),
    onSuccess: async () => {
      await refresh();
      toast.success("Appearance saved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const saveBranding = useMutation({
    mutationFn: () => api.put("/api/admin/branding", { accentColour: accent }),
    onSuccess: async () => {
      await refresh();
      toast.success("Accent colour saved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  // Preview changes instantly, before they are persisted.
  React.useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.dataset.density = density;
    const triplet = hexToHslTriplet(accent);
    if (triplet) document.documentElement.style.setProperty("--accent", triplet);
  }, [mode, density, accent]);

  const canSave = can("admin.themes.manage");

  return (
    <div className="space-y-4">
      <PageHeader title="Appearance" description="Interface theme, density and accent colour." />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Theme</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <div className="flex gap-2">
                {["dark", "light"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize transition-colors ${
                      mode === option ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Density</Label>
              <div className="flex gap-2">
                {["compact", "comfortable", "spacious"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDensity(option)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize transition-colors ${
                      density === option ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!canSave}>
              Save appearance
            </Button>
            {!canSave ? <p className="text-xs text-muted-foreground">Only users who can manage themes can save changes for everyone.</p> : null}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Accent colour</h2>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((colour) => (
              <button
                key={colour}
                type="button"
                onClick={() => setAccent(colour)}
                className={`h-9 w-9 rounded-full border-2 transition-transform ${accent === colour ? "scale-110 border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: colour }}
                aria-label={`Accent ${colour}`}
              />
            ))}
          </div>
          <Button className="mt-4" onClick={() => saveBranding.mutate()} loading={saveBranding.isPending} disabled={!can("admin.branding.manage")}>
            Save accent
          </Button>
        </Card>
      </div>
    </div>
  );
}
