"use server";

import { serverApi } from "@/lib/api/server-api";
import { ApiError } from "@/lib/api/api-error";
import { revalidateCourseScores, revalidateScoreApprovals } from "@/lib/cache/revalidate";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function approveScoreEditAction(
  courseId: string,
  requestId: number,
  token: string
): Promise<ActionResult> {
  try {
    await serverApi.post(
      `/courses/${courseId}/score-edit-requests/${requestId}/approve`,
      undefined,
      { token }
    );
    await revalidateScoreApprovals(courseId);
    return { success: true };
  } catch (err) {
    return { success: false, error: ApiError.fromUnknown(err).toastMessage };
  }
}

export async function rejectScoreEditAction(
  courseId: string,
  requestId: number,
  reason: string,
  token: string
): Promise<ActionResult> {
  try {
    await serverApi.post(
      `/courses/${courseId}/score-edit-requests/${requestId}/reject`,
      { reason },
      { token }
    );
    await revalidateScoreApprovals(courseId);
    return { success: true };
  } catch (err) {
    return { success: false, error: ApiError.fromUnknown(err).toastMessage };
  }
}

export async function bulkUpdateScoresAction(
  courseId: string,
  assignmentId: number,
  scores: { studentId: number; score: number }[],
  token: string
): Promise<ActionResult> {
  try {
    await serverApi.post(
      `/courses/${courseId}/assignments/${assignmentId}/scores/bulk`,
      { scores },
      { token }
    );
    await revalidateCourseScores(courseId);
    return { success: true };
  } catch (err) {
    return { success: false, error: ApiError.fromUnknown(err).toastMessage };
  }
}
