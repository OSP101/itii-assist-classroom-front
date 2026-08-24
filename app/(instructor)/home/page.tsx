"use client";

import { useDeferredValue, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { Pagination } from "@heroui/pagination";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Tooltip } from "@heroui/tooltip";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { authService } from "@/services/auth.service";
import { courseService, Course, Instructor } from "@/services/course.service";
import { useSocket } from "@/contexts/SocketContext";
import { CourseListSkeleton } from "@/components/loading-skeletons";
import {
    instructorFlatButtonClass,
    instructorPrimaryButtonClass,
} from "@/components/ui/instructor-button-styles";
import { useI18n } from "@/hooks/useI18n";
import Link from "next/link";
import { IoSchool, IoBook, IoPeople, IoPersonAdd } from "react-icons/io5";
import { CourseCoverEditor, CourseCoverImage, buildCourseCoverRecommendedSizeText, uploadCourseCoverIfNeeded } from "@/components/course";

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
    const t = useI18n();
    const { subscribeToCourseUpdates, unsubscribeFromCourseUpdates, onCourseUpdate, emitCourseUpdate, isConnected } = useSocket();
    const [courses, setCourses] = useState<Course[]>([]);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 12,
        hasMore: false,
    });
    const [stats, setStats] = useState<Stats | null>(null);
    const [isInitialCoursesLoading, setIsInitialCoursesLoading] = useState(true);
    const [isRefreshingCourses, setIsRefreshingCourses] = useState(false);
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
    const currentYear = new Date().getFullYear() + 543;
    const [formData, setFormData] = useState({
        code: "",
        name: "",
        year: currentYear,
        semester: 1,
        description: "",
        image: "",
        cover_position_x: 50,
        cover_position_y: 50,
        cover_zoom: 1,
        instructor_ids: [] as number[],
        attention_threshold: 60,
    });

    // Track original form data for change detection (edit mode)
    const [originalFormData, setOriginalFormData] = useState<typeof formData | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [yearFilter, setYearFilter] = useState("");
    const [semesterFilter, setSemesterFilter] = useState("");
    const deferredSearch = useDeferredValue(search);

    const hasLoadedCoursesRef = useRef(false);
    const filterSignature = useMemo(
        () => `${deferredSearch.trim()}|${yearFilter}|${semesterFilter}`,
        [deferredSearch, yearFilter, semesterFilter],
    );
    const lastFilterSignatureRef = useRef(filterSignature);

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

    // Fetch instructors for multi-select (exclude current user). This backs
    // the create/edit course modal only, so it's fetched lazily the first
    // time either modal opens instead of on every home page load — the
    // endpoint returns every instructor account in the system with no
    // pagination, and most page visits never open either modal.
    const instructorsFetchedRef = useRef(false);
    const fetchInstructors = useCallback(async () => {
        if (instructorsFetchedRef.current) return;
        instructorsFetchedRef.current = true;
        try {
            const response = await courseService.getInstructors();
            if (response.success && response.data) {
                setInstructors(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch instructors:", error);
            instructorsFetchedRef.current = false;
        }
    }, []);

    // Fetch courses with server-side pagination and filters
    const fetchCourses = useCallback(async (background = false) => {
        if (!hasLoadedCoursesRef.current) {
            setIsInitialCoursesLoading(true);
        } else if (background) {
            setIsRefreshingCourses(true);
        }

        try {
            const response = await courseService.getMyCourses({
                page: currentPage,
                limit: itemsPerPage,
                search: deferredSearch.trim() || undefined,
                year: yearFilter ? Number(yearFilter) : undefined,
                semester: semesterFilter ? Number(semesterFilter) : undefined,
                status: "active",
                sortBy: "year",
                sortOrder: "DESC",
            });
            if (response.success && response.data) {
                setCourses(response.data.courses);
                setPagination(response.data.pagination);
            }
        } catch (error) {
            console.error("Failed to fetch courses:", error);
        } finally {
            hasLoadedCoursesRef.current = true;
            setIsInitialCoursesLoading(false);
            setIsRefreshingCourses(false);
        }
    }, [currentPage, deferredSearch, itemsPerPage, semesterFilter, yearFilter]);

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
        fetchStats();
    }, [fetchStats]);

    useEffect(() => {
        if (lastFilterSignatureRef.current !== filterSignature) {
            lastFilterSignatureRef.current = filterSignature;
            if (currentPage !== 1) {
                setCurrentPage(1);
                return;
            }
        }

        fetchCourses(false);
    }, [currentPage, filterSignature, fetchCourses]);

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
            // Refresh data when any course change is detected
            fetchCourses(true);
            fetchStats();

            // Show notification
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

    const paginatedCourses = courses;
    const totalPages = pagination.totalPages || 1;

    const clearFilters = () => {
        setSearch("");
        setYearFilter("");
        setSemesterFilter("");
    };

    const hasActiveFilters = Boolean(search.trim() || yearFilter || semesterFilter);

    // Generate year options from server stats to avoid loading the full course list
    const yearOptions = useMemo(() => {
        const years = stats?.years ?? [];
        return years.map(year => ({
            value: year.toString(),
            label: `${year}`,
        }));
    }, [stats?.years]);

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

    const courseCoverEditorText = {
        title: t("courseImage"),
        emptyTitle: t("clickToUploadCourseCover"),
        emptyHint: t("courseImageHint"),
        recommendedSize: buildCourseCoverRecommendedSizeText(t("courseCoverRecommendedSize")),
        editCover: t("courseImage"),
        changeImage: t("changeImage"),
        removeImage: t("removeImage"),
        adjustCover: t("adjustCourseCover"),
        modalTitle: t("courseCoverAdjustTitle"),
        modalHint: t("courseCoverAdjustHint"),
        horizontalPosition: t("courseCoverHorizontalPosition"),
        verticalPosition: t("courseCoverVerticalPosition"),
        zoom: t("courseCoverZoom"),
        cancel: t("cancel"),
        apply: t("applyCourseCover"),
        invalidFileType: t("pleaseSelectImageFileOnly"),
        fileTooLarge: t("courseImageHint"),
        dragHint: t("courseCoverDragHint"),
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

    const handleCreateCourse = () => {
        fetchInstructors();
        setIsCreateModalOpen(true);
    };

    const resetForm = () => {
        setFormData({
            code: "",
            name: "",
            year: currentYear,
            semester: 1,
            description: "",
            image: "",
            cover_position_x: 50,
            cover_position_y: 50,
            cover_zoom: 1,
            instructor_ids: [],
            attention_threshold: 60,
        });
        setOriginalFormData(null);
    };

    // Check if form has changes
    const hasFormChanges = () => {
        if (!originalFormData) return false;
        return JSON.stringify(formData) !== JSON.stringify(originalFormData);
    };

    const handleCreate = async () => {
        if (!formData.code || !formData.name) {
            addToast({
                title: t("pleaseFillRequiredFields"),
                description: t("courseCodeAndNameRequired"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const coverImageUrl = await uploadCourseCoverIfNeeded(formData.image);
            const response = await courseService.createCourse({
                code: formData.code,
                name: formData.name,
                year: formData.year,
                semester: formData.semester,
                description: formData.description || undefined,
                image: coverImageUrl,
                cover_position_x: formData.cover_position_x,
                cover_position_y: formData.cover_position_y,
                cover_zoom: formData.cover_zoom,
                instructor_ids: formData.instructor_ids.length > 0 ? formData.instructor_ids : undefined,
                attention_threshold: formData.attention_threshold,
            });

            if (response.success) {
                addToast({
                    title: t("createCourseSuccess"),
                    description: formatCourseTitle({ code: formData.code, name: formData.name }),
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                setIsCreateModalOpen(false);
                resetForm();
                fetchCourses(true);
                fetchStats();
                // Emit real-time update to other clients
                emitCourseUpdate("create", response.data?.id);
            } else {
                // Handle API error response (e.g., duplicate course)
                const errorMessage = typeof response.error === 'object' && response.error !== null
                    ? (response.error as { message?: string }).message
                    : response.error || response.message;
                addToast({
                    title: t("createCourseFailed"),
                    description: getLocalizedErrorMessage(errorMessage, t("createCourseErrorDefault")),
                    color: "danger",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: any) {
            addToast({
                title: t("somethingWentWrong"),
                description: getLocalizedErrorMessage(error?.message, t("createCourseErrorDefault")),
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
        fetchInstructors();
        setSelectedCourse(course);
        // Get instructor IDs from the instructors array (exclude self)
        const instructorIdList = course.instructors?.map(i => i.id).filter(id => id !== currentUserId) || [];
        const courseData = {
            code: course.code,
            name: course.name,
            year: course.year,
            semester: course.semester,
            description: course.description || "",
            image: course.image || "",
            cover_position_x: course.cover_position_x ?? 50,
            cover_position_y: course.cover_position_y ?? 50,
            cover_zoom: course.cover_zoom ?? 1,
            instructor_ids: instructorIdList,
            attention_threshold: course.attention_threshold ?? 60,
        };
        setFormData(courseData);
        setOriginalFormData(courseData);
        setIsEditModalOpen(true);
    };

    // Handle Update Course
    const handleUpdate = async () => {
        if (!selectedCourse) return;
        if (!formData.code || !formData.name) {
            addToast({
                title: t("pleaseFillRequiredFields"),
                description: t("courseCodeAndNameRequired"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const coverImageUrl = await uploadCourseCoverIfNeeded(formData.image);
            const response = await courseService.updateCourse(selectedCourse.id, {
                code: formData.code,
                name: formData.name,
                year: formData.year,
                semester: formData.semester,
                description: formData.description || undefined,
                image: coverImageUrl,
                cover_position_x: formData.cover_position_x,
                cover_position_y: formData.cover_position_y,
                cover_zoom: formData.cover_zoom,
                instructor_ids: formData.instructor_ids.length > 0 ? formData.instructor_ids : undefined,
                attention_threshold: formData.attention_threshold,
            });

            if (response.success) {
                addToast({
                    title: t("updateCourseSuccess"),
                    description: formatCourseTitle({ code: formData.code, name: formData.name }),
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                setIsEditModalOpen(false);
                resetForm();
                setSelectedCourse(null);
                fetchCourses(true);
                // Emit real-time update to other clients
                emitCourseUpdate("update", selectedCourse.id);
            } else {
                const errorMessage = typeof response.error === 'object' && response.error !== null
                    ? (response.error as { message?: string }).message
                    : response.error || response.message;
                addToast({
                    title: t("updateCourseFailed"),
                    description: getLocalizedErrorMessage(errorMessage, t("updateCourseErrorDefault")),
                    color: "danger",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: any) {
            addToast({
                title: t("somethingWentWrong"),
                description: getLocalizedErrorMessage(error?.message, t("updateCourseErrorDefault")),
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
            const checkDuplicateActiveCourse = async () => {
                try {
                    const response = await courseService.getMyCourses({
                        status: "active",
                        search: course.code,
                        year: course.year,
                        semester: course.semester,
                        limit: 20,
                    });

                    const duplicateActiveCourse = response.success && response.data
                        ? response.data.courses.find(
                            (c) =>
                                c.id !== course.id &&
                                c.code === course.code &&
                                c.year === course.year &&
                                c.semester === course.semester &&
                                c.is_active === true,
                        )
                        : null;

                    if (duplicateActiveCourse) {
                        setDuplicateCourse(duplicateActiveCourse);
                        setIsDuplicateWarningModalOpen(true);
                        return;
                    }

                    setIsToggleStatusModalOpen(true);
                } catch (error) {
                    console.error("Failed to check duplicate active course:", error);
                    setIsToggleStatusModalOpen(true);
                }
            };

            void checkDuplicateActiveCourse();
            return;
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
                    title: courseToToggle.is_active ? t("courseDisabledSuccess") : t("courseEnabledSuccess"),
                    description: formatCourseTitle(courseToToggle),
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                setIsToggleStatusModalOpen(false);
                setCourseToToggle(null);
                fetchCourses(true);
                fetchStats();
                // Emit real-time update to other clients
                emitCourseUpdate("toggle", courseToToggle.id);
            } else {
                const errorMessage = typeof response.error === 'object' && response.error !== null
                    ? (response.error as { message?: string }).message
                    : response.error || response.message;
                addToast({
                    title: t("toggleCourseStatusFailed"),
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

    return (
        <div className="w-full space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{t("myCourses")}</h1>
                        <Skeleton isLoaded={!isUserRoleLoading} className="mt-2 w-44 h-5 rounded-lg">
                            <p className="mt-1 text-default-500">
                                {userRole === "instructor"
                                    ? t("coursesYouTeach")
                                    : t("coursesYouAssist")}
                            </p>
                        </Skeleton>
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
                        <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600" startContent={<Spinner size="sm" color="primary" />}>
                            {t("updatingData")}
                        </Chip>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        color="default"
                        variant="bordered"
                        onPress={() => router.push('/home/closed')}
                    >
                        {t("disabledCourses")}
                        <Skeleton isLoaded={Boolean(stats)} className="ml-1 w-7 h-5 rounded-full">
                            <Chip size="sm" className="ml-1 bg-content3 text-default-600" variant="flat">
                                {stats?.byStatus?.inactive ?? 0}
                            </Chip>
                        </Skeleton>
                    </Button>
                    {isUserRoleLoading ? (
                        <Skeleton className="w-40 h-10 rounded-lg bg-blue-100" />
                    ) : userRole === "instructor" && (
                        <Button
                            color="primary"
                            onPress={handleCreateCourse}
                            className={instructorPrimaryButtonClass()}
                        >
                            {t("createNewCourse")}
                        </Button>
                    )}
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
                                startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400" />}
                                isClearable
                                onClear={() => setSearch("")}
                                variant="bordered"
                                classNames={{
                                    inputWrapper: "border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-blue-400 text-sm",
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
                <CourseListSkeleton viewMode={viewMode} />
            ) : paginatedCourses.length === 0 ? (
                <div className="w-full grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Card className="col-span-full w-full border border-default-200 shadow-sm">
                        <CardBody className="flex min-h-70 flex-col items-center justify-center py-12 sm:py-16">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-content2">
                                <IoBook className="text-3xl text-default-400" />
                            </div>
                            <p className="max-w-2xl text-center text-default-500">
                                {hasActiveFilters
                                    ? t("noResultsFound")
                                    : t("noActiveCourses")}
                            </p>
                            {hasActiveFilters && (
                                <Button
                                    variant="flat"
                                    color="primary"
                                    className="mt-4"
                                    onPress={clearFilters}
                                >
                                    {t("clearFilters")}
                                </Button>
                            )}
                        </CardBody>
                    </Card>
                </div>
            ) : viewMode === "grid" ? (
                /* Grid View */
                <>
                    <div className="w-full grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {paginatedCourses.map((course) => (
                            <Card
                                key={course.id}
                                as="div"
                                isPressable
                                onPress={() => handleCourseClick(course.id)}
                                className="border border-default-200 shadow-sm transition-shadow hover:shadow-md"
                            >
                                {/* Course Image/Banner */}
                                <div className="relative h-36 overflow-hidden sm:h-40 lg:h-44">
                                    {course.image ? (
                                        <CourseCoverImage
                                            src={course.image}
                                            alt={course.name}
                                            positionX={course.cover_position_x}
                                            positionY={course.cover_position_y}
                                            zoom={course.cover_zoom}
                                            className="block h-full w-full"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-400 to-indigo-500">
                                            <IoSchool className="text-white/20 text-7xl" />
                                        </div>
                                    )}
                                </div>

                                <CardBody className="p-4">
                                    <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="truncate font-semibold text-foreground">
                                                    {course.code}
                                                </h3>
                                                <p className="line-clamp-1 text-sm text-default-600">
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
                                                            {t("editCourse")}
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
                                                            {course.is_active ? t("disableCourse") : t("enableCourse")}
                                                        </DropdownItem>
                                                    </DropdownMenu>
                                                </Dropdown>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
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
                    <div className="w-full space-y-2">
                        {paginatedCourses.map((course) => (
                            <Card
                                key={course.id}
                                as="div"
                                isPressable
                                onPress={() => handleCourseClick(course.id)}
                                className="w-full border border-default-200 shadow-sm transition-shadow hover:shadow-md"
                            >
                                <CardBody className="p-3 sm:p-4">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        {/* Course Image/Icon */}
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 relative overflow-hidden rounded-lg shrink-0">
                                            {course.image ? (
                                                <CourseCoverImage
                                                    src={course.image}
                                                    alt={course.name}
                                                    positionX={course.cover_position_x}
                                                    positionY={course.cover_position_y}
                                                    zoom={course.cover_zoom}
                                                    className="h-full w-full"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-linear-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                                    <IoSchool className="text-white/30 text-2xl sm:text-3xl" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Course Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="truncate font-semibold text-foreground">
                                                        {course.code} - {course.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 flex-wrap mt-1">
                                                        <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
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
                                                                {t("editCourse")}
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
                                                                {course.is_active ? t("disableCourse") : t("enableCourse")}
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

            {/* Create Course Modal */}
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
                            <div className="p-2 sm:p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:book-2-bold" className="text-xl sm:text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground sm:text-xl">{t("addNewCourse")}</h3>
                                <p className="mt-1 text-xs font-normal text-default-500 sm:text-sm">{t("fillCourseDetailsInSystem")}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-4 sm:px-6 py-4 sm:py-6">
                        <div className="space-y-5">
                            {/* Course Image Section */}
                            <CourseCoverEditor
                                value={{
                                    image: formData.image,
                                    cover_position_x: formData.cover_position_x,
                                    cover_position_y: formData.cover_position_y,
                                    cover_zoom: formData.cover_zoom,
                                }}
                                onChange={(value) => setFormData((prev) => ({ ...prev, ...value }))}
                                text={courseCoverEditorText}
                                accentClassName="text-blue-500"
                                onValidationError={(message) => addToast({ title: t("invalidFileType"), description: message, color: "warning", timeout: 3000, shouldShowTimeoutProgress: true })}
                            />

                            {/* Course Info Section */}
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:document-text-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("courseInformation")}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
                                    <div className="md:col-span-2">
                                        <Input
                                            label={t("courseCode")}
                                            labelPlacement="outside"
                                            placeholder={t("enterCourseCodeExample")}
                                            variant="bordered"
                                            size="md"
                                            value={formData.code}
                                            onValueChange={(value) => setFormData({ ...formData, code: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:hashtag-linear" className="text-blue-400 text-xl" />}
                                            classNames={{
                                                inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                                label: "text-default-600 font-medium text-sm",
                                            }}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Input
                                            label={t("courseName")}
                                            labelPlacement="outside"
                                            placeholder={t("enterCourseNameExample")}
                                            variant="bordered"
                                            size="md"
                                            value={formData.name}
                                            onValueChange={(value) => setFormData({ ...formData, name: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:book-linear" className="text-blue-400 text-xl" />}
                                            classNames={{
                                                inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                                label: "text-default-600 font-medium text-sm",
                                            }}
                                        />
                                    </div>
                                    <Input
                                        label={t("academicYear")}
                                        labelPlacement="outside"
                                        placeholder={t("enterAcademicYearExample")}
                                        variant="bordered"
                                        size="md"
                                        type="number"
                                        value={formData.year.toString()}
                                        onValueChange={(value) => setFormData({ ...formData, year: parseInt(value) || currentYear })}
                                        isRequired
                                        startContent={<Icon icon="solar:calendar-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    />
                                    <Select
                                        label={t("semesterLabel")}
                                        labelPlacement="outside"
                                        placeholder={t("selectSemester")}
                                        variant="bordered"
                                        size="md"
                                        selectedKeys={[formData.semester.toString()]}
                                        onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1 })}
                                        isRequired
                                        classNames={{
                                            trigger: "bg-content1 border-default-200 hover:border-blue-300",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    >
                                        {semesterOptions.map((option) => (
                                            <SelectItem key={option.value}>{option.label}</SelectItem>
                                        ))}
                                    </Select>
                                </div>
                            </div>

                            {/* Instructors Section */}
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:users-group-two-rounded-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("coInstructorsLabel")}</span>
                                </div>
                                <div className="py-3">
                                    <Select
                                        label={t("coInstructorsLabel")}
                                        labelPlacement="outside"
                                        placeholder={t("selectCoInstructorsPlaceholder")}
                                        variant="bordered"
                                        selectionMode="multiple"
                                        size="md"
                                        selectedKeys={new Set(formData.instructor_ids.map(id => id.toString()))}
                                        onSelectionChange={(keys) => {
                                            const selectedIds = Array.from(keys).map(k => parseInt(k as string));
                                            setFormData({ ...formData, instructor_ids: selectedIds });
                                        }}
                                        classNames={{
                                            trigger: "bg-content1 border-default-200 hover:border-blue-300",
                                            label: "text-default-600 font-medium text-sm",
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
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:chart-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("attentionThresholdTitle")}</span>
                                </div>
                                <div className="py-3">
                                    <Input
                                        label={t("minimumScorePercentage")}
                                        labelPlacement="outside"
                                        placeholder={t("enterThresholdExample")}
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
                                        endContent={<span className="text-default-400">%</span>}
                                        description={t("attentionThresholdDescription")}
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Description Section */}
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:notes-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("additionalDetails")}</span>
                                </div>
                                <div className="py-3">
                                    <Textarea
                                        label={t("courseDescription")}
                                        labelPlacement="outside"
                                        placeholder={t("courseDescriptionOptional")}
                                        variant="bordered"
                                        value={formData.description}
                                        onValueChange={(value) => setFormData({ ...formData, description: value })}
                                        minRows={3}
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button
                            variant="light"
                            color="default"
                            onPress={() => {
                                setIsCreateModalOpen(false);
                                resetForm();
                            }}
                            className="font-medium px-6"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleCreate}
                            isLoading={isSubmitting}
                            isDisabled={!formData.code.trim() || !formData.name.trim()}
                            className={instructorPrimaryButtonClass("font-medium px-6")}
                        >
                            {t("createCourse")}
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
                            <div className="p-2 sm:p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:pen-new-square-bold" className="text-xl sm:text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground sm:text-xl">{t("editCourse")}</h3>
                                <p className="mt-1 text-xs font-normal text-default-500 sm:text-sm">
                                    {t("editCourseForCode", { code: selectedCourse?.code || "" })}
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-4 sm:px-6 py-4 sm:py-6">
                        <div className="space-y-5">
                            {/* Course Image Section */}
                            <CourseCoverEditor
                                value={{
                                    image: formData.image,
                                    cover_position_x: formData.cover_position_x,
                                    cover_position_y: formData.cover_position_y,
                                    cover_zoom: formData.cover_zoom,
                                }}
                                onChange={(value) => setFormData((prev) => ({ ...prev, ...value }))}
                                text={courseCoverEditorText}
                                accentClassName="text-amber-500"
                                onValidationError={(message) => addToast({ title: t("invalidFileType"), description: message, color: "warning", timeout: 3000, shouldShowTimeoutProgress: true })}
                            />

                            {/* Course Info Section */}
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:document-text-bold" className="text-lg text-amber-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("courseInformation")}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
                                    <div className="md:col-span-2">
                                        <Input
                                            label={t("courseCode")}
                                            labelPlacement="outside"
                                            placeholder={t("enterCourseCodeExample")}
                                            variant="bordered"
                                            size="lg"
                                            value={formData.code}
                                            onValueChange={(value) => setFormData({ ...formData, code: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:hashtag-linear" className="text-amber-400 text-xl" />}
                                            classNames={{
                                                inputWrapper: "h-12 bg-content1 border-default-200 hover:border-amber-300 focus-within:!border-amber-400",
                                                label: "text-default-600 font-medium text-sm",
                                            }}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Input
                                            label={t("courseName")}
                                            labelPlacement="outside"
                                            placeholder={t("enterCourseNameExample")}
                                            variant="bordered"
                                            size="lg"
                                            value={formData.name}
                                            onValueChange={(value) => setFormData({ ...formData, name: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:book-linear" className="text-amber-400 text-xl" />}
                                            classNames={{
                                                inputWrapper: "h-12 bg-content1 border-default-200 hover:border-amber-300 focus-within:!border-amber-400",
                                                label: "text-default-600 font-medium text-sm",
                                            }}
                                        />
                                    </div>
                                    <Input
                                        label={t("academicYear")}
                                        labelPlacement="outside"
                                        placeholder={t("enterAcademicYearExample")}
                                        variant="bordered"
                                        size="lg"
                                        type="number"
                                        value={formData.year.toString()}
                                        onValueChange={(value) => setFormData({ ...formData, year: parseInt(value) || currentYear })}
                                        isRequired
                                        startContent={<Icon icon="solar:calendar-linear" className="text-amber-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-content1 border-default-200 hover:border-amber-300 focus-within:!border-amber-400",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    />
                                    <Select
                                        label={t("semesterLabel")}
                                        labelPlacement="outside"
                                        placeholder={t("selectSemester")}
                                        variant="bordered"
                                        size="lg"
                                        selectedKeys={[formData.semester.toString()]}
                                        onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1 })}
                                        isRequired
                                        classNames={{
                                            trigger: "h-12 bg-content1 border-default-200 hover:border-amber-300",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    >
                                        {semesterOptions.map((option) => (
                                            <SelectItem key={option.value}>{option.label}</SelectItem>
                                        ))}
                                    </Select>
                                </div>
                            </div>

                            {/* Instructors Section */}
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:users-group-two-rounded-bold" className="text-lg text-amber-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("coInstructorsLabel")}</span>
                                </div>
                                <div className="py-3">
                                    <Select
                                        label={t("coInstructorsLabel")}
                                        labelPlacement="outside"
                                        placeholder={t("selectCoInstructorsPlaceholder")}
                                        variant="bordered"
                                        selectionMode="multiple"
                                        selectedKeys={new Set(formData.instructor_ids.map(id => id.toString()))}
                                        onSelectionChange={(keys) => {
                                            const selectedIds = Array.from(keys).map(k => parseInt(k as string));
                                            setFormData({ ...formData, instructor_ids: selectedIds });
                                        }}
                                        classNames={{
                                            trigger: "min-h-12 bg-content1 border-default-200 hover:border-amber-300",
                                            label: "text-default-600 font-medium text-sm",
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
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:chart-bold" className="text-lg text-amber-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("attentionThresholdTitle")}</span>
                                </div>
                                <div className="py-3">
                                    <Input
                                        label={t("minimumScorePercentage")}
                                        labelPlacement="outside"
                                        placeholder={t("enterThresholdExample")}
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
                                        endContent={<span className="text-default-400">%</span>}
                                        description={t("attentionThresholdDescription")}
                                        classNames={{
                                            inputWrapper: "h-12 bg-content1 border-default-200 hover:border-amber-300 focus-within:!border-amber-400",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Description Section */}
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:notes-bold" className="text-lg text-amber-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("additionalDetails")}</span>
                                </div>
                                <div className="py-3">
                                    <Textarea
                                        label={t("courseDescription")}
                                        labelPlacement="outside"
                                        placeholder={t("courseDescriptionOptional")}
                                        variant="bordered"
                                        value={formData.description}
                                        onValueChange={(value) => setFormData({ ...formData, description: value })}
                                        minRows={3}
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-amber-300 focus-within:!border-amber-400",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
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
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleUpdate}
                            isLoading={isSubmitting}
                            isDisabled={!hasFormChanges()}
                            className={instructorPrimaryButtonClass("font-medium px-6")}
                        >
                            {t("saveChanges")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Toggle Status Modal */}
            <Modal
                isOpen={isToggleStatusModalOpen}
                onClose={() => {
                    setIsToggleStatusModalOpen(false);
                    setCourseToToggle(null);
                }}
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-linear-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-500/30">
                                <Icon
                                    icon={courseToToggle?.is_active ? "solar:eye-closed-bold" : "solar:eye-bold"}
                                    className="text-2xl text-white"
                                />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">
                                {courseToToggle?.is_active ? t("confirmDisableTitle") : t("confirmEnableTitle")}
                            </h3>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className={`rounded-2xl p-6 border ${courseToToggle?.is_active ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${courseToToggle?.is_active ? "bg-amber-100" : "bg-emerald-100"}`}>
                                    <Icon icon="solar:book-bold" className={`text-2xl ${courseToToggle?.is_active ? "text-amber-600" : "text-emerald-600"}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">{formatCourseTitle(courseToToggle)}</p>
                                    <p className="text-sm text-default-500">{formatAcademicYearSemester(courseToToggle?.year, courseToToggle?.semester)}</p>
                                </div>
                            </div>
                            <p className={`mt-4 text-sm ${courseToToggle?.is_active ? "text-amber-700" : "text-emerald-700"}`}>
                                {courseToToggle?.is_active ? t("disabledCourseVisibilityHint") : t("activateCourseDuplicateHint")}
                            </p>
                        </div>
                    </ModalBody>
                    <ModalFooter className="gap-3 border-t border-divider px-6 py-4">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => {
                                setIsToggleStatusModalOpen(false);
                                setCourseToToggle(null);
                            }}
                            className="font-medium px-6"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleToggleStatus}
                            isLoading={isSubmitting}
                            className={instructorPrimaryButtonClass("font-medium px-6")}
                        >
                            {courseToToggle?.is_active ? t("disableAction") : t("enableAction")}
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
                            <p className="text-foreground">{t("cannotEnableSelectedCourse", { code: courseToToggle?.code || "" })}</p>
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
                                setCourseToToggle(null);
                            }}
                            className={instructorPrimaryButtonClass("font-medium px-6")}
                        >
                            {t("acknowledged")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
