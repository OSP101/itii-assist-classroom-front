/**
 * Realtime types — shared across WebSocket, SSE, and polling abstractions.
 */

export type RealtimeMode = "websocket" | "sse" | "polling";

export type RealtimeStatus =
  | "idle"         // not yet started
  | "connecting"   // initial connection attempt
  | "connected"    // live and receiving events
  | "reconnecting" // attempting to restore a dropped connection
  | "paused"       // tab hidden / visibility API
  | "error"        // failed after max retries
  | "closed";      // intentionally disconnected

export type RealtimeOptions<T> = {
  /**
   * Unique key for this subscription (used for deduplication / cleanup).
   * Example: ["queue-session", sessionId]
   */
  key: readonly string[];
  /** Initial data from server (prevents skeleton on first render) */
  initialData?: T;
  /** Transport mode. Falls back to polling if WebSocket fails. */
  mode: RealtimeMode;
  /**
    * WebSocket or SSE endpoint path resolved from the shared realtime base URL.
   * Example: `/ws?type=queue&sessionId=${sessionId}`
   */
  endpoint: string;
  /**
   * Fallback polling interval in ms when WebSocket/SSE is unavailable.
   * Default: 5000
   */
  fallbackPollingMs?: number;
  /**
   * Function that performs an HTTP snapshot fetch.
   * Called on initial load and as fallback during reconnect.
   */
  fetchSnapshot?: () => Promise<T>;
  /**
   * Called when a message is received. Should return the updated state.
   * If omitted, the raw message payload replaces the previous state.
   */
  onMessage?: (prev: T | undefined, message: RealtimeMessage) => T;
  /** Maximum reconnect attempts before entering "error" state. Default: 5 */
  maxRetries?: number;
  /**
   * Whether to pause updates when the browser tab is hidden.
   * Pausing reduces server load for projector/live views.
   * Default: true
   */
  pauseOnHidden?: boolean;
};

export type RealtimeMessage = {
  type: string;
  payload: unknown;
};

export type RealtimeState<T> = {
  data: T | undefined;
  status: RealtimeStatus;
  /** True only during the very first load before any data arrives */
  isInitialLoading: boolean;
  /** True when a background refresh is in progress (no skeleton needed) */
  isRefreshing: boolean;
  /** Last error message, if status === "error" */
  error: string | null;
  /** Manually trigger a snapshot re-fetch */
  refresh: () => void;
  /** Disconnect and stop all updates */
  disconnect: () => void;
};
