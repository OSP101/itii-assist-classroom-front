/**
 * useAttendanceTab Hook
 * Contains all state management and business logic for AttendanceTab
 */

"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { addToast } from "@heroui/toast";
import { now, getLocalTimeZone, parseAbsolute, type DateValue } from "@internationalized/date";
import attendanceService, { type AttendanceSession, type CreateAttendanceData, type TimeChangePreview, type SectionChangePreview } from "@/services/attendance.service";
import { useSocket } from "@/contexts/SocketContext";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import {
    type Course,
    type AttendanceStats,
    type SessionWithComputedStatus,
    type ModalTargets,
    type ModalStates,
    type FilterState,
    computeSessionStatus,
    filterSessions,
    calculateStats,
    getInitialFormData,
    AUTO_UPDATE_INTERVAL_MS,
} from "./config";

// ============================================================================
// Hook Return Type
// ============================================================================

export interface UseAttendanceTabReturn {
    // Data
    sessions: AttendanceSession[];
    sessionsWithComputedStatus: SessionWithComputedStatus[];
    filteredSessions: SessionWithComputedStatus[];
    stats: AttendanceStats;
    allSectionIds: number[];

    // Loading States
    isSessionsLoading: boolean;
    isSubmitting: boolean;
    isGettingLocation: boolean;

    // Filter State
    filters: FilterState;
    setSearchQuery: (query: string) => void;
    setStatusFilter: (filter: string) => void;
    setTypeFilter: (filter: string) => void;

    // Modal States
    modals: ModalStates;
    targets: ModalTargets;
    openCreateModal: () => void;
    closeCreateModal: () => void;
    openEditModal: (session: AttendanceSession) => void;
    closeEditModal: () => void;
    openDeleteModal: (session: AttendanceSession) => void;
    closeDeleteModal: () => void;
    openCloseSessionModal: (session: AttendanceSession) => void;
    closeCloseSessionModal: () => void;

    // Form State
    formData: CreateAttendanceData;
    setFormData: React.Dispatch<React.SetStateAction<CreateAttendanceData>>;
    startDateTime: DateValue;
    setStartDateTime: (value: DateValue) => void;
    endDateTime: DateValue;
    setEndDateTime: (value: DateValue) => void;
    lateThresholdTime: DateValue;
    setLateThresholdTime: (value: DateValue) => void;
    lateThresholdMinutes: number;
    resetForm: () => void;

    // Actions
    handleCreateSession: () => Promise<void>;
    handleUpdateSession: () => Promise<void>;
    handleDeleteSession: () => Promise<void>;
    handleActivateSession: (session: AttendanceSession) => Promise<void>;
    confirmCloseSession: () => Promise<void>;
    getCurrentLocation: () => void;

    // Time Change Preview
    timeChangePreview: TimeChangePreview | null;
    isTimeChangePreviewOpen: boolean;
    isApplyingTimeChange: boolean;
    closeTimeChangePreview: () => void;
    confirmApplyTimeChange: () => Promise<void>;

    // Section Change Preview
    sectionChangePreview: SectionChangePreview | null;
    isSectionChangePreviewOpen: boolean;
    closeSectionChangePreview: () => void;
    confirmSectionChange: () => Promise<void>;

    // Pending update notification (for other users' changes)
    pendingAttendanceUpdate: boolean;
    ackAttendanceUpdate: () => Promise<void>;

    // Context
    courseId: string;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAttendanceTab(
    course: Course,
    onAttendanceChanged?: () => void
): UseAttendanceTabReturn {
    const router = useRouter();
    const { emitDataUpdate, onDataUpdate, subscribeToUpdates, unsubscribeFromUpdates } = useSocket();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    // ========================================================================
    // Memoized Values
    // ========================================================================

    const allSectionIds = useMemo(
        () => (course.sections || []).map((s) => s.id),
        [course.sections]
    );

    // ========================================================================
    // Core State
    // ========================================================================

    const [sessions, setSessions] = useState<AttendanceSession[]>([]);
    const [isSessionsLoading, setIsSessionsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGettingLocation, setIsGettingLocation] = useState(false);

    // For triggering status updates (without causing full component re-renders)
    const [statusTick, setStatusTick] = useState(0);

    // Pending update flag (other user changed data → show notification)
    const [pendingAttendanceUpdate, setPendingAttendanceUpdate] = useState(false);

    // ========================================================================
    // Filter State
    // ========================================================================

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");

    const filters = useMemo<FilterState>(
        () => ({
            searchQuery,
            statusFilter,
            typeFilter,
        }),
        [searchQuery, statusFilter, typeFilter]
    );

    // ========================================================================
    // Modal State
    // ========================================================================

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

    // Time Change Preview State
    const [timeChangePreview, setTimeChangePreview] = useState<TimeChangePreview | null>(null);
    const [isTimeChangePreviewOpen, setIsTimeChangePreviewOpen] = useState(false);
    const [isApplyingTimeChange, setIsApplyingTimeChange] = useState(false);
    const pendingUpdateDataRef = useRef<Partial<CreateAttendanceData> | null>(null);

    // Section Change Preview State
    const [sectionChangePreview, setSectionChangePreview] = useState<SectionChangePreview | null>(null);
    const [isSectionChangePreviewOpen, setIsSectionChangePreviewOpen] = useState(false);

    const [editTarget, setEditTarget] = useState<AttendanceSession | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AttendanceSession | null>(null);
    const [closeTarget, setCloseTarget] = useState<AttendanceSession | null>(null);

    const modals = useMemo<ModalStates>(
        () => ({
            isCreateModalOpen,
            isEditModalOpen,
            isDeleteModalOpen,
            isCloseModalOpen,
        }),
        [isCreateModalOpen, isEditModalOpen, isDeleteModalOpen, isCloseModalOpen]
    );

    const targets = useMemo<ModalTargets>(
        () => ({
            editTarget,
            deleteTarget,
            closeTarget,
        }),
        [editTarget, deleteTarget, closeTarget]
    );

    // ========================================================================
    // Form State
    // ========================================================================

    const [formData, setFormData] = useState<CreateAttendanceData>(() =>
        getInitialFormData(course.id, allSectionIds)
    );

    const [startDateTime, setStartDateTime] = useState<DateValue>(now(getLocalTimeZone()));
    const [endDateTime, setEndDateTime] = useState<DateValue>(
        now(getLocalTimeZone()).add({ hours: 2 })
    );
    const [lateThresholdTime, setLateThresholdTime] = useState<DateValue>(
        now(getLocalTimeZone()).add({ minutes: 15 })
    );

    // Reset form when allSectionIds changes (initial load)
    const initializedRef = useRef(false);
    useEffect(() => {
        if (!initializedRef.current && allSectionIds.length > 0) {
            setFormData((prev) => ({
                ...prev,
                course_section_ids: allSectionIds,
            }));
            initializedRef.current = true;
        }
    }, [allSectionIds]);

    // ========================================================================
    // Computed Values (Memoized)
    // ========================================================================

    const sessionsWithComputedStatus = useMemo<SessionWithComputedStatus[]>(
        () =>
            sessions.map((session) => ({
                ...session,
                status: computeSessionStatus(session),
            })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sessions, statusTick] // statusTick causes re-computation every 30 seconds
    );

    const filteredSessions = useMemo(
        () => filterSessions(sessionsWithComputedStatus, searchQuery, statusFilter, typeFilter),
        [sessionsWithComputedStatus, searchQuery, statusFilter, typeFilter]
    );

    const stats = useMemo(
        () => calculateStats(sessionsWithComputedStatus),
        [sessionsWithComputedStatus]
    );

    // Calculate late threshold in minutes from startDateTime and lateThresholdTime
    const lateThresholdMinutes = useMemo(() => {
        const startDate = startDateTime.toDate(getLocalTimeZone());
        const lateDate = lateThresholdTime.toDate(getLocalTimeZone());
        const diffMs = lateDate.getTime() - startDate.getTime();
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        return Math.max(0, diffMinutes);
    }, [startDateTime, lateThresholdTime]);

    // ========================================================================
    // Data Fetching
    // ========================================================================

    const fetchSessions = useCallback(async (showLoading = true) => {
        if (showLoading) {
            setIsSessionsLoading(true);
        }
        try {
            const data = await attendanceService.getSessions(course.id);
            setSessions(data);
        } catch (error) {
            console.error("Error fetching attendance sessions:", error);
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: isEnglish ? "Unable to load attendance data." : "ไม่สามารถโหลดข้อมูลการเช็คชื่อได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            if (showLoading) {
                setIsSessionsLoading(false);
            }
        }
    }, [course.id, isEnglish]);

    // Initial fetch
    useEffect(() => {
        if (course.id) {
            fetchSessions(true);
        }
    }, [course.id, fetchSessions]);

    // Auto-update status every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setStatusTick((prev) => prev + 1);
        }, AUTO_UPDATE_INTERVAL_MS);

        return () => clearInterval(interval);
    }, []);

    // Subscribe to real-time socket events from OTHER users
    useEffect(() => {
        subscribeToUpdates();
        const unsubscribe = onDataUpdate((data) => {
            if (data.resource !== "attendance") return;
            // Filter events to this classroom only
            if (data.data?.courseId && String(data.data.courseId) !== String(course.id)) return;
            // Self-filter: skip if current user triggered the event
            try {
                const rawUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                if (rawUser) {
                    const myId = String(JSON.parse(rawUser)?.id ?? '');
                    const actorId = String((data as any).actor_id ?? (data as any).data?.actor_id ?? '');
                    if (myId && actorId && myId === actorId) return;
                }
            } catch { /* ignore */ }
            setPendingAttendanceUpdate(true);
        });
        return () => {
            unsubscribe();
            unsubscribeFromUpdates();
        };
    }, [onDataUpdate, subscribeToUpdates, unsubscribeFromUpdates, course.id]);

    // ========================================================================
    // Form Helpers
    // ========================================================================

    const resetForm = useCallback(() => {
        setFormData(getInitialFormData(course.id, allSectionIds));
        const currentTime = now(getLocalTimeZone());
        setStartDateTime(currentTime);
        setEndDateTime(currentTime.add({ hours: 2 }));
        setLateThresholdTime(currentTime.add({ minutes: 15 }));
        setEditTarget(null);
    }, [course.id, allSectionIds]);

    // ========================================================================
    // Modal Handlers
    // ========================================================================

    const openCreateModal = useCallback(() => {
        setIsCreateModalOpen(true);
    }, []);

    const closeCreateModal = useCallback(() => {
        setIsCreateModalOpen(false);
        resetForm();
    }, [resetForm]);

    const openEditModal = useCallback((session: AttendanceSession) => {
        setEditTarget(session);
        const sectionIds = session.course_section_ids?.length
            ? session.course_section_ids
            : session.sections?.map((s) => s.id) ||
                (session.course_section_id ? [session.course_section_id] : []);
        
        setFormData({
            course_id: course.id,
            course_section_id: session.course_section_id,
            course_section_ids: sectionIds,
            title: session.title,
            auto_rotate_pin: session.auto_rotate_pin,
            session_type: session.session_type,
            check_location: session.check_location,
            location_lat: session.location_lat ?? undefined,
            location_lng: session.location_lng ?? undefined,
            radius_meters: session.radius_meters,
            start_time: session.start_time,
            end_time: session.end_time,
            late_threshold_minutes: session.late_threshold_minutes,
            late_threshold_time: session.late_threshold_time,
        });
        const startDt = parseAbsolute(session.start_time, getLocalTimeZone());
        setStartDateTime(startDt);
        setEndDateTime(parseAbsolute(session.end_time, getLocalTimeZone()));
        
        // Set late threshold time - use late_threshold_time if available, otherwise calculate from minutes
        if (session.late_threshold_time) {
            // Parse time string (e.g., "08:15:00") and apply to start date
            const [hours, minutes] = session.late_threshold_time.split(':').map(Number);
            const startDate = new Date(session.start_time);
            startDate.setHours(hours, minutes, 0, 0);
            setLateThresholdTime(parseAbsolute(startDate.toISOString(), getLocalTimeZone()));
        } else {
            // Calculate from late_threshold_minutes
            setLateThresholdTime(startDt.add({ minutes: session.late_threshold_minutes }));
        }
        setIsEditModalOpen(true);
    }, [course.id]);

    const closeEditModal = useCallback(() => {
        setIsEditModalOpen(false);
        resetForm();
    }, [resetForm]);

    const openDeleteModal = useCallback((session: AttendanceSession) => {
        setDeleteTarget(session);
        setIsDeleteModalOpen(true);
    }, []);

    const closeDeleteModal = useCallback(() => {
        setIsDeleteModalOpen(false);
        setDeleteTarget(null);
    }, []);

    const openCloseSessionModal = useCallback((session: AttendanceSession) => {
        setCloseTarget(session);
        setIsCloseModalOpen(true);
    }, []);

    const closeCloseSessionModal = useCallback(() => {
        setIsCloseModalOpen(false);
        setCloseTarget(null);
    }, []);

    // ========================================================================
    // CRUD Handlers
    // ========================================================================

    const handleCreateSession = useCallback(async () => {
        if (!formData.title.trim()) {
            addToast({
                title: isEnglish ? "Please complete the form" : "กรุณากรอกข้อมูล",
                description: isEnglish ? "Please enter an attendance session title." : "กรุณากรอกชื่อรอบการเช็คชื่อ",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (!formData.course_section_ids || formData.course_section_ids.length === 0) {
            addToast({
                title: isEnglish ? "Select sections" : "กรุณาเลือกกลุ่มเรียน",
                description: isEnglish ? "Please select at least one section." : "ต้องเลือกกลุ่มเรียนอย่างน้อย 1 กลุ่ม",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        // Validate time ordering
        const _startDate = startDateTime.toDate(getLocalTimeZone());
        const _endDate   = endDateTime.toDate(getLocalTimeZone());
        const _lateDate  = lateThresholdTime.toDate(getLocalTimeZone());
        if (_endDate <= _startDate) {
            addToast({
                title: isEnglish ? "Invalid time range" : "เวลาไม่ถูกต้อง",
                description: isEnglish ? "End time must be later than start time." : "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น",
                color: "danger",
                timeout: 4000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        if (_lateDate < _startDate || _lateDate > _endDate) {
            addToast({
                title: isEnglish ? "Invalid late cutoff" : "เวลาตัดสายไม่ถูกต้อง",
                description: isEnglish ? "Late cutoff time must be between the start and end time." : "เวลาตัดสายต้องอยู่ระหว่างเวลาเริ่มต้นและสิ้นสุด",
                color: "danger",
                timeout: 4000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const startDate = startDateTime.toDate(getLocalTimeZone());
            const endDate = endDateTime.toDate(getLocalTimeZone());
            const lateDate = lateThresholdTime.toDate(getLocalTimeZone());

            // Format late_threshold_time as HH:MM:SS
            const lateTimeStr = `${String(lateDate.getHours()).padStart(2, '0')}:${String(lateDate.getMinutes()).padStart(2, '0')}:00`;

            const data: CreateAttendanceData = {
                course_id: course.id,
                course_section_id: formData.course_section_id,
                course_section_ids: formData.course_section_ids,
                title: formData.title,
                auto_rotate_pin: Boolean(formData.auto_rotate_pin),
                session_type: formData.session_type,
                check_location: formData.check_location,
                location_lat: formData.location_lat,
                location_lng: formData.location_lng,
                radius_meters: formData.radius_meters,
                start_time: startDate.toISOString(),
                end_time: endDate.toISOString(),
                late_threshold_minutes: lateThresholdMinutes,
                late_threshold_time: lateTimeStr,
            };

            const result = await attendanceService.createSession(data);
            if (result) {
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish ? "Attendance session created successfully." : "สร้างรอบการเช็คชื่อเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                closeCreateModal();
                fetchSessions(false);
                emitDataUpdate("attendance", "create", result.id, { courseId: course.id });
                onAttendanceChanged?.();
            }
        } catch (error: unknown) {
            console.error("Error creating session:", error);
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: error instanceof Error ? error.message : (isEnglish ? "Unable to create the attendance session." : "ไม่สามารถสร้างรอบการเช็คชื่อได้"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [formData, startDateTime, endDateTime, lateThresholdTime, lateThresholdMinutes, course.id, closeCreateModal, fetchSessions, emitDataUpdate, onAttendanceChanged, isEnglish]);

    const handleUpdateSession = useCallback(async () => {
        if (!editTarget) return;

        if (!formData.title.trim()) {
            addToast({
                title: isEnglish ? "Please complete the form" : "กรุณากรอกข้อมูล",
                description: isEnglish ? "Please enter an attendance session title." : "กรุณากรอกชื่อรอบการเช็คชื่อ",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (!formData.course_section_ids || formData.course_section_ids.length === 0) {
            addToast({
                title: isEnglish ? "Select sections" : "กรุณาเลือกกลุ่มเรียน",
                description: isEnglish ? "Please select at least one section." : "ต้องเลือกกลุ่มเรียนอย่างน้อย 1 กลุ่ม",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        // Validate time ordering
        const _startDate = startDateTime.toDate(getLocalTimeZone());
        const _endDate   = endDateTime.toDate(getLocalTimeZone());
        const _lateDate  = lateThresholdTime.toDate(getLocalTimeZone());
        if (_endDate <= _startDate) {
            addToast({
                title: isEnglish ? "Invalid time range" : "เวลาไม่ถูกต้อง",
                description: isEnglish ? "End time must be later than start time." : "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น",
                color: "danger",
                timeout: 4000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        if (_lateDate < _startDate || _lateDate > _endDate) {
            addToast({
                title: isEnglish ? "Invalid late cutoff" : "เวลาตัดสายไม่ถูกต้อง",
                description: isEnglish ? "Late cutoff time must be between the start and end time." : "เวลาตัดสายต้องอยู่ระหว่างเวลาเริ่มต้นและสิ้นสุด",
                color: "danger",
                timeout: 4000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const startDate = startDateTime.toDate(getLocalTimeZone());
            const endDate = endDateTime.toDate(getLocalTimeZone());
            const lateDate = lateThresholdTime.toDate(getLocalTimeZone());

            // Format late_threshold_time as HH:MM:SS
            const lateTimeStr = `${String(lateDate.getHours()).padStart(2, '0')}:${String(lateDate.getMinutes()).padStart(2, '0')}:00`;

            const data: Partial<CreateAttendanceData> = {
                title: formData.title,
                auto_rotate_pin: Boolean(formData.auto_rotate_pin),
                session_type: formData.session_type,
                check_location: formData.check_location,
                location_lat: formData.check_location ? formData.location_lat : undefined,
                location_lng: formData.check_location ? formData.location_lng : undefined,
                radius_meters: formData.radius_meters,
                start_time: startDate.toISOString(),
                end_time: endDate.toISOString(),
                late_threshold_minutes: lateThresholdMinutes,
                late_threshold_time: lateTimeStr,
            };

            if (formData.course_section_ids && formData.course_section_ids.length > 0) {
                data.course_section_ids = formData.course_section_ids;
                data.course_section_id = formData.course_section_ids.length === 1
                    ? formData.course_section_ids[0]
                    : null;
            } else {
                data.course_section_ids = [];
                data.course_section_id = null;
            }

            // ── Check if any sections were removed ──
            const oldSectionIds = (editTarget.sections || []).map(s => s.id);
            const newSectionIds = data.course_section_ids || [];
            const removedSections = oldSectionIds.filter(sid => !newSectionIds.includes(sid));

            if (removedSections.length > 0) {
                // Preview which students will be affected
                const preview = await attendanceService.previewSectionChange(editTarget.id, {
                    course_section_ids: newSectionIds,
                });

                if (preview && preview.has_checked_in_students) {
                    // Store pending data and show section change warning
                    pendingUpdateDataRef.current = data;
                    setSectionChangePreview(preview);
                    setIsSectionChangePreviewOpen(true);
                    setIsSubmitting(false);
                    return; // Don't apply yet — wait for confirmation
                }
            }

            // Check if any time fields changed
            const oldStart = new Date(editTarget.start_time).getTime();
            const oldEnd = new Date(editTarget.end_time).getTime();
            const newStart = startDate.getTime();
            const newEnd = endDate.getTime();

            // Compare late threshold
            let oldLateMs: number;
            if (editTarget.late_threshold_time) {
                const sessionDate = new Date(editTarget.start_time);
                const [h, m, s = 0] = editTarget.late_threshold_time.split(':').map(Number);
                const lt = new Date(sessionDate);
                lt.setHours(h, m, s, 0);
                oldLateMs = lt.getTime();
            } else {
                const lt = new Date(editTarget.start_time);
                lt.setMinutes(lt.getMinutes() + (editTarget.late_threshold_minutes || 15));
                oldLateMs = lt.getTime();
            }
            const newLateMs = lateDate.getTime();

            const timeChanged = oldStart !== newStart || oldEnd !== newEnd || oldLateMs !== newLateMs;

            // If time fields changed AND session has potential check-ins → preview first
            // checked_in = present + late + leave (anyone who actually checked in)
            const checkedInCount = editTarget.stats
                ? (editTarget.stats.checked_in ?? ((editTarget.stats.present || 0) + (editTarget.stats.late || 0) + (editTarget.stats.leave || 0)))
                : 0;
            if (timeChanged && checkedInCount > 0) {
                // Call preview API
                const preview = await attendanceService.previewTimeChange(editTarget.id, {
                    start_time: data.start_time!,
                    end_time: data.end_time!,
                    late_threshold_time: data.late_threshold_time,
                    late_threshold_minutes: data.late_threshold_minutes,
                });

                if (preview) {
                    // Store pending data and show preview modal
                    pendingUpdateDataRef.current = data;
                    setTimeChangePreview(preview);
                    setIsTimeChangePreviewOpen(true);
                    setIsSubmitting(false);
                    return; // Don't apply yet — wait for confirmation
                }
            }

            // No time changes or no check-ins → direct update (original behavior)
            const result = await attendanceService.updateSession(editTarget.id, data);
            if (result) {
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish ? "Attendance session updated successfully." : "แก้ไขรอบการเช็คชื่อเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                closeEditModal();
                fetchSessions(false);
                emitDataUpdate("attendance", "update", editTarget.id, { courseId: course.id });
            }
        } catch (error: unknown) {
            console.error("Error updating session:", error);
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: error instanceof Error ? error.message : (isEnglish ? "Unable to update the attendance session." : "ไม่สามารถแก้ไขรอบการเช็คชื่อได้"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [editTarget, formData, startDateTime, endDateTime, lateThresholdTime, lateThresholdMinutes, course.id, closeEditModal, fetchSessions, emitDataUpdate, isEnglish]);

    /**
     * Confirm and apply the time change after preview.
     * Called when user clicks confirm in TimeChangePreviewModal.
     */
    const confirmApplyTimeChange = useCallback(async () => {
        if (!editTarget || !pendingUpdateDataRef.current) return;

        setIsApplyingTimeChange(true);
        try {
            const result = await attendanceService.applyTimeChange(editTarget.id, pendingUpdateDataRef.current);
            if (result) {
                const { impact } = result;
                const parts: string[] = [];
                if (impact.invalidated > 0) parts.push(isEnglish ? `${impact.invalidated} invalidated` : `${impact.invalidated} ยกเลิก`);
                if (impact.present_to_late > 0) parts.push(isEnglish ? `${impact.present_to_late} changed to late` : `${impact.present_to_late} เปลี่ยนเป็นสาย`);
                if (impact.late_to_present > 0) parts.push(isEnglish ? `${impact.late_to_present} changed to on time` : `${impact.late_to_present} เปลี่ยนเป็นตรงเวลา`);
                if (impact.recovered > 0) parts.push(isEnglish ? `${impact.recovered} restored` : `${impact.recovered} กลับมาถูกต้อง`);

                addToast({
                    title: isEnglish ? "Saved" : "บันทึกเรียบร้อย",
                    description: parts.length > 0
                        ? (isEnglish ? `Updated the time and attendance statuses: ${parts.join(", ")}` : `แก้ไขเวลาและปรับปรุงสถานะ: ${parts.join(', ')}`)
                        : (isEnglish ? "Attendance session updated successfully." : "แก้ไขรอบการเช็คชื่อเรียบร้อยแล้ว"),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });

                setIsTimeChangePreviewOpen(false);
                setTimeChangePreview(null);
                pendingUpdateDataRef.current = null;
                closeEditModal();
                fetchSessions(false);
                emitDataUpdate("attendance", "update", editTarget.id, { courseId: course.id });
            }
        } catch (error: unknown) {
            console.error("Error applying time change:", error);
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: error instanceof Error ? error.message : (isEnglish ? "Unable to save the time changes." : "ไม่สามารถบันทึกการเปลี่ยนแปลงได้"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsApplyingTimeChange(false);
        }
    }, [editTarget, course.id, closeEditModal, fetchSessions, emitDataUpdate, isEnglish]);

    const closeTimeChangePreview = useCallback(() => {
        setIsTimeChangePreviewOpen(false);
        setTimeChangePreview(null);
        pendingUpdateDataRef.current = null;
    }, []);

    // Section Change Preview handlers
    const closeSectionChangePreview = useCallback(() => {
        setIsSectionChangePreviewOpen(false);
        setSectionChangePreview(null);
        pendingUpdateDataRef.current = null;
    }, []);

    const confirmSectionChange = useCallback(async () => {
        if (!editTarget || !pendingUpdateDataRef.current) return;

        setIsSubmitting(true);
        try {
            const result = await attendanceService.updateSession(editTarget.id, pendingUpdateDataRef.current);
            if (result) {
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish ? "Attendance session updated successfully." : "แก้ไขรอบการเช็คชื่อเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                closeSectionChangePreview();
                closeEditModal();
                fetchSessions(false);
                emitDataUpdate("attendance", "update", editTarget.id, { courseId: course.id });
            }
        } catch (error: unknown) {
            console.error("Error updating session after section change confirmation:", error);
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: error instanceof Error ? error.message : (isEnglish ? "Unable to update the attendance session." : "ไม่สามารถแก้ไขรอบการเช็คชื่อได้"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [editTarget, course.id, closeEditModal, fetchSessions, emitDataUpdate, closeSectionChangePreview, isEnglish]);

    const handleDeleteSession = useCallback(async () => {
        if (!deleteTarget) return;

        setIsSubmitting(true);
        try {
            const success = await attendanceService.deleteSession(deleteTarget.id);
            if (success) {
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish ? "Attendance session deleted successfully." : "ลบรอบการเช็คชื่อเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                closeDeleteModal();
                fetchSessions(false);
                emitDataUpdate("attendance", "delete", deleteTarget.id, { courseId: course.id });
                onAttendanceChanged?.();
            }
        } catch (error: unknown) {
            console.error("Error deleting session:", error);
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: error instanceof Error ? error.message : (isEnglish ? "Unable to delete the attendance session." : "ไม่สามารถลบรอบการเช็คชื่อได้"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [deleteTarget, closeDeleteModal, fetchSessions, emitDataUpdate, onAttendanceChanged, isEnglish]);

    const handleActivateSession = useCallback(async (session: AttendanceSession) => {
        const computedStatus = computeSessionStatus(session);
        if (computedStatus === "draft") {
            try {
                const activatedSession = await attendanceService.activateSession(session.id);
                if (activatedSession) {
                    setSessions((prev) =>
                        prev.map((item) =>
                            item.id === session.id
                                ? {
                                      ...item,
                                      ...activatedSession,
                                      sections: item.sections,
                                      section: item.section,
                                      course: item.course,
                                      creator: item.creator,
                                      stats: item.stats,
                                  }
                                : item
                        )
                    );
                }
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish ? "Attendance session is now open." : "เริ่มเปิดรอบเช็คชื่อแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                fetchSessions(false);
                emitDataUpdate("attendance", "update", session.id, { courseId: course.id });
            } catch (error: unknown) {
                console.error("Error activating session:", error);
                addToast({
                    title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                    description: error instanceof Error ? error.message : (isEnglish ? "Unable to open the attendance session." : "ไม่สามารถเปิดรอบเช็คชื่อได้"),
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                return;
            }
        }
        window.open(`/attendance/${course.id}/session/${session.id}/live`, "_blank");
    }, [course.id, fetchSessions, emitDataUpdate, isEnglish]);

    const confirmCloseSession = useCallback(async () => {
        if (!closeTarget) return;

        setIsSubmitting(true);
        try {
            const result = await attendanceService.closeSession(closeTarget.id);
            if (result) {
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish ? "Attendance session closed successfully." : "ปิดรอบการเช็คชื่อเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                closeCloseSessionModal();
                fetchSessions(false);
                emitDataUpdate("attendance", "update", closeTarget.id, { courseId: course.id });
            }
        } catch (error: unknown) {
            console.error("Error closing session:", error);
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: error instanceof Error ? error.message : (isEnglish ? "Unable to close the attendance session." : "ไม่สามารถปิดรอบการเช็คชื่อได้"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [closeTarget, course.id, closeCloseSessionModal, fetchSessions, emitDataUpdate, isEnglish]);

    // Acknowledge pending attendance update (dismiss notification + silent refresh)
    const ackAttendanceUpdate = useCallback(async () => {
        setPendingAttendanceUpdate(false);
        await fetchSessions(false);
    }, [fetchSessions]);

    // ========================================================================
    // GPS Handler
    // ========================================================================

    const getCurrentLocation = useCallback(() => {
        if (!navigator.geolocation) {
            addToast({
                title: isEnglish ? "Not supported" : "ไม่รองรับ",
                description: isEnglish ? "Your browser does not support location access." : "เบราว์เซอร์ของคุณไม่รองรับการดึงตำแหน่งที่ตั้ง",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsGettingLocation(true);
        addToast({
            title: isEnglish ? "Getting GPS location..." : "กำลังดึงตำแหน่ง GPS...",
            description: isEnglish ? "Please wait while the system determines the GPS location." : "กรุณารอสักครู่ ระบบกำลังระบุตำแหน่งจาก GPS",
            color: "primary",
            timeout: 3000,
                shouldShowTimeoutProgress: true,
        });

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFormData((prev) => ({
                    ...prev,
                    location_lat: position.coords.latitude,
                    location_lng: position.coords.longitude,
                }));
                setIsGettingLocation(false);
            },
            (error) => {
                console.error("Geolocation error:", error);
                let errorMessage = isEnglish ? "Unable to get the current location." : "ไม่สามารถดึงตำแหน่งได้";

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = isEnglish
                            ? "Location permission was denied. Please enable GPS access in your browser settings."
                            : "คุณไม่อนุญาตให้เข้าถึงตำแหน่ง GPS กรุณาเปิดสิทธิ์ในการตั้งค่าเบราว์เซอร์";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = isEnglish
                            ? "Unable to determine the location. Please make sure GPS is enabled."
                            : "ไม่สามารถระบุตำแหน่งได้ กรุณาตรวจสอบว่าเปิด GPS แล้ว";
                        break;
                    case error.TIMEOUT:
                        errorMessage = isEnglish
                            ? "Timed out while waiting for GPS. Please try again."
                            : "หมดเวลารอการรับตำแหน่ง GPS กรุณาลองใหม่อีกครั้ง";
                        break;
                }

                addToast({
                    title: isEnglish ? "Unable to get GPS location" : "ไม่สามารถดึงตำแหน่ง GPS ได้",
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsGettingLocation(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            }
        );
    }, [isEnglish]);

    // ========================================================================
    // Return Hook Values
    // ========================================================================

    return {
        // Data
        sessions,
        sessionsWithComputedStatus,
        filteredSessions,
        stats,
        allSectionIds,

        // Loading States
        isSessionsLoading,
        isSubmitting,
        isGettingLocation,

        // Filter State
        filters,
        setSearchQuery,
        setStatusFilter,
        setTypeFilter,

        // Modal States
        modals,
        targets,
        openCreateModal,
        closeCreateModal,
        openEditModal,
        closeEditModal,
        openDeleteModal,
        closeDeleteModal,
        openCloseSessionModal,
        closeCloseSessionModal,

        // Form State
        formData,
        setFormData,
        startDateTime,
        setStartDateTime,
        endDateTime,
        setEndDateTime,
        lateThresholdTime,
        setLateThresholdTime,
        lateThresholdMinutes,
        resetForm,

        // Actions
        handleCreateSession,
        handleUpdateSession,
        handleDeleteSession,
        handleActivateSession,
        confirmCloseSession,
        getCurrentLocation,

        // Time Change Preview
        timeChangePreview,
        isTimeChangePreviewOpen,
        isApplyingTimeChange,
        closeTimeChangePreview,
        confirmApplyTimeChange,

        // Section Change Preview
        sectionChangePreview,
        isSectionChangePreviewOpen,
        closeSectionChangePreview,
        confirmSectionChange,

        // Pending update notification
        pendingAttendanceUpdate,
        ackAttendanceUpdate,

        // Context
        courseId: course.id,
    };
}

export default useAttendanceTab;
