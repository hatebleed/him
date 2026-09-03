"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { api } from "@/lib/api/client";
import { useListQuery } from "@/lib/hooks/use-list-query";
import { Button } from "@/components/ui/primitives";
import { DataTable, type DataTableColumn, type ListMeta } from "@/components/tables/data-table";
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { LinkButton } from "@/components/ui/primitives";

type ListResponse<T> = { rows: T[] } & ListMeta;

/**
 * Generic list page.
 *
 * Modules supply their columns and endpoints; paging, searching, sorting,
 * error handling, empty states, refresh and export are shared behaviour.
 */
export function ListPage<T extends { id: string }>({
  resourceType,
  endpoint,
  queryKey,
  title,
  description,
  columns,
  rowHref,
  createHref,
  createLabel,
  createPermission,
  filters,
  emptyTitle = "No records found",
  emptyDescription,
  searchPlaceholder,
  defaultSort,
  pageSize = 25,
  refreshInterval,
}: {
  resourceType: string;
  endpoint: string;
  queryKey?: string[];
  title: React.ReactNode;
  description?: React.ReactNode;
  columns: Array<DataTableColumn<T>>;
  rowHref?: (row: T) => string;
  createHref?: string;
  createLabel?: string;
  createPermission?: string;
  filters?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  searchPlaceholder?: string;
  defaultSort?: string;
  pageSize?: number;
  refreshInterval?: number;
}) {
  const { can } = useSession();
  const queryClient = useQueryClient();
  const { query, setQuery, apiParams } = useListQuery({ sort: defaultSort, pageSize });
  const key = queryKey ?? [resourceType, "list"];

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [...key, apiParams],
    queryFn: () => api.get<ListResponse<T>>(endpoint, apiParams),
    refetchInterval: refreshInterval ? refreshInterval : undefined,
    placeholderData: (previous) => previous,
  });

  const canCreate = createHref ? can(createPermission) : false;

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <PageHeaderSkeleton />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-md bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => void refetch()} disabled={isFetching} aria-label="Refresh">
              <RefreshCw className={isFetching ? "animate-spin" : undefined} />
            </Button>
            {canCreate ? (
              <LinkButton href={createHref!} size="sm">
                {createLabel ?? "Create"}
              </LinkButton>
            ) : null}
          </>
        }
      />

      <DataTable<T>
        rows={data?.rows ?? []}
        meta={data ? { total: data.total, page: data.page, pageSize: data.pageSize, pageCount: data.pageCount } : undefined}
        columns={columns}
        query={query}
        onQueryChange={setQuery}
        loading={isFetching}
        error={error as Error | null}
        onRetry={() => void queryClient.invalidateQueries({ queryKey: key })}
        resourceType={resourceType}
        searchPlaceholder={searchPlaceholder}
        rowHref={rowHref}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        toolbar={filters}
      />
    </div>
  );
}

/** Header for detail pages while the record loads. */
export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-40 animate-pulse rounded bg-muted/40" />
      <div className="h-9 w-2/3 animate-pulse rounded bg-muted/40" />
      <div className="h-64 w-full animate-pulse rounded-lg bg-muted/30" />
    </div>
  );
}

/** Standard "record not found / no access" state. */
export function NotFoundState({ message = "This record does not exist, has been deleted, or you do not have access to it." }: { message?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/70 p-10 text-center">
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
