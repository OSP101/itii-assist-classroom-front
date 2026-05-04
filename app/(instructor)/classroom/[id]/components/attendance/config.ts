/**
 * AttendanceTab Configuration & Types
 * Contains all types, constants, and utility functions
 */

import { type AttendanceSession, type CreateAttendanceData as _CreateAttendanceData } from "@/services/attendance.service";

// Re-export types from service for convenience
export type { AttendanceSession, CreateAttendanceData } from "@/services/attendance.service";

// Internal alias for type references
type CreateAttendanceData = _CreateAttendanceData;

// ============================================================================
// Types
// ============================================================================

export interface Section {
    id: number;
    section_no: string;
    note?: string | null;
    studentCount?: number;
}

export interface Course {
    id: string;
    code: string;
    name: string;
    sections?: Section[];
}

export interface AttendanceTabProps {
    course: Course;
    isLoading: boolean;
    onAttendanceChanged?: () => void;
}

export interface AttendanceStats {
    total: number;
    active: number;
    draft: number;
    closed: number;
}

export interface SessionWithComputedStatus extends AttendanceSession {
    status: "draft" | "active" | "closed";
}

export interface FormState {
    formData: CreateAttendanceData;
    startDateTime: import("@internationalized/date").DateValue;
    endDateTime: import("@internationalized/date").DateValue;
}

export interface ModalTargets {
    editTarget: AttendanceSession | null;
    deleteTarget: AttendanceSession | null;
    closeTarget: AttendanceSession | null;
}

export interface ModalStates {
    isCreateModalOpen: boolean;
    isEditModalOpen: boolean;
    isDeleteModalOpen: boolean;
    isCloseModalOpen: boolean;
}

export interface FilterState {
    searchQuery: string;
    statusFilter: string;
    typeFilter: string;
}

// ============================================================================
// Constants
// ============================================================================

export const SESSION_TYPE_DISPLAY: Record<string, { 
    label: string; 
    color: "primary" | "secondary" | "success" | "warning" | "danger"; 
    icon: string 
}> = {
    lecture: { label: "บรรยาย", color: "primary", icon: "solar:presentation-graph-bold" },
    lab: { label: "ปฏิบัติ", color: "success", icon: "solar:test-tube-bold" },
    online: { label: "ออนไลน์", color: "secondary", icon: "solar:laptop-bold" },
};

export const STATUS_DISPLAY: Record<string, { 
    label: string; 
    color: "default" | "primary" | "secondary" | "success" | "warning" | "danger" 
}> = {
    draft: { label: "ฉบับร่าง", color: "default" },
    active: { label: "กำลังเปิด", color: "success" },
    closed: { label: "ปิดแล้ว", color: "danger" },
};

export const RADIUS_OPTIONS = [10, 50, 100, 200] as const;
export const LATE_THRESHOLD_OPTIONS = [5, 10, 15, 20, 30] as const;
export const AUTO_UPDATE_INTERVAL_MS = 30000; // 30 seconds

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format date for Thai locale display รูปแบบวันที่
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

/**
 * Format time for Thai locale display
 */
export function formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

/**
 * Format datetime for Thai locale display
 */
export function formatDateTime(dateString: string): string {
    return `${formatDate(dateString)} ${formatTime(dateString)}`;
}

/**
 * Compute real-time status based on current time
 */
export function computeSessionStatus(session: AttendanceSession): "draft" | "active" | "closed" {
    // If status is manually set to closed, keep it closed
    if (session.status === "closed") return "closed";

    const now = new Date();
    const startTime = new Date(session.start_time);
    const endTime = new Date(session.end_time);

    if (now < startTime) {
        return "draft"; // ยังไม่ถึงเวลาเริ่ม
    } else if (now >= startTime && now <= endTime) {
        return "active"; // อยู่ในช่วงเวลา
    } else {
        return "closed"; // หมดเวลาแล้ว
    }
}

/**
 * Get initial form data for creating a new session
 */
export function getInitialFormData(courseId: string, sectionIds: number[]): CreateAttendanceData {
    return {
        course_id: courseId,
        course_section_id: null,
        course_section_ids: sectionIds,
        title: "",
        session_type: "lecture",
        check_location: false,
        location_lat: undefined,
        location_lng: undefined,
        radius_meters: 10,
        start_time: "",
        end_time: "",
        late_threshold_minutes: 15,
        late_threshold_time: null,
    };
}

/**
 * Filter sessions based on search and filter criteria
 */
export function filterSessions(
    sessions: SessionWithComputedStatus[],
    searchQuery: string,
    statusFilter: string,
    typeFilter: string
): SessionWithComputedStatus[] {
    return sessions.filter((session) => {
        const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || session.status === statusFilter;
        const matchesType = typeFilter === "all" || session.session_type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
    });
}

/**
 * Calculate stats from sessions
 */
export function calculateStats(sessions: SessionWithComputedStatus[]): AttendanceStats {
    return {
        total: sessions.length,
        active: sessions.filter((s) => s.status === "active").length,
        draft: sessions.filter((s) => s.status === "draft").length,
        closed: sessions.filter((s) => s.status === "closed").length,
    };
}
