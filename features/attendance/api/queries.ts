/**
 * Attendance — cached server queries and live query helpers.
 */

import { cacheLife, cacheTag } from "next/cache";
import { serverApi } from "@/lib/api/server-api";
import { cacheTags } from "@/lib/cache/cache-tags";

export type AttendanceSession = {
  id: number;
  name: string;
  status: "open" | "closed" | "draft";
  totalStudents: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  assignmentId?: number | null;
  openedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
};

export async function getCourseAttendanceSessions(
  courseId: string,
  token: string
): Promise<AttendanceSession[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.courseAttendance(courseId));

  return serverApi.get<AttendanceSession[]>(
    `/courses/${courseId}/attendance`,
    { token }
  );
}

export type AttendanceRecord = {
  studentId: number;
  studentCode: string;
  fullName: string;
  status: "present" | "late" | "absent";
  checkedInAt?: string | null;
};

/**
 * Live session snapshot — very short cache before client subscribes via WebSocket.
 * Cache tagged so it can be invalidated if a session is closed/reset.
 */
export async function getAttendanceLiveSnapshot(
  courseId: string,
  sessionId: string,
  token: string
): Promise<{ session: AttendanceSession; records: AttendanceRecord[] }> {
  "use cache";
  cacheLife("seconds");
  cacheTag(cacheTags.courseAttendance(courseId));

  const [session, records] = await Promise.all([
    serverApi.get<AttendanceSession>(
      `/courses/${courseId}/attendance/${sessionId}`,
      { token }
    ),
    serverApi.get<AttendanceRecord[]>(
      `/courses/${courseId}/attendance/${sessionId}/records`,
      { token }
    ),
  ]);

  return { session, records };
}
