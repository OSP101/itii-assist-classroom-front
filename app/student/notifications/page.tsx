"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";

import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useNotification } from "@/contexts/NotificationContext";
import { useI18n } from "@/hooks/useI18n";
import { getNotificationHeadline, getNotificationMessage } from "@/lib/notification-display";
import { resolveStudentNotificationLink } from "@/lib/student-notification-links";
import { notifStyleFor } from "@/lib/student-notification-style";
import userNotificationService, { type UserNotificationItem } from "@/services/user-notification.service";

function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

function getAcknowledgeInfo(notification: UserNotificationItem): { announcementId: number | null; required: boolean } {
  const data = notification.data;
  if (!data || typeof data !== "object") {
    return { announcementId: null, required: false };
  }

  const rawId = (data as Record<string, unknown>).announcement_id;
  const rawRequired = (data as Record<string, unknown>).require_acknowledge;

  const announcementId = typeof rawId === "number"
    ? rawId
    : typeof rawId === "string"
      ? Number(rawId)
      : NaN;
  const required = rawRequired === true || rawRequired === "true";

  if (!Number.isFinite(announcementId) || announcementId <= 0) {
    return { announcementId: null, required };
  }

  return { announcementId, required };
}

type FilterTab = "all" | "unread" | "read";

const FILTERS: Array<{ key: FilterTab; label: string }> = [
  { key: "all", label: "ทั้งหมด" },
  { key: "unread", label: "ยังไม่อ่าน" },
  { key: "read", label: "อ่านแล้ว" },
];

export default function StudentNotificationsPage() {
  const router = useRouter();
  const { language } = useGlobalSettings();
  const t = useI18n();
  const {
    notifications,
    unreadCount,
    isInboxLoading,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearReadNotifications,
  } = useNotification();

  const [filter, setFilter] = useState<FilterTab>("all");
  const [acknowledgingIds, setAcknowledgingIds] = useState<Set<number>>(new Set());

  // Run once on mount — refreshNotifications reference changes across renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void refreshNotifications(); }, []);

  const [unreadItems, readItems] = useMemo(() => {
    const unread = notifications.filter((item) => !item.is_read);
    const read = notifications.filter((item) => item.is_read);
    return [unread, read] as const;
  }, [notifications]);

  const visibleItems = useMemo(() => {
    if (filter === "unread") return unreadItems;
    if (filter === "read") return readItems;
    return notifications;
  }, [filter, notifications, unreadItems, readItems]);

  const handleOpen = async (notificationId: number, href: string | null) => {
    await markNotificationRead(notificationId);
    if (href) router.push(href);
  };

  const handleAcknowledge = async (notificationId: number, announcementId: number) => {
    setAcknowledgingIds((prev) => new Set([...prev, notificationId]));
    await markNotificationRead(notificationId);
    const ok = await userNotificationService.acknowledgeAnnouncement(announcementId);
    setAcknowledgingIds((prev) => {
      const next = new Set(prev);
      next.delete(notificationId);
      return next;
    });

    if (!ok) {
      addToast({ title: t("error"), description: t("adminSettingsUpdateFailed"), color: "danger" });
      return;
    }

    addToast({ title: t("success"), description: t("adminAnnouncementAcknowledged"), color: "success" });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="cg-page-title">แจ้งเตือน</h1>
        {unreadCount > 0 && (
          <button type="button" className="cg-link pb-1" onClick={() => void markAllNotificationsRead()}>
            <Icon icon="solar:check-read-linear" width={14} height={14} />
            อ่านทั้งหมด
          </button>
        )}
      </div>

      <div className="cg-pill-row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="cg-pill"
            data-active={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key === "unread" && unreadItems.length > 0 ? ` (${unreadItems.length})` : ""}
          </button>
        ))}
      </div>

      {isInboxLoading ? (
        <div className="cg-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="cg-row animate-pulse">
              <div className="h-9 w-9 shrink-0 rounded-xl" style={{ background: "var(--cg-fill-strong)" }} />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 rounded-full" style={{ background: "var(--cg-fill-strong)" }} />
                <div className="h-2.5 w-full rounded-full" style={{ background: "var(--cg-fill)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="cg-list">
          <div className="cg-empty">
            <Icon icon="solar:bell-off-linear" width={27} height={27} />
            <b className="text-[13px] font-medium" style={{ color: "var(--cg-text-2)" }}>ไม่มีการแจ้งเตือน</b>
            <span className="text-[11.5px] font-light">
              {filter === "all"
                ? "เมื่อมีคะแนน การเช็กชื่อ คิว หรือประกาศ จะแสดงที่หน้านี้"
                : "ไม่พบรายการตามตัวกรองที่เลือก"}
            </span>
          </div>
        </div>
      ) : (
        <div className="cg-list">
          {visibleItems.map((notification) => {
            const href = resolveStudentNotificationLink(notification);
            const style = notifStyleFor(notification.type);
            const isUnread = !notification.is_read;
            const ackInfo = getAcknowledgeInfo(notification);
            const showAcknowledge = ackInfo.required && isUnread && ackInfo.announcementId !== null;
            const isAcking = acknowledgingIds.has(notification.id);

            return (
              <button
                key={notification.id}
                type="button"
                className="cg-row items-start"
                onClick={() => void handleOpen(notification.id, href)}
              >
                <span className="cg-row-ico mt-0.5" style={{ background: style.bg, color: style.fg }}>
                  <Icon icon={style.icon} width={17} height={17} />
                </span>
                <span className="cg-row-body">
                  <span className="cg-row-title" style={isUnread ? undefined : { fontWeight: 400, color: "var(--cg-text-2)" }}>
                    {getNotificationHeadline(notification, language, t)}
                  </span>
                  <span className="cg-row-sub line-clamp-2">{getNotificationMessage(notification, language, t)}</span>
                  <span className="cg-row-sub" style={{ color: "var(--cg-text-3)" }}>
                    {formatRelativeTime(notification.created_at)}
                  </span>

                  {showAcknowledge && (
                    <span
                      role="button"
                      tabIndex={0}
                      className="cg-badge cg-badge-success mt-2"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (ackInfo.announcementId !== null) {
                          void handleAcknowledge(notification.id, ackInfo.announcementId);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        event.stopPropagation();
                        if (ackInfo.announcementId !== null) {
                          void handleAcknowledge(notification.id, ackInfo.announcementId);
                        }
                      }}
                    >
                      {isAcking ? t("loading") : t("adminAcknowledgeAction")}
                    </span>
                  )}
                </span>
                {isUnread && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 self-start rounded-full" style={{ background: "var(--cg-accent)" }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {readItems.length > 0 && (
        <button type="button" className="cg-link self-center" style={{ color: "var(--cg-text-2)" }} onClick={() => void clearReadNotifications()}>
          <Icon icon="solar:trash-bin-trash-linear" width={14} height={14} />
          ล้างที่อ่านแล้ว
        </button>
      )}
    </div>
  );
}
