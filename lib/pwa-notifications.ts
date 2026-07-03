const PWA_SERVICE_WORKER_PATH = "/push-sw.js";

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

let _notificationAudio: HTMLAudioElement | null = null;

export function playNotificationSound(): void {
  if (typeof window === "undefined") return;
  try {
    if (!_notificationAudio) {
      _notificationAudio = new Audio("/notification.mp3");
    }
    _notificationAudio.currentTime = 0;
    _notificationAudio.play().catch(() => {
      // Autoplay may be blocked before user interaction; silently ignore
    });
  } catch {
    // Silently ignore audio errors
  }
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

// Standard Web Push (webpush-go, VAPID) requires a secure context and a
// service worker. On iOS/iPadOS Safari, push additionally only works once
// the site is installed to the home screen (standalone display mode) —
// there is no `beforeinstallprompt` on iOS, so callers must guide users to
// the manual Share → "Add to Home Screen" flow themselves.
export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };

  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export function isSafariBrowser(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent;
  return /Safari/i.test(userAgent) && !/Chrome|CriOS|Chromium|Edg|OPR|Firefox|FxiOS|SamsungBrowser|Android/i.test(userAgent);
}

export function isAppleMobileBrowser(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(userAgent) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

// True when this device needs the manual "Add to Home Screen" flow before
// push notifications (or the notification permission prompt) can work at all.
export function requiresHomeScreenInstallForPush(): boolean {
  return isAppleMobileBrowser() && isSafariBrowser() && !isStandaloneMode();
}

