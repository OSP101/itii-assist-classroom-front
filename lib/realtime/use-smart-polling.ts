/**
 * useSmartPolling — adaptive polling hook with visibility-aware pausing.
 *
 * Compared to a naïve setInterval:
 * - Pauses when the tab is hidden (saves server load)
 * - Resumes and immediately fetches when tab becomes visible again
 * - Uses actual response time as basis for next interval (avoid concurrent requests)
 * - Supports AbortController per request
 * - Shows no skeleton during background refreshes — use `isRefreshing` for subtle UI
 *
 * Usage:
 * ```tsx
 * const { data, isInitialLoading, isRefreshing } = useSmartPolling({
 *   fetcher: () => queueService.getDeskStatuses(sessionId),
 *   intervalMs: 3000,
 *   initialData: props.snapshot,
 * });
 * ```
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolvePollingInterval, type PollingPriority } from "./polling-presets";

export type UseSmartPollingOptions<T> = {
  fetcher: (signal: AbortSignal) => Promise<T>;
  intervalMs?: number;
  /** Optional polling priority preset when intervalMs is omitted */
  priority?: PollingPriority;
  initialData?: T;
  /** Set to false to stop polling (e.g., session closed) */
  enabled?: boolean;
  /** Called on fetch error. Return true to stop polling. */
  onError?: (error: unknown) => boolean | void;
  pauseOnHidden?: boolean;
  /** Enable adaptive interval based on connection quality. Default: true */
  adaptiveInterval?: boolean;
  /** Min poll interval in ms for adaptive mode. Default: 2000 */
  minIntervalMs?: number;
  /** Max poll interval in ms for adaptive mode. Default: 30000 */
  maxIntervalMs?: number;
};

export type UseSmartPollingResult<T> = {
  data: T | undefined;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: unknown;
  refetch: () => void;
};

export function useSmartPolling<T>(
  options: UseSmartPollingOptions<T>
): UseSmartPollingResult<T> {
  const {
    fetcher,
    intervalMs = 5000,
    priority,
    initialData,
    enabled = true,
    onError,
    pauseOnHidden = true,
    adaptiveInterval = true,
    minIntervalMs = 2000,
    maxIntervalMs = 30000,
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [isInitialLoading, setIsInitialLoading] = useState(initialData === undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const isPaused = useRef(false);
  const currentIntervalRef = useRef(intervalMs);
  const baseIntervalMs = resolvePollingInterval(intervalMs, priority);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const getEffectiveInterval = useCallback(
    (base: number): number => {
      if (!adaptiveInterval || typeof navigator === "undefined") {
        return base;
      }

      const nav = navigator as Navigator & {
        connection?: {
          saveData?: boolean;
          effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
        };
      };

      const saveData = nav.connection?.saveData === true;
      const type = nav.connection?.effectiveType;

      let factor = 1;
      if (saveData) factor *= 2;
      if (type === "slow-2g" || type === "2g") factor *= 2.5;
      if (type === "3g") factor *= 1.5;

      const withFactor = Math.round(base * factor);
      const clamped = Math.max(minIntervalMs, Math.min(withFactor, maxIntervalMs));
      // Add small jitter to avoid synchronized spikes from many clients.
      const jitter = Math.round(clamped * (Math.random() * 0.1 - 0.05));
      return Math.max(minIntervalMs, clamped + jitter);
    },
    [adaptiveInterval, minIntervalMs, maxIntervalMs]
  );

  const doFetch = useCallback(async () => {
    if (!isMounted.current || isPaused.current || !enabled) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const isFirst = data === undefined && initialData === undefined;
    if (isFirst) {
      setIsInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const result = await fetcher(controller.signal);
      if (!isMounted.current || controller.signal.aborted) return;
      setData(result);
      setError(null);
      setIsInitialLoading(false);
      setIsRefreshing(false);

      // Schedule next poll
      currentIntervalRef.current = getEffectiveInterval(baseIntervalMs);
      timerRef.current = setTimeout(doFetch, currentIntervalRef.current);
    } catch (err) {
      if (!isMounted.current || (err instanceof DOMException && err.name === "AbortError")) {
        return;
      }
      setError(err);
      setIsInitialLoading(false);
      setIsRefreshing(false);

      const stop = onError?.(err);
      if (!stop) {
        // Retry with longer interval after error
        const retryInterval = Math.min(currentIntervalRef.current * 2, maxIntervalMs);
        timerRef.current = setTimeout(doFetch, retryInterval);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, baseIntervalMs, enabled, getEffectiveInterval, onError, maxIntervalMs]);

  useEffect(() => {
    isMounted.current = true;

    if (!enabled) return;

    doFetch();

    const handleVisibility = () => {
      if (!pauseOnHidden) return;
      if (document.hidden) {
        isPaused.current = true;
        clearTimer();
        abortRef.current?.abort();
      } else {
        isPaused.current = false;
        doFetch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted.current = false;
      clearTimer();
      abortRef.current?.abort();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [doFetch, enabled, pauseOnHidden]);

  const refetch = useCallback(() => {
    clearTimer();
    doFetch();
  }, [doFetch]);

  return { data, isInitialLoading, isRefreshing, error, refetch };
}
