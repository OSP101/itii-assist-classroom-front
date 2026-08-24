/**
 * Bridges the ApiResponse envelope to what SWR expects.
 *
 * apiService resolves successfully even for failures — it returns
 * `{ success: false, error }` rather than throwing. SWR treats any resolved
 * promise as data, so passing a service method straight in as a fetcher would
 * cache failure envelopes as if they were real data and never surface an error
 * state. Everything here therefore goes through unwrap().
 */

import type { ApiResponse } from "./types";

export class ApiCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiCallError";
  }
}

/**
 * Unwraps an ApiResponse into its payload, throwing on failure so SWR can put
 * the hook into its error state.
 *
 * Note on 401: apiService already handles session expiry itself (refresh, then
 * redirect to login), so by the time an error envelope reaches here the session
 * question is settled and this is just a normal failure.
 */
export async function unwrap<T>(call: Promise<ApiResponse<T>>): Promise<T> {
  const response = await call;

  if (!response.success || response.data === undefined) {
    throw new ApiCallError(
      response.error || response.message || "Request failed",
    );
  }

  return response.data;
}
