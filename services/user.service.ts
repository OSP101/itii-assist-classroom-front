/**
 * User Service - API calls for User Management
 */

import { apiService } from './api.service';
import { API_ENDPOINTS } from '@/config/api';
import type { AppRole } from '@/lib/auth-routing';

// Types
export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: AppRole;
  is_active: boolean;
  provider: 'local' | 'google';
  google_id: string | null;
  avatar: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserDto {
  username: string;
  full_name: string;
  email?: string;
  role: AppRole;
  avatar?: string;
}

export interface CreateUserResponse {
  user: User;
  credentials: {
    username: string;
    password: string;
  };
}

export interface UpdateUserDto {
  username?: string;
  password?: string;
  full_name?: string;
  email?: string;
  is_active?: boolean;
  avatar?: string;
}

export interface UserConflict {
  username: string;
  conflict_field?: "username" | "email";
  conflict_value?: string;
  conflict_user: User;
  target_user: User;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface UserListResponse {
  users: User[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasMore: boolean;
  };
}

export interface UserStats {
  total: number;
  byRole: {
    admin: number;
    instructor: number;
    ta: number;
    student?: number;
  };
  byStatus: {
    active: number;
    inactive: number;
  };
}

class UserService {
  /**
   * Get list of users with pagination and filters
   */
  async getUsers(params?: UserListParams) {
    const queryParams: Record<string, string> = {};
    
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.search) queryParams.search = params.search;
    if (params?.role) queryParams.role = params.role;
    if (params?.status) queryParams.status = params.status;
    if (params?.sortBy) queryParams.sortBy = params.sortBy;
    if (params?.sortOrder) queryParams.sortOrder = params.sortOrder;

    return apiService.get<UserListResponse>(API_ENDPOINTS.USERS, { params: queryParams });
  }

  /**
   * Get user statistics
   */
  async getStats() {
    return apiService.get<UserStats>(`${API_ENDPOINTS.USERS}/stats`);
  }

  /**
   * Get single user by ID
   */
  async getUserById(id: number) {
    return apiService.get<User>(`${API_ENDPOINTS.USERS}/${id}`);
  }

  /**
   * Create new user (password will be auto-generated)
   */
  async createUser(data: CreateUserDto) {
    return apiService.post<CreateUserResponse>(API_ENDPOINTS.USERS, data);
  }

  /**
   * Update user
   */
  async updateUser(id: number, data: UpdateUserDto) {
    return apiService.put<User>(`${API_ENDPOINTS.USERS}/${id}`, data);
  }

  /**
   * Delete user
   */
  async deleteUser(id: number) {
    return apiService.delete(`${API_ENDPOINTS.USERS}/${id}`);
  }

  /**
   * Toggle user active status.
   * Pass force=true to resolve a username conflict (disables the conflicting active user).
   */
  async toggleStatus(id: number, force?: boolean) {
    const options = force ? { params: { force: 'true' } } : undefined;
    return apiService.patch<User>(`${API_ENDPOINTS.USERS}/${id}/status`, undefined, options);
  }
}

export const userService = new UserService();
export default userService;
