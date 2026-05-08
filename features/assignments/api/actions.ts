"use server";

import { serverApi } from "@/lib/api/server-api";
import { ApiError } from "@/lib/api/api-error";
import { revalidateCourseAssignments } from "@/lib/cache/revalidate";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function deleteAssignmentAction(
  courseId: string,
  assignmentId: number,
  token: string
): Promise<ActionResult> {
  try {
    await serverApi.delete(
      `/courses/${courseId}/assignments/${assignmentId}`,
      { token }
    );
    await revalidateCourseAssignments(courseId);
    return { success: true };
  } catch (err) {
    return { success: false, error: ApiError.fromUnknown(err).toastMessage };
  }
}
