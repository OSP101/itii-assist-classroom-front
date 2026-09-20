type Listener = (data?: any) => void;

export interface SocketOptions {
    path?: string;
    transports?: string[];
    reconnection?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
    timeout?: number;
    withCredentials?: boolean;
}

export class Socket {
    id?: string;
    connected = false;
    private ws: WebSocket | null = null;
    private listeners = new Map<string, Set<Listener>>();
    private pendingMessages: string[] = [];
    private reconnectAttempts = 0;
    private manuallyClosed = false;
    private reconnectTimer: number | undefined;
    // Set when scheduleReconnect is called while the tab is hidden — instead
    // of burning through attempts while backgrounded (where the student
    // can't see or act on the check-in page anyway), the reconnect is
    // deferred until the tab is looked at again (plan.md ระยะ 3).
    private reconnectPendingOnVisible = false;
    private visibilityHandler: (() => void) | null = null;

    constructor(private url: string, private options: SocketOptions = {}) {
        if (typeof document !== "undefined") {
            this.visibilityHandler = () => {
                if (document.visibilityState === "visible" && this.reconnectPendingOnVisible) {
                    this.reconnectPendingOnVisible = false;
                    this.connect();
                }
            };
            document.addEventListener("visibilitychange", this.visibilityHandler);
        }
        this.connect();
    }

    on(event: string, callback: Listener): this {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
        return this;
    }

    off(event: string, callback?: Listener): this {
        if (!callback) {
            this.listeners.delete(event);
            return this;
        }
        this.listeners.get(event)?.delete(callback);
        return this;
    }

    emit(event: string, data?: any): this {
        const payload = JSON.stringify({ event, data });
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(payload);
        } else {
            this.pendingMessages.push(payload);
        }
        return this;
    }

    disconnect(): this {
        this.manuallyClosed = true;
        this.reconnectPendingOnVisible = false;
        // A reconnect scheduled from an EARLIER close (or deferred while the
        // tab was hidden) must not fire after this — otherwise a caller that
        // explicitly disconnected gets a brand new socket moments later.
        window.clearTimeout(this.reconnectTimer);
        if (this.visibilityHandler && typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this.visibilityHandler);
            this.visibilityHandler = null;
        }
        this.ws?.close();
        return this;
    }

    private connect() {
        if (typeof window === "undefined") return;

        const socketUrl = buildWebSocketUrl(this.url, "/ws");
        this.ws = new WebSocket(socketUrl);

        this.ws.onopen = () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            this.flushPendingMessages();
            this.dispatch("connect");
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data) as { event?: string; data?: any };
                if (!message.event) return;
                if (message.event === "socket-ready" && message.data?.id) {
                    this.id = message.data.id;
                }
                this.dispatch(message.event, message.data);
            } catch (error) {
                this.dispatch("connect_error", error);
            }
        };

        this.ws.onerror = () => {
            this.dispatch("connect_error", new Error("WebSocket connection error"));
        };

        this.ws.onclose = () => {
            const wasConnected = this.connected;
            this.connected = false;
            if (wasConnected) {
                this.dispatch("disconnect", "transport close");
            }
            this.scheduleReconnect();
        };
    }

    // Exponential backoff (1s → 30s ceiling) with ±50% jitter, pausing
    // entirely while the tab is hidden (plan.md ระยะ 3). This used to be a
    // fixed 1s delay for up to 10 attempts, which two things wrong for a
    // page meant to stay open through a whole class period: (1) every
    // client that dropped at the same instant — a backend restart during
    // the 1000-student window is exactly this — retried in lockstep at the
    // same 1s/2s/3s marks, turning the recovery moment into a second burst
    // against whatever just came back up; (2) giving up for good after ~10s
    // meant a longer outage (a slow redeploy, a stuck container) left the
    // page's WebSocket dead for the rest of the session with no way back
    // except a manual reload, even though the ordinary HTTP fallback paths
    // (fetch, /info polling) would have recovered fine on their own.
    // reconnectionAttempts therefore now defaults to unlimited — the 30s
    // ceiling already bounds how often a stalled connection retries, so
    // there is no real cost to not giving up; pass an explicit
    // reconnectionAttempts to opt back into a hard cap.
    private scheduleReconnect() {
        if (this.manuallyClosed || this.options.reconnection === false) return;

        const maxAttempts = this.options.reconnectionAttempts ?? Infinity;
        if (this.reconnectAttempts >= maxAttempts) return;

        this.reconnectAttempts += 1;

        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
            // Resumed by the visibilitychange listener in the constructor —
            // no point burning through backoff for a tab nobody is looking
            // at, and a phone that locks mid-class would otherwise come back
            // to a socket that gave up minutes ago.
            this.reconnectPendingOnVisible = true;
            return;
        }

        const baseDelay = this.options.reconnectionDelay ?? 1000;
        const maxDelay = 30000;
        const exponential = Math.min(maxDelay, baseDelay * 2 ** (this.reconnectAttempts - 1));
        const jitterFactor = 0.5 + Math.random(); // ±50%, i.e. [0.5, 1.5)
        const delay = Math.round(exponential * jitterFactor);
        this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
    }

    private dispatch(event: string, data?: any) {
        this.listeners.get(event)?.forEach((callback) => callback(data));
    }

    private flushPendingMessages() {
        if (this.ws?.readyState !== WebSocket.OPEN) return;
        const messages = this.pendingMessages.splice(0);
        messages.forEach((message) => this.ws?.send(message));
    }
}

export function io(url?: string, options?: SocketOptions): Socket {
    return new Socket(url || window.location.origin, options);
}

export function getRealtimeSocketBaseUrl(): string {
    const configuredUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL ||
        process.env.NEXT_PUBLIC_API_URL;

    if (typeof window !== "undefined") {
        if (!configuredUrl) {
            return window.location.origin;
        }

        try {
            const runtimeOrigin = new URL(window.location.origin);
            const parsed = new URL(configuredUrl, window.location.origin);
            const isConfiguredLocalHost =
                parsed.hostname === "localhost" ||
                parsed.hostname === "127.0.0.1" ||
                parsed.hostname === "0.0.0.0";
            const isRuntimeLocalHost =
                runtimeOrigin.hostname === "localhost" ||
                runtimeOrigin.hostname === "127.0.0.1";

            // In LAN/dev access, avoid pointing the browser to its own localhost.
            if (isConfiguredLocalHost && !isRuntimeLocalHost) {
                parsed.hostname = runtimeOrigin.hostname;
            }

            return parsed.toString();
        } catch {
            return window.location.origin;
        }
    }

    return configuredUrl || "http://localhost:3001";
}

export function getRealtimeWebSocketUrl(endpoint = "/ws"): string {
    return buildWebSocketUrl(getRealtimeSocketBaseUrl(), endpoint);
}

function buildWebSocketUrl(inputUrl: string, endpoint: string): string {
    const base = new URL(inputUrl || window.location.origin, window.location.origin);
    if (base.pathname.endsWith("/api")) {
        base.pathname = base.pathname.slice(0, -4);
    }
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    const [endpointPath, endpointQuery = ""] = endpoint.split("?");
    base.pathname = joinPath(base.pathname, ensureLeadingSlash(endpointPath || "/ws"));
    base.search = endpointQuery ? `?${endpointQuery}` : "";
    return base.toString();
}

function ensureLeadingSlash(path: string): string {
    return path.startsWith("/") ? path : `/${path}`;
}

function joinPath(basePath: string, path: string): string {
    const cleanedBase = basePath === "/" ? "" : basePath.replace(/\/$/, "");
    return `${cleanedBase}${path}`;
}