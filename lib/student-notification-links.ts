import type { UserNotificationItem } from "@/services/user-notification.service";

type StudentCourseTab = "Overview" | "Scores" | "Attendance" | "Queue" | "Updates";

function toStudentCourseHref(courseId: string, tab: StudentCourseTab = "Overview"): string {
  const query = tab === "Overview" ? "" : `?tab=${encodeURIComponent(tab)}`;
  return `/student/courses/${courseId}${query}`;
}

function mapClassroomSegmentToTab(segment: string): StudentCourseTab {
  const normalized = segment.trim().toLowerCase();
  if (["assignments", "scores", "exam-scores", "approval"].includes(normalized)) {
    return "Scores";
  }
  if (normalized === "attendance") {
    return "Attendance";
  }
  if (normalized === "queue") {
    return "Queue";
  }
  if (normalized === "activity-log") {
    return "Updates";
  }
  return "Overview";
}

function mapTypeToTab(type: string): StudentCourseTab {
  if (["assignment_created", "assignment_updated", "score_edit_request", "score_edit_approved", "score_edit_rejected"].includes(type)) {
    return "Scores";
  }
  if (["attendance_created", "attendance_started", "attendance_opened", "attendance_closed"].includes(type)) {
    return "Attendance";
  }
  if (["queue_created", "queue_updated", "queue_opened", "queue_closed"].includes(type)) {
    return "Queue";
  }
  return "Overview";
}

export function resolveStudentNotificationLink(notification: UserNotificationItem): string | null {
  const rawLink = notification.link?.trim() || "";
  const courseId = notification.course_id ? String(notification.course_id) : "";

  if (!rawLink) {
    return courseId ? toStudentCourseHref(courseId, mapTypeToTab(notification.type)) : null;
  }

  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = new URL(rawLink, origin);
    const path = url.pathname.replace(/\/+$/, "");
    const classroomMatch = path.match(/^\/classroom\/([^/]+)(?:\/([^/]+))?$/);

    if (classroomMatch) {
      const [, matchedCourseId, segment] = classroomMatch;
      const explicitTab = (url.searchParams.get("tab") || "").trim();
      const mappedTab = explicitTab
        ? mapClassroomSegmentToTab(explicitTab === "score-requests" ? "approval" : explicitTab)
        : mapClassroomSegmentToTab(segment || "");
      return toStudentCourseHref(matchedCourseId, mappedTab);
    }

    if (path.startsWith("/student/")) {
      return `${path}${url.search}${url.hash}`;
    }

    if (path === "/queue/book" || path.startsWith("/check-in/")) {
      return `${path}${url.search}${url.hash}`;
    }

    if (courseId) {
      return toStudentCourseHref(courseId, mapTypeToTab(notification.type));
    }
  } catch {
    if (courseId) {
      return toStudentCourseHref(courseId, mapTypeToTab(notification.type));
    }
  }

  return null;
}