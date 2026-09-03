"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Input, Spinner } from "@/components/ui/primitives";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";

export type PickerOption = { id: string; label: string; reference?: string | null; meta?: string | null };

/**
 * Record picker.
 *
 * Search-as-you-type against the relevant API endpoint, so pickers work with
 * large datasets without loading every row into the browser.
 */
export function RecordPicker({
  resource,
  value,
  selected,
  onChange,
  placeholder = "Search…",
  disabled,
}: {
  resource: string;
  value: string | null;
  selected?: PickerOption | null;
  onChange: (option: PickerOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const [options, setOptions] = React.useState<PickerOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [label, setLabel] = React.useState<string | null>(selected?.label ?? null);

  React.useEffect(() => {
    if (selected?.label) setLabel(selected.label);
  }, [selected?.label]);

  // Resolve a pre-selected id to a human label once on mount.
  React.useEffect(() => {
    let cancelled = false;
    if (!value || selected?.label || label) return;
    void api
      .get<Record<string, unknown>>(`/api/${RESOURCE_PATH[resource] ?? resource}/${value}`)
      .then((record) => {
        if (!cancelled) setLabel(describe(record));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get<{ rows: Array<Record<string, unknown>> }>(`/api/${RESOURCE_PATH[resource] ?? resource}`, { search: term, pageSize: 10 })
        .then((response) => {
          if (cancelled) return;
          setOptions(
            (response.rows ?? []).map((row) => ({
              id: String(row.id),
              label: describe(row),
              reference: (row.reference as string) ?? null,
            })),
          );
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, term, resource]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background/60 px-3 text-sm shadow-sm transition-colors hover:bg-secondary/50 disabled:opacity-60",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{label ?? placeholder}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="flex items-center gap-2 border-b border-border/70 px-2 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={placeholder}
            className="h-7 border-none bg-transparent px-1 shadow-none focus-visible:ring-0"
            autoFocus
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setLabel(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-secondary"
            >
              <X className="h-3.5 w-3.5" />
              Clear selection
            </button>
          ) : null}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner />
            </div>
          ) : options.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches.</p>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option);
                  setLabel(option.label);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.reference ? <span className="font-mono text-[10px] text-muted-foreground">{option.reference}</span> : null}
                {value === option.id ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** User picker backed by the user directory. */
export function UserPicker({
  value,
  onChange,
  disabled,
  placeholder = "Select a user…",
}: {
  value: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [users, setUsers] = React.useState<PickerOption[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    api
      .get<{ rows: Array<{ id: string; name: string; jobTitle: string | null }> }>("/api/admin/users", { pageSize: 200 })
      .then((response) => {
        if (!cancelled) {
          setUsers((response.rows ?? []).map((row) => ({ id: row.id, label: row.name, meta: row.jobTitle ?? null })));
        }
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <select
      value={value ?? ""}
      disabled={disabled || loading}
      onChange={(event) => onChange(event.target.value || null)}
      className="h-9 w-full rounded-md border border-input bg-background/60 px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    >
      <option value="">{loading ? "Loading users…" : placeholder}</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.label}
          {user.meta ? ` · ${user.meta}` : ""}
        </option>
      ))}
    </select>
  );
}

const RESOURCE_PATH: Record<string, string> = {
  person: "people",
  vehicle: "vehicles",
  incident: "incidents",
  case: "cases",
  report: "reports",
  task: "tasks",
  unit: "units",
  user: "admin/users",
};

export function describe(record: Record<string, unknown>): string {
  if (record.name) return String(record.name);
  if (record.title) return String(record.title);
  if (record.subject) return String(record.subject);
  if (record.registration) return `${String(record.registration)}${record.make ? ` · ${record.make}` : ""}${record.model ? ` ${record.model}` : ""}`;
  if (record.firstName || record.lastName) return `${record.firstName ?? ""} ${record.lastName ?? ""}`.trim();
  if (record.callsign) return String(record.callsign);
  if (record.reference) return String(record.reference);
  return String(record.id ?? "Record");
}
