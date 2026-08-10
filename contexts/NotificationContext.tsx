"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { addToast } from "@heroui/toast";
import { isWebPushSupported, registerPushSubscription, unregisterPushSubscription } from "@/services/push-subscription.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { authService } from "@/services/auth.service";
import { useI18n } from "@/hooks/useI18n";
import { getNotificationHeadline, getNotificationMessage } from "@/lib/notification-display";
import { useSocket } from "@/contexts/SocketContext";
import userNotificationService, { UserNotificationItem } from "@/services/user-notification.service";
import { playWorkerNotificationSound, showBrowserNotification, triggerNotificationVibration } from "@/lib/pwa-notifications";

const hasAuthenticatedSession = (): boolean => {
    return authService.isAuthenticated();
};

interface NotificationContextType {
    // Permission states
    isSupported: boolean;
    permissionStatus: NotificationPermission | null;
    isLoading: boolean;
    pushSubscribed: boolean;

    // Actions
    requestPermission: () => Promise<{ granted: boolean }>;
    registerPushToken: (userType: "worker" | "student", targetId?: number | string) => Promise<{ success: boolean; error?: string }>;
    unregisterPushToken: () => Promise<boolean>;

    // Navbar notification inbox (DB-backed)
    notifications: UserNotificationItem[];
    unreadCount: number;
    isInboxLoading: boolean;
    refreshNotifications: () => Promise<void>;
    markNotificationRead: (id: number) => Promise<void>;
    markAllNotificationsRead: () => Promise<void>;
    clearReadNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotification must be used within NotificationProvider");
    }
    return context;
};

interface NotificationProviderProps {
    children: React.ReactNode;
}

const resolveNotificationUrl = (source: {
    link?: string;
    data?: Record<string, unknown>;
}): string | undefined => {
    const rawUrl =
        (typeof source.data?.url === "string" && source.data.url) ||
        (typeof source.data?.link === "string" && source.data.link) ||
        source.link;

    if (!rawUrl) {
        return undefined;
    }

    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        return rawUrl;
    }

    return rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
};

const notifyDevice = async ({
    title,
    body,
    type,
    url,
}: {
    title: string;
    body?: string;
    type?: string;
    url?: string;
}) => {
    triggerNotificationVibration();

    // For high-urgency worker events (new-task) also play the chime while the
    // tab is foreground — vibration alone is easy to miss on desktop and iPad.
    if (type === "new-task") {
        playWorkerNotificationSound();
    }

    if (typeof document !== "undefined" && document.visibilityState === "visible") {
        return;
    }

    await showBrowserNotification(title, {
        body,
        url,
        tag: type || "notification",
        data: type ? { type } : undefined,
    });
};

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
    const { joinUserRoom, onNotification } = useSocket();
    const { language } = useGlobalSettings();
    const t = useI18n();
    const [isSupported, setIsSupported] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [pushSubscribed, setPushSubscribed] = useState(false);
    const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isInboxLoading, setIsInboxLoading] = useState(false);

    // Check for standard Push API support (self-hosted Web Push, no Firebase)
    useEffect(() => {
        const supported = isWebPushSupported();
        setIsSupported(supported);
        if (supported && typeof Notification !== "undefined") {
            setPermissionStatus(Notification.permission);
        }
        setIsLoading(false);
    }, []);

    // Request notification permission (standard Notification API)
    const requestPermission = useCallback(async (): Promise<{ granted: boolean }> => {
        if (!isSupported) {
            addToast({
                title: t("notificationsNotSupportedTitle"),
                description: t("notificationsNotSupportedDescription"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return { granted: false };
        }

        setIsLoading(true);

        try {
            const permission = await Notification.requestPermission();
            setPermissionStatus(permission);

            if (permission === "granted") {
                addToast({
                    title: t("notificationsEnabledTitle"),
                    description: t("notificationsEnabledDescription"),
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });

                return { granted: true };
            } else {
                if (permission === "denied") {
                    addToast({
                        title: t("notificationsDisabledTitle"),
                        description: t("enableNotificationsInBrowserSettings"),
                        color: "warning",
                        timeout: 3000,
                        shouldShowTimeoutProgress: true,
                    });
                }

                return { granted: false };
            }
        } catch (error) {
            console.error("Error requesting permission:", error);
            addToast({
                title: t("notificationPermissionErrorTitle"),
                description: t("notificationPermissionErrorDescription"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return { granted: false };
        } finally {
            setIsLoading(false);
        }
    }, [isSupported, t]);

    // Registers this device's self-hosted Web Push subscription (webpush-go,
    // VAPID) with the backend for the current authenticated user.
    const registerPushToken = useCallback(async (
        userType: "worker" | "student",
        targetId?: number | string,
    ): Promise<{ success: boolean; error?: string }> => {
        const user = authService.getStoredUser();
        if (!hasAuthenticatedSession() || !user?.id) {
            return { success: false, error: "ต้องเข้าสู่ระบบก่อนถึงจะลงทะเบียนอุปกรณ์ได้" };
        }

        const result = await registerPushSubscription(userType, targetId, {
            userId: user.id,
            studentId: user.student_id,
        });
        if (result.success) {
            setPushSubscribed(true);
        }
        return result;
    }, []);

    const unregisterPushToken = useCallback(async (): Promise<boolean> => {
        const success = await unregisterPushSubscription();
        if (success) {
            setPushSubscribed(false);
        }
        return success;
    }, []);

    const refreshNotifications = useCallback(async () => {
        if (!hasAuthenticatedSession() || !authService.getStoredUser()?.id) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        setIsInboxLoading(true);
        try {
            const [listResult, count] = await Promise.all([
                userNotificationService.getNotifications(30, 0),
                userNotificationService.getUnreadCount(),
            ]);
            setNotifications(listResult.items);
            setUnreadCount(count);
        } catch (error) {
            console.error("Failed to load notifications:", error);
        } finally {
            setIsInboxLoading(false);
        }
    }, []);

    const markNotificationRead = useCallback(async (id: number) => {
        const target = notifications.find((item) => item.id === id);
        if (!target || target.is_read) {
            return;
        }
        setNotifications((prev) => prev.map((item) => item.id === id ? { ...item, is_read: true, read_at: new Date().toISOString() } : item));
        setUnreadCount((prev) => Math.max(0, prev - 1));
        try {
            await userNotificationService.markRead(id);
        } catch (error) {
            console.error("Failed to mark notification read:", error);
            refreshNotifications();
        }
    }, [notifications, refreshNotifications]);

    const markAllNotificationsRead = useCallback(async () => {
        const nowIso = new Date().toISOString();
        setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true, read_at: item.read_at ?? nowIso })));
        setUnreadCount(0);
        try {
            await userNotificationService.markAllRead();
        } catch (error) {
            console.error("Failed to mark all notifications read:", error);
            refreshNotifications();
        }
    }, [refreshNotifications]);

    const clearReadNotifications = useCallback(async () => {
        try {
            await userNotificationService.clearRead();
            setNotifications((prev) => prev.filter((item) => !item.is_read));
        } catch (error) {
            console.error("Failed to clear read notifications:", error);
            refreshNotifications();
        }
    }, [refreshNotifications]);

    useEffect(() => {
        const user = authService.getStoredUser();
        if (!user?.id || !hasAuthenticatedSession()) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        joinUserRoom(user.id);
        refreshNotifications();

        return onNotification((data: any) => {
            const incomingId = Number(data?.id || 0);
            const incoming: UserNotificationItem = {
                id: incomingId,
                user_id: user.id,
                type: String(data?.type || "notification"),
                title: String(data?.title || t("notification")),
                message: String(data?.message || ""),
                course_id: data?.course_id ? String(data.course_id) : undefined,
                link: data?.link ? String(data.link) : undefined,
                data: typeof data?.data === "object" && data?.data ? data.data : undefined,
                is_read: Boolean(data?.is_read),
                read_at: data?.read_at || null,
                created_at: data?.created_at || new Date().toISOString(),
            };

            const previewTitle = getNotificationHeadline(incoming, language, t);
            const previewMessage = getNotificationMessage(incoming, language, t);

            setNotifications((prev) => {
                if (incoming.id > 0 && prev.some((item) => item.id === incoming.id)) {
                    return prev;
                }
                return [incoming, ...prev].slice(0, 50);
            });

            if (typeof data?.unread_count === "number") {
                setUnreadCount(data.unread_count);
            } else if (!incoming.is_read) {
                setUnreadCount((prev) => prev + 1);
            }

            if (!incoming.is_read) {
                addToast({
                    title: previewTitle,
                    description: previewMessage,
                    color: getToastColor(incoming.type),
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });

                void notifyDevice({
                    title: previewTitle,
                    body: previewMessage,
                    type: incoming.type,
                    url: resolveNotificationUrl(incoming),
                });
            }
        });
    }, [joinUserRoom, language, onNotification, refreshNotifications, t]);

    const value: NotificationContextType = {
        isSupported,
        permissionStatus,
        isLoading,
        pushSubscribed,
        requestPermission,
        registerPushToken,
        unregisterPushToken,
        notifications,
        unreadCount,
        isInboxLoading,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        clearReadNotifications,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

// Helper function to get toast color based on notification type
function getToastColor(type?: string): "primary" | "success" | "warning" | "danger" | "default" {
    switch (type) {
        case "new-task":
            return "primary";
        case "queue-ready":
            return "warning";
        case "booking-completed":
            return "success";
        default:
            return "default";
    }
}

export default NotificationProvider;
