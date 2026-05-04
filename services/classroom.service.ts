/**
 * Classroom Service - API calls for classroom management
 */

import apiService from './api.service';

export interface Desk {
  id: string;
  number: number;
  x: number;
  y: number;
  type: 'computer' | 'normal' | 'teacher';
  is_enabled: boolean;
}

export interface ZoneData {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface Classroom {
  id: string;
  name: string;
  building: string;
  floor: string;
  description?: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  desks: Desk[];
  zones?: ZoneData[];
  creator?: {
    id: number;
    full_name: string;
    email: string;
  };
}

export interface ClassroomStats {
  totalClassrooms: number;
  deletedClassrooms: number;
  totalDesks: number;
  computerDesks: number;
  normalDesks: number;
  teacherDesks: number;
  enabledDesks: number;
  disabledDesks: number;
  buildings: string[];
}

export interface ClassroomListResponse {
  classrooms: Classroom[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ClassroomParams {
  page?: number;
  limit?: number;
  search?: string;
  building?: string;
  showDeleted?: string;
  sortBy?: string;
  sortOrder?: string;
}

class ClassroomService {
  /**
   * Get all classrooms with pagination and filters
   */
  async getClassrooms(params?: ClassroomParams) {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.search) queryParams.search = params.search;
    if (params?.building) queryParams.building = params.building;
    if (params?.showDeleted) queryParams.showDeleted = params.showDeleted;
    if (params?.sortBy) queryParams.sortBy = params.sortBy;
    if (params?.sortOrder) queryParams.sortOrder = params.sortOrder;

    return apiService.get<ClassroomListResponse>('/classrooms', { params: queryParams });
  }

  /**
   * Get a single classroom by ID
   */
  async getClassroom(id: string) {
    return apiService.get<Classroom>(`/classrooms/${id}`);
  }

  /**
   * Create a new classroom
   */
  async createClassroom(data: {
    name: string;
    building: string;
    floor: string;
    description?: string;
  }) {
    return apiService.post<Classroom>('/classrooms', data);
  }

  /**
   * Update classroom info
   */
  async updateClassroom(id: string, data: {
    name?: string;
    building?: string;
    floor?: string;
    description?: string;
  }) {
    return apiService.put<Classroom>(`/classrooms/${id}`, data);
  }

  /**
   * Update classroom layout (desks and zones)
   */
  async updateLayout(id: string, desks: {
    id?: string;
    number: number;
    x: number;
    y: number;
    type: 'computer' | 'normal' | 'teacher';
    isEnabled: boolean;
  }[], zones?: {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }[]) {
    return apiService.put<Classroom>(`/classrooms/${id}/layout`, { desks, zones });
  }

  /**
   * Soft delete a classroom
   */
  async deleteClassroom(id: string, permanent = false) {
    const params = permanent ? { permanent: 'true' } : undefined;
    return apiService.delete(`/classrooms/${id}`, { params });
  }

  /**
   * Restore a soft-deleted classroom
   */
  async restoreClassroom(id: string) {
    return apiService.post<Classroom>(`/classrooms/${id}/restore`);
  }

  /**
   * Toggle classroom active status
   */
  async toggleStatus(id: string) {
    return apiService.patch<Classroom>(`/classrooms/${id}/toggle-status`);
  }

  /**
   * Get classroom statistics
   */
  async getStats() {
    return apiService.get<ClassroomStats>('/classrooms/stats');
  }
}

export const classroomService = new ClassroomService();
export default classroomService;
