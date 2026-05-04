/**
 * Score Edit Request Service - API calls for score edit approval
 */

import api from './api.service';

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

    return "เกิดข้อผิดพลาดในการยกเลิกคำร้อง";
};

export interface ScoreEditRequestStudent {
    id: number;
    student_id: string;
    full_name: string;
}

export interface ScoreEditRequestAssignment {
    id: number;
    name: string;
    max_score: number;
}

export interface ScoreEditRequestSubItem {
    id: number;
    name: string;
    max_score: number;
}

export interface ScoreEditRequestUser {
    id: number;
    username: string;
    full_name: string;
}

export interface ScoreEditRequest {
    id: number;
    status: 'pending' | 'approved' | 'rejected';
    old_score: number | null;
    new_score: number;
    reason: string | null;
    images: string[] | null;
    review_comment: string | null;
    created_at: string;
    reviewed_at: string | null;
    score: {
        id: number;
        current_score: number | null;
    };
    assignment: ScoreEditRequestAssignment;
    sub_item: ScoreEditRequestSubItem | null;
    student: ScoreEditRequestStudent;
    requester: ScoreEditRequestUser;
    reviewer: ScoreEditRequestUser | null;
}

export interface ScoreEditRequestsResponse {
    success: boolean;
    data: ScoreEditRequest[];
    counts: {
        pending: number;
        approved: number;
        rejected: number;
    };
    role?: 'instructor' | 'ta';
}

export interface PendingCountResponse {
    success: boolean;
    count: number;
}

const scoreEditRequestService = {
    /**
     * Get all edit requests for a course
     */
    getEditRequests: async (courseId: string, status?: 'pending' | 'approved' | 'rejected'): Promise<ScoreEditRequestsResponse> => {
        const params = new URLSearchParams({ course_id: courseId });
        if (status) {
            params.append('status', status);
        }
        const response = await api.get<ScoreEditRequestsResponse>(`/score-edit-requests?${params.toString()}`);
        // api.get returns the data directly, not wrapped in { data: ... }
        return response as unknown as ScoreEditRequestsResponse;
    },

    /**
     * Get pending count for badge display
     */
    getPendingCount: async (courseId: string): Promise<number> => {
        const response = await api.get<PendingCountResponse>(`/score-edit-requests/pending-count?course_id=${courseId}`);
        // api.get returns the data directly
        return (response as unknown as PendingCountResponse)?.count ?? 0;
    },

    /**
     * Create a new edit request (TA)
     */
    createEditRequest: async (data: {
        score_id: number;
        new_score: number;
        reason?: string;
    }): Promise<{ success: boolean; message: string; data: { id: number; status: string } }> => {
        const response = await api.post<{ success: boolean; message: string; data: { id: number; status: string } }>('/score-edit-requests', data);
        return response as unknown as { success: boolean; message: string; data: { id: number; status: string } };
    },

    /**
     * Approve an edit request (instructor only)
     */
    approveEditRequest: async (requestId: number, comment?: string): Promise<{ success: boolean; message: string }> => {
        const response = await api.post<{ success: boolean; message: string }>(`/score-edit-requests/${requestId}/approve`, { comment });
        return response as unknown as { success: boolean; message: string };
    },

    /**
     * Approve multiple edit requests at once (instructor only) - for batch/group approval
     */
    batchApproveEditRequests: async (requestIds: number[], comment?: string): Promise<{ success: boolean; message: string; count: number }> => {
        const response = await api.post<{ success: boolean; message: string; count: number }>('/score-edit-requests/batch-approve', { 
            request_ids: requestIds,
            comment 
        });
        return response as unknown as { success: boolean; message: string; count: number };
    },

    /**
     * Reject multiple edit requests at once (instructor only) - for batch/group rejection
     */
    batchRejectEditRequests: async (requestIds: number[], comment: string): Promise<{ success: boolean; message: string; count: number }> => {
        const response = await api.post<{ success: boolean; message: string; count: number }>('/score-edit-requests/batch-reject', { 
            request_ids: requestIds,
            comment 
        });
        return response as unknown as { success: boolean; message: string; count: number };
    },

    /**
     * Reject an edit request (instructor only)
     */
    rejectEditRequest: async (requestId: number, comment: string): Promise<{ success: boolean; message: string }> => {
        const response = await api.post<{ success: boolean; message: string }>(`/score-edit-requests/${requestId}/reject`, { comment });
        return response as unknown as { success: boolean; message: string };
    },

    /**
     * Cancel a pending edit request (requester only)
     */
    cancelEditRequest: async (requestId: number): Promise<{ success: boolean; message: string }> => {
        const response = await api.delete<{ success: boolean; message: string }>(`/score-edit-requests/${requestId}/cancel`);
        if (!response.success) {
            throw new Error(getApiErrorMessage(response));
        }
        return response as unknown as { success: boolean; message: string };
    },
};

export default scoreEditRequestService;
