"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { authService } from "@/services/auth.service";
import { courseService, type Course } from "@/services/course.service";
import { CourseThumb } from "@/components/course";
import { useNotification } from "@/contexts/NotificationContext";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useI18n } from "@/hooks/useI18n";
import { getNotificationHeadline, getNotificationMessage } from "@/lib/notification-display";
import { resolveStudentNotificationLink } from "@/lib/student-notification-links";
import { notifStyleFor } from "@/lib/student-notification-style";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "สวัสดียามดึก";
  if (h < 12) return "อรุณสวัสดิ์";
  if (h < 17) return "สวัสดีตอนบ่าย";
  if (h < 21) return "สวัสดีตอนเย็น";
  return "สวัสดีตอนกลางคืน";
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "นศ";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[1][0];
}

/** First name only — the header is a greeting, not an identity document. */
function firstName(name: string | undefined | null): string {
  if (!name) return "ยินดีต้อนรับ";
  return name.trim().split(/\s+/)[0];
}

export default function StudentHomePage() {
  const router = useRouter();
  const t = useI18n();
  const { language } = useGlobalSettings();
  const user = authService.getStoredUser();
  const { unreadCount, notifications, refreshNotifications, markNotificationRead } = useNotification();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [courseError, setCourseError] = useState<string | null>(null);

  const greeting = useMemo(() => getGreeting(), []);
  const initials = useMemo(() => getInitials(user?.full_name), [user?.full_name]);

  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoadingCourses(true);
      setCourseError(null);
      try {
        const response = await courseService.getMyCourses({ status: "active", limit: 20, sortBy: "created_at", sortOrder: "DESC" });
        if (!response.success || !response.data) throw new Error(response.message || "ไม่สามารถโหลดรายวิชาได้");
        setCourses(response.data.courses || []);
      } catch (error) {
        console.error("Failed to load student courses:", error);
        setCourseError("ยังไม่สามารถดึงรายวิชาได้ในขณะนี้");
      } finally {
        setIsLoadingCourses(false);
      }
    };
    fetchCourses();
  }, []);

  // Run once on mount — refreshNotifications changes identity across renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void refreshNotifications(); }, []);

  const previewNotifs = useMemo(() => {
    const unread = notifications.filter((n) => !n.is_read);
    return (unread.length > 0 ? unread : notifications).slice(0, 2);
  }, [notifications]);

  const openNotification = async (id: number, href: string | null) => {
    await markNotificationRead(id);
    if (href) router.push(href);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── greeting ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3" style={{ paddingTop: "calc(var(--app-safe-top) + 22px)" }}>
        <Link
          href="/student/profile"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-medium"
          style={{ background: "var(--cg-accent-soft)", color: "var(--cg-accent-strong)" }}
          aria-label="บัญชีของฉัน"
        >
          {initials}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-light leading-snug" style={{ color: "var(--cg-text-2)" }}>{greeting}</p>
          <h1 className="mt-0.5 truncate text-[22px] font-semibold leading-snug">{firstName(user?.full_name)}</h1>
        </div>
        <Link
          href="/student/notifications"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--cg-fill)" }}
          aria-label="การแจ้งเตือน"
        >
          <Icon icon="solar:bell-linear" width={19} height={19} />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex min-w-[17px] items-center justify-center rounded-full px-1 text-[9.5px] font-medium text-white"
              style={{ background: "var(--cg-danger)", border: "2px solid var(--cg-bg)", height: 17 }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
      </div>

      {/* ── primary action ────────────────────────────────────────── */}
      <Link href="/student/scan" className="cg-cta">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.28)" }}
        >
          <Icon icon="solar:qr-code-bold" width={22} height={22} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-[15px] font-medium leading-snug">สแกนเข้าเรียน</strong>
          <span className="mt-0.5 block text-xs font-light leading-relaxed opacity-90">เช็กชื่อ หรือจองคิว ด้วย QR หรือ PIN</span>
        </span>
        <Icon icon="solar:alt-arrow-right-linear" width={16} height={16} className="shrink-0 opacity-80" />
      </Link>

      {/* ── my courses ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="cg-section-label">รายวิชาของฉัน</p>
          {!isLoadingCourses && courses.length > 0 && (
            <Link href="/student/courses" className="cg-link">
              ดูทั้งหมด <Icon icon="solar:alt-arrow-right-linear" width={14} height={14} />
            </Link>
          )}
        </div>

        {isLoadingCourses ? (
          <div className="cg-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="cg-row animate-pulse">
                <div className="h-11 w-11 shrink-0 rounded-xl" style={{ background: "var(--cg-fill-strong)" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 rounded-full" style={{ background: "var(--cg-fill-strong)" }} />
                  <div className="h-2.5 w-1/2 rounded-full" style={{ background: "var(--cg-fill)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : courseError ? (
          <div className="cg-list">
            <div className="cg-row">
              <span className="cg-row-ico" style={{ background: "var(--cg-warning-soft)", color: "var(--cg-warning)" }}>
                <Icon icon="solar:danger-triangle-linear" width={17} height={17} />
              </span>
              <span className="cg-row-body">
                <span className="cg-row-title">ดึงรายวิชาไม่ได้</span>
                <span className="cg-row-sub">{courseError}</span>
              </span>
            </div>
          </div>
        ) : courses.length === 0 ? (
          <div className="cg-list">
            <div className="cg-empty">
              <Icon icon="solar:notebook-bookmark-linear" width={27} height={27} />
              <b className="text-[13px] font-medium" style={{ color: "var(--cg-text-2)" }}>ยังไม่มีรายวิชา</b>
              <span className="text-[11.5px] font-light">ยังไม่พบรายวิชาที่ลงทะเบียนสำหรับบัญชีนี้</span>
            </div>
          </div>
        ) : (
          <div className="cg-list">
            {courses.slice(0, 3).map((course) => (
              <Link key={course.id} href={`/student/courses/${course.id}`} className="cg-row">
                <CourseThumb
                  code={course.code}
                  name={course.name}
                  image={course.image}
                  positionX={course.cover_position_x}
                  positionY={course.cover_position_y}
                  zoom={course.cover_zoom}
                  muted={!course.is_active}
                />
                <span className="cg-row-body">
                  <span className="cg-row-title truncate">{course.name}</span>
                  <span className="cg-row-sub truncate">
                    {course.code} {course.instructor?.full_name ?? course.instructor?.email ?? ""}
                  </span>
                </span>
                <Icon icon="solar:alt-arrow-right-linear" className="cg-chevron" width={15} height={15} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── latest announcements ──────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="cg-section-label">ประกาศล่าสุด</p>
          <Link href="/student/notifications" className="cg-link">
            ทั้งหมด <Icon icon="solar:alt-arrow-right-linear" width={14} height={14} />
          </Link>
        </div>

        <div className="cg-list">
          {previewNotifs.length === 0 ? (
            <div className="cg-empty">
              <Icon icon="solar:bell-off-linear" width={27} height={27} />
              <b className="text-[13px] font-medium" style={{ color: "var(--cg-text-2)" }}>ยังไม่มีประกาศ</b>
            </div>
          ) : (
            previewNotifs.map((n) => {
              const style = notifStyleFor(n.type);
              const href = resolveStudentNotificationLink(n);
              return (
                <button key={n.id} className="cg-row" onClick={() => void openNotification(n.id, href)}>
                  <span className="cg-row-ico" style={{ background: style.bg, color: style.fg }}>
                    <Icon icon={style.icon} width={17} height={17} />
                  </span>
                  <span className="cg-row-body">
                    <span className="cg-row-title" style={n.is_read ? { fontWeight: 400, color: "var(--cg-text-2)" } : undefined}>
                      {getNotificationHeadline(n, language, t)}
                    </span>
                    <span className="cg-row-sub line-clamp-2">{getNotificationMessage(n, language, t)}</span>
                  </span>
                  {!n.is_read && (
                    <span className="mt-1 h-2 w-2 shrink-0 self-start rounded-full" style={{ background: "var(--cg-accent)" }} />
                  )}
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* ── device permissions ────────────────────────────────────── */}
      <Link href="/student/device-check" className="cg-list">
        <span className="cg-row">
          <span className="cg-row-ico">
            <Icon icon="solar:shield-check-linear" width={17} height={17} />
          </span>
          <span className="cg-row-body">
            <span className="cg-row-title">สิทธิ์เครื่อง</span>
            <span className="cg-row-sub">กล้อง ตำแหน่ง และการแจ้งเตือน</span>
          </span>
          <Icon icon="solar:alt-arrow-right-linear" className="cg-chevron" width={15} height={15} />
        </span>
      </Link>
    </div>
  );
}
