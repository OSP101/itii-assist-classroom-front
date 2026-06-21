"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
} from "@heroui/table";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { IoSchool, IoBook, IoPeople, IoPersonAdd } from "react-icons/io5";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Textarea } from "@heroui/input";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { courseService } from "@/services/course.service";
import { useSocket } from "@/contexts/SocketContext";
import type { Course, CreateCourseDto, UpdateCourseDto, CourseStats, Instructor, CourseActivationConflict } from "@/services/course.service";
import { useTableParams } from "@/lib/table/use-table-params";
import TablePaginationFooter, { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/components/ui/table-pagination-footer";
import { MetricCardSkeleton, TableRowsSkeleton } from "@/components/ui/resource-loading";
import { useI18n } from "@/hooks/useI18n";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { CourseCoverEditor, CourseCoverImage, buildCourseCoverRecommendedSizeText } from "@/components/course";

// Column definitions
const columnDefs = [
    { key: "code", labelKey: "courseCode", sortable: true },
    { key: "name", labelKey: "courseName", sortable: true },
    { key: "year_semester", labelKey: "yearSemester", sortable: true },
    { key: "instructor", labelKey: "instructorLabel", sortable: false },
    { key: "sections", labelKey: "sectionsLabel", sortable: false },
    { key: "status", labelKey: "status", sortable: true },
    { key: "actions", labelKey: "actions", sortable: false },
];

const statusOptionDefs = [
    { key: "all", labelKey: "allStatuses" },
    { key: "active", labelKey: "active" },
    { key: "inactive", labelKey: "inactive" },
];

const semesterOptionDefs = [
    { key: "all", labelKey: "allSemesters" },
    { key: "1", labelKey: "semesterOne" },
    { key: "2", labelKey: "semesterTwo" },
    { key: "3", labelKey: "summerSemester" },
];

export default function CoursesPage() {
    const t = useI18n();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const router = useRouter();
    const { subscribeToCourseUpdates, unsubscribeFromCourseUpdates, onCourseUpdate, emitCourseUpdate, isConnected } = useSocket();
    const [courses, setCourses] = useState<Course[]>([]);
    const [stats, setStats] = useState<CourseStats | null>(null);
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isStatsLoading, setIsStatsLoading] = useState(true);

    // Pagination & Filters
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const {
        params,
        setSearch,
        setPage,
        setLimit,
        setSort,
        setFilter,
    } = useTableParams({
        defaultLimit: DEFAULT_TABLE_ROWS_PER_PAGE,
        defaultSort: "created_at",
        defaultOrder: "desc",
        searchDebounceMs: 300,
    });
    const [searchInput, setSearchInput] = useState(String(params.search ?? ""));

    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || DEFAULT_TABLE_ROWS_PER_PAGE;
    const search = String(params.search ?? "");
    const yearFilter = String(params.year ?? "all");
    const semesterFilter = String(params.semester ?? "all");
    const statusFilter = String(params.status ?? "all");
    const sortBy = String(params.sort ?? "created_at");
    const sortOrder: "ASC" | "DESC" = params.order === "asc" ? "ASC" : "DESC";
    const columns = columnDefs.map((column) => ({
        ...column,
        label: t(column.labelKey),
    }));
    const statusOptions = statusOptionDefs.map((option) => ({
        ...option,
        label: t(option.labelKey),
    }));
    const semesterOptions = semesterOptionDefs.map((option) => ({
        ...option,
        label: t(option.labelKey),
    }));

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isToggleStatusModalOpen, setIsToggleStatusModalOpen] = useState(false);
    const [isDuplicateWarningModalOpen, setIsDuplicateWarningModalOpen] = useState(false);
    const [isConflictCenterOpen, setIsConflictCenterOpen] = useState(false);
    const [isConflictsLoading, setIsConflictsLoading] = useState(false);
    const [conflictSearch, setConflictSearch] = useState("");
    const [conflicts, setConflicts] = useState<CourseActivationConflict[]>([]);
    const [conflictsTotal, setConflictsTotal] = useState(0);
    const [duplicateCourse, setDuplicateCourse] = useState<Course | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    // Form data
    const [formData, setFormData] = useState<CreateCourseDto>({
        code: "",
        name: "",
        year: new Date().getFullYear() + 543,
        semester: 1,
        instructor_id: null,
        instructor_ids: [],
        description: "",
        image: "",
        cover_position_x: 50,
        cover_position_y: 50,
        cover_zoom: 1,
    });

    // Track original form data for change detection (edit mode)
    const [originalFormData, setOriginalFormData] = useState<CreateCourseDto | null>(null);

    // Year options (current + 5 years back)
    const currentYear = new Date().getFullYear() + 543;
    const yearOptions = [
        { key: "all", label: t("allAcademicYears") },
        ...Array.from({ length: 6 }, (_, i) => ({
            key: (currentYear - i).toString(),
            label: `${currentYear - i}`,
        })),
    ];
    const getSemesterLabel = (semester: number, short = false) => {
        if (semester === 3) {
            return t("summerSemester");
        }

        return t(short ? "semesterShortWithNumber" : "semesterWithNumber", { number: semester });
    };
    const formatCourseTitle = (course: Course | null) => (course ? `${course.code} - ${course.name}` : "");
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
    };

    // Fetch courses
    const fetchCourses = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await courseService.getCourses({
                page,
                limit,
                search: search || undefined,
                year: yearFilter !== "all" ? parseInt(yearFilter) : undefined,
                semester: semesterFilter !== "all" ? parseInt(semesterFilter) : undefined,
                status: statusFilter !== "all" ? statusFilter : undefined,
                sortBy,
                sortOrder,
            });

            if (response.success && response.data) {
                setCourses(response.data.courses);
                setTotalPages(response.data.pagination.totalPages);
                setTotalItems(response.data.pagination.totalItems);
            }
        } catch (error) {
            console.error("Error fetching courses:", error);
            addToast({
                title: t("somethingWentWrong"),
                description: t("cannotLoadCourses"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, [page, limit, search, yearFilter, semesterFilter, statusFilter, sortBy, sortOrder]);

    // Fetch stats
    const fetchStats = async () => {
        setIsStatsLoading(true);
        try {
            const response = await courseService.getStats();
            if (response.success && response.data) {
                setStats(response.data);
            }
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setIsStatsLoading(false);
        }
    };

    // Fetch instructors for dropdown
    const fetchInstructors = async () => {
        try {
            const response = await courseService.getInstructors();
            if (response.success && response.data) {
                setInstructors(response.data);
            }
        } catch (error) {
            console.error("Error fetching instructors:", error);
        }
    };

    const fetchConflicts = useCallback(async (searchTerm?: string) => {
        setIsConflictsLoading(true);
        try {
            const response = await courseService.getConflicts({
                search: searchTerm?.trim() || undefined,
                limit: 100,
            });
            if (response.success && response.data) {
                setConflicts(response.data.items || []);
                setConflictsTotal(response.data.total || 0);
            }
        } catch (error) {
            console.error("Error fetching course conflicts:", error);
            addToast({
                title: t("somethingWentWrong"),
                description: t("cannotLoadCourseConflicts"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsConflictsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchCourses();
    }, [fetchCourses]);

    useEffect(() => {
        setSearchInput(search);
    }, [search]);

    useEffect(() => {
        fetchStats();
        fetchInstructors();
    }, []);

    // Subscribe to real-time course updates
    useEffect(() => {
        // Admin subscribes with userId = 0 (global admin)
        subscribeToCourseUpdates(0);
        
        return () => {
            unsubscribeFromCourseUpdates(0);
        };
    }, [subscribeToCourseUpdates, unsubscribeFromCourseUpdates]);

    // Handle real-time course updates from other clients
    useEffect(() => {
        const unsubscribe = onCourseUpdate((data) => {
            // Refresh data when any course change is detected
            fetchCourses();
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
    }, [onCourseUpdate, fetchCourses, fetchStats]);

    // Handle sort
    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSort(column, sortOrder === "ASC" ? "desc" : "asc");
        } else {
            setSort(column, "asc");
        }
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            code: "",
            name: "",
            year: currentYear,
            semester: 1,
            instructor_id: null,
            instructor_ids: [],
            description: "",
            image: "",
            cover_position_x: 50,
            cover_position_y: 50,
            cover_zoom: 1,
        });
        setOriginalFormData(null);
    };

    // Check if form has changes
    const hasFormChanges = () => {
        if (!originalFormData) return false;
        return JSON.stringify(formData) !== JSON.stringify(originalFormData);
    };

    // Open edit modal
    const openEditModal = (course: Course) => {
        setSelectedCourse(course);
        // Get instructor IDs from the instructors array
        const instructorIdList = course.instructors?.map(i => i.id) || 
            (course.instructor_id ? [course.instructor_id] : []);
        const courseData = {
            code: course.code,
            name: course.name,
            year: course.year,
            semester: course.semester,
            instructor_id: course.instructor_id,
            instructor_ids: instructorIdList,
            description: course.description || "",
            image: course.image || "",
            cover_position_x: course.cover_position_x ?? 50,
            cover_position_y: course.cover_position_y ?? 50,
            cover_zoom: course.cover_zoom ?? 1,
        };
        setFormData(courseData);
        setOriginalFormData(courseData);
        setIsEditModalOpen(true);
    };

    // Open delete modal
    const openDeleteModal = (course: Course) => {
        setSelectedCourse(course);
        setIsDeleteModalOpen(true);
    };

    // Open toggle status modal (check for duplicates when activating)
    const openToggleStatusModal = (course: Course) => {
        setSelectedCourse(course);
        
        // If trying to activate (currently inactive), check for duplicate active course
        if (!course.is_active) {
            const duplicateActiveCourse = courses.find(
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

    // Handle create
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
            const response = await courseService.createCourse(formData);
            if (response.success) {
                addToast({
                    title: t("success"),
                    description: t("createCourseSuccess"),
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
                    : response.error || response.message || t("createCourseErrorDefault");
                addToast({
                    title: t("createCourseFailed"),
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: t("somethingWentWrong"),
                description: err.message || t("createCourseFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle update
    const handleUpdate = async () => {
        if (!selectedCourse || !formData.code || !formData.name) {
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
            const updateData: UpdateCourseDto = {
                code: formData.code,
                name: formData.name,
                year: formData.year,
                semester: formData.semester,
                instructor_ids: formData.instructor_ids,
                description: formData.description,
                image: formData.image,
                cover_position_x: formData.cover_position_x,
                cover_position_y: formData.cover_position_y,
                cover_zoom: formData.cover_zoom,
            };

            const response = await courseService.updateCourse(selectedCourse.id, updateData);
            if (response.success) {
                addToast({
                    title: t("success"),
                    description: t("updateCourseSuccess"),
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
                    : response.error || response.message || t("updateCourseErrorDefault");
                addToast({
                    title: t("updateCourseFailed"),
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: t("somethingWentWrong"),
                description: err.message || t("updateCourseFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (!selectedCourse) return;

        setIsSubmitting(true);
        try {
            const response = await courseService.deleteCourse(selectedCourse.id);
            if (response.success) {
                addToast({
                    title: t("success"),
                    description: t("deleteCourseSuccess"),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsDeleteModalOpen(false);
                setSelectedCourse(null);
                fetchCourses();
                fetchStats();
                // Emit real-time update to other clients
                emitCourseUpdate("delete", selectedCourse.id);
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: t("somethingWentWrong"),
                description: err.message || t("deleteCourseFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle toggle status (called from modal)
    const handleToggleStatus = async () => {
        if (!selectedCourse) return;

        setIsSubmitting(true);
        try {
            const response = await courseService.toggleStatus(selectedCourse.id);
            if (response.success) {
                addToast({
                    title: t("success"),
                    description: selectedCourse.is_active ? t("courseDisabledSuccess") : t("courseEnabledSuccess"),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsToggleStatusModalOpen(false);
                setSelectedCourse(null);
                fetchCourses();
                fetchStats();
                // Emit real-time update to other clients
                emitCourseUpdate("toggle", selectedCourse.id);
            } else {
                const errorMessage = typeof response.error === 'object' && response.error !== null
                    ? (response.error as { message?: string }).message
                    : response.error || response.message || t("toggleCourseStatusErrorDefault");
                addToast({
                    title: t("toggleCourseStatusFailed"),
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: t("somethingWentWrong"),
                description: err.message || t("toggleCourseStatusFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkToggle = async (action: 'enable' | 'disable') => {
        const ids = Array.from(selectedKeys);
        if (ids.length === 0) return;
        setIsBulkSubmitting(true);
        try {
            const response = await courseService.bulkToggle(ids, action);
            if (response.success) {
                addToast({
                    title: t('success'),
                    description: action === 'enable'
                        ? t('bulkEnableSuccess', { count: response.data?.toggled ?? ids.length })
                        : t('bulkDisableSuccess', { count: response.data?.toggled ?? ids.length }),
                    color: 'success',
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                setSelectedKeys(new Set());
                fetchCourses();
                fetchStats();
            }
        } catch {
            addToast({ title: t('somethingWentWrong'), color: 'danger', timeout: 3000, shouldShowTimeoutProgress: true });
        } finally {
            setIsBulkSubmitting(false);
        }
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedKeys);
        if (ids.length === 0) return;
        setIsBulkSubmitting(true);
        try {
            const response = await courseService.bulkDelete(ids);
            if (response.success) {
                addToast({
                    title: t('success'),
                    description: t('bulkDeleteSuccess', { count: response.data?.deleted ?? ids.length }),
                    color: 'success',
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                setSelectedKeys(new Set());
                setIsBulkDeleteModalOpen(false);
                fetchCourses();
                fetchStats();
            }
        } catch {
            addToast({ title: t('somethingWentWrong'), color: 'danger', timeout: 3000, shouldShowTimeoutProgress: true });
        } finally {
            setIsBulkSubmitting(false);
        }
    };

    // Navigate to course detail (opens in new tab with classroom layout)
    const handleViewCourse = (course: Course) => {
        window.open(`/classroom/${course.id}`, "_blank");
    };

    // Render cell content
    const renderCell = (course: Course, columnKey: string) => {
        switch (columnKey) {
            case "code":
                return (
                    <div className="flex items-center gap-3">
                        {course.image ? (
                            <CourseCoverImage
                                src={course.image}
                                alt={course.name}
                                positionX={course.cover_position_x}
                                positionY={course.cover_position_y}
                                zoom={course.cover_zoom}
                                className="h-10 w-10 rounded-lg border border-default-200"
                            />
                        ) : (
                            <div className="p-2 bg-linear-to-br from-blue-400 to-indigo-500 rounded-lg">
                                <IoBook className="text-2xl text-white" />
                            </div>
                        )}
                        <div>
                            <p className="font-semibold text-foreground">{course.code}</p>
                        </div>
                    </div>
                );
            case "name":
                return (
                    <Tooltip content={course.name} delay={500}>
                        <span className="max-w-62.5 line-clamp-2 font-medium text-default-700">{course.name}</span>
                    </Tooltip>
                );
            case "year_semester":
                return (
                    <div className="flex items-center gap-2">
                        <Chip size="sm" variant="flat" color="primary">
                            {course.year}
                        </Chip>
                        <Chip size="sm" variant="flat" color="secondary">
                            {getSemesterLabel(course.semester, true)}
                        </Chip>
                    </div>
                );
            case "instructor":
                // Show multiple instructors if available
                const instructorList = course.instructors?.length ? course.instructors : 
                    (course.instructor ? [course.instructor] : []);
                
                if (instructorList.length === 0) {
                    return <span className="italic text-default-400">{t("noInstructorAssigned")}</span>;
                }
                
                if (instructorList.length === 1) {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="text-default-600">{instructorList[0].full_name}</span>
                        </div>
                    );
                }
                
                return (
                    <Tooltip 
                        content={
                            <div className="py-1">
                                {instructorList.map((instructor, idx) => (
                                    <div key={instructor.id} className="text-sm">
                                        {idx + 1}. {instructor.full_name}
                                    </div>
                                ))}
                            </div>
                        }
                    >
                        <div className="flex items-center gap-2 cursor-help">
                            <span className="text-default-600">{instructorList[0].full_name}</span>
                            <Chip size="sm" variant="flat" color="primary">
                                +{instructorList.length - 1}
                            </Chip>
                        </div>
                    </Tooltip>
                );
            case "sections":
                return (
                    <div className="col-span-1 flex items-center gap-2">
                        <Tooltip content={t("sectionsLabel")}>
                            <Chip size="sm" variant="flat" color="warning">
                                <div className="flex justify-center items-center">
                                <Icon icon="solar:users-group-rounded-bold" className="mr-1" />
                                {t("sectionsCount", { count: course.sections?.length || 0 })}
                                </div>
                            </Chip>
                        </Tooltip>
                    </div>
                );
            case "status":
                return (
                    <Chip
                        size="sm"
                        variant="dot"
                        color={course.is_active ? "success" : "default"}
                    >
                        {course.is_active ? t("active") : t("inactive")}
                    </Chip>
                );
            case "actions":
                return (
                    <div className="flex items-center gap-1 justify-center">
                        <Tooltip content={t("enterCourse")}>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => handleViewCourse(course)}
                            >
                                <Icon icon="solar:login-3-bold" className="text-lg text-primary-500" />
                            </Button>
                        </Tooltip>
                        <Tooltip content={t("editAction")}>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => openEditModal(course)}
                            >
                                <Icon icon="solar:pen-linear" className="text-lg text-default-500" />
                            </Button>
                        </Tooltip>
                        <Tooltip content={course.is_active ? t("disableAction") : t("enableAction")}>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => openToggleStatusModal(course)}
                            >
                                <Icon
                                    icon={course.is_active ? "solar:eye-closed-linear" : "solar:eye-linear"}
                                    className="text-lg text-default-500"
                                />
                            </Button>
                        </Tooltip>
                        <Tooltip content={t("deleteCourse")} color="danger">
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                onPress={() => openDeleteModal(course)}
                            >
                                <Icon icon="solar:trash-bin-trash-linear" className="text-lg" />
                            </Button>
                        </Tooltip>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-default-900">
                            {t("manageCourses")}
                        </h1>
                        <p className="text-sm text-default-500 mt-1">{t("manageAllCoursesInSystem")}</p>
                    </div>
                    {/* Real-time connection indicator */}
                    <Tooltip content={isConnected ? t("realTimeSyncRunning") : t("connectingRealtime")}>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                            isConnected ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${
                                isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500 animate-bounce"
                            }`} />
                            <span className="hidden sm:inline">{isConnected ? t("liveStatus") : "..."}</span>
                        </div>
                    </Tooltip>
                </div>
                <Button
                    color="primary"
                    startContent={<Icon icon="solar:add-circle-bold" className="text-xl" />}
                    onPress={() => {
                        resetForm();
                        setIsCreateModalOpen(true);
                    }}
                    className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 w-full sm:w-auto"
                >
                    {t("addCourse")}
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {isStatsLoading && !stats ? (
                    <>
                        <MetricCardSkeleton iconClassName="bg-blue-100" />
                        <MetricCardSkeleton iconClassName="bg-green-100" />
                        <MetricCardSkeleton iconClassName="bg-red-100" />
                        <MetricCardSkeleton iconClassName="bg-purple-100" />
                    </>
                ) : (
                    <>
                <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 sm:p-2.5 bg-blue-100 rounded-xl">
                            <Icon icon="solar:book-bookmark-bold" className="text-xl sm:text-2xl text-blue-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">{t("totalLabel")}</p>
                            <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.total || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 sm:p-2.5 bg-green-100 rounded-xl">
                            <Icon icon="solar:check-circle-bold" className="text-xl sm:text-2xl text-green-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">{t("active")}</p>
                            <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.byStatus.active || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 sm:p-2.5 bg-red-100 rounded-xl">
                            <Icon icon="solar:close-circle-bold" className="text-xl sm:text-2xl text-red-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">{t("inactive")}</p>
                            <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.byStatus.inactive || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 sm:p-2.5 bg-purple-100 rounded-xl">
                            <Icon icon="solar:calendar-bold" className="text-xl sm:text-2xl text-purple-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">{t("thisYearLabel")}</p>
                            <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.thisYear || 0}</p>
                        </div>
                    </div>
                </div>
                    </>
                )}
            </div>

            {/* Table Card */}
            <div className="overflow-hidden rounded-xl border border-default-200 bg-content1 shadow-sm">
                {/* Filters */}
                <div className="p-3 sm:p-4">
                    <div className="flex flex-col md:flex-row gap-3 pb-3 sm:pb-4">
                        <Input
                            aria-label={t("searchCoursesByCodeOrName")}
                            placeholder={t("searchCoursesByCodeOrName")}
                            value={searchInput}
                            onValueChange={(value) => {
                                setSearchInput(value);
                                setSearch(value);
                            }}
                            startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                            isClearable
                            onClear={() => {
                                setSearchInput("");
                                setSearch("");
                            }}
                            className="w-full md:flex-1"
                            classNames={{
                                inputWrapper: "bg-content2 border-default-200 hover:border-default-300",
                            }}
                        />
                        <div className="flex gap-2 flex-wrap md:flex-nowrap">
                            <Select
                                aria-label={t("academicYear")}
                                placeholder={t("academicYear")}
                                selectedKeys={[yearFilter]}
                                onSelectionChange={(keys) => {
                                    const value = Array.from(keys)[0] as string;
                                    setFilter("year", value);
                                }}
                                className="flex-1 min-w-37.5 sm:w-48"
                                size="md"
                                classNames={{
                                    trigger: "bg-content2 border-default-200 hover:border-default-300",
                                }}
                            >
                                {yearOptions.map((option) => (
                                    <SelectItem key={option.key}>{option.label}</SelectItem>
                                ))}
                            </Select>
                            <Select
                                aria-label={t("semesterLabel")}
                                placeholder={t("semesterLabel")}
                                selectedKeys={[semesterFilter]}
                                onSelectionChange={(keys) => {
                                    const value = Array.from(keys)[0] as string;
                                    setFilter("semester", value);
                                }}
                                className="flex-1 min-w-37.5 sm:w-48"
                                size="md"
                                classNames={{
                                    trigger: "bg-content2 border-default-200 hover:border-default-300",
                                }}
                            >
                                {semesterOptions.map((option) => (
                                    <SelectItem key={option.key}>{option.label}</SelectItem>
                                ))}
                            </Select>
                            <Select
                                aria-label={t("statusPlaceholder")}
                                placeholder={t("statusPlaceholder")}
                                selectedKeys={[statusFilter]}
                                onSelectionChange={(keys) => {
                                    const value = Array.from(keys)[0] as string;
                                    setFilter("status", value);
                                }}
                                className="flex-1 min-w-37.5 sm:w-48"
                                size="md"
                                classNames={{
                                    trigger: "bg-content2 border-default-200 hover:border-default-300",
                                }}
                            >
                                {statusOptions.map((option) => (
                                    <SelectItem key={option.key}>{option.label}</SelectItem>
                                ))}
                            </Select>
                        </div>
                    </div>

                    {/* Bulk Action Toolbar */}
                    {selectedKeys.size > 0 && (
                        <div className="mb-3 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 dark:bg-primary-950/20 p-2.5">
                            <Chip size="sm" color="primary" variant="flat">
                                {t('selectedCount', { count: selectedKeys.size })}
                            </Chip>
                            <div className="flex items-center gap-1.5 ml-2">
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="success"
                                    startContent={<Icon icon="solar:check-circle-bold" className="text-base" />}
                                    isLoading={isBulkSubmitting}
                                    onPress={() => handleBulkToggle('enable')}
                                >
                                    {t('enableAction')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="warning"
                                    startContent={<Icon icon="solar:eye-closed-bold" className="text-base" />}
                                    isLoading={isBulkSubmitting}
                                    onPress={() => handleBulkToggle('disable')}
                                >
                                    {t('disableAction')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="danger"
                                    startContent={<Icon icon="solar:trash-bin-trash-bold" className="text-base" />}
                                    isLoading={isBulkSubmitting}
                                    onPress={() => setIsBulkDeleteModalOpen(true)}
                                >
                                    {t('deleteAction')}
                                </Button>
                            </div>
                            <Button
                                size="sm"
                                variant="light"
                                className="ml-auto"
                                onPress={() => setSelectedKeys(new Set())}
                            >
                                {t('clearSelection')}
                            </Button>
                        </div>
                    )}

                    {/* Table with horizontal scroll */}
                    <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
                        <div className="min-w-175">
                            <Table
                                aria-label={t("coursesTable")}
                                removeWrapper
                                selectionMode="multiple"
                                selectedKeys={selectedKeys}
                                onSelectionChange={(keys) => {
                                    if (keys === 'all') {
                                        setSelectedKeys(new Set(courses.map(c => c.id)));
                                    } else {
                                        setSelectedKeys(new Set(Array.from(keys as Set<string>)));
                                    }
                                }}
                                classNames={{
                                    th: "bg-content2 text-default-600 font-semibold text-xs sm:text-sm",
                                    td: "py-2 sm:py-3 text-sm",
                                }}
                            >
                                <TableHeader columns={columns}>
                                    {(column) => (
                                        <TableColumn
                                            key={column.key}
                                            align={column.key === "actions" ? "center" : "start"}
                                            allowsSorting={column.sortable}
                                            onClick={() => column.sortable && handleSort(column.key)}
                                            className={column.sortable ? "cursor-pointer hover:bg-default-200" : ""}
                                        >
                                            {column.label}
                                        </TableColumn>
                                    )}
                                </TableHeader>
                                <TableBody
                                    items={courses}
                                    isLoading={isLoading}
                                    loadingContent={
                                        <TableRowsSkeleton
                                            rows={limit}
                                            columns={["w-24", "w-40", "w-20", "w-28", "w-16", "w-16", "w-14"]}
                                        />
                                    }
                                    emptyContent={
                                        <div className="py-10 text-center">
                                            <Icon icon="solar:book-2-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                                            <p className="text-default-500">{t("noCoursesFound")}</p>
                                        </div>
                                    }
                                >
                                    {(item) => (
                                        <TableRow key={item.id}>
                                            {(columnKey) => (
                                                <TableCell>{renderCell(item, columnKey as string)}</TableCell>
                                            )}
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <TablePaginationFooter
                    totalItems={totalItems}
                    currentPage={page}
                    rowsPerPage={limit}
                    totalPages={totalPages}
                    isEnglish={isEnglish}
                    nounEnglish="course"
                    nounThai="รายวิชา"
                    onPageChange={setPage}
                    onRowsPerPageChange={setLimit}
                />
            </div>

            {/* Create Modal */}
            <Modal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)} 
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
                                    image: formData.image || "",
                                    cover_position_x: formData.cover_position_x ?? 50,
                                    cover_position_y: formData.cover_position_y ?? 50,
                                    cover_zoom: formData.cover_zoom ?? 1,
                                }}
                                onChange={(value) => setFormData((prev) => ({ ...prev, ...value }))}
                                text={courseCoverEditorText}
                                accentClassName="text-blue-500"
                                onValidationError={(message) => addToast({ title: t("invalidFileType"), description: message, color: "warning", timeout: 3000, shouldShowTimeoutProgress: true })}
                            />
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
                                            size="lg"
                                            value={formData.code}
                                            onValueChange={(value) => setFormData({ ...formData, code: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:hashtag-linear" className="text-blue-400 text-xl" />}
                                            classNames={{
                                                inputWrapper: "h-12 bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                                label: "text-default-600 font-medium text-sm",
                                            }}
                                        />
                                        <div className="md:col-span-2 pt-4">
                                            <Input
                                                label={t("courseName")}
                                                labelPlacement="outside"
                                                placeholder={t("enterCourseNameExample")}
                                                variant="bordered"
                                                size="lg"
                                                value={formData.name}
                                                onValueChange={(value) => setFormData({ ...formData, name: value })}
                                                isRequired
                                                startContent={<Icon icon="solar:book-linear" className="text-blue-400 text-xl" />}
                                                classNames={{
                                                    inputWrapper: "h-12 bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                                    label: "text-default-600 font-medium text-sm",
                                                }}
                                            />
                                        </div>
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
                                        startContent={<Icon icon="solar:calendar-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
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
                                            trigger: "h-12 bg-content1 border-default-200 hover:border-blue-300",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    >
                                        {semesterOptions
                                            .filter((option) => option.key !== "all")
                                            .map((option) => (
                                                <SelectItem key={option.key}>{option.label}</SelectItem>
                                            ))}
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:user-circle-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("instructorsLabel")}</span>
                                </div>
                                <div className="py-3">
                                    <Select
                                        label={t("instructorLabel")}
                                        labelPlacement="outside"
                                        placeholder={t("selectInstructorsPlaceholder")}
                                        variant="bordered"
                                        size="lg"
                                        selectionMode="multiple"
                                        selectedKeys={new Set(formData.instructor_ids?.map(id => id.toString()) || [])}
                                        onSelectionChange={(keys) => {
                                            const selectedIds = Array.from(keys as Set<string>).map(k => parseInt(k));
                                            setFormData({ 
                                                ...formData, 
                                                instructor_ids: selectedIds,
                                                instructor_id: selectedIds.length > 0 ? selectedIds[0] : null 
                                            });
                                        }}
                                        classNames={{
                                            trigger: "min-h-12 bg-content1 border-default-200 hover:border-blue-300",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    >
                                        {instructors.map((instructor) => (
                                            <SelectItem key={instructor.id.toString()}>
                                                {instructor.full_name}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                    {formData.instructor_ids && formData.instructor_ids.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {formData.instructor_ids.map(id => {
                                                const instructor = instructors.find(i => i.id === id);
                                                return instructor ? (
                                                    <Chip key={id} size="sm" variant="flat" color="primary">
                                                        {instructor.full_name}
                                                    </Chip>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
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
                            onPress={() => setIsCreateModalOpen(false)}
                            className="font-medium px-6"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleCreate}
                            isLoading={isSubmitting}
                            isDisabled={!formData.code.trim() || !formData.name.trim()}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500"
                        >
                            {t("createCourse")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:pen-new-square-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{t("editCourse")}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">{t("editCourseForCode", { code: selectedCourse?.code || "" })}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="space-y-5">
                            {/* Course Image Section */}
                            <CourseCoverEditor
                                value={{
                                    image: formData.image || "",
                                    cover_position_x: formData.cover_position_x ?? 50,
                                    cover_position_y: formData.cover_position_y ?? 50,
                                    cover_zoom: formData.cover_zoom ?? 1,
                                }}
                                onChange={(value) => setFormData((prev) => ({ ...prev, ...value }))}
                                text={courseCoverEditorText}
                                accentClassName="text-amber-500"
                                onValidationError={(message) => addToast({ title: t("invalidFileType"), description: message, color: "warning", timeout: 3000, shouldShowTimeoutProgress: true })}
                            />
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
                                        <div className="md:col-span-2 pt-4">
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
                                        {semesterOptions
                                            .filter((option) => option.key !== "all")
                                            .map((option) => (
                                                <SelectItem key={option.key}>{option.label}</SelectItem>
                                            ))}
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:user-circle-bold" className="text-lg text-amber-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("instructorsLabel")}</span>
                                </div>
                                <div className="py-3">
                                    <Select
                                        label={t("instructorLabel")}
                                        labelPlacement="outside"
                                        placeholder={t("selectInstructorsPlaceholder")}
                                        variant="bordered"
                                        size="lg"
                                        selectionMode="multiple"
                                        selectedKeys={new Set(formData.instructor_ids?.map(id => id.toString()) || [])}
                                        onSelectionChange={(keys) => {
                                            const selectedIds = Array.from(keys as Set<string>).map(k => parseInt(k));
                                            setFormData({ 
                                                ...formData, 
                                                instructor_ids: selectedIds,
                                                instructor_id: selectedIds.length > 0 ? selectedIds[0] : null 
                                            });
                                        }}
                                        classNames={{
                                            trigger: "min-h-12 bg-content1 border-default-200 hover:border-amber-300",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    >
                                        {instructors.map((instructor) => (
                                            <SelectItem key={instructor.id.toString()}>
                                                {instructor.full_name}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                    {formData.instructor_ids && formData.instructor_ids.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {formData.instructor_ids.map(id => {
                                                const instructor = instructors.find(i => i.id === id);
                                                return instructor ? (
                                                    <Chip key={id} size="sm" variant="flat" color="warning">
                                                        {instructor.full_name}
                                                    </Chip>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
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
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {t("saveChanges")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} size="md">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:trash-bin-trash-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{t("deleteConfirmTitle")}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">{t("irreversibleAction")}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="rounded-xl border border-danger-100 bg-danger-50/70 p-4 dark:border-danger/20 dark:bg-danger/10">
                            <p className="text-foreground">{t("doYouWantDeleteCourse", { course: formatCourseTitle(selectedCourse) })}</p>
                            <p className="mt-2 text-sm text-default-500">
                                {t("deleteCourseRelatedDataWarning")}
                            </p>
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button
                            variant="light"
                            color="default"
                            onPress={() => {
                                setIsDeleteModalOpen(false);
                                setSelectedCourse(null);
                            }}
                            className="font-medium px-6"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleDelete}
                            isLoading={isSubmitting}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {t("deleteCourse")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Bulk Delete Modal */}
            <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} size="md">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-danger rounded-xl">
                                <Icon icon="solar:trash-bin-trash-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{t('bulkDeleteConfirmTitle')}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">{t('irreversibleAction')}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="rounded-xl border border-danger-100 bg-danger-50/70 p-4 dark:border-danger/20 dark:bg-danger/10">
                            <p className="text-foreground">{t('bulkDeleteConfirmDescription', { count: selectedKeys.size })}</p>
                            <p className="mt-2 text-sm text-default-500">{t('deleteCourseRelatedDataWarning')}</p>
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button variant="light" onPress={() => setIsBulkDeleteModalOpen(false)} className="font-medium px-6">
                            {t('cancel')}
                        </Button>
                        <Button color="danger" onPress={handleBulkDelete} isLoading={isBulkSubmitting} className="font-medium px-6">
                            {t('deleteAction')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Toggle Status Modal */}
            <Modal 
                isOpen={isToggleStatusModalOpen} 
                onClose={() => {
                    setIsToggleStatusModalOpen(false);
                    setSelectedCourse(null);
                }} 
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl shadow-lg bg-linear-to-br from-blue-400 to-indigo-500 shadow-blue-500/30">
                                <Icon icon={selectedCourse?.is_active ? "solar:eye-closed-bold" : "solar:eye-bold"} className="text-2xl text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">
                                {selectedCourse?.is_active ? t("confirmDisableTitle") : t("confirmEnableTitle")}
                            </h3>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className={`rounded-2xl p-6 border ${selectedCourse?.is_active ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${selectedCourse?.is_active ? "bg-amber-100" : "bg-emerald-100"}`}>
                                    <Icon icon="solar:book-bold" className={`text-2xl ${selectedCourse?.is_active ? "text-amber-600" : "text-emerald-600"}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">{formatCourseTitle(selectedCourse)}</p>
                                    <p className="text-sm text-default-500">{formatAcademicYearSemester(selectedCourse?.year, selectedCourse?.semester)}</p>
                                </div>
                            </div>
                            <p className={`mt-4 text-sm ${selectedCourse?.is_active ? "text-amber-700" : "text-emerald-700"}`}>
                                {selectedCourse?.is_active
                                    ? t("disabledCourseVisibilityHint")
                                    : t("activateCourseDuplicateHint")}
                            </p>
                        </div>
                    </ModalBody>
                    <ModalFooter className="gap-3 border-t border-divider px-6 py-4">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => {
                                setIsToggleStatusModalOpen(false);
                                setSelectedCourse(null);
                            }}
                            className="font-medium px-6"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleToggleStatus}
                            isLoading={isSubmitting}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {selectedCourse?.is_active ? t("disableAction") : t("enableAction")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Duplicate Warning Modal */}
            <Modal 
                isOpen={isDuplicateWarningModalOpen} 
                onClose={() => {
                    setIsDuplicateWarningModalOpen(false);
                    setSelectedCourse(null);
                    setDuplicateCourse(null);
                }} 
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
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
                            <p className="text-sm text-default-600">
                                {t("duplicateCourseConflictDescription")}
                            </p>
                            <div className="rounded-lg border border-danger-200 bg-content1 p-3 dark:border-danger/25">
                                <div className="flex items-center gap-2 mb-2">
                                    <Chip size="sm" color="danger" variant="flat">{t("currentlyActive")}</Chip>
                                </div>
                                <p className="font-semibold text-foreground">{duplicateCourse?.code} - {duplicateCourse?.name}</p>
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
                                setSelectedCourse(null);
                                setDuplicateCourse(null);
                            }}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {t("acknowledged")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Conflict Center Modal */}
            <Modal
                isOpen={isConflictCenterOpen}
                onClose={() => setIsConflictCenterOpen(false)}
                size="4xl"
                scrollBehavior="inside"
            >
                <ModalContent>
                    <ModalHeader className="flex items-center justify-between gap-4 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-amber-100 text-amber-700">
                                <Icon icon="solar:shield-warning-bold" className="text-2xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{t("conflictCenter")}</h3>
                                <p className="mt-1 text-sm text-default-500">
                                    {t("conflictCenterDescription")}
                                </p>
                            </div>
                        </div>
                        <Chip size="sm" color={conflictsTotal > 0 ? "warning" : "success"} variant="flat">
                            {t("totalConflictsCount", { count: conflictsTotal })}
                        </Chip>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                aria-label={t("searchConflicts")}
                                placeholder={t("searchConflicts")}
                                value={conflictSearch}
                                onValueChange={setConflictSearch}
                                startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                                className="flex-1"
                            />
                            <Button
                                color="primary"
                                onPress={() => fetchConflicts(conflictSearch)}
                                isLoading={isConflictsLoading}
                                className="bg-linear-to-r from-blue-400 to-indigo-500"
                            >
                                {t("refresh")}
                            </Button>
                        </div>

                        <div className="mt-4 space-y-3">
                            {!isConflictsLoading && conflicts.length === 0 ? (
                                <div className="rounded-xl border border-default-200 bg-content2 p-6 text-center">
                                    <Icon icon="solar:shield-check-bold" className="mx-auto mb-2 text-4xl text-success" />
                                    <p className="font-medium text-foreground">{t("noCourseConflictsFound")}</p>
                                    <p className="mt-1 text-sm text-default-500">{t("noCourseConflictsDescription")}</p>
                                </div>
                            ) : (
                                conflicts.map((conflict) => (
                                    <div key={`${conflict.inactive_course_id}-${conflict.active_course_id}`} className="rounded-xl border border-warning-200 bg-warning-50/50 p-4 dark:border-warning/20 dark:bg-warning/10">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-semibold text-foreground">
                                                    {conflict.course_code} • {t("duplicateCourseSummary", {
                                                        year: conflict.year,
                                                        semester: getSemesterLabel(conflict.semester),
                                                    })}
                                                </p>
                                                <p className="mt-1 text-sm text-default-600">
                                                    {t("activeCourseLabel")}: {conflict.active_course_name}
                                                </p>
                                                <p className="text-sm text-default-600">
                                                    {t("inactiveCourseLabel")}: {conflict.inactive_course_name}
                                                </p>
                                            </div>
                                            <Chip size="sm" color="warning" variant="flat">
                                                {t("duplicateActiveCourseFound")}
                                            </Chip>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button variant="light" color="default" onPress={() => setIsConflictCenterOpen(false)}>
                            {t("close")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
