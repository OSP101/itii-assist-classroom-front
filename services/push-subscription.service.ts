import { API_BASE_URL } from "@/config/api";
import { csrfHeader, getCsrfToken } from "@/lib/csrf";
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
// Throws with a user-facing Thai message when subscription cannot be created —
// callers surface that message in the retry banner so a TA can see the actual
// failure instead of a generic "not registered" state.
export async function ensurePushSubscription(): Promise<PushSubscriptionJSON> {
    if (!isWebPushSupported()) {
        throw new Error("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบพุช");
    }

    const publicKey = await fetchVapidPublicKey();
    if (!publicKey) {
        // Backend has no VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY configured (or the
        // /api/push/vapid-public-key endpoint is unreachable).
        throw new Error("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า VAPID key กรุณาติดต่อผู้ดูแลระบบ");
    }

    const registration = await registerPwaServiceWorker();
    if (!registration) {
        throw new Error("ลงทะเบียน Service Worker ไม่สำเร็จ (ต้องเปิดผ่าน HTTPS)");
    }

    // iOS Safari fires `pushManager.subscribe` errors when the service worker
    // is registered but has not fully activated yet. Waiting for the ready
    // promise turns that intermittent silent failure into a deterministic
    // success across launches from the home-screen icon.
    if (navigator.serviceWorker?.ready) {
        try {
            await navigator.serviceWorker.ready;
        } catch {
            // no-op — subscribe will still be attempted below
        }
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
        try {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
            });
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`เบราว์เซอร์ปฏิเสธการสมัครรับพุช: ${detail}`);
        }
    }

    return subscription.toJSON();
}

interface RegisterPushOptions {
    userId?: number;
    studentId?: string;
}

export interface RegisterPushResult {
    success: boolean;
    error?: string;
}

// Registers (or re-registers) this device's Web Push subscription with the
// backend. Returns a detailed result so callers can show WHY it failed —
// otherwise iOS users see a permanent "not registered" banner with no clue.
export async function registerPushSubscription(
    userType: "worker" | "student",
    targetId?: number | string,
    options: RegisterPushOptions = {},
): Promise<RegisterPushResult> {
    let subscription: PushSubscriptionJSON;
    try {
        subscription = await ensurePushSubscription();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to create web push subscription:", error);
        return { success: false, error: message };
    }

    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        return { success: false, error: "ข้อมูล subscription ที่ได้จากเบราว์เซอร์ไม่ครบ" };
    }

    try {
        // This endpoint is public (no login required — device registration
        // works pre-auth), but a same-origin fetch still auto-attaches
        // cookies by default. If the caller happens to be logged in, echo
        // the CSRF token so the backend's blanket CSRF check (which fires
        // on cookie presence, not per-route auth) doesn't reject it.
        const response = await fetch(`${API_BASE_URL}/push/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...csrfHeader(),
            },
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
        if (!response.ok) {
            return { success: false, error: `เซิร์ฟเวอร์ตอบ ${response.status}` };
        }
        const result = await response.json();
        if (!result?.success) {
            return { success: false, error: result?.error?.message || "เซิร์ฟเวอร์บันทึกไม่สำเร็จ" };
        }
        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to register push subscription:", error);
        return { success: false, error: `เชื่อมต่อ /push/register ไม่ได้: ${message}` };
    }
}

export interface SendTestPushResult {
    success: boolean;
    attempted: number;
    delivered: number;
    stale: number;
    message?: string;
}

// Triggers the server-side self-test push so a signed-in worker can verify
// end-to-end delivery to their actual device(s) before a real booking arrives.
export async function sendTestPush(): Promise<SendTestPushResult> {
    const failure: SendTestPushResult = { success: false, attempted: 0, delivered: 0, stale: 0 };
    if (typeof window === "undefined") {
        return failure;
    }

    const csrfToken = getCsrfToken();
    if (!csrfToken) {
        return { ...failure, message: "unauthenticated" };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/push/test`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "X-Client-Type": "web",
                "X-CSRF-Token": csrfToken,
                Referer: window.location.href,
            },
        });
        const result = await response.json();
        if (!result?.success) {
            return { ...failure, message: result?.error?.message };
        }
        return {
            success: true,
            attempted: Number(result?.data?.attempted ?? 0),
            delivered: Number(result?.data?.delivered ?? 0),
            stale: Number(result?.data?.stale ?? 0),
        };
    } catch (error) {
        console.error("Failed to send test push:", error);
        return { ...failure, message: error instanceof Error ? error.message : "network_error" };
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

        // Same reasoning as registerPushSubscription above: public endpoint,
        // but echo the CSRF token in case a same-origin cookie is attached.
        const response = await fetch(`${API_BASE_URL}/push/unsubscribe`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...csrfHeader(),
            },
            body: JSON.stringify({ endpoint }),
        });
        const result = await response.json();
        return !!result.success;
    } catch (error) {
        console.error("Failed to unregister push subscription:", error);
        return false;
    }
}

