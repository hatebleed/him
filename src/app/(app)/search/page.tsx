"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { api } from "@/lib/api/client";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { RecordIcon } from "@/components/icon";
import { useDebounced } from "@/lib/hooks/use-list-query";
import {} from "@/lib/utils";

type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  reference: string | null;
  status: string | null;
  href: string;
  score: number;
};

const TYPES = ["person", "vehicle", "incident", "case", "report", "task", "warrant", "alert", "bolo", "evidence", "unit", "call"];

/** Global search: server-side permission filtering applied per record type. */
export default function SearchPage() {
  const { term, statusLabel, statusColour } = useSession();
  const [query, setQuery] = React.useState("");
  const [types, setTypes] = React.useState<string[]>([]);
  const debounced = useDebounced(query, 300);

  const { data, isFetching } = useQuery({
    queryKey: ["search-page", debounced, types.join(",")],
    queryFn: () => api.get<{ rows: SearchResult[] }>("/api/search", { q: debounced, types: types.join(","), limit: 50 }),
    enabled: debounced.trim().length >= 2,
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Search" description="Search across every record type you are allowed to see." />

      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, vehicles, incidents, reports…"
            className="h-11 pl-9"
            autoFocus
            aria-label="Search"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {TYPES.map((type) => {
            const active = types.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => setTypes((current) => (active ? current.filter((entry) => entry !== type) : [...current, type]))}
                className={`rounded-full border px-2.5 py-0.5 text-xs capitalize transition-colors ${
                  active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {term(type, "plural", type)}
              </button>
            );
          })}
          {types.length ? (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setTypes([])}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </Card>

      {debounced.trim().length < 2 ? (
        <EmptyState icon={<Search className="h-5 w-5" />} title="Start typing" description="Enter at least two characters to search." />
      ) : isFetching && rows.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Search className="h-5 w-5" />} title="No results" description={`Nothing matched “${debounced}”.`} />
      ) : (
        <Card>
          <ul className="divide-y divide-border/60">
            {rows.map((row) => (
              <li key={`${row.type}-${row.id}`}>
                <a href={row.href} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/50">
                  <span className="rounded-md border border-border bg-secondary/50 p-1.5 text-muted-foreground">
                    <RecordIcon type={row.type} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.reference ? `${row.reference} · ` : ""}
                      {row.subtitle ?? row.type}
                    </span>
                  </span>
                  {row.status ? <Badge colour={statusColour(row.type, row.status)}>{statusLabel(row.type, row.status)}</Badge> : null}
                  <span className="hidden w-20 text-right text-[11px] uppercase tracking-wide text-muted-foreground sm:block">{row.type}</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Results are limited to records your role can access; hidden records are never returned by the API.
      </p>
    </div>
  );
}

