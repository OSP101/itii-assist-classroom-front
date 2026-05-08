/**
 * Course Overview — cached server queries.
 *
 * These functions use `"use cache"` so Next.js will:
 * - Cache the result under the given cache tags
 * - Revalidate when `revalidateTag(...)` is called after a mutation
 *
 * IMPORTANT: Do NOT call cookies() / headers() here. Read the auth token
 * OUTSIDE this function (e.g., in the page component) and pass it as `token`.
 *
 * Usage in a Server Component:
 * ```ts
 * const { data: session } = await auth(); // or your session helper
 * const data = await getCoursePageShellData(courseId, session.accessToken);
 * ```
 */

import { cacheLife, cacheTag } from "next/cache";
import { serverApi } from "@/lib/api/server-api";
import { cacheTags } from "@/lib/cache/cache-tags";

// ---------------------------------------------------------------------------
// Shell data — always needed; drives header, breadcrumb, sidebar badges
// ---------------------------------------------------------------------------

/**
 * Fetches the minimal data that every classroom sub-page needs:
 * - Course detail
 * - User's role in the course
 * - Navigation badge counts (pending approvals, ungraded etc.)
 */
export async function getCoursePageShellData(courseId: string, token: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.courseDetail(courseId));
  cacheTag(cacheTags.courseOverview(courseId));

  const [course, overview] = await Promise.all([
    serverApi.get<CourseDetail>(`/courses/${courseId}`, { token }),
    serverApi.get<CourseOverview>(`/courses/${courseId}/overview`, { token }),
  ]);

  return { course, overview };
}

// ---------------------------------------------------------------------------
// Course overview analytics — secondary; loaded after shell
// ---------------------------------------------------------------------------

/**
 * Heavier analytics data — wrap in <Suspense> so it doesn't block shell render.
 */
export async function getCourseAnalyticsData(courseId: string, token: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.courseAnalytics(courseId));

  return serverApi.get<CourseAnalytics>(
    `/courses/${courseId}/analytics`,
    { token }
  );
}

// ---------------------------------------------------------------------------
// Types (minimal — expand as the real API shapes are confirmed)
// ---------------------------------------------------------------------------

export type CourseDetail = {
  id: string;
  name: string;
  code: string;
  semester: string;
  year: string;
  status: "active" | "closed" | "draft";
  instructors: { id: number; name: string; avatarUrl?: string }[];
  classroomId?: string;
  createdAt: string;
};

export type CourseOverview = {
  totalStudents: number;
  totalSections: number;
  totalAssignments: number;
  gradedAssignments: number;
  pendingApprovals: number;
  ungradedStudents: number;
  attendanceSessions: number;
  queueSessions: number;
};

export type CourseAnalytics = {
  scoreDistribution: { label: string; count: number }[];
  attendanceRate: number;
  riskStudentCount: number;
  recentActivity: { action: string; at: string }[];
};
