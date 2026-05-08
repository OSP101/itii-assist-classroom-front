/**
 * Cache revalidation helpers — used in server actions after mutations.
 *
 * Each helper revalidates all cache tags that should be refreshed for a given
 * operation. Call these at the END of a server action after the API mutation
 * succeeds.
 *
 * Rules:
 * - Only invalidate tags that are actually stale after the mutation
 * - Do not revalidate everything — be precise to avoid unnecessary re-fetches
 * - These are server-only — import only in server actions / route handlers
 */

import { revalidateTag } from "next/cache";
import { cacheTags } from "./cache-tags";

// ---------------------------------------------------------------------------
// Auth / Profile
// ---------------------------------------------------------------------------

export async function revalidateMe() {
  revalidateTag(cacheTags.me(), {});
  revalidateTag(cacheTags.profile(), {});
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function revalidateCourseDetail(courseId: string) {
  revalidateTag(cacheTags.courseDetail(courseId), {});
  revalidateTag(cacheTags.courseOverview(courseId), {});
}

export async function revalidateCourseSettings(courseId: string) {
  revalidateTag(cacheTags.courseSettings(courseId), {});
  revalidateTag(cacheTags.courseOverview(courseId), {});
}

export async function revalidateCourseMembers(courseId: string) {
  revalidateTag(cacheTags.coursePeople(courseId), {});
  revalidateTag(cacheTags.courseSections(courseId), {});
  revalidateTag(cacheTags.courseOverview(courseId), {});
  revalidateTag(cacheTags.myCourses(), {});
}

export async function revalidateCourseAssignments(courseId: string) {
  revalidateTag(cacheTags.courseAssignments(courseId), {});
  revalidateTag(cacheTags.courseOverview(courseId), {});
  revalidateTag(cacheTags.courseAnalytics(courseId), {});
  revalidateTag(cacheTags.courseActivity(courseId), {});
}

export async function revalidateCourseScores(courseId: string) {
  revalidateTag(cacheTags.courseScores(courseId), {});
  revalidateTag(cacheTags.courseOverview(courseId), {});
  revalidateTag(cacheTags.courseAnalytics(courseId), {});
  revalidateTag(cacheTags.courseActivity(courseId), {});
}

export async function revalidateScoreApprovals(courseId: string) {
  revalidateTag(cacheTags.courseScoreApprovals(courseId), {});
  revalidateTag(cacheTags.courseScores(courseId), {});
  revalidateTag(cacheTags.courseOverview(courseId), {});
  revalidateTag(cacheTags.courseAnalytics(courseId), {});
  revalidateTag(cacheTags.courseActivity(courseId), {});
}

export async function revalidateCourseAttendance(courseId: string) {
  revalidateTag(cacheTags.courseAttendance(courseId), {});
  revalidateTag(cacheTags.courseOverview(courseId), {});
  revalidateTag(cacheTags.courseActivity(courseId), {});
}

export async function revalidateCourseQueue(courseId: string) {
  revalidateTag(cacheTags.courseQueue(courseId), {});
  revalidateTag(cacheTags.courseOverview(courseId), {});
  revalidateTag(cacheTags.courseActivity(courseId), {});
}

export async function revalidateQueueBooking(courseId: string) {
  revalidateTag(cacheTags.courseQueue(courseId), {});
  revalidateTag(cacheTags.courseScores(courseId), {});
  revalidateTag(cacheTags.courseTa(courseId), {});
  revalidateTag(cacheTags.courseActivity(courseId), {});
  revalidateTag(cacheTags.courseAnalytics(courseId), {});
}

export async function revalidateCourseTeams(courseId: string) {
  revalidateTag(cacheTags.courseTeams(courseId), {});
  revalidateTag(cacheTags.coursePeople(courseId), {});
  revalidateTag(cacheTags.courseOverview(courseId), {});
}

export async function revalidateCourseExams(courseId: string) {
  revalidateTag(cacheTags.courseExams(courseId), {});
  revalidateTag(cacheTags.courseScores(courseId), {});
  revalidateTag(cacheTags.courseAnalytics(courseId), {});
  revalidateTag(cacheTags.courseActivity(courseId), {});
}

export async function revalidateCourseBonus(courseId: string) {
  revalidateTag(cacheTags.courseBonus(courseId), {});
  revalidateTag(cacheTags.courseScores(courseId), {});
  revalidateTag(cacheTags.courseOverview(courseId), {});
  revalidateTag(cacheTags.courseActivity(courseId), {});
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function revalidateAdminUsers() {
  revalidateTag(cacheTags.adminUsers(), {});
}

export async function revalidateAdminStudents() {
  revalidateTag(cacheTags.adminStudents(), {});
}

export async function revalidateAdminCourses() {
  revalidateTag(cacheTags.adminCourses(), {});
  revalidateTag(cacheTags.myCourses(), {});
}

export async function revalidateAdminClassrooms() {
  revalidateTag(cacheTags.adminClassrooms(), {});
}

export async function revalidateAdminFeedback() {
  revalidateTag(cacheTags.adminFeedback(), {});
}

export async function revalidateAdminLogs() {
  revalidateTag(cacheTags.adminLogs(), {});
}
