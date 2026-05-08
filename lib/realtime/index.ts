/**
 * Realtime layer exports
 */

export { useRealtimeResource } from "./use-realtime-resource";
export { useNativeWebSocket } from "./use-native-websocket";
export { useSmartPolling } from "./use-smart-polling";
export { NativeWebSocketClient } from "./realtime-client";
export { pollingIntervals, resolvePollingInterval } from "./polling-presets";
export type {
  RealtimeMode,
  RealtimeStatus,
  RealtimeOptions,
  RealtimeState,
  RealtimeMessage,
} from "./types";
export type { PollingPriority } from "./polling-presets";
