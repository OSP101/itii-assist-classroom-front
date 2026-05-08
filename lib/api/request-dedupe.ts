/**
 * Request deduplication for server-side data fetching.
 *
 * When multiple Server Components in the same render tree call the same endpoint,
 * this deduplicator ensures only one fetch is in-flight at a time. Subsequent
 * callers receive the same promise.
 *
 * This is a server-side in-memory map — it is reset per request in Next.js
 * because the module is re-evaluated per server request in edge/serverless
 * environments. For Node.js runtime, calls are deduplicated within the same
 * concurrent render pass.
 *
 * Usage:
 * ```ts
 * const data = await requestDedupe.fetch<Course>(`/courses/${id}`, () =>
 *   serverApi.get<Course>(`/courses/${id}`, { token })
 * );
 * ```
 */

// Map of in-flight promises keyed by URL/cache key
const inFlightMap = new Map<string, Promise<unknown>>();

export const requestDedupe = {
  /**
   * Execute `fetcher` or return the in-flight promise for the same key.
   * The promise is removed from the map after it settles.
   */
  async fetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (inFlightMap.has(key)) {
      return inFlightMap.get(key) as Promise<T>;
    }

    const promise = fetcher().finally(() => {
      inFlightMap.delete(key);
    });

    inFlightMap.set(key, promise);
    return promise;
  },

  /** Clear all in-flight entries (useful in tests) */
  clear() {
    inFlightMap.clear();
  },
};
