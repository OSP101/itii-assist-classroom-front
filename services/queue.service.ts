/**
 * Queue Service - API calls for queue booking system
 */

import api from './api.service';

// ============================================
// Types & Interfaces
// ============================================

export interface QueueSession {
    id: number;
    course_id: string;
    classroom_id: string;
    title: string;
    description?: string;
    pin_code: string;
    linked_assignment_id?: number | null;
    require_attendance: boolean;
    linked_attendance_session_id?: number | null;
    is_cutoff_enabled?: boolean;
    cutoff_at?: string | null;
    cutoff_note?: string;
    status: 'draft' | 'active' | 'paused' | 'closed';
    start_time?: string;
    end_time?: string;
    created_by: number;
    created_at: string;
    updated_at: string;
    concurrent_group_id?: string | null;
    group_pin_code?: string | null;
    concurrent_partner?: {
        id: string;
        title: string;
        course_id: string;
        course_name: string;
        status: string;
        group_pin_code?: string | null;
    } | null;
    // Populated fields
    classroom?: {
        id: number;
        name: string;
        building: string;
        floor?: string;
    };
    linkedAssignment?: {
        id: number;
        name: string;
        max_score: number;
        assignment_type?: 'individual' | 'permanent_group' | 'weekly_group';
        subItems?: {
            id: number;
            name: string;
            max_score: number;
            order_index?: number;
        }[];
    };
    linkedAttendanceSession?: {
        id: number;
        title: string;
    };
    creator?: {
        id: number;
        full_name: string;
    };
    workers?: QueueWorker[];
    stats?: {
        total: number;
        waiting: number;
        in_progress: number;
        completed: number;
    };
}

export interface QueueWorker {
    id: number;
    queue_session_id: number;
    user_id: number;
    accept_grading: boolean;
    accept_help: boolean;
    status: 'online' | 'busy' | 'offline' | 'paused';
    current_booking_id?: number | null;
    offer_paused_until?: string | null;
    consecutive_offer_timeouts?: number;
    total_grading_completed: number;
    total_help_completed: number;
    last_active_at: string;
    user?: {
        id: number;
        full_name: string;
        avatar?: string;
        role: string;
    };
}

export interface QueueBooking {
    id: number;
    queue_session_id: number;
    student_id: number;
    desk_id: number;
    // int on the server (models.QueueBooking.DeskNumber); coerce with String()
    // before handing it to anything that expects text
    desk_number: number;
    booking_type: 'grading' | 'help';
    queue_number: number;
    is_late_booking?: boolean;
    late_reason?: string;
    status: 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
    note?: string;
    assigned_worker_id?: number | null;
    assigned_at?: string | null;
    offer_expires_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    score?: number | null;
    score_comment?: string | null;
    worker_note?: string | null;
    position_in_queue?: number;
    // Populated fields
    queueSession?: QueueSession;
    student?: {
        id: number;
        student_id: string;
        full_name: string;
    };
    desk?: {
        id: number;
        number: string;
        type: string;
    };
    zone?: {
        id: string;
        name: string;
        color?: string;
    } | null;
    assignedWorker?: {
        id: number;
        full_name: string;
    };
    // Populated in shared-room concurrent-group mode so the worker UI can
    // badge a booking that came from a partner course and label the score
    // modal with the assignment's true origin.
    origin_course?: {
        id: string;
        code: string;
        name: string;
    };
    origin_session_title?: string;
    origin_concurrent_group_id?: string | null;
    origin_assignment?: {
        id: number;
        name: string;
        max_score: number;
        sub_items?: {
            id: number;
            name: string;
            max_score: number;
            order_index?: number;
        }[];
    };
}

export type QueueBookingType = QueueBooking["booking_type"];
export type QueueBookingStatus = QueueBooking["status"];

export function getQueueBookingTypeLabel(type: QueueBookingType, isEnglish: boolean): string {
    if (type === 'grading') return isEnglish ? 'Grading' : 'ตรวจงาน';
    if (type === 'help') return isEnglish ? 'Help' : 'ช่วยเหลือ';
    return type;
}

export function getQueueBookingStatusLabel(status: QueueBookingStatus, isEnglish: boolean): string {
    switch (status) {
        case 'waiting':
            return isEnglish ? 'Waiting' : 'รอคิว';
        case 'in_progress':
            return isEnglish ? 'In Progress' : 'กำลังตรวจ';
        case 'completed':
            return isEnglish ? 'Completed' : 'เสร็จสิ้น';
        case 'cancelled':
            return isEnglish ? 'Cancelled' : 'ยกเลิก';
        case 'no_show':
            return isEnglish ? 'Skipped' : 'ถูกข้าม';
        default:
            return status;
    }
}

export interface QueueDeskStatus {
    id: number;
    queue_session_id: number;
    desk_id: number;
    grading_status: 'not_started' | 'waiting' | 'in_progress' | 'completed';
    help_status: 'none' | 'waiting' | 'in_progress';
    grading_booking_id?: number | null;
    help_booking_id?: number | null;
    desk?: {
        id: number;
        number: string;
        type: string;
        label?: string;
        position_x?: number;
        position_y?: number;
    };
}

export interface DeskWithStatus {
    id: number;
    number: string;
    type: string;
    label?: string;
    x?: number;
    y?: number;
    is_enabled: boolean;
    status: {
        grading_status: 'not_started' | 'waiting' | 'in_progress' | 'completed';
        help_status: 'none' | 'waiting' | 'in_progress';
    };
    booking?: {
        id: number;
        queue_number: number;
        booking_type: 'grading' | 'help';
        status: 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
        student_name?: string;
        student_code?: string;
        assigned_worker?: {
            id: number;
            full_name: string;
            avatar?: string;
        };
    };
}

export interface CreateQueueSessionData {
    title: string;
    description?: string;
    classroom_id: string;
    linked_assignment_id?: number | null;
    require_attendance?: boolean;
    linked_attendance_session_id?: number | null;
    is_cutoff_enabled?: boolean;
    cutoff_at?: string | null;
    cutoff_note?: string;
}

export interface UpdateQueueSessionData {
    title?: string;
    description?: string;
    classroom_id?: string;
    linked_assignment_id?: number | null;
    require_attendance?: boolean;
    linked_attendance_session_id?: number | null;
    is_cutoff_enabled?: boolean;
    cutoff_at?: string | null;
    cutoff_note?: string;
}

export interface CreateBookingData {
    pin_code: string;
    student_id: string;
    desk_number: string;
    booking_type: 'grading' | 'help';
    note?: string;
}

export interface SubItemScore {
    sub_item_id: number;
    score: number;
}

export interface CompleteBookingData {
    score?: number;
    sub_item_scores?: SubItemScore[];
    score_comment?: string;
    worker_note?: string;
}

export interface WorkerBookingActionResult {
    booking: QueueBooking;
    next_booking: QueueBooking | null;
}

export interface WorkerBookingActionData {
    action: 'start' | 'complete' | 'no_show' | 'reject';
    score?: number;
    worker_note?: string;
    reject_reason?: string;
}

export interface QueueReportWorkerStat {
    user_id: number;
    full_name?: string;
    total_completed: number;
    grading_completed: number;
    help_completed: number;
    percent: number;
    opened_count?: number;
    closed_count?: number;
    first_opened_at?: string | null;
    last_opened_at?: string | null;
    last_closed_at?: string | null;
    total_active_duration?: string;
    offer_accept_count?: number;
    offer_reject_count?: number;
    offer_timeout_count?: number;
    offer_total_count?: number;
    offer_accept_rate?: number;
    offer_paused_until?: string | null;
    status?: 'online' | 'busy' | 'offline' | 'paused';
    accept_grading?: boolean;
    accept_help?: boolean;
    current_booking_id?: number | null;
    consecutive_offer_timeouts?: number;
    last_active_at?: string | null;
    total_active_seconds?: number;
}

export interface QueueReportBooking {
    id: number;
    created_at: string;
    assigned_at?: string | null;
    offer_expires_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    queue_number: number;
    desk_number: number;
    booking_type: 'grading' | 'help';
    status: 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
    queue_wait_seconds?: number;
    offer_response_seconds?: number;
    service_duration_seconds?: number;
    timeout_count?: number;
    reject_count?: number;
    worker_note?: string;
    booking_ip?: string;
    booking_user_agent?: string;
    booking_device?: string;
    student?: {
        id: number;
        student_id: string;
        full_name: string;
    };
    assigned_worker?: {
        id: number;
        full_name: string;
    } | null;
}

export interface QueueRejectReasonStat {
    code: string;
    label_th: string;
    label_en: string;
    count: number;
}

export interface QueueSessionReport {
    generated_at?: string;
    course?: {
        id: string;
        code: string;
        name: string;
    };
    session?: {
        id: string;
        title: string;
    };
    worker_stats: QueueReportWorkerStat[];
    bookings: QueueReportBooking[];
    reject_reason_stats?: QueueRejectReasonStat[];
}

export interface ProjectorViewData {
    session: {
        id: number;
        title: string;
        pin_code: string;
        status: string;
    };
    classroom: {
        id: number;
        name: string;
        building: string;
    };
    desks: DeskWithStatus[];
    queueStats: {
        grading_waiting: number;
        help_waiting: number;
    };
}

/**
 * Aggregated projector view for a shared-room concurrent group.
 * Returned by GET /api/queue/groups/:groupId/desk-statuses.
 * Each entry in `sessions` mirrors the single-session ProjectorViewData shape
 * (session summary, desks-with-status, queueStats) plus a `course` block that
 * the projector uses to prefix queue numbers with a course code.
 */
export interface GroupProjectorViewData {
    group_id: string;
    group_pin_code: string;
    classroom: {
        id: string;
        name: string;
        building: string;
    };
    sessions: {
        session: ProjectorViewData['session'] & {
            course_id: string;
            is_cutoff_enabled?: boolean;
            cutoff_at?: string | null;
            cutoff_note?: string;
            concurrent_group_id?: string | null;
            group_pin_code?: string | null;
        };
        course: {
            id: string;
            code: string;
            name: string;
        };
        desks: DeskWithStatus[];
        queueStats: {
            grading_waiting: number;
            help_waiting: number;
        };
    }[];
}

export interface VerifyPINResponse {
    session_id: number;
    title: string;
    course: {
        id: string;
        code: string;
        name: string;
    };
    classroom: {
        id: number;
        name: string;
        building: string;
    };
    require_attendance: boolean;
}

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: {
        message: string;
    };
}

// ============================================
// Classroom Conflict Error
// ============================================

export interface ClassroomConflictInfo {
    session_id: string;
    session_title: string;
    course_id: string;
    course_name: string;
    started_at?: string;
}

export class ClassroomConflictError extends Error {
    conflict: ClassroomConflictInfo;
    constructor(message: string, conflict: ClassroomConflictInfo) {
        super(message);
        this.name = 'ClassroomConflictError';
        this.conflict = conflict;
    }
}

export interface ConcurrentSessionInfo {
    id: string;
    title: string;
    course_id: string;
    course_name: string;
    status: string;
    pin_code?: string;
    concurrent_group_id?: string | null;
    group_pin_code?: string | null;
}

export interface ConcurrentGroupData {
    is_grouped: boolean;
    sessions: {
        id: string;
        title: string;
        course_id: string;
        course_name: string;
        status: string;
    }[];
}

// ============================================
// Queue Service
// ============================================

const queueService = {
    /**
     * Mint a short-lived ticket for joining this worker's own realtime room.
     * That room streams every task the moment it's assigned - student name,
     * student id, course, assignment name - so the WebSocket hub will not
     * admit a client without one. See GetWorkerSocketTicketHandler on the
     * backend; the ticket is always minted for the caller's own id, never
     * anyone else's.
     */
    async getWorkerSocketTicket(): Promise<string | null> {
        const response = await api.get<{ ticket: string; expires_at: string }>('/queue/worker/socket-ticket');
        return response.data?.ticket || null;
    },

    // ============================================
    // Session Management (Instructor/TA)
    // ============================================

    /**
     * Get all queue sessions for a course
     */
    async getQueueSessions(courseId: string, status?: string): Promise<QueueSession[]> {
        const params = status ? `?status=${status}` : '';
        const response = await api.get<QueueSession[]>(
            `/courses/${courseId}/queue/sessions${params}`
        );
        return response.data || [];
    },

    /**
     * Get single queue session details
     */
    async getQueueSession(courseId: string, sessionId: string): Promise<QueueSession> {
        const response = await api.get<QueueSession>(
            `/courses/${courseId}/queue/sessions/${sessionId}`
        );
        if (!response.data) throw new Error('ไม่พบข้อมูล Queue Session');
        return response.data;
    },

    /**
     * Create new queue session
     */
    async createQueueSession(courseId: string, data: CreateQueueSessionData): Promise<QueueSession> {
        const response = await api.post<QueueSession>(
            `/courses/${courseId}/queue/sessions`,
            data
        );
        if (!response.data) throw new Error('สร้าง Queue Session ไม่สำเร็จ');
        return response.data;
    },

    /**
     * Update queue session
     */
    async updateQueueSession(
        courseId: string,
        sessionId: number,
        data: UpdateQueueSessionData
    ): Promise<QueueSession> {
        const response = await api.put<QueueSession>(
            `/courses/${courseId}/queue/sessions/${sessionId}`,
            data
        );
        if (!response.data) throw new Error('อัพเดท Queue Session ไม่สำเร็จ');
        return response.data;
    },

    /**
     * Update queue session status
     */
    async updateQueueSessionStatus(
        courseId: string,
        sessionId: number,
        status: 'active' | 'paused' | 'closed'
    ): Promise<QueueSession> {
        const response = await api.post<QueueSession>(
            `/courses/${courseId}/queue/sessions/${sessionId}/status`,
            { status }
        );
        if (!response.success) {
            const raw = response as unknown as { classroom_conflict?: ClassroomConflictInfo; message?: string };
            if (raw.classroom_conflict) {
                throw new ClassroomConflictError(
                    raw.message || 'ห้องเรียนนี้กำลังถูกใช้งานอยู่',
                    raw.classroom_conflict
                );
            }
            const errMsg = (response.error as unknown as { message?: string })?.message || response.message;
            throw new Error(errMsg || 'เปลี่ยนสถานะไม่สำเร็จ');
        }
        if (!response.data) throw new Error('เปลี่ยนสถานะไม่สำเร็จ');
        return response.data;
    },

    /**
     * Delete queue session (draft only)
     */
    async deleteQueueSession(courseId: string, sessionId: number): Promise<void> {
        await api.delete(`/courses/${courseId}/queue/sessions/${sessionId}`);
    },

    /**
     * Regenerate PIN code
     */
    async regeneratePIN(courseId: string, sessionId: number): Promise<string> {
        const response = await api.post<{ pin_code: string }>(
            `/courses/${courseId}/queue/sessions/${sessionId}/regenerate-pin`
        );
        if (!response.data) throw new Error('สร้าง PIN ใหม่ไม่สำเร็จ');
        return response.data.pin_code;
    },

    async heartbeatProjectorSession(courseId: string, sessionId: string): Promise<void> {
        const response = await api.post<QueueSession>(
            `/courses/${courseId}/queue/sessions/${sessionId}/heartbeat`
        );
        if (!response.success) {
            throw new Error((response.error as unknown as { message?: string })?.message || response.message || 'Failed to record projector heartbeat');
        }
    },

    async heartbeatProjectorSessionPublic(sessionId: string): Promise<void> {
        const response = await api.post<QueueSession>(
            `/queue/sessions/${sessionId}/heartbeat`
        );
        if (!response.success) {
            throw new Error((response.error as unknown as { message?: string })?.message || response.message || 'Failed to record projector heartbeat');
        }
    },

    // ============================================
    // Concurrent Group (Multi-Course Queue)
    // ============================================

    async getConcurrentGroup(courseId: string, sessionId: string): Promise<ConcurrentGroupData> {
        const response = await api.get<ConcurrentGroupData>(
            `/courses/${courseId}/queue/sessions/${sessionId}/group`
        );
        return response.data || { is_grouped: false, sessions: [] };
    },

    async linkConcurrentSessions(courseId: string, sessionId: string, partnerSessionId: string): Promise<void> {
        const response = await api.post(
            `/courses/${courseId}/queue/sessions/${sessionId}/group/link`,
            { partner_session_id: partnerSessionId }
        );
        if (!response.success) {
            throw new Error((response as { message?: string }).message || 'เชื่อมคิวไม่สำเร็จ');
        }
    },

    async unlinkConcurrentSessions(courseId: string, sessionId: string): Promise<void> {
        const response = await api.delete(
            `/courses/${courseId}/queue/sessions/${sessionId}/group/unlink`
        );
        if (!response.success) {
            throw new Error((response as { message?: string }).message || 'ถอดการเชื่อมคิวไม่สำเร็จ');
        }
    },

    async getConcurrentSessionsPublic(sessionId: string): Promise<ConcurrentSessionInfo[]> {
        const response = await api.get<ConcurrentSessionInfo[]>(
            `/queue/sessions/${sessionId}/concurrent-sessions`
        );
        return response.data || [];
    },

    async getGroupDeskStatusesPublic(groupId: string): Promise<GroupProjectorViewData> {
        const response = await api.get<GroupProjectorViewData>(
            `/queue/groups/${groupId}/desk-statuses`
        );
        if (!response.data) {
            throw new Error('ไม่พบข้อมูลคิวร่วม');
        }
        return response.data;
    },

    async getClassroomActiveSessions(classroomId: string): Promise<ConcurrentSessionInfo[]> {
        const response = await api.get<ConcurrentSessionInfo[]>(
            `/queue/classroom/${classroomId}/active-sessions`
        );
        return response.data || [];
    },

    // ============================================
    // Worker Management
    // ============================================

    /**
     * Join as worker
     */
    async joinAsWorker(
        courseId: string,
        sessionId: string,
        preferences: { accept_grading?: boolean; accept_help?: boolean }
    ): Promise<{ worker: QueueWorker; assignedBooking: QueueBooking | null }> {
        const response = await api.post<QueueWorker | { worker: QueueWorker; assignedBooking?: QueueBooking | null }>(
            `/courses/${courseId}/queue/sessions/${sessionId}/workers/join`,
            preferences
        );
        if (!response.data) throw new Error('เข้าร่วมรับงานไม่สำเร็จ');

        const fullResponse = response as { data?: QueueWorker | { worker: QueueWorker; assignedBooking?: QueueBooking | null }; assignedBooking?: QueueBooking | null };
        const payload = response.data;
        if ((payload as { worker?: QueueWorker }).worker) {
            const dataPayload = payload as { worker: QueueWorker; assignedBooking?: QueueBooking | null };
            return {
                worker: dataPayload.worker,
                assignedBooking: dataPayload.assignedBooking || fullResponse.assignedBooking || null,
            };
        }

        return {
            worker: payload as QueueWorker,
            assignedBooking: fullResponse.assignedBooking || null,
        };
    },

    /**
     * Leave as worker
     */
    async leaveAsWorker(
        courseId: string,
        sessionId: string
    ): Promise<{ status: "paused" | "offline"; releasedOffers: number }> {
        const response = await api.post<{ status?: string; released_offers?: number }>(
            `/courses/${courseId}/queue/sessions/${sessionId}/workers/leave`
        );
        // The server decides the outcome: only a task the TA already started keeps
        // them "paused". An offer they never accepted is released to another TA,
        // and the worker goes offline right away.
        const status = response.data?.status === "paused" ? "paused" : "offline";
        return { status, releasedOffers: response.data?.released_offers ?? 0 };
    },

    /**
     * Get all workers for a session
     */
    async getWorkers(courseId: string, sessionId: string): Promise<QueueWorker[]> {
        const response = await api.get<QueueWorker[]>(
            `/courses/${courseId}/queue/sessions/${sessionId}/workers`
        );
        return response.data || [];
    },

    /**
     * Get worker's current booking (for reconnection)
     */
    async getWorkerCurrentBooking(
        courseId: string,
        sessionId: string
    ): Promise<{ worker: QueueWorker | null; currentBooking: QueueBooking | null }> {
        const response = await api.get<{ worker: QueueWorker | null; currentBooking: QueueBooking | null }>(
            `/courses/${courseId}/queue/sessions/${sessionId}/workers/current-booking`
        );
        return response.data || { worker: null, currentBooking: null };
    },

    /**
     * Worker booking action (accept/start/reject/complete/no-show)
     */
    async workerBookingAction(
        courseId: string,
        sessionId: string,
        bookingId: number,
        data: WorkerBookingActionData
    ): Promise<WorkerBookingActionResult> {
        const response = await api.put<WorkerBookingActionResult>(
            `/courses/${courseId}/queue/sessions/${sessionId}/bookings/${bookingId}/action`,
            data
        );
        if (!response.data) throw new Error('อัปเดตสถานะงานไม่สำเร็จ');
        return response.data;
    },

    // ============================================
    // Booking Management
    // ============================================

    /**
     * Create new booking (Student - no auth required)
     */
    async createBooking(data: CreateBookingData): Promise<QueueBooking> {
        const response = await api.post<QueueBooking>(
            '/queue/bookings',
            data
        );
        if (!response.data) throw new Error('จองคิวไม่สำเร็จ');
        return response.data;
    },

    /**
     * Get booking status (Student - no auth required)
     */
    async getBookingStatus(bookingId: number): Promise<QueueBooking> {
        const response = await api.get<QueueBooking>(
            `/queue/bookings/${bookingId}/status`
        );
        if (!response.data) throw new Error('ไม่พบข้อมูลการจอง');
        return response.data;
    },

    /**
     * Get all bookings for a session (Instructor/TA)
     */
    async getSessionBookings(
        courseId: string,
        sessionId: string,
        filters?: { status?: string; booking_type?: string }
    ): Promise<QueueBooking[]> {
        let params = '';
        if (filters) {
            const queryParams = new URLSearchParams();
            if (filters.status) queryParams.append('status', filters.status);
            if (filters.booking_type) queryParams.append('booking_type', filters.booking_type);
            params = `?${queryParams.toString()}`;
        }
        const response = await api.get<QueueBooking[]>(
            `/courses/${courseId}/queue/sessions/${sessionId}/bookings${params}`
        );
        return response.data || [];
    },

    /**
     * Complete booking (Worker)
     */
    async completeBooking(
        courseId: string,
        sessionId: string,
        bookingId: number,
        data: CompleteBookingData
    ): Promise<WorkerBookingActionResult> {
        const response = await api.post<WorkerBookingActionResult>(
            `/courses/${courseId}/queue/sessions/${sessionId}/bookings/${bookingId}/complete`,
            data
        );
        if (!response.data) throw new Error('บันทึกผลไม่สำเร็จ');
        return response.data;
    },

    /**
     * Existing sub-item scores of the booking's student on the booking's own
     * linked assignment (Worker). Works for mirrored cross-course TAs who
     * cannot call GET /scores on the partner course.
     */
    async getBookingExistingScores(
        courseId: string,
        sessionId: string,
        bookingId: number
    ): Promise<{
        sub_item_scores: {
            sub_item_id: number;
            score: number | null;
            graded_by?: { id: number; display_name: string } | null;
            graded_at?: string | null;
        }[];
    }> {
        const response = await api.get<{
            sub_item_scores: {
                sub_item_id: number;
                score: number | null;
                graded_by?: { id: number; display_name: string } | null;
                graded_at?: string | null;
            }[];
        }>(`/courses/${courseId}/queue/sessions/${sessionId}/bookings/${bookingId}/scores`);
        return response.data ?? { sub_item_scores: [] };
    },

    /**
     * Skip booking (Worker)
     */
    async skipBooking(
        courseId: string,
        sessionId: string,
        bookingId: number,
        reason?: string
    ): Promise<WorkerBookingActionResult> {
        const response = await api.post<WorkerBookingActionResult>(
            `/courses/${courseId}/queue/sessions/${sessionId}/bookings/${bookingId}/skip`,
            { reason }
        );
        if (!response.data) throw new Error('ข้ามคิวไม่สำเร็จ');
        return response.data;
    },

    // ============================================
    // Projector View
    // ============================================

    /**
     * Get desk statuses for projector view
     */
    async getDeskStatuses(courseId: string, sessionId: string): Promise<ProjectorViewData> {
        const response = await api.get<ProjectorViewData>(
            `/courses/${courseId}/queue/sessions/${sessionId}/desk-statuses`
        );
        if (!response.data) throw new Error('ไม่สามารถโหลดข้อมูลผังห้องได้');
        return response.data;
    },

    // ============================================
    // Public APIs (No Auth)
    // ============================================

    /**
     * Verify PIN code (Student)
     */
    async verifyPIN(pinCode: string): Promise<VerifyPINResponse> {
        const response = await api.post<VerifyPINResponse>(
            '/queue/verify-pin',
            { pin_code: pinCode }
        );
        if (!response.data) throw new Error('PIN ไม่ถูกต้อง');
        return response.data;
    },

    /**
     * Get session report (Instructor/TA)
     */
    async getSessionReport(courseId: string, sessionId: string): Promise<QueueSessionReport> {
        const response = await api.get<QueueSessionReport>(
            `/courses/${courseId}/queue/sessions/${sessionId}/report`
        );
        if (!response.data) throw new Error('ไม่พบข้อมูลรีพอร์ต');
        return response.data;
    },

    /**
     * Force close a queue session (Admin)
     */
    async closeQueueSession(courseId: string, sessionId: string): Promise<QueueSession> {
        const response = await api.post<QueueSession>(
            `/courses/${courseId}/queue/sessions/${sessionId}/close`
        );
        if (!response.success) {
            throw new Error((response.error as unknown as { message?: string })?.message || 'Failed to close session');
        }
        if (!response.data) throw new Error('Failed to close session');
        return response.data;
    },

    /**
     * Get all active queue sessions across all courses (Admin only)
     */
    async getActiveQueueSessionsAdmin() {
        type ActiveSession = {
            id: string; title: string; status: string; pin_code: string;
            course_id: string; course_name: string; course_code: string;
            classroom_id: string; classroom_name: string; classroom_building: string;
            start_time: string | null; created_at: string;
        };
        const response = await api.get<ActiveSession[]>(
            `/admin/queue/sessions/active`
        );
        if (!response.success) return [] as ActiveSession[];
        return (response.data || []) as ActiveSession[];
    },
};

export default queueService;
