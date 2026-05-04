"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { Pagination } from "@heroui/pagination";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Tooltip } from "@heroui/tooltip";
import { Checkbox } from "@heroui/checkbox";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { authService } from "@/services/auth.service";
import { courseService, Course } from "@/services/course.service";
import { useSocket } from "@/contexts/SocketContext";
import { IoSchool, IoBook, IoPeople, IoPersonAdd } from "react-icons/io5";

interface Stats {
    total: number;
    byStatus: {
        active: number;
        inactive: number;
    };
    years: number[];
}

export default function ClosedCoursesPage() {
    const router = useRouter();
    const { subscribeToCourseUpdates, unsubscribeFromCourseUpdates, onCourseUpdate, emitCourseUpdate, isConnected } = useSocket();
    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>("");
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    // View mode (no status tab needed - this page shows only closed courses)
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // Modal states
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDuplicateWarningModalOpen, setIsDuplicateWarningModalOpen] = useState(false);
    const [duplicateCourse, setDuplicateCourse] = useState<Course | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);

    // Filters
    const [search, setSearch] = useState("");
    const [yearFilter, setYearFilter] = useState("");
    const [semesterFilter, setSemesterFilter] = useState("");

    // Get user role and ID
    useEffect(() => {
        const fetchUser = async () => {
            const user = await authService.getCurrentUser();
            if (user) {
                setUserRole(user.role);
                setCurrentUserId(user.id);
            }
        };
        fetchUser();
    }, []);

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
            fetchCourses();
            fetchStats();

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

    // Client-side filtering - show only inactive (closed) courses
    const filteredCourses = useMemo(() => {
        // Show only inactive courses on this page
        let result = allCourses.filter(course => course.is_active === false);

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

    // Generate year options from actual data (only from closed courses)
    const yearOptions = useMemo(() => {
        const closedCourses = allCourses.filter(c => !c.is_active);
        const years = Array.from(new Set(closedCourses.map(c => c.year))).sort((a, b) => b - a);
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

    // Open restore modal (check for duplicates when restoring)
    const openRestoreModal = (course: Course) => {
        setSelectedCourse(course);

        // Check for duplicate active course
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

        setIsRestoreModalOpen(true);
    };

    // Open delete modal
    const openDeleteModal = (course: Course) => {
        setSelectedCourse(course);
        setDeleteConfirmChecked(false);
        setIsDeleteModalOpen(true);
    };

    // Handle Restore Course (toggle status from inactive to active)
    const handleRestoreCourse = async () => {
        if (!selectedCourse) return;

        setIsSubmitting(true);
        try {
            const response = await courseService.toggleStatus(selectedCourse.id);
            if (response.success) {
                addToast({
                    title: "เปิดใช้งานแล้ว",
                    description: `รายวิชา ${selectedCourse.code} เปิดใช้งานเรียบร้อยแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsRestoreModalOpen(false);
                setSelectedCourse(null);
                fetchCourses();
                fetchStats();
                emitCourseUpdate("toggle", selectedCourse.id);
            } else {
                const errorMessage = typeof response.error === 'object' && response.error !== null
                    ? (response.error as { message?: string }).message
                    : response.error || response.message || "ไม่สามารถเปิดใช้งานได้";
                addToast({
                    title: "ไม่สามารถเปิดใช้งานได้",
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: any) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถเปิดใช้งานได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Delete Course (permanent deletion)
    const handleDeleteCourse = async () => {
        if (!selectedCourse || !deleteConfirmChecked) return;

        setIsSubmitting(true);
        try {
            const response = await courseService.deleteCourse(selectedCourse.id);
            if (response.success) {
                addToast({
                    title: "ลบรายวิชาแล้ว",
                    description: `รายวิชา ${selectedCourse.code} ถูกลบออกจากระบบถาวรแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsDeleteModalOpen(false);
                setSelectedCourse(null);
                setDeleteConfirmChecked(false);
                fetchCourses();
                fetchStats();
                emitCourseUpdate("delete", selectedCourse.id);
            } else {
                const errorMessage = typeof response.error === 'object' && response.error !== null
                    ? (response.error as { message?: string }).message
                    : response.error || response.message || "ไม่สามารถลบรายวิชาได้";
                addToast({
                    title: "ไม่สามารถลบรายวิชาได้",
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: any) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถลบรายวิชาได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-900">วิชาที่ปิดใช้งาน</h1>
                            <Chip size="sm" variant="flat" className="bg-slate-200 text-slate-600">
                                {filteredCourses.length}
                            </Chip>
                        </div>
                        <p className="text-slate-500 mt-1">
                            รายวิชาที่ปิดใช้งานแล้ว สามารถดูข้อมูลหรือเปิดใช้งานอีกครั้งได้
                        </p>
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
                        color="primary"
                        variant="bordered"
                        onPress={() => router.push('/home')}
                    >
                        กลับไปวิชาที่เปิด
                        {stats?.byStatus?.active ? (
                            <Chip size="sm" className="ml-1 bg-blue-100 text-blue-600" variant="flat">
                                {stats.byStatus.active}
                            </Chip>
                        ) : null}
                    </Button>
                </div>
            </div>


            {/* Filters */}
            <Card className="border border-slate-200 shadow-sm">
                <CardBody className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex flex-row gap-2 sm:gap-3">
                            <Input
                                placeholder="ค้นหารายวิชา..."
                                value={search}
                                onValueChange={setSearch}
                                startContent={<Icon icon="solar:magnifer-linear" className="text-slate-400" />}
                                isClearable
                                onClear={() => setSearch("")}
                                variant="bordered"
                                classNames={{
                                    inputWrapper: "border-slate-200 hover:border-slate-300 focus-within:!border-slate-400",
                                    label: "text-slate-400 text-sm",
                                }}
                            />

                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                                <Tooltip content="แบบการ์ด">
                                    <Button
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
                <div className="flex justify-center py-12">
                    <Spinner size="lg" color="primary" />
                </div>
            ) : paginatedCourses.length === 0 ? (
                <Card className="border border-slate-200 shadow-sm">
                    <CardBody className="py-16 text-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-slate-100 rounded-full">
                                <Icon icon="solar:archive-bold-duotone" className="text-5xl text-slate-400" />
                            </div>
                            <div>
                                <p className="text-lg font-medium text-slate-700">
                                    {hasActiveFilters ? "ไม่พบรายวิชาที่ค้นหา" : "ไม่มีวิชาที่ปิดใช้งาน"}
                                </p>
                                <p className="text-slate-500 mt-1">
                                    {hasActiveFilters
                                        ? "ลองค้นหาด้วยคำค้นหาอื่น หรือล้างตัวกรอง"
                                        : "ยังไม่มีรายวิชาที่ปิดใช้งานในขณะนี้"}
                                </p>
                            </div>
                            {hasActiveFilters && (
                                <Button
                                    color="primary"
                                    variant="flat"
                                    startContent={<Icon icon="solar:close-circle-linear" />}
                                    onPress={clearFilters}
                                >
                                    ล้างตัวกรอง
                                </Button>
                            )}
                        </div>
                    </CardBody>
                </Card>
            ) : viewMode === "grid" ? (
                /* Grid View */
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paginatedCourses.map((course) => (
                            <Card
                                key={course.id}
                                isPressable
                                onPress={() => handleCourseClick(course.id)}
                                className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow opacity-80 hover:opacity-100"
                            >
                                {/* Course Image/Banner */}
                                <div className="h-32 relative overflow-hidden">
                                    {course.image ? (
                                        <Image
                                            src={course.image}
                                            alt={course.name}
                                            fill
                                            className="object-cover grayscale"
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center">
                                            <IoSchool className="text-white/20 text-7xl" />
                                        </div>
                                    )}
                                    {/* Closed badge */}
                                    <div className="absolute top-2 left-2">
                                        <Chip size="sm" color="default" variant="solid" className="bg-slate-700/80 text-white">
                                            <Icon icon="solar:archive-bold" className="mr-1" />
                                            ปิดใช้งาน
                                        </Chip>
                                    </div>
                                </div>

                                <CardBody className="p-4">
                                    <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-slate-700 truncate">
                                                    {course.code}
                                                </h3>
                                                <p className="text-sm text-slate-500 line-clamp-1">
                                                    {course.name}
                                                </p>
                                            </div>
                                            {/* Menu Button - Only for instructor */}
                                            {userRole === "instructor" && (
                                                <Dropdown>
                                                    <DropdownTrigger>
                                                        <Button
                                                            isIconOnly
                                                            size="sm"
                                                            variant="light"
                                                            className="min-w-8 w-8 h-8"
                                                        >
                                                            <Icon icon="solar:menu-dots-bold" className="text-lg text-slate-500" />
                                                        </Button>
                                                    </DropdownTrigger>
                                                    <DropdownMenu
                                                        aria-label="Course actions"
                                                        onAction={(key) => {
                                                            if (key === "restore") {
                                                                openRestoreModal(course);
                                                            } else if (key === "delete") {
                                                                openDeleteModal(course);
                                                            }
                                                        }}
                                                    >
                                                        <DropdownItem
                                                            key="restore"
                                                            startContent={<Icon icon="solar:refresh-bold" className="text-lg" />}
                                                            color="success"
                                                        >
                                                            เปิดใช้งานอีกครั้ง
                                                        </DropdownItem>
                                                        <DropdownItem
                                                            key="delete"
                                                            startContent={<Icon icon="solar:trash-bin-trash-bold" className="text-lg" />}
                                                            color="danger"
                                                            className="text-danger"
                                                        >
                                                            ลบออกจากระบบถาวร
                                                        </DropdownItem>
                                                    </DropdownMenu>
                                                </Dropdown>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-600">
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
                                isPressable
                                onPress={() => handleCourseClick(course.id)}
                                className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow w-full opacity-80 hover:opacity-100"
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
                                                    className="object-cover grayscale"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center">
                                                    <IoSchool className="text-white/30 text-2xl sm:text-3xl" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Course Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-slate-700 truncate">
                                                            {course.code} - {course.name}
                                                        </h3>
                                                        <Chip size="sm" color="default" variant="flat" className="bg-slate-200 text-slate-600 shrink-0">
                                                            ปิดใช้งาน
                                                        </Chip>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap mt-1">
                                                        <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-600">
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
                                                                isIconOnly
                                                                size="sm"
                                                                variant="light"
                                                                className="min-w-8 w-8 h-8"
                                                            >
                                                                <Icon icon="solar:menu-dots-bold" className="text-lg text-slate-500" />
                                                            </Button>
                                                        </DropdownTrigger>
                                                        <DropdownMenu
                                                            aria-label="Course actions"
                                                            onAction={(key) => {
                                                                if (key === "restore") {
                                                                    openRestoreModal(course);
                                                                } else if (key === "delete") {
                                                                    openDeleteModal(course);
                                                                }
                                                            }}
                                                        >
                                                            <DropdownItem
                                                                key="restore"
                                                                startContent={<Icon icon="solar:refresh-bold" className="text-lg" />}
                                                                color="success"
                                                            >
                                                                เปิดใช้งานอีกครั้ง
                                                            </DropdownItem>
                                                            <DropdownItem
                                                                key="delete"
                                                                startContent={<Icon icon="solar:trash-bin-trash-bold" className="text-lg" />}
                                                                color="danger"
                                                                className="text-danger"
                                                            >
                                                                ลบออกจากระบบถาวร
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

            {/* Restore Course Modal */}
            <Modal
                isOpen={isRestoreModalOpen}
                onClose={() => {
                    setIsRestoreModalOpen(false);
                    setSelectedCourse(null);
                }}
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:refresh-bold" className="text-xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">เปิดใช้งานรายวิชาอีกครั้ง</h3>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <p className="text-slate-600">
                            คุณต้องการเปิดใช้งานรายวิชา{" "}
                            <span className="font-semibold">{selectedCourse?.code} - {selectedCourse?.name}</span>{" "}
                            อีกครั้งหรือไม่?
                        </p>
                        <p className="text-sm text-green-600 mt-2">
                            * เมื่อเปิดใช้งาน นักศึกษาและ TA จะสามารถเข้าถึงรายวิชานี้ได้อีกครั้ง
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="light"
                            onPress={() => {
                                setIsRestoreModalOpen(false);
                                setSelectedCourse(null);
                            }}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleRestoreCourse}
                            isLoading={isSubmitting}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            เปิดใช้งาน
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Course Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedCourse(null);
                    setDeleteConfirmChecked(false);
                }}
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:trash-bin-trash-bold" className="text-xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">ลบรายวิชาถาวร</h3>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <div className="space-y-4">
                            <p className="text-slate-600">
                                คุณกำลังจะลบรายวิชา{" "}
                                <span className="font-semibold">{selectedCourse?.code} - {selectedCourse?.name}</span>{" "}
                                ออกจากระบบอย่างถาวร
                            </p>

                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <Icon icon="solar:danger-triangle-bold" className="text-xl text-red-600 mt-0.5" />
                                    <div className="text-sm text-red-700">
                                        <p className="font-semibold mb-1">คำเตือน: การดำเนินการนี้ไม่สามารถยกเลิกได้!</p>
                                        <ul className="list-disc ml-4 space-y-1 text-red-600">
                                            <li>ข้อมูลนักศึกษาทั้งหมดในรายวิชาจะถูกลบ</li>
                                            <li>คะแนนและการส่งงานทั้งหมดจะถูกลบ</li>
                                            <li>ข้อมูล TA และ Section ทั้งหมดจะถูกลบ</li>
                                            <li>ไฟล์ของชั้นเรียนจะยังอยู่ใน Google ไดรฟ์</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <Checkbox
                                isSelected={deleteConfirmChecked}
                                onValueChange={setDeleteConfirmChecked}
                                color="danger"
                                classNames={{
                                    label: "text-sm text-slate-600"
                                }}
                            >
                                ฉันเข้าใจและต้องการลบรายวิชานี้ออกจากระบบถาวร
                            </Checkbox>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="light"
                            onPress={() => {
                                setIsDeleteModalOpen(false);
                                setSelectedCourse(null);
                                setDeleteConfirmChecked(false);
                            }}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleDeleteCourse}
                            isLoading={isSubmitting}
                            isDisabled={!deleteConfirmChecked}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            ลบถาวร
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
                    setSelectedCourse(null);
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
                                setSelectedCourse(null);
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
