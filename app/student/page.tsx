"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { authService } from "@/services/auth.service";
import { courseService, type Course } from "@/services/course.service";
import { CourseCoverImage } from "@/components/course";
import { useNotification } from "@/contexts/NotificationContext";
import { queryAllPerms } from "@/lib/device-permissions";

// ─── helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): { text: string; icon: string } {
  const h = new Date().getHours();
  if (h < 5)  return { text: "ดึกแล้วนะ",      icon: "solar:moon-stars-bold" };
  if (h < 12) return { text: "อรุณสวัสดิ์",     icon: "solar:sun-fog-bold" };
  if (h < 17) return { text: "สวัสดีตอนบ่าย",  icon: "solar:sun-bold" };
  if (h < 21) return { text: "สวัสดีตอนเย็น",  icon: "solar:sunset-bold" };
  return       { text: "สวัสดีตอนกลางคืน",    icon: "solar:moon-bold" };
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "น";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const COURSE_PALETTES = [
  { bg: "bg-slate-900", ring: "ring-slate-200", text: "text-white" },
  { bg: "bg-blue-700", ring: "ring-blue-100", text: "text-white" },
  { bg: "bg-emerald-700", ring: "ring-emerald-100", text: "text-white" },
  { bg: "bg-amber-600", ring: "ring-amber-100", text: "text-white" },
  { bg: "bg-rose-700", ring: "ring-rose-100", text: "text-white" },
  { bg: "bg-indigo-700", ring: "ring-indigo-100", text: "text-white" },
] as const;

function getCourseColor(code: string) {
  let n = 0;
  for (let i = 0; i < code.length; i++) n += code.charCodeAt(i);
  return COURSE_PALETTES[n % COURSE_PALETTES.length];
}

function CourseInitialBadge({ code }: { code: string }) {
  const pal = getCourseColor(code);
  const letters = code.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || code.slice(0, 2).toUpperCase();
  return (
    <span
      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${pal.bg} text-sm font-bold ${pal.text} ring-2 ${pal.ring} shadow-sm`}
    >
      {letters}
    </span>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function StudentHomePage() {
  const user = authService.getStoredUser();
  const { unreadCount } = useNotification();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [permReady, setPermReady] = useState<{ granted: number; total: number } | null>(null);
  const [weather, setWeather] = useState<{ temp: number; city: string } | null>(null);

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

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const [wxRes, geoRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`),
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`),
          ]);
          const wxData = await wxRes.json();
          const geoData = await geoRes.json();
          const city =
            geoData.address?.city ||
            geoData.address?.town ||
            geoData.address?.village ||
            geoData.address?.county ||
            geoData.address?.state ||
            "";
          setWeather({ temp: Math.round(wxData.current_weather.temperature), city });
        } catch {
          // silently ignore
        }
      },
      () => {},
      { timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    queryAllPerms().then((statuses) => {
      const vals = Object.values(statuses);
      const total = vals.filter((s) => s !== "unsupported").length;
      const granted = vals.filter((s) => s === "granted").length;
      setPermReady({ granted, total });
    });
  }, []);

  return (
    <div className="space-y-5 pb-2">

      {/* ── Hero greeting card ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/70 bg-slate-900 p-5 shadow-lg shadow-slate-300/40 sm:p-7">

        {/* decorative circles */}
        <span className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-14 -left-8 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
        <span className="pointer-events-none absolute bottom-4 right-6 h-24 w-24 rounded-full bg-white/6 blur-xl" />

        {/* top row */}
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* avatar */}
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-sm font-bold text-white ring-2 ring-white/30 backdrop-blur-sm">
              {initials}
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-300">LabTAS</p>
              <p className="mt-0.5 text-xs font-medium text-slate-400">นักศึกษา</p>
            </div>
          </div>

          {/* notification dot */}
          <Link
            href="/student/notifications"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white backdrop-blur-sm transition active:scale-95 hover:bg-white/15"
          >
            <Icon icon="solar:bell-bold" className="text-xl" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[9px] font-bold leading-5 text-white ring-2 ring-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </div>

        {/* greeting */}
        <div className="relative mt-5">
          <div className="flex items-center gap-2">
            <Icon icon={greeting.icon} className="text-xl text-yellow-200" />
            <p className="text-sm font-medium text-slate-300">{greeting.text}</p>
          </div>
          <h2 className="mt-1 text-2xl font-bold leading-tight text-white sm:text-3xl">
            {user?.full_name ? user.full_name : "ยินดีต้อนรับ"}
          </h2>
          <p className="mt-1.5 text-sm text-slate-400">{user?.username ?? ""}</p>
        </div>

        {/* stat pills */}
        {!isLoadingCourses && (
          <div className="relative mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <Icon icon="solar:notebook-bookmark-bold" className="text-sm" />
              {courses.length} วิชา
            </span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <Icon icon="solar:bell-bold" className="text-sm" />
                {unreadCount} แจ้งเตือนใหม่
              </span>
            )}
            {weather && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <Icon icon="solar:temperature-bold" className="text-sm" />
                {weather.city ? `${weather.city} · ` : ""}{weather.temp}°C
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── QR scan hero button ──────────────────────────────────────────── */}
      <Link
        href="/student/scan"
        className="group relative flex items-center gap-4 overflow-hidden rounded-4xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70 transition active:scale-[0.98] sm:gap-5 sm:p-6"
      >
        {/* pulsing glow */}
        <span className="absolute -left-4 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full bg-slate-100 blur-2xl" />

        {/* icon block */}
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 ring-1 ring-slate-900/10 transition-transform group-hover:scale-105 group-active:scale-95 sm:h-18 sm:w-18">
          <Icon icon="solar:qr-code-bold-duotone" className="text-4xl text-white sm:text-5xl" />
          {/* tiny scanner line animation */}
          <span className="scan-line pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-white/60" />
        </span>

        <div className="relative flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">แตะเพื่อเริ่ม</p>
          <p className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl">สแกน QR ทันที</p>
          <p className="mt-0.5 text-sm text-slate-500">เช็กชื่อ · จองคิว</p>
        </div>

        <Icon icon="solar:arrow-right-bold" className="relative text-2xl text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-500" />
      </Link>

      {/* ── Quick shortcuts ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { href: "/student/courses",       icon: "solar:notebook-bookmark-bold",  label: "รายวิชา",     sub: `${courses.length} วิชา`,   color: "bg-blue-50 text-blue-700 border-blue-100" },
          { href: "/student/notifications", icon: "solar:bell-bold",               label: "แจ้งเตือน",   sub: unreadCount > 0 ? `${unreadCount} ใหม่` : "ไม่มีใหม่", color: "bg-rose-50 text-rose-700 border-rose-100" },
          { href: "/student/scan",          icon: "solar:camera-bold",             label: "สแกนกล้อง",   sub: "เปิดกล้อง",   color: "bg-violet-50 text-violet-700 border-violet-100" },
          { href: "/student/profile",       icon: "solar:user-circle-bold",        label: "บัญชีของฉัน", sub: user?.username ?? "โปรไฟล์", color: "bg-slate-50 text-slate-700 border-slate-200" },
        ] as const).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col gap-2 rounded-[1.75rem] border p-4 transition active:scale-[0.97] hover:shadow-sm ${item.color}`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70">
              <Icon icon={item.icon} className="text-xl" />
            </span>
            <div>
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-0.5 text-xs opacity-60">{item.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Device permission check ─────────────────────────────────────── */}
      <Link
        href="/device-check"
        className="group flex items-center gap-4 rounded-[1.75rem] border border-slate-200/80 bg-white/90 px-5 py-4 shadow-sm shadow-slate-100 transition hover:border-slate-300 hover:shadow-slate-200/60 active:scale-[0.98]"
      >
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl transition group-hover:bg-slate-100 group-hover:text-slate-700 ${
          permReady && permReady.granted === permReady.total
            ? "bg-emerald-100 text-emerald-600"
            : permReady && permReady.granted === 0
            ? "bg-rose-100 text-rose-600"
            : "bg-slate-100 text-slate-600"
        }`}>
          <Icon icon="solar:shield-check-bold-duotone" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">เช็กสิทธิ์เครื่อง</p>
          <p className="mt-0.5 text-xs text-slate-400">ตรวจสอบกล้อง · ตำแหน่ง · แผนที่</p>
        </div>
        {permReady ? (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            permReady.granted === permReady.total
              ? "bg-emerald-100 text-emerald-700"
              : permReady.granted === 0
              ? "bg-rose-100 text-rose-700"
              : "bg-amber-100 text-amber-700"
          }`}>
            {permReady.granted}/{permReady.total}
          </span>
        ) : (
          <Icon icon="solar:arrow-right-bold" className="text-base text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-500" />
        )}
      </Link>

      {/* ── Course section ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <h3 className="text-base font-bold text-slate-900">รายวิชาของฉัน</h3>
            <p className="text-xs text-slate-400">แตะเพื่อเข้าดูรายละเอียด</p>
          </div>
          {!isLoadingCourses && courses.length > 0 && (
            <Link href="/student/courses" className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:underline">
              ดูทั้งหมด <Icon icon="solar:arrow-right-bold" className="text-sm" />
            </Link>
          )}
        </div>

        {isLoadingCourses ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-4 rounded-[1.75rem] border border-slate-100 bg-white/80 p-4">
                <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 rounded-full bg-slate-200" />
                  <div className="h-4 w-2/3 rounded-full bg-slate-200" />
                  <div className="h-3 w-1/2 rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : courseError ? (
          <div className="flex items-start gap-4 rounded-[1.75rem] border border-amber-200 bg-amber-50/80 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
              <Icon icon="solar:danger-triangle-bold" className="text-xl text-amber-600" />
            </span>
            <div>
              <p className="font-semibold text-amber-900">ดึงรายวิชาไม่ได้</p>
              <p className="mt-0.5 text-sm text-amber-700/80">{courseError}</p>
            </div>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[1.75rem] border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <Icon icon="solar:notebook-bookmark-bold" className="text-2xl text-slate-400" />
            </span>
            <div>
              <p className="font-semibold text-slate-700">ยังไม่มีรายวิชา</p>
              <p className="mt-1 text-sm text-slate-400">ยังไม่พบรายวิชาที่ลงทะเบียนสำหรับบัญชีนี้</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/student/courses/${course.id}`}
                className="group flex items-center gap-4 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-sm shadow-slate-100 transition hover:border-slate-300 hover:shadow-slate-200/60 active:scale-[0.985]"
              >
                {course.image ? (
                  <CourseCoverImage
                    src={course.image}
                    alt={course.name}
                    positionX={course.cover_position_x}
                    positionY={course.cover_position_y}
                    zoom={course.cover_zoom}
                    className="h-12 w-12 shrink-0 rounded-2xl ring-2 ring-slate-100"
                  />
                ) : (
                  <CourseInitialBadge code={course.code} />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{course.code}</p>
                    {!course.is_active && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">ปิดแล้ว</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{course.name}</p>
                  {course.instructor && (
                    <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-400">
                      <Icon icon="solar:user-bold" className="shrink-0 text-xs" />
                      <span className="truncate">{course.instructor.full_name ?? course.instructor.email}</span>
                    </p>
                  )}
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Icon icon="solar:calendar-bold" className="text-xs" />
                      เทอม {course.semester}/{String(course.year).slice(-2)}
                    </span>
                    {course.my_section_no && (
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:bookmark-bold" className="text-xs" />
                        Sec {course.my_section_no}
                      </span>
                    )}
                  </div>
                </div>

                <Icon
                  icon="solar:arrow-right-bold"
                  className="shrink-0 text-lg text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500"
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        @keyframes scan-move {
          0%   { top: 20%; }
          50%  { top: 75%; }
          100% { top: 20%; }
        }
        .scan-line {
          animation: scan-move 2.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
