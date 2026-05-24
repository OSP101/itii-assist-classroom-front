"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@heroui/button";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useI18n } from "@/hooks/useI18n";
import { adminSettingsService, type Announcement } from "@/services/admin-settings.service";
import { authService } from "@/services/auth.service";
import userNotificationService from "@/services/user-notification.service";
import { API_BASE_URL } from "@/config/api";

const DISMISSED_KEY_PREFIX = "system-announcement-dismissed";

type AnnouncementDisplayMode = "banner_top" | "fullscreen";

type VisibleAnnouncement = Announcement & {
  is_acknowledged?: boolean;
};

function getFrontendAbsoluteUrl(pathOrUrl: string): string {
  const value = String(pathOrUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/")) return value;

  const apiBase = API_BASE_URL.replace(/\/$/, "");
  const origin = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;
  return `${origin}${value}`;
}

function matchesDisplayPathRule(rule: string, pathname: string): boolean {
  const normalizedRule = String(rule || "").trim().toLowerCase();
  if (!normalizedRule || normalizedRule === "all_pages") return true;
  if (normalizedRule === "admin_pages") return pathname.startsWith("/admin");
  if (normalizedRule === "student_pages") return pathname.startsWith("/student");
  if (normalizedRule === "student_notifications") return pathname.startsWith("/student/notifications");
  if (normalizedRule === "instructor_pages") return pathname.startsWith("/classroom") || pathname.startsWith("/home");
  if (normalizedRule === "classroom_pages") return pathname.startsWith("/classroom/");
  if (normalizedRule.startsWith("/")) return pathname.startsWith(normalizedRule);
  return false;
}

function getDismissedStorageKey(userId: number): string {
  return `${DISMISSED_KEY_PREFIX}:${userId}`;
}

function getDismissedIds(userId: number): Set<number> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(getDismissedStorageKey(userId));
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0));
  } catch {
    return new Set();
  }
}

function saveDismissedIds(userId: number, ids: Set<number>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getDismissedStorageKey(userId), JSON.stringify(Array.from(ids)));
  } catch {
    // no-op
  }
}

function shouldHideAnnouncement(item: VisibleAnnouncement, dismissedIds: Set<number>): boolean {
  if (item.require_acknowledge && item.is_acknowledged) {
    return true;
  }

  if (!item.require_acknowledge && item.is_dismissible && dismissedIds.has(item.id)) {
    return true;
  }

  return false;
}

export function GlobalAnnouncementLayer() {
  const t = useI18n();
  const { language } = useGlobalSettings();
  const pathname = usePathname();
  const [announcements, setAnnouncements] = useState<VisibleAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [acknowledgingIds, setAcknowledgingIds] = useState<Set<number>>(new Set());

  const user = authService.getStoredUser();

  useEffect(() => {
    if (!user?.id) {
      setDismissedIds(new Set());
      return;
    }
    setDismissedIds(getDismissedIds(user.id));
  }, [user?.id]);

  const refreshAnnouncements = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setAnnouncements([]);
      return;
    }

    setIsLoading(true);
    try {
      const rows = await adminSettingsService.getActiveAnnouncements();
      setAnnouncements(rows);
    } catch {
      setAnnouncements([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAnnouncements();
    const timer = window.setInterval(() => {
      void refreshAnnouncements();
    }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshAnnouncements]);

  const visibleAnnouncements = useMemo(
    () => announcements.filter((item) => {
      if (shouldHideAnnouncement(item, dismissedIds)) {
        return false;
      }
      const displayPaths = item.display_paths && item.display_paths.length > 0 ? item.display_paths : ["all_pages"];
      return displayPaths.some((rule) => matchesDisplayPathRule(rule, pathname));
    }),
    [announcements, dismissedIds, pathname],
  );

  const fullscreenAnnouncement = useMemo(
    () => visibleAnnouncements.find((item) => item.display_mode === "fullscreen"),
    [visibleAnnouncements],
  );

  const bannerAnnouncements = useMemo(
    () => visibleAnnouncements.filter((item) => item.display_mode === "banner_top").slice(0, 2),
    [visibleAnnouncements],
  );

  const dismissAnnouncement = useCallback(
    (announcementId: number) => {
      if (!user?.id) return;
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(announcementId);
        saveDismissedIds(user.id, next);
        return next;
      });
    },
    [user?.id],
  );

  const handleAcknowledge = useCallback(
    async (item: VisibleAnnouncement) => {
      if (!item.id) return;
      setAcknowledgingIds((prev) => new Set([...prev, item.id]));
      const ok = await userNotificationService.acknowledgeAnnouncement(item.id);
      setAcknowledgingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });

      if (!ok) {
        addToast({
          title: t("error"),
          description: t("adminSettingsUpdateFailed"),
          color: "danger",
        });
        return;
      }

      addToast({
        title: t("success"),
        description: t("adminAnnouncementAcknowledged"),
        color: "success",
      });
      await refreshAnnouncements();
    },
    [refreshAnnouncements, t],
  );

  const renderActionButtons = (item: VisibleAnnouncement, mode: AnnouncementDisplayMode) => {
    const isAcknowledging = acknowledgingIds.has(item.id);
    const actionButtonClass = mode === "fullscreen" ? "border-white/40 text-white" : "border-default-300 text-default-700";
    const localizedActionLabel = language === "th"
      ? (item.action_label_th?.trim() || item.action_label_en?.trim() || item.action_label?.trim() || t("adminAnnouncementOpenAction"))
      : (item.action_label_en?.trim() || item.action_label_th?.trim() || item.action_label?.trim() || t("adminAnnouncementOpenAction"));

    return (
      <div className="flex flex-wrap items-center gap-2">
        {item.action_url ? (
          <Button
            as="a"
            href={getFrontendAbsoluteUrl(item.action_url)}
            target="_blank"
            rel="noopener noreferrer"
            variant={mode === "fullscreen" ? "solid" : "flat"}
            color={mode === "fullscreen" ? "primary" : "default"}
            size="sm"
          >
            {localizedActionLabel}
          </Button>
        ) : null}
        {item.require_acknowledge ? (
          <Button
            color="primary"
            variant={mode === "fullscreen" ? "solid" : "flat"}
            size="sm"
            isLoading={isAcknowledging}
            onPress={() => void handleAcknowledge(item)}
          >
            {t("adminAcknowledgeAction")}
          </Button>
        ) : null}
        {item.is_dismissible && !item.require_acknowledge ? (
          <Button
            variant={mode === "fullscreen" ? "bordered" : "light"}
            size="sm"
            className={mode === "fullscreen" ? actionButtonClass : undefined}
            onPress={() => dismissAnnouncement(item.id)}
          >
            {t("dismiss")}
          </Button>
        ) : null}
      </div>
    );
  };

  if (!user || (!isLoading && visibleAnnouncements.length === 0)) {
    return null;
  }

  const getLocalizedTitle = (item: VisibleAnnouncement) => language === "th"
    ? (item.title_th?.trim() || item.title_en?.trim() || item.title)
    : (item.title_en?.trim() || item.title_th?.trim() || item.title);

  const getLocalizedMessage = (item: VisibleAnnouncement) => language === "th"
    ? (item.message_th?.trim() || item.message_en?.trim() || item.message)
    : (item.message_en?.trim() || item.message_th?.trim() || item.message);

  return (
    <>
      {bannerAnnouncements.length > 0 && (
        <div className="mb-4 space-y-2">
          {bannerAnnouncements.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-sky-200 bg-linear-to-r from-sky-50 to-cyan-50 px-4 py-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-sky-900">{getLocalizedTitle(item)}</p>
                  {getLocalizedMessage(item) ? <p className="text-sm text-sky-800/90">{getLocalizedMessage(item)}</p> : null}
                </div>
                <Icon icon="solar:bell-bold" className="text-xl text-sky-500" />
              </div>
              {item.content_type !== "text" && item.image_url ? (
                <img
                  src={getFrontendAbsoluteUrl(item.image_url)}
                  alt={getLocalizedTitle(item)}
                  className="mt-3 h-36 w-full rounded-lg object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="mt-3">{renderActionButtons(item, "banner_top")}</div>
            </div>
          ))}
        </div>
      )}

      {fullscreenAnnouncement && (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-black/60 p-5 text-white backdrop-blur">
            <div className="space-y-3">
              <p className="text-xl font-semibold">{getLocalizedTitle(fullscreenAnnouncement)}</p>
              {getLocalizedMessage(fullscreenAnnouncement) ? <p className="text-sm text-white/90">{getLocalizedMessage(fullscreenAnnouncement)}</p> : null}
            </div>
            {fullscreenAnnouncement.content_type !== "text" && fullscreenAnnouncement.image_url ? (
              <img
                src={getFrontendAbsoluteUrl(fullscreenAnnouncement.image_url)}
                alt={getLocalizedTitle(fullscreenAnnouncement)}
                className="mt-4 max-h-[60vh] w-full rounded-xl object-contain bg-black/30"
                loading="lazy"
              />
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              {renderActionButtons(fullscreenAnnouncement, "fullscreen")}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
