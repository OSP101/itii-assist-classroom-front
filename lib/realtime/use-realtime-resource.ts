/**
 * useRealtimeResource — unified abstraction for realtime data.
 *
 * Components use this hook without needing to know if the data comes
 * from WebSocket, SSE, or polling. The hook negotiates the best available
 * transport and falls back to polling if WebSocket is unavailable.
 *
 * Pattern:
 * 1. Server fetches initial snapshot (prevents skeleton on first render)
 * 2. Client subscribes to WebSocket / polling on mount
 * 3. Updates apply to local state only — no full page re-render
 * 4. Mutations should call revalidateTag for server cache, but the
 *    realtime subscription handles the live view independently
 *
 * Usage:
 * ```tsx
 * const { data, status, isInitialLoading } = useRealtimeResource({
 *   key: ["queue-session", sessionId],
 *   initialData: serverSnapshot,
 *   mode: "websocket",
 *   endpoint: `/ws?type=queue&sessionId=${sessionId}`,
 *   fallbackPollingMs: 5000,
 *   fetchSnapshot: () => queueService.getSession(sessionId),
 *   onMessage: (prev, msg) => applyQueueDelta(prev, msg),
 * });
 * ```
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NativeWebSocketClient } from "./realtime-client";
import type { RealtimeMessage, RealtimeOptions, RealtimeState, RealtimeStatus } from "./types";

const WS_BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_WS_URL) ||
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws")) ||
  "ws://localhost:3001";

export function useRealtimeResource<T>(
  options: RealtimeOptions<T>
): RealtimeState<T> {
  const {
    key,
    initialData,
    mode,
    endpoint,
    fallbackPollingMs = 5000,
    fetchSnapshot,
    onMessage,
    maxRetries = 5,
    pauseOnHidden = true,
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const wsClientRef = useRef<NativeWebSocketClient | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasData = useRef(initialData !== undefined);
  const isMounted = useRef(true);
  // Stable reference to avoid re-creating WS on every render
  const keyStr = key.join(":");

  const applyMessage = useCallback(
    (message: RealtimeMessage) => {
      setData((prev) => {
        const next = onMessage ? onMessage(prev, message) : (message.payload as T);
        hasData.current = true;
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keyStr]
  );

  const doSnapshot = useCallback(async () => {
    if (!fetchSnapshot || !isMounted.current) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsRefreshing(true);
    try {
      const snap = await fetchSnapshot();
      if (!isMounted.current) return;
      setData(snap);
      hasData.current = true;
      setError(null);
    } catch {
      // Snapshot failure is non-fatal if we have prior data
      if (!hasData.current) {
        setError("ไม่สามารถโหลดข้อมูลเริ่มต้นได้");
      }
    } finally {
      if (isMounted.current) setIsRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSnapshot, keyStr]);

  // Polling fallback
  const startPolling = useCallback(() => {
    const poll = async () => {
      if (!isMounted.current) return;
      await doSnapshot();
      if (isMounted.current) {
        pollingTimerRef.current = setTimeout(poll, fallbackPollingMs);
      }
    };
    pollingTimerRef.current = setTimeout(poll, fallbackPollingMs);
  }, [doSnapshot, fallbackPollingMs]);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current !== null) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const isOffline = () =>
    typeof navigator !== "undefined" && navigator.onLine === false;

  useEffect(() => {
    isMounted.current = true;

    const handleOnline = () => {
      if (!isMounted.current) return;
      setError(null);
      doSnapshot();
      if (mode === "polling") {
        startPolling();
      } else {
        wsClientRef.current?.connect();
      }
    };

    const handleOffline = () => {
      if (!isMounted.current) return;
      stopPolling();
      setError("ออฟไลน์อยู่ชั่วคราว กำลังรอการเชื่อมต่อกลับมา");
      if (mode !== "polling") {
        wsClientRef.current?.disconnect();
        wsClientRef.current = null;
      }
      setStatus("paused");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (mode === "polling") {
      setStatus("connected");
      if (!isOffline()) {
        doSnapshot();
        startPolling();
      } else {
        setStatus("paused");
        setError("ออฟไลน์อยู่ชั่วคราว กำลังรอการเชื่อมต่อกลับมา");
      }
      return () => {
        isMounted.current = false;
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        stopPolling();
        abortRef.current?.abort();
      };
    }

    // WebSocket mode (with polling fallback)
    const wsUrl = `${WS_BASE_URL}${endpoint}`;
    const client = new NativeWebSocketClient({
      url: wsUrl,
      maxRetries,
      pauseOnHidden,
      onStatusChange: (s) => {
        if (!isMounted.current) return;
        setStatus(s);

        if (s === "error") {
          // WS permanently failed — switch to polling fallback
          setError("WebSocket ไม่สามารถเชื่อมต่อได้ กำลังใช้ polling แทน");
          startPolling();
        }

        if (s === "reconnecting" && !hasData.current) {
          doSnapshot();
        }

        if (s === "paused") {
          stopPolling();
        }

        if (s === "connected" && pollingTimerRef.current !== null) {
          // WS recovered — stop polling
          stopPolling();
          setError(null);
        }
      },
      onMessage: applyMessage,
      onError: () => {
        if (!isMounted.current) return;
        setError("WebSocket ไม่สามารถเชื่อมต่อได้");
      },
    });

    wsClientRef.current = client;
    if (!isOffline()) {
      client.connect();
    } else {
      setStatus("paused");
      setError("ออฟไลน์อยู่ชั่วคราว กำลังรอการเชื่อมต่อกลับมา");
    }

    return () => {
      isMounted.current = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      client.disconnect();
      wsClientRef.current = null;
      stopPolling();
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStr, endpoint, mode]);

  const refresh = useCallback(() => {
    doSnapshot();
  }, [doSnapshot]);

  const disconnect = useCallback(() => {
    wsClientRef.current?.disconnect();
    wsClientRef.current = null;
    stopPolling();
    setStatus("closed");
  }, [stopPolling]);

  const isInitialLoading =
    (status === "connecting" || status === "idle") && !hasData.current;

  return {
    data,
    status,
    isInitialLoading,
    isRefreshing,
    error,
    refresh,
    disconnect,
  };
}
