/**
 * Assignment Service - API calls for assignments
 */

import api from './api.service';

export interface AssignmentSubItem {
    id?: number;
    assignment_id?: number;
    name: string;
    max_score: number;
    order_index?: number;
}

export interface LinkedAttendanceSession {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    session_type?: string;
    course_section_id?: number;
}

export interface Assignment {
    id: number;
    course_id: string; // nanoid format
    name: string;
    description?: string;
    assignment_type: 'individual' | 'permanent_group' | 'weekly_group' | 'assignment';
    week_number?: number;
    linked_attendance_session_id?: number | null;
    linkedAttendanceSession?: LinkedAttendanceSession | null;
    linkedAttendanceSessions?: LinkedAttendanceSession[]; // New: array of linked sessions
    attendance_condition?: 'and' | 'or'; // New: condition for multi-session attendance
    max_score: number;
    due_date?: string;
    order_index: number;
    is_active: boolean;
    is_score_visible?: boolean; // Whether students can see their scores
    is_draft?: boolean; // Draft mode - not visible to students
    publish_at?: string | null; // Auto-publish at this datetime (ISO string)
    created_by?: number;
    created_at?: string;
    updated_at?: string;
    subItems?: AssignmentSubItem[];
    creator?: {
        id: number;
        display_name: string;
    };
}

export interface CreateAssignmentData {
    course_id: string; // nanoid format
    name: string;
    description?: string;
    assignment_type?: 'individual' | 'permanent_group' | 'weekly_group' | 'assignment';
    week_number?: number;
    linked_attendance_session_id?: number | null; // Legacy single session
    linked_attendance_session_ids?: number[]; // New: array of session IDs
    attendance_condition?: 'and' | 'or'; // New: 'and' = must attend all, 'or' = must attend at least one
    max_score?: number;
    sub_items?: Omit<AssignmentSubItem, 'id' | 'assignment_id'>[];
    due_date?: string;
    is_score_visible?: boolean;
    is_draft?: boolean;
    publish_at?: string | null;
}

export interface SubItemWithScores {
    id: number;
    name: string;
    score_count: number;
}

/**
 * Thrown when an update would remove sub-items students have already been graded
 * on. The backend refuses the write and reports what would be destroyed; retry
 * with `confirm_delete_scores: true` once the user has agreed.
 */
export class SubItemsHaveScoresError extends Error {
    readonly subItems: SubItemWithScores[];
    readonly totalScores: number;

    constructor(subItems: SubItemWithScores[], totalScores: number) {
        super('Removing these sub-items would delete existing scores');
        this.name = 'SubItemsHaveScoresError';
        this.subItems = subItems;
        this.totalScores = totalScores;
    }
}

export interface UpdateAssignmentData {
    name?: string;
    confirm_delete_scores?: boolean;
    description?: string;
    assignment_type?: 'individual' | 'permanent_group' | 'weekly_group' | 'assignment';
    week_number?: number;
    linked_attendance_session_id?: number | null; // Legacy single session
    linked_attendance_session_ids?: number[]; // New: array of session IDs
    attendance_condition?: 'and' | 'or'; // New: 'and' = must attend all, 'or' = must attend at least one
    max_score?: number;
    sub_items?: Omit<AssignmentSubItem, 'assignment_id'>[]; // Include id for existing sub-items to preserve scores
    due_date?: string;
    is_draft?: boolean;
    publish_at?: string | null;
    clear_publish_at?: boolean;
}

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface AssignmentCourseStatusRow {
    assignment_id: number;
    name: string;
    assignment_type: string;
    max_score: number;
    due_date?: string | null;
    is_draft: boolean;
    target_count: number;
    graded_count: number;
    ungraded_count: number;
    graded_rate: number;
}

export interface AssignmentCourseSummary {
    course_id: string;
    total_assignments: number;
    overall_graded: number;
    overall_target: number;
    overall_graded_rate: number;
    assignments: AssignmentCourseStatusRow[];
}

const assignmentService = {
    /**
     * Get all assignments for a course
     */
    async getAssignments(courseId: string): Promise<Assignment[]> {
        const response = await api.get<Assignment[]>(`/assignments?course_id=${courseId}`);
        return response.data || [];
    },

    /**
     * Get course-wide assignment status report (submission/grading rate per assignment)
     */
    async getCourseSummary(courseId: string): Promise<AssignmentCourseSummary | null> {
        const response = await api.get<AssignmentCourseSummary>(`/assignments/course-summary?course_id=${courseId}`);
        return response.data || null;
    },

    /**
     * Get single assignment
     */
    async getAssignment(id: number): Promise<Assignment | null> {
        const response = await api.get<Assignment>(`/assignments/${id}`);
        return response.data || null;
    },

    /**
     * Create new assignment
     */
    async createAssignment(data: CreateAssignmentData): Promise<Assignment | null> {
        const response = await api.post<Assignment>('/assignments', data);
        return response.data || null;
    },

    /**
     * Update assignment
     */
    async updateAssignment(id: number, data: UpdateAssignmentData): Promise<Assignment | null> {
        const response = await api.put<Assignment>(`/assignments/${id}`, data);
        // A refusal carries its own `data` payload, so returning response.data
        // unconditionally would hand the caller a conflict report dressed up as a
        // saved assignment.
        if (response.success === false) {
            const code = (response as { code?: string }).code;
            if (code === 'sub_items_have_scores') {
                const payload = response.data as unknown as {
                    sub_items?: SubItemWithScores[];
                    total_scores?: number;
                } | undefined;
                throw new SubItemsHaveScoresError(payload?.sub_items ?? [], payload?.total_scores ?? 0);
            }
            return null;
        }
        return response.data || null;
    },

    /**
     * Delete assignment
     */
    async deleteAssignment(id: number): Promise<boolean> {
        const response = await api.delete<null>(`/assignments/${id}`);
        return response.success;
    },

    /**
     * Reorder assignments (sends ordered IDs to backend)
     */
    async reorderAssignments(courseId: string, orderedIds: number[]): Promise<boolean> {
        const response = await api.put<null>('/assignments/reorder/batch', {
            course_id: courseId,
            ordered_ids: orderedIds,
        });
        return response.success;
    },

    /**
     * Publish a draft assignment immediately
     */
    async publishAssignment(id: number): Promise<Assignment | null> {
        const response = await api.put<Assignment>(`/assignments/${id}`, {
            is_draft: false,
            clear_publish_at: true,
        });
        return response.data || null;
    },

    /**
     * Revert a published assignment back to draft
     */
    async unpublishAssignment(id: number): Promise<Assignment | null> {
        const response = await api.put<Assignment>(`/assignments/${id}`, {
            is_draft: true,
        });
        return response.data || null;
    },
};

export default assignmentService;
