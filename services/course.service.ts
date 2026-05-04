/**
 * Course Service - API calls for Course Management
 */

import { apiService } from './api.service';
import { API_ENDPOINTS } from '@/config/api';

// Types
export interface Instructor {
  id: number;
  full_name: string;
  email: string | null;
  username: string;
  avatar: string | null;
  CourseInstructor?: {
    is_primary: boolean;
    assigned_at: string;
  };
}

export interface TA {
  id: number;
  full_name: string;
  email: string | null;
  username: string;
  avatar: string | null;
  CourseTA?: {
    assigned_at: string;
  };
}

export interface CourseSection {
  id: number;
  course_id: string;
  section_no: string;
  note: string | null;
  created_at: string;
  studentCount?: number;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  year: number;
  semester: number;
  instructor_id: number | null;
  description: string | null;
  image: string | null;
  is_active: boolean;
  attention_threshold: number;
  created_at: string;
  updated_at: string;
  instructor?: Instructor | null;
  sections?: CourseSection[];
  tas?: TA[];
  taCount?: number;
  studentCount?: number;
  instructors?: Instructor[];
}

export interface CreateCourseDto {
  code: string;
  name: string;
  year: number;
  semester: number;
  instructor_id?: number | null;
  instructor_ids?: number[];
  description?: string;
  image?: string;
  attention_threshold?: number;
}

export interface UpdateCourseDto {
  code?: string;
  name?: string;
  year?: number;
  semester?: number;
  instructor_id?: number | null;
  instructor_ids?: number[];
  description?: string;
  image?: string;
  is_active?: boolean;
  attention_threshold?: number;
}

export interface CourseListParams {
  page?: number;
  limit?: number;
  search?: string;
  year?: number;
  semester?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CourseListResponse {
  courses: Course[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasMore: boolean;
  };
}

export interface CourseStats {
  total: number;
  byStatus: {
    active: number;
    inactive: number;
  };
  thisYear: number;
  years: number[];
}

export interface SectionStudent {
  id: number;
  student_id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  enrolled_at: string;
}

// Team Types
export interface TeamMember {
  id: number;
  student_id: string;
  full_name: string;
  email?: string | null;
  joined_at?: string;
}

export interface Team {
  id: number;
  name: string;
  group_type: 'permanent' | 'temporary';
  week_number: number | null;
  members: TeamMember[];
  created_at: string;
}

export interface CreateTeamDto {
  name: string;
  group_type: 'permanent' | 'temporary';
  week_number?: number;
  member_ids: number[];
}

export interface BulkCreateTeamDto {
  teams: Array<{
    name: string;
    member_ids: number[];
  }>;
  group_type: 'permanent' | 'temporary';
  week_number?: number;
}
export interface BulkCreateTeamsResponse {
  createdCount: number;
  teams: Array<{
    id: number;
    name: string;
    memberCount: number;
  }>;
}
export interface BulkAddStudentsResponse {
  addedCount: number;
  skippedCount: number;
  addedStudentIds: number[];
}

export interface MyCoursesStats {
  total: number;
  byStatus: {
    active: number;
    inactive: number;
  };
  years: number[];
}

// Course Overview Types
export interface OverviewStudent {
  id: number;
  student_id: string;
  full_name: string;
  email: string | null;
  section_id: number;
  section_no: string;
  totalScore: number;
  submissionCount: number;
  missedCount: number;
  percentage?: number;
  assignmentsGraded?: number;
}

export interface TAActivity {
  id: number;
  full_name: string;
  email: string | null;
  assignedAt: string;
  gradedCount: number;
  lastActive: string | null;
  avatar: string | null;
}

export interface OverviewAssignment {
  id: number;
  name: string;
  max_score: number;
  assignment_type: string;
  is_score_visible?: boolean;
  avgScore: number | null;
  scoredCount: number;
  notScoredCount: number;
  submittedRate: number;
}

export interface RecentActivity {
  id: number;
  type: string;
  description: string;
  score: number;
  user: {
    id: number;
    full_name: string;
    avatar: string | null;
  } | null;
  timestamp: string;
}

export interface ScoreDistribution {
  excellent: number;
  good: number;
  average: number;
  poor: number;
}

export interface AssignmentTypeStats {
  count: number;
  totalMaxScore: number;
  totalScored: number;
  totalExpected: number;
  progressRate: number;
}

export interface CourseOverviewSummary {
  totalStudents: number;
  totalSections: number;
  totalTAs: number;
  totalAssignments: number;
  totalMaxScore: number;
  submissionRate: number;
  attendanceRate: number;
  totalAttendanceSessions: number;
  averageScore: number;
  trend: 'up' | 'stable' | 'down' | null;
  trendValue: number;
}

export interface CourseOverview {
  summary: CourseOverviewSummary;
  topStudents: OverviewStudent[];
  lowPerformers: OverviewStudent[];
  taActivity: TAActivity[];
  assignments: OverviewAssignment[];
  assignmentStatsByType?: Record<string, AssignmentTypeStats>;
  recentActivities: RecentActivity[];
  scoreDistribution: ScoreDistribution;
}

class CourseService {
  /**
   * Get list of courses with pagination and filters
   */
  async getCourses(params?: CourseListParams) {
    const queryParams: Record<string, string> = {};
    
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.search && params.search.trim()) queryParams.search = params.search.trim();
    if (params?.year && !isNaN(params.year)) queryParams.year = params.year.toString();
    if (params?.semester && !isNaN(params.semester)) queryParams.semester = params.semester.toString();
    if (params?.status && params.status.trim()) queryParams.status = params.status.trim();
    if (params?.sortBy) queryParams.sortBy = params.sortBy;
    if (params?.sortOrder) queryParams.sortOrder = params.sortOrder;

    return apiService.get<CourseListResponse>(API_ENDPOINTS.COURSES.LIST, { params: queryParams });
  }

  /**
   * Get course statistics
   */
  async getStats() {
    return apiService.get<CourseStats>(API_ENDPOINTS.COURSES.STATS);
  }

  /**
   * Get single course by ID
   */
  async getCourseById(id: string) {
    return apiService.get<Course>(API_ENDPOINTS.COURSES.BY_ID(id));
  }

  /**
   * Create new course
   */
  async createCourse(data: CreateCourseDto) {
    return apiService.post<Course>(API_ENDPOINTS.COURSES.CREATE, data);
  }

  /**
   * Update course
   */
  async updateCourse(id: string, data: UpdateCourseDto) {
    return apiService.put<Course>(API_ENDPOINTS.COURSES.UPDATE(id), data);
  }

  /**
   * Delete course
   */
  async deleteCourse(id: string) {
    return apiService.delete(API_ENDPOINTS.COURSES.DELETE(id));
  }

  /**
   * Toggle course status
   */
  async toggleStatus(id: string) {
    return apiService.patch<Course>(API_ENDPOINTS.COURSES.TOGGLE_STATUS(id));
  }

  /**
   * Get instructors list for dropdown
   */
  async getInstructors() {
    return apiService.get<Instructor[]>(API_ENDPOINTS.COURSES.INSTRUCTORS);
  }

  /**
   * Get TAs list for dropdown
   */
  async getTAsList() {
    return apiService.get<TA[]>(API_ENDPOINTS.COURSES.TAS_LIST);
  }

  /**
   * Get my courses (for instructor/TA)
   */
  async getMyCourses(params?: CourseListParams) {
    const queryParams: Record<string, string> = {};
    
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.search && params.search.trim()) queryParams.search = params.search.trim();
    if (params?.year && !isNaN(params.year)) queryParams.year = params.year.toString();
    if (params?.semester && !isNaN(params.semester)) queryParams.semester = params.semester.toString();
    if (params?.status && params.status.trim()) queryParams.status = params.status.trim();
    if (params?.sortBy) queryParams.sortBy = params.sortBy;
    if (params?.sortOrder) queryParams.sortOrder = params.sortOrder;

    console.log('getMyCourses queryParams:', queryParams);

    return apiService.get<CourseListResponse>(API_ENDPOINTS.COURSES.MY_COURSES, { params: queryParams });
  }

  /**
   * Get my courses statistics (for instructor/TA)
   */
  async getMyCoursesStats() {
    return apiService.get<MyCoursesStats>(API_ENDPOINTS.COURSES.MY_COURSES_STATS);
  }

  // Section Management
  /**
   * Add section to course
   */
  async addSection(courseId: string, data: { section_no: string; note?: string }) {
    return apiService.post<CourseSection>(API_ENDPOINTS.COURSES.ADD_SECTION(courseId), data);
  }

  /**
   * Update section
   */
  async updateSection(courseId: string, sectionId: number, data: { section_no: string; note?: string }) {
    return apiService.put<CourseSection>(`/courses/${courseId}/sections/${sectionId}`, data);
  }

  /**
   * Remove section from course
   */
  async removeSection(courseId: string, sectionId: number) {
    return apiService.delete(API_ENDPOINTS.COURSES.REMOVE_SECTION(courseId, sectionId));
  }

  // TA Management
  /**
   * Add TA to course
   */
  async addTA(courseId: string, userId: number) {
    return apiService.post<TA>(API_ENDPOINTS.COURSES.ADD_TA(courseId), { user_id: userId });
  }

  /**
   * Add multiple TAs to course
   */
  async bulkAddTAs(courseId: string, userIds: number[]) {
    return apiService.post<{ added: TA[]; skipped: number }>(`/courses/${courseId}/tas/bulk`, { user_ids: userIds });
  }

  /**
   * Remove TA from course
   */
  async removeTA(courseId: string, userId: number) {
    return apiService.delete(API_ENDPOINTS.COURSES.REMOVE_TA(courseId, userId));
  }

  // Instructor Management in Courses
  /**
   * Add instructor to course
   */
  async addCourseInstructor(courseId: string, userId: number) {
    return apiService.post<Instructor>(`/courses/${courseId}/instructors`, { user_id: userId });
  }

  /**
   * Add multiple instructors to course
   */
  async bulkAddCourseInstructors(courseId: string, userIds: number[]) {
    return apiService.post<{ added: Instructor[]; skipped: number }>(`/courses/${courseId}/instructors/bulk`, { user_ids: userIds });
  }

  /**
   * Remove instructor from course
   */
  async removeCourseInstructor(courseId: string, userId: number) {
    return apiService.delete(`/courses/${courseId}/instructors/${userId}`);
  }

  // Student Management in Sections
  /**
   * Get students in section
   */
  async getSectionStudents(courseId: string, sectionId: number) {
    return apiService.get<SectionStudent[]>(API_ENDPOINTS.COURSES.SECTION_STUDENTS(courseId, sectionId));
  }

  /**
   * Add student to section
   */
  async addStudentToSection(courseId: string, sectionId: number, studentId: number) {
    return apiService.post(API_ENDPOINTS.COURSES.ADD_STUDENT(courseId, sectionId), { student_id: studentId });
  }

  /**
   * Bulk add students to section
   */
  async bulkAddStudentsToSection(courseId: string, sectionId: number, studentIds: number[]) {
    return apiService.post<BulkAddStudentsResponse>(`/courses/${courseId}/sections/${sectionId}/students/bulk`, { student_ids: studentIds });
  }

  /**
   * Remove student from section
   */
  async removeStudentFromSection(courseId: string, sectionId: number, studentId: number) {
    return apiService.delete(API_ENDPOINTS.COURSES.REMOVE_STUDENT(courseId, sectionId, studentId));
  }

  /**
   * Get course overview dashboard data
   */
  async getCourseOverview(courseId: string) {
    return apiService.get<CourseOverview>(API_ENDPOINTS.COURSES.OVERVIEW(courseId));
  }

  // ============================================
  // Team Management
  // ============================================

  /**
   * Get all teams for a course
   */
  async getTeams(courseId: string, type?: 'permanent' | 'temporary', weekNumber?: number) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (weekNumber) params.append('week', weekNumber.toString());
    const queryString = params.toString();
    return apiService.get<Team[]>(`/courses/${courseId}/teams${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Create a new team
   */
  async createTeam(courseId: string, data: CreateTeamDto) {
    return apiService.post<Team>(`/courses/${courseId}/teams`, data);
  }

  /**
   * Bulk create teams (for random formation)
   */
  async bulkCreateTeams(courseId: string, data: BulkCreateTeamDto) {
    return apiService.post<BulkCreateTeamsResponse>(`/courses/${courseId}/teams/bulk`, data);
  }

  /**
   * Update a team
   */
  async updateTeam(courseId: string, teamId: number, data: { name?: string; member_ids?: number[] }) {
    return apiService.put<Team>(`/courses/${courseId}/teams/${teamId}`, data);
  }

  /**
   * Delete a team
   */
  async deleteTeam(courseId: string, teamId: number) {
    return apiService.delete(`/courses/${courseId}/teams/${teamId}`);
  }

  /**
   * Bulk delete teams
   */
  async bulkDeleteTeams(courseId: string, teamIds: number[]) {
    return apiService.post<{ deletedCount: number }>(`/courses/${courseId}/teams/bulk-delete`, { team_ids: teamIds });
  }

  /**
   * Add member to team
   */
  async addMemberToTeam(courseId: string, teamId: number, studentId: number) {
    return apiService.post(`/courses/${courseId}/teams/${teamId}/members`, { student_id: studentId });
  }

  /**
   * Remove member from team
   */
  async removeMemberFromTeam(courseId: string, teamId: number, studentId: number) {
    return apiService.delete(`/courses/${courseId}/teams/${teamId}/members/${studentId}`);
  }
}

export const courseService = new CourseService();
