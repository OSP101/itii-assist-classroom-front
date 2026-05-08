/**
 * Polling interval presets.
 *
 * Use to balance freshness and bandwidth by data criticality.
 */

export type PollingPriority = "critical" | "secondary" | "background";

export const pollingIntervals: Record<PollingPriority, number> = {
  // Live classroom/queue/attendance states.
  critical: 3000,
  // Frequently-used list pages and dashboards.
  secondary: 7000,
  // Passive monitoring / low-priority background views.
  background: 15000,
};

export function resolvePollingInterval(
  intervalMs?: number,
  priority?: PollingPriority
): number {
  if (typeof intervalMs === "number" && intervalMs > 0) {
    return intervalMs;
  }

  if (priority) {
    return pollingIntervals[priority];
  }

  return 5000;
}
