/**
 * Queue — cached server queries.
 * Live data (desk statuses, booking state) must be fetched client-side
 * via useRealtimeResource or useSmartPolling — do NOT cache live state.
 */

import { cacheLife, cacheTag } from "next/cache";
import { serverApi } from "@/lib/api/server-api";
import { cacheTags } from "@/lib/cache/cache-tags";

export type QueueSession = {
  id: number;
  name: string;
  status: "draft" | "active" | "paused" | "closed";
  totalDesks: number;
  completedCount: number;
  pendingCount: number;
  createdAt: string;
};

export type QueueDesk = {
  id: number;
  label: string;
  status: "idle" | "busy" | "offline";
  currentStudentId?: number | null;
  currentStudentName?: string | null;
  workerUserId?: number | null;
  workerName?: string | null;
};

export type QueueDeskSnapshot = {
  session: QueueSession;
  desks: QueueDesk[];
};

/** List of queue sessions — cached */
export async function getCourseQueueSessions(
  courseId: string,
  token: string
): Promise<QueueSession[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.courseQueue(courseId));

  return serverApi.get<QueueSession[]>(
    `/courses/${courseId}/queue`,
    { token }
  );
}

/**
 * Initial desk snapshot for projector/worker pages.
 * Very short cache — client immediately subscribes via WebSocket after this.
 * Do NOT keep this cached long or live state will be stale.
 */
export async function getQueueDeskSnapshot(
  courseId: string,
  sessionId: string,
  token: string
): Promise<QueueDeskSnapshot> {
  "use cache";
  cacheLife("seconds");
  cacheTag(cacheTags.courseQueue(courseId));

  const [session, desks] = await Promise.all([
    serverApi.get<QueueSession>(
      `/courses/${courseId}/queue/${sessionId}`,
      { token }
    ),
    serverApi.get<QueueDesk[]>(
      `/courses/${courseId}/queue/${sessionId}/desks`,
      { token }
    ),
  ]);

  return { session, desks };
}
