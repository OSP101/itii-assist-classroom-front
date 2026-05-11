/**
 * useNativeWebSocket — React hook wrapping NativeWebSocketClient.
 *
 * Manages lifecycle with React. Component unmount → auto-disconnect.
 * Tab hidden → auto-pause (if pauseOnHidden = true, default).
 *
 * Usage:
 * ```tsx
 * const { data, status } = useNativeWebSocket<QueueState>({
 *   url: getRealtimeWebSocketUrl(`/ws?type=queue&sessionId=${sessionId}`),
 *   initialData: props.initialSnapshot,
 *   onMessage: (prev, msg) => applyQueueEvent(prev, msg),
 * });
 * ```
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NativeWebSocketClient } from "./realtime-client";
import type { RealtimeMessage, RealtimeStatus } from "./types";

export type UseNativeWebSocketOptions<T> = {
  url: string;
  initialData?: T;
  onMessage?: (prev: T | undefined, message: RealtimeMessage) => T;
  maxRetries?: number;
  pauseOnHidden?: boolean;
  /** Set to false to skip connecting (e.g., feature flag off) */
  enabled?: boolean;
};

export type UseNativeWebSocketResult<T> = {
  data: T | undefined;
  status: RealtimeStatus;
  isInitialLoading: boolean;
  error: string | null;
  send: (message: RealtimeMessage) => void;
  disconnect: () => void;
};

export function useNativeWebSocket<T>(
  options: UseNativeWebSocketOptions<T>
): UseNativeWebSocketResult<T> {
  const {
    url,
    initialData,
    onMessage,
    maxRetries = 5,
    pauseOnHidden = true,
    enabled = true,
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<NativeWebSocketClient | null>(null);
  // Track whether we have received at least one message or have initialData
  const hasData = useRef(initialData !== undefined);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const client = new NativeWebSocketClient({
      url,
      maxRetries,
      pauseOnHidden,
      onStatusChange: (s) => {
        setStatus(s);
        if (s === "error") {
          // Status already set; error text will come from onError
        }
      },
      onMessage: (message) => {
        setData((prev) => {
          const next = onMessage ? onMessage(prev, message) : (message.payload as T);
          hasData.current = true;
          return next;
        });
      },
      onError: (reason) => {
        setError(reason);
      },
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

  const send = useCallback((message: RealtimeMessage) => {
    clientRef.current?.send(message);
  }, []);

  const isInitialLoading = status === "connecting" && !hasData.current;

  return { data, status, isInitialLoading, error, send, disconnect };
}
