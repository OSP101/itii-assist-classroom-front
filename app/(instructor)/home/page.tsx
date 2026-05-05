"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
import { Chip } from "@heroui/chip";
import { Pagination } from "@heroui/pagination";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Tooltip } from "@heroui/tooltip";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { authService } from "@/services/auth.service";
import { courseService, Course, Instructor } from "@/services/course.service";
import { twoFactorService } from "@/services/twoFactor.service";
import { useSocket } from "@/contexts/SocketContext";
import { CourseListSkeleton } from "@/components/loading-skeletons";
import Link from "next/link";
import { IoSchool, IoBook, IoPeople, IoPersonAdd } from "react-icons/io5";

interface Stats {
    total: number;
    byStatus: {
        active: number;
        inactive: number;
    };
    years: number[];
}

export default function HomePage() {
    const router = useRouter();
    const { subscribeToCourseUpdates, unsubscribeFromCourseUpdates, onCourseUpdate, emitCourseUpdate, isConnected } = useSocket();
    const [allCourses, setAllCourses] = useState<Course[]>([]); // All courses from API
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>("");
    const [isUserRoleLoading, setIsUserRoleLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    // View mode (no status tab needed - this page shows only active courses)
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // Instructors list (for multi-select)
    const [instructors, setInstructors] = useState<Instructor[]>([]);

    // Toggle status modal states
    const [isToggleStatusModalOpen, setIsToggleStatusModalOpen] = useState(false);
    const [isDuplicateWarningModalOpen, setIsDuplicateWarningModalOpen] = useState(false);
    const [duplicateCourse, setDuplicateCourse] = useState<Course | null>(null);
    const [courseToToggle, setCourseToToggle] = useState<Course | null>(null);

    // Create course modal
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const currentYear = new Date().getFullYear() + 543;
    const [formData, setFormData] = useState({
        code: "",
        name: "",
        year: currentYear,
        semester: 1,
        description: "",
        image: "",
        instructor_ids: [] as number[],
        attention_threshold: 60,
    });

    // Filters
    const [search, setSearch] = useState("");
    const [yearFilter, setYearFilter] = useState("");
    const [semesterFilter, setSemesterFilter] = useState("");

    // 2FA reminder banner
    const [show2FABanner, setShow2FABanner] = useState(false);
    const [is2FAEnabled, setIs2FAEnabled] = useState(true); // Default true to hide banner initially

    // Get user role and ID
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await authService.getCurrentUser();
                if (user) {
                    setUserRole(user.role);
                    setCurrentUserId(user.id);
                }
            } finally {
                setIsUserRoleLoading(false);
            }
        };
        fetchUser();
    }, []);

    // Check 2FA status and show banner if not enabled
    useEffect(() => {
        const check2FAStatus = async () => {
            // Check if banner was dismissed
            const dismissed = localStorage.getItem("2fa_banner_dismissed");
            if (dismissed) {
                // Check if dismissal is still valid (24 hours)
                const dismissedTime = parseInt(dismissed, 10);
                if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
                    return;
                }
            }

            try {
                const response = await twoFactorService.getStatus();
                if (response.success && response.data) {
                    setIs2FAEnabled(response.data.enabled);
                    // Show banner only if 2FA is not enabled
                    if (!response.data.enabled) {
                        setShow2FABanner(true);
                    }
                }
            } catch (error) {
                console.error("Failed to check 2FA status:", error);
            }
        };
        check2FAStatus();
    }, []);

    const dismiss2FABanner = () => {
        setShow2FABanner(false);
        localStorage.setItem("2fa_banner_dismissed", Date.now().toString());
    };

    // Fetch instructors for multi-select (exclude current user)
    const fetchInstructors = useCallback(async () => {
        try {
            const response = await courseService.getInstructors();
            if (response.success && response.data) {
                setInstructors(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch instructors:", error);
        }
    }, []);

    useEffect(() => {
        fetchInstructors();
    }, [fetchInstructors]);

    // Fetch all courses once on load
    const fetchCourses = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch all courses without pagination (set high limit)
            const response = await courseService.getMyCourses({ limit: 1000 });
            if (response.success && response.data) {
                setAllCourses(response.data.courses);
            }
        } catch (error) {
            console.error("Failed to fetch courses:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const response = await courseService.getMyCoursesStats();
            if (response.success && response.data) {
                setStats(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        }
    }, []);

    useEffect(() => {
        fetchCourses();
        fetchStats();
    }, [fetchCourses, fetchStats]);

    // Subscribe to real-time course updates
    useEffect(() => {
        if (currentUserId) {
            subscribeToCourseUpdates(currentUserId);

            return () => {
                unsubscribeFromCourseUpdates(currentUserId);
            };
        }
    }, [currentUserId, subscribeToCourseUpdates, unsubscribeFromCourseUpdates]);

    // Handle real-time course updates from other clients
    useEffect(() => {
        const unsubscribe = onCourseUpdate((data) => {
            console.log("📥 Received course update:", data);
            // Refresh data when any course change is detected
            fetchCourses();
            fetchStats();

            // Show notification
            addToast({
                title: "ข้อมูลอัปเดต",
                description: "มีการเปลี่ยนแปลงข้อมูลรายวิชา",
                color: "primary",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        });

        return () => {
            unsubscribe();
        };
    }, [onCourseUpdate, fetchCourses, fetchStats]);

    // Client-side filtering - show only active courses
    const filteredCourses = useMemo(() => {
        // Show only active courses on this page
        let result = allCourses.filter(course => course.is_active === true);

        // Search filter
        if (search.trim()) {
            const searchLower = search.toLowerCase().trim();
            result = result.filter(course =>
                course.code.toLowerCase().includes(searchLower) ||
                course.name.toLowerCase().includes(searchLower)
            );
        }

        // Year filter
        if (yearFilter) {
            const year = parseInt(yearFilter);
            result = result.filter(course => course.year === year);
        }

        // Semester filter
        if (semesterFilter) {
            const semester = parseInt(semesterFilter);
            result = result.filter(course => course.semester === semester);
        }

        return result;
    }, [allCourses, search, yearFilter, semesterFilter]);

    // Client-side pagination
    const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);
    const paginatedCourses = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredCourses.slice(start, start + itemsPerPage);
    }, [filteredCourses, currentPage]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, yearFilter, semesterFilter]);

    const clearFilters = () => {
        setSearch("");
        setYearFilter("");
        setSemesterFilter("");
    };

    const hasActiveFilters = search || yearFilter || semesterFilter;

    // Generate year options from actual data
    const yearOptions = useMemo(() => {
        const years = Array.from(new Set(allCourses.map(c => c.year))).sort((a, b) => b - a);
        return years.map(year => ({
            value: year.toString(),
            label: `${year}`,
        }));
    }, [allCourses]);

    const semesterOptions = [
        { value: "1", label: "เทอม 1" },
        { value: "2", label: "เทอม 2" },
        { value: "3", label: "ฤดูร้อน" },
    ];

    const getSemesterText = (semester: number) => {
        return semester === 3 ? "ฤดูร้อน" : `เทอม ${semester}`;
    };

    const handleCourseClick = (courseId: string) => {
        router.push(`/classroom/${courseId}`);
    };

    const handleCreateCourse = () => {
        setIsCreateModalOpen(true);
    };

    // Image upload handlers
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                addToast({
                    title: "ไฟล์ใหญ่เกินไป",
                    description: "กรุณาเลือกไฟล์ขนาดไม่เกิน 2MB",
                    color: "warning",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
                setFormData({ ...formData, image: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setImagePreview(null);
        setFormData({ ...formData, image: "" });
    };

    const resetForm = () => {
        setFormData({
            code: "",
            name: "",
            year: currentYear,
            semester: 1,
            description: "",
            image: "",
            instructor_ids: [],
            attention_threshold: 60,
        });
        setImagePreview(null);
    };

    const handleCreate = async () => {
        if (!formData.code || !formData.name) {
            addToast({
                title: "กรุณากรอกข้อมูล",
                description: "กรุณากรอกรหัสวิชาและชื่อวิชา",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await courseService.createCourse({
                code: formData.code,
                name: formData.name,
                year: formData.year,
                semester: formData.semester,
                description: formData.description || undefined,
                image: formData.image || undefined,
                instructor_ids: formData.instructor_ids.length > 0 ? formData.instructor_ids : undefined,
                attention_threshold: formData.attention_threshold,
            });

            if (response.success) {
                addToast({
                    title: "สำเร็จ",
                    description: "สร้างรายวิชาเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsCreateModalOpen(false);
                resetForm();
                fetchCourses();
                fetchStats();
                // Emit real-time update to other clients
                emitCourseUpdate("create", response.data?.id);
            } else {
                // Handle API error response (e.g., duplicate course)
                const errorMessage = typeof response.error === 'object' && response.error !== null
                    ? (response.error as { message?: string }).message
                    : response.error || response.message || "ไม่สามารถสร้างรายวิชาได้";
                addToast({
                    title: "ไม่สามารถสร้างรายวิชาได้",
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: any) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถสร้างรายวิชาได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Open Edit Modal
    const openEditModal = (course: Course) => {
        setSelectedCourse(course);
        // Get instructor IDs from the instructors array (exclude self)
        const instructorIdList = course.instructors?.map(i => i.id).filter(id => id !== currentUserId) || [];
        setFormData({
            code: course.code,
            name: course.name,
            year: course.year,
            semester: course.semester,
            description: course.description || "",
            image: course.image || "",
            instructor_ids: instructorIdList,
            attention_threshold: course.attention_threshold ?? 60,
        });
        setImagePreview(course.image || null);
        setIsEditModalOpen(true);
    };

    // Handle Update Course
    const handleUpdate = async () => {
        if (!selectedCourse) return;
        if (!formData.code || !formData.name) {
            addToast({
                title: "กรุณากรอกข้อมูล",
                description: "กรุณากรอกรหัสวิชาและชื่อวิชา",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await courseService.updateCourse(selectedCourse.id, {
                code: formData.code,
                name: formData.name,
                year: formData.year,
                semester: formData.semester,
                description: formData.description || undefined,
                image: formData.image || undefined,
                instructor_ids: formData.instructor_ids.length > 0 ? formData.instructor_ids : undefined,
                attention_threshold: formData.attention_threshold,
            });

            if (response.success) {
                addToast({
                    title: "สำเร็จ",
                    description: "แก้ไขรายวิชาเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsEditModalOpen(false);
                resetForm();
                setSelectedCourse(null);
                fetchCourses();
                // Emit real-time update to other clients
                emitCourseUpdate("update", selectedCourse.id);
            } else {
                const errorMessage = typeof response.error === 'object' && response.error !== null
                    ? (response.error as { message?: string }).message
                    : response.error || response.message || "ไม่สามารถแก้ไขรายวิชาได้";
                addToast({
                    title: "ไม่สามารถแก้ไขรายวิชาได้",
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: any) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถแก้ไขรายวิชาได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Open toggle status modal (check for duplicates when activating)
    const openToggleStatusModal = (course: Course) => {
        setCourseToToggle(course);

        // If trying to activate (currently inactive), check for duplicate active course
        if (!course.is_active) {
            const duplicateActiveCourse = allCourses.find(
                c => c.id !== course.id &&
                    c.code === course.code &&
                    c.year === course.year &&
                    c.semester === course.semester &&
                    c.is_active === true
            );

            if (duplicateActiveCourse) {
                setDuplicateCourse(duplicateActiveCourse);
                setIsDuplicateWarningModalOpen(true);
                return;
            }
        }

        setIsToggleStatusModalOpen(true);
    };

    // Handle Toggle Status (called from modal)
    const handleToggleStatus = async () => {
        if (!courseToToggle) return;

        setIsSubmitting(true);
        try {
            const response = await courseService.toggleStatus(courseToToggle.id);
            if (response.success) {
                addToast({
                    title: courseToToggle.is_active ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว",
                    description: `รายวิชา ${courseToToggle.code} ${courseToToggle.is_active ? "ปิด" : "เปิด"}ใช้งานเรียบร้อยแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsToggleStatusModalOpen(false);
                setCourseToToggle(null);
                fetchCourses();
                fetchStats();
                // Emit real-time update to other clients
                emitCourseUpdate("toggle", courseToToggle.id);
            } else {
                const errorMessage = typeof response.error === 'object' && response.error !== null
                    ? (response.error as { message?: string }).message
                    : response.error || response.message || "ไม่สามารถเปลี่ยนสถานะได้";
                addToast({
                    title: "ไม่สามารถเปลี่ยนสถานะได้",
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: any) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถเปลี่ยนสถานะได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    console.log("courseToToggle",courseToToggle)

    return (
        <div className="space-y-6">
            {/* 2FA Reminder Banner */}
            {show2FABanner && !is2FAEnabled && (
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <Icon icon="solar:shield-warning-bold" className="text-xl text-amber-600" />
                        </div>
                        <div>
                            <p className="font-medium text-amber-900">
                                เพิ่มความปลอดภัยให้บัญชีของคุณ
                            </p>
                            <p className="text-sm text-amber-700">
                                เราแนะนำให้เปิดใช้งานการยืนยันตัวตนสองขั้นตอน (2FA) เพื่อป้องกันบัญชีของคุณ
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                            as={Link}
                            href="/profile?tab=authentication"
                            size="sm"
                            color="warning"
                            variant="solid"
                            className="bg-amber-500 text-white"
                            startContent={<Icon icon="solar:lock-keyhole-bold" className="text-lg" />}
                        >
                            เปิดใช้งาน
                        </Button>
                        <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            aria-label="ปิดการแจ้งเตือน"
                            onPress={dismiss2FABanner}
                            className="text-amber-600 hover:bg-amber-100"
                        >
                            <Icon icon="solar:close-circle-linear" className="text-xl" />
                        </Button>
                    </div>
                </div>
            )}


            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">รายวิชาของฉัน</h1>
                        <Skeleton isLoaded={!isUserRoleLoading} className="mt-2 w-44 h-5 rounded-lg">
                            <p className="text-slate-500 mt-1">
                                {userRole === "instructor"
                                    ? "รายวิชาที่คุณเป็นผู้สอน"
                                    : "รายวิชาที่คุณเป็นผู้ช่วยสอน"}
                            </p>
                        </Skeleton>
                    </div>
                    {/* Real-time connection indicator */}
                    <Tooltip content={isConnected ? "ข้อมูลอัปเดตแบบ Real-time" : "กำลังเชื่อมต่อ..."}>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${isConnected ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                            }`}>
                            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500 animate-bounce"
                                }`} />
                            <span className="hidden sm:inline">{isConnected ? "Live" : "..."}</span>
                        </div>
                    </Tooltip>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        color="default"
                        variant="bordered"
                        startContent={<Icon icon="solar:archive-bold" className="text-xl" />}
                        onPress={() => router.push('/home/closed')}
                    >
                        วิชาที่ปิดใช้งาน
                        <Skeleton isLoaded={Boolean(stats)} className="ml-1 w-7 h-5 rounded-full">
                            <Chip size="sm" className="ml-1 bg-slate-200 text-slate-600" variant="flat">
                                {stats?.byStatus?.inactive ?? 0}
                            </Chip>
                        </Skeleton>
                    </Button>
                    {isUserRoleLoading ? (
                        <Skeleton className="w-40 h-10 rounded-lg bg-blue-100" />
                    ) : userRole === "instructor" && (
                        <Button
                            color="primary"
                            startContent={<Icon icon="solar:add-circle-bold" className="text-xl" />}
                            onPress={handleCreateCourse}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500"
                        >
                            สร้างรายวิชาใหม่
                        </Button>
                    )}
                </div>
            </div>


            {/* Filters */}
            <Card className="border border-slate-200 shadow-sm">
                <CardBody className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex flex-row gap-2 sm:gap-3 w-full">
                            <Input
                                aria-label="ค้นหารายวิชา"
                                placeholder="ค้นหารายวิชา..."
                                value={search}
                                onValueChange={setSearch}
                                startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400" />}
                                isClearable
                                onClear={() => setSearch("")}
                                variant="bordered"
                                classNames={{
                                    inputWrapper: "border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-blue-400 text-sm",
                                }}
                            />

                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                                <Tooltip content="แบบการ์ด">
                                    <Button
                                        aria-label="แสดงแบบการ์ด"
                                        isIconOnly
                                        size="md"
                                        variant="light"
                                        className={`rounded-none ${viewMode === "grid" ? "bg-slate-100" : ""}`}
                                        onPress={() => setViewMode("grid")}
                                    >
                                        <Icon icon="solar:widget-bold" className={`text-lg ${viewMode === "grid" ? "text-blue-600" : "text-slate-400"}`} />
                                    </Button>
                                </Tooltip>
                                <div className="w-px h-5 bg-slate-200" />
                                <Tooltip content="แบบรายการ">
                                    <Button
                                        aria-label="แสดงแบบรายการ"
                                        isIconOnly
                                        size="md"
                                        variant="light"
                                        className={`rounded-none ${viewMode === "list" ? "bg-slate-100" : ""}`}
                                        onPress={() => setViewMode("list")}
                                    >
                                        <Icon icon="solar:list-bold" className={`text-lg ${viewMode === "list" ? "text-blue-600" : "text-slate-400"}`} />
                                    </Button>
                                </Tooltip>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-row gap-2 sm:gap-3">
                            
                            <Select
                                aria-label="กรองตามปีการศึกษา"
                                placeholder="ปีการศึกษา"
                                selectedKeys={yearFilter ? [yearFilter] : []}
                                onSelectionChange={(keys) => setYearFilter(Array.from(keys)[0] as string || "")}
                                className="w-full sm:w-36"
                                size="md"
                                variant="bordered"
                            >
                                {yearOptions.map((option) => (
                                    <SelectItem key={option.value}>{option.label}</SelectItem>
                                ))}
                            </Select>

                            <Select
                                aria-label="กรองตามภาคเรียน"
                                placeholder="ภาคเรียน"
                                selectedKeys={semesterFilter ? [semesterFilter] : []}
                                onSelectionChange={(keys) => setSemesterFilter(Array.from(keys)[0] as string || "")}
                                className="w-full sm:w-32"
                                size="md"
                                variant="bordered"
                            >
                                {semesterOptions.map((option) => (
                                    <SelectItem key={option.value}>{option.label}</SelectItem>
                                ))}
                            </Select>

                            {hasActiveFilters && (
                                <Button
                                    variant="flat"
                                    color="danger"
                                    size="md"
                                    onPress={clearFilters}
                                    startContent={<Icon icon="solar:close-circle-linear" />}
                                >
                                    ล้าง
                                </Button>
                            )}
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Course List */}
            {isLoading ? (
                <CourseListSkeleton viewMode={viewMode} />
            ) : paginatedCourses.length === 0 ? (
                <Card className="border border-slate-200 shadow-sm">
                    <CardBody className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <IoBook className="text-3xl text-slate-400" />
                        </div>
                        <p className="text-slate-500 text-center">
                            {hasActiveFilters
                                ? "ไม่พบรายวิชาที่ตรงกับการค้นหา"
                                : userRole === "instructor"
                                    ? "คุณยังไม่มีรายวิชาที่เปิดใช้งาน กดปุ่ม \"สร้างรายวิชาใหม่\" เพื่อเริ่มต้น"
                                    : "คุณยังไม่มีรายวิชาที่เปิดใช้งาน"}
                        </p>
                        {hasActiveFilters && (
                            <Button
                                variant="flat"
                                color="primary"
                                className="mt-4"
                                onPress={clearFilters}
                            >
                                ล้างตัวกรอง
                            </Button>
                        )}
                    </CardBody>
                </Card>
            ) : viewMode === "grid" ? (
                /* Grid View */
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paginatedCourses.map((course) => (
                            <Card
                                key={course.id}
                                as="div"
                                isPressable
                                onPress={() => handleCourseClick(course.id)}
                                className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                            >
                                {/* Course Image/Banner */}
                                <div className="h-32 relative overflow-hidden">
                                    {course.image ? (
                                        <Image
                                            src={course.image}
                                            alt={course.name}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                            <IoSchool className="text-white/20 text-7xl" />
                                        </div>
                                    )}
                                </div>

                                <CardBody className="p-4">
                                    <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-slate-900 truncate">
                                                    {course.code}
                                                </h3>
                                                <p className="text-sm text-slate-600 line-clamp-1">
                                                    {course.name}
                                                </p>
                                            </div>
                                            {/* Menu Button - Only for instructor */}
                                            {userRole === "instructor" && (
                                                <Dropdown>
                                                    <DropdownTrigger>
                                                        <Button
                                                            aria-label="เมนูรายวิชา"
                                                            isIconOnly
                                                            size="sm"
                                                            variant="light"
                                                            className="min-w-8 w-8 h-8"
                                                            onClick={(event) => event.stopPropagation()}
                                                            onKeyDown={(event) => event.stopPropagation()}
                                                        >
                                                            <Icon icon="solar:menu-dots-bold" className="text-lg text-slate-500" />
                                                        </Button>
                                                    </DropdownTrigger>
                                                    <DropdownMenu
                                                        aria-label="Course actions"
                                                        onAction={(key) => {
                                                            if (key === "edit") {
                                                                openEditModal(course);
                                                            } else if (key === "toggle") {
                                                                openToggleStatusModal(course);
                                                            }
                                                        }}
                                                    >
                                                        <DropdownItem
                                                            key="edit"
                                                            startContent={<Icon icon="solar:pen-linear" className="text-lg" />}
                                                        >
                                                            แก้ไขรายวิชา
                                                        </DropdownItem>
                                                        <DropdownItem
                                                            key="toggle"
                                                            startContent={
                                                                <Icon
                                                                    icon={course.is_active ? "solar:archive-linear" : "solar:eye-linear"}
                                                                    className="text-lg"
                                                                />
                                                            }
                                                            color={course.is_active ? "warning" : "success"}
                                                        >
                                                            {course.is_active ? "เก็บชั้นเรียน" : "เปิดใช้งาน"}
                                                        </DropdownItem>
                                                    </DropdownMenu>
                                                </Dropdown>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
                                                {course.year}/{course.semester}
                                            </Chip>
                                            <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-600">
                                                {getSemesterText(course.semester)}
                                            </Chip>
                                        </div>
                                    </div>
                                </CardBody>

                                <CardFooter className="border-t border-slate-100 px-4 py-3">
                                    <div className="flex items-center justify-between w-full text-sm text-slate-500">
                                        <div className="flex items-center gap-1">
                                            <IoPeople className="text-lg" />
                                            <span>{course.taCount ?? 0} TA</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <IoPersonAdd className="text-lg" />
                                            <span>{course.studentCount ?? 0} นักศึกษา</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <IoBook className="text-lg" />
                                            <span>{course.sections?.length ?? 0} กลุ่ม</span>
                                        </div>
                                    </div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center mt-6">
                            <Pagination
                                total={totalPages}
                                page={currentPage}
                                onChange={setCurrentPage}
                                showControls
                                color="primary"
                            />
                        </div>
                    )}
                </>
            ) : (
                /* List View */
                <>
                    <div className="space-y-2">
                        {paginatedCourses.map((course) => (
                            <Card
                                key={course.id}
                                as="div"
                                isPressable
                                onPress={() => handleCourseClick(course.id)}
                                className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow w-full"
                            >
                                <CardBody className="p-3 sm:p-4">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        {/* Course Image/Icon */}
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 relative overflow-hidden rounded-lg shrink-0">
                                            {course.image ? (
                                                <Image
                                                    src={course.image}
                                                    alt={course.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                                    <IoSchool className="text-white/30 text-2xl sm:text-3xl" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Course Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-slate-900 truncate">
                                                        {course.code} - {course.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 flex-wrap mt-1">
                                                        <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
                                                            {course.year}/{course.semester}
                                                        </Chip>
                                                        <span className="text-sm text-slate-500">
                                                            {getSemesterText(course.semester)}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Menu Button - Only for instructor */}
                                                {userRole === "instructor" && (
                                                    <Dropdown>
                                                        <DropdownTrigger>
                                                            <Button
                                                                aria-label="เมนูรายวิชา"
                                                                isIconOnly
                                                                size="sm"
                                                                variant="light"
                                                                className="min-w-8 w-8 h-8"
                                                                onClick={(event) => event.stopPropagation()}
                                                                onKeyDown={(event) => event.stopPropagation()}
                                                            >
                                                                <Icon icon="solar:menu-dots-bold" className="text-lg text-slate-500" />
                                                            </Button>
                                                        </DropdownTrigger>
                                                        <DropdownMenu
                                                            aria-label="Course actions"
                                                            onAction={(key) => {
                                                                if (key === "edit") {
                                                                    openEditModal(course);
                                                                } else if (key === "toggle") {
                                                                    openToggleStatusModal(course);
                                                                }
                                                            }}
                                                        >
                                                            <DropdownItem
                                                                key="edit"
                                                                startContent={<Icon icon="solar:pen-linear" className="text-lg" />}
                                                            >
                                                                แก้ไขรายวิชา
                                                            </DropdownItem>
                                                            <DropdownItem
                                                                key="toggle"
                                                                startContent={
                                                                    <Icon
                                                                        icon={course.is_active ? "solar:archive-linear" : "solar:eye-linear"}
                                                                        className="text-lg"
                                                                    />
                                                                }
                                                                color={course.is_active ? "warning" : "success"}
                                                            >
                                                                {course.is_active ? "เก็บชั้นเรียน" : "เปิดใช้งาน"}
                                                            </DropdownItem>
                                                        </DropdownMenu>
                                                    </Dropdown>
                                                )}
                                            </div>
                                            {/* Stats - Desktop Only */}
                                            <div className="hidden sm:flex items-center gap-4 mt-2 text-sm text-slate-500">
                                                <div className="flex items-center gap-1">
                                                    <IoPeople className="text-lg" />
                                                    <span>{course.taCount ?? 0} TA</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <IoPersonAdd className="text-lg" />
                                                    <span>{course.studentCount ?? 0} นักศึกษา</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <IoBook className="text-lg" />
                                                    <span>{course.sections?.length ?? 0} กลุ่ม</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center mt-6">
                            <Pagination
                                total={totalPages}
                                page={currentPage}
                                onChange={setCurrentPage}
                                showControls
                                color="primary"
                            />
                        </div>
                    )}
                </>
            )}

            {/* Create Course Modal อันนี้เอาของแอดมินมาใช้เลย ใส่รูปได้*/}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    resetForm();
                }}
                size="2xl"
                scrollBehavior="inside"
                classNames={{
                    base: "mx-2 sm:mx-4",
                    body: "py-4",
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:book-2-bold" className="text-xl sm:text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-800">สร้างรายวิชาใหม่</h3>
                                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">กรอกข้อมูลรายวิชาที่ต้องการสร้าง</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-4 sm:px-6 py-4 sm:py-6">
                        <div className="space-y-5">
                            {/* Course Image Section */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:gallery-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-slate-700">รูปปกรายวิชา</span>
                                </div>
                                <div className="py-3">
                                    {imagePreview ? (
                                        <div className="relative group">
                                            <img
                                                src={imagePreview}
                                                alt="Course preview"
                                                className="w-full h-40 object-cover rounded-xl border border-slate-200"
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-3">
                                                <label className="cursor-pointer">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleImageUpload}
                                                        className="hidden"
                                                    />
                                                    <Button
                                                        as="span"
                                                        size="sm"
                                                        color="primary"
                                                        startContent={<Icon icon="solar:camera-bold" />}
                                                    >
                                                        เปลี่ยนรูป
                                                    </Button>
                                                </label>
                                                <Button
                                                    size="sm"
                                                    color="danger"
                                                    startContent={<Icon icon="solar:trash-bin-trash-bold" />}
                                                    onPress={handleRemoveImage}
                                                >
                                                    ลบรูป
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                            />
                                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                                                <Icon icon="solar:cloud-upload-bold-duotone" className="text-5xl text-blue-400 mx-auto mb-3" />
                                                <p className="text-slate-600 font-medium">คลิกเพื่ออัปโหลดรูปปกรายวิชา</p>
                                                <p className="text-slate-400 text-sm mt-1">รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 2MB</p>
                                            </div>
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Course Info Section */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:document-text-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-slate-700">ข้อมูลรายวิชา</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
                                    <div className="md:col-span-2">
                                        <Input
                                            label="รหัสวิชา"
                                            labelPlacement="outside"
                                            placeholder="เช่น 101401"
                                            variant="bordered"
                                            size="md"
                                            value={formData.code}
                                            onValueChange={(value) => setFormData({ ...formData, code: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:hashtag-linear" className="text-blue-400 text-xl" />}
                                            classNames={{
                                                inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                                label: "text-slate-600 font-medium text-sm",
                                            }}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Input
                                            label="ชื่อวิชา"
                                            labelPlacement="outside"
                                            placeholder="เช่น Object-Oriented Programming"
                                            variant="bordered"
                                            size="md"
                                            value={formData.name}
                                            onValueChange={(value) => setFormData({ ...formData, name: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:book-linear" className="text-blue-400 text-xl" />}
                                            classNames={{
                                                inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                                label: "text-slate-600 font-medium text-sm",
                                            }}
                                        />
                                    </div>
                                    <Input
                                        label="ปีการศึกษา"
                                        labelPlacement="outside"
                                        placeholder="เช่น 2568"
                                        variant="bordered"
                                        size="md"
                                        type="number"
                                        value={formData.year.toString()}
                                        onValueChange={(value) => setFormData({ ...formData, year: parseInt(value) || currentYear })}
                                        isRequired
                                        startContent={<Icon icon="solar:calendar-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                    <Select
                                        label="ภาคเรียน"
                                        labelPlacement="outside"
                                        placeholder="เลือกภาคเรียน"
                                        variant="bordered"
                                        size="md"
                                        selectedKeys={[formData.semester.toString()]}
                                        onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1 })}
                                        isRequired
                                        classNames={{
                                            trigger: "bg-white border-slate-200 hover:border-blue-300",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    >
                                        <SelectItem key="1">ภาคเรียนที่ 1</SelectItem>
                                        <SelectItem key="2">ภาคเรียนที่ 2</SelectItem>
                                        <SelectItem key="3">ภาคฤดูร้อน</SelectItem>
                                    </Select>
                                </div>
                            </div>

                            {/* Co-Instructors Section */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:users-group-two-rounded-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-slate-700">ผู้สอนร่วม</span>
                                </div>
                                <div className="py-3">
                                    <Select
                                        label="เลือกผู้สอนร่วม"
                                        labelPlacement="outside"
                                        placeholder="เลือกผู้สอนร่วม (ถ้ามี)"
                                        variant="bordered"
                                        selectionMode="multiple"
                                        size="md"
                                        selectedKeys={new Set(formData.instructor_ids.map(id => id.toString()))}
                                        onSelectionChange={(keys) => {
                                            const selectedIds = Array.from(keys).map(k => parseInt(k as string));
                                            setFormData({ ...formData, instructor_ids: selectedIds });
                                        }}
                                        classNames={{
                                            trigger: " bg-white border-slate-200 hover:border-blue-300",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    >
                                        {instructors
                                            .filter(inst => inst.id !== currentUserId) // Exclude self
                                            .map(instructor => (
                                                <SelectItem key={instructor.id.toString()}>
                                                    {instructor.full_name}
                                                </SelectItem>
                                            ))}
                                    </Select>
                                </div>
                            </div>

                            {/* Attention Threshold Section */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:chart-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-slate-700">เกณฑ์นักศึกษาที่นักศึกษาที่ควรได้รับการดูแลเพิ่มเติม</span>
                                </div>
                                <div className="py-3">
                                    <Input
                                        label="เปอร์เซ็นต์คะแนนขั้นต่ำ"
                                        labelPlacement="outside"
                                        placeholder="เช่น 60"
                                        variant="bordered"
                                        size="md"
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={formData.attention_threshold.toString()}
                                        onValueChange={(value) => {
                                            const num = parseInt(value) || 0;
                                            setFormData({ ...formData, attention_threshold: Math.min(100, Math.max(0, num)) });
                                        }}
                                        endContent={<span className="text-slate-400">%</span>}
                                        description="นักศึกษาที่มีคะแนนรวมต่ำกว่าเกณฑ์นี้จะแสดงในรายการ 'นักศึกษาที่ควรได้รับการดูแลเพิ่มเติม'"
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Description Section */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:notes-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-slate-700">รายละเอียดเพิ่มเติม</span>
                                </div>
                                <div className="py-3">
                                    <Textarea
                                        label="คำอธิบายรายวิชา"
                                        labelPlacement="outside"
                                        placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับรายวิชา (ถ้ามี)"
                                        variant="bordered"
                                        value={formData.description}
                                        onValueChange={(value) => setFormData({ ...formData, description: value })}
                                        minRows={3}
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button
                            variant="light"
                            color="default"
                            onPress={() => {
                                setIsCreateModalOpen(false);
                                resetForm();
                            }}
                            className="font-medium px-6"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleCreate}
                            isLoading={isSubmitting}
                            className="font-medium px-6 bg-gradient-to-r from-blue-400 to-indigo-500"
                            startContent={!isSubmitting && <Icon icon="solar:add-circle-bold" className="text-lg" />}
                        >
                            สร้างรายวิชา
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Course Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    resetForm();
                    setSelectedCourse(null);
                }}
                size="2xl"
                scrollBehavior="inside"
                classNames={{
                    base: "mx-2 sm:mx-4",
                    body: "py-4",
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:pen-new-square-bold" className="text-xl sm:text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-800">แก้ไขรายวิชา</h3>
                                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
                                    แก้ไขข้อมูลรายวิชา {selectedCourse?.code}
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-4 sm:px-6 py-4 sm:py-6">
                        <div className="space-y-5">
                            {/* Course Image Section */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:gallery-bold" className="text-lg text-amber-500" />
                                    <span className="text-sm font-semibold text-slate-700">รูปปกรายวิชา</span>
                                </div>
                                <div className="py-3">
                                    {imagePreview ? (
                                        <div className="relative group">
                                            <img
                                                src={imagePreview}
                                                alt="Course preview"
                                                className="w-full h-48 object-cover rounded-xl border border-slate-200"
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-3">
                                                <label className="cursor-pointer">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleImageUpload}
                                                        className="hidden"
                                                    />
                                                    <Button
                                                        as="span"
                                                        size="sm"
                                                        color="primary"
                                                        startContent={<Icon icon="solar:camera-bold" />}
                                                    >
                                                        เปลี่ยนรูป
                                                    </Button>
                                                </label>
                                                <Button
                                                    size="sm"
                                                    color="danger"
                                                    startContent={<Icon icon="solar:trash-bin-trash-bold" />}
                                                    onPress={handleRemoveImage}
                                                >
                                                    ลบรูป
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                            />
                                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-amber-400 hover:bg-amber-50/50 transition-colors">
                                                <Icon icon="solar:cloud-upload-bold-duotone" className="text-5xl text-amber-400 mx-auto mb-3" />
                                                <p className="text-slate-600 font-medium">คลิกเพื่ออัปโหลดรูปปกรายวิชา</p>
                                                <p className="text-slate-400 text-sm mt-1">รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 2MB</p>
                                            </div>
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Course Info Section */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:document-text-bold" className="text-lg text-amber-500" />
                                    <span className="text-sm font-semibold text-slate-700">ข้อมูลรายวิชา</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
                                    <div className="md:col-span-2">
                                        <Input
                                            label="รหัสวิชา"
                                            labelPlacement="outside"
                                            placeholder="เช่น 101401"
                                            variant="bordered"
                                            size="lg"
                                            value={formData.code}
                                            onValueChange={(value) => setFormData({ ...formData, code: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:hashtag-linear" className="text-amber-400 text-xl" />}
                                            classNames={{
                                                inputWrapper: "h-12 bg-white border-slate-200 hover:border-amber-300 focus-within:!border-amber-400",
                                                label: "text-slate-600 font-medium text-sm",
                                            }}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Input
                                            label="ชื่อวิชา"
                                            labelPlacement="outside"
                                            placeholder="เช่น Object-Oriented Programming"
                                            variant="bordered"
                                            size="lg"
                                            value={formData.name}
                                            onValueChange={(value) => setFormData({ ...formData, name: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:book-linear" className="text-amber-400 text-xl" />}
                                            classNames={{
                                                inputWrapper: "h-12 bg-white border-slate-200 hover:border-amber-300 focus-within:!border-amber-400",
                                                label: "text-slate-600 font-medium text-sm",
                                            }}
                                        />
                                    </div>
                                    <Input
                                        label="ปีการศึกษา"
                                        labelPlacement="outside"
                                        placeholder="เช่น 2568"
                                        variant="bordered"
                                        size="lg"
                                        type="number"
                                        value={formData.year.toString()}
                                        onValueChange={(value) => setFormData({ ...formData, year: parseInt(value) || currentYear })}
                                        isRequired
                                        startContent={<Icon icon="solar:calendar-linear" className="text-amber-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-white border-slate-200 hover:border-amber-300 focus-within:!border-amber-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                    <Select
                                        label="ภาคเรียน"
                                        labelPlacement="outside"
                                        placeholder="เลือกภาคเรียน"
                                        variant="bordered"
                                        size="lg"
                                        selectedKeys={[formData.semester.toString()]}
                                        onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1 })}
                                        isRequired
                                        classNames={{
                                            trigger: "h-12 bg-white border-slate-200 hover:border-amber-300",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    >
                                        <SelectItem key="1">ภาคเรียนที่ 1</SelectItem>
                                        <SelectItem key="2">ภาคเรียนที่ 2</SelectItem>
                                        <SelectItem key="3">ภาคฤดูร้อน</SelectItem>
                                    </Select>
                                </div>
                            </div>

                            {/* Co-Instructors Section */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:users-group-two-rounded-bold" className="text-lg text-amber-500" />
                                    <span className="text-sm font-semibold text-slate-700">ผู้สอนร่วม (ไม่รวมตัวคุณ)</span>
                                </div>
                                <div className="py-3">
                                    <Select
                                        label="เลือกผู้สอนร่วม"
                                        labelPlacement="outside"
                                        placeholder="เลือกผู้สอนร่วม (ถ้ามี)"
                                        variant="bordered"
                                        selectionMode="multiple"
                                        selectedKeys={new Set(formData.instructor_ids.map(id => id.toString()))}
                                        onSelectionChange={(keys) => {
                                            const selectedIds = Array.from(keys).map(k => parseInt(k as string));
                                            setFormData({ ...formData, instructor_ids: selectedIds });
                                        }}
                                        classNames={{
                                            trigger: "min-h-12 bg-white border-slate-200 hover:border-amber-300",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    >
                                        {instructors
                                            .filter(inst => inst.id !== currentUserId) // Exclude self
                                            .map(instructor => (
                                                <SelectItem key={instructor.id.toString()}>
                                                    {instructor.full_name}
                                                </SelectItem>
                                            ))}
                                    </Select>
                                    <p className="text-xs text-slate-400 mt-2">
                                        คุณจะเป็นผู้สอนหลักโดยอัตโนมัติ สามารถเลือกผู้สอนร่วมเพิ่มเติมได้
                                    </p>
                                </div>
                            </div>

                            {/* Attention Threshold Section */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:chart-bold" className="text-lg text-amber-500" />
                                    <span className="text-sm font-semibold text-slate-700">เกณฑ์นักศึกษาที่นักศึกษาที่ควรได้รับการดูแลเพิ่มเติม</span>
                                </div>
                                <div className="py-3">
                                    <Input
                                        label="เปอร์เซ็นต์คะแนนขั้นต่ำ"
                                        labelPlacement="outside"
                                        placeholder="เช่น 60"
                                        variant="bordered"
                                        size="lg"
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={formData.attention_threshold.toString()}
                                        onValueChange={(value) => {
                                            const num = parseInt(value) || 0;
                                            setFormData({ ...formData, attention_threshold: Math.min(100, Math.max(0, num)) });
                                        }}
                                        endContent={<span className="text-slate-400">%</span>}
                                        description="นักศึกษาที่มีคะแนนรวมต่ำกว่าเกณฑ์นี้จะแสดงในรายการ 'นักศึกษาที่ควรได้รับการดูแลเพิ่มเติม'"
                                        classNames={{
                                            inputWrapper: "h-12 bg-white border-slate-200 hover:border-amber-300 focus-within:!border-amber-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Description Section */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:notes-bold" className="text-lg text-amber-500" />
                                    <span className="text-sm font-semibold text-slate-700">รายละเอียดเพิ่มเติม</span>
                                </div>
                                <div className="py-3">
                                    <Textarea
                                        label="คำอธิบายรายวิชา"
                                        labelPlacement="outside"
                                        placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับรายวิชา (ถ้ามี)"
                                        variant="bordered"
                                        value={formData.description}
                                        onValueChange={(value) => setFormData({ ...formData, description: value })}
                                        minRows={3}
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-amber-300 focus-within:!border-amber-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button
                            variant="light"
                            color="default"
                            onPress={() => {
                                setIsEditModalOpen(false);
                                resetForm();
                                setSelectedCourse(null);
                            }}
                            className="font-medium px-6"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleUpdate}
                            isLoading={isSubmitting}
                            className="font-medium px-6 bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                            startContent={!isSubmitting && <Icon icon="solar:diskette-bold" className="text-lg" />}
                        >
                            บันทึกการแก้ไข
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Toggle Status Confirmation Modal - Archive Style */}
            <Modal
                isOpen={isToggleStatusModalOpen}
                onClose={() => {
                    setIsToggleStatusModalOpen(false);
                    setCourseToToggle(null);
                }}
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 pb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-500/30">
                                <Icon
                                    icon={courseToToggle?.is_active ? "solar:archive-bold" : "solar:eye-bold"}
                                    className="text-xl text-white"
                                />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">
                                    {courseToToggle?.is_active ? "ปิดใช้งานรายวิชา" : "เปิดใช้งานรายวิชา"}
                                </h3>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="py-4">
                        {courseToToggle?.is_active ? (
                            <div className="space-y-4">
                                {/* Info items like in the image */}
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <Icon icon="solar:square-academic-cap-bold" className="text-xl text-blue-500 mt-0.5" />
                                        <p className="text-slate-600 text-sm">
                                            อาจารย์หรือผู้ช่วยสอนจะแก้ไขชั้นเรียนที่ปิดใช้งานไม่ได้ เว้นแต่ชั้นเรียนจะได้รับการกู้คืน
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Icon icon="solar:eye-bold" className="text-xl text-blue-500 mt-0.5" />
                                        <p className="text-slate-600 text-sm">
                                            อาจารย์ยังคงดูตัวอย่างและส่งออกรายงานได้
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Icon icon="solar:eye-closed-linear" className="text-xl text-blue-500 mt-0.5" />
                                        <p className="text-slate-600 text-sm">
                                            นักศึกษาจะไม่สามารถค้นหาของนักศึกษาในคะแนนของรายวิชาที่ปิดใช้งานได้
                                        </p>
                                    </div>
                                </div>

                                {/* Course info card */}
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                    <div className="flex items-center gap-3">
                                        {/* <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                            {courseToToggle?.semester}
                                        </div> */}
                                        <div>
                                            <p className="font-semibold text-slate-800">
                                                {courseToToggle?.year}/{courseToToggle?.code} {courseToToggle?.name}
                                            </p>
                                            <p className="text-sm text-slate-500">
                                                {courseToToggle?.sections?.length ?? 0} Section • {courseToToggle?.instructor?.full_name || 'ผู้สอน'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-slate-500 text-sm">
                                    ระบบจะย้ายชั้นเรียนต่อไปนี้ไปยังชั้นเรียนที่ปิดใช้งาน
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-slate-600">
                                    คุณต้องการเปิดใช้งานรายวิชา{" "}
                                    <span className="font-semibold">{courseToToggle?.code} - {courseToToggle?.name}</span>{" "}
                                    หรือไม่?
                                </p>
                                <p className="text-sm text-green-600 mt-2">
                                    * เมื่อเปิดใช้งาน นักศึกษาและผู้ช่วยสอนจะสามารถเข้าถึงรายวิชานี้ได้อีกครั้ง
                                </p>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="light"
                            onPress={() => {
                                setIsToggleStatusModalOpen(false);
                                setCourseToToggle(null);
                            }}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleToggleStatus}
                            isLoading={isSubmitting}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {courseToToggle?.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Duplicate Warning Modal */}
            <Modal
                isOpen={isDuplicateWarningModalOpen}
                onClose={() => {
                    setIsDuplicateWarningModalOpen(false);
                    setDuplicateCourse(null);
                    setCourseToToggle(null);
                }}
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:danger-triangle-bold" className="text-xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">ไม่สามารถเปิดใช้งานได้</h3>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <p className="text-slate-600">
                            มีรายวิชาที่ใช้รหัสวิชา ปีการศึกษา และภาคเรียนเดียวกันที่เปิดใช้งานอยู่แล้ว:
                        </p>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
                            <p className="font-semibold text-slate-800">{duplicateCourse?.code} - {duplicateCourse?.name}</p>
                            <p className="text-sm text-slate-600 mt-1">
                                ปีการศึกษา {duplicateCourse?.year} / ภาคเรียนที่ {duplicateCourse?.semester === 3 ? "ฤดูร้อน" : duplicateCourse?.semester}
                            </p>
                        </div>
                        <p className="text-sm text-slate-500 mt-3">
                            หากต้องการเปิดใช้งานรายวิชานี้ กรุณาปิดใช้งานรายวิชาที่ซ้ำกันก่อน
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="primary"
                            onPress={() => {
                                setIsDuplicateWarningModalOpen(false);
                                setDuplicateCourse(null);
                                setCourseToToggle(null);
                            }}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            เข้าใจแล้ว
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
