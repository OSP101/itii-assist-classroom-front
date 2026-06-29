"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { MessagePayload } from "firebase/messaging";
import { addToast } from "@heroui/toast";
import {
    initializeFirebase,
    requestNotificationPermission,
    onForegroundMessage,
    isPushNotificationSupported,
    getNotificationPermissionStatus,
} from "@/config/firebase";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { authService } from "@/services/auth.service";
import { useI18n } from "@/hooks/useI18n";
import { getNotificationHeadline, getNotificationMessage } from "@/lib/notification-display";
import { useSocket } from "@/contexts/SocketContext";
import userNotificationService, { UserNotificationItem } from "@/services/user-notification.service";
import { showBrowserNotification, triggerNotificationVibration } from "@/lib/pwa-notifications";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// Helper to get access token from localStorage
const getAccessToken = (): string | null => {
    if (typeof window !== "undefined") {
        return localStorage.getItem("accessToken");
    }
    return null;
};

const hasAuthenticatedSession = (): boolean => {
    return authService.isAuthenticated() && !!getAccessToken();
};

interface NotificationContextType {
    // Permission states
    isSupported: boolean;
    permissionStatus: NotificationPermission | null;
    isLoading: boolean;
    fcmToken: string | null;

    // Actions
    requestPermission: () => Promise<{ granted: boolean; token: string | null }>;
    registerFcmToken: (userType: "worker" | "student", targetId?: number, tokenOverride?: string | null) => Promise<boolean>;
    unregisterFcmToken: () => Promise<boolean>;

    // Latest notification (for in-app handling)
    lastNotification: MessagePayload | null;
    clearLastNotification: () => void;

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
    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const [lastNotification, setLastNotification] = useState<MessagePayload | null>(null);
    const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isInboxLoading, setIsInboxLoading] = useState(false);

    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Initialize Firebase and check support
    useEffect(() => {
        const init = async () => {
            const supported = isPushNotificationSupported();
            setIsSupported(supported);

            if (supported) {
                initializeFirebase();
                const status = getNotificationPermissionStatus();
                setPermissionStatus(status);

                // Send config to service worker
                if ("serviceWorker" in navigator) {
                    navigator.serviceWorker.ready.then((registration) => {
                        registration.active?.postMessage({
                            type: "FIREBASE_CONFIG",
                            config: {
                                apiKey: "AIzaSyAOgm56BteZP_ipSdv8il8r6knK3i4vTFc",
                                authDomain: "itii-assist-classrooms.firebaseapp.com",
                                projectId: "itii-assist-classrooms",
                                storageBucket: "itii-assist-classrooms.firebasestorage.app",
                                messagingSenderId: "217696858922",
                                appId: "1:217696858922:web:27341ecb0e7b7ca971e453"
                            },
                        });
                    });
                }
            }

            setIsLoading(false);
        };

        init();

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    // Request notification permission
    const requestPermission = useCallback(async (): Promise<{ granted: boolean; token: string | null }> => {
        if (!isSupported) {
            addToast({
                title: t("notificationsNotSupportedTitle"),
                description: t("notificationsNotSupportedDescription"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return { granted: false, token: null };
        }

        setIsLoading(true);

        try {
            const token = await requestNotificationPermission();
            const nextPermissionStatus = getNotificationPermissionStatus();
            setPermissionStatus(nextPermissionStatus);

            if (nextPermissionStatus === "granted") {
                setFcmToken(token);

                // Setup foreground message listener
                if (token) {
                    if (unsubscribeRef.current) {
                        unsubscribeRef.current();
                    }

                    const unsubscribe = onForegroundMessage((payload) => {
                        setLastNotification(payload);

                        // Show in-app toast for foreground notifications
                        const preview = {
                            type: payload.data?.type,
                            title: payload.notification?.title || payload.data?.title || t("notification"),
                            message: payload.notification?.body || payload.data?.body || "",
                            data: payload.data,
                        };
                        const previewTitle = getNotificationHeadline(preview, language, t);
                        const previewMessage = getNotificationMessage(preview, language, t);

                        addToast({
                            title: previewTitle,
                            description: previewMessage,
                            color: getToastColor(payload.data?.type),
                            timeout: 3000,
                            shouldShowTimeoutProgress: true,
                        });

                        void notifyDevice({
                            title: previewTitle,
                            body: previewMessage,
                            type: payload.data?.type,
                            url: resolveNotificationUrl({ data: payload.data }),
                        });
                    });

                    if (unsubscribe) {
                        unsubscribeRef.current = unsubscribe;
                    }
                }

                addToast({
                    title: t("notificationsEnabledTitle"),
                    description: token ? t("notificationsEnabledDescription") : t("notificationsEnabledLimitedDescription"),
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });

                return { granted: true, token };
            } else {
                if (nextPermissionStatus === "denied") {
                    addToast({
                        title: t("notificationsDisabledTitle"),
                        description: t("enableNotificationsInBrowserSettings"),
                        color: "warning",
                        timeout: 3000,
                        shouldShowTimeoutProgress: true,
                    });
                }

                return { granted: false, token: null };
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
            return { granted: false, token: null };
        } finally {
            setIsLoading(false);
        }
    }, [isSupported, language, t]);

    // Register FCM token with backend
    const registerFcmToken = useCallback(async (
        userType: "worker" | "student",
        targetId?: number,
        tokenOverride?: string | null,
    ): Promise<boolean> => {
        const activeToken = tokenOverride ?? fcmToken;
        if (!activeToken) {
            console.warn("No FCM token available");
            return false;
        }

        try {
            const user = authService.getStoredUser();
            const accessToken = getAccessToken();
            if (!accessToken || !user?.id) {
                return false;
            }

            const response = await fetch(`${API_BASE_URL}/notifications/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({
                    fcm_token: activeToken,
                    user_type: userType,
                    user_id: user?.id,
                    target_id: targetId, // session_id for workers, booking_id for students
                    student_id: user?.student_id,
                    device_info: {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language,
                    },
                }),
            });

            const result = await response.json();

            if (result.success) {
                return true;
            } else {
                console.error("Failed to register FCM token:", result.error);
                return false;
            }
        } catch (error) {
            console.error("Error registering FCM token:", error);
            return false;
        }
    }, [fcmToken]);

    // Unregister FCM token
    const unregisterFcmToken = useCallback(async (): Promise<boolean> => {
        if (!fcmToken) return true;

        try {
            const accessToken = getAccessToken();
            if (!accessToken) {
                return true;
            }

            const response = await fetch(`${API_BASE_URL}/notifications/unregister`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({ fcm_token: fcmToken }),
            });

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error("Error unregistering FCM token:", error);
            return false;
        }
    }, [fcmToken]);

    // Clear last notification
    const clearLastNotification = useCallback(() => {
        setLastNotification(null);
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
        fcmToken,
        requestPermission,
        registerFcmToken,
        unregisterFcmToken,
        lastNotification,
        clearLastNotification,
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
