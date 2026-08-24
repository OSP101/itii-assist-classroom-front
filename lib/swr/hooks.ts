"use client";

/**
 * SWR hooks for slow-changing reference data.
 *
 * Only put data here that a stale-then-revalidate read is safe for. Anything
 * where a few seconds of staleness would mislead the user — live queue
 * position, attendance check-ins, a rotating PIN — belongs on
 * lib/realtime/useRealtimeResource instead.
 */

import useSWR from "swr";
import { courseService } from "@/services/course.service";
import type { CourseListParams } from "@/services/course.service";
import { classroomService } from "@/services/classroom.service";
import { cacheKeys } from "./keys";
import { unwrap } from "./fetcher";

/**
 * Courses the signed-in user teaches or assists.
 *
 * `enabled` exists because this must not fire before the session is known:
 * calling it while the user is still loading would send an unauthenticated
 * request, get a 401, and push apiService into a refresh-then-redirect it never
 * needed to do. Passing a null key is SWR's documented way to hold a request.
 */
export function useMyCourses(params?: CourseListParams, enabled = true) {
  return useSWR(
    enabled ? cacheKeys.myCourses(params) : null,
    () => unwrap(courseService.getMyCourses(params)),
  );
}

/** Every course in the system — admin views only. */
export function useAllCourses(params?: CourseListParams, enabled = true) {
  return useSWR(
    enabled ? cacheKeys.allCourses(params) : null,
    () => unwrap(courseService.getCourses(params)),
  );
}

/**
 * A single course. This is the most-refetched read in the app: the instructor
 * layout, the classroom page and several tabs each ask for the same course, and
 * before caching every one of them was a separate round trip on every
 * navigation.
 */
export function useCourse(courseId: string | null | undefined) {
  return useSWR(
    courseId ? cacheKeys.course(courseId) : null,
    () => unwrap(courseService.getCourseById(courseId as string)),
  );
}

/** Aggregated counts for a course's overview tab. */
export function useCourseOverview(courseId: string | null | undefined) {
  return useSWR(
    courseId ? cacheKeys.courseOverview(courseId) : null,
    () => unwrap(courseService.getCourseOverview(courseId as string)),
  );
}

/** Per-user course totals shown on the instructor home page. */
export function useMyCoursesStats(enabled = true) {
  return useSWR(
    enabled ? cacheKeys.myCoursesStats() : null,
    () => unwrap(courseService.getMyCoursesStats()),
  );
}

/**
 * Classroom list. Rooms and desk layouts change a few times a semester at most,
 * so this is about as cacheable as data in this system gets.
 */
export function useClassrooms(
  params?: Parameters<typeof classroomService.getClassrooms>[0],
  enabled = true,
) {
  return useSWR(
    enabled ? cacheKeys.classrooms(params) : null,
    () => unwrap(classroomService.getClassrooms(params)),
  );
}
