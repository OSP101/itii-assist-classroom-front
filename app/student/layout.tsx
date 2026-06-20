"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Spinner } from "@heroui/spinner";
import { Icon } from "@iconify/react";
import { useNotification } from "@/contexts/NotificationContext";
import type { User } from "@/services/auth.service";
import { authService } from "@/services/auth.service";
import { getDefaultRouteForRole, isStudentRole } from "@/lib/auth-routing";
import { buildStudentLoginHref, getCurrentAppPath } from "@/lib/auth-resume";
import { GlobalAnnouncementLayer } from "@/components/system-announcements/global-announcement-layer";

const navItems = [
  { href: "/student",               label: "หน้าหลัก", icon: "solar:home-2-bold",         activeIcon: "solar:home-2-bold" },
  { href: "/student/courses",       label: "รายวิชา",  icon: "solar:notebook-bookmark-linear", activeIcon: "solar:notebook-bookmark-bold" },
  { href: "/student/scan",          label: "สแกน",    icon: "solar:qr-code-linear",        activeIcon: "solar:qr-code-bold" },
  { href: "/student/notifications", label: "แจ้งเตือน", icon: "solar:bell-linear",          activeIcon: "solar:bell-bold" },
  { href: "/student/profile",       label: "บัญชี",   icon: "solar:user-circle-linear",    activeIcon: "solar:user-circle-bold" },
] as const;

const NAV_ROOTS = new Set(["/student", "/student/courses", "/student/scan", "/student/notifications", "/student/profile"]);

function resolveTitle(pathname: string): string {
  if (pathname.startsWith("/student/notifications")) return "การแจ้งเตือน";
  if (pathname.startsWith("/student/scan"))           return "สแกน QR";
  if (pathname.startsWith("/student/profile"))        return "บัญชีของฉัน";
  if (pathname.startsWith("/student/courses/"))       return "รายวิชา";
  if (pathname === "/student/courses")                return "รายวิชาของฉัน";
  return "ห้องเรียนของฉัน";
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isStudentLoginPage = pathname === "/student/login";
  const { unreadCount } = useNotification();

  // Lazy initialisers — run only on the client, so back-navigation skips the spinner
  // when the user is already known from localStorage.
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined" || isStudentLoginPage) return null;
    return authService.getStoredUser();
  });
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined" || isStudentLoginPage) return false;
    return !authService.isAuthenticated() || !authService.getStoredUser();
  });
  const title = useMemo(() => resolveTitle(pathname), [pathname]);

  useEffect(() => {
    if (isStudentLoginPage) {
      return;
    }

    const checkAuth = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.replace(buildStudentLoginHref(getCurrentAppPath()));
          return;
        }

        // If we already showed cached user, verify silently in background
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) {
          router.replace(buildStudentLoginHref(getCurrentAppPath()));
          return;
        }

        if (!isStudentRole(currentUser.role)) {
          router.replace(getDefaultRouteForRole(currentUser.role));
          return;
        }

        setUser(currentUser);
      } catch (error) {
        console.error("Student auth check failed:", error);
        router.replace(buildStudentLoginHref(getCurrentAppPath()));
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [isStudentLoginPage, router]);

  if (isStudentLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="app-mobile-screen flex items-center justify-center bg-[#f5f7fb]">
        <div className="flex flex-col items-center gap-4 rounded-4xl border border-slate-200/80 bg-white px-8 py-10 shadow-sm shadow-slate-200/70">
          <Spinner size="lg" color="primary" />
          <div className="text-center">
            <p className="text-base font-semibold text-slate-800">กำลังเตรียมพื้นที่นักศึกษา</p>
            <p className="text-sm text-slate-500">กรุณารอสักครู่</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-mobile-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden app-safe-x">
        <GlobalAnnouncementLayer />

        {/* ── Back header (deep pages only) ──────────────────────────── */}
        {!NAV_ROOTS.has(pathname) && (
          <header className="sticky top-0 z-20 flex items-center justify-between gap-2 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:px-6 lg:px-8">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-200 backdrop-blur border border-slate-200/70 transition active:scale-95 hover:bg-white"
            >
              <Icon icon="solar:arrow-left-bold" className="text-base" />
              ย้อนกลับ
            </button>
            <Link
              href="/student"
              className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-200/70 backdrop-blur transition active:scale-95 hover:bg-slate-50"
            >
              <Icon icon="solar:home-2-bold" className="text-base" />
              หน้าหลัก
            </Link>
          </header>
        )}

        <main className={`app-mobile-scroll flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+7.5rem)] sm:px-6 lg:px-8 ${NAV_ROOTS.has(pathname) ? "pt-[calc(env(safe-area-inset-top)+1rem)]" : "pt-0"}`}>{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 app-safe-x">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end gap-1 rounded-4xl border border-slate-200/80 bg-white/95 px-2 py-2 shadow-[0_-10px_32px_rgba(15,23,42,0.08)] backdrop-blur">
          {navItems.map((item) => {
            const isActive = item.href === "/student"
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const isScan = item.href === "/student/scan";
            const isNotif = item.href === "/student/notifications";

            if (isScan) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-end gap-1 pb-0.5"
                >
                  <span className={`-mt-8 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white shadow-md transition-transform active:scale-95 ${isActive ? "bg-slate-900 text-white" : "bg-slate-800 text-white"}`}>
                    <Icon icon={item.icon} className="text-[26px] text-white" />
                  </span>
                  <span className={`text-[10px] font-semibold ${isActive ? "text-slate-900" : "text-slate-500"}`}>{item.label}</span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2 transition-all active:scale-95 ${isActive ? "text-slate-900" : "text-slate-400 hover:text-slate-600"}`}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-2xl bg-slate-100" />
                )}
                <span className="relative flex h-7 w-7 items-center justify-center">
                  <Icon icon={isActive ? item.activeIcon : item.icon} className="text-xl" />
                  {isNotif && unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-500 px-0.5 text-center text-[9px] font-bold leading-4 text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </span>
                <span className="relative text-[10px] font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
