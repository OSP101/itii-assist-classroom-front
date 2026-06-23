"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useSocket } from "@/contexts/SocketContext";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Skeleton } from "@heroui/skeleton";
import { Input } from "@heroui/input";
import { Checkbox } from "@heroui/checkbox";
import { Select, SelectItem } from "@heroui/select";
import {
    Table,
    TableHeader,
    TableBody,
    TableColumn,
    TableRow,
    TableCell,
} from "@heroui/table";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { instructorPrimaryButtonClass } from "@/components/ui/instructor-button-styles";
import queueService, {
    ClassroomConflictError,
    type ClassroomConflictInfo,
    type QueueSession,
    type CreateQueueSessionData,
    type UpdateQueueSessionData,
} from "@/services/queue.service";
import { classroomService, type Classroom } from "@/services/classroom.service";
import assignmentService, { type Assignment } from "@/services/assignment.service";
import attendanceService, { type AttendanceSession } from "@/services/attendance.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import TablePaginationFooter, { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/components/ui/table-pagination-footer";

// Types for the component
interface Section {
    id: number;
    section_no: string;
    note?: string | null;
    studentCount?: number;
}

interface Course {
    id: string;
    code: string;
    name: string;
    sections?: Section[];
}

interface QueueTabProps {
    course: Course;
    isLoading: boolean;
    isCourseActive?: boolean;
    canCreateQueueSessions?: boolean;
    canUpdateQueueSessions?: boolean;
    canDeleteQueueSessions?: boolean;
    canManageQueueBookings?: boolean;
}

// Loading Skeleton
function QueueTableSkeleton() {
    return (
        <Card className="border border-default-200 bg-content1 shadow-sm">
            <CardBody className="p-2">
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-3">
                            <Skeleton className="w-10 h-10 rounded-xl" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="w-48 h-4 rounded-lg" />
                                <Skeleton className="w-32 h-3 rounded-lg" />
                            </div>
                            <Skeleton className="w-20 h-6 rounded-full" />
                            <Skeleton className="w-24 h-8 rounded-lg" />
                        </div>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
}

// Format date for display
function formatDate(dateString: string, locale: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

// Format time for display
function formatTime(dateString: string, locale: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
    });
}

// Format datetime for display
function formatDateTime(dateString: string, locale: string): string {
    return `${formatDate(dateString, locale)} ${formatTime(dateString, locale)}`;
}

function formatShortDate(dateString: string, locale: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "2-digit",
    });
}

function toLocalDateTimeInputValue(value?: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function localDateTimeInputToIso(value: string): string | null {
    if (!value) return null;
    const localDate = new Date(value);
    if (Number.isNaN(localDate.getTime())) return null;
    return localDate.toISOString();
}

function containsThaiText(value: string): boolean {
    return /[\u0E00-\u0E7F]/.test(value);
}

// Status display
function getStatusDisplay(isEnglish: boolean): Record<string, { label: string; color: "default" | "primary" | "secondary" | "success" | "warning" | "danger"; icon: string }> {
    return {
        draft: { label: isEnglish ? "Draft" : "ฉบับร่าง", color: "default", icon: "solar:document-bold" },
        active: { label: isEnglish ? "Open" : "กำลังเปิด", color: "success", icon: "solar:play-circle-bold" },
        paused: { label: isEnglish ? "Paused" : "หยุดชั่วคราว", color: "warning", icon: "solar:pause-circle-bold" },
        closed: { label: isEnglish ? "Closed" : "ปิดแล้ว", color: "danger", icon: "solar:stop-circle-bold" },
    };
}

export default function QueueTab({
    course,
    isLoading,
    isCourseActive = true,
    canCreateQueueSessions = false,
    canUpdateQueueSessions = false,
    canDeleteQueueSessions = false,
    canManageQueueBookings = false,
}: QueueTabProps) {
    const router = useRouter();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const locale = isEnglish ? "en-US" : "th-TH";
    const localize = (thai: string, english: string) => (isEnglish ? english : thai);
    const statusDisplay = getStatusDisplay(isEnglish);
    const getErrorDescription = (error: unknown, fallbackThai: string, fallbackEnglish: string) => {
        if (!(error instanceof Error) || !error.message) {
            return isEnglish ? fallbackEnglish : fallbackThai;
        }

        if (isEnglish && containsThaiText(error.message)) {
            return fallbackEnglish;
        }

        return error.message;
    };
    const { emit, on, emitDataUpdate, onDataUpdate, subscribeToUpdates, unsubscribeFromUpdates } = useSocket();
    const [pendingQueueUpdate, setPendingQueueUpdate] = useState(false);
    const [sessions, setSessions] = useState<QueueSession[]>([]);
    const [isSessionsLoading, setIsSessionsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isStartModalOpen, setIsStartModalOpen] = useState(false);
    const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<QueueSession | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<QueueSession | null>(null);
    const [startTarget, setStartTarget] = useState<QueueSession | null>(null);
    const [pauseTarget, setPauseTarget] = useState<QueueSession | null>(null);
    const [pauseAction, setPauseAction] = useState<'paused' | 'active'>('paused');
    const [classroomConflict, setClassroomConflict] = useState<ClassroomConflictInfo | null>(null);
    const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Options for selects
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
    const [isOptionsLoading, setIsOptionsLoading] = useState(false);

    // Ref to track which queue rooms we've joined
    const joinedQueueRoomsRef = useRef<Set<string>>(new Set());

    // Form states
    const [formData, setFormData] = useState<CreateQueueSessionData>({
        title: "",
        description: "",
        classroom_id: "",
        linked_assignment_id: null,
        require_attendance: false,
        linked_attendance_session_id: null,
        is_cutoff_enabled: false,
        cutoff_at: null,
        cutoff_note: "",
    });
    const [originalFormData, setOriginalFormData] = useState<CreateQueueSessionData | null>(null);
    const isClosedEditSession = editTarget?.status === "closed";

    const showCourseClosedReadOnlyToast = () => {
        addToast({
            title: localize("รายวิชาถูกปิดแล้ว", "Course is closed"),
            description: localize("วิชาที่ปิดแล้วดูข้อมูลได้อย่างเดียว ไม่สามารถแก้ไขข้อมูลคิวได้", "Closed courses are read-only. Queue changes are disabled."),
            color: "warning",
            timeout: 3000,
            shouldShowTimeoutProgress: true,
        });
    };

    const hasFormChanges = () => {
        if (!originalFormData) return false;
        if (isClosedEditSession) {
            return formData.title !== originalFormData.title;
        }
        return JSON.stringify(formData) !== JSON.stringify(originalFormData);
    };

    // Fetch sessions
    const fetchSessions = useCallback(async (silent = false) => {
        if (!silent) setIsSessionsLoading(true);
        try {
            const data = await queueService.getQueueSessions(course.id);
            setSessions(data);
        } catch (error) {
            console.error("Error fetching queue sessions:", error);
            addToast({
                title: localize("เกิดข้อผิดพลาด", "Error"),
                description: localize("ไม่สามารถโหลดข้อมูลการจองคิวได้", "Unable to load queue sessions"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            if (!silent) setIsSessionsLoading(false);
        }
    }, [course.id]);

    // Fetch options for create/edit modal
    const fetchOptions = useCallback(async () => {
        setIsOptionsLoading(true);
        try {
            const [classroomsResponse, assignmentsData, attendanceData] = await Promise.all([
                classroomService.getClassrooms(),
                assignmentService.getAssignments(course.id),
                attendanceService.getSessions(course.id),
            ]);

            // Handle paginated response - classrooms is inside ApiResponse.data
            const classroomsData = classroomsResponse?.data?.classrooms || [];
            setClassrooms(classroomsData);
            setAssignments(assignmentsData || []);
            // แสดงทุกรอบเช็คชื่อ (ไม่ต้อง filter เพราะอาจต้องการลิงก์กับรอบที่จบไปแล้ว)
            setAttendanceSessions(attendanceData || []);
        } catch (error) {
            console.error("Error fetching options:", error);
        } finally {
            setIsOptionsLoading(false);
        }
    }, [course.id]);

    useEffect(() => {
        if (course.id) {
            fetchSessions();
        }
    }, [course.id, fetchSessions]);

    // Subscribe to real-time socket events from OTHER users
    useEffect(() => {
        subscribeToUpdates();
        const unsubscribe = onDataUpdate((data) => {
            if (data.resource !== ("queue" as any)) return;
            if (data.data?.courseId && String(data.data.courseId) !== String(course.id)) return;
            setPendingQueueUpdate(true);
        });
        return () => { unsubscribe(); unsubscribeFromUpdates(); };
    }, [onDataUpdate, subscribeToUpdates, unsubscribeFromUpdates, course.id]);

    // Join/leave queue socket rooms when sessions change (for real-time status sync)
    useEffect(() => {
        if (!emit) return;

        const activeIds = new Set(
            sessions.filter(s => s.status !== 'closed').map(s => String(s.id))
        );

        // Join new rooms
        activeIds.forEach(id => {
            if (!joinedQueueRoomsRef.current.has(id)) {
                emit('join-queue', id);
                joinedQueueRoomsRef.current.add(id);
            }
        });

        // Leave rooms for sessions that are now closed
        Array.from(joinedQueueRoomsRef.current).forEach(id => {
            if (!activeIds.has(id)) {
                emit('leave-queue', id);
                joinedQueueRoomsRef.current.delete(id);
            }
        });
    }, [emit, sessions]);

    // Listen for session-status-changed from projector/worker → auto-refresh
    useEffect(() => {
        const unsubscribe = on('session-status-changed', () => {
            fetchSessions(true);
        });
        return unsubscribe;
    }, [on, fetchSessions]);

    // Reset form
    const resetForm = () => {
        setFormData({
            title: "",
            description: "",
            classroom_id: "",
            linked_assignment_id: null,
            require_attendance: false,
            linked_attendance_session_id: null,
            is_cutoff_enabled: false,
            cutoff_at: null,
            cutoff_note: "",
        });
        setOriginalFormData(null);
    };

    // Open create modal
    const handleOpenCreateModal = () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }
        resetForm();
        fetchOptions();
        setIsCreateModalOpen(true);
    };

    // Open edit modal
    const handleOpenEditModal = (session: QueueSession) => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }
        setEditTarget(session);
        const editData: CreateQueueSessionData = {
            title: session.title,
            description: session.description || "",
            classroom_id: session.classroom_id,
            linked_assignment_id: session.linked_assignment_id || null,
            require_attendance: session.require_attendance,
            linked_attendance_session_id: session.linked_attendance_session_id || null,
            is_cutoff_enabled: Boolean(session.is_cutoff_enabled),
            cutoff_at: session.cutoff_at || null,
            cutoff_note: session.cutoff_note || "",
        };
        setFormData(editData);
        setOriginalFormData(editData);
        fetchOptions();
        setIsEditModalOpen(true);
    };

    // Filter sessions
    const filteredSessions = sessions.filter((session) => {
        const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || session.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Pagination logic
    const totalPages = Math.max(1, Math.ceil(filteredSessions.length / rowsPerPage));
    const paginatedSessions = filteredSessions.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    // Reset to page 1 when filter changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [rowsPerPage]);

    React.useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    // Stats
    const stats = {
        total: sessions.length,
        active: sessions.filter((s) => s.status === "active").length,
        draft: sessions.filter((s) => s.status === "draft").length,
        paused: sessions.filter((s) => s.status === "paused").length,
        closed: sessions.filter((s) => s.status === "closed").length,
    };

    // Handle create session
    const handleCreateSession = async () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }

        if (!formData.title.trim()) {
            addToast({
                title: localize("กรุณากรอกข้อมูล", "Required field"),
                description: localize("กรุณากรอกชื่อการจองคิว", "Please enter a queue title"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (!formData.classroom_id || formData.classroom_id.length === 0) {
            addToast({
                title: localize("กรุณาเลือกห้อง", "Select a classroom"),
                description: localize("กรุณาเลือกห้องเรียน", "Please select a classroom"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (formData.is_cutoff_enabled && !formData.cutoff_at) {
            addToast({
                title: localize("กรุณาตั้งเวลา Cutoff", "Set the cutoff time"),
                description: localize("เมื่อเปิดใช้งาน cutoff ต้องระบุวันและเวลา", "A date and time are required when cutoff is enabled"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await queueService.createQueueSession(course.id, {
                ...formData,
                is_cutoff_enabled: Boolean(formData.is_cutoff_enabled),
                cutoff_at: formData.is_cutoff_enabled ? formData.cutoff_at || null : null,
                cutoff_note: formData.is_cutoff_enabled ? formData.cutoff_note : "",
            });
            if (result) {
                addToast({
                    title: localize("สำเร็จ", "Success"),
                    description: localize("สร้างการจองคิวเรียบร้อยแล้ว", "Queue created successfully"),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsCreateModalOpen(false);
                resetForm();
                fetchSessions(true);
                emitDataUpdate("queue" as any, "create", result.id, { courseId: course.id });
            }
        } catch (error: unknown) {
            console.error("Error creating queue session:", error);
            addToast({
                title: localize("เกิดข้อผิดพลาด", "Error"),
                description: getErrorDescription(error, "ไม่สามารถสร้างการจองคิวได้", "Unable to create queue"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle update session
    const handleUpdateSession = async () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }

        if (!editTarget) return;

        if (!formData.title.trim()) {
            addToast({
                title: localize("กรุณากรอกข้อมูล", "Required field"),
                description: localize("กรุณากรอกชื่อการจองคิว", "Please enter a queue title"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (!isClosedEditSession && formData.is_cutoff_enabled && !formData.cutoff_at) {
            addToast({
                title: localize("กรุณาตั้งเวลา Cutoff", "Set the cutoff time"),
                description: localize("เมื่อเปิดใช้งาน cutoff ต้องระบุวันและเวลา", "A date and time are required when cutoff is enabled"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const updateData: UpdateQueueSessionData = isClosedEditSession
                ? { title: formData.title.trim() }
                : {
                    title: formData.title.trim(),
                    description: formData.description,
                    linked_assignment_id: formData.linked_assignment_id,
                    require_attendance: formData.require_attendance,
                    linked_attendance_session_id: formData.linked_attendance_session_id,
                    is_cutoff_enabled: Boolean(formData.is_cutoff_enabled),
                    cutoff_at: formData.is_cutoff_enabled ? formData.cutoff_at || null : null,
                    cutoff_note: formData.is_cutoff_enabled ? formData.cutoff_note : "",
                };
            await queueService.updateQueueSession(course.id, editTarget.id, updateData);
            addToast({
                title: localize("สำเร็จ", "Success"),
                description: localize("อัพเดทการจองคิวเรียบร้อยแล้ว", "Queue updated successfully"),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            setIsEditModalOpen(false);
            fetchSessions(true);
            emitDataUpdate("queue" as any, "update", editTarget.id, { courseId: course.id });
        } catch (error: unknown) {
            console.error("Error updating queue session:", error);
            addToast({
                title: localize("เกิดข้อผิดพลาด", "Error"),
                description: getErrorDescription(error, "ไม่สามารถอัพเดทการจองคิวได้", "Unable to update queue"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle delete session
    const handleDeleteSession = async () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }

        if (!deleteTarget) return;

        setIsSubmitting(true);
        try {
            await queueService.deleteQueueSession(course.id, deleteTarget.id);
            addToast({
                title: localize("สำเร็จ", "Success"),
                description: localize("ลบการจองคิวเรียบร้อยแล้ว", "Queue deleted successfully"),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            setIsDeleteModalOpen(false);
            emitDataUpdate("queue" as any, "delete", deleteTarget.id, { courseId: course.id });
            setDeleteTarget(null);
            fetchSessions(true);
        } catch (error: unknown) {
            console.error("Error deleting queue session:", error);
            addToast({
                title: localize("เกิดข้อผิดพลาด", "Error"),
                description: getErrorDescription(error, "ไม่สามารถลบการจองคิวได้", "Unable to delete queue"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle status change
    const handleStatusChange = async (session: QueueSession, newStatus: 'active' | 'paused' | 'closed') => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }

        try {
            await queueService.updateQueueSessionStatus(course.id, session.id, newStatus);
            addToast({
                title: localize("สำเร็จ", "Success"),
                description: localize(
                    `เปลี่ยนสถานะเป็น ${statusDisplay[newStatus].label} เรียบร้อยแล้ว`,
                    `Status changed to ${statusDisplay[newStatus].label}`
                ),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            fetchSessions(true);
        } catch (error: unknown) {
            console.error("Error changing status:", error);
            addToast({
                title: localize("เกิดข้อผิดพลาด", "Error"),
                description: getErrorDescription(error, "ไม่สามารถเปลี่ยนสถานะได้", "Unable to change the queue status"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        }
    };

    // Open projector view in new tab
    const handleOpenProjector = (session: QueueSession) => {
        window.open(`/queue/projector/${session.id}`, '_blank');
    };

    // Navigate to worker dashboard
    const handleGoToWorker = (session: QueueSession) => {
        window.open(`/classroom/${course.id}/queue/${session.id}/worker`, '_blank');
    };

    // Handle start queue with confirmation
    const handleStartQueue = async () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }

        if (!startTarget) return;
        setIsSubmitting(true);
        try {
            await queueService.updateQueueSessionStatus(course.id, startTarget.id, 'active');
            addToast({
                title: localize("สำเร็จ", "Success"),
                description: localize("เริ่มการจองคิวเรียบร้อยแล้ว", "Queue started successfully"),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            setIsStartModalOpen(false);
            setStartTarget(null);
            fetchSessions(true);
            emitDataUpdate("queue" as any, "update", startTarget.id, { courseId: course.id });
        } catch (error: unknown) {
            console.error("Error starting queue:", error);
            if (error instanceof ClassroomConflictError) {
                setClassroomConflict(error.conflict);
                setIsConflictModalOpen(true);
                setIsStartModalOpen(false);
            } else {
                addToast({
                    title: localize("เกิดข้อผิดพลาด", "Error"),
                    description: getErrorDescription(error, "ไม่สามารถเริ่มการจองคิวได้", "Unable to start the queue"),
                    color: "danger",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle pause/resume queue with confirmation
    const handlePauseResumeQueue = async () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }

        if (!pauseTarget) return;
        setIsSubmitting(true);
        try {
            await queueService.updateQueueSessionStatus(course.id, pauseTarget.id, pauseAction);
            addToast({
                title: localize("สำเร็จ", "Success"),
                description: pauseAction === 'paused'
                    ? localize("หยุดรับคิวเรียบร้อยแล้ว", "Queue paused successfully")
                    : localize("เปิดรับคิวเรียบร้อยแล้ว", "Queue resumed successfully"),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            setIsPauseModalOpen(false);
            setPauseTarget(null);
            fetchSessions(true);
            emitDataUpdate("queue" as any, "update", pauseTarget.id, { courseId: course.id });
        } catch (error: unknown) {
            console.error("Error changing status:", error);
            if (error instanceof ClassroomConflictError) {
                setClassroomConflict(error.conflict);
                setIsConflictModalOpen(true);
                setIsPauseModalOpen(false);
            } else {
                addToast({
                    title: localize("เกิดข้อผิดพลาด", "Error"),
                    description: getErrorDescription(error, "ไม่สามารถเปลี่ยนสถานะได้", "Unable to change the queue status"),
                    color: "danger",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Open start modal
    const handleOpenStartModal = (session: QueueSession) => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }
        setStartTarget(session);
        setIsStartModalOpen(true);
    };

    // Open pause modal
    const handleOpenPauseModal = (session: QueueSession, action: 'paused' | 'active') => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }
        setPauseTarget(session);
        setPauseAction(action);
        setIsPauseModalOpen(true);
    };

    return (
        <>
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{localize("จองคิวตรวจงาน", "Assignment Queue")}</h2>
                    <p className="text-sm text-default-500">{localize("จัดการคิวตรวจงานและติดตามความคืบหน้า", "Manage grading queues and track progress")}</p>
                </div>
                {canCreateQueueSessions && (
                    <Button
                        color="primary"
                        onPress={handleOpenCreateModal}
                        isDisabled={!isCourseActive}
                        className={instructorPrimaryButtonClass("shadow-lg shadow-blue-400/25")}
                    >
                        {localize("สร้างการจองคิว", "Create queue")}
                    </Button>
                )}
            </div>

            {/* Loading state */}
            {isLoading || isSessionsLoading ? (
                <>
                    {/* Stats Skeleton */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Card key={i} className="border border-default-200 bg-content1 shadow-sm">
                                <CardBody className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="w-12 h-12 rounded-xl" />
                                        <div className="space-y-2">
                                            <Skeleton className="w-20 h-3 rounded-lg" />
                                            <Skeleton className="w-8 h-6 rounded-lg" />
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                    <QueueTableSkeleton />
                </>
            ) : (
                <>
                    {/* Stats Cards - Hidden on mobile */}
                    <div className="hidden md:grid grid-cols-5 gap-3">
                        <Card className="border border-default-200 bg-content1 shadow-sm">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-100 rounded-xl">
                                        <Icon icon="solar:clipboard-list-bold" className="text-2xl text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-default-500">{localize("ทั้งหมด", "Total")}</p>
                                        <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="border border-default-200 bg-content1 shadow-sm">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-100 rounded-xl">
                                        <Icon icon="solar:play-circle-bold" className="text-2xl text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-default-500">{localize("กำลังเปิด", "Open")}</p>
                                        <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="border border-default-200 bg-content1 shadow-sm">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-amber-100 rounded-xl">
                                        <Icon icon="solar:pause-circle-bold" className="text-2xl text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-default-500">{localize("หยุดชั่วคราว", "Paused")}</p>
                                        <p className="text-2xl font-bold text-foreground">{stats.paused}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="border border-default-200 bg-content1 shadow-sm">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-content3 p-2.5">
                                        <Icon icon="solar:document-bold" className="text-2xl text-default-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-default-500">{localize("ฉบับร่าง", "Draft")}</p>
                                        <p className="text-2xl font-bold text-foreground">{stats.draft}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="border border-default-200 bg-content1 shadow-sm">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-red-100 rounded-xl">
                                        <Icon icon="solar:stop-circle-bold" className="text-2xl text-red-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-default-500">{localize("ปิดแล้ว", "Closed")}</p>
                                        <p className="text-2xl font-bold text-foreground">{stats.closed}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card className="border border-default-200 bg-content1 shadow-sm">
                        <CardBody className="p-4">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Input
                                    placeholder={localize("ค้นหาชื่อการจองคิว...", "Search queue titles...")}
                                    value={searchQuery}
                                    onValueChange={setSearchQuery}
                                    startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                                    className="flex-1"
                                    size="md"
                                />
                                <Select
                                    placeholder={localize("สถานะ", "Status")}
                                    aria-label={localize("กรองตามสถานะ", "Filter by status")}
                                    selectedKeys={[statusFilter]}
                                    onSelectionChange={(keys) => setStatusFilter(Array.from(keys)[0] as string)}
                                    className="w-full sm:w-40"
                                    size="md"
                                >
                                    <SelectItem key="all">{localize("ทุกสถานะ", "All statuses")}</SelectItem>
                                    <SelectItem key="draft">{localize("ฉบับร่าง", "Draft")}</SelectItem>
                                    <SelectItem key="active">{localize("กำลังเปิด", "Open")}</SelectItem>
                                    <SelectItem key="paused">{localize("หยุดชั่วคราว", "Paused")}</SelectItem>
                                    <SelectItem key="closed">{localize("ปิดแล้ว", "Closed")}</SelectItem>
                                </Select>
                            </div>
                        </CardBody>
                    </Card>



                    {sessions.length === 0 ? (
                        <Card className="border border-dashed border-default-300 bg-content2/50 shadow-sm">
                            <CardBody className="text-center py-16">
                                <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                                    <Icon
                                        icon="solar:clipboard-check-bold-duotone"
                                        className="text-5xl text-blue-500"
                                    />
                                </div>
                                <h3 className="mb-2 text-lg font-semibold text-default-700">{localize("ยังไม่มีการจองคิว", "No queue sessions yet")}</h3>
                                <p className="mx-auto mb-6 max-w-md text-default-500">
                                    {localize("สร้างการจองคิวเพื่อให้นักศึกษาสามารถจองคิวตรวจงานได้", "Create a queue so students can book grading slots")}
                                </p>
                                {canCreateQueueSessions && (
                                    <Button
                                        color="primary"
                                        onPress={handleOpenCreateModal}
                                        isDisabled={!isCourseActive}
                                        className={instructorPrimaryButtonClass("shadow-lg shadow-blue-400/25")}
                                    >
                                        {localize("สร้างการจองคิวแรก", "Create the first queue")}
                                    </Button>
                                )}
                            </CardBody>
                        </Card>
                    ) : (
                        <>
                            {/* Sessions Table */}
                            <Card className="border border-default-200 bg-content1 shadow-sm">
                                <CardBody className="p-2">
                                    <div className="overflow-x-auto">
                                        <Table
                                            aria-label="Queue sessions table"
                                            removeWrapper
                                            classNames={{
                                                base: "min-w-[850px]",
                                                th: "bg-content2 text-default-600 font-semibold text-sm whitespace-nowrap",
                                                td: "py-3 whitespace-nowrap",
                                            }}
                                        >
                                            <TableHeader>
                                                <TableColumn className="min-w-45">{localize("การจองคิว", "Queue")}</TableColumn>
                                                <TableColumn className="min-w-25">{localize("ห้อง", "Room")}</TableColumn>
                                                <TableColumn className="min-w-35">{localize("หัวข้อลงคะแนน", "Assignment")}</TableColumn>
                                                <TableColumn className="min-w-25">{localize("สถานะ", "Status")}</TableColumn>
                                                <TableColumn className="min-w-30">{localize("คิวรอ/เสร็จ", "Waiting/Done")}</TableColumn>
                                                <TableColumn align="center" className="min-w-40">{localize("จัดการ", "Actions")}</TableColumn>
                                            </TableHeader>
                                            <TableBody
                                                emptyContent={
                                                    <div className="py-10 text-center">
                                                        <Icon
                                                            icon="solar:clipboard-list-linear"
                                                            className="mx-auto mb-3 text-5xl text-default-300"
                                                        />
                                                        <p className="text-default-400">{localize("ยังไม่มีการจองคิว", "No queue sessions yet")}</p>
                                                        {canCreateQueueSessions && (
                                                            <Button
                                                                color="primary"
                                                                variant="flat"
                                                                size="sm"
                                                                className="mt-3"
                                                                onPress={handleOpenCreateModal}
                                                                isDisabled={!isCourseActive}
                                                            >
                                                                {localize("สร้างการจองคิวแรก", "Create the first queue")}
                                                            </Button>
                                                        )}
                                                    </div>
                                                }
                                            >
                                                {paginatedSessions.map((session) => (
                                                    <TableRow key={session.id}>
                                                        <TableCell>
                                                            <div>
                                                                <p className="font-medium text-foreground">{session.title}</p>
                                                                <p className="text-xs text-default-500">
                                                                    PIN: <span className="font-mono font-bold text-blue-600">{session.pin_code}</span>
                                                                    {session.created_at && ` • ${formatDate(session.created_at, locale)}`}
                                                                </p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="text-sm text-default-700">
                                                                {session.classroom?.name || '-'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="text-sm text-default-700">
                                                                {session.linkedAssignment?.name || '-'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                size="sm"
                                                                color={statusDisplay[session.status]?.color || "default"}
                                                                variant="flat"
                                                                startContent={
                                                                    session.status === "active" ? (
                                                                        <span className="relative flex h-2 w-2 mr-1">
                                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                                        </span>
                                                                    ) : undefined
                                                                }
                                                            >
                                                                {statusDisplay[session.status]?.label || session.status}
                                                            </Chip>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Tooltip content={localize("คิวรอ", "Waiting")}>
                                                                    <Chip size="sm" color="warning" variant="flat">
                                                                        {session.stats?.waiting || 0}
                                                                    </Chip>
                                                                </Tooltip>
                                                                <Tooltip content={localize("เสร็จแล้ว", "Done")}>
                                                                    <Chip size="sm" color="success" variant="flat">
                                                                        {session.stats?.completed || 0}
                                                                    </Chip>
                                                                </Tooltip>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center justify-center gap-1">
                                                                {/* ปุ่มดูรีพอร์ต (ทุกสถานะ) */}
                                                                <Tooltip content={localize("ดูรีพอร์ตคิว", "View queue report")}>
                                                                    <Button
                                                                        isIconOnly
                                                                        size="sm"
                                                                        variant="light"
                                                                        color="secondary"
                                                                        onPress={() => window.open(`/classroom/${course.id}/queue/${session.id}/report`, "_blank")}
                                                                    >
                                                                        <Icon icon="solar:chart-2-bold" className="text-lg" />
                                                                    </Button>
                                                                </Tooltip>
                                                                {/* Draft status: Start, Edit, Delete */}
                                                                {session.status === 'draft' && (
                                                                    <>
                                                                        {canUpdateQueueSessions && (
                                                                            <Tooltip content={localize("เริ่มการจองคิว", "Start queue")}>
                                                                                <Button
                                                                                    isIconOnly
                                                                                    size="sm"
                                                                                    variant="light"
                                                                                    color="success"
                                                                                    isDisabled={!isCourseActive}
                                                                                    onPress={() => handleOpenStartModal(session)}
                                                                                >
                                                                                    <Icon icon="solar:play-bold" className="text-lg" />
                                                                                </Button>
                                                                            </Tooltip>
                                                                        )}
                                                                        {canUpdateQueueSessions && (
                                                                            <Tooltip content={localize("แก้ไข", "Edit")}>
                                                                                <Button
                                                                                    isIconOnly
                                                                                    size="sm"
                                                                                    variant="light"
                                                                                    color="primary"
                                                                                    isDisabled={!isCourseActive}
                                                                                    onPress={() => handleOpenEditModal(session)}
                                                                                >
                                                                                    <Icon icon="solar:pen-bold" className="text-lg" />
                                                                                </Button>
                                                                            </Tooltip>
                                                                        )}
                                                                        {canUpdateQueueSessions && (
                                                                            <Tooltip content={localize("แก้ไขชื่อ", "Edit title")}>
                                                                                <Button
                                                                                    isIconOnly
                                                                                    size="sm"
                                                                                    variant="light"
                                                                                    color="primary"
                                                                                    isDisabled={!isCourseActive}
                                                                                    onPress={() => handleOpenEditModal(session)}
                                                                                >
                                                                                    <Icon icon="solar:pen-bold" className="text-lg" />
                                                                                </Button>
                                                                            </Tooltip>
                                                                        )}
                                                                        {canDeleteQueueSessions && (
                                                                            <Tooltip content={localize("ลบ", "Delete")} color="danger">
                                                                                <Button
                                                                                    isIconOnly
                                                                                    size="sm"
                                                                                    variant="light"
                                                                                    color="danger"
                                                                                    isDisabled={!isCourseActive}
                                                                                    onPress={() => {
                                                                                        setDeleteTarget(session);
                                                                                        setIsDeleteModalOpen(true);
                                                                                    }}
                                                                                >
                                                                                    <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />
                                                                                </Button>
                                                                            </Tooltip>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {/* Active status: Projector, Worker, Pause, Delete */}
                                                                {session.status === 'active' && (() => {
                                                                    const hasPending = (session.stats?.waiting || 0) > 0 || (session.stats?.in_progress || 0) > 0;
                                                                    const deleteTooltip = hasPending
                                                                        ? localize(
                                                                            `ยังมีคิวค้างอยู่ (รอ ${session.stats?.waiting || 0} / กำลังตรวจ ${session.stats?.in_progress || 0})`,
                                                                            `Pending bookings remain (waiting ${session.stats?.waiting || 0} / in progress ${session.stats?.in_progress || 0})`
                                                                        )
                                                                        : localize("ต้องหยุดรับคิวก่อนจึงจะลบได้", "Pause the queue before deleting it");
                                                                    return (
                                                                        <>
                                                                            <Tooltip content={localize("เปิดหน้าจอโปรเจคเตอร์", "Open projector view")}>
                                                                                <Button
                                                                                    isIconOnly
                                                                                    size="sm"
                                                                                    variant="light"
                                                                                    color="secondary"
                                                                                    onPress={() => handleOpenProjector(session)}
                                                                                >
                                                                                    <Icon icon="solar:monitor-bold" className="text-lg" />
                                                                                </Button>
                                                                            </Tooltip>
                                                                            {canManageQueueBookings && (
                                                                                <Tooltip content={localize("เข้าหน้ารับคิว", "Open worker view")}>
                                                                                    <Button
                                                                                        isIconOnly
                                                                                        size="sm"
                                                                                        variant="light"
                                                                                        color="primary"
                                                                                        onPress={() => handleGoToWorker(session)}
                                                                                    >
                                                                                        <Icon icon="solar:user-check-bold" className="text-lg" />
                                                                                    </Button>
                                                                                </Tooltip>
                                                                            )}
                                                                            {canUpdateQueueSessions && (
                                                                                <Tooltip content={localize("หยุดรับคิว", "Pause queue")}>
                                                                                    <Button
                                                                                        isIconOnly
                                                                                        size="sm"
                                                                                        variant="light"
                                                                                        color="warning"
                                                                                        isDisabled={!isCourseActive}
                                                                                        onPress={() => handleOpenPauseModal(session, 'paused')}
                                                                                    >
                                                                                        <Icon icon="solar:pause-bold" className="text-lg" />
                                                                                    </Button>
                                                                                </Tooltip>
                                                                            )}
                                                                            <Tooltip content={deleteTooltip} color="danger">
                                                                                <span>
                                                                                    <Button
                                                                                        isIconOnly
                                                                                        size="sm"
                                                                                        variant="light"
                                                                                        color="danger"
                                                                                        isDisabled
                                                                                    >
                                                                                        <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />
                                                                                    </Button>
                                                                                </span>
                                                                            </Tooltip>
                                                                        </>
                                                                    );
                                                                })()}
                                                                {/* Paused status: Projector, Worker, Resume, Delete */}
                                                                {session.status === 'paused' && (() => {
                                                                    const hasPending = (session.stats?.waiting || 0) > 0 || (session.stats?.in_progress || 0) > 0;
                                                                    return (
                                                                        <>
                                                                            <Tooltip content={localize("เปิดหน้าจอโปรเจคเตอร์", "Open projector view")}>
                                                                                <Button
                                                                                    isIconOnly
                                                                                    size="sm"
                                                                                    variant="light"
                                                                                    color="secondary"
                                                                                    onPress={() => handleOpenProjector(session)}
                                                                                >
                                                                                    <Icon icon="solar:monitor-bold" className="text-lg" />
                                                                                </Button>
                                                                            </Tooltip>
                                                                            {canManageQueueBookings && (
                                                                                <Tooltip content={localize("เข้าหน้ารับคิว", "Open worker view")}>
                                                                                    <Button
                                                                                        isIconOnly
                                                                                        size="sm"
                                                                                        variant="light"
                                                                                        color="primary"
                                                                                        onPress={() => handleGoToWorker(session)}
                                                                                    >
                                                                                        <Icon icon="solar:user-check-bold" className="text-lg" />
                                                                                    </Button>
                                                                                </Tooltip>
                                                                            )}
                                                                            {canUpdateQueueSessions && (
                                                                                <Tooltip content={localize("เปิดรับคิว", "Resume queue")}>
                                                                                    <Button
                                                                                        isIconOnly
                                                                                        size="sm"
                                                                                        variant="light"
                                                                                        color="success"
                                                                                        isDisabled={!isCourseActive}
                                                                                        onPress={() => handleOpenPauseModal(session, 'active')}
                                                                                    >
                                                                                        <Icon icon="solar:play-bold" className="text-lg" />
                                                                                    </Button>
                                                                                </Tooltip>
                                                                            )}
                                                                            {canDeleteQueueSessions && (
                                                                                <Tooltip
                                                                                    content={hasPending
                                                                                        ? localize(
                                                                                            `ยังมีคิวค้างอยู่ (รอ ${session.stats?.waiting || 0} / กำลังตรวจ ${session.stats?.in_progress || 0})`,
                                                                                            `Pending bookings remain (waiting ${session.stats?.waiting || 0} / in progress ${session.stats?.in_progress || 0})`
                                                                                        )
                                                                                        : localize("ลบ", "Delete")
                                                                                    }
                                                                                    color={hasPending ? "warning" : "danger"}
                                                                                >
                                                                                    <span>
                                                                                        <Button
                                                                                            isIconOnly
                                                                                            size="sm"
                                                                                            variant="light"
                                                                                            color="danger"
                                                                                            isDisabled={hasPending || !isCourseActive}
                                                                                            onPress={() => {
                                                                                                if (!hasPending) {
                                                                                                    setDeleteTarget(session);
                                                                                                    setIsDeleteModalOpen(true);
                                                                                                }
                                                                                            }}
                                                                                        >
                                                                                            <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />
                                                                                        </Button>
                                                                                    </span>
                                                                                </Tooltip>
                                                                            )}
                                                                        </>
                                                                    );
                                                                })()}
                                                                {session.status === 'closed' && (
                                                                    <>
                                                                        {canUpdateQueueSessions && (
                                                                            <Tooltip content={localize("Edit title", "Edit title")}>
                                                                                <Button
                                                                                    isIconOnly
                                                                                    size="sm"
                                                                                    variant="light"
                                                                                    color="primary"
                                                                                    isDisabled={!isCourseActive}
                                                                                    onPress={() => handleOpenEditModal(session)}
                                                                                >
                                                                                    <Icon icon="solar:pen-bold" className="text-lg" />
                                                                                </Button>
                                                                            </Tooltip>
                                                                        )}
                                                                        <Chip size="sm" variant="flat" className="bg-content3 text-default-500">{localize("ปิดแล้ว", "Closed")}</Chip>
                                                                        {canDeleteQueueSessions && (
                                                                            <Tooltip content={localize("ลบ", "Delete")} color="danger">
                                                                                <Button
                                                                                    isIconOnly
                                                                                    size="sm"
                                                                                    variant="light"
                                                                                    color="danger"
                                                                                    isDisabled={!isCourseActive}
                                                                                    onPress={() => {
                                                                                        setDeleteTarget(session);
                                                                                        setIsDeleteModalOpen(true);
                                                                                    }}
                                                                                >
                                                                                    <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />
                                                                                </Button>
                                                                            </Tooltip>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    <TablePaginationFooter
                                        totalItems={filteredSessions.length}
                                        currentPage={currentPage}
                                        rowsPerPage={rowsPerPage}
                                        totalPages={totalPages}
                                        isEnglish={isEnglish}
                                        nounEnglish="queue"
                                        nounEnglishPlural="queues"
                                        nounThai="รายการ"
                                        onPageChange={setCurrentPage}
                                        onRowsPerPageChange={setRowsPerPage}
                                    />
                                </CardBody>
                            </Card>
                        </>
                    )}
                </>
            )}

            {/* Create Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                isDismissable={false}
                isKeyboardDismissDisabled={true}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    resetForm();
                }}
                size="2xl"
                scrollBehavior="inside"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:clipboard-list-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{localize("สร้างการจองคิว", "Create queue")}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">
                                    {localize("กำหนดรายละเอียดการจองคิวตรวจงาน", "Set up the grading queue details")}
                                </p>
                            </div>
                            </div>
                        </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            <Input
                                label={localize("ชื่อการจองคิว", "Queue title")}
                                placeholder={localize("เช่น ตรวจ Lab 1", "e.g. Lab 1 review")}
                                value={formData.title}
                                onValueChange={(value) => setFormData({ ...formData, title: value })}
                                isRequired
                                labelPlacement="outside"
                                variant="bordered"
                                size="md"
                                classNames={{
                                    inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-default-600 font-medium text-sm",
                                }}
                            />

                            <Select
                                label={localize("เลือกห้องเรียน", "Classroom")}
                                placeholder={localize("เลือกห้อง", "Select a room")}
                                isLoading={isOptionsLoading}
                                selectedKeys={
                                    formData.classroom_id
                                        ? new Set([formData.classroom_id])
                                        : new Set()
                                }
                                onSelectionChange={(keys) => {
                                    const selected = Array.from(keys)[0];
                                    if (selected) {
                                        setFormData({
                                            ...formData,
                                            classroom_id: selected as string,
                                        });
                                    }
                                }}
                                isRequired
                                labelPlacement="outside"
                                variant="bordered"
                                size="md"
                                className="py-3"
                                classNames={{
                                    trigger: "bg-content1 border-default-200",
                                    label: "text-default-600 font-medium text-sm",
                                }}
                            >
                                {classrooms.map((room) => (
                                    <SelectItem
                                        key={room.id.toString()}
                                        textValue={`${room.name} - ${room.building}`}
                                    >
                                        {room.name} - {room.building}
                                    </SelectItem>
                                ))}
                            </Select>


                            <Input
                                label={localize("คำอธิบาย (ถ้ามี)", "Description (optional)")}
                                placeholder={localize("รายละเอียดเพิ่มเติม", "Additional details")}
                                value={formData.description || ""}
                                onValueChange={(value) => setFormData({ ...formData, description: value })}
                                isDisabled={isClosedEditSession}
                                labelPlacement="outside"
                                variant="bordered"
                                size="md"
                                classNames={{
                                    inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-default-600 font-medium text-sm",
                                }}
                            />

                            {/* ลิงก์กับหัวข้องาน */}
                            <div className="rounded-xl border border-default-200 bg-content2 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-100 rounded-lg">
                                            <Icon icon="solar:document-bold" className="text-lg text-amber-600" />
                                        </div>
                                        <div>
                                            <span className="font-semibold text-default-700">{localize("ลิงก์กับหัวข้องาน", "Link assignment")}</span>
                                            <p className="text-xs text-default-500">{localize("เชื่อมโยงกับ Assignment เพื่อลงคะแนนอัตโนมัติ", "Connect an assignment for automatic scoring")}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={formData.linked_assignment_id ? "solid" : "bordered"}
                                        color={formData.linked_assignment_id ? "warning" : "default"}
                                        isDisabled={isClosedEditSession}
                                        onPress={() => {
                                            if (formData.linked_assignment_id) {
                                                setFormData({ ...formData, linked_assignment_id: null });
                                            }
                                        }}
                                    >
                                        {formData.linked_assignment_id ? localize("ลิงก์แล้ว", "Linked") : localize("ไม่ลิงก์", "Not linked")}
                                    </Button>
                                </div>

                                {assignments.length > 0 ? (
                                    <Select
                                        placeholder={localize("เลือกหัวข้องานที่ต้องการลิงก์", "Select an assignment to link")}
                                        aria-label={localize("เลือกหัวข้องาน", "Select assignment")}
                                        isLoading={isOptionsLoading}
                                        isDisabled={isClosedEditSession}
                                        selectedKeys={formData.linked_assignment_id ? new Set([formData.linked_assignment_id.toString()]) : new Set([])}
                                        onSelectionChange={(keys) => {
                                            const selected = Array.from(keys as Set<string>)[0];
                                            setFormData({
                                                ...formData,
                                                linked_assignment_id: selected ? parseInt(selected) : null
                                            });
                                        }}
                                        variant="bordered"
                                        classNames={{
                                            trigger: "bg-content1 border-default-200",
                                            value: "text-default-700",
                                        }}
                                    >
                                        {assignments.map((assignment) => (
                                            <SelectItem key={assignment.id.toString()} textValue={assignment.name}>
                                                <div className="flex items-center gap-3">
                                                    <Icon
                                                        icon={assignment.assignment_type === "individual" ? "solar:user-bold" : "solar:users-group-rounded-bold"}
                                                        className={assignment.assignment_type === "individual" ? "text-indigo-500" : "text-purple-500"}
                                                    />
                                                    <div>
                                                        <span className="font-medium">{assignment.name}</span>
                                                        <span className="ml-2 text-xs text-default-500">
                                                            ({assignment.max_score} {localize("คะแนน", "pts")})
                                                        </span>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </Select>
                                ) : (
                                    <div className="rounded-lg bg-content3 p-3 text-center">
                                        <Icon icon="solar:document-linear" className="mb-1 text-xl text-default-400" />
                                        <p className="text-sm text-default-500">{localize("ยังไม่มีหัวข้องาน", "No assignments yet")}</p>
                                    </div>
                                )}

                                {formData.linked_assignment_id && (
                                    <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                        <div className="flex items-center gap-2 text-amber-700">
                                            <Icon icon="solar:info-circle-bold" />
                                            <span className="text-sm font-medium">
                                                {localize("เมื่อตรวจงานเสร็จ คะแนนจะถูกบันทึกไปยังหัวข้องานนี้โดยอัตโนมัติ", "When grading is completed, scores will be saved to this assignment automatically")}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ลิงก์กับการเช็คชื่อ */}
                            <div className="rounded-xl border border-default-200 bg-content2 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <Icon icon="solar:clipboard-check-bold" className="text-lg text-blue-600" />
                                        </div>
                                        <div>
                                            <span className="font-semibold text-default-700">{localize("ลิงก์กับการเช็คชื่อ", "Link attendance")}</span>
                                            <p className="text-xs text-default-500">{localize("ถ้านักศึกษาขาดเรียน จะไม่อนุญาตให้จองคิว", "Students marked absent will not be allowed to book the queue")}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={formData.linked_attendance_session_id ? "solid" : "bordered"}
                                        color={formData.linked_attendance_session_id ? "primary" : "default"}
                                        isDisabled={isClosedEditSession}
                                        onPress={() => {
                                            if (formData.linked_attendance_session_id) {
                                                setFormData({ ...formData, require_attendance: false, linked_attendance_session_id: null });
                                            }
                                        }}
                                    >
                                        {formData.linked_attendance_session_id ? localize("ลิงก์แล้ว", "Linked") : localize("ไม่ลิงก์", "Not linked")}
                                    </Button>
                                </div>

                                {attendanceSessions.length > 0 ? (
                                    <Select
                                        placeholder={localize("เลือกรอบเช็คชื่อที่ต้องการลิงก์", "Select an attendance session to link")}
                                        aria-label={localize("เลือกรอบเช็คชื่อ", "Select attendance session")}
                                        isLoading={isOptionsLoading}
                                        isDisabled={isClosedEditSession}
                                        selectedKeys={formData.linked_attendance_session_id ? [formData.linked_attendance_session_id.toString()] : undefined}
                                        onSelectionChange={(keys) => {
                                            const selected = Array.from(keys)[0];
                                            setFormData({
                                                ...formData,
                                                require_attendance: selected ? true : false,
                                                linked_attendance_session_id: selected ? parseInt(selected as string) : null
                                            });
                                        }}
                                        variant="bordered"
                                        classNames={{
                                            trigger: "bg-content1 border-default-200",
                                            value: "text-default-700",
                                        }}
                                    >
                                        {attendanceSessions.map((session) => (
                                            <SelectItem key={session.id.toString()} textValue={session.title}>
                                                <div className="flex items-center gap-3">
                                                    <Icon
                                                        icon={session.session_type === "lecture" ? "solar:presentation-graph-bold" :
                                                            session.session_type === "lab" ? "solar:test-tube-bold" : "solar:laptop-bold"}
                                                        className={session.session_type === "lecture" ? "text-blue-500" :
                                                            session.session_type === "lab" ? "text-emerald-500" : "text-violet-500"}
                                                    />
                                                    <div>
                                                        <span className="font-medium">{session.title}</span>
                                                        <span className="ml-2 text-xs text-default-500">
                                                            {formatShortDate(session.start_time, locale)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </Select>
                                ) : (
                                    <div className="rounded-lg bg-content3 p-3 text-center">
                                        <Icon icon="solar:clipboard-list-linear" className="mb-1 text-xl text-default-400" />
                                        <p className="text-sm text-default-500">{localize("ยังไม่มีรอบเช็คชื่อ", "No attendance sessions yet")}</p>
                                    </div>
                                )}

                                {formData.linked_attendance_session_id && (
                                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2 text-blue-700">
                                            <Icon icon="solar:info-circle-bold" />
                                            <span className="text-sm font-medium">
                                                {localize("นักศึกษาที่ขาดเรียนในรอบเช็คชื่อนี้ จะไม่สามารถจองคิวได้", "Students absent in this attendance session will not be able to book the queue")}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button
                            variant="light"
                            onPress={() => {
                                setIsCreateModalOpen(false);
                                resetForm();
                            }}
                        >
                            {localize("ยกเลิก", "Cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleCreateSession}
                            isLoading={isSubmitting}
                            isDisabled={!isCourseActive || !formData.title.trim() || !formData.classroom_id}
                            className={instructorPrimaryButtonClass()}
                        >
                            {localize("สร้างการจองคิว", "Create queue")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={isEditModalOpen}
                isDismissable={false}
                isKeyboardDismissDisabled={true}
                onClose={() => {
                    setIsEditModalOpen(false);
                    resetForm();
                }}
                size="2xl"
                scrollBehavior="inside"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:pen-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{localize("แก้ไขการจองคิว", "Edit queue")}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">
                                    {localize("แก้ไขข้อมูลการจองคิวตรวจงาน", "Update the grading queue details")}
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            <Input
                                label={localize("ชื่อการจองคิว", "Queue title")}
                                placeholder={localize("เช่น ตรวจ Lab 1", "e.g. Lab 1 review")}
                                value={formData.title}
                                onValueChange={(value) => setFormData({ ...formData, title: value })}
                                isRequired
                                labelPlacement="outside"
                                variant="bordered"
                                size="md"
                                classNames={{
                                    inputWrapper: "bg-content1 border-default-200 hover:border-amber-300 focus-within:!border-amber-400",
                                    label: "text-default-600 font-medium text-sm",
                                }}
                            />
                            {isClosedEditSession && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                    {localize("รอบที่ปิดใช้งานแล้วจะแก้ไขได้เฉพาะชื่อ session เท่านั้น", "Closed sessions can only update the session title.")}
                                </div>
                            )}
                            <Input
                                label={localize("คำอธิบาย (ถ้ามี)", "Description (optional)")}
                                placeholder={localize("รายละเอียดเพิ่มเติม", "Additional details")}
                                value={formData.description || ""}
                                onValueChange={(value) => setFormData({ ...formData, description: value })}
                                labelPlacement="outside"
                                variant="bordered"
                                size="md"
                                classNames={{
                                    inputWrapper: "bg-content1 border-default-200 hover:border-amber-300 focus-within:!border-amber-400",
                                    label: "text-default-600 font-medium text-sm",
                                }}
                            />

                            {false && (
                            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-rose-700">{localize("Cutoff เวลาในการจอง", "Booking cutoff")}</p>
                                        <p className="text-xs text-rose-600">{localize("จองหลังเวลานี้จะถูกติดป้ายว่า Late Booking", "Bookings after this time will be tagged as Late Booking")}</p>
                                    </div>
                                    <Checkbox
                                        isSelected={Boolean(formData.is_cutoff_enabled)}
                                        onValueChange={(value) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                is_cutoff_enabled: value,
                                                cutoff_at: value ? prev.cutoff_at || null : null,
                                                cutoff_note: value ? prev.cutoff_note || "" : "",
                                            }))
                                        }
                                    >
                                        {localize("เปิดใช้งาน", "Enable")}
                                    </Checkbox>
                                </div>

                                {formData.is_cutoff_enabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block mb-1 text-rose-700 font-medium text-sm">{localize("เวลา Cutoff", "Cutoff time")}</label>
                                            <input
                                                type="datetime-local"
                                                value={toLocalDateTimeInputValue(formData.cutoff_at)}
                                                onChange={(event) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        cutoff_at: localDateTimeInputToIso(event.target.value),
                                                    }))
                                                }
                                                className="h-11 w-full rounded-xl border border-rose-200 bg-content1 px-3 text-foreground outline-none transition-colors hover:border-rose-300 focus:border-rose-400"
                                            />
                                        </div>
                                        <div>
                                            <label className="block mb-1 text-rose-700 font-medium text-sm">{localize("ข้อความเตือน (ถ้ามี)", "Warning message (optional)")}</label>
                                            <input
                                                type="text"
                                                placeholder={localize("เช่น ส่งหลัง cutoff จะถูกหักคะแนน", "e.g. Late bookings will lose points")}
                                                value={formData.cutoff_note || ""}
                                                onChange={(event) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        cutoff_note: event.target.value,
                                                    }))
                                                }
                                                className="h-11 w-full rounded-xl border border-rose-200 bg-content1 px-3 text-foreground placeholder:text-default-400 outline-none transition-colors hover:border-rose-300 focus:border-rose-400"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            )}

                            {/* ลิงก์กับหัวข้องาน */}
                            <div className="rounded-xl border border-default-200 bg-content2 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-100 rounded-lg">
                                            <Icon icon="solar:document-bold" className="text-lg text-amber-600" />
                                        </div>
                                        <div>
                                            <span className="font-semibold text-default-700">{localize("ลิงก์กับหัวข้องาน", "Link assignment")}</span>
                                            <p className="text-xs text-default-500">{localize("เชื่อมโยงกับ Assignment เพื่อลงคะแนนอัตโนมัติ", "Connect an assignment for automatic scoring")}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={formData.linked_assignment_id ? "solid" : "bordered"}
                                        color={formData.linked_assignment_id ? "warning" : "default"}
                                        onPress={() => {
                                            if (formData.linked_assignment_id) {
                                                setFormData({ ...formData, linked_assignment_id: null });
                                            }
                                        }}
                                    >
                                        {formData.linked_assignment_id ? localize("ลิงก์แล้ว", "Linked") : localize("ไม่ลิงก์", "Not linked")}
                                    </Button>
                                </div>

                                {assignments.length > 0 ? (
                                    <Select
                                        placeholder={localize("เลือกหัวข้องานที่ต้องการลิงก์", "Select an assignment to link")}
                                        aria-label={localize("เลือกหัวข้องาน", "Select assignment")}
                                        isLoading={isOptionsLoading}
                                        selectedKeys={formData.linked_assignment_id ? new Set([formData.linked_assignment_id.toString()]) : new Set([])}
                                        onSelectionChange={(keys) => {
                                            const selected = Array.from(keys as Set<string>)[0];
                                            setFormData({
                                                ...formData,
                                                linked_assignment_id: selected ? parseInt(selected) : null
                                            });
                                        }}
                                        variant="bordered"
                                        classNames={{
                                            trigger: "bg-content1 border-default-200",
                                            value: "text-default-700",
                                        }}
                                    >
                                        {assignments.map((assignment) => (
                                            <SelectItem key={assignment.id.toString()} textValue={assignment.name}>
                                                <div className="flex items-center gap-3">
                                                    <Icon
                                                        icon={assignment.assignment_type === "individual" ? "solar:user-bold" : "solar:users-group-rounded-bold"}
                                                        className={assignment.assignment_type === "individual" ? "text-indigo-500" : "text-purple-500"}
                                                    />
                                                    <div>
                                                        <span className="font-medium">{assignment.name}</span>
                                                        <span className="ml-2 text-xs text-default-500">
                                                            ({assignment.max_score} {localize("คะแนน", "pts")})
                                                        </span>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </Select>
                                ) : (
                                    <div className="rounded-lg bg-content3 p-3 text-center">
                                        <Icon icon="solar:document-linear" className="mb-1 text-xl text-default-400" />
                                        <p className="text-sm text-default-500">{localize("ยังไม่มีหัวข้องาน", "No assignments yet")}</p>
                                    </div>
                                )}

                                {formData.linked_assignment_id && (
                                    <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                        <div className="flex items-center gap-2 text-amber-700">
                                            <Icon icon="solar:info-circle-bold" />
                                            <span className="text-sm font-medium">
                                                {localize("เมื่อตรวจงานเสร็จ คะแนนจะถูกบันทึกไปยังหัวข้องานนี้โดยอัตโนมัติ", "When grading is completed, scores will be saved to this assignment automatically")}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ลิงก์กับการเช็คชื่อ */}
                            <div className="rounded-xl border border-default-200 bg-content2 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <Icon icon="solar:clipboard-check-bold" className="text-lg text-blue-600" />
                                        </div>
                                        <div>
                                            <span className="font-semibold text-default-700">{localize("ลิงก์กับการเช็คชื่อ", "Link attendance")}</span>
                                            <p className="text-xs text-default-500">{localize("ถ้านักศึกษาขาดเรียน จะไม่อนุญาตให้จองคิว", "Students marked absent will not be allowed to book the queue")}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={formData.linked_attendance_session_id ? "solid" : "bordered"}
                                        color={formData.linked_attendance_session_id ? "primary" : "default"}
                                        onPress={() => {
                                            if (formData.linked_attendance_session_id) {
                                                setFormData({ ...formData, require_attendance: false, linked_attendance_session_id: null });
                                            }
                                        }}
                                    >
                                        {formData.linked_attendance_session_id ? localize("ลิงก์แล้ว", "Linked") : localize("ไม่ลิงก์", "Not linked")}
                                    </Button>
                                </div>

                                {attendanceSessions.length > 0 ? (
                                    <Select
                                        placeholder={localize("เลือกรอบเช็คชื่อที่ต้องการลิงก์", "Select an attendance session to link")}
                                        aria-label={localize("เลือกรอบเช็คชื่อ", "Select attendance session")}
                                        isLoading={isOptionsLoading}
                                        selectedKeys={formData.linked_attendance_session_id ? [formData.linked_attendance_session_id.toString()] : undefined}
                                        onSelectionChange={(keys) => {
                                            const selected = Array.from(keys)[0];
                                            setFormData({
                                                ...formData,
                                                require_attendance: selected ? true : false,
                                                linked_attendance_session_id: selected ? parseInt(selected as string) : null
                                            });
                                        }}
                                        variant="bordered"
                                        classNames={{
                                            trigger: "bg-content1 border-default-200",
                                            value: "text-default-700",
                                        }}
                                    >
                                        {attendanceSessions.map((session) => (
                                            <SelectItem key={session.id.toString()} textValue={session.title}>
                                                <div className="flex items-center gap-3">
                                                    <Icon
                                                        icon={session.session_type === "lecture" ? "solar:presentation-graph-bold" :
                                                            session.session_type === "lab" ? "solar:test-tube-bold" : "solar:laptop-bold"}
                                                        className={session.session_type === "lecture" ? "text-blue-500" :
                                                            session.session_type === "lab" ? "text-emerald-500" : "text-violet-500"}
                                                    />
                                                    <div>
                                                        <span className="font-medium">{session.title}</span>
                                                        <span className="ml-2 text-xs text-default-500">
                                                            {formatShortDate(session.start_time, locale)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </Select>
                                ) : (
                                    <div className="rounded-lg bg-content3 p-3 text-center">
                                        <Icon icon="solar:clipboard-list-linear" className="mb-1 text-xl text-default-400" />
                                        <p className="text-sm text-default-500">{localize("ยังไม่มีรอบเช็คชื่อ", "No attendance sessions yet")}</p>
                                    </div>
                                )}

                                {formData.linked_attendance_session_id && (
                                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2 text-blue-700">
                                            <Icon icon="solar:info-circle-bold" />
                                            <span className="text-sm font-medium">
                                                {localize("นักศึกษาที่ขาดเรียนในรอบเช็คชื่อนี้ จะไม่สามารถจองคิวได้", "Students absent in this attendance session will not be able to book the queue")}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button
                            variant="light"
                            onPress={() => {
                                setIsEditModalOpen(false);
                                resetForm();
                            }}
                        >
                            {localize("ยกเลิก", "Cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleUpdateSession}
                            isLoading={isSubmitting}
                            isDisabled={!isCourseActive || !formData.title.trim() || !hasFormChanges()}
                            className={instructorPrimaryButtonClass()}
                        >
                            {localize("บันทึกการแก้ไข", "Save changes")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
                <ModalContent>
                    <ModalHeader className="flex items-center gap-3">
                        <div className="p-2 bg-linear-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
                            <Icon icon="solar:trash-bin-trash-bold" className="text-xl text-white" />
                        </div>
                        <span className="text-lg font-bold text-foreground">{localize("ยืนยันการลบ", "Confirm deletion")}</span>
                    </ModalHeader>
                    <ModalBody>
                        <p>{localize("คุณต้องการลบการจองคิว", "Do you want to delete the queue")} <span className="font-semibold">{deleteTarget?.title}</span> {localize("ใช่หรือไม่?", "?")}</p>
                        <p className="text-sm text-default-500">{localize("การดำเนินการนี้ไม่สามารถย้อนกลับได้", "This action cannot be undone")}</p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setIsDeleteModalOpen(false)}>
                            {localize("ยกเลิก", "Cancel")}
                        </Button>
                        <Button color="primary" onPress={handleDeleteSession} isLoading={isSubmitting} isDisabled={!isCourseActive} className={instructorPrimaryButtonClass()}>
                            {localize("ลบ", "Delete")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Start Queue Confirmation Modal */}
            <Modal isOpen={isStartModalOpen} onClose={() => setIsStartModalOpen(false)}>
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2">
                        <div className="p-2 bg-linear-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
                            <Icon icon="solar:play-circle-bold" className="text-xl text-white" />
                        </div>
                        <span>{localize("ยืนยันเริ่มการจองคิว", "Confirm queue start")}</span>
                    </ModalHeader>
                    <ModalBody>
                        <p>{localize("คุณต้องการเริ่มการจองคิว", "Do you want to start the queue")} <span className="font-semibold">{startTarget?.title}</span> {localize("ใช่หรือไม่?", "?")}</p>
                        <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                            <div className="flex items-start gap-2">
                                <Icon icon="solar:info-circle-bold" className="text-emerald-600 text-lg mt-0.5" />
                                <div className="text-sm text-emerald-700">
                                    <p>{localize("เมื่อเริ่มแล้ว:", "Once started:")}</p>
                                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                                        <li>{localize("นักศึกษาจะสามารถจองคิวได้", "Students will be able to book the queue")}</li>
                                        <li>{localize("QR Code และ PIN จะเปิดใช้งาน", "The QR code and PIN will become active")}</li>
                                        <li>{localize("TA สามารถเข้าหน้ารับคิวได้", "TAs will be able to open the worker view")}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setIsStartModalOpen(false)}>
                            {localize("ยกเลิก", "Cancel")}
                        </Button>
                        <Button 
                            color="primary" 
                            onPress={handleStartQueue} 
                            isLoading={isSubmitting}
                            isDisabled={!isCourseActive}
                            className={instructorPrimaryButtonClass()}
                        >
                            {localize("เริ่มการจองคิว", "Start queue")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Pause/Resume Confirmation Modal */}
            <Modal isOpen={isPauseModalOpen} onClose={() => setIsPauseModalOpen(false)}>
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2">
                        <div className="p-2 bg-linear-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
                            <Icon 
                                icon={pauseAction === 'paused' ? "solar:pause-circle-bold" : "solar:play-circle-bold"} 
                                className="text-xl text-white" 
                            />
                        </div>
                        <span>{pauseAction === 'paused' ? localize('ยืนยันหยุดรับคิว', 'Confirm queue pause') : localize('ยืนยันเปิดรับคิว', 'Confirm queue resume')}</span>
                    </ModalHeader>
                    <ModalBody>
                        <p>
                            {pauseAction === 'paused' ? localize('คุณต้องการหยุดรับคิว', 'Do you want to pause the queue') : localize('คุณต้องการเปิดรับคิว', 'Do you want to resume the queue')} 
                            <span className="font-semibold"> {pauseTarget?.title}</span> {localize('ใช่หรือไม่?', '?')}
                        </p>
                        {pauseAction === 'paused' ? (
                            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <div className="flex items-start gap-2">
                                    <Icon icon="solar:info-circle-bold" className="text-amber-600 text-lg mt-0.5" />
                                    <div className="text-sm text-amber-700">
                                        <p>{localize("เมื่อหยุดรับคิว:", "When paused:")}</p>
                                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                                            <li>{localize("นักศึกษาจะไม่สามารถจองคิวใหม่ได้", "Students will not be able to create new bookings")}</li>
                                            <li>{localize("QR Code และ PIN จะถูกซ่อน", "The QR code and PIN will be hidden")}</li>
                                            <li>{localize("คิวที่จองไว้แล้วยังสามารถทำงานต่อได้", "Existing bookings can still continue")}</li>
                                            <li>{localize("สามารถเปิดรับคิวใหม่ได้ทุกเมื่อ", "You can resume the queue at any time")}</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                <div className="flex items-start gap-2">
                                    <Icon icon="solar:info-circle-bold" className="text-emerald-600 text-lg mt-0.5" />
                                    <div className="text-sm text-emerald-700">
                                        <p>{localize("เมื่อเปิดรับคิว:", "When resumed:")}</p>
                                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                                            <li>{localize("นักศึกษาจะสามารถจองคิวได้อีกครั้ง", "Students will be able to book the queue again")}</li>
                                            <li>{localize("QR Code และ PIN จะแสดงอีกครั้ง", "The QR code and PIN will be shown again")}</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setIsPauseModalOpen(false)}>
                            {localize("ยกเลิก", "Cancel")}
                        </Button>
                        <Button 
                            color="primary" 
                            onPress={handlePauseResumeQueue} 
                            isLoading={isSubmitting}
                            isDisabled={!isCourseActive}
                            className={instructorPrimaryButtonClass()}
                        >
                            {pauseAction === 'paused' ? localize('หยุดรับคิว', 'Pause queue') : localize('เปิดรับคิว', 'Resume queue')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Classroom Conflict Modal */}
            <Modal isOpen={isConflictModalOpen} onClose={() => setIsConflictModalOpen(false)}>
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2">
                        <div className="p-2 bg-linear-to-br from-orange-400 to-red-500 rounded-lg shadow-lg shadow-red-500/30">
                            <Icon icon="solar:lock-keyhole-bold" className="text-xl text-white" />
                        </div>
                        <span>{localize("ห้องเรียนถูกใช้งานอยู่", "Classroom In Use")}</span>
                    </ModalHeader>
                    <ModalBody>
                        <div className="space-y-3">
                            <p className="text-default-700">
                                {localize("ห้องเรียนนี้กำลังถูกใช้งานโดย", "This classroom is currently in use by")}
                                {" "}<span className="font-semibold">{classroomConflict?.course_name}</span>
                            </p>
                            {classroomConflict && (
                                <div className="rounded-lg bg-danger-50 dark:bg-danger-900/20 p-3 border border-danger-200 dark:border-danger-800">
                                    <div className="flex items-start gap-2">
                                        <Icon icon="solar:play-circle-bold" className="text-danger-500 text-lg mt-0.5 shrink-0" />
                                        <div className="text-sm text-danger-700 dark:text-danger-300 space-y-0.5">
                                            <p><span className="font-medium">{localize("คิว", "Session")}:</span> {classroomConflict.session_title}</p>
                                            <p><span className="font-medium">{localize("วิชา", "Course")}:</span> {classroomConflict.course_name}</p>
                                            {classroomConflict.started_at && (
                                                <p><span className="font-medium">{localize("เริ่มเมื่อ", "Started")}:</span> {formatDateTime(classroomConflict.started_at, locale)}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="rounded-lg bg-warning-50 dark:bg-warning-900/20 p-3 border border-warning-200 dark:border-warning-800">
                                <div className="flex items-start gap-2">
                                    <Icon icon="solar:info-circle-bold" className="text-warning-600 text-lg mt-0.5 shrink-0" />
                                    <p className="text-sm text-warning-700 dark:text-warning-300">
                                        {localize(
                                            "กรุณาติดต่อแอดมินทาง Facebook หรือ LINE เพื่อขอให้ปิดคิวที่ค้างอยู่",
                                            "Please contact an admin via Facebook or LINE to close the stale session."
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button color="primary" onPress={() => setIsConflictModalOpen(false)} className={instructorPrimaryButtonClass()}>
                            {localize("ตกลง", "OK")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
        {pendingQueueUpdate && createPortal(
            <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-9999 sm:max-w-sm sm:w-full animate-toast-slide-up">
                <div className="overflow-hidden rounded-2xl border border-blue-200 bg-content1/95 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center gap-3 p-4">
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <Icon icon="solar:bell-bing-bold" className="text-xl text-white animate-bounce" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground">{localize("มีคิวอัปเดตใหม่", "Queue updated")}</p>
                            <p className="mt-0.5 text-xs text-default-500">{localize("มีการเปลี่ยนแปลงข้อมูลคิวในชั้นเรียนนี้", "Queue data changed in this classroom")}</p>
                        </div>
                        <Button
                            size="sm"
                            color="primary"
                            className={instructorPrimaryButtonClass("shrink-0")}
                            onPress={() => { setPendingQueueUpdate(false); fetchSessions(true); }}
                        >
                            {localize("โหลดใหม่", "Reload")}
                        </Button>
                    </div>
                </div>
            </div>,
            document.body
        )}
        </>
    );
}
