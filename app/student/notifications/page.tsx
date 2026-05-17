"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";

import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useNotification } from "@/contexts/NotificationContext";
import { useI18n } from "@/hooks/useI18n";
import { getNotificationHeadline, getNotificationMessage } from "@/lib/notification-display";
import { resolveStudentNotificationLink } from "@/lib/student-notification-links";

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

const NOTIF_ICON_MAP: Record<string, { icon: string; bg: string; color: string }> = {
  score:       { icon: "solar:diploma-bold-duotone",      bg: "bg-sky-50",     color: "text-sky-600"    },
  queue:       { icon: "solar:users-group-two-rounded-bold-duotone", bg: "bg-violet-50", color: "text-violet-600" },
  attendance:  { icon: "solar:calendar-mark-bold-duotone", bg: "bg-emerald-50", color: "text-emerald-600" },
  bonus:       { icon: "solar:star-bold-duotone",          bg: "bg-amber-50",   color: "text-amber-600"  },
  announcement:{ icon: "solar:megaphone-bold-duotone",     bg: "bg-rose-50",    color: "text-rose-600"   },
  default:     { icon: "solar:bell-bing-bold-duotone",     bg: "bg-slate-100",  color: "text-slate-600"  },
};

function getNotifStyle(type: string | undefined) {
  const key = Object.keys(NOTIF_ICON_MAP).find((k) => type?.toLowerCase().includes(k));
  return NOTIF_ICON_MAP[key ?? "default"];
}

type FilterTab = "all" | "unread" | "read";

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

  return (
    <div className="space-y-4 pb-2">
      {/* Header strip */}
      <div className="relative overflow-hidden rounded-4xl bg-linear-to-br from-sky-600 via-sky-500 to-cyan-400 p-5 shadow-lg shadow-sky-300/30">
        <span className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-100/70">การแจ้งเตือน</p>
            <h2 className="mt-0.5 text-xl font-bold text-white">อัปเดตล่าสุด</h2>
          </div>
          {unreadCount > 0 && (
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500 text-sm font-bold text-white shadow-md">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        {/* action row */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => void markAllNotificationsRead()}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/25 active:scale-95"
          >
            <Icon icon="solar:check-read-bold" className="text-sm" />
            อ่านทั้งหมด
          </button>
          <button
            onClick={() => void clearReadNotifications()}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
          >
            <Icon icon="solar:trash-bin-trash-bold" className="text-sm" />
            ล้างที่อ่านแล้ว
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 rounded-3xl border border-slate-100 bg-white/80 p-1.5 shadow-sm">
        {(["all", "unread", "read"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 rounded-2xl py-2 text-sm font-semibold transition ${filter === tab ? "bg-sky-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {tab === "all" ? "ทั้งหมด" : tab === "unread" ? (
              <span className="flex items-center justify-center gap-1.5">
                ยังไม่อ่าน
                {unreadItems.length > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white leading-none">
                    {unreadItems.length > 99 ? "99+" : unreadItems.length}
                  </span>
                )}
              </span>
            ) : "อ่านแล้ว"}
          </button>
        ))}
      </div>

      {/* Content */}
      {isInboxLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex animate-pulse items-start gap-4 rounded-4xl border border-slate-100 bg-white/80 p-4">
              <div className="h-11 w-11 shrink-0 rounded-2xl bg-slate-100" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-16 rounded-full bg-slate-200" />
                <div className="h-4 w-3/4 rounded-full bg-slate-200" />
                <div className="h-3 w-1/2 rounded-full bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-4xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100">
            <Icon icon="solar:bell-off-bold-duotone" className="text-3xl text-slate-400" />
          </span>
          <div>
            <p className="font-semibold text-slate-700">ไม่มีการแจ้งเตือน</p>
            <p className="mt-1 text-sm text-slate-400">เมื่อมีคะแนน เช็กชื่อ คิว หรือประกาศ จะแสดงที่หน้านี้</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((notification) => {
            const href = resolveStudentNotificationLink(notification);
            const style = getNotifStyle(notification.type);
            const isUnread = !notification.is_read;
            return (
              <button
                key={notification.id}
                onClick={() => void handleOpen(notification.id, href)}
                className={`group flex w-full items-start gap-4 rounded-4xl border p-4 text-left transition active:scale-[0.985] ${
                  isUnread
                    ? "border-sky-100 bg-sky-50/60 hover:bg-sky-50"
                    : "border-slate-100/80 bg-white/80 hover:border-sky-50 hover:bg-white"
                }`}
              >
                {/* icon */}
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.bg}`}>
                  <Icon icon={style.icon} className={`text-xl ${style.color}`} />
                </span>

                {/* body */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-[11px] font-semibold uppercase tracking-wide ${isUnread ? "text-sky-600" : "text-slate-400"}`}>
                      {notification.course_id ? `วิชา ${notification.course_id}` : "ทั่วไป"}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] text-slate-400">{formatRelativeTime(notification.created_at)}</span>
                      {isUnread && <span className="h-2 w-2 rounded-full bg-sky-500" />}
                    </div>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {getNotificationHeadline(notification, language, t)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm leading-5 text-slate-500">
                    {getNotificationMessage(notification, language, t)}
                  </p>
                  {href && (
                    <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-sky-600">
                      เปิดดู <Icon icon="solar:arrow-right-bold" className="text-xs" />
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
