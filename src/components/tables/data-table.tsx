"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Download, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, EmptyState, Input, Skeleton, Spinner } from "@/components/ui/primitives";
import { Checkbox } from "@/components/ui/overlays";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Column is hidden in the compact/mobile card layout. */
  secondary?: boolean;
  sortable?: boolean;
  width?: string;
  align?: "left" | "right" | "center";
};

export type ListMeta = {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type ListQuery = {
  page: number;
  pageSize: number;
  search: string;
  sort?: string;
  dir: "asc" | "desc";
  [key: string]: string | number | string[] | undefined;
};

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * The single reusable data table.
 *
 * Sorting, paging and filtering are executed on the server (indexed queries);
 * the table owns nothing but presentation and URL state. It renders as a
 * table on desktop and as cards on small screens.
 */
export function DataTable<T extends { id: string }>({
  rows,
  meta,
  columns,
  query,
  onQueryChange,
  loading,
  error,
  emptyTitle = "No records yet",
  emptyDescription,
  emptyAction,
  toolbar,
  resourceType,
  searchPlaceholder = "Search…",
  selectable,
  bulkActions,
  rowHref,
  className,
  onRetry,
}: {
  rows: T[];
  meta?: ListMeta;
  columns: Array<DataTableColumn<T>>;
  query: ListQuery;
  onQueryChange: (next: Partial<ListQuery>) => void;
  loading?: boolean;
  error?: Error | null;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  toolbar?: React.ReactNode;
  resourceType?: string;
  searchPlaceholder?: string;
  selectable?: boolean;
  bulkActions?: (selectedIds: string[], clear: () => void) => React.ReactNode;
  rowHref?: (row: T) => string;
  className?: string;
  onRetry?: () => void;
}) {
  const [searchDraft, setSearchDraft] = React.useState(query.search ?? "");
  const [selected, setSelected] = React.useState<string[]>([]);

  // Debounce so typing does not fire a request per keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if ((query.search ?? "") !== searchDraft) onQueryChange({ search: searchDraft, page: 1 });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchDraft, onQueryChange, query.search]);

  React.useEffect(() => {
    setSelected([]);
  }, [query.page, query.sort, query.dir, query.search]);

  const visibleColumns = columns.filter((column) => !column.secondary);

  function toggleSort(key: string) {
    const nextDir = query.sort === key && query.dir === "desc" ? "asc" : "desc";
    onQueryChange({ sort: key, dir: nextDir, page: 1 });
  }

  function exportCsv() {
    if (!resourceType) return;
    void api
      .fetchCsv(resourceType, query.search ?? "")
      .then(() => toast.success("Export downloaded"))
      .catch((caught) => toast.error(errorMessage(caught)));
  }

  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id));
  const total = meta?.total ?? rows.length;
  const page = meta?.page ?? query.page;
  const pageCount = meta?.pageCount ?? 1;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
            aria-label="Search records"
          />
          {searchDraft ? (
            <button
              type="button"
              onClick={() => setSearchDraft("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {toolbar}
          {resourceType ? (
            <Button variant="outline" size="sm" onClick={exportCsv} title="Export the current list to CSV">
              <Download />
              <span className="hidden sm:inline">Export</span>
            </Button>
          ) : null}
        </div>
      </div>

      {selected.length > 0 && bulkActions ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
          <span className="text-xs font-medium">{selected.length} selected</span>
          {bulkActions(selected, () => setSelected([]))}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border/70 bg-card/70">
        {error ? (
          <EmptyState
            icon={<SlidersHorizontal className="h-5 w-5" />}
            title="We could not load this list"
            description={error.message}
            action={
              onRetry ? (
                <Button size="sm" variant="outline" onClick={onRetry}>
                  Try again
                </Button>
              ) : null
            }
          />
        ) : loading && rows.length === 0 ? (
          <TableSkeleton rows={Math.min(8, query.pageSize)} columns={visibleColumns.length} />
        ) : rows.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-secondary/30 text-left">
                    {selectable ? (
                      <th className="w-10 px-3 py-2">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(checked: boolean) => setSelected(checked ? rows.map((row) => row.id) : [])}
                          aria-label="Select all rows"
                        />
                      </th>
                    ) : null}
                    {visibleColumns.map((column) => (
                      <th key={column.key} className={cn("whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", column.align === "right" && "text-right")} style={{ width: column.width }}>
                        {column.sortable ? (
                          <button type="button" onClick={() => toggleSort(column.key)} className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                            {column.header}
                            {query.sort === column.key ? (
                              query.dir === "asc" ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )
                            ) : null}
                          </button>
                        ) : (
                          column.header
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={cn("divide-y divide-border/50", loading && "opacity-60 transition-opacity")}>
                  {rows.map((row) => (
                    <tr key={row.id} className="group transition-colors hover:bg-secondary/40">
                      {selectable ? (
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={selected.includes(row.id)}
                            onCheckedChange={(checked: boolean) =>
                              setSelected((current) => (checked ? [...current, row.id] : current.filter((id) => id !== row.id)))
                            }
                            aria-label={`Select row ${row.id}`}
                          />
                        </td>
                      ) : null}
                      {visibleColumns.map((column) => (
                        <td key={column.key} className={cn("px-3 py-2 align-middle", column.align === "right" && "text-right")}>
                          {rowHref ? (
                            <Link href={rowHref(row)} className="contents">
                              {column.cell(row)}
                            </Link>
                          ) : (
                            column.cell(row)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: compact cards */}
            <ul className="divide-y divide-border/50 md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="p-3">
                  {rowHref ? (
                    <Link href={rowHref(row)} className="block space-y-1">
                      <CardRow row={row} columns={columns} />
                    </Link>
                  ) : (
                    <CardRow row={row} columns={columns} />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {total === 0 ? "No results" : `Showing ${(page - 1) * (meta?.pageSize ?? query.pageSize) + 1}–${Math.min(page * (meta?.pageSize ?? query.pageSize), total)} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <select
            value={query.pageSize}
            onChange={(event) => onQueryChange({ pageSize: Number(event.target.value), page: 1 })}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onQueryChange({ page: page - 1 })}>
            <ChevronLeft />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <span className="px-1 text-xs text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onQueryChange({ page: page + 1 })}>
            <span className="hidden sm:inline">Next</span>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CardRow<T>({ row, columns }: { row: T; columns: Array<DataTableColumn<T>> }) {
  const [primary, ...rest] = columns;
  const secondary = rest.filter((column) => !column.secondary).slice(0, 3);
  return (
    <>
      <div className="font-medium">{primary ? primary.cell(row) : null}</div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {secondary.map((column) => (
          <div key={column.key} className="flex min-w-0 flex-col">
            <dt className="truncate text-[10px] uppercase tracking-wide opacity-70">{column.header}</dt>
            <dd className="truncate">{column.cell(row)}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function TableSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton key={columnIndex} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Small shared helper for status and priority presentation. */
export function StatusPill({ label, colour, className }: { label: string; colour?: string; className?: string }) {
  return (
    <Badge colour={colour} className={className}>
      {label}
    </Badge>
  );
}

export { Columns3, Spinner };
