"use client";

import { useCallback, useEffect, useMemo, useState, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Skeleton } from "@heroui/skeleton";
import { Avatar } from "@heroui/avatar";
import { Chip } from "@heroui/chip";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSection } from "@heroui/dropdown";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { Icon } from "@iconify/react";
import { authService } from "@/services/auth.service";
import { Course } from "@/services/course.service";
import { useAllCourses, useCourse, useMyCourses } from "@/lib/swr";
import { useNotification } from "@/contexts/NotificationContext";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useSettingsMenuItems } from "@/components/SettingsPanel";
import { AuthLoadingScreen } from "@/components/ui/auth-loading-screen";
import { useI18n } from "@/hooks/useI18n";
import { getNotificationHeadline, getNotificationMessage } from "@/lib/notification-display";
import Link from "next/link";
import { IoSchool } from "react-icons/io5";
import { AppFooter } from "@/components/Footer";
import { GlobalAnnouncementLayer } from "@/components/system-announcements/global-announcement-layer";
import type { UserNotificationItem } from "@/services/user-notification.service";

interface User {
    id: number;
    username: string;
    full_name: string;
    email: string;
    role: string;
    avatar?: string | null;
}

// Module-level so the object identity is stable across renders. SWR hashes
// array keys structurally, so a fresh object each render would still resolve to
// the same cache entry — this just removes the question entirely.
const ACTIVE_COURSE_LIST_PARAMS = { status: "active", limit: 10 } as const;

interface CourseInfo {
    id: string;
    code: string;
    name: string;
    year: number;
    semester: number;
}

// Context for sharing user data
interface InstructorContextType {
    user: User | null;
    activeCourses: Course[];
    courseInfo: CourseInfo | null;
    setCourseInfo: (info: CourseInfo | null) => void;
    refreshCourses: () => void;
}

const InstructorContext = createContext<InstructorContextType | null>(null);

export const useInstructor = () => {
    const context = useContext(InstructorContext);
    if (!context) {
        throw new Error("useInstructor must be used within InstructorProvider");
    }
    return context;
};

export default function InstructorLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { language } = useGlobalSettings();
    const t = useI18n();
    const allowedInstructorRoles = ["admin", "instructor", "ta"];
    // Lazy initialisers — run only on the client, so a page reload with a still-valid
    // cached session skips the loading/redirect flash entirely.
    const [user, setUser] = useState<User | null>(() => {
        if (typeof window === "undefined") return null;
        const cached = authService.getStoredUser();
        return cached && allowedInstructorRoles.includes(cached.role) ? (cached as unknown as User) : null;
    });
    const [isLoading, setIsLoading] = useState(() => {
        if (typeof window === "undefined") return true;
        const cached = authService.getStoredUser();
        return !authService.isAuthenticated() || !cached || !allowedInstructorRoles.includes(cached.role);
    });
    const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifTab, setNotifTab] = useState<"all" | "unread">("all");
    const [notifShowAll, setNotifShowAll] = useState(false);
    const [isBreadcrumbUserMenuOpen, setIsBreadcrumbUserMenuOpen] = useState(false);
    const [hasOpenedCourseMenu, setHasOpenedCourseMenu] = useState(false);
    const [isAvatarUserMenuOpen, setIsAvatarUserMenuOpen] = useState(false);
    const [breadcrumbThemeMenuItem, breadcrumbLanguageMenuItem, breadcrumbFontSizeMenuItem] = useSettingsMenuItems({
        menuFlyoutSide: "right",
        onOptionSelect: () => setIsBreadcrumbUserMenuOpen(false),
    });
    const [avatarThemeMenuItem, avatarLanguageMenuItem, avatarFontSizeMenuItem] = useSettingsMenuItems({
        menuFlyoutSide: "left",
        onOptionSelect: () => setIsAvatarUserMenuOpen(false),
    });
    const {
        notifications,
        isInboxLoading,
        markNotificationRead,
        markAllNotificationsRead,
        clearReadNotifications,
    } = useNotification();

    const formatRelativeTime = (isoDate: string) => {
        const ts = new Date(isoDate).getTime();
        if (!ts) return t("justNow");
        const diffMs = Date.now() - ts;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return t("justNow");
        if (diffMin < 60) {
            if (language === "th") {
                return `${diffMin} ${t("minutesAgo")}`;
            }
            return `${diffMin} ${diffMin === 1 ? t("minuteAgo") : t("minutesAgo")}`;
        }
        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) {
            if (language === "th") {
                return `${diffHour} ${t("hoursAgo")}`;
            }
            return `${diffHour} ${diffHour === 1 ? t("hourAgo") : t("hoursAgo")}`;
        }
        const diffDay = Math.floor(diffHour / 24);
        if (language === "th") {
            return `${diffDay} ${t("daysAgo")}`;
        }
        return `${diffDay} ${diffDay === 1 ? t("dayAgo") : t("daysAgo")}`;
    };

    const getCourseLabel = (courseId?: string) => {
        if (!courseId) return t("courseUnspecified");
        const fromList = activeCourses.find((c) => String(c.id) === String(courseId));
        if (fromList) {
            return `${fromList.code} - ${fromList.name}`;
        }
        if (courseInfo && String(courseInfo.id) === String(courseId)) {
            return `${courseInfo.code} - ${courseInfo.name}`;
        }
        return `${t("courseLabel")} ${courseId}`;
    };

    const resolveNotificationLink = (notification: any): string | null => {
        const rawLink = notification?.link ? String(notification.link) : "";
        const courseId = notification?.course_id ? String(notification.course_id) : "";

        if (!rawLink && courseId) {
            const fallbackByType: Record<string, string> = {
                assignment_created: "assignments",
                assignment_updated: "assignments",
                attendance_created: "attendance",
                attendance_started: "attendance",
                attendance_opened: "attendance",
                attendance_closed: "attendance",
                queue_created: "queue",
                queue_updated: "queue",
                queue_opened: "queue",
                queue_closed: "queue",
                score_edit_request: "approval",
                score_edit_approved: "approval",
                score_edit_rejected: "approval",
            };
            const tab = fallbackByType[String(notification?.type || "")] || "overview";
            return `/classroom/${courseId}/${tab}`;
        }

        if (!rawLink) return null;

        try {
            const url = new URL(rawLink, typeof window !== "undefined" ? window.location.origin : "http://localhost");
            const path = url.pathname || "";
            const tabQuery = (url.searchParams.get("tab") || "").trim();

            const match = path.match(/^\/classroom\/([^\/]+)\/?$/);
            if (match && tabQuery) {
                const tabAliases: Record<string, string> = {
                    "score-requests": "approval",
                };
                const normalizedTab = tabAliases[tabQuery] || tabQuery;
                return `/classroom/${match[1]}/${normalizedTab}`;
            }

            if (tabQuery && path.includes("/classroom/")) {
                const tabAliases: Record<string, string> = {
                    "score-requests": "approval",
                };
                const normalizedTab = tabAliases[tabQuery] || tabQuery;
                const cleaned = path.replace(/\/+$/, "");
                return `${cleaned}/${normalizedTab}`;
            }

            return `${path}${url.search}${url.hash}`;
        } catch {
            return rawLink;
        }
    };

    const isNotificationVisibleInInstructorShell = (notification: UserNotificationItem) => {
        if (notification.type === "support_ticket") {
            return false;
        }

        const rawLink = notification?.link ? String(notification.link) : "";
        if (!rawLink) {
            return true;
        }

        try {
            const url = new URL(rawLink, typeof window !== "undefined" ? window.location.origin : "http://localhost");
            return !url.pathname.startsWith("/admin/");
        } catch {
            return !rawLink.startsWith("/admin/");
        }
    };

    const visibleNotifications = useMemo(
        () => notifications.filter(isNotificationVisibleInInstructorShell),
        [notifications]
    );
    const visibleUnreadCount = useMemo(
        () => visibleNotifications.filter((n) => !n.is_read).length,
        [visibleNotifications]
    );

    // Extract course ID from pathname
    const courseId = pathname.includes("/classroom/")
        ? pathname.split("/classroom/")[1]?.split("/")[0]
        : null;

    // Check auth once
    useEffect(() => {
        const checkAuth = async () => {
            try {
                if (!authService.isAuthenticated()) {
                    router.push("/login");
                    return;
                }

                // If we already showed a cached user (see lazy initialiser above),
                // verify silently in the background instead of blocking on it.
                const userData = await authService.getCurrentUser();
                if (userData) {
                    if (allowedInstructorRoles.includes(userData.role)) {
                        setUser(userData as unknown as User);
                    } else {
                        router.push("/login");
                    }
                    return;
                }

                // /auth/me failed. If it was a transient network error, tokens are
                // still intact and we can fall back to the cached user. But if the
                // failure was an expired/invalid session, api.service's 401 handler
                // already tried to refresh and, on failure, cleared accessToken,
                // refreshToken AND the cached user from localStorage — re-read
                // everything fresh here (don't reuse a variable captured before the
                // await) so we don't resurrect a session that was just invalidated.
                if (authService.isAuthenticated()) {
                    const cachedUser = authService.getStoredUser();
                    if (cachedUser && allowedInstructorRoles.includes(cachedUser.role)) {
                        setUser(cachedUser as unknown as User);
                        return;
                    }
                }

                router.push("/login");
            } catch (error) {
                console.error("Auth check failed:", error);
                const cachedUser = authService.getStoredUser();
                if (cachedUser && allowedInstructorRoles.includes(cachedUser.role)) {
                    setUser(cachedUser as unknown as User);
                } else {
                    router.push("/login");
                }
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, [router]);

    // Active courses for the sidebar dropdown.
    //
    // This lives in the layout, so before caching every navigation into a
    // different instructor page could re-issue it. Through SWR it is served
    // from cache and revalidated in the background instead.
    //
    // Admins see every active course, everyone else sees only their own — two
    // different endpoints, so only the applicable one is enabled and the other
    // holds a null key rather than firing.
    const isAdmin = user?.role === "admin";

    // The active-courses list only backs the "switch course" dropdown below,
    // so it's fetched lazily the first time that dropdown opens rather than
    // on every instructor page load — visiting a classroom page never opens
    // it, and the breadcrumb already has its own lightweight fallback
    // (needsCourseFetch / useCourse below) for the single course being
    // viewed, so nothing here blocks on this list loading.
    const {
        data: adminCourses,
        isLoading: isAdminCoursesLoading,
        mutate: refreshAdminCourses,
    } = useAllCourses(ACTIVE_COURSE_LIST_PARAMS, Boolean(user) && isAdmin && hasOpenedCourseMenu);

    const {
        data: myCourses,
        isLoading: isMyCoursesLoading,
        mutate: refreshMyCourses,
    } = useMyCourses(ACTIVE_COURSE_LIST_PARAMS, Boolean(user) && !isAdmin && hasOpenedCourseMenu);

    const activeCourses: Course[] = useMemo(
        () => (isAdmin ? adminCourses?.courses : myCourses?.courses) ?? [],
        [isAdmin, adminCourses, myCourses],
    );
    const isCoursesLoading = isAdmin ? isAdminCoursesLoading : isMyCoursesLoading;

    const refreshCourses = useCallback(async () => {
        await (isAdmin ? refreshAdminCourses() : refreshMyCourses());
    }, [isAdmin, refreshAdminCourses, refreshMyCourses]);

    // The breadcrumb course is usually already in the list above, so only fetch
    // it separately when it is not — a course opened from a direct link, or one
    // outside the first 10 active courses.
    const courseInList = useMemo(
        () => activeCourses.find((course) => course.id === courseId) ?? null,
        [activeCourses, courseId],
    );
    const needsCourseFetch = Boolean(courseId) && !courseInList;
    const { data: fetchedCourse, isLoading: isFetchedCourseLoading } = useCourse(
        needsCourseFetch ? courseId : null,
    );

    const isCourseInfoLoading = needsCourseFetch && isFetchedCourseLoading;

    // courseInfo stays a state value because setCourseInfo is handed to child
    // pages through context — they override the breadcrumb with a freshly saved
    // name before the cache has caught up.
    useEffect(() => {
        if (!courseId) {
            setCourseInfo(null);
            return;
        }

        const source = courseInList ?? fetchedCourse;
        if (!source) return;

        setCourseInfo({
            id: source.id,
            code: source.code,
            name: source.name,
            year: source.year,
            semester: source.semester,
        });
    }, [courseId, courseInList, fetchedCourse]);

    const handleLogout = async () => {
        try {
            await authService.logout();
            router.push("/login");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case "admin":
                return t("roleAdmin");
            case "instructor":
                return t("roleInstructor");
            case "ta":
                return t("roleTa");
            default:
                return role;
        }
    };

    const getBackPath = () => {
        switch (user?.role) {
            case "admin":
                return "/admin/courses";
            case "instructor":
                return "/home";
            case "ta":
                return "/home";
            default:
                return "/";
        }
    };

    // Determine current page for breadcrumb
    const isHomePage = pathname === "/home/closed" || pathname === "/home";
    const isClassroomPage = pathname.includes("/classroom/");

    if (isLoading) {
        return <AuthLoadingScreen message={t("loadingUser")} />;
    }

    // Don't render content if user is not authenticated (will be redirected by useEffect)
    if (!user && !isLoading) {
        return <AuthLoadingScreen message={t("redirectingToLogin")} />;
    }

    return (
        <InstructorContext.Provider value={{
            user,
            activeCourses,
            courseInfo,
            setCourseInfo,
            refreshCourses
        }}>
            <div data-auth-shell="true" className="flex min-h-screen flex-col bg-background text-foreground">
                {/* Top Navigation Bar - Shared Header */}
                <header className="sticky top-0 z-50 border-b border-divider bg-content1">
                    <div className="flex items-center justify-between h-12 px-4">
                        {/* Left: Breadcrumb Navigation */}
                        <div className="flex min-w-0 items-center gap-1 text-sm overflow-x-auto">
                            {/* Home Icon */}
                            <Link
                                href={getBackPath()}
                                className="relative z-30 flex shrink-0 items-center gap-2 rounded-md px-2 py-1 text-default-600 transition-colors hover:bg-content2 hover:text-foreground"
                            >
                                <div className="w-6 h-6 bg-linear-to-br from-blue-400 to-indigo-500 rounded flex items-center justify-center text-white text-xs">
                                    <IoSchool />
                                </div>
                            </Link>

                            {/* Separator */}
                            <Icon icon="solar:alt-arrow-right-linear" className="shrink-0 text-lg text-default-400" />

                            {/* เมนูบาร์ ผู้ใช้ */}
                            <Dropdown
                                isOpen={isBreadcrumbUserMenuOpen}
                                onOpenChange={(isOpen) => {
                                    setIsBreadcrumbUserMenuOpen(isOpen);
                                    if (isOpen) setHasOpenedCourseMenu(true);
                                }}
                            >
                                <DropdownTrigger>
                                    <button type="button" className="relative z-10 flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-default-700 transition-colors hover:bg-content2">
                                        <Skeleton isLoaded={Boolean(user)} className="rounded-md">
                                            <span className="font-medium max-w-37.5 truncate">{user?.full_name || t("loadingUser")}</span>
                                        </Skeleton>
                                        <Skeleton isLoaded={Boolean(user)} className="rounded-full">
                                            <Chip size="sm" variant="flat" color="success" className="h-5 text-[10px]">
                                                {getRoleLabel(user?.role || "")}
                                            </Chip>
                                        </Skeleton>
                                        <Icon icon="solar:alt-arrow-down-linear" className="text-sm text-default-400" />
                                    </button>
                                </DropdownTrigger>
                                <DropdownMenu aria-label={t("userMenu")} className="overflow-visible">
                                    <DropdownSection title={t("activeCourses")} showDivider>
                                        {isCoursesLoading ? (
                                            [0, 1, 2].map((item) => (
                                                <DropdownItem key={`course-skeleton-${item}`} isReadOnly textValue="Loading course">
                                                    <div className="flex items-center gap-3 py-1">
                                                        <Skeleton className="w-5 h-5 rounded bg-blue-100" />
                                                        <div className="space-y-1.5 flex-1">
                                                            <Skeleton className="w-40 h-4 rounded" />
                                                            <Skeleton className="w-16 h-3 rounded" />
                                                        </div>
                                                    </div>
                                                </DropdownItem>
                                            ))
                                        ) : activeCourses.length > 0 ? (
                                            activeCourses.map((course) => (
                                                <DropdownItem
                                                    key={course.id}
                                                    startContent={<Icon icon="solar:book-2-linear" className={course.id === courseId ? "text-primary" : "text-blue-500"} />}
                                                    description={`${course.year}/${course.semester}`}
                                                    onPress={() => router.push(`/classroom/${course.id}`)}
                                                    className={course.id === courseId ? "bg-primary/10" : ""}
                                                >
                                                    <span className="truncate block max-w-[180px]">{course.code} - {course.name}</span>
                                                </DropdownItem>
                                            ))
                                        ) : (
                                            <DropdownItem key="no-courses" isReadOnly className="text-default-400">
                                                {t("noActiveCourses")}
                                            </DropdownItem>
                                        )}
                                    </DropdownSection>
                                    <DropdownSection>
                                        <DropdownItem
                                            key="back"
                                            startContent={<Icon icon="solar:widget-2-linear" />}
                                            onPress={() => router.push(getBackPath())}
                                        >
                                            {user?.role === "admin" ? t("goToCourseManagement") : t("viewAllCourses")}
                                        </DropdownItem>
                                        <DropdownItem
                                            key="profile"
                                            startContent={<Icon icon="solar:user-linear" />}
                                            onPress={() => router.push("/profile?tab=personal")}
                                        >
                                            {t("profileSettings")}
                                        </DropdownItem>
                                    </DropdownSection>
                                    {breadcrumbThemeMenuItem}
                                    {breadcrumbLanguageMenuItem}
                                    {breadcrumbFontSizeMenuItem}
                                    <DropdownItem
                                        key="logout"
                                        color="danger"
                                        startContent={<Icon icon="solar:logout-2-linear" />}
                                        onPress={handleLogout}
                                    >
                                        {t("logout")}
                                    </DropdownItem>
                                </DropdownMenu>
                            </Dropdown>

                            {/* Separator */}
                            <Icon icon="solar:alt-arrow-right-linear" className="shrink-0 text-lg text-default-400" />

                            {/* Current Page / Course Info */}
                            {isHomePage && (
                                <div className="flex items-center gap-1.5 px-2 py-1 text-default-700">
                                    <span className="font-medium">{t("myCourses")}</span>
                                </div>
                            )}

                            {isClassroomPage && (isCourseInfoLoading || !courseInfo) && (
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Skeleton className="w-16 h-5 rounded-lg" />
                                    <Skeleton className="hidden sm:block w-36 h-5 rounded-lg" />
                                    <Skeleton className="h-5 w-16 rounded-full bg-primary/10" />
                                </div>
                            )}

                            {isClassroomPage && !isCourseInfoLoading && courseInfo && (
                                <div className="flex items-center gap-1.5 px-2 py-1 text-default-700">
                                    <span className="font-medium">{courseInfo.code}</span>
                                    <span className="max-w-50 truncate">{courseInfo.name}</span>
                                    <Chip size="sm" variant="flat" color="primary" className="h-5 text-[10px]">
                                        {courseInfo.year}/{courseInfo.semester}
                                    </Chip>
                                </div>
                            )}
                        </div>

                        {/* Right: User Avatar */}
                        <div className="flex items-center gap-2 shrink-0">
                            <Popover
                                isOpen={isNotifOpen}
                                onOpenChange={(isOpen) => {
                                    setIsNotifOpen(isOpen);
                                    if (!isOpen) {
                                        setNotifTab("all");
                                        setNotifShowAll(false);
                                    }
                                }}
                                placement="bottom-end"
                            >
                                <PopoverTrigger>
                                    <button
                                        type="button"
                                        className="relative rounded-full p-1.5 transition-colors hover:bg-content2"
                                        aria-label={t("notifications")}
                                    >
                                        <Icon icon="solar:bell-linear" className="text-xl text-default-600" />
                                        {visibleUnreadCount > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center leading-none">
                                                {visibleUnreadCount > 99 ? "99+" : visibleUnreadCount}
                                            </span>
                                        )}
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="overflow-hidden border border-default-200 bg-content1 p-0 shadow-xl shadow-black/10">
                                    {(() => {
                                        const filtered = notifTab === "unread"
                                            ? visibleNotifications.filter((n) => !n.is_read)
                                            : visibleNotifications;
                                        const unreadItems = filtered.filter((n) => !n.is_read);
                                        const readItems = filtered.filter((n) => n.is_read);
                                        const INITIAL_LIMIT = 5;
                                        const visibleUnread = notifShowAll ? unreadItems : unreadItems.slice(0, INITIAL_LIMIT);
                                        const remainingSlots = notifShowAll ? readItems.length : Math.max(0, INITIAL_LIMIT - unreadItems.length);
                                        const visibleRead = notifShowAll ? readItems : readItems.slice(0, remainingSlots);
                                        const hasMore = !notifShowAll && (unreadItems.length > INITIAL_LIMIT || (unreadItems.length <= INITIAL_LIMIT && readItems.length > remainingSlots));

                                        const NotifItem = ({ notification }: { notification: typeof notifications[0] }) => (
                                            <button
                                                key={`notif-${notification.id}`}
                                                type="button"
                                                onClick={() => {
                                                    markNotificationRead(notification.id);
                                                    const targetLink = resolveNotificationLink(notification);
                                                    if (targetLink) {
                                                        setIsNotifOpen(false);
                                                        router.push(targetLink);
                                                    }
                                                }}
                                                className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-all ${notification.is_read ? "bg-content1 hover:bg-content2" : "border-l-4 border-primary bg-primary/10 hover:bg-primary/15"}`}
                                            >
                                                <div className="shrink-0 w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                                                    <Icon
                                                        icon={
                                                            notification.type === "assignment_created" ? "solar:document-add-bold" :
                                                            notification.type === "assignment_updated" ? "solar:document-text-bold" :
                                                            notification.type === "attendance_created" ? "solar:calendar-add-bold" :
                                                            notification.type === "score_edit_request" ? "solar:pen-new-round-bold" :
                                                            notification.type === "score_edit_approved" ? "solar:check-circle-bold" :
                                                            notification.type === "score_edit_rejected" ? "solar:close-circle-bold" :
                                                            "solar:bell-bing-bold"
                                                        }
                                                        className={`text-base ${notification.is_read ? "text-default-400" : "text-primary-500"}`}
                                                    />
                                                </div>
                                                <div className={`flex-1 min-w-0 ${notification.is_read ? "opacity-80" : "opacity-100"}`}>
                                                    <p className={`text-xs leading-snug truncate ${notification.is_read ? "text-default-500" : "text-primary-600 font-medium"}`}>
                                                        {t("courseLabel")}: {getCourseLabel(notification.course_id)}
                                                    </p>
                                                    <p className={`mt-0.5 line-clamp-2 text-sm leading-snug ${notification.is_read ? "text-default-600 font-normal" : "text-foreground font-medium"}`}>
                                                        {getNotificationHeadline(notification, language, t)}
                                                    </p>
                                                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-default-500">
                                                        {getNotificationMessage(notification, language, t)}
                                                    </p>
                                                    <p className={`mt-0.5 text-[11px] ${notification.is_read ? "text-default-400" : "text-primary-500 font-medium"}`}>
                                                        {formatRelativeTime(notification.created_at)}
                                                    </p>
                                                </div>
                                                {!notification.is_read && (
                                                    <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-blue-500 mt-2" />
                                                )}
                                            </button>
                                        );

                                        return (
                                            <div className="w-90">
                                                {/* Header */}
                                                <div className="px-4 pt-3 pb-2">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <p className="text-lg font-bold text-foreground">{t("notifications")}</p>
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={markAllNotificationsRead}
                                                                className="text-[11px] text-blue-500 hover:text-blue-700 font-medium"
                                                            >
                                                                {t("markAllRead")}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setNotifTab("unread")}
                                                                className="text-[11px] text-blue-500 hover:text-blue-700 font-medium"
                                                            >
                                                                {t("unread")} {visibleUnreadCount > 0 ? `(${visibleUnreadCount})` : ""}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={clearReadNotifications}
                                                                className="text-[11px] font-medium text-default-500 hover:text-foreground"
                                                            >
                                                                {t("clearRead")}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {/* Tabs */}
                                                    <div className="flex gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => { setNotifTab("all"); setNotifShowAll(false); }}
                                                            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${notifTab === "all" ? "bg-primary/10 text-primary-600" : "text-default-600 hover:bg-content2"}`}
                                                        >
                                                            {t("all")}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setNotifTab("unread"); setNotifShowAll(false); }}
                                                            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${notifTab === "unread" ? "bg-primary/10 text-primary-600" : "text-default-600 hover:bg-content2"}`}
                                                        >
                                                            {t("unread")}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* List */}
                                                <div className="max-h-110 overflow-y-auto">
                                                    {isInboxLoading && (
                                                        <div className="py-6 text-center text-sm text-default-500">{t("loading")}</div>
                                                    )}
                                                    {!isInboxLoading && filtered.length === 0 && (
                                                        <div className="py-8 text-center text-sm text-default-400">
                                                            <Icon icon="solar:bell-off-linear" className="mx-auto mb-2 text-3xl text-default-300" />
                                                            {notifTab === "unread" ? t("noUnreadNotifications") : t("noNotifications")}
                                                        </div>
                                                    )}
                                                    {!isInboxLoading && visibleUnread.length > 0 && (
                                                        <>
                                                            <p className="px-4 py-1.5 text-[11px] font-bold text-blue-600 uppercase tracking-wide">{t("unread")}</p>
                                                            {visibleUnread.map((n) => <NotifItem key={n.id} notification={n} />)}
                                                        </>
                                                    )}
                                                    {!isInboxLoading && visibleRead.length > 0 && (
                                                        <>
                                                            <p className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-default-500">{t("read")}</p>
                                                            {visibleRead.map((n) => <NotifItem key={n.id} notification={n} />)}
                                                        </>
                                                    )}
                                                    {!isInboxLoading && hasMore && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setNotifShowAll(true)}
                                                            className="w-full border-t border-divider py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-content2"
                                                        >
                                                            {t("earlierNotifications")}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </PopoverContent>
                            </Popover>

                            <Dropdown placement="bottom-end" isOpen={isAvatarUserMenuOpen} onOpenChange={setIsAvatarUserMenuOpen}>
                                <DropdownTrigger>
                                    <button type="button" className="p-0.5 rounded-full hover:ring-2 hover:ring-blue-200 transition-all">
                                        <Avatar
                                            name={user?.full_name}
                                            size="md"
                                            src={user?.avatar || undefined}
                                            className="w-7 h-7 bg-linear-to-br from-blue-400 to-indigo-500"
                                        />
                                    </button>
                                </DropdownTrigger>
                                <DropdownMenu aria-label={t("userMenu")} className="max-h-[75vh] overflow-visible">
                                    <DropdownItem
                                        key="profile-info"
                                        className="h-14 gap-2"
                                        textValue="Profile"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <p className="font-medium text-foreground">{user?.full_name}</p>
                                                <p className="text-xs text-default-500">{user?.email}</p>
                                            </div>
                                        </div>
                                    </DropdownItem>
                                    <DropdownItem
                                        key="settings"
                                        startContent={<Icon icon="solar:settings-linear" className="text-lg" />}
                                        onPress={() => router.push("/profile?tab=personal")}
                                    >
                                        {t("profileSettings")}
                                    </DropdownItem>
                                    {avatarThemeMenuItem}
                                    {avatarLanguageMenuItem}
                                    {avatarFontSizeMenuItem}
                                    <DropdownItem
                                        key="logout"
                                        color="danger"
                                        startContent={<Icon icon="solar:logout-2-linear" className="text-lg" />}
                                        onPress={handleLogout}
                                    >
                                        {t("logout")}
                                    </DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className={`w-full flex-1 ${isHomePage ? "max-w-7xl mx-auto px-4 py-6" : ""}`}>
                    {!pathname.startsWith("/classroom/") && <GlobalAnnouncementLayer />}
                    {children}
                </main>

                <AppFooter userEmail={user?.email} />
            </div>
        </InstructorContext.Provider>
    );
}
