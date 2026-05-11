"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { getRealtimeSocketBaseUrl, io, Socket } from "@/services/realtime-socket";

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
    // User-scoped notifications
    joinUserRoom: (userId: number) => void;
    onNotification: (callback: (data: any) => void) => () => void;
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

const getStoredUserId = (): number | null => {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        const rawUser = localStorage.getItem("user");
        if (!rawUser) {
            return null;
        }
        const parsed = JSON.parse(rawUser);
        const id = Number(parsed?.id);
        return Number.isFinite(id) && id > 0 ? id : null;
    } catch {
        return null;
    }
};

const getEventActorId = (eventData: any): number | null => {
    const actor = eventData?.data?.actor_id ?? eventData?.data?.actorId ?? eventData?.actor_id ?? eventData?.actorId;
    const actorId = Number(actor);
    return Number.isFinite(actorId) && actorId > 0 ? actorId : null;
};

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const dataUpdateCallbacks = useRef<Set<(data: DataUpdateEvent) => void>>(new Set());
    const resourceCallbacks = useRef<Map<ResourceType, Set<(data: DataUpdateEvent) => void>>>(new Map());
    const notificationCallbacks = useRef<Set<(data: any) => void>>(new Set());
    const hasWarnedAboutConnectError = useRef(false);

    // Initialize socket connection
    useEffect(() => {
        const socketUrl = getRealtimeSocketBaseUrl();
        
        const socketInstance = io(socketUrl, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            timeout: 30000,
            withCredentials: true,
        });

        socketInstance.on("connect", () => {
            setIsConnected(true);
            hasWarnedAboutConnectError.current = false;
            // Auto-join global updates room
            socketInstance.emit("join-global-updates");
        });

        socketInstance.on("disconnect", () => {
            setIsConnected(false);
        });

        socketInstance.on("connect_error", (error) => {
            if (!hasWarnedAboutConnectError.current) {
                console.warn("⚠️ Realtime socket unavailable:", socketUrl, error.message);
                hasWarnedAboutConnectError.current = true;
            }
            setIsConnected(false);
        });

        // Listen for generic data updates
        socketInstance.on("data-updated", (data: DataUpdateEvent) => {
            const myId = getStoredUserId();
            const actorId = getEventActorId(data);
            if (myId !== null && actorId !== null && myId === actorId) {
                return; // skip self-events
            }
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
            const myId = getStoredUserId();
            const actorId = getEventActorId(data);
            if (myId !== null && actorId !== null && myId === actorId) {
                return; // skip self-events
            }
            const updateEvent: DataUpdateEvent = {
                resource: "course",
                action: data.action || "update",
                id: data.courseId,
                data,
                timestamp: data.timestamp || Date.now(),
            };
            dataUpdateCallbacks.current.forEach(callback => callback(updateEvent));
        });

        socketInstance.on("notification", (data: any) => {
            notificationCallbacks.current.forEach((callback) => callback(data));
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
        }
    }, [socket]);

    // Unsubscribe from global updates
    const unsubscribeFromUpdates = useCallback(() => {
        if (socket) {
            socket.emit("leave-global-updates");
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
            const actorId = getStoredUserId();
            let payloadData = data;
            if (data === undefined || data === null) {
                payloadData = actorId ? { actor_id: actorId } : data;
            } else if (typeof data === "object" && !Array.isArray(data)) {
                const typedData = data as Record<string, unknown>;
                if ((typedData.actor_id === undefined || typedData.actor_id === null) && (typedData.actorId === undefined || typedData.actorId === null) && actorId) {
                    payloadData = { ...typedData, actor_id: actorId };
                }
            }

            const event: DataUpdateEvent = {
                resource,
                action,
                id,
                data: payloadData,
                timestamp: Date.now(),
            };
            socket.emit("data-change", event);
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

    const joinUserRoom = useCallback((userId: number) => {
        if (socket && userId > 0) {
            socket.emit("join-user", String(userId));
        }
    }, [socket]);

    const onNotification = useCallback((callback: (data: any) => void) => {
        notificationCallbacks.current.add(callback);
        return () => {
            notificationCallbacks.current.delete(callback);
        };
    }, []);

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
        joinUserRoom,
        onNotification,
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