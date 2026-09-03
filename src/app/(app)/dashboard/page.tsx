"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { DashboardWidget, type DashboardData, type WidgetInstance } from "@/components/dashboard/widgets";

/**
 * Dashboard.
 *
 * Layout, widget selection and ordering are stored per user in the database,
 * so every user can arrange their own working view.
 */
export default function DashboardPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);

  const { data: layout, isLoading: layoutLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<{ id: string; name: string; widgets: WidgetInstance[] }>("/api/dashboard"),
  });

  const { data: catalogue } = useQuery({
    queryKey: ["dashboard", "catalogue"],
    queryFn: () => api.get<Array<{ type: string; label: string; description: string }>>("/api/dashboard/widgets"),
    enabled: addOpen,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => api.get<DashboardData>("/api/analytics", { trend: "true", priority: "true", series: "true", heatmap: "true" }),
    refetchInterval: 120_000,
  });

  const addWidget = useMutation({
    mutationFn: (type: string) => api.post("/api/dashboard/widgets", { type }),
    onSuccess: async (_, type) => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setAddOpen(false);
      toast.success(`Added “${catalogue?.find((entry) => entry.type === type)?.label ?? "widget"}”`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const removeWidget = useMutation({
    mutationFn: (id: string) => api.delete(`/api/dashboard/widgets/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Widget removed");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reset = useMutation({
    mutationFn: () => api.post("/api/dashboard/reset", {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Dashboard reset");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const widgets = (layout?.widgets ?? []).filter((widget) => widget.visible).sort((a, b) => a.sortOrder - b.sortOrder);
  const loading = layoutLoading || analyticsLoading;
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Good ${greeting()}, ${firstName}`}
        description="Your operational overview. Customise the widgets to suit how you work."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus />
              Add widget
            </Button>
            <Button variant="ghost" size="sm" onClick={() => reset.mutate()} disabled={reset.isPending}>
              <RotateCcw />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </>
        }
      />

      {loading && !widgets.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : widgets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LayoutGrid className="h-5 w-5" />}
            title="Your dashboard is empty"
            description="Add widgets to build the overview you need: metrics, lists, charts and quick actions."
            action={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus />
                Add your first widget
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {widgets.map((widget) => (
            <DashboardWidget
              key={widget.id}
              widget={widget}
              data={analytics}
              loading={analyticsLoading}
              onRemove={() => removeWidget.mutate(widget.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a widget</DialogTitle>
            <DialogDescription>Widgets are rendered from live data and respect your permissions.</DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {(catalogue ?? []).map((entry) => (
              <button
                key={entry.type}
                type="button"
                onClick={() => addWidget.mutate(entry.type)}
                disabled={addWidget.isPending}
                className="flex w-full items-start gap-3 rounded-md border border-border/70 bg-secondary/20 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-secondary/50 disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{entry.label}</span>
                  <span className="block text-xs text-muted-foreground">{entry.description}</span>
                </span>
                <Plus className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}


