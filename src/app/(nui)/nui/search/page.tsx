"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";

import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Input, Skeleton } from "@/components/ui/primitives";
import { SignalDot, signalForStatus } from "@/components/ops/signal";

type SearchRow = {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  reference: string | null;
  status: string | null;
  priority?: string | null;
  href: string;
};

const TYPES = [
  { key: "person", label: "People" },
  { key: "vehicle", label: "Vehicles" },
  { key: "incident", label: "Incidents" },
  { key: "case", label: "Cases" },
];

const DETAIL_PATHS: Record<string, string> = {
  person: "/api/people",
  vehicle: "/api/vehicles",
  incident: "/api/incidents",
  case: "/api/cases",
};

/** Permission-filtered search with a record detail sheet. */
export default function NuiSearchPage() {
  const [term, setTerm] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [type, setType] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<SearchRow | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  const { data, isFetching } = useQuery({
    queryKey: ["nui", "search", debounced, type],
    queryFn: () => api.get<{ rows: SearchRow[] }>("/api/search", { q: debounced, types: type ?? undefined, limit: 25 }),
    enabled: debounced.length >= 2,
    staleTime: 15_000,
  });

  const detail = useQuery({
    queryKey: ["nui", "record", selected?.type, selected?.id],
    queryFn: () => api.get<Record<string, unknown>>(`${DETAIL_PATHS[selected!.type]}/${selected!.id}`),
    enabled: Boolean(selected && DETAIL_PATHS[selected.type]),
  });

  const rows = data?.rows ?? [];
  const detailEntries = detail.data ? Object.entries(detail.data).filter(([, value]) => value !== null && value !== undefined && value !== "") : [];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Name, plate, reference…"
          className="h-11 pl-9"
          aria-label="Search records"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setType(null)}
          className={cn("rounded-md border px-2.5 py-1 text-xs", type === null ? "border-primary/50 bg-secondary" : "border-border")}
        >
          All
        </button>
        {TYPES.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setType(entry.key)}
            className={cn("rounded-md border px-2.5 py-1 text-xs", type === entry.key ? "border-primary/50 bg-secondary" : "border-border")}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {debounced.length < 2 ? (
        <p className="px-1 py-6 text-center text-xs text-muted-foreground">Type at least two characters.</p>
      ) : isFetching && rows.length === 0 ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <p className="px-1 py-6 text-center text-muted-foreground text-xs">No records match “{debounced}”.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={`${row.type}:${row.id}`}>
              <button
                type="button"
                onClick={() => setSelected(row)}
                className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-left transition-colors hover:bg-secondary/60"
              >
                <SignalDot signal={signalForStatus(row.priority ?? row.status)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {row.type} · {row.subtitle ?? row.reference ?? "—"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
          <div className="ops-frame max-h-[85vh] w-full max-w-lg overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{selected.title}</p>
                <p className="data-mono truncate text-[11px] text-muted-foreground">{selected.reference ?? selected.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close record"
                className="rounded-md border border-border bg-secondary/60 p-1.5 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto ops-scroll p-4">
              {!DETAIL_PATHS[selected.type] ? (
                <p className="text-xs text-muted-foreground">Open this record in the full console for detail.</p>
              ) : detail.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : detail.error ? (
                <p className="text-xs text-destructive">{(detail.error as Error).message}</p>
              ) : (
                <dl className="grid gap-2 sm:grid-cols-2">
                  {detailEntries
                    .filter(([key]) => !["deletedAt", "createdById", "updatedById", "updatedAt"].includes(key))
                    .slice(0, 40)
                    .map(([key, value]) => (
                      <div key={key} className="min-w-0">
                        <dt className="ops-label">{key.replace(/([A-Z])/g, " $1").toLowerCase()}</dt>
                        <dd className="truncate text-sm">{formatValue(value)}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Renders any record field without knowing the record's shape. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.map((entry) => (typeof entry === "object" ? (entry as { name?: string; label?: string })?.name ?? (entry as { label?: string })?.label ?? "•" : String(entry))).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString();
  }
  return String(value);
}
