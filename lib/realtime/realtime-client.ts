/**
 * Native WebSocket client — wraps browser WebSocket with:
 * - Auto-reconnect with exponential backoff
 * - Message queue for messages sent before connection is ready
 * - Visibility API pause/resume
 * - Typed event system
 *
 * This replaces direct usage of services/realtime-socket.ts for new code.
 * Existing code using SocketContext / useSocket continues to work unchanged.
 */

"use client";

import type { RealtimeMessage, RealtimeStatus } from "./types";

export type NativeWebSocketOptions = {
  /** Full WebSocket URL, e.g. `ws://localhost:3001/ws?type=queue&sessionId=1` */
  url: string;
  /** Called when the connection status changes */
  onStatusChange?: (status: RealtimeStatus) => void;
  /** Called when a message is received and parsed as JSON */
  onMessage?: (message: RealtimeMessage) => void;
  /** Called on fatal error (after max retries) */
  onError?: (reason: string) => void;
  /** Max reconnect attempts. Default: 5 */
  maxRetries?: number;
  /** Whether to pause when tab is hidden. Default: true */
  pauseOnHidden?: boolean;
};

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

export class NativeWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private options: NativeWebSocketOptions;
  private retryCount = 0;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: string[] = [];
  private isPaused = false;
  private isDestroyed = false;

  constructor(options: NativeWebSocketOptions) {
    this.url = options.url;
    this.options = options;

    if (options.pauseOnHidden !== false) {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  connect() {
    if (this.isDestroyed || this.isPaused) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.handleConnectError();
      return;
    }

    this.ws.onopen = () => {
      this.retryCount = 0;
      this.setStatus("connected");
      // Flush queued messages
      while (this.messageQueue.length > 0) {
        const msg = this.messageQueue.shift()!;
        this.ws?.send(msg);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as RealtimeMessage;
        this.options.onMessage?.(message);
      } catch {
        // Non-JSON frame — ignore silently
      }
    };

    this.ws.onclose = () => {
      if (this.isDestroyed || this.isPaused) return;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(message: RealtimeMessage) {
    const serialised = JSON.stringify(message);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(serialised);
    } else {
      this.messageQueue.push(serialised);
    }
  }

  disconnect() {
    this.isDestroyed = true;
    this.clearRetry();
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.ws?.close();
    this.ws = null;
    this.setStatus("closed");
  }

  private handleConnectError() {
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    const maxRetries = this.options.maxRetries ?? 5;
    if (this.retryCount >= maxRetries) {
      this.setStatus("error");
      this.options.onError?.(`WebSocket failed after ${maxRetries} attempts`);
      return;
    }

    this.setStatus("reconnecting");
    const backoff = Math.min(BASE_BACKOFF_MS * 2 ** this.retryCount, MAX_BACKOFF_MS);
    this.retryCount++;

    this.retryTimeoutId = setTimeout(() => {
      if (!this.isDestroyed && !this.isPaused) {
        this.connect();
      }
    }, backoff);
  }

  private clearRetry() {
    if (this.retryTimeoutId !== null) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  private setStatus(status: RealtimeStatus) {
    this.options.onStatusChange?.(status);
  }

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.isPaused = true;
      this.clearRetry();
      this.ws?.close();
      this.ws = null;
      this.setStatus("paused");
    } else {
      this.isPaused = false;
      this.retryCount = 0;
      this.connect();
    }
  };
}
