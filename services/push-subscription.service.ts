import { API_BASE_URL } from "@/config/api";
import { registerPwaServiceWorker } from "@/lib/pwa-notifications";
import { addToast } from "@heroui/toast";

// Converts a URL-safe base64 VAPID public key into the Uint8Array shape
// required by PushManager.subscribe({ applicationServerKey }).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function bufferToBase64(buffer: ArrayBuffer): string {
    return window.btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export function isWebPushSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

async function fetchVapidPublicKey(): Promise<string | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/push/vapid-public-key`);
        const result = await response.json();
        return result?.data?.public_key || null;
    } catch (error) {
        console.error("Failed to fetch VAPID public key:", error);
        return null;
    }
}

// Ensures this browser has an active Web Push subscription (standard Push API
// + VAPID, no external push provider account needed) and returns it as JSON.
// Re-subscribes automatically if a stale subscription with a different key exists.
export async function ensurePushSubscription(): Promise<PushSubscriptionJSON | null> {
    if (!isWebPushSupported()) {
        return null;
    }

    try {
        const publicKey = await fetchVapidPublicKey();
        if (!publicKey) {
            // Backend has no VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY configured (or the
            // /api/push/vapid-public-key endpoint is unreachable). No subscription
            // can ever be created until this is fixed server-side.
            addToast({
                title: "เปิดใช้งานการแจ้งเตือนไม่สำเร็จ",
                description: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าการแจ้งเตือนแบบพุช กรุณาติดต่อผู้ดูแลระบบ",
                color: "danger",
                timeout: 5000,
                shouldShowTimeoutProgress: true,
            });
            return null;
        }

        const registration = await registerPwaServiceWorker();
        if (!registration) {
            addToast({
                title: "เปิดใช้งานการแจ้งเตือนไม่สำเร็จ",
                description: "ไม่สามารถลงทะเบียน Service Worker ได้ กรุณาตรวจสอบว่าเปิดผ่าน HTTPS",
                color: "danger",
                timeout: 5000,
                shouldShowTimeoutProgress: true,
            });
            return null;
        }

        let subscription = await registration.pushManager.getSubscription();
        const nextKey = bufferToBase64(urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer);
        if (subscription) {
            const currentKey = subscription.options.applicationServerKey
                ? bufferToBase64(subscription.options.applicationServerKey as ArrayBuffer)
                : null;
            if (currentKey !== nextKey) {
                await subscription.unsubscribe();
                subscription = null;
            }
        }

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
            });
        }

        return subscription.toJSON();
    } catch (error) {
        console.error("Failed to create web push subscription:", error);
        addToast({
            title: "เปิดใช้งานการแจ้งเตือนไม่สำเร็จ",
            description: error instanceof Error ? error.message : "เบราว์เซอร์ปฏิเสธการสมัครรับการแจ้งเตือนแบบพุช",
            color: "danger",
            timeout: 5000,
            shouldShowTimeoutProgress: true,
        });
        return null;
    }
}

interface RegisterPushOptions {
    userId?: number;
    studentId?: string;
}

// Registers (or re-registers) this device's Web Push subscription with the
// backend. Public endpoint — mirrors the previous FCM registration contract
// (user_type/target_id/student_id) but carries a standard Push subscription.
export async function registerPushSubscription(
    userType: "worker" | "student",
    targetId?: number | string,
    options: RegisterPushOptions = {},
): Promise<boolean> {
    const subscription = await ensurePushSubscription();
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/push/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
                user_type: userType,
                user_id: options.userId,
                target_id: targetId,
                student_id: options.studentId,
                device_info: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                },
            }),
        });
        const result = await response.json();
        return !!result.success;
    } catch (error) {
        console.error("Failed to register push subscription:", error);
        return false;
    }
}

export async function unregisterPushSubscription(): Promise<boolean> {
    if (!isWebPushSupported()) {
        return true;
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) {
            return true;
        }

        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        const response = await fetch(`${API_BASE_URL}/push/unsubscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
        });
        const result = await response.json();
        return !!result.success;
    } catch (error) {
        console.error("Failed to unregister push subscription:", error);
        return false;
    }
}

