/**
 * Table / Filter / Search standard helpers.
 *
 * Use these utilities when building any filterable table or list page.
 * They enforce URL-param-based state so filters survive navigation and
 * can be shared via URL.
 *
 * Key behaviours:
 * - Debounced search (300ms default)
 * - AbortController cancels in-flight requests on new filter
 * - Keeps previous data visible during loading (no skeleton flash)
 * - URL params: page, limit, search, sort, order, status, role, section
 *
 * Usage:
 * ```tsx
 * const {
 *   params,
 *   isLoading,
 *   setSearch,
 *   setPage,
 *   setFilter,
 * } = useTableParams({ defaultLimit: 20 });
 *
 * // Use params to build your API call
 * ```
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type TableParams = {
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
  [key: string]: string | number;
};

export type UseTableParamsOptions = {
  defaultLimit?: number;
  defaultSort?: string;
  defaultOrder?: "asc" | "desc";
  /** Debounce delay for search input in ms. Default: 300 */
  searchDebounceMs?: number;
};

export type UseTableParamsResult = {
  params: TableParams;
  /** True only on the very first fetch before any data arrives */
  isInitialLoading: boolean;
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSort: (sort: string, order?: "asc" | "desc") => void;
  setFilter: (key: string, value: string | number) => void;
  clearFilters: () => void;
  /** AbortSignal for the current request cycle — pass to clientApi calls */
  signal: AbortSignal;
};

export function useTableParams(options: UseTableParamsOptions = {}): UseTableParamsResult {
  const {
    defaultLimit = 20,
    defaultSort = "createdAt",
    defaultOrder = "desc",
    searchDebounceMs = 300,
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read initial values from URL
  const getParam = (key: string, fallback: string) =>
    searchParams.get(key) ?? fallback;

  const [params, setParams] = useState<TableParams>({
    page: Number(getParam("page", "1")),
    limit: Number(getParam("limit", String(defaultLimit))),
    search: getParam("search", ""),
    sort: getParam("sort", defaultSort),
    order: (getParam("order", defaultOrder) as "asc" | "desc"),
  });

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const abortRef = useRef(new AbortController());
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mark initial load done after first render
  useEffect(() => {
    setIsInitialLoading(false);
  }, []);

  useEffect(() => {
    const current = new URLSearchParams(searchParams.toString()).toString();
    const next = buildQueryString(params);
    if (current === next) {
      return;
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  }, [params, pathname, router, searchParams]);

  const updateParams = useCallback(
    (updates: Partial<TableParams>) => {
      // Cancel in-flight request
      abortRef.current.abort();
      abortRef.current = new AbortController();

	  setParams((prev) => ({ ...prev, ...updates } as TableParams));
    },
	[]
  );

  const setSearch = useCallback(
    (value: string) => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        updateParams({ search: value, page: 1 });
      }, searchDebounceMs);
    },
    [updateParams, searchDebounceMs]
  );

  const setPage = useCallback(
    (page: number) => updateParams({ page }),
    [updateParams]
  );

  const setLimit = useCallback(
    (limit: number) => updateParams({ limit, page: 1 }),
    [updateParams]
  );

  const setSort = useCallback(
    (sort: string, order?: "asc" | "desc") =>
      updateParams({
        sort,
        order: order ?? (params.sort === sort && params.order === "asc" ? "desc" : "asc"),
        page: 1,
      }),
    [updateParams, params]
  );

  const setFilter = useCallback(
    (key: string, value: string | number) => updateParams({ [key]: value, page: 1 }),
    [updateParams]
  );

  const clearFilters = useCallback(() => {
    updateParams({
      search: "",
      page: 1,
      sort: defaultSort,
      order: defaultOrder,
    });
  }, [updateParams, defaultSort, defaultOrder]);

  return {
    params,
    isInitialLoading,
    setSearch,
    setPage,
    setLimit,
    setSort,
    setFilter,
    clearFilters,
    signal: abortRef.current.signal,
  };
}

/**
 * Build a query string from TableParams, excluding empty/default values.
 */
export function buildQueryString(params: Partial<TableParams>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== undefined && v !== null) {
      sp.set(k, String(v));
    }
  });
  return sp.toString();
}
