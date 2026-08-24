/**
 * Central registry of SWR cache keys.
 *
 * Keys are built here rather than inline at call sites so that invalidation
 * after a mutation can target exactly the entries a write affects. A key typo
 * in an invalidation call is silent — the mutate simply matches nothing and the
 * screen keeps showing stale data — so both sides must read from one place.
 *
 * Keys are arrays: SWR serialises them stably, and the leading segment gives
 * prefix-matching something reliable to match on (see invalidate.ts).
 */

/**
 * Query params as they appear in a cache key. Deliberately looser than the
 * services' own param interfaces so any of them can be passed straight in —
 * those are plain option bags without index signatures, and the key builder
 * only ever serialises what it is given.
 */
export type CacheKeyParams = Record<string, unknown> | object;

export const cacheKeys = {
  myCourses: (params?: CacheKeyParams) =>
    ["courses", "mine", params ?? {}] as const,

  allCourses: (params?: CacheKeyParams) =>
    ["courses", "all", params ?? {}] as const,

  course: (courseId: string) => ["courses", "detail", courseId] as const,

  courseOverview: (courseId: string) =>
    ["courses", "overview", courseId] as const,

  myCoursesStats: () => ["courses", "my-stats"] as const,

  classrooms: (params?: CacheKeyParams) =>
    ["classrooms", "list", params ?? {}] as const,
};

/** Leading segment of every key family, used for prefix invalidation. */
export const cacheScopes = {
  courses: "courses",
  classrooms: "classrooms",
} as const;
