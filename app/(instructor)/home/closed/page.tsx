"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
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
import { CourseListSkeleton } from "@/components/loading-skeletons";
import { instructorFlatButtonClass } from "@/components/ui/instructor-button-styles";
import { useI18n } from "@/hooks/useI18n";
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
    const t = useI18n();
    const { subscribeToCourseUpdates, unsubscribeFromCourseUpdates, onCourseUpdate, emitCourseUpdate, isConnected } = useSocket();
    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [isInitialCoursesLoading, setIsInitialCoursesLoading] = useState(true);
    const [isRefreshingCourses, setIsRefreshingCourses] = useState(false);
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
    const hasLoadedCoursesRef = useRef(false);

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
    const fetchCourses = useCallback(async (background = false) => {
        if (!hasLoadedCoursesRef.current) {
            setIsInitialCoursesLoading(true);
        } else if (background) {
            setIsRefreshingCourses(true);
        }

        try {
            // Fetch all courses without pagination (set high limit)
            const response = await courseService.getMyCourses({ limit: 1000 });
            if (response.success && response.data) {
                setAllCourses(response.data.courses);
            }
        } catch (error) {
            console.error("Failed to fetch courses:", error);
        } finally {
            hasLoadedCoursesRef.current = true;
            setIsInitialCoursesLoading(false);
            setIsRefreshingCourses(false);
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
        fetchCourses(false);
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
            fetchCourses(true);
            fetchStats();

            addToast({
                title: t("courseDataUpdated"),
                description: t("courseDataChanged"),
                color: "primary",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        });

        return () => {
            unsubscribe();
        };
    }, [onCourseUpdate, fetchCourses, fetchStats, t]);

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

    const getSemesterLabel = (semester: number, short = false) => {
        if (semester === 3) {
            return t("summerSemester");
        }

        return t(short ? "semesterShortWithNumber" : "semesterWithNumber", { number: semester });
    };

    const semesterOptions = [
        { value: "1", label: t("semesterOne") },
        { value: "2", label: t("semesterTwo") },
        { value: "3", label: t("summerSemester") },
    ];

    const getSemesterText = (semester: number) => {
        return getSemesterLabel(semester);
    };

    const formatCourseTitle = (course?: Pick<Course, "code" | "name"> | null) => {
        if (!course) {
            return "";
        }

        return `${course.code} - ${course.name}`;
    };

    const formatAcademicYearSemester = (year?: number, semester?: number) => {
        if (!year || !semester) {
            return "";
        }

        return t("academicYearSemesterSummary", {
            year,
            semester: getSemesterLabel(semester),
        });
    };

    const getLocalizedErrorMessage = (message: unknown, fallbackMessage: string) => {
        if (typeof message === "string" && message.trim() && !/[\u0E00-\u0E7F]/.test(message)) {
            return message;
        }

        return fallbackMessage;
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
                    title: t("courseEnabledSuccess"),
                    description: formatCourseTitle(selectedCourse),
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                setIsRestoreModalOpen(false);
                setSelectedCourse(null);
                fetchCourses(true);
                fetchStats();
                emitCourseUpdate("toggle", selectedCourse.id);
            } else {
                const errorMessage = typeof response.error === 'object' && response.error !== null
                    ? (response.error as { message?: string }).message
                    : response.error || response.message;
                addToast({
                    title: t("cannotEnableCourse"),
                    description: getLocalizedErrorMessage(errorMessage, t("toggleCourseStatusErrorDefault")),
                    color: "danger",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: any) {
            addToast({
                title: t("somethingWentWrong"),
                description: getLocalizedErrorMessage(error?.message, t("toggleCourseStatusErrorDefault")),
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
                    title: t("deleteCourseSuccess"),
                    description: formatCourseTitle(selectedCourse),
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                setIsDeleteModalOpen(false);
                setSelectedCourse(null);
                setDeleteConfirmChecked(false);
                fetchCourses(true);
                fetchStats();
                emitCourseUpdate("delete", selectedCourse.id);
            } else {
                const errorMessage = typeof response.error === 'object' && response.error !== null
                    ? (response.error as { message?: string }).message
                    : response.error || response.message;
                addToast({
                    title: t("deleteCourseFailed"),
                    description: getLocalizedErrorMessage(errorMessage, t("deleteCourseFailed")),
                    color: "danger",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: any) {
            addToast({
                title: t("somethingWentWrong"),
                description: getLocalizedErrorMessage(error?.message, t("deleteCourseFailed")),
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
                            <h1 className="text-2xl font-bold text-foreground">{t("disabledCourses")}</h1>
                            <Chip size="sm" variant="flat" className="bg-content3 text-default-600">
                                {filteredCourses.length}
                            </Chip>
                        </div>
                        <p className="mt-1 text-default-500">
                            {t("closedCoursesDescription")}
                        </p>
                    </div>
                    {/* Real-time connection indicator */}
                    <Tooltip content={isConnected ? t("realTimeData") : t("connecting")}>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${isConnected ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                            }`}>
                            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500 animate-bounce"
                                }`} />
                            <span className="hidden sm:inline">{isConnected ? t("live") : "..."}</span>
                        </div>
                    </Tooltip>
                    {isRefreshingCourses && (
                        <Chip size="sm" variant="flat" color="primary">
                            {t("updatingData")}
                        </Chip>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        color="primary"
                        variant="bordered"
                        onPress={() => router.push('/home')}
                    >
                        {t("activeCourses")}
                        <Skeleton isLoaded={Boolean(stats)} className="ml-1 h-5 w-7 rounded-full bg-primary/10">
                            <Chip size="sm" className="ml-1" color="primary" variant="flat">
                                {stats?.byStatus?.active ?? 0}
                            </Chip>
                        </Skeleton>
                    </Button>
                </div>
            </div>


            {/* Filters */}
            <Card className="w-full border border-default-200 shadow-sm">
                <CardBody className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex flex-row gap-2 sm:gap-3 w-full">
                            <Input
                                aria-label={t("searchCourses")}
                                placeholder={`${t("searchCourses")}...`}
                                value={search}
                                onValueChange={setSearch}
                                startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                                isClearable
                                onClear={() => setSearch("")}
                                variant="bordered"
                                classNames={{
                                    inputWrapper: "border-default-200 hover:border-default-300 focus-within:!border-default-400",
                                    label: "text-default-400 text-sm",
                                }}
                            />

                            <div className="flex items-center overflow-hidden rounded-lg border border-default-200 bg-content1">
                                <Tooltip content={t("gridView")}>
                                    <Button
                                        aria-label={t("showGridView")}
                                        isIconOnly
                                        size="md"
                                        variant="light"
                                        className={`rounded-none ${viewMode === "grid" ? "bg-content3" : ""}`}
                                        onPress={() => setViewMode("grid")}
                                    >
                                        <Icon icon="solar:widget-bold" className={`text-lg ${viewMode === "grid" ? "text-blue-600" : "text-default-400"}`} />
                                    </Button>
                                </Tooltip>
                                <div className="h-5 w-px bg-divider" />
                                <Tooltip content={t("listView")}>
                                    <Button
                                        aria-label={t("showListView")}
                                        isIconOnly
                                        size="md"
                                        variant="light"
                                        className={`rounded-none ${viewMode === "list" ? "bg-content3" : ""}`}
                                        onPress={() => setViewMode("list")}
                                    >
                                        <Icon icon="solar:list-bold" className={`text-lg ${viewMode === "list" ? "text-blue-600" : "text-default-400"}`} />
                                    </Button>
                                </Tooltip>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-row gap-2 sm:gap-3">
                            
                            <Select
                                aria-label={t("academicYear")}
                                placeholder={t("academicYear")}
                                selectedKeys={yearFilter ? [yearFilter] : []}
                                onSelectionChange={(keys) => setYearFilter(Array.from(keys)[0] as string || "")}
                                className="w-full sm:w-36"
                                size="md"
                                variant="bordered"
                                selectorIcon={<span className="hidden" />}
                            >
                                {yearOptions.map((option) => (
                                    <SelectItem key={option.value}>{option.label}</SelectItem>
                                ))}
                            </Select>

                            <Select
                                aria-label={t("semesterLabel")}
                                placeholder={t("semesterLabel")}
                                selectedKeys={semesterFilter ? [semesterFilter] : []}
                                onSelectionChange={(keys) => setSemesterFilter(Array.from(keys)[0] as string || "")}
                                className="w-full sm:w-32"
                                size="md"
                                variant="bordered"
                                selectorIcon={<span className="hidden" />}
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
                                    className={instructorFlatButtonClass()}
                                >
                                    {t("clear")}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Course List */}
            {isInitialCoursesLoading ? (
                <CourseListSkeleton viewMode={viewMode} tone="closed" />
            ) : paginatedCourses.length === 0 ? (
                <Card className="border border-default-200 shadow-sm">
                    <CardBody className="py-16 text-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="rounded-full bg-content3 p-4">
                                <Icon icon="solar:archive-bold-duotone" className="text-5xl text-default-400" />
                            </div>
                            <div>
                                <p className="text-lg font-medium text-default-700">
                                    {hasActiveFilters ? t("noResultsFound") : t("noClosedCourses")}
                                </p>
                                <p className="mt-1 text-default-500">
                                    {hasActiveFilters
                                        ? t("adjustSearchOrClearFilters")
                                        : t("noClosedCoursesDescription")}
                                </p>
                            </div>
                            {hasActiveFilters && (
                                <Button
                                    color="primary"
                                    variant="flat"
                                    className={instructorFlatButtonClass()}
                                    onPress={clearFilters}
                                >
                                    {t("clearFilters")}
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
                                as="div"
                                isPressable
                                onPress={() => handleCourseClick(course.id)}
                                className="border border-default-200 shadow-sm opacity-80 transition-shadow hover:opacity-100 hover:shadow-md"
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
                                                <div className="w-full h-full bg-linear-to-br from-slate-400 to-slate-500 flex items-center justify-center">
                                            <IoSchool className="text-white/20 text-7xl" />
                                        </div>
                                    )}
                                    {/* Closed badge */}
                                    <div className="absolute top-2 left-2">
                                        <Chip size="sm" color="default" variant="solid" className="bg-slate-700/80 text-white">
                                            <Icon icon="solar:archive-bold" className="mr-1" />
                                            {t("inactive")}
                                        </Chip>
                                    </div>
                                </div>

                                <CardBody className="p-4">
                                    <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="truncate font-semibold text-foreground">
                                                    {course.code}
                                                </h3>
                                                <p className="line-clamp-1 text-sm text-default-500">
                                                    {course.name}
                                                </p>
                                            </div>
                                            {/* Menu Button - Only for instructor */}
                                            {userRole === "instructor" && (
                                                <Dropdown>
                                                    <DropdownTrigger>
                                                        <Button
                                                            aria-label={t("courseMenu")}
                                                            isIconOnly
                                                            size="sm"
                                                            variant="light"
                                                            className="min-w-8 w-8 h-8"
                                                            onClick={(event) => event.stopPropagation()}
                                                            onKeyDown={(event) => event.stopPropagation()}
                                                        >
                                                                <Icon icon="solar:menu-dots-bold" className="text-lg text-default-500" />
                                                        </Button>
                                                    </DropdownTrigger>
                                                    <DropdownMenu
                                                        aria-label={t("courseMenu")}
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
                                                            color="success"
                                                        >
                                                            {t("enableCourse")}
                                                        </DropdownItem>
                                                        <DropdownItem
                                                            key="delete"
                                                            color="danger"
                                                            className="text-danger"
                                                        >
                                                            {t("deleteCoursePermanently")}
                                                        </DropdownItem>
                                                    </DropdownMenu>
                                                </Dropdown>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Chip size="sm" variant="flat" className="bg-content3 text-default-600">
                                                {course.year}/{course.semester}
                                            </Chip>
                                            <Chip size="sm" variant="flat" className="bg-content3 text-default-600">
                                                {getSemesterText(course.semester)}
                                            </Chip>
                                        </div>
                                    </div>
                                </CardBody>

                                <CardFooter className="border-t border-divider px-4 py-3">
                                    <div className="flex w-full items-center justify-between text-sm text-default-500">
                                        <div className="flex items-center gap-1">
                                            <IoPeople className="text-lg" />
                                            <span>{course.taCount ?? 0} TA</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <IoPersonAdd className="text-lg" />
                                            <span>{course.studentCount ?? 0} Student</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <IoBook className="text-lg" />
                                            <span>{course.sections?.length ?? 0} Section</span>
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
                                className="w-full border border-default-200 shadow-sm opacity-80 transition-shadow hover:opacity-100 hover:shadow-md"
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
                                                <div className="w-full h-full bg-linear-to-br from-slate-400 to-slate-500 flex items-center justify-center">
                                                    <IoSchool className="text-white/30 text-2xl sm:text-3xl" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Course Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="truncate font-semibold text-foreground">
                                                            {course.code} - {course.name}
                                                        </h3>
                                                        <Chip size="sm" color="default" variant="flat" className="shrink-0 bg-content3 text-default-600">
                                                            {t("inactive")}
                                                        </Chip>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap mt-1">
                                                        <Chip size="sm" variant="flat" className="bg-content3 text-default-600">
                                                            {course.year}/{course.semester}
                                                        </Chip>
                                                        <span className="text-sm text-default-500">
                                                            {getSemesterText(course.semester)}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Menu Button - Only for instructor */}
                                                {userRole === "instructor" && (
                                                    <Dropdown>
                                                        <DropdownTrigger>
                                                            <Button
                                                                aria-label={t("courseMenu")}
                                                                isIconOnly
                                                                size="sm"
                                                                variant="light"
                                                                className="min-w-8 w-8 h-8"
                                                                onClick={(event) => event.stopPropagation()}
                                                                onKeyDown={(event) => event.stopPropagation()}
                                                            >
                                                                <Icon icon="solar:menu-dots-bold" className="text-lg text-default-500" />
                                                            </Button>
                                                        </DropdownTrigger>
                                                        <DropdownMenu
                                                            aria-label={t("courseMenu")}
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
                                                                color="success"
                                                            >
                                                                {t("enableCourse")}
                                                            </DropdownItem>
                                                            <DropdownItem
                                                                key="delete"
                                                                color="danger"
                                                                className="text-danger"
                                                            >
                                                                {t("deleteCoursePermanently")}
                                                            </DropdownItem>
                                                        </DropdownMenu>
                                                    </Dropdown>
                                                )}
                                            </div>
                                            {/* Stats - Desktop Only */}
                                            <div className="mt-2 hidden items-center gap-4 text-sm text-default-500 sm:flex">
                                                <div className="flex items-center gap-1">
                                                    <IoPeople className="text-lg" />
                                                    <span>{course.taCount ?? 0} TA</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <IoPersonAdd className="text-lg" />
                                                    <span>{course.studentCount ?? 0} Student</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <IoBook className="text-lg" />
                                                    <span>{course.sections?.length ?? 0} Section</span>
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
                    <ModalHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-linear-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:eye-bold" className="text-2xl text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">{t("confirmEnableTitle")}</h3>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                                    <Icon icon="solar:book-bold" className="text-2xl text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">{formatCourseTitle(selectedCourse)}</p>
                                    <p className="text-sm text-default-500">{formatAcademicYearSemester(selectedCourse?.year, selectedCourse?.semester)}</p>
                                </div>
                            </div>
                            <p className="mt-4 text-sm text-emerald-700">{t("activateCourseDuplicateHint")}</p>
                        </div>
                    </ModalBody>
                    <ModalFooter className="gap-3 border-t border-divider px-6 py-4">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => {
                                setIsRestoreModalOpen(false);
                                setSelectedCourse(null);
                            }}
                            className="font-medium px-6"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleRestoreCourse}
                            isLoading={isSubmitting}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {t("enableAction")}
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
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-linear-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:trash-bin-trash-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{t("deleteCoursePermanently")}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">{t("irreversibleAction")}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="space-y-4">
                            <p className="text-default-600">
                                {t("doYouWantDeleteCourse", { course: formatCourseTitle(selectedCourse) })}
                            </p>

                            <div className="rounded-lg border border-danger-200 bg-danger-50/70 p-4 dark:border-danger/25 dark:bg-danger/10">
                                <div className="flex items-start gap-3">
                                    <Icon icon="solar:danger-triangle-bold" className="text-xl text-red-600 mt-0.5" />
                                    <div className="text-sm text-red-700">
                                        <p className="font-semibold mb-1">{t("irreversibleAction")}</p>
                                        <ul className="list-disc ml-4 space-y-1 text-red-600">
                                            <li>{t("deleteCourseRelatedDataWarning")}</li>
                                            <li>{t("deleteCourseScoresWarning")}</li>
                                            <li>{t("googleDriveFilesRemainWarning")}</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <Checkbox
                                isSelected={deleteConfirmChecked}
                                onValueChange={setDeleteConfirmChecked}
                                color="danger"
                                classNames={{
                                    label: "text-sm text-default-600"
                                }}
                            >
                                {t("confirmPermanentDeleteCourse")}
                            </Checkbox>
                        </div>
                    </ModalBody>
                    <ModalFooter className="gap-3 border-t border-divider px-6 py-4">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => {
                                setIsDeleteModalOpen(false);
                                setSelectedCourse(null);
                                setDeleteConfirmChecked(false);
                            }}
                            className="font-medium px-6"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleDeleteCourse}
                            isLoading={isSubmitting}
                            isDisabled={!deleteConfirmChecked}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {t("deleteCoursePermanently")}
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
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:danger-triangle-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{t("cannotEnableCourse")}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">{t("duplicateActiveCourseFound")}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="space-y-3 rounded-xl border border-danger-100 bg-danger-50/70 p-4 dark:border-danger/20 dark:bg-danger/10">
                            <p className="text-foreground">{t("cannotEnableSelectedCourse", { code: selectedCourse?.code || "" })}</p>
                            <p className="text-sm text-default-600">{t("duplicateCourseConflictDescription")}</p>
                            <div className="rounded-lg border border-danger-200 bg-content1 p-3 dark:border-danger/25">
                                <div className="flex items-center gap-2 mb-2">
                                    <Chip size="sm" color="danger" variant="flat">{t("currentlyActive")}</Chip>
                                </div>
                                <p className="font-semibold text-foreground">{formatCourseTitle(duplicateCourse)}</p>
                                <p className="mt-1 text-sm text-default-500">
                                    {t("duplicateCourseSummary", {
                                        year: duplicateCourse?.year || "",
                                        semester: duplicateCourse?.semester ? getSemesterLabel(duplicateCourse.semester) : "",
                                    })}
                                </p>
                            </div>
                            <p className="text-sm text-default-500">
                                <Icon icon="solar:info-circle-linear" className="inline mr-1" />
                                {t("disableConflictingCourseFirst")}
                            </p>
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button
                            color="primary"
                            onPress={() => {
                                setIsDuplicateWarningModalOpen(false);
                                setDuplicateCourse(null);
                                setSelectedCourse(null);
                            }}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {t("acknowledged")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
