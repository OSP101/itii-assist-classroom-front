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
import { authService } from "@/services/auth.service";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// Helper to get access token from localStorage
const getAccessToken = (): string | null => {
    if (typeof window !== "undefined") {
        return localStorage.getItem("accessToken");
    }
    return null;
};

interface NotificationContextType {
    // Permission states
    isSupported: boolean;
    permissionStatus: NotificationPermission | null;
    isLoading: boolean;
    fcmToken: string | null;

    // Actions
    requestPermission: () => Promise<boolean>;
    registerFcmToken: (userType: "worker" | "student", targetId?: number) => Promise<boolean>;
    unregisterFcmToken: () => Promise<boolean>;

    // Latest notification (for in-app handling)
    lastNotification: MessagePayload | null;
    clearLastNotification: () => void;
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

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
    const [isSupported, setIsSupported] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const [lastNotification, setLastNotification] = useState<MessagePayload | null>(null);

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
    const requestPermission = useCallback(async (): Promise<boolean> => {
        if (!isSupported) {
            addToast({
                title: "ไม่รองรับ",
                description: "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }

        setIsLoading(true);

        try {
            const token = await requestNotificationPermission();

            if (token) {
                setFcmToken(token);
                setPermissionStatus("granted");

                // Setup foreground message listener
                const unsubscribe = onForegroundMessage((payload) => {
                    console.log("Foreground notification:", payload);
                    setLastNotification(payload);

                    // Show in-app toast for foreground notifications
                    const title = payload.notification?.title || payload.data?.title || "แจ้งเตือน";
                    const body = payload.notification?.body || payload.data?.body || "";

                    addToast({
                        title,
                        description: body,
                        color: getToastColor(payload.data?.type),
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });
                });

                if (unsubscribe) {
                    unsubscribeRef.current = unsubscribe;
                }

                addToast({
                    title: "เปิดการแจ้งเตือนแล้ว",
                    description: "คุณจะได้รับการแจ้งเตือนเมื่อมีงานใหม่",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });

                return true;
            } else {
                setPermissionStatus(Notification.permission);

                if (Notification.permission === "denied") {
                    addToast({
                        title: "การแจ้งเตือนถูกปิด",
                        description: "กรุณาเปิดการแจ้งเตือนในการตั้งค่าเบราว์เซอร์",
                        color: "warning",
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });
                }

                return false;
            }
        } catch (error) {
            console.error("Error requesting permission:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถเปิดการแจ้งเตือนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isSupported]);

    // Register FCM token with backend
    const registerFcmToken = useCallback(async (
        userType: "worker" | "student",
        targetId?: number
    ): Promise<boolean> => {
        if (!fcmToken) {
            console.warn("No FCM token available");
            return false;
        }

        try {
            const user = authService.getStoredUser();
            const accessToken = getAccessToken();
            const response = await fetch(`${API_BASE_URL}/notifications/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({
                    fcm_token: fcmToken,
                    user_type: userType,
                    user_id: user?.id,
                    target_id: targetId, // session_id for workers, booking_id for students
                    device_info: {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language,
                    },
                }),
            });

            const result = await response.json();

            if (result.success) {
                console.log("FCM token registered successfully");
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
