"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { io, Socket } from "socket.io-client";

// Resource types that can be synced
export type ResourceType = 
    | "course" 
    | "student" 
    | "user" 
    | "classroom" 
    | "assignment" 
    | "score" 
    | "attendance"
    | "feedback"
    | "section"
    | "group";

export type ActionType = "create" | "update" | "delete" | "toggle" | "bulk";

interface DataUpdateEvent {
    resource: ResourceType;
    action: ActionType;
    id?: string | number;
    ids?: (string | number)[];
    data?: any;
    timestamp: number;
}

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    // Generic data sync
    subscribeToUpdates: () => void;
    unsubscribeFromUpdates: () => void;
    emitDataUpdate: (resource: ResourceType, action: ActionType, id?: string | number, data?: any) => void;
    onDataUpdate: (callback: (data: DataUpdateEvent) => void) => () => void;
    // Resource-specific listeners
    onResourceUpdate: (resource: ResourceType, callback: (data: DataUpdateEvent) => void) => () => void;
    // Legacy course events (for backward compatibility)
    subscribeToCourseUpdates: (userId: number) => void;
    unsubscribeFromCourseUpdates: (userId: number) => void;
    emitCourseUpdate: (action: ActionType, courseId?: string) => void;
    onCourseUpdate: (callback: (data: DataUpdateEvent) => void) => () => void;
    // Generic events
    emit: (event: string, data?: any) => void;
    on: (event: string, callback: (data: any) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error("useSocket must be used within a SocketProvider");
    }
    return context;
};

// Custom hook for easy real-time sync in any page
export const useRealtimeSync = (
    resources: ResourceType | ResourceType[],
    onUpdate: () => void,
    showToast: boolean = true
) => {
    const { onDataUpdate, subscribeToUpdates, unsubscribeFromUpdates, isConnected } = useSocket();
    const resourceList = useMemo(
        () => Array.isArray(resources) ? resources : [resources],
        [resources]
    );
    const onUpdateRef = useRef(onUpdate);
    
    // Keep callback ref updated without causing re-subscriptions
    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        subscribeToUpdates();
        
        const unsubscribe = onDataUpdate((data) => {
            if (resourceList.includes(data.resource)) {
                console.log(`📥 ${data.resource} updated:`, data);
                onUpdateRef.current();
            }
        });

        return () => {
            unsubscribe();
            unsubscribeFromUpdates();
        };
    }, [onDataUpdate, subscribeToUpdates, unsubscribeFromUpdates, resourceList]);

    return { isConnected };
};

interface SocketProviderProps {
    children: React.ReactNode;
}

// Get socket URL from environment or derive from API URL
const getSocketUrl = (): string => {
    // Priority 1: Use explicit Socket URL from env
    if (process.env.NEXT_PUBLIC_SOCKET_URL) {
        return process.env.NEXT_PUBLIC_SOCKET_URL;
    }
    
    // Priority 2: For production with Nginx proxy - use same origin
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        // Production: use same origin (Nginx will proxy /socket.io to backend)
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            return window.location.origin;
        }
    }
    
    // Priority 3: Development - connect directly to backend port
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    // Extract base URL without /api
    return apiUrl.replace('/api', '');
};

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const dataUpdateCallbacks = useRef<Set<(data: DataUpdateEvent) => void>>(new Set());
    const resourceCallbacks = useRef<Map<ResourceType, Set<(data: DataUpdateEvent) => void>>>(new Map());

    // Initialize socket connection
    useEffect(() => {
        const socketUrl = getSocketUrl();
        console.log("🔌 Connecting to Socket.IO at:", socketUrl);
        
        const socketInstance = io(socketUrl, {
            path: "/socket.io",
            transports: ["polling", "websocket"],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            timeout: 30000,
            withCredentials: true,
        });

        socketInstance.on("connect", () => {
            console.log("✅ Socket connected:", socketInstance.id);
            setIsConnected(true);
            // Auto-join global updates room
            socketInstance.emit("join-global-updates");
        });

        socketInstance.on("disconnect", (reason) => {
            console.warn("⚠️ Socket disconnected:", reason);
            setIsConnected(false);
        });

        socketInstance.on("connect_error", (error) => {
            console.error("❌ Socket connection error:", error.message);
            setIsConnected(false);
        });

        // Listen for generic data updates
        socketInstance.on("data-updated", (data: DataUpdateEvent) => {
            console.log("📢 Data update received:", data);
            // Notify all general callbacks
            dataUpdateCallbacks.current.forEach(callback => callback(data));
            // Notify resource-specific callbacks
            const resourceCbs = resourceCallbacks.current.get(data.resource);
            if (resourceCbs) {
                resourceCbs.forEach(callback => callback(data));
            }
        });

        // Legacy course-updated event (backward compatibility)
        socketInstance.on("course-updated", (data: any) => {
            const updateEvent: DataUpdateEvent = {
                resource: "course",
                action: data.action || "update",
                id: data.courseId,
                timestamp: data.timestamp || Date.now(),
            };
            dataUpdateCallbacks.current.forEach(callback => callback(updateEvent));
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    // Subscribe to global updates
    const subscribeToUpdates = useCallback(() => {
        if (socket) {
            socket.emit("join-global-updates");
            console.log("📌 Subscribed to global updates");
        }
    }, [socket]);

    // Unsubscribe from global updates
    const unsubscribeFromUpdates = useCallback(() => {
        if (socket) {
            socket.emit("leave-global-updates");
            console.log("📌 Unsubscribed from global updates");
        }
    }, [socket]);

    // Emit generic data update
    const emitDataUpdate = useCallback((
        resource: ResourceType, 
        action: ActionType, 
        id?: string | number,
        data?: any
    ) => {
        if (socket) {
            const event: DataUpdateEvent = {
                resource,
                action,
                id,
                data,
                timestamp: Date.now(),
            };
            socket.emit("data-change", event);
            console.log("📤 Data update emitted:", event);
        }
    }, [socket]);

    // Register callback for all data updates
    const onDataUpdate = useCallback((callback: (data: DataUpdateEvent) => void) => {
        dataUpdateCallbacks.current.add(callback);
        return () => {
            dataUpdateCallbacks.current.delete(callback);
        };
    }, []);

    // Register callback for specific resource updates
    const onResourceUpdate = useCallback((resource: ResourceType, callback: (data: DataUpdateEvent) => void) => {
        if (!resourceCallbacks.current.has(resource)) {
            resourceCallbacks.current.set(resource, new Set());
        }
        resourceCallbacks.current.get(resource)!.add(callback);
        return () => {
            resourceCallbacks.current.get(resource)?.delete(callback);
        };
    }, []);

    // Legacy: Subscribe to course updates
    const subscribeToCourseUpdates = useCallback((userId: number) => {
        if (socket) {
            socket.emit("join-global-updates");
            socket.emit("join-user-courses", userId);
        }
    }, [socket]);

    // Legacy: Unsubscribe from course updates
    const unsubscribeFromCourseUpdates = useCallback((userId: number) => {
        if (socket) {
            socket.emit("leave-user-courses", userId);
        }
    }, [socket]);

    // Legacy: Emit course update
    const emitCourseUpdate = useCallback((action: ActionType, courseId?: string) => {
        emitDataUpdate("course", action, courseId);
    }, [emitDataUpdate]);

    // Legacy: Listen for course updates
    const onCourseUpdate = useCallback((callback: (data: DataUpdateEvent) => void) => {
        return onResourceUpdate("course", callback);
    }, [onResourceUpdate]);

    // Generic emit
    const emit = useCallback((event: string, data?: any) => {
        if (socket) {
            socket.emit(event, data);
        }
    }, [socket]);

    // Generic on with cleanup
    const on = useCallback((event: string, callback: (data: any) => void) => {
        if (socket) {
            socket.on(event, callback);
            return () => {
                socket.off(event, callback);
            };
        }
        return () => {};
    }, [socket]);

    const value: SocketContextType = {
        socket,
        isConnected,
        subscribeToUpdates,
        unsubscribeFromUpdates,
        emitDataUpdate,
        onDataUpdate,
        onResourceUpdate,
        subscribeToCourseUpdates,
        unsubscribeFromCourseUpdates,
        emitCourseUpdate,
        onCourseUpdate,
        emit,
        on,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};

export default SocketContext;