/**
 * Server API — for use in Server Components, server actions, and cached queries ONLY.
 *
 * Rules:
 * - NEVER use in Client Components ("use client" files)
 * - Reads auth token from server-side session/cookies (via next/headers)
 * - Normalises response to ApiResponse<T>
 * - Throws ApiError on failure
 * - Supports request deduplication within a single RSC render pass
 * - Supports configurable timeout
 * - DO NOT call cookies()/headers() inside "use cache" scope — extract token BEFORE calling
 *   cached functions and pass userId/role as arguments instead
 */

import { API_BASE_URL } from "@/config/api";
import { ApiError } from "./api-error";
import type { ApiResponse } from "./types";

// Default timeout for server-side requests (ms)
const DEFAULT_TIMEOUT_MS = 15_000;

type ServerRequestOptions = {
  /** Auth token — read from cookies() OUTSIDE any cached scope, then pass in */
  token?: string;
  timeout?: number;
  /** Extra headers */
  headers?: Record<string, string>;
  /** Revalidation tags for Next.js fetch cache (used via `next: { tags }`) */
  tags?: string[];
  /** Cache revalidation seconds — undefined means use Next.js default */
  revalidate?: number | false;
};

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function serverRequest<T>(
  method: RequestMethod,
  path: string,
  body?: unknown,
  options: ServerRequestOptions = {}
): Promise<T> {
  const { token, timeout = DEFAULT_TIMEOUT_MS, headers = {}, tags, revalidate } = options;

  const url = `${API_BASE_URL}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const requestHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  // Build next.js fetch cache options
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nextOptions: Record<string, any> = {};
  if (tags && tags.length > 0) {
    nextOptions.tags = tags;
  }
  if (revalidate !== undefined) {
    nextOptions.revalidate = revalidate;
  }

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      // Attach Next.js cache options when provided
      ...(Object.keys(nextOptions).length > 0 ? { next: nextOptions } : {}),
    });

    clearTimeout(timeoutId);

    let json: ApiResponse<T>;
    try {
      json = await response.json();
    } catch {
      throw new ApiError(
        `Server returned non-JSON response (${response.status})`,
        response.status
      );
    }

    if (!response.ok || !json.success) {
      throw new ApiError(
        (json as { message?: string }).message || `HTTP ${response.status}`,
        response.status,
        (json as { error?: string }).error
      );
    }

    return (json as { data: T }).data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(`Request timed out: ${path}`, 0, undefined, true);
    }

    throw new ApiError(
      error instanceof Error ? error.message : "Network error",
      0,
      undefined,
      true
    );
  }
}

/**
 * Server-side API client.
 *
 * Usage example inside a cached query function:
 *
 * ```ts
 * // Good — token is passed as argument, not read inside cached scope
 * export async function getCourseOverview(courseId: string, token: string) {
 *   "use cache";
 *   cacheLife("minutes");
 *   cacheTag(`course:${courseId}:overview`);
 *   return serverApi.get<CourseOverview>(`/courses/${courseId}/overview`, { token });
 * }
 * ```
 */
export const serverApi = {
  get<T>(path: string, options?: ServerRequestOptions): Promise<T> {
    return serverRequest<T>("GET", path, undefined, options);
  },

  post<T>(path: string, body?: unknown, options?: ServerRequestOptions): Promise<T> {
    return serverRequest<T>("POST", path, body, options);
  },

  put<T>(path: string, body?: unknown, options?: ServerRequestOptions): Promise<T> {
    return serverRequest<T>("PUT", path, body, options);
  },

  patch<T>(path: string, body?: unknown, options?: ServerRequestOptions): Promise<T> {
    return serverRequest<T>("PATCH", path, body, options);
  },

  delete<T>(path: string, options?: ServerRequestOptions): Promise<T> {
    return serverRequest<T>("DELETE", path, undefined, options);
  },
};
