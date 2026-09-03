"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ListQuery } from "@/components/tables/data-table";

const DEFAULTS: ListQuery = { page: 1, pageSize: 25, search: "", dir: "desc" };

/**
 * List state lives in the URL so every view is shareable, bookmarkable and
 * survives a refresh (and the back button behaves as users expect).
 */
export function useListQuery(defaults: Partial<ListQuery> = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = React.useMemo<ListQuery>(() => {
    const base = { ...DEFAULTS, ...defaults };
    const next: ListQuery = { ...base };
    for (const [key, value] of searchParams.entries()) {
      if (key === "page" || key === "pageSize") next[key] = Number(value);
      else if (key === "dir") next.dir = value === "asc" ? "asc" : "desc";
      else next[key] = value;
    }
    return next;
  }, [searchParams, defaults]);

  const setQuery = React.useCallback(
    (patch: Partial<ListQuery>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "" || value === null) params.delete(key);
        else params.set(key, String(value));
      }
      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  /** Parameters ready to send to the API (filters included). */
  const apiParams = React.useMemo(() => {
    const params: Record<string, unknown> = { ...query };
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) params[key] = value.join(",");
    }
    return params;
  }, [query]);

  return { query, setQuery, apiParams };
}

/** Debounced value for local search inputs. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
