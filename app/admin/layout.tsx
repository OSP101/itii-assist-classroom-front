"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import { Avatar } from "@heroui/avatar";
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSection } from "@heroui/dropdown";
import { Icon } from "@iconify/react";
import { AdminProvider, useAdmin } from "@/contexts/AdminContext";
import { AppFooter } from "@/components/Footer";
import { AuthLoadingScreen } from "@/components/ui/auth-loading-screen";
import { NetworkMetricsPanel } from "@/components/dev/network-metrics-panel";
import { useSettingsMenuItems } from "@/components/SettingsPanel";
import { useI18n } from "@/hooks/useI18n";
import { GlobalAnnouncementLayer } from "@/components/system-announcements/global-announcement-layer";

interface MenuItem {
    key: string;
    labelKey: string;
    icon: string;
    href: string;
}

const menuItems: MenuItem[] = [
    {
        key: "overview",
        labelKey: "overview",
        icon: "solar:home-2-bold",
        href: "/admin/dashboard",
    },
    {
        key: "users",
        labelKey: "users",
        icon: "solar:users-group-rounded-bold",
        href: "/admin/users",
    },
    {
        key: "students",
        labelKey: "students",
        icon: "solar:square-academic-cap-bold",
        href: "/admin/students",
    },
    {
        key: "courses",
        labelKey: "courses",
        icon: "solar:book-bookmark-bold",
        href: "/admin/courses",
    },
    {
        key: "classrooms",
        labelKey: "classrooms",
        icon: "solar:display-bold",
        href: "/admin/classrooms",
    },
    {
        key: "feedback",
        labelKey: "feedback",
        icon: "solar:chat-round-dots-bold",
        href: "/admin/feedback",
    },
    {
        key: "logs",
        labelKey: "systemLogs",
        icon: "solar:document-text-bold",
        href: "/admin/logs",
    },
    {
        key: "monitoring",
        labelKey: "monitoring",
        icon: "solar:monitor-smartphone-bold",
        href: "/admin/monitoring",
    },
    {
        key: "settings",
        labelKey: "settings",
        icon: "solar:settings-bold",
        href: "/admin/settings",
    },
];

// Page titles mapping
const pageTitles: Record<string, { titleKey: string; subtitleKey?: string }> = {
    "/admin/dashboard": { titleKey: "systemOverview", subtitleKey: "adminDashboard" },
    "/admin/users": { titleKey: "manageUsers", subtitleKey: "userManagement" },
    "/admin/students": { titleKey: "manageStudents", subtitleKey: "studentManagement" },
    "/admin/courses": { titleKey: "manageCourses", subtitleKey: "courseManagement" },
    "/admin/classrooms": { titleKey: "manageClassrooms", subtitleKey: "classroomManagement" },
    "/admin/feedback": { titleKey: "manageFeedback", subtitleKey: "feedbackIssuesAndSuggestions" },
    "/admin/logs": { titleKey: "systemLogs", subtitleKey: "systemActivityLogs" },
    "/admin/monitoring": { titleKey: "systemMonitoring", subtitleKey: "realTimeServerAndWebsiteHealth" },
    "/admin/settings": { titleKey: "systemSettings", subtitleKey: "systemSettings" },
    "/admin/courses/": { titleKey: "manageCourses", subtitleKey: "courseManagement" },
};

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const t = useI18n();
    const {
        user,
        isLoading,
        sidebarCollapsed,
        setSidebarCollapsed,
        handleLogout,
    } = useAdmin();

    // Mobile sidebar state
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [userThemeMenuItem, userLanguageMenuItem, userFontSizeMenuItem] = useSettingsMenuItems({
        menuFlyoutSide: "left",
        onOptionSelect: () => setIsUserMenuOpen(false),
    });

    const pageTitle = pageTitles[pathname];
    const pageInfo = {
        title: t(pageTitle?.titleKey || "adminPanel"),
        subtitle: pageTitle?.subtitleKey ? t(pageTitle.subtitleKey) : undefined,
    };

    const getRoleLabel = (role?: string) => {
        switch (role) {
            case "admin":
                return t("roleAdmin");
            case "instructor":
                return t("roleInstructor");
            case "ta":
                return t("roleTa");
            default:
                return role || "";
        }
    };

    // Close mobile sidebar when route changes
    useEffect(() => {
        setIsMobileSidebarOpen(false);
    }, [pathname]);

    // Prevent body scroll when mobile sidebar is open
    useEffect(() => {
        if (isMobileSidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileSidebarOpen]);

    const visibleMenuItems = menuItems;

    if (isLoading) {
        return <AuthLoadingScreen message={t("loadingUser")} />;
    }

    // Don't render content if user is not authenticated (will be redirected by AdminContext)
    if (!user && !isLoading) {
        return <AuthLoadingScreen message={t("redirectingToLogin")} />;
    }

    return (
        <div data-auth-shell="true" className="flex min-h-screen bg-background text-foreground">
            {/* Mobile Overlay */}
            {isMobileSidebarOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Desktop: fixed, Mobile: slide-in */}
            <aside
                className={`
                    fixed left-0 top-0 z-50 h-screen border-r border-divider bg-content1 
                    transition-all duration-300 ease-in-out
                    ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
                    ${isMobileSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {/* Mobile Close Button */}
                <button
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="absolute top-4 right-4 rounded-lg p-2 transition-colors hover:bg-default-100 lg:hidden"
                >
                    <Icon icon="solar:close-circle-linear" className="text-xl text-default-500" />
                </button>

                {/* Logo */}
                <div className="flex items-center h-16 border-b border-divider px-4">
                    <Link href="/admin/dashboard" className="flex items-center gap-3">
                        <Image
                            src="/images/logo-cp.png"
                            alt="ITII Assist Classroom"
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-lg object-contain shadow-lg shadow-blue-500/30 shrink-0"
                        />
                        {(!sidebarCollapsed || isMobileSidebarOpen) && (
                            <span className="text-md font-bold text-foreground">COCO LABS</span>
                        )}
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-8rem)]">
                    {visibleMenuItems.map((item) => (
                        <Tooltip key={item.key} content={t(item.labelKey)} placement="right" isDisabled={!sidebarCollapsed || isMobileSidebarOpen}>
                            <Link
                                href={item.href || '#'}
                                onClick={() => setIsMobileSidebarOpen(false)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${pathname === item.href
                                    ? 'bg-primary-50 font-medium text-primary-600 dark:bg-primary/15 dark:text-primary-400'
                                    : 'text-default-600 hover:bg-default-100 hover:text-foreground'
                                    }`}
                            >
                                <Icon icon={item.icon} className="text-lg shrink-0" />
                                {(!sidebarCollapsed || isMobileSidebarOpen) && <span>{t(item.labelKey)}</span>}
                            </Link>
                        </Tooltip>
                    ))}
                </nav>

                {/* Sidebar Footer - Hide on mobile */}
                <div className="absolute bottom-0 left-0 right-0 hidden border-t border-divider bg-content1 p-3 lg:block">
                    <Tooltip content={sidebarCollapsed ? t("expand") : t("collapse")} placement="right">
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-default-500 transition-colors hover:bg-default-100 hover:text-foreground"
                        >
                            <Icon
                                icon={sidebarCollapsed ? "solar:alt-arrow-right-linear" : "solar:alt-arrow-left-linear"}
                                className="text-lg"
                            />
                            {!sidebarCollapsed && <span className="text-sm">{t("collapseMenu")}</span>}
                        </button>
                    </Tooltip>
                </div>
            </aside>

            {/* Main Content - Responsive margin */}
            <div className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
                {/* Header */}
                <header className="sticky top-0 z-30 h-14 border-b border-divider bg-content1/95 backdrop-blur sm:h-16">
                    <div className="flex items-center justify-between h-full px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setIsMobileSidebarOpen(true)}
                                className="-ml-2 rounded-lg p-2 transition-colors hover:bg-default-100 lg:hidden"
                            >
                                <Icon icon="solar:hamburger-menu-linear" className="text-xl text-default-600" />
                            </button>
                            <div className="min-w-0">
                                <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">{pageInfo.title}</h1>
                                {pageInfo.subtitle && <p className="hidden text-xs text-default-500 sm:block">{pageInfo.subtitle}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                            {/* User Menu */}
                            <Dropdown placement="bottom-end" isOpen={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
                                <DropdownTrigger>
                                    <Avatar
                                        name={user?.full_name}
                                        size="md"
                                        className="bg-linear-to-br from-blue-400 to-indigo-500 text-white cursor-pointer"
                                    />
                                </DropdownTrigger>
                                <DropdownMenu aria-label={t("userMenu")} className="max-h-[75vh] overflow-visible"> 
                                    <DropdownSection showDivider aria-label={t("profileAndActions")}>
                                        <DropdownItem key="profile-info" className="h-14 gap-2" textValue="Profile info">
                                            <div>
                                                <p className="font-medium mr-1">{user?.full_name || undefined} <Chip color="primary" variant="bordered" size="sm">{getRoleLabel(user?.role)}</Chip></p>
                                                <p className="font-light text-xs">{user?.email || undefined}</p>
                                            </div>
                                        </DropdownItem>
                                    </DropdownSection>
                                    <DropdownItem 
                                        key="profile" 
                                        startContent={<Icon icon="solar:user-linear" />}
                                        onPress={() => router.push("/admin/profile")}
                                    >
                                        {t("profile")}
                                    </DropdownItem>
                                    {userThemeMenuItem}
                                    {userLanguageMenuItem}
                                    {userFontSizeMenuItem}
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
                        </div>
                    </div>
                </header>

                {/* Page Content - Responsive padding */}
                <main className="flex-1 p-3 sm:p-4 lg:p-6">
                    <GlobalAnnouncementLayer />
                    {children}
                </main>

                <NetworkMetricsPanel />

                <AppFooter />
            </div>
        </div>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminProvider>
            <AdminLayoutContent>{children}</AdminLayoutContent>
        </AdminProvider>
    );
}