"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, Loader2, Search } from "lucide-react";

import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/providers/session-provider";
import { RecordIcon } from "@/components/icon";
import { Kbd, Spinner } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/overlays";

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

type Suggestion = { label: string; href: string; hint?: string; group: string };

/**
 * Command palette (⌘K / Ctrl+K).
 *
 * Shortcuts are derived from the user's navigation and permissions, and the
 * search results come from the server - which applies the same permission
 * filtering as every other endpoint.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { data, can } = useSession();
  const [term, setTerm] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { data: results, isFetching } = useQuery({
    queryKey: ["command-search", term],
    queryFn: () => api.get<{ rows: SearchResult[] }>("/api/search", { q: term, limit: 12 }),
    enabled: term.trim().length >= 2,
    staleTime: 10_000,
  });

  const shortcuts = React.useMemo<Suggestion[]>(() => {
    const items: Suggestion[] = [];
    for (const item of data?.config.navigation ?? []) {
      if (!item.enabled || !item.href) continue;
      if (item.permission && !can(item.permission)) continue;
      items.push({ label: item.label, href: item.href, group: "Go to" });
    }
    if (can("people.create")) items.push({ label: "Create person record", href: "/people/new", group: "Actions" });
    if (can("vehicles.create")) items.push({ label: "Create vehicle record", href: "/vehicles/new", group: "Actions" });
    if (can("incidents.create")) items.push({ label: "Create incident", href: "/incidents/new", group: "Actions" });
    if (can("reports.create")) items.push({ label: "Create report", href: "/reports/new", group: "Actions" });
    if (can("tasks.create")) items.push({ label: "Create task", href: "/tasks/new", group: "Actions" });
    if (can("admin.access")) items.push({ label: "Open administration", href: "/admin", group: "Actions" });
    return items;
  }, [data?.config.navigation, can]);

  const filteredShortcuts = React.useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return shortcuts.slice(0, 8);
    return shortcuts.filter((item) => item.label.toLowerCase().includes(query)).slice(0, 8);
  }, [shortcuts, term]);

  const rows = results?.rows ?? [];

  React.useEffect(() => {
    setActiveIndex(0);
  }, [term, open]);

  React.useEffect(() => {
    if (open) {
      // Focus after the dialog animation starts so the caret is visible.
      const timer = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
    }
    setTerm("");
    return undefined;
  }, [open]);

  const commit = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    const total = rows.length + filteredShortcuts.length;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % Math.max(1, total));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + Math.max(1, total)) % Math.max(1, total));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = [...filteredShortcuts.map((item) => ({ label: item.label, href: item.href })), ...rows.map((row) => ({ label: row.title, href: row.href }))][activeIndex];
      if (target) commit(target.href);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[15%] max-w-2xl translate-y-0 p-0" hideClose>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search records or jump to a page.</DialogDescription>

        <div className="flex items-center gap-3 border-b border-border/70 px-4">
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Search className="h-4 w-4 text-muted-foreground" />}
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search people, vehicles, incidents, reports… or jump to a page"
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div className="max-h-[24rem] overflow-y-auto p-2">
          {term.trim().length < 2 && filteredShortcuts.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Type at least two characters to search.</p>
          ) : null}

          {filteredShortcuts.length > 0 ? (
            <div className="mb-2">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {term.trim().length >= 2 ? "Pages & actions" : "Suggestions"}
              </p>
              {filteredShortcuts.map((item, index) => (
                <button
                  key={`${item.href}-${item.label}`}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(item.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    activeIndex === index ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60",
                  )}
                >
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="text-[11px] text-muted-foreground">{item.group}</span>
                  {activeIndex === index ? <CornerDownLeft className="h-3.5 w-3.5" /> : null}
                </button>
              ))}
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div>
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Records</p>
              {rows.map((row, index) => {
                const flatIndex = filteredShortcuts.length + index;
                return (
                  <button
                    key={`${row.type}-${row.id}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    onClick={() => commit(row.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                      activeIndex === flatIndex ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60",
                    )}
                  >
                    <span className="rounded-md border border-border bg-secondary/50 p-1.5">
                      <RecordIcon type={row.type} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{row.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.reference ? `${row.reference} · ` : ""}
                        {row.subtitle ?? row.type}
                      </span>
                    </span>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{row.type}</span>
                    {activeIndex === flatIndex ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {term.trim().length >= 2 && !isFetching && rows.length === 0 && filteredShortcuts.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matches for “{term}”.</p>
          ) : null}

          {isFetching && rows.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner />
              Searching…
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
