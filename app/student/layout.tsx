"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  { href: "/student",               label: "หน้าหลัก", icon: "solar:home-2-linear",          activeIcon: "solar:home-2-bold" },
  { href: "/student/courses",       label: "รายวิชา",  icon: "solar:notebook-bookmark-linear", activeIcon: "solar:notebook-bookmark-bold" },
  { href: "/student/scan",          label: "สแกน",    icon: "solar:qr-code-linear",          activeIcon: "solar:qr-code-bold" },
  { href: "/student/notifications", label: "แจ้งเตือน", icon: "solar:bell-linear",            activeIcon: "solar:bell-bold" },
  { href: "/student/profile",       label: "บัญชี",   icon: "solar:user-circle-linear",      activeIcon: "solar:user-circle-bold" },
] as const;

// A pushed screen keeps its parent tab lit, so the student never loses their
// place in the app while they are one level deep.
const NAV_PARENT: Record<string, string> = {
  "/student/courses/": "/student/courses",
  "/student/device-check": "/student/profile",
};

function resolveActiveTab(pathname: string): string {
  for (const [prefix, parent] of Object.entries(NAV_PARENT)) {
    if (pathname.startsWith(prefix)) return parent;
  }
  if (pathname === "/student") return "/student";
  const match = navItems.find((item) => item.href !== "/student" && pathname.startsWith(item.href));
  return match?.href ?? "";
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isStudentLoginPage = pathname === "/student/login";
  const { unreadCount } = useNotification();

  // Lazy initialisers — run only on the client, so back-navigation skips the spinner
  // when the user is already known from localStorage.
  const [, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined" || isStudentLoginPage) return null;
    return authService.getStoredUser();
  });
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined" || isStudentLoginPage) return false;
    return !authService.isAuthenticated() || !authService.getStoredUser();
  });

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
          // Server call failed. If it was a transient network error, tokens are
          // still intact and we can fall back to the cached user. But if the
          // failure was an expired/invalid session, api.service's 401 handler
          // already tried to refresh and, on failure, cleared accessToken,
          // refreshToken AND the cached user from localStorage — re-read
          // everything fresh here (don't reuse a variable captured before the
          // await) so we don't resurrect a session that was just invalidated.
          if (authService.isAuthenticated()) {
            const cachedUser = authService.getStoredUser();
            if (cachedUser) {
              setUser(cachedUser);
              return;
            }
          }
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
        const cachedUser = authService.getStoredUser();
        if (cachedUser) {
          setUser(cachedUser);
        } else {
          router.replace(buildStudentLoginHref(getCurrentAppPath()));
        }
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
      <div data-theme-scope="student" className="cg-scope app-mobile-screen flex items-center justify-center">
        <div className="cg-card flex flex-col items-center gap-4 px-8 py-10">
          <Spinner size="lg" color="primary" />
          <div className="text-center">
            <p className="text-base font-medium">กำลังเตรียมพื้นที่นักศึกษา</p>
            <p className="mt-1 text-sm" style={{ color: "var(--cg-text-2)" }}>กรุณารอสักครู่</p>
          </div>
        </div>
      </div>
    );
  }

  const activeTab = resolveActiveTab(pathname);

  return (
    <div data-theme-scope="student" className="cg-scope app-mobile-screen">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden app-safe-x">
        <GlobalAnnouncementLayer />
        <main className="app-mobile-scroll cg-scroll flex-1 px-4">{children}</main>
      </div>

      <nav className="cg-tabbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.href;
          const isNotif = item.href === "/student/notifications";

          return (
            <Link
              key={item.href}
              href={item.href}
              className="cg-tab"
              data-active={isActive}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="cg-tab-ico">
                <Icon icon={isActive ? item.activeIcon : item.icon} width={21} height={21} />
                {isNotif && unreadCount > 0 && (
                  <span className="cg-tab-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
