"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Skeleton } from "@heroui/skeleton";
import { Avatar } from "@heroui/avatar";
import { Chip } from "@heroui/chip";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSection } from "@heroui/dropdown";
import { Icon } from "@iconify/react";
import { authService } from "@/services/auth.service";
import { courseService, Course } from "@/services/course.service";
import Link from "next/link";
import { IoSchool } from "react-icons/io5";
import { AppFooter } from "@/components/Footer";

interface User {
    id: number;
    username: string;
    full_name: string;
    email: string;
    role: string;
    avatar?: string | null;
}

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
    const [user, setUser] = useState<User | null>(() => authService.getStoredUser() as User | null);
    const [isLoading, setIsLoading] = useState(true);
    const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
    const [activeCourses, setActiveCourses] = useState<Course[]>([]);
    const [isCoursesLoading, setIsCoursesLoading] = useState(false);
    const [isCourseInfoLoading, setIsCourseInfoLoading] = useState(false);

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

                const userData = await authService.getCurrentUser();
                if (userData) {
                    const allowedRoles = ["admin", "instructor", "ta"];
                    if (allowedRoles.includes(userData.role)) {
                        setUser(userData);
                    } else {
                        router.push("/login");
                    }
                } else {
                    router.push("/login");
                }
            } catch (error) {
                console.error("Auth check failed:", error);
                router.push("/login");
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, [router]);

    // Fetch active courses once when user is set
    const fetchActiveCourses = async () => {
        if (!user) return;
        setIsCoursesLoading(true);
        try {
            if (user.role === "admin") {
                const response = await courseService.getCourses({ status: "active", limit: 10 });
                if (response.success && response.data) {
                    setActiveCourses(response.data.courses);
                }
            } else {
                const response = await courseService.getMyCourses({ status: "active", limit: 10 });
                if (response.success && response.data) {
                    setActiveCourses(response.data.courses);
                }
            }
        } catch (error) {
            console.error("Failed to fetch active courses:", error);
        } finally {
            setIsCoursesLoading(false);
        }
    };

    useEffect(() => {
        fetchActiveCourses();
    }, [user]);

    // Fetch course info when courseId changes
    useEffect(() => {
        const fetchCourseInfo = async () => {
            if (courseId) {
                setIsCourseInfoLoading(true);
                // Check if we already have this course in activeCourses
                const existingCourse = activeCourses.find(c => c.id === courseId);
                if (existingCourse) {
                    setCourseInfo({
                        id: existingCourse.id,
                        code: existingCourse.code,
                        name: existingCourse.name,
                        year: existingCourse.year,
                        semester: existingCourse.semester,
                    });
                } else {
                    try {
                        const response = await courseService.getCourseById(courseId);
                        if (response.success && response.data) {
                            setCourseInfo({
                                id: response.data.id,
                                code: response.data.code,
                                name: response.data.name,
                                year: response.data.year,
                                semester: response.data.semester,
                            });
                        }
                    } catch (error) {
                        console.error("Failed to fetch course info:", error);
                    }
                }
                setIsCourseInfoLoading(false);
            } else {
                setCourseInfo(null);
                setIsCourseInfoLoading(false);
            }
        };
        fetchCourseInfo();
    }, [courseId, activeCourses]);

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
                return "ผู้ดูแลระบบ";
            case "instructor":
                return "อาจารย์";
            case "ta":
                return "ผู้ช่วยสอน";
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

    // Don't render content if user is not authenticated (will be redirected by useEffect)
    if (!user && !isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-15 h-15 bg-gradient-to-br from-blue-400 to-indigo-500 rounded flex items-center justify-center text-white text-4xl">
                        <IoSchool />
                    </div>
                    <p className="text-xl text-slate-700">กำลังนำไปยังหน้าเข้าสู่ระบบ...</p>
                        <Skeleton className="h-2 w-40 rounded-full bg-blue-100" />
                </div>
            </div>
        );
    }

    return (
        <InstructorContext.Provider value={{
            user,
            activeCourses,
            courseInfo,
            setCourseInfo,
            refreshCourses: fetchActiveCourses
        }}>
            <div className="min-h-screen bg-slate-50 flex flex-col">
                {/* Top Navigation Bar - Shared Header */}
                <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
                    <div className="flex items-center justify-between h-12 px-4">
                        {/* Left: Breadcrumb Navigation */}
                        <div className="flex min-w-0 items-center gap-1 text-sm overflow-x-auto">
                            {/* Home Icon */}
                            <Link
                                href={getBackPath()}
                                className="relative z-30 shrink-0 flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900"
                            >
                                <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-indigo-500 rounded flex items-center justify-center text-white text-xs">
                                    <IoSchool />
                                </div>
                            </Link>

                            {/* Separator */}
                            <Icon icon="solar:alt-arrow-right-linear" className="text-slate-400 text-lg flex-shrink-0" />

                            {/* เมนูบาร์ ผู้ใช้ */}
                            <Dropdown>
                                <DropdownTrigger>
                                    <button type="button" className="relative z-10 shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors text-slate-700">
                                        <Skeleton isLoaded={Boolean(user)} className="rounded-md">
                                            <span className="font-medium max-w-[150px] truncate">{user?.full_name || "กำลังโหลดผู้ใช้"}</span>
                                        </Skeleton>
                                        <Skeleton isLoaded={Boolean(user)} className="rounded-full">
                                            <Chip size="sm" variant="flat" className="bg-emerald-50 text-emerald-600 h-5 text-[10px]">
                                                {getRoleLabel(user?.role || "")}
                                            </Chip>
                                        </Skeleton>
                                        <Icon icon="solar:alt-arrow-down-linear" className="text-slate-400 text-sm" />
                                    </button>
                                </DropdownTrigger>
                                <DropdownMenu aria-label="User actions" className="max-h-80 overflow-y-auto">
                                    <DropdownSection title="รายวิชาที่กำลังสอน" showDivider>
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
                                                    className={course.id === courseId ? "bg-primary-50" : ""}
                                                >
                                                    {course.code} - {course.name}
                                                </DropdownItem>
                                            ))
                                        ) : (
                                            <DropdownItem key="no-courses" isReadOnly className="text-slate-400">
                                                ไม่มีรายวิชาที่เปิดใช้งาน
                                            </DropdownItem>
                                        )}
                                    </DropdownSection>
                                    <DropdownSection>
                                        <DropdownItem
                                            key="back"
                                            startContent={<Icon icon="solar:widget-2-linear" />}
                                            onPress={() => router.push(getBackPath())}
                                        >
                                            {user?.role === "admin" ? "ไปหน้าจัดการรายวิชา" : "ดูรายวิชาทั้งหมด"}
                                        </DropdownItem>
                                        <DropdownItem
                                            key="profile"
                                            startContent={<Icon icon="solar:user-linear" />}
                                            onPress={() => router.push("/profile?tab=personal")}
                                        >
                                            ตั้งค่าโปรไฟล์
                                        </DropdownItem>
                                        <DropdownItem
                                            key="logout"
                                            color="danger"
                                            startContent={<Icon icon="solar:logout-2-linear" />}
                                            onPress={handleLogout}
                                        >
                                            ออกจากระบบ
                                        </DropdownItem>
                                    </DropdownSection>
                                </DropdownMenu>
                            </Dropdown>

                            {/* Separator */}
                            <Icon icon="solar:alt-arrow-right-linear" className="text-slate-400 text-lg flex-shrink-0" />

                            {/* Current Page / Course Info */}
                            {isHomePage && (
                                <div className="flex items-center gap-1.5 px-2 py-1 text-slate-700">
                                    <span className="font-medium">รายวิชาของฉัน</span>
                                </div>
                            )}

                            {isClassroomPage && (isCourseInfoLoading || !courseInfo) && (
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Skeleton className="w-16 h-5 rounded-lg" />
                                    <Skeleton className="hidden sm:block w-36 h-5 rounded-lg" />
                                    <Skeleton className="w-16 h-5 rounded-full bg-blue-50" />
                                </div>
                            )}

                            {isClassroomPage && !isCourseInfoLoading && courseInfo && (
                                <div className="flex items-center gap-1.5 px-2 py-1 text-slate-700">
                                    <span className="font-medium">{courseInfo.code}</span>
                                    <span className="max-w-[200px] truncate">{courseInfo.name}</span>
                                    <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600 h-5 text-[10px]">
                                        {courseInfo.year}/{courseInfo.semester}
                                    </Chip>
                                </div>
                            )}
                        </div>

                        {/* Right: User Avatar */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Dropdown placement="bottom-end">
                                <DropdownTrigger>
                                    <button type="button" className="p-0.5 rounded-full hover:ring-2 hover:ring-blue-200 transition-all">
                                        <Avatar
                                            name={user?.full_name}
                                            size="md"
                                            src={user?.avatar || undefined}
                                            className="w-7 h-7 bg-gradient-to-br from-blue-400 to-indigo-500"
                                        />
                                    </button>
                                </DropdownTrigger>
                                <DropdownMenu aria-label="User menu">
                                    <DropdownItem
                                        key="profile-info"
                                        className="h-14 gap-2"
                                        textValue="Profile"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <p className="font-medium text-slate-800">{user?.full_name}</p>
                                                <p className="text-xs text-slate-500">{user?.email}</p>
                                            </div>
                                        </div>
                                    </DropdownItem>
                                    <DropdownItem
                                        key="settings"
                                        startContent={<Icon icon="solar:settings-linear" className="text-lg" />}
                                        onPress={() => router.push("/profile?tab=personal")}
                                    >
                                        ตั้งค่าโปรไฟล์
                                    </DropdownItem>
                                    <DropdownItem
                                        key="logout"
                                        color="danger"
                                        startContent={<Icon icon="solar:logout-2-linear" className="text-lg" />}
                                        onPress={handleLogout}
                                    >
                                        ออกจากระบบ
                                    </DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className={`flex-1 ${isHomePage ? "max-w-7xl mx-auto px-4 py-6" : ""}`}>
                    {children}
                </main>

                <AppFooter userEmail={user?.email} />
            </div>
        </InstructorContext.Provider>
    );
}
