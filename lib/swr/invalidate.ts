"use client";

/**
 * Cache invalidation helpers to call after a write.
 *
 * SWR's global mutate accepts a predicate, which is what makes prefix
 * invalidation possible: "any cached course data" rather than having to
 * enumerate every list variant (page, limit, search, status filter…) that might
 * be holding a copy of the row that just changed.
 *
 * Rule of thumb: after mutating a course, call invalidateCourses(). Being
 * slightly too broad costs one extra background refetch; being too narrow
 * leaves the user staring at the value they just changed.
 */

import { mutate } from "swr";
import { cacheScopes } from "./keys";

/** True when an SWR key is an array whose first element is the given scope. */
function keyHasScope(key: unknown, scope: string): boolean {
  return Array.isArray(key) && key[0] === scope;
}

/** Revalidate everything course-related: lists, detail pages and stats. */
export function invalidateCourses() {
  return mutate((key) => keyHasScope(key, cacheScopes.courses), undefined, {
    revalidate: true,
  });
}

/** Revalidate every cached classroom list. */
export function invalidateClassrooms() {
  return mutate((key) => keyHasScope(key, cacheScopes.classrooms), undefined, {
    revalidate: true,
  });
}

/**
 * Drop every cached entry. Intended for logout and account switching, where
 * leaving another user's courses in the cache would be a data-leak between
 * sessions on a shared machine — a real scenario on lab computers.
 */
export function clearAllCaches() {
  return mutate(() => true, undefined, { revalidate: false });
}
