"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Avatar } from "@heroui/avatar";
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSection } from "@heroui/dropdown";
import { Icon } from "@iconify/react";
import { IoSchool } from "react-icons/io5";
import { AdminProvider, useAdmin } from "@/contexts/AdminContext";
import { AppFooter } from "@/components/Footer";
import { NetworkMetricsPanel } from "@/components/dev/network-metrics-panel";

interface MenuItem {
    key: string;
    label: string;
    icon: string;
    href: string;
}

const menuItems: MenuItem[] = [
    {
        key: "overview",
        label: "ภาพรวม",
        icon: "solar:home-2-bold",
        href: "/admin/dashboard",
    },
    {
        key: "users",
        label: "ผู้ใช้งาน",
        icon: "solar:users-group-rounded-bold",
        href: "/admin/users",
    },
    {
        key: "students",
        label: "นักศึกษา",
        icon: "solar:square-academic-cap-bold",
        href: "/admin/students",
    },
    {
        key: "courses",
        label: "รายวิชา",
        icon: "solar:book-bookmark-bold",
        href: "/admin/courses",
    },
    {
        key: "classrooms",
        label: "ห้องเรียน",
        icon: "solar:display-bold",
        href: "/admin/classrooms",
    },
    {
        key: "feedback",
        label: "Feedback",
        icon: "solar:chat-round-dots-bold",
        href: "/admin/feedback",
    },
    {
        key: "logs",
        label: "System Logs",
        icon: "solar:document-text-bold",
        href: "/admin/logs",
    },
    {
        key: "monitoring",
        label: "Monitoring",
        icon: "solar:monitor-smartphone-bold",
        href: "/admin/monitoring",
    }
];

// Page titles mapping
const pageTitles: Record<string, { title: string; subtitle?: string }> = {
    '/admin/dashboard': { title: 'ภาพรวมระบบ', subtitle: 'Admin Dashboard' },
    '/admin/users': { title: 'จัดการผู้ใช้งาน', subtitle: 'User Management' },
    '/admin/students': { title: 'จัดการนักศึกษา', subtitle: 'Student Management' },
    '/admin/courses': { title: 'จัดการรายวิชา', subtitle: 'Course Management' },
    '/admin/classrooms': { title: 'จัดการห้องเรียน', subtitle: 'Classroom Management' },
    '/admin/feedback': { title: 'จัดการ Feedback', subtitle: 'รายงานข้อผิดพลาดและข้อเสนอแนะ' },
    '/admin/logs': { title: 'System Logs', subtitle: 'บันทึกการใช้งานระบบ' },
    '/admin/monitoring': { title: 'System Monitoring', subtitle: 'Real-time Server & Website Health' },
    '/admin/settings': { title: 'ตั้งค่าระบบ', subtitle: 'System Settings' },
    '/admin/courses/': { title: 'จัดการรายวิชา', subtitle: 'Course Management' },
};

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const {
        user,
        isLoading,
        sidebarCollapsed,
        setSidebarCollapsed,
        handleLogout,
    } = useAdmin();

    // Mobile sidebar state
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    const pageInfo = pageTitles[pathname] || { title: 'Admin Panel' };

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

    // Don't render content if user is not authenticated (will be redirected by AdminContext)
    if (!user && !isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-15 h-15 bg-gradient-to-br from-blue-400 to-indigo-500 rounded flex items-center justify-center text-white text-4xl">
                        <IoSchool />
                    </div>
                    <p className="text-xl text-slate-700">กำลังนำไปยังหน้าเข้าสู่ระบบ...</p>
                    <Spinner size="lg" color="primary" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-50">
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
                    fixed left-0 top-0 z-50 h-screen bg-white border-r border-slate-200 
                    transition-all duration-300 ease-in-out
                    ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
                    ${isMobileSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {/* Mobile Close Button */}
                <button
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100 lg:hidden"
                >
                    <Icon icon="solar:close-circle-linear" className="text-xl text-slate-500" />
                </button>

                {/* Logo */}
                <div className="flex items-center h-16 px-4 border-b border-slate-200">
                    <Link href="/admin/dashboard" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/30 flex-shrink-0">
                            <IoSchool />
                        </div>
                        {(!sidebarCollapsed || isMobileSidebarOpen) && (
                            <span className="font-bold text-slate-800 text-md">ITII Assist Classroom</span>
                        )}
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-8rem)]">
                    {menuItems.map((item) => (
                        <Tooltip key={item.key} content={item.label} placement="right" isDisabled={!sidebarCollapsed || isMobileSidebarOpen}>
                            <Link
                                href={item.href || '#'}
                                onClick={() => setIsMobileSidebarOpen(false)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${pathname === item.href
                                    ? 'bg-blue-50 text-blue-600 font-medium'
                                    : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                <Icon icon={item.icon} className="text-lg flex-shrink-0" />
                                {(!sidebarCollapsed || isMobileSidebarOpen) && <span>{item.label}</span>}
                            </Link>
                        </Tooltip>
                    ))}
                </nav>

                {/* Sidebar Footer - Hide on mobile */}
                <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200 bg-white hidden lg:block">
                    <Tooltip content={sidebarCollapsed ? "ขยาย" : "ย่อ"} placement="right">
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            <Icon
                                icon={sidebarCollapsed ? "solar:alt-arrow-right-linear" : "solar:alt-arrow-left-linear"}
                                className="text-lg"
                            />
                            {!sidebarCollapsed && <span className="text-sm">ย่อเมนู</span>}
                        </button>
                    </Tooltip>
                </div>
            </aside>

            {/* Main Content - Responsive margin */}
            <div className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
                {/* Header */}
                <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-14 sm:h-16">
                    <div className="flex items-center justify-between h-full px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setIsMobileSidebarOpen(true)}
                                className="p-2 -ml-2 rounded-lg hover:bg-slate-100 lg:hidden"
                            >
                                <Icon icon="solar:hamburger-menu-linear" className="text-xl text-slate-600" />
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-base sm:text-lg font-semibold text-slate-800 truncate">{pageInfo.title}</h1>
                                {pageInfo.subtitle && <p className="text-xs text-slate-500 hidden sm:block">{pageInfo.subtitle}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                            {/* User Menu */}
                            <Dropdown placement="bottom-end">
                                <DropdownTrigger>
                                    <Avatar
                                        name={user?.full_name}
                                        size="md"
                                        className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white cursor-pointer"
                                    />
                                </DropdownTrigger>
                                <DropdownMenu aria-label="User menu">
                                    <DropdownSection showDivider aria-label="Profile & Actions">
                                        <DropdownItem key="profile-info" className="h-14 gap-2" textValue="Profile info">
                                            <div>
                                                <p className="font-medium mr-1">{user?.full_name || undefined} <Chip color="primary" variant="bordered" size="sm">{user?.role}</Chip></p>
                                                <p className="font-light text-xs">{user?.email || undefined}</p>
                                            </div>
                                        </DropdownItem>
                                    </DropdownSection>
                                    <DropdownItem 
                                        key="profile" 
                                        startContent={<Icon icon="solar:user-linear" />}
                                        onPress={() => router.push("/admin/profile")}
                                    >
                                        โปรไฟล์
                                    </DropdownItem>
                                    <DropdownItem
                                        key="logout"
                                        color="danger"
                                        startContent={<Icon icon="solar:logout-2-linear" />}
                                        onPress={handleLogout}
                                    >
                                        ออกจากระบบ
                                    </DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        </div>
                    </div>
                </header>

                {/* Page Content - Responsive padding */}
                <main className="flex-1 p-3 sm:p-4 lg:p-6">
                    {children}
                </main>

                <NetworkMetricsPanel />

                <AppFooter userEmail={user?.email} />
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
