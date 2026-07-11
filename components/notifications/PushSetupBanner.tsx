"use client";

import { useCallback, useState } from "react";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { useI18n } from "@/hooks/useI18n";
import { useNotification } from "@/contexts/NotificationContext";
import {
  isAppleMobileBrowser,
  isSafariBrowser,
  isStandaloneMode,
  requiresHomeScreenInstallForPush,
  supportsServiceWorkerNotifications,
} from "@/lib/pwa-notifications";
import { sendTestPush } from "@/services/push-subscription.service";
import IosInstallPromptModal from "./IosInstallPromptModal";

interface PushSetupBannerProps {
  sessionId: string;
}

type BannerTone = "success" | "warning" | "danger" | "info";

const TONE_STYLES: Record<BannerTone, { wrap: string; icon: string; iconName: string }> = {
  success: {
    wrap: "border-success-200 bg-success-50 text-success-800",
    icon: "text-success-600",
    iconName: "ph:bell-ringing-duotone",
  },
  warning: {
    wrap: "border-warning-200 bg-warning-50 text-warning-800",
    icon: "text-warning-600",
    iconName: "ph:bell-simple-slash-duotone",
  },
  danger: {
    wrap: "border-danger-200 bg-danger-50 text-danger-800",
    icon: "text-danger-600",
    iconName: "ph:warning-circle-duotone",
  },
  info: {
    wrap: "border-primary-200 bg-primary-50 text-primary-800",
    icon: "text-primary-600",
    iconName: "ph:device-mobile-duotone",
  },
};

export default function PushSetupBanner({ sessionId }: PushSetupBannerProps) {
  const t = useI18n();
  const { isSupported, permissionStatus, pushSubscribed, isLoading, requestPermission, registerPushToken } =
    useNotification();
  const [iosModalOpen, setIosModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testCooldown, setTestCooldown] = useState(false);

  const needsIosInstall =
    typeof window !== "undefined" && requiresHomeScreenInstallForPush();
  const iosButStandalone =
    typeof window !== "undefined" && isAppleMobileBrowser() && isSafariBrowser() && isStandaloneMode();

  const handleEnable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { granted } = await requestPermission();
      if (granted) {
        await registerPushToken("worker", sessionId);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, registerPushToken, requestPermission, sessionId]);

  const handleRetrySubscribe = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await registerPushToken("worker", sessionId);
    } finally {
      setBusy(false);
    }
  }, [busy, registerPushToken, sessionId]);

  const handleTest = useCallback(async () => {
    if (testCooldown) return;
    setTestCooldown(true);
    setTimeout(() => setTestCooldown(false), 5000);
    const result = await sendTestPush();
    if (!result.success) {
      addToast({
        title: t("pushTestFailedTitle"),
        description: result.message || t("pushTestFailedDescription"),
        color: "danger",
        timeout: 4000,
      });
      return;
    }
    if (result.delivered === 0) {
      addToast({
        title: t("pushTestNoDeliveryTitle"),
        description: t("pushTestNoDeliveryDescription", { stale: result.stale }),
        color: "warning",
        timeout: 5000,
      });
      return;
    }
    addToast({
      title: t("pushTestSentTitle"),
      description: t("pushTestSentDescription", { delivered: result.delivered, attempted: result.attempted }),
      color: "success",
      timeout: 4000,
    });
  }, [t, testCooldown]);

  if (isLoading) return null;

  // No-op: browser genuinely cannot support push (e.g. old Android WebView)
  if (!supportsServiceWorkerNotifications() || !isSupported) {
    return (
      <BannerShell tone="danger" title={t("pushNotSupportedTitle")} description={t("pushNotSupportedDescription")} />
    );
  }

  // iOS Safari (not yet installed as PWA) — cannot request permission from
  // browser tab. Must go through Add-to-Home-Screen first.
  if (needsIosInstall) {
    return (
      <>
        <BannerShell
          tone="info"
          title={t("pushIosNeedsInstallTitle")}
          description={t("pushIosNeedsInstallDescription")}
          actions={
            <Button color="primary" size="sm" onPress={() => setIosModalOpen(true)} startContent={<Icon icon="ph:device-mobile-duotone" />}>
              {t("pushIosOpenGuide")}
            </Button>
          }
        />
        <IosInstallPromptModal isOpen={iosModalOpen} onClose={() => setIosModalOpen(false)} />
      </>
    );
  }

  // Permission denied at the browser level — user must recover manually via
  // browser site-settings; JS cannot re-request once denied.
  if (permissionStatus === "denied") {
    return (
      <BannerShell
        tone="danger"
        title={t("pushDeniedTitle")}
        description={t("pushDeniedDescription")}
      />
    );
  }

  // Not asked yet
  if (permissionStatus === "default" || permissionStatus === null) {
    return (
      <BannerShell
        tone="warning"
        title={t("pushEnablePromptTitle")}
        description={t("pushEnablePromptDescription")}
        actions={
          <Button color="warning" size="sm" isLoading={busy} onPress={handleEnable} startContent={<Icon icon="ph:bell-ringing-duotone" />}>
            {t("pushEnableButton")}
          </Button>
        }
      />
    );
  }

  // Granted but not subscribed on this device (subscription failed / stale)
  if (!pushSubscribed) {
    return (
      <BannerShell
        tone="warning"
        title={t("pushRetrySubscribeTitle")}
        description={t("pushRetrySubscribeDescription")}
        actions={
          <Button color="warning" size="sm" isLoading={busy} onPress={handleRetrySubscribe} startContent={<Icon icon="ph:arrows-clockwise" />}>
            {t("pushRetryButton")}
          </Button>
        }
      />
    );
  }

  // Fully working — compact success banner with permanent test button
  return (
    <BannerShell
      tone="success"
      title={t("pushReadyTitle")}
      description={iosButStandalone ? t("pushReadyDescriptionIos") : t("pushReadyDescription")}
      actions={
        <Button color="success" size="sm" variant="flat" isDisabled={testCooldown} onPress={handleTest} startContent={<Icon icon="ph:paper-plane-tilt-duotone" />}>
          {testCooldown ? t("pushTestCooldown") : t("pushTestButton")}
        </Button>
      }
    />
  );
}

interface BannerShellProps {
  tone: BannerTone;
  title: string;
  description: string;
  actions?: React.ReactNode;
}

function BannerShell({ tone, title, description, actions }: BannerShellProps) {
  const style = TONE_STYLES[tone];
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${style.wrap}`}>
      <Icon icon={style.iconName} width={24} className={`flex-none ${style.icon}`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium leading-5">{title}</p>
        <p className="text-sm opacity-90 mt-0.5">{description}</p>
      </div>
      {actions && <div className="flex-none">{actions}</div>}
    </div>
  );
}
