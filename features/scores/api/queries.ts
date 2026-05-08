/**
 * Scores — cached server queries.
 */

import { cacheLife, cacheTag } from "next/cache";
import { serverApi } from "@/lib/api/server-api";
import { cacheTags } from "@/lib/cache/cache-tags";

export type ScoreRow = {
  studentId: number;
  studentCode: string;
  fullName: string;
  section: string;
  scores: Record<number, number | null>; // assignmentId → score
  total: number;
};

export type ScoreMatrixData = {
  rows: ScoreRow[];
  total: number;
  page: number;
  limit: number;
};

export async function getCourseScoreMatrix(
  courseId: string,
  token: string,
  page = 1,
  limit = 50
): Promise<ScoreMatrixData> {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.courseScores(courseId));

  return serverApi.get<ScoreMatrixData>(
    `/courses/${courseId}/scores?page=${page}&limit=${limit}`,
    { token }
  );
}

export type PendingApproval = {
  id: number;
  studentId: number;
  studentName: string;
  assignmentId: number;
  assignmentName: string;
  currentScore: number | null;
  requestedScore: number;
  reason: string;
  requestedAt: string;
};

export async function getPendingScoreApprovals(
  courseId: string,
  token: string
): Promise<PendingApproval[]> {
  "use cache";
  cacheLife("seconds");
  cacheTag(cacheTags.courseScoreApprovals(courseId));

  return serverApi.get<PendingApproval[]>(
    `/courses/${courseId}/score-edit-requests?status=pending`,
    { token }
  );
}
