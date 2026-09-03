"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Network, Search } from "lucide-react";

import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { EmptyState, Input, Skeleton } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page-header";
import { OpsPanel } from "@/components/ops/frame";
import { LinkGraph, LinkGraphLegend } from "@/components/ops/link-graph";
import type { GraphEdge, GraphNode } from "@/components/ops/projection";
import { useSession } from "@/components/providers/session-provider";

type SearchRow = { id: string; type: string; title: string; subtitle: string | null; reference: string | null; href: string };

type GraphPayload = {
  centre: { type: string; id: string; label: string };
  nodes: GraphNode[];
  edges: GraphEdge[];
  types: string[];
};

const GRAPH_TYPES = ["person", "vehicle", "incident", "case", "evidence"];

const HREFS: Record<string, string> = {
  person: "/people",
  vehicle: "/vehicles",
  incident: "/incidents",
  case: "/cases",
  evidence: "/evidence",
};

/**
 * Association view.
 *
 * Pick any record and see everything it is linked to - people, vehicles,
 * incidents, cases and evidence - laid out as a graph. Links are read from the
 * database, and record types the operator cannot open are never included.
 */
export default function AssociationsPage() {
  const { can } = useSession();
  const [termQuery, setTermQuery] = React.useState("");
  const [selected, setSelected] = React.useState<{ type: string; id: string; label: string } | null>(null);
  const [depth, setDepth] = React.useState<1 | 2>(1);

  const search = useQuery({
    queryKey: ["associations", "search", termQuery],
    queryFn: () => api.get<{ rows: SearchRow[] }>("/api/search", { q: termQuery, types: GRAPH_TYPES.join(","), limit: 20 }),
    enabled: termQuery.trim().length >= 2,
    staleTime: 15_000,
  });

  const graph = useQuery({
    queryKey: ["link-graph", selected?.type, selected?.id, depth],
    queryFn: () => api.get<GraphPayload>("/api/link-analysis", { type: selected!.type, id: selected!.id, depth: String(depth) }),
    enabled: Boolean(selected),
    staleTime: 30_000,
  });

  const rows = (search.data?.rows ?? []).filter((row) => GRAPH_TYPES.includes(row.type));
  const nodes = graph.data?.nodes ?? [];
  const edges = graph.data?.edges ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Associations" description="Link analysis across people, vehicles, incidents, cases and evidence." />

      <div className="grid gap-3 lg:grid-cols-4">
        <OpsPanel className="lg:col-span-1" title="Start from a record" subtitle="Search, then expand">
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={termQuery}
                onChange={(event) => setTermQuery(event.target.value)}
                placeholder="Name, reference, registration…"
                className="pl-8"
                aria-label="Search records"
              />
            </div>

            {termQuery.trim().length >= 2 ? (
              search.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : rows.length === 0 ? (
                <p className="px-1 py-3 text-xs text-muted-foreground">
                  {search.isFetching ? "Searching…" : "No records match that search."}
                </p>
              ) : (
                <ul className="max-h-[26rem] space-y-1 overflow-y-auto ops-scroll pr-1">
                  {rows.map((row) => {
                    const active = selected?.id === row.id && selected?.type === row.type;
                    return (
                      <li key={`${row.type}:${row.id}`}>
                        <button
                          type="button"
                          onClick={() => setSelected({ type: row.type, id: row.id, label: row.reference ?? row.title })}
                          className={cn(
                            "w-full rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                            active ? "border-primary/50 bg-secondary/70" : "border-transparent hover:bg-secondary/50",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span className="data-mono text-[10px] uppercase tracking-wide text-muted-foreground">{row.type}</span>
                            <span className="min-w-0 flex-1 truncate font-medium">{row.title}</span>
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{row.subtitle ?? row.reference}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              <p className="px-1 py-3 text-xs text-muted-foreground">Type at least two characters to search.</p>
            )}

            {selected ? (
              <div className="flex items-center gap-1 border-t border-border/60 pt-2">
                <span className="ops-label mr-auto">Depth</span>
                {([1, 2] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDepth(value)}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-xs transition-colors",
                      depth === value ? "border-primary/50 bg-secondary/70" : "border-border hover:bg-secondary/50",
                    )}
                  >
                    {value} hop{value === 1 ? "" : "s"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </OpsPanel>

        <OpsPanel
          className="lg:col-span-3"
          title={selected ? selected.label : "Association graph"}
          subtitle={selected ? `${graph.data?.types.join(" · ") ?? "loading"} around this record` : "Pick a record to build the graph"}
          scanline
          actions={<LinkGraphLegend types={graph.data?.types ?? ["person", "vehicle", "incident", "case", "evidence"]} />}
        >
          {!selected ? (
            <EmptyState icon={<Network className="h-5 w-5" />} title="No record selected" description="Search on the left to build an association graph." />
          ) : graph.isLoading ? (
            <Skeleton className="h-[560px] w-full" />
          ) : graph.error ? (
            <EmptyState title="Graph unavailable" description={(graph.error as Error).message} />
          ) : nodes.length <= 1 ? (
            <EmptyState
              icon={<Network className="h-5 w-5" />}
              title="No recorded links"
              description="Nothing in the database connects this record to another one yet."
            />
          ) : (
            <div className="space-y-2">
              <LinkGraph
                nodes={nodes}
                edges={edges}
                height={480}
                onNodeClick={(node) => {
                  const [type, id] = node.id.split(":");
                  if (type && id && HREFS[type]) window.open(`${HREFS[type]}/${id}`, "_blank", "noopener");
                }}
              />
              <p className="text-xs text-muted-foreground">
                {nodes.length} records · {edges.length} links · click a node to open the record
                {can("search.use") ? "" : " (read-only)"}
              </p>
            </div>
          )}
        </OpsPanel>
      </div>
    </div>
  );
}
