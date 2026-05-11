/**
 * Score Service - API calls for scores
 */

import api from './api.service';
import type { Assignment, AssignmentSubItem } from './assignment.service';

export interface Student {
    id: number;
    student_id: string;
    full_name: string;
    email: string;
    is_active: number;
}

export interface ScoreEntry {
    score_id?: number;
    score: number | null;
    max_score: number;
    graded_by?: {
        id: number;
        display_name: string;
    };
    graded_at?: string;
}

export interface SubItemScoreData {
    sub_item_id: number;
    sub_item_name: string;
    max_score: number;
    score: number | null;
    score_id: number | null;
    graded_by?: {
        id: number;
        display_name: string;
    } | null;
    graded_at?: string | null;
}

// Attendance detail for multi-session attendance
export interface AttendanceDetail {
    session_id: number;
    session_title: string;
    start_time: string;
    status: 'present' | 'late' | 'leave' | 'absent';
    attended: boolean;
}

export interface StudentScore {
    student: Student;
    score?: number | null;
    score_id?: number;
    max_score?: number;
    comment?: string;
    status?: 'pending' | 'graded';
    graded_by?: {
        id: number;
        display_name: string;
    };
    graded_at?: string;
    sub_item_scores?: SubItemScoreData[];
    // Attendance info (if assignment is linked to attendance session)
    attendance_status?: 'present' | 'late' | 'leave' | 'absent' | 'partial' | null;
    can_score?: boolean;
    // Multi-session attendance info
    attendance_details?: AttendanceDetail[];
    attendance_condition?: 'and' | 'or' | null;
    attended_count?: number;
    total_count?: number;
}

export interface ScoresData {
    assignment: Assignment & {
        attendance_condition?: 'and' | 'or';
        linked_sessions_count?: number;
    };
    student_scores: StudentScore[];
}

// Simplified score entries from existing scores
export interface ExistingScore {
    student_id: number;
    score: number | null;
}

export interface Group {
    id: number;
    name: string;
    members: Student[];
}

export interface ScoreEditRequest {
    id: number;
    score_id: number;
    old_score: number;
    new_score: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    requested_by: number;
    reviewed_by?: number;
    reviewed_at?: string;
    review_comment?: string;
    created_at: string;
    score?: {
        assignment: Assignment;
        student: Student;
    };
    requester?: {
        id: number;
        display_name: string;
    };
}

export interface SkippedEditItem {
    score_id: number;
    student_name: string;
    sub_item_name?: string | null;
}

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

const getApiErrorMessage = (response: { message?: unknown; error?: unknown }): string => {
    if (typeof response.message === "string" && response.message.trim()) {
        return response.message;
    }

    if (response.message && typeof response.message === "object") {
        const nested = (response.message as { message?: unknown }).message;
        if (typeof nested === "string" && nested.trim()) {
            return nested;
        }
    }

    if (typeof response.error === "string" && response.error.trim()) {
        return response.error;
    }

    if (response.error && typeof response.error === "object") {
        const nested = (response.error as { message?: unknown }).message;
        if (typeof nested === "string" && nested.trim()) {
            return nested;
        }
    }

    return "เกิดข้อผิดพลาดในการส่งคำขอ";
};

const scoreService = {
    /**
     * Get scores for an assignment
     */
    async getScores(assignmentId: number): Promise<ScoresData | null> {
        const response = await api.get<ScoresData>(`/scores?assignment_id=${assignmentId}`);
        return response.data || null;
    },

    /**
     * Submit single score
     */
    async submitScore(data: {
        assignment_id: number;
        student_id: number;
        score: number;
        comment?: string;
        sub_item_id?: number;
    }): Promise<boolean> {
        const response = await api.post<unknown>('/scores', data);
        return response.success;
    },

    /**
     * Submit bulk scores
     */
    async submitBulkScores(data: {
        assignment_id: number;
        scores: {
            student_id: number;
            score: number;
            comment?: string;
        }[];
    }): Promise<boolean> {
        const response = await api.post<unknown>('/scores/bulk', data);
        return response.success;
    },

    /**
     * Submit group score
     */
    async submitGroupScore(data: {
        assignment_id: number;
        group_id: number;
        score: number;
        comment?: string;
        sub_item_id?: number;
        student_ids?: number[]; // Optional: for grading selected members only
    }): Promise<boolean> {
        const response = await api.post<unknown>('/scores/group', data);
        return response.success;
    },

    /**
     * Search students
     */
    async searchStudents(courseId: string, query?: string): Promise<Student[]> {
        let url = `/scores/students/search?course_id=${courseId}`;
        if (query) {
            url += `&query=${encodeURIComponent(query)}`;
        }
        const response = await api.get<Student[]>(url);
        return response.data || [];
    },

    /**
     * Get groups for assignment
     */
    async getGroupsForAssignment(assignmentId: number): Promise<Group[]> {
        const response = await api.get<Group[]>(`/scores/groups?assignment_id=${assignmentId}`);
        return response.data || [];
    },

    /**
     * Request score edit (single)
     */
    async requestScoreEdit(data: {
        score_id: number;
        new_score: number;
        reason: string;
    }, images?: File[]): Promise<boolean> {
        // If images provided, use FormData
        if (images && images.length > 0) {
            const formData = new FormData();
            formData.append('score_id', data.score_id.toString());
            formData.append('new_score', data.new_score.toString());
            formData.append('reason', data.reason);
            images.forEach((image) => {
                formData.append('images', image);
            });
            const response = await api.post<unknown>('/score-edit-requests', formData);
            if (!response.success) {
                throw new Error(getApiErrorMessage(response));
            }
            return true;
        }
        const response = await api.post<unknown>('/score-edit-requests', data);
        if (!response.success) {
            throw new Error(getApiErrorMessage(response));
        }
        return true;
    },

    /**
     * Request group score edit (multiple scores at once)
     */
    async requestGroupScoreEdit(data: {
        score_ids: number[];
        new_score: number;
        reason: string;
    }, images?: File[]): Promise<{ created: number; skipped: number; skipped_names: string[]; skipped_items: SkippedEditItem[] }> {
        // If images provided, use FormData
        if (images && images.length > 0) {
            const formData = new FormData();
            formData.append('score_ids', JSON.stringify(data.score_ids));
            formData.append('new_score', data.new_score.toString());
            formData.append('reason', data.reason);
            images.forEach((image) => {
                formData.append('images', image);
            });
            const response = await api.post<{ count: number; skipped: number; skipped_names: string[]; skipped_items?: SkippedEditItem[] }>('/score-edit-requests/batch', formData);
            if (!response.success) {
                throw new Error(getApiErrorMessage(response));
            }
            return {
                created: response.data?.count ?? 0,
                skipped: response.data?.skipped ?? 0,
                skipped_names: response.data?.skipped_names ?? [],
                skipped_items: response.data?.skipped_items ?? [],
            };
        }
        const response = await api.post<{ count: number; skipped: number; skipped_names: string[]; skipped_items?: SkippedEditItem[] }>('/score-edit-requests/batch', data);
        if (!response.success) {
            throw new Error(getApiErrorMessage(response));
        }
        return {
            created: response.data?.count ?? 0,
            skipped: response.data?.skipped ?? 0,
            skipped_names: response.data?.skipped_names ?? [],
            skipped_items: response.data?.skipped_items ?? [],
        };
    },

    /**
     * Request detailed score edits (multiple score_id/new_score pairs in one request)
     */
    async requestDetailedScoreEdits(data: {
        edits: { score_id: number; new_score: number }[];
        reason: string;
    }, images?: File[]): Promise<{ created: number; skipped: number; skipped_names: string[]; skipped_items: SkippedEditItem[] }> {
        if (!data.edits || data.edits.length === 0) {
            return { created: 0, skipped: 0, skipped_names: [], skipped_items: [] };
        }

        const submitGroupedFallback = async (): Promise<{ created: number; skipped: number; skipped_names: string[]; skipped_items: SkippedEditItem[] }> => {
            const groupedByScore = new Map<number, number[]>();
            data.edits.forEach((edit) => {
                const key = Number(edit.new_score);
                const list = groupedByScore.get(key) ?? [];
                list.push(edit.score_id);
                groupedByScore.set(key, list);
            });

            let created = 0;
            let skipped = 0;
            const skippedNameSet = new Set<string>();
            const skippedItems: SkippedEditItem[] = [];

            for (const [newScore, scoreIds] of groupedByScore.entries()) {
                if (images && images.length > 0) {
                    const formData = new FormData();
                    formData.append('score_ids', JSON.stringify(scoreIds));
                    formData.append('new_score', newScore.toString());
                    formData.append('reason', data.reason);
                    images.forEach((image) => {
                        formData.append('images', image);
                    });

                    const response = await api.post<{ count: number; skipped: number; skipped_names: string[]; skipped_items?: SkippedEditItem[] }>('/score-edit-requests/batch', formData);
                    if (!response.success) {
                        throw new Error(getApiErrorMessage(response));
                    }
                    created += response.data?.count ?? 0;
                    skipped += response.data?.skipped ?? 0;
                    (response.data?.skipped_names ?? []).forEach((name) => skippedNameSet.add(name));
                    skippedItems.push(...(response.data?.skipped_items ?? []));
                } else {
                    const response = await api.post<{ count: number; skipped: number; skipped_names: string[]; skipped_items?: SkippedEditItem[] }>('/score-edit-requests/batch', {
                        score_ids: scoreIds,
                        new_score: newScore,
                        reason: data.reason,
                    });
                    if (!response.success) {
                        throw new Error(getApiErrorMessage(response));
                    }
                    created += response.data?.count ?? 0;
                    skipped += response.data?.skipped ?? 0;
                    (response.data?.skipped_names ?? []).forEach((name) => skippedNameSet.add(name));
                    skippedItems.push(...(response.data?.skipped_items ?? []));
                }
            }

            return { created, skipped, skipped_names: Array.from(skippedNameSet), skipped_items: skippedItems };
        };

        if (images && images.length > 0) {
            const formData = new FormData();
            formData.append('edits', JSON.stringify(data.edits));
            formData.append('reason', data.reason);
            images.forEach((image) => {
                formData.append('images', image);
            });

            const response = await api.post<{ count: number; skipped: number; skipped_names: string[]; skipped_items?: SkippedEditItem[] }>('/score-edit-requests/batch-detailed', formData);
            if (response.success) {
                return {
                    created: response.data?.count ?? 0,
                    skipped: response.data?.skipped ?? 0,
                    skipped_names: response.data?.skipped_names ?? [],
                    skipped_items: response.data?.skipped_items ?? [],
                };
            }

            const message = `${response.message ?? ""} ${response.error ?? ""}`.toLowerCase();
            if (message.includes('not found') || message.includes('404')) {
                return submitGroupedFallback();
            }

            throw new Error(getApiErrorMessage(response));
        }

        const response = await api.post<{ count: number; skipped: number; skipped_names: string[]; skipped_items?: SkippedEditItem[] }>('/score-edit-requests/batch-detailed', data);
        if (response.success) {
            return {
                created: response.data?.count ?? 0,
                skipped: response.data?.skipped ?? 0,
                skipped_names: response.data?.skipped_names ?? [],
                skipped_items: response.data?.skipped_items ?? [],
            };
        }

        const message = `${response.message ?? ""} ${response.error ?? ""}`.toLowerCase();
        if (message.includes('not found') || message.includes('404')) {
            return submitGroupedFallback();
        }

        throw new Error(getApiErrorMessage(response));
    },

    /**
     * Get pending edit requests
     */
    async getPendingEditRequests(courseId?: string): Promise<ScoreEditRequest[]> {
        let url = '/scores/edit-requests';
        if (courseId) {
            url += `?course_id=${courseId}`;
        }
        const response = await api.get<ScoreEditRequest[]>(url);
        return response.data || [];
    },

    /**
     * Review edit request
     */
    async reviewEditRequest(id: number, data: {
        status: 'approved' | 'rejected';
        review_comment?: string;
    }): Promise<boolean> {
        const response = await api.put<unknown>(`/scores/edit-requests/${id}`, data);
        return response.success;
    },

    /**
     * Get student scores summary
     */
    async getStudentScoresSummary(courseId: string | number, studentId?: number): Promise<Assignment[]> {
        let url = `/scores/summary?course_id=${courseId}`;
        if (studentId) {
            url += `&student_id=${studentId}`;
        }
        const response = await api.get<Assignment[]>(url);
        return response.data || [];
    },

    /**
     * Get score summary matrix (students x assignments)
     */
    async getScoreSummaryMatrix(
        courseId: string,
        options?: {
            sectionId?: number;
            assignmentType?: 'individual' | 'assignment' | 'group' | 'permanent_group' | 'weekly_group';
        }
    ): Promise<ScoreSummaryMatrix | null> {
        let url = `/scores/matrix?course_id=${courseId}`;
        if (options?.sectionId) {
            url += `&section_id=${options.sectionId}`;
        }
        if (options?.assignmentType) {
            url += `&assignment_type=${options.assignmentType}`;
        }
        const response = await api.get<ScoreSummaryMatrix>(url);
        return response.data || null;
    },

    /**
     * Get ungraded students summary per assignment
     */
    async getUngradedSummary(courseId: string): Promise<UngradedSummary> {
        const response = await api.get<UngradedSummary>(`/scores/ungraded-summary?course_id=${courseId}`);
        return response.data || {};
    },
};

// Types for Ungraded Summary
export interface UngradedStudentInfo {
    student_id: string;
    full_name: string;
}

export interface UngradedAssignmentInfo {
    ungraded_count: number;
    total_students: number;
    graded_count: number;
    students: UngradedStudentInfo[];
}

export type UngradedSummary = Record<string, UngradedAssignmentInfo>;

// Types for Score Summary Matrix
export interface ScoreSummaryMatrixStudent {
    student_id: string;
    full_name: string;
    section_number: number;
    bonus_score: number;
    group_id?: number | null;
    group_name?: string | null;
    scores: {
        [key: string]: {
            score: number | null;
            max_score: number;
            sub_item_name?: string;
            graded_by?: string | null;
            graded_at?: string | null;
            updated_at?: string | null;
            comment?: string | null;
            group_name?: string | null;
            edit_requests?: {
                old_score: number | null;
                new_score: number;
                reason: string | null;
                requester: string | null;
                reviewer: string | null;
                reviewed_at: string | null;
                review_comment: string | null;
            }[];
        };
    };
    total_score: number;
    total_max_score: number;
    scored_count: number;
    total_items: number;
}

export interface ScoreSummaryMatrixAssignment {
    id: number;
    title: string;
    short_title: string;
    max_score: number;
    assignment_type: string;
    subItems: {
        id: number;
        name: string;
        max_score: number;
    }[];
}

export interface ScoreSummaryMatrix {
    sections: { id: number; section_number: number }[];
    assignments: ScoreSummaryMatrixAssignment[];
    students: ScoreSummaryMatrixStudent[];
    averages: { [key: string]: string | null };
    summary: {
        total_students: number;
        total_assignments: number;
    };
}

export default scoreService;
