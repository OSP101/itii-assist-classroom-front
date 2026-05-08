"use server";

import { serverApi } from "@/lib/api/server-api";
import { ApiError } from "@/lib/api/api-error";
import { revalidateCourseQueue } from "@/lib/cache/revalidate";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function setQueueSessionStatusAction(
  courseId: string,
  sessionId: number,
  action: "start" | "pause" | "resume" | "close",
  token: string
): Promise<ActionResult> {
  try {
    await serverApi.post(
      `/courses/${courseId}/queue/${sessionId}/${action}`,
      undefined,
      { token }
    );
    await revalidateCourseQueue(courseId);
    return { success: true };
  } catch (err) {
    return { success: false, error: ApiError.fromUnknown(err).toastMessage };
  }
}
