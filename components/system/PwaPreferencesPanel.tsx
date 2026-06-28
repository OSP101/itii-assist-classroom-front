"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { useI18n } from "@/hooks/useI18n";
import { useNotification } from "@/contexts/NotificationContext";
import { authService } from "@/services/auth.service";
import {
  showBrowserNotification,
  supportsVibrationApi,
  triggerNotificationVibration,
} from "@/lib/pwa-notifications";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };

  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function isSafariBrowser(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent;
  return /Safari/i.test(userAgent) && !/Chrome|CriOS|Chromium|Edg|OPR|Firefox|FxiOS|SamsungBrowser|Android/i.test(userAgent);
}

function isAppleMobileBrowser(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(userAgent) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

function StatusPill({ tone, label }: { tone: "success" | "warning" | "default"; label: string }) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-default-200 bg-default-100 text-default-600";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClassName}`}>
      {label}
    </span>
  );
}

export function PwaPreferencesPanel() {
  const t = useI18n();
  const { isSupported, permissionStatus, isLoading, requestPermission, registerFcmToken, fcmToken } = useNotification();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const livePermissionStatus =
    typeof window !== "undefined" && typeof Notification !== "undefined"
      ? Notification.permission
      : permissionStatus;
  const vibrationSupported = supportsVibrationApi();
  const safariBrowser = isSafariBrowser();
  const appleMobileBrowser = isAppleMobileBrowser();
  const requiresStandaloneForNotifications = safariBrowser && appleMobileBrowser && !isStandalone;
  const supportsBrowserNotifications = typeof window !== "undefined" && "Notification" in window;
  const manualInstallRequired = requiresStandaloneForNotifications && installPrompt === null;

  useEffect(() => {
    const syncStandaloneState = () => {
      setIsStandalone(isStandaloneMode());
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      syncStandaloneState();
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      addToast({
        title: t("appInstalledTitle"),
        description: t("appInstalledDescription"),
        color: "success",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
      });
    };

    syncStandaloneState();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [t]);

  const handleInstall = async () => {
    if (!installPrompt) {
      return;
    }

    setIsInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const handleNotificationAction = async () => {
    if (requiresStandaloneForNotifications) {
      addToast({
        title: t("safariInstallRequiredTitle"),
        description: t("safariInstallRequiredDescription"),
        color: "warning",
        timeout: 4000,
        shouldShowTimeoutProgress: true,
      });
      return;
    }

    if (!supportsBrowserNotifications) {
      addToast({
        title: t("notificationsNotSupportedTitle"),
        description: t("notificationsNotSupportedDescription"),
        color: "warning",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
      });
      return;
    }

    setIsSendingTest(true);
    try {
      const permissionResult =
        livePermissionStatus === "granted" && fcmToken
          ? { granted: true, token: fcmToken }
          : await requestPermission();

      if (!permissionResult.granted) {
        return;
      }

      const user = authService.getStoredUser();
      let linkedToAccount = false;
      if (user && permissionResult.token) {
        linkedToAccount = await registerFcmToken(
          user.role === "student" ? "student" : "worker",
          undefined,
          permissionResult.token,
        );
      }

      triggerNotificationVibration();
      const shown = await showBrowserNotification(t("testNotificationTitle"), {
        body: t("testNotificationDescription"),
        tag: "labtas-test-notification",
        url: "/settings",
        data: { type: "settings-test" },
      });

      addToast({
        title: shown ? t("testNotificationSent") : t("notificationPermissionErrorTitle"),
        description: shown
          ? linkedToAccount
            ? t("testNotificationLinkedHint")
            : permissionResult.token
              ? t("testNotificationHint")
              : t("notificationsEnabledLimitedDescription")
          : t("notificationPermissionErrorDescription"),
        color: shown ? "success" : "warning",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const installReady = !isStandalone && installPrompt !== null;

  return (
    <section className="w-full max-w-xl rounded-3xl border border-divider bg-content1 p-5 shadow-sm">
      <div className="mb-4 space-y-1">
        <h2 className="text-base font-semibold text-foreground">{t("appExperience")}</h2>
        <p className="text-sm text-default-500">{t("appExperienceDescription")}</p>
      </div>

      <div className="space-y-3">
        <section className="rounded-2xl border border-divider bg-content2/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <Icon icon="solar:download-square-linear" className="text-lg" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("installApp")}</p>
                <p className="text-xs text-default-500">{t("installAppDescription")}</p>
              </div>
            </div>
            <StatusPill
              tone={isStandalone ? "success" : installReady || manualInstallRequired ? "warning" : "default"}
              label={
                isStandalone
                  ? t("appAlreadyInstalled")
                  : installReady
                    ? t("appInstallReady")
                    : manualInstallRequired
                      ? t("appInstallManual")
                      : t("appInstallUnavailable")
              }
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!installReady || isInstalling}
              onClick={() => void handleInstall()}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isInstalling ? t("checkingStatus") : t("installApp")}
            </button>
          </div>

          {manualInstallRequired ? (
            <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-sky-800">
              <p className="font-medium">{t("safariManualInstallTitle")}</p>
              <p className="mt-1 text-xs text-sky-700">{t("safariManualInstallDescription")}</p>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-divider bg-content2/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <Icon icon="solar:bell-bing-linear" className="text-lg" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("notificationsPermission")}</p>
                <p className="text-xs text-default-500">{t("notificationTestDescription")}</p>
              </div>
            </div>
            <StatusPill
              tone={livePermissionStatus === "granted" ? "success" : livePermissionStatus === "denied" ? "warning" : "default"}
              label={
                livePermissionStatus === "granted"
                  ? t("notificationsEnabled")
                  : requiresStandaloneForNotifications
                    ? t("installAppFirst")
                  : livePermissionStatus === "denied"
                    ? t("denied")
                    : t("awaitingPermission")
              }
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-default-200 bg-content1 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-default-500">{t("notificationsPermission")}</p>
              <p className="mt-1 text-sm text-foreground">
                {requiresStandaloneForNotifications
                  ? t("safariInstallRequiredDescription")
                  : isSupported
                  ? livePermissionStatus === "granted"
                    ? t("notificationsEnabled")
                    : livePermissionStatus === "denied"
                      ? t("notificationsDeniedBrowserSettings")
                      : t("receiveSystemNotifications")
                  : t("notificationsNotSupportedDescription")}
              </p>
            </div>
            <div className="rounded-xl border border-default-200 bg-content1 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-default-500">{t("vibrationStatus")}</p>
              <p className="mt-1 text-sm text-foreground">
                {vibrationSupported ? t("vibrationSupported") : t("vibrationNotSupported")}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isLoading || isSendingTest || !supportsBrowserNotifications || requiresStandaloneForNotifications}
              onClick={() => void handleNotificationAction()}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {livePermissionStatus === "granted" ? t("sendTestNotification") : t("allowNotifications")}
            </button>
          </div>

          {requiresStandaloneForNotifications ? (
            <p className="mt-3 text-xs text-amber-700">{t("safariInstallRequiredDescription")}</p>
          ) : null}

          {livePermissionStatus === "denied" ? (
            <p className="mt-3 text-xs text-default-500">{safariBrowser ? t("safariSiteSettingsTip") : t("chromeSiteSettingsTip")}</p>
          ) : null}
        </section>
      </div>
    </section>
  );
}
