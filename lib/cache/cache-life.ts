/**
 * Cache lifetime policy — centralised durations for `cacheLife(...)`.
 *
 * Use inside `"use cache"` functions:
 * ```ts
 * "use cache";
 * cacheLife(cacheDurations.pageSummary);
 * ```
 *
 * Policy:
 * - staticMeta   → hours   — course/classroom details that rarely change
 * - pageSummary  → minutes — overview counts, my-courses, lists
 * - analytics    → minutes — chart data, aggregates
 * - recentActivity → seconds — activity logs, pending counts
 * - realtimeSnapshot → seconds — ultra-short snapshot before client subscribes
 *
 * DO NOT use these for:
 * - queue live state
 * - attendance live records
 * - auth login/logout/refresh
 * - upload/import/export
 * - mutation endpoints
 */

export const cacheDurations = {
  /** Hours — use for course/classroom details, dropdown lists, static settings */
  staticMeta: "hours",
  /** Minutes — use for my-courses, overview, assignment list, people, teams */
  pageSummary: "minutes",
  /** Minutes — use for analytics charts, aggregated counts */
  analytics: "minutes",
  /** Seconds — use for activity log, pending counts, ungraded summary */
  recentActivity: "seconds",
  /** Seconds — very short; initial snapshot before client connects to realtime */
  realtimeSnapshot: "seconds",
} as const;

export type CacheDuration = (typeof cacheDurations)[keyof typeof cacheDurations];
