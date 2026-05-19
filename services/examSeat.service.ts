/**
 * Exam Seat Service - API calls for Exam Seat Management
 * ระบบจัดที่นั่งสอบ
 */

import { apiService } from './api.service';
import { ExamSetting } from './examScore.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExamSessionRoom {
    id: number;
    exam_session_id: number;
    classroom_id: string;
    sort_order: number;
    classroom?: {
        id: string;
        name: string;
        building: string;
        floor: string;
    };
}

export interface ExamSession {
    id: number;
    course_id: string;
    exam_setting_id: number;
    exam_date: string;      // ISO date string "YYYY-MM-DD"
    start_time: string;     // "HH:MM"
    end_time: string;       // "HH:MM"
    notes: string;
    seat_number_start: number;
    seat_number_step: number;
    created_at: string;
    updated_at: string;
    exam_setting?: ExamSetting;
    rooms?: ExamSessionRoom[];
    seats?: ExamSeat[];
}

export interface ExamSeat {
    id: number;
    exam_session_id: number;
    student_id: number;
    desk_id: string;
    seat_number: number;
    created_at: string;
    updated_at: string;
    // enriched fields from GetExamSeatsBySession
    classroom_id?: string;
    classroom_name?: string;
    desk_number?: number;
    seat_label?: string;
    student?: {
        id: number;
        student_id: string;
        full_name: string;
    };
}

export interface ImportPreviewRow {
    row_num: number;
    student_id: string;
    full_name: string;
    major: string;
    seat_label: string;
    classroom_name: string;
    desk_number: number;
    student_found: boolean;
    desk_found: boolean;
    student_db_id: number;
    desk_db_id: string;
}

export interface ImportPreviewResult {
    rows: ImportPreviewRow[];
    total: number;
    matched: number;
    student_not_found: number;
    desk_not_found: number;
}

export interface MyExamSeat {
    session_id: number;
    exam_type: string;
    component: string;
    exam_date: string;
    start_time: string;
    end_time: string;
    classroom_name: string;
    desk_number: number;
    seat_number: number;
    seat_label: string;
}

export interface ExportSeatRow {
    row_num: number;
    student_id: string;
    full_name: string;
    major: string;
    seat_label: string;
    classroom_name: string;
    desk_number: number;
    seat_number: number;
}

export interface ExamSeatingExport {
    session: ExamSession;
    rows: ExportSeatRow[];
}

// ─── ExamSession CRUD ─────────────────────────────────────────────────────────

export const getExamSessions = async (courseId: string): Promise<ExamSession[]> => {
    const res = await apiService.get<ExamSession[]>(`/courses/${courseId}/exam-sessions`);
    return res.data ?? [];
};

export const createExamSession = async (
    courseId: string,
    payload: {
        exam_setting_id: number;
        exam_date: string;
        start_time: string;
        end_time: string;
        notes?: string;
        classroom_ids?: string[];
        seat_number_start?: number;
        seat_number_step?: number;
    }
): Promise<ExamSession> => {
    const res = await apiService.post<ExamSession>(`/courses/${courseId}/exam-sessions`, payload);
    if (!res.data) throw new Error(res.message ?? 'Failed to create exam session');
    return res.data;
};

export const updateExamSession = async (
    courseId: string,
    sessionId: number,
    payload: {
        exam_date?: string;
        start_time?: string;
        end_time?: string;
        notes?: string;
        seat_number_start?: number;
        seat_number_step?: number;
    }
): Promise<void> => {
    await apiService.put(`/courses/${courseId}/exam-sessions/${sessionId}`, payload);
};

export const deleteExamSession = async (courseId: string, sessionId: number): Promise<void> => {
    await apiService.delete(`/courses/${courseId}/exam-sessions/${sessionId}`);
};

export const updateExamSessionClassrooms = async (
    courseId: string,
    sessionId: number,
    classroomIds: string[]
): Promise<ExamSessionRoom[]> => {
    const res = await apiService.put<ExamSessionRoom[]>(
        `/courses/${courseId}/exam-sessions/${sessionId}/classrooms`,
        { classroom_ids: classroomIds }
    );
    return res.data ?? [];
};

// ─── Seat assignment ──────────────────────────────────────────────────────────

export const getExamSeats = async (courseId: string, sessionId: number): Promise<ExamSeat[]> => {
    const res = await apiService.get<ExamSeat[]>(`/courses/${courseId}/exam-sessions/${sessionId}/seats`);
    return res.data ?? [];
};

export const assignExamSeat = async (
    courseId: string,
    sessionId: number,
    payload: { student_id: number; desk_id: string; seat_number?: number }
): Promise<ExamSeat> => {
    const res = await apiService.post<ExamSeat>(
        `/courses/${courseId}/exam-sessions/${sessionId}/seats`,
        payload
    );
    if (!res.data) throw new Error(res.message ?? 'Failed to assign seat');
    return res.data;
};

export const autoAssignExamSeats = async (
    courseId: string,
    sessionId: number,
    classroomIds: string[]
): Promise<{ assigned: number }> => {
    const res = await apiService.post<{ assigned: number }>(
        `/courses/${courseId}/exam-sessions/${sessionId}/seats/auto-assign`,
        { classroom_ids: classroomIds }
    );
    return res.data ?? { assigned: 0 };
};

export const unassignExamSeat = async (
    courseId: string,
    sessionId: number,
    seatId: number
): Promise<void> => {
    await apiService.delete(`/courses/${courseId}/exam-sessions/${sessionId}/seats/${seatId}`);
};

export const clearExamSeats = async (courseId: string, sessionId: number): Promise<void> => {
    await apiService.delete(`/courses/${courseId}/exam-sessions/${sessionId}/seats`);
};

export const replaceExamSeats = async (
    courseId: string,
    sessionId: number,
    seats: Array<{ student_id: number; desk_id: string; seat_number: number }>
): Promise<ExamSeat[]> => {
    const res = await apiService.put<ExamSeat[]>(
        `/courses/${courseId}/exam-sessions/${sessionId}/seats`,
        { seats }
    );
    return res.data ?? [];
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const getExamSeatingExport = async (
    courseId: string,
    sessionId: number
): Promise<ExamSeatingExport> => {
    const res = await apiService.get<ExamSeatingExport>(
        `/courses/${courseId}/exam-sessions/${sessionId}/export`
    );
    if (!res.data) throw new Error(res.message ?? 'Failed to get seating export');
    return res.data;
};

// ─── DOCX import ─────────────────────────────────────────────────────────────

export const importExamSeatsPreview = async (
    courseId: string,
    file: File
): Promise<ImportPreviewResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiService.post<ImportPreviewResult>(
        `/courses/${courseId}/exam-sessions/import/preview`,
        formData
    );
    if (!res.data) throw new Error(res.message ?? 'Failed to parse file');
    return res.data;
};

export const importExamSeatsCommit = async (
    courseId: string,
    payload: {
        exam_setting_id: number;
        exam_date: string;
        start_time: string;
        end_time: string;
        notes?: string;
        seats: Array<{ student_id: number; desk_id: string; seat_number: number }>;
    }
): Promise<{ session_id: number; imported: number }> => {
    const res = await apiService.post<{ session_id: number; imported: number }>(
        `/courses/${courseId}/exam-sessions/import/commit`,
        payload
    );
    if (!res.data) throw new Error(res.message ?? 'Failed to import seats');
    return res.data;
};

// ─── Student-facing ───────────────────────────────────────────────────────────

export const getMyExamSeats = async (courseId: string): Promise<MyExamSeat[]> => {
    const res = await apiService.get<MyExamSeat[]>(`/courses/${courseId}/my-exam-seats`);
    return res.data ?? [];
};
