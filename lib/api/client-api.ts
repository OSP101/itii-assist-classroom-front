/**
 * Client API — for use in Client Components ONLY.
 *
 * Rules:
 * - Use exclusively for: mutations, filter/search, modals, realtime fallback,
 *   upload/import/export, user-triggered actions
 * - DO NOT use for initial page data — prefer server queries / Server Components
 * - Auth is via the httpOnly access-token cookie (credentials: 'include'),
 *   same as api.service.ts — there is no client-readable token anymore.
 * - Supports AbortController for cancellable requests
 * - Auto-retries safe GET requests (up to 2 times) with backoff
 * - Normalises response and throws ApiError for consistent error handling
 * - Provides `keepPreviousData` utility for filter/search without full skeleton
 *
 * This works alongside the existing api.service.ts — new features should use
 * clientApi. Existing code can migrate gradually.
 */

"use client";

import { API_BASE_URL } from "@/config/api";
import { ApiError } from "./api-error";
import type { ApiResponse } from "./types";
import {
  trackNetworkCooldownHit,
  trackNetworkDedupeHit,
  trackNetworkRequestFailure,
  trackNetworkRequestStart,
  trackNetworkRequestSuccess,
} from "./network-metrics";

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

type ClientRequestOptions = {
  /** Pass to cancel in-flight requests (recommended for search/filter) */
  signal?: AbortSignal;
  /** Retry safe GETs on network failure. Default true for GET, false otherwise. */
  retry?: boolean;
  /** Deduplicate same in-flight GET requests. Default true for GET. */
  dedupe?: boolean;
  /** Short client-side cooldown cache in ms for identical GET requests. Default 800ms. */
  cooldownMs?: number;
  /** Extra headers */
  headers?: Record<string, string>;
};

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type CooldownEntry = {
  expiresAt: number;
  value: unknown;
};

const inflightGetRequests = new Map<string, Promise<unknown>>();
const cooldownGetCache = new Map<string, CooldownEntry>();
const DEFAULT_GET_COOLDOWN_MS = 800;

async function clientRequest<T>(
  method: RequestMethod,
  path: string,
  body?: unknown,
  options: ClientRequestOptions = {}
): Promise<T> {
  const {
    signal,
    retry = method === "GET",
    dedupe = method === "GET",
    cooldownMs = DEFAULT_GET_COOLDOWN_MS,
    headers: extraHeaders = {},
  } = options;

  const url = `${API_BASE_URL}${path}`;
  const requestKey = `${method}:${url}`;

  if (method === "GET") {
    const now = Date.now();
    const cached = cooldownGetCache.get(requestKey);
    if (cached && cached.expiresAt > now) {
      trackNetworkCooldownHit();
      return cached.value as T;
    }

    // If caller needs per-request cancellation, skip shared in-flight dedupe.
    if (dedupe && !signal) {
      const existing = inflightGetRequests.get(requestKey);
      if (existing) {
        trackNetworkDedupeHit();
        return (await existing) as T;
      }
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Client-Type": "web",
    ...extraHeaders,
  };
  if (method !== "GET") {
    const csrfToken = readCookie("csrf_token");
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }

  let attempt = 0;

  const execute = async (): Promise<T> => {
    const startedAt = performance.now();
    trackNetworkRequestStart();

    while (true) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        credentials: "include",
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });

      let json: ApiResponse<T>;
      try {
        json = await response.json();
      } catch {
        throw new ApiError(
          `Server returned non-JSON response (${response.status})`,
          response.status
        );
      }

      if (response.status === 401) {
        // Token expired — surface immediately so caller can redirect
        throw new ApiError("กรุณาเข้าสู่ระบบใหม่", 401);
      }

      if (!response.ok || !json.success) {
        throw new ApiError(
          (json as { message?: string }).message || `HTTP ${response.status}`,
          response.status,
          (json as { error?: string }).error
        );
      }

      const value = (json as { data: T }).data;

      if (method === "GET" && cooldownMs > 0) {
        cooldownGetCache.set(requestKey, {
          expiresAt: Date.now() + cooldownMs,
          value,
        });
      }

      trackNetworkRequestSuccess(performance.now() - startedAt);

      return value;
    } catch (error) {
      // Aborted — do not retry
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      if (error instanceof ApiError) {
        // Retry only on network errors (status 0) for safe GETs
        const isNetworkErr = error.status === 0 && error.isNetworkError;
        if (retry && isNetworkErr && attempt < MAX_RETRIES) {
          attempt++;
          await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        trackNetworkRequestFailure(performance.now() - startedAt);
        throw error;
      }

      trackNetworkRequestFailure(performance.now() - startedAt);
      throw ApiError.fromUnknown(error);
    }
  }
  };

  if (method === "GET" && dedupe && !signal) {
    const promise = execute();
    inflightGetRequests.set(requestKey, promise as Promise<unknown>);
    try {
      return await promise;
    } finally {
      inflightGetRequests.delete(requestKey);
    }
  }

  return execute();
}

/**
 * Client-side API client.
 *
 * Usage examples:
 *
 * ```ts
 * // Search with abort on new keystroke
 * const controller = new AbortController();
 * const results = await clientApi.get<Student[]>(`/students?search=${q}`, {
 *   signal: controller.signal,
 * });
 *
 * // Mutation
 * await clientApi.post('/assignments', payload);
 * ```
 */
export const clientApi = {
  get<T>(path: string, options?: ClientRequestOptions): Promise<T> {
    return clientRequest<T>("GET", path, undefined, options);
  },

  post<T>(path: string, body?: unknown, options?: ClientRequestOptions): Promise<T> {
    return clientRequest<T>("POST", path, body, { retry: false, ...options });
  },

  put<T>(path: string, body?: unknown, options?: ClientRequestOptions): Promise<T> {
    return clientRequest<T>("PUT", path, body, { retry: false, ...options });
  },

  patch<T>(path: string, body?: unknown, options?: ClientRequestOptions): Promise<T> {
    return clientRequest<T>("PATCH", path, body, { retry: false, ...options });
  },

  delete<T>(path: string, options?: ClientRequestOptions): Promise<T> {
    return clientRequest<T>("DELETE", path, undefined, { retry: false, ...options });
  },
};

/**
 * Hook-friendly utility: keep the previous data reference while new data loads.
 * Use in filter/search patterns so the table doesn't flash skeleton on each keypress.
 *
 * ```ts
 * const [data, setData] = useState<Student[]>([]);
 * const prev = useRef(data);
 * const displayed = keepPreviousData(data, prev.current); // shows prev while loading
 * ```
 */
export function keepPreviousData<T>(current: T | undefined, previous: T): T {
  return current ?? previous;
}
