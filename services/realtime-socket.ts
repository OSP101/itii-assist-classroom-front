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

    constructor(private url: string, private options: SocketOptions = {}) {
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

    private scheduleReconnect() {
        if (this.manuallyClosed || this.options.reconnection === false) return;

        const maxAttempts = this.options.reconnectionAttempts ?? 10;
        if (this.reconnectAttempts >= maxAttempts) return;

        this.reconnectAttempts += 1;
        const delay = this.options.reconnectionDelay ?? 1000;
        window.setTimeout(() => this.connect(), delay);
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
    if (process.env.NEXT_PUBLIC_SOCKET_URL) {
        return process.env.NEXT_PUBLIC_SOCKET_URL;
    }

    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }

    if (typeof window !== "undefined") {
        return window.location.origin;
    }

    return "http://localhost:3001";
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