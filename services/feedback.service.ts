/**
 * Feedback Service - API calls for Feedback/Bug Report System
 */

import { apiService } from './api.service';

// Types
export interface Feedback {
  id: number;
  user_id: number | null;
  type: 'bug' | 'feature' | 'improvement' | 'other';
  title: string;
  description: string;
  attachments: string[];
  status: 'pending' | 'reviewing' | 'resolved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'critical';
  admin_notes: string | null;
  resolved_at: string | null;
  resolved_by: number | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    username: string;
    full_name: string;
    email: string;
    role: string;
    avatar: string | null;
  };
  resolver?: {
    id: number;
    username: string;
    full_name: string;
  };
}

export interface FeedbackStats {
  total: number;
  byStatus: {
    pending: number;
    reviewing: number;
    resolved: number;
    rejected: number;
  };
  byType: {
    bugs: number;
    features: number;
    improvements: number;
    others: number;
  };
}

export interface CreateFeedbackDto {
  type: 'bug' | 'feature' | 'improvement' | 'other';
  title: string;
  description: string;
  attachments?: string[];
  contact_email?: string;
}

export interface UpdateFeedbackDto {
  status?: 'pending' | 'reviewing' | 'resolved' | 'rejected';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  admin_notes?: string;
}

export interface FeedbackQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  priority?: string;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

export interface FeedbackListResponse {
  feedbacks: Feedback[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const FEEDBACK_ENDPOINT = '/feedback';

class FeedbackService {
  /**
   * Create new feedback
   */
  async createFeedback(data: CreateFeedbackDto) {
    return apiService.post<Feedback>(FEEDBACK_ENDPOINT, data);
  }

  /**
   * Get all feedbacks (Admin)
   */
  async getFeedbacks(params?: FeedbackQueryParams) {
    const queryParams: Record<string, string> = {};

    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.search) queryParams.search = params.search;
    if (params?.type) queryParams.type = params.type;
    if (params?.status) queryParams.status = params.status;
    if (params?.priority) queryParams.priority = params.priority;
    if (params?.sort_by) queryParams.sort_by = params.sort_by;
    if (params?.sort_order) queryParams.sort_order = params.sort_order;

    return apiService.get<FeedbackListResponse>(FEEDBACK_ENDPOINT, { params: queryParams });
  }

  /**
   * Get feedback by ID
   */
  async getFeedbackById(id: number) {
    return apiService.get<Feedback>(`${FEEDBACK_ENDPOINT}/${id}`);
  }

  /**
   * Update feedback (Admin)
   */
  async updateFeedback(id: number, data: UpdateFeedbackDto) {
    return apiService.put<Feedback>(`${FEEDBACK_ENDPOINT}/${id}`, data);
  }

  /**
   * Delete feedback (Admin)
   */
  async deleteFeedback(id: number) {
    return apiService.delete(`${FEEDBACK_ENDPOINT}/${id}`);
  }

  /**
   * Get feedback stats (Admin)
   */
  async getStats() {
    return apiService.get<FeedbackStats>(`${FEEDBACK_ENDPOINT}/stats`);
  }

  /**
   * Get my feedbacks
   */
  async getMyFeedbacks(params?: { page?: number; limit?: number }) {
    const queryParams: Record<string, string> = {};

    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();

    return apiService.get<FeedbackListResponse>(`${FEEDBACK_ENDPOINT}/my`, { params: queryParams });
  }
}

export const feedbackService = new FeedbackService();
export default feedbackService;
