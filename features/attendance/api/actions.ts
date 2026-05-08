"use server";

import { serverApi } from "@/lib/api/server-api";
import { ApiError } from "@/lib/api/api-error";
import { revalidateCourseAttendance } from "@/lib/cache/revalidate";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function toggleAttendanceSessionAction(
  courseId: string,
  sessionId: number,
  action: "open" | "close",
  token: string
): Promise<ActionResult> {
  try {
    await serverApi.post(
      `/courses/${courseId}/attendance/${sessionId}/${action}`,
      undefined,
      { token }
    );
    await revalidateCourseAttendance(courseId);
    return { success: true };
  } catch (err) {
    return { success: false, error: ApiError.fromUnknown(err).toastMessage };
  }
}
