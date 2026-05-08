/**
 * Assignments — cached server queries.
 */

import { cacheLife, cacheTag } from "next/cache";
import { serverApi } from "@/lib/api/server-api";
import { cacheTags } from "@/lib/cache/cache-tags";

export type Assignment = {
  id: number;
  name: string;
  type: string;
  maxScore: number;
  order: number;
  attendanceSessionId?: number | null;
  createdAt: string;
};

export type AssignmentListData = {
  assignments: Assignment[];
  total: number;
};

export async function getCourseAssignments(
  courseId: string,
  token: string
): Promise<AssignmentListData> {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.courseAssignments(courseId));

  const data = await serverApi.get<Assignment[]>(
    `/courses/${courseId}/assignments`,
    { token }
  );

  return { assignments: data, total: data.length };
}
