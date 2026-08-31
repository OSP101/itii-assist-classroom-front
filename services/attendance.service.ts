/**
 * Attendance Service - API calls for attendance system
 */

import api from './api.service';
import { DEVICE_HINTS_HEADER, buildDeviceHintsHeader, type ClientDeviceSignals } from '@/lib/device-signals';

interface AttendanceErrorPayload {
    success?: boolean;
    code?: string;
    title?: string;
    message?: string;
    error?: string | { message?: string };
}

export class AttendanceRequestError extends Error {
    code?: string;
    title?: string;

    constructor(payload: AttendanceErrorPayload, fallbackMessage: string) {
        super(
            payload.message ||
            (typeof payload.error === "string" ? payload.error : payload.error?.message) ||
            fallbackMessage
        );
        this.name = "AttendanceRequestError";
        this.code = payload.code;
        this.title = payload.title;
    }
}

function throwAttendanceRequestError(payload: AttendanceErrorPayload, fallbackMessage: string): never {
    throw new AttendanceRequestError(payload, fallbackMessage);
}

/**
 * Every request the campus network guard evaluates must carry these hints, or an
 * iPad is rejected as a desktop — see buildDeviceHintsHeader. That means the
 * session-info GET (whose verdict the check-in page renders before the student
 * can act) as well as the check-in POSTs the guard middleware runs on.
 */
function deviceHintsOptions(): { headers: Record<string, string> } {
    return { headers: { [DEVICE_HINTS_HEADER]: buildDeviceHintsHeader() } };
}

export interface AttendanceSession {
    id: number;
    course_id: string;
    course_section_id: number | null; // Legacy single section
    course_section_ids?: number[]; // New: array of section IDs
    title: string;
    auto_rotate_pin: boolean;
    pin_mode?: 'static' | 'rotating';
    /**
     * Only the privileged endpoints (instructor live view, paired classroom
     * display) return the code. The public check-in info route withholds it —
     * a student is meant to read the PIN off the projector — so this is an
     * empty string there and `pin_issued` is the flag to use instead.
     */
    pin_code: string;
    pin_issued?: boolean;
    pin_issued_at?: string | null;
    pin_rotates_at?: string | null;
    started_at?: string | null;
    expires_at?: string | null;
    closed_at?: string | null;
    session_type: 'lecture' | 'lab' | 'online';
    check_location: boolean;
    location_lat: number | null;
    location_lng: number | null;
    radius_meters: number;
    start_time: string;
    end_time: string;
    late_threshold_minutes: number;
    late_threshold_time?: string | null; // New: absolute time for late threshold (e.g. "08:15:00")
    status: 'draft' | 'active' | 'closed';
    created_by: number;
    created_at: string;
    updated_at: string;
    section?: {
        id: number;
        section_no: number;
    };
    sections?: Array<{
        id: number;
        section_no: number;
    }>; // New: array of sections for multi-select
    course?: {
        id: string;
        code: string;
        name: string;
        year: number;
        semester: number;
    };
    creator?: {
        id: number;
        full_name: string;
    };
    stats?: {
        total_students: number;
        present: number;
        late: number;
        leave: number;
        absent: number;
        checked_in: number;
        not_checked_in: number;
    };
    network_guard?: {
        allowed: boolean;
        exempt: boolean;
        failed_checks: Array<'device' | 'network' | 'domain'>;
        device_type: string;
    };
}

export interface AttendanceRecord {
    id: number;
    attendance_session_id: number;
    student_id: number;
    section_no?: string | null;
    check_in_time: string | null;
    status: 'present' | 'late' | 'leave' | 'absent';
    google_email: string | null;
    google_id: string | null;
    pin_verified: boolean;
    location_verified: boolean;
    location_lat: number | null;
    location_lng: number | null;
    distance_meters: number | null;
    note: string | null;
    updated_by: number | null;
    updated_at: string;
    created_at: string;
    student?: {
        id: number;
        student_id: string;
        full_name: string;
        email: string;
    };
    updater?: {
        id: number;
        full_name: string;
    } | null;
}

export interface CreateAttendanceData {
    course_id: string;
    course_section_id?: number | null; // Legacy single section
    course_section_ids?: number[]; // New: array of section IDs for multi-select
    title: string;
    auto_rotate_pin: boolean;
    session_type: 'lecture' | 'lab' | 'online';
    check_location: boolean;
    location_lat?: number;
    location_lng?: number;
    radius_meters?: number;
    start_time: string;
    end_time: string;
    late_threshold_minutes?: number;
    late_threshold_time?: string | null; // New: absolute time for late threshold (e.g. "08:15:00")
}

export interface StudentCheckInData {
    pin_code: string;
    google_email?: string;
    google_id?: string;
    google_token?: string;
    client_request_id?: string;
    student_id?: number;
    location_lat?: number;
    location_lng?: number;
    /** Best-effort physical-device hint for the audit log — never gates check-in. See lib/device-signals.ts. */
    client_signals?: ClientDeviceSignals;
}

/** One anti-spoofing flag raised during a session. A hint for review, not proof. */
export interface AttendanceSecurityFlag {
    id: number;
    at: string;
    /** "device_flip" = blocked for device then passed; "client_signal_mismatch" = UA disagrees with what the browser reports. */
    kind: "device_flip" | "client_signal_mismatch";
    severity: string;
    student_id?: number;
    student_code?: string;
    student_name?: string;
    ip_address?: string;
    device_type?: string;
    browser?: string;
    os?: string;
    reasons?: string[];
    /** "same_student" or "ip_only" for a device flip. */
    confidence?: string;
}

export interface AttendanceSecurityFlagsResult {
    session_id: number;
    flags: AttendanceSecurityFlag[];
    /** true when more flags exist than the endpoint returned. */
    truncated: boolean;
}

export interface AttendanceSessionStartResult {
    session_id: number;
    current_pin: string;
    expires_at?: string | null;
    next_rotation_at?: string | null;
    mode: 'static' | 'rotating';
    status: 'active' | 'closed' | 'draft';
}

// ============================================
// Time Change Preview Types
// ============================================

export interface TimeChangeRecord {
    record_id: number;
    student_id: string | null;
    student_name: string | null;
    check_in_time: string;
    old_status: 'present' | 'late' | 'invalid';
    new_status: 'present' | 'late' | 'invalid';
    change_type: 'will_be_invalidated' | 'present_to_late' | 'late_to_present' | 'already_invalid' | 'recovered' | 'unchanged';
}

export interface TimeChangeSummary {
    total_checked_in: number;
    will_be_invalidated: number;
    present_to_late: number;
    late_to_present: number;
    unchanged: number;
    already_invalid: number;
    recovered: number;
}

export interface TimeChangeField {
    old: string;
    new: string;
    changed: boolean;
}

export interface TimeChangePreview {
    session_id: number;
    session_title: string;
    summary: TimeChangeSummary;
    changes: TimeChangeRecord[];
    timeChanges: {
        start_time: TimeChangeField;
        end_time: TimeChangeField;
        late_threshold: TimeChangeField;
    };
    hasDestructiveChanges: boolean;
    hasAnyImpact: boolean;
}

export interface TimeChangeImpact {
    total_records: number;
    invalidated: number;
    present_to_late: number;
    late_to_present: number;
    recovered: number;
    unchanged: number;
    details: Array<{
        record_id: number;
        student_id: string;
        student_name: string;
        check_in_time: string;
        old_status: string;
        new_status: string;
    }>;
}

// ============================================
// Section Change Preview Types
// ============================================

export interface SectionChangeAffectedStudent {
    record_id: number;
    student_id: string | null;
    student_name: string | null;
    status: string;
    check_in_time: string | null;
    section_no: string;
}

export interface SectionChangePreview {
    session_id: number;
    session_title: string;
    removed_sections: Array<{ id: number; section_no: string }>;
    affected_students: SectionChangeAffectedStudent[];
    total_affected: number;
    has_checked_in_students: boolean;
}

export interface AttendanceCourseSessionRow {
    id: number;
    title: string;
    date: string;
    stats: {
        present: number;
        late: number;
        leave: number;
        absent: number;
        checked_in: number;
        total: number;
    };
    attendance_rate: number;
}

export interface AttendanceCourseStudentRow {
    student_id: number;
    student_no: string;
    full_name: string;
    present: number;
    late: number;
    leave: number;
    absent: number;
    total_marks: number;
    attendance_rate: number;
}

export interface AttendanceCourseSummary {
    course_id: string;
    total_sessions: number;
    total_students: number;
    overall: {
        present: number;
        late: number;
        leave: number;
        absent: number;
        checked_in: number;
        total: number;
    };
    overall_attendance_rate: number;
    by_session: AttendanceCourseSessionRow[];
    by_student: AttendanceCourseStudentRow[];
}

const attendanceService = {
    /**
     * Get course-wide attendance report (all sessions aggregated)
     */
    async getCourseSummary(courseId: string): Promise<AttendanceCourseSummary | null> {
        const response = await api.get<AttendanceCourseSummary>(`/attendance/course-summary?course_id=${courseId}`);
        return response.data || null;
    },

    /**
     * Get all attendance sessions for a course
     */
    async getSessions(courseId: string, status?: string): Promise<AttendanceSession[]> {
        let url = `/attendance?course_id=${courseId}`;
        if (status) {
            url += `&status=${status}`;
        }
        const response = await api.get<AttendanceSession[]>(url);
        return response.data || [];
    },

    /**
     * Get single attendance session with details
     */
    async getSession(sessionId: number): Promise<AttendanceSession | null> {
        const response = await api.get<AttendanceSession>(`/attendance/${sessionId}`);
        return response.data || null;
    },

    /**
     * Mint a short-lived ticket for joining this session's instructor realtime
     * room. That room streams the live PIN and every check-in record, so the
     * WebSocket hub will not admit a client without one — see
     * GetAttendanceSessionSocketTicketHandler on the backend.
     */
    async getSocketTicket(sessionId: number): Promise<string | null> {
        const response = await api.get<{ ticket: string; expires_at: string }>(`/attendance/sessions/${sessionId}/socket-ticket`);
        return response.data?.ticket || null;
    },

    /**
     * Create new attendance session
     */
    async createSession(data: CreateAttendanceData): Promise<AttendanceSession | null> {
        const response = await api.post<AttendanceSession>('/attendance', data);
        return response.data || null;
    },

    /**
     * Update attendance session
     */
    async updateSession(sessionId: number, data: Partial<CreateAttendanceData>): Promise<AttendanceSession | null> {
        const response = await api.put<AttendanceSession>(`/attendance/${sessionId}`, data);
        return response.data || null;
    },

    /**
     * Delete attendance session
     */
    async deleteSession(sessionId: number): Promise<boolean> {
        const response = await api.delete(`/attendance/${sessionId}`);
        return response.success;
    },

    /**
     * Activate attendance session (open for check-in)
     */
    async activateSession(sessionId: number): Promise<AttendanceSession | null> {
        const response = await api.post<AttendanceSession>(`/attendance/${sessionId}/activate`);
        return response.data || null;
    },

    async startSession(attendanceSessionId: number, idempotencyKey?: string): Promise<AttendanceSessionStartResult | null> {
        const response = await api.post<AttendanceSessionStartResult>('/attendance/sessions/start', {
            attendance_session_id: attendanceSessionId,
            idempotency_key: idempotencyKey,
        });
        return response.data || null;
    },

    async getSessionPin(sessionId: number): Promise<{
        session_id: number;
        status: string;
        mode: 'static' | 'rotating';
        current_pin: string;
        previous_pin?: string | null;
        expires_at?: string | null;
        pin_issued_at?: string | null;
        next_rotation_at?: string | null;
        next_pin_ready?: boolean;
    } | null> {
        const response = await api.get<{
            session_id: number;
            status: string;
            mode: 'static' | 'rotating';
            current_pin: string;
            previous_pin?: string | null;
            expires_at?: string | null;
            pin_issued_at?: string | null;
            next_rotation_at?: string | null;
            next_pin_ready?: boolean;
        }>(`/attendance/sessions/${sessionId}/pin`);
        return response.data || null;
    },

    async rotateSessionPin(sessionId: number): Promise<{
        session_id: number;
        current_pin: string;
        previous_pin?: string | null;
        pin_issued_at?: string | null;
        next_rotation_at?: string | null;
    } | null> {
        const response = await api.post<{
            session_id: number;
            current_pin: string;
            previous_pin?: string | null;
            pin_issued_at?: string | null;
            next_rotation_at?: string | null;
        }>(`/attendance/sessions/${sessionId}/rotate`);
        return response.data || null;
    },

    /**
     * Close attendance session
     */
    async closeSession(sessionId: number): Promise<AttendanceSession | null> {
        const response = await api.post<AttendanceSession>(`/attendance/${sessionId}/close`);
        return response.data || null;
    },

    /**
     * Get attendance records for a session
     */
    async getRecords(sessionId: number, status?: string): Promise<AttendanceRecord[]> {
        let url = `/attendance/${sessionId}/records`;
        if (status) {
            url += `?status=${status}`;
        }
        const response = await api.get<AttendanceRecord[]>(url);
        return response.data || [];
    },

    /**
     * Anti-spoofing flags raised during a session, for the instructor or TA
     * running the class. Every entry is a hint, never proof: see
     * lib/device-signals.ts for what these signals can and cannot detect.
     */
    async getSecurityFlags(sessionId: number): Promise<AttendanceSecurityFlagsResult> {
        const response = await api.get<AttendanceSecurityFlagsResult>(
            `/attendance/${sessionId}/security-flags`
        );
        return response.data || { session_id: sessionId, flags: [], truncated: false };
    },

    /**
     * Update attendance record (manual status change)
     */
    async updateRecord(
        sessionId: number,
        recordId: number,
        data: { status: string; note?: string }
    ): Promise<AttendanceRecord | null> {
        const response = await api.put<AttendanceRecord>(
            `/attendance/${sessionId}/records/${recordId}`,
            data
        );
        return response.data || null;
    },

    /**
     * Get session info for student check-in (public)
     */
    async getSessionInfo(sessionId: number): Promise<AttendanceSession | null> {
        const response = await api.get<AttendanceSession>(`/attendance/check-in/${sessionId}/info`, deviceHintsOptions()) as
            AttendanceErrorPayload & { data?: AttendanceSession; network_guard?: AttendanceSession['network_guard'] };
        if (!response.success) {
            throwAttendanceRequestError(response, 'ไม่พบรอบการเช็กชื่อ');
        }
        if (!response.data) {
            return null;
        }
        return { ...response.data, network_guard: response.network_guard };
    },

    /**
     * Student check-in (public)
     */
    async studentCheckIn(sessionId: number, data: StudentCheckInData): Promise<{
        status: string;
        student: { id: number; student_id: string; full_name: string };
        check_in_time: string;
        location_verified: boolean;
        distance_meters: number | null;
        is_duplicate?: boolean;
    } | null> {
        const response = await api.post<{
            status: string;
            student: { id: number; student_id: string; full_name: string };
            check_in_time: string;
            location_verified: boolean;
            distance_meters: number | null;
            is_duplicate?: boolean;
        }>(`/attendance/check-in/${sessionId}`, data, deviceHintsOptions());
        
        if (!response.success) {
            throwAttendanceRequestError(response as AttendanceErrorPayload, 'เช็กชื่อไม่สำเร็จ');
        }
        
        return response.data || null;
    },

    async studentCheckInByPin(data: StudentCheckInData): Promise<{
        status: string;
        check_in_time: string;
        location_verified: boolean;
        distance_meters: number | null;
    } | null> {
        const response = await api.post<{
            status: string;
            check_in_time: string;
            location_verified: boolean;
            distance_meters: number | null;
        }>('/attendance/check-in', data, deviceHintsOptions());
        if (!response.success) {
            throwAttendanceRequestError(response as AttendanceErrorPayload, 'Attendance check-in failed');
        }
        return response.data || null;
    },

    async verifyPin(pinCode: string): Promise<{
        session_id: number;
        title: string;
        status: 'draft' | 'active' | 'closed';
        session_type: 'lecture' | 'lab' | 'online';
        check_location: boolean;
        auto_rotate_pin: boolean;
        pin_mode?: 'static' | 'rotating';
        course?: {
            id: string;
            code: string;
            name: string;
            year: number;
            semester: number;
        };
        section?: {
            id: number;
            section_no: number;
        };
    } | null> {
        const response = await api.post<{
            session_id: number;
            title: string;
            status: 'draft' | 'active' | 'closed';
            session_type: 'lecture' | 'lab' | 'online';
            check_location: boolean;
            auto_rotate_pin: boolean;
            pin_mode?: 'static' | 'rotating';
            course?: {
                id: string;
                code: string;
                name: string;
                year: number;
                semester: number;
            };
            section?: {
                id: number;
                section_no: number;
            };
        }>('/attendance/verify-pin', {
            pin_code: pinCode,
        });

        if (!response.success) {
            throw new Error(response.message || 'PIN ไม่ถูกต้อง หรือไม่มีการเปิดเช็กชื่อ');
        }

        return response.data || null;
    },

    /**
     * Verify student by Google email (public)
     */
    async verifyStudent(googleEmail: string, sessionId?: number): Promise<{
        student: { id: number; student_id: string; full_name: string; email: string };
        already_checked_in: boolean;
        status?: string;
        check_in_time?: string;
    } | null> {
        const response = await api.post<{
            student: { id: number; student_id: string; full_name: string; email: string };
            already_checked_in: boolean;
            status?: string;
            check_in_time?: string;
        }>('/attendance/verify-student', {
            google_email: googleEmail,
            session_id: sessionId,
        });
        
        if (!response.success) {
            throwAttendanceRequestError(response as AttendanceErrorPayload, 'ไม่พบข้อมูลนักศึกษา');
        }
        
        return response.data || null;
    },

    async verifyStudentIdentity(sessionId: number, googleToken: string, googleEmail?: string): Promise<{
        student: { id: number; student_id: string; full_name: string; email: string };
        already_checked_in: boolean;
        status?: string;
        check_in_time?: string;
    } | null> {
        const response = await api.post<{
            student: { id: number; student_id: string; full_name: string; email: string };
            already_checked_in: boolean;
            status?: string;
            check_in_time?: string;
        }>("/attendance/verify-student", {
            session_id: sessionId,
            google_token: googleToken,
            google_email: googleEmail,
        });

        if (!response.success) {
            throwAttendanceRequestError(response as AttendanceErrorPayload, "ไม่พบข้อมูลนักศึกษา");
        }

        return response.data || null;
    },

    async verifyCurrentStudentSession(sessionId: number): Promise<{
        student: { id: number; student_id: string; full_name: string; email: string };
        already_checked_in: boolean;
        status?: string;
        check_in_time?: string;
    } | null> {
        const response = await api.post<{
            student: { id: number; student_id: string; full_name: string; email: string };
            already_checked_in: boolean;
            status?: string;
            check_in_time?: string;
        }>("/attendance/verify-student", {
            session_id: sessionId,
        });

        if (!response.success) {
            throwAttendanceRequestError(response as AttendanceErrorPayload, "ไม่พบข้อมูลนักศึกษา");
        }

        return response.data || null;
    },

    // ============================================
    // Time Change Preview & Apply
    // ============================================

    /**
     * Preview impact of changing attendance session times.
     * Does NOT modify any data — safe to call repeatedly.
     */
    async previewTimeChange(
        sessionId: number,
        data: { start_time: string; end_time: string; late_threshold_time?: string | null; late_threshold_minutes?: number }
    ): Promise<TimeChangePreview | null> {
        const response = await api.post<TimeChangePreview>(
            `/attendance/${sessionId}/preview-time-change`,
            data
        );
        return response.data || null;
    },

    // ============================================
    // Section Change Preview
    // ============================================

    /**
     * Preview impact of removing sections from an attendance session.
     * Shows which checked-in students will lose their records.
     * Does NOT modify any data — safe to call repeatedly.
     */
    async previewSectionChange(
        sessionId: number,
        data: { course_section_ids: number[] }
    ): Promise<SectionChangePreview | null> {
        const response = await api.post<SectionChangePreview>(
            `/attendance/${sessionId}/preview-section-change`,
            data
        );
        return response.data || null;
    },

    /**
     * Apply time change and re-evaluate all check-in records.
     * This IS destructive — updates record statuses and writes audit log.
     */
    async applyTimeChange(
        sessionId: number,
        data: Partial<CreateAttendanceData>
    ): Promise<{ session: AttendanceSession; impact: TimeChangeImpact } | null> {
        const response = await api.post<{ session: AttendanceSession; impact: TimeChangeImpact }>(
            `/attendance/${sessionId}/apply-time-change`,
            data
        );
        return response.data || null;
    },
};

export default attendanceService;
