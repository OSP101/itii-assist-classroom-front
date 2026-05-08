/**
 * Course Overview — server actions for mutations.
 *
 * Each action:
 * 1. Calls the backend via serverApi
 * 2. Revalidates affected cache tags
 * 3. Returns { success, data?, error? } — never throws to the client
 */

"use server";

import { serverApi } from "@/lib/api/server-api";
import { ApiError } from "@/lib/api/api-error";
import { revalidateCourseSettings } from "@/lib/cache/revalidate";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Toggle course active/closed status.
 */
export async function toggleCourseStatusAction(
  courseId: string,
  token: string
): Promise<ActionResult> {
  try {
    await serverApi.post(`/courses/${courseId}/toggle-status`, undefined, { token });
    await revalidateCourseSettings(courseId);
    return { success: true };
  } catch (err) {
    const e = ApiError.fromUnknown(err);
    return { success: false, error: e.toastMessage };
  }
}
