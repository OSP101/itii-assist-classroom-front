const PWA_SERVICE_WORKER_PATH = "/firebase-messaging-sw.js";

const DEFAULT_VIBRATION_PATTERN = [180, 80, 240] as const;

type ExtendedNotificationOptions = NotificationOptions & {
  renotify?: boolean;
  vibrate?: number[];
};

export interface BrowserNotificationOptions {
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}

export function supportsServiceWorkerNotifications(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

export function supportsVibrationApi(): boolean {
  return typeof window !== "undefined" && typeof navigator.vibrate === "function";
}

export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!supportsServiceWorkerNotifications()) {
    return null;
  }

  try {
    return await navigator.serviceWorker.register(PWA_SERVICE_WORKER_PATH, { scope: "/" });
  } catch (error) {
    console.error("Failed to register PWA service worker:", error);
    return null;
  }
}

export function triggerNotificationVibration(pattern: readonly number[] = DEFAULT_VIBRATION_PATTERN): boolean {
  if (!supportsVibrationApi()) {
    return false;
  }

  return navigator.vibrate([...pattern]);
}

export async function showBrowserNotification(
  title: string,
  options: BrowserNotificationOptions = {},
): Promise<boolean> {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return false;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  const registration = await registerPwaServiceWorker();
  if (!registration) {
    return false;
  }

  const notificationOptions: ExtendedNotificationOptions = {
    body: options.body,
    icon: options.icon || "/icons/icon-192.png",
    badge: options.badge || "/icons/badge-96.png",
    tag: options.tag,
    data: {
      url: options.url,
      ...(options.data ?? {}),
    },
    requireInteraction: options.requireInteraction,
    renotify: true,
    vibrate: [...DEFAULT_VIBRATION_PATTERN],
  };

  await registration.showNotification(title, notificationOptions);

  return true;
}
