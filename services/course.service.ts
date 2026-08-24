/**
 * Course Service - API calls for Course Management
 */

import { apiService } from './api.service';
import { API_ENDPOINTS } from '@/config/api';
import { csrfHeader } from '@/lib/csrf';
import { invalidateCourses } from '@/lib/swr/invalidate';

// Types
export interface CourseMemberPermissions {
  update_course: boolean;
  view_people: boolean;
  add_people: boolean;
  remove_people: boolean;
  edit_member_permissions: boolean;
  view_sections: boolean;
  create_sections: boolean;
  update_sections: boolean;
  delete_sections: boolean;
  manage_section_students: boolean;
  view_teams: boolean;
  create_teams: boolean;
  update_teams: boolean;
  delete_teams: boolean;
  manage_team_members: boolean;
  view_assignments: boolean;
  create_assignments: boolean;
  update_assignments: boolean;
  delete_assignments: boolean;
  grade_assignments: boolean;
  edit_scores: boolean;
  view_score_summary: boolean;
  view_exam_scores: boolean;
  create_exam_scores: boolean;
  update_exam_scores: boolean;
  delete_exam_scores: boolean;
  update_exam_settings: boolean;
  review_own_score_requests: boolean;
  review_all_score_requests: boolean;
  view_attendance: boolean;
  create_attendance_sessions: boolean;
  update_attendance_sessions: boolean;
  delete_attendance_sessions: boolean;
  update_attendance_status: boolean;
  view_queue: boolean;
  create_queue_sessions: boolean;
  update_queue_sessions: boolean;
  delete_queue_sessions: boolean;
  manage_queue_bookings: boolean;
}

export type CoursePermissionPreset = 'view_only' | 'ta_standard' | 'course_coordinator';

type LegacyCourseMemberPermissions = Partial<{
  manage_people: boolean;
  manage_sections: boolean;
  manage_teams: boolean;
  manage_assignments: boolean;
  grade_assignments: boolean;
  edit_scores: boolean;
  view_score_summary: boolean;
  view_exam_scores: boolean;
  manage_exam_scores: boolean;
  review_own_score_requests: boolean;
  review_all_score_requests: boolean;
  manage_attendance_sessions: boolean;
  update_attendance_status: boolean;
  manage_queue: boolean;
}>;

export const DEFAULT_INSTRUCTOR_COURSE_PERMISSIONS: CourseMemberPermissions = {
  update_course: true,
  view_people: true,
  add_people: true,
  remove_people: true,
  edit_member_permissions: true,
  view_sections: true,
  create_sections: true,
  update_sections: true,
  delete_sections: true,
  manage_section_students: true,
  view_teams: true,
  create_teams: true,
  update_teams: true,
  delete_teams: true,
  manage_team_members: true,
  view_assignments: true,
  create_assignments: true,
  update_assignments: true,
  delete_assignments: true,
  grade_assignments: true,
  edit_scores: true,
  view_score_summary: true,
  view_exam_scores: true,
  create_exam_scores: true,
  update_exam_scores: true,
  delete_exam_scores: true,
  update_exam_settings: true,
  review_own_score_requests: true,
  review_all_score_requests: true,
  view_attendance: true,
  create_attendance_sessions: true,
  update_attendance_sessions: true,
  delete_attendance_sessions: true,
  update_attendance_status: true,
  view_queue: true,
  create_queue_sessions: true,
  update_queue_sessions: true,
  delete_queue_sessions: true,
  manage_queue_bookings: true,
};

export const DEFAULT_TA_COURSE_PERMISSIONS: CourseMemberPermissions = {
  update_course: false,
  view_people: false,
  add_people: false,
  remove_people: false,
  edit_member_permissions: false,
  view_sections: false,
  create_sections: false,
  update_sections: false,
  delete_sections: false,
  manage_section_students: false,
  view_teams: false,
  create_teams: false,
  update_teams: false,
  delete_teams: false,
  manage_team_members: false,
  view_assignments: true,
  create_assignments: true,
  update_assignments: true,
  delete_assignments: false,
  grade_assignments: true,
  edit_scores: true,
  view_score_summary: true,
  view_exam_scores: false,
  create_exam_scores: false,
  update_exam_scores: false,
  delete_exam_scores: false,
  update_exam_settings: false,
  review_own_score_requests: true,
  review_all_score_requests: false,
  view_attendance: true,
  create_attendance_sessions: true,
  update_attendance_sessions: true,
  delete_attendance_sessions: true,
  update_attendance_status: false,
  view_queue: true,
  create_queue_sessions: true,
  update_queue_sessions: true,
  delete_queue_sessions: true,
  manage_queue_bookings: true,
};

export const EMPTY_COURSE_MEMBER_PERMISSIONS: CourseMemberPermissions = {
  update_course: false,
  view_people: false,
  add_people: false,
  remove_people: false,
  edit_member_permissions: false,
  view_sections: false,
  create_sections: false,
  update_sections: false,
  delete_sections: false,
  manage_section_students: false,
  view_teams: false,
  create_teams: false,
  update_teams: false,
  delete_teams: false,
  manage_team_members: false,
  view_assignments: false,
  create_assignments: false,
  update_assignments: false,
  delete_assignments: false,
  grade_assignments: false,
  edit_scores: false,
  view_score_summary: false,
  view_exam_scores: false,
  create_exam_scores: false,
  update_exam_scores: false,
  delete_exam_scores: false,
  update_exam_settings: false,
  review_own_score_requests: false,
  review_all_score_requests: false,
  view_attendance: false,
  create_attendance_sessions: false,
  update_attendance_sessions: false,
  delete_attendance_sessions: false,
  update_attendance_status: false,
  view_queue: false,
  create_queue_sessions: false,
  update_queue_sessions: false,
  delete_queue_sessions: false,
  manage_queue_bookings: false,
};

export type CourseMemberRole = 'instructor' | 'ta';

export function buildCoursePermissionPreset(
  role: CourseMemberRole,
  preset: CoursePermissionPreset,
): CourseMemberPermissions {
  if (preset === 'view_only') {
    return {
      ...EMPTY_COURSE_MEMBER_PERMISSIONS,
      view_people: true,
      view_sections: true,
      view_teams: true,
      view_assignments: true,
      view_score_summary: true,
      view_exam_scores: true,
      view_attendance: true,
      view_queue: true,
    };
  }

  if (preset === 'ta_standard') {
    return { ...DEFAULT_TA_COURSE_PERMISSIONS };
  }

  if (role === 'instructor') {
    return { ...DEFAULT_INSTRUCTOR_COURSE_PERMISSIONS };
  }

  return {
    ...DEFAULT_INSTRUCTOR_COURSE_PERMISSIONS,
    view_people: true,
    add_people: false,
    remove_people: false,
    edit_member_permissions: false,
  };
}


export function resolveCourseMemberPermissions(
  role: CourseMemberRole,
  permissions?: (Partial<CourseMemberPermissions> & LegacyCourseMemberPermissions) | null,
  isPrimary = false,
): CourseMemberPermissions {
  const base = role === 'instructor'
    ? DEFAULT_INSTRUCTOR_COURSE_PERMISSIONS
    : DEFAULT_TA_COURSE_PERMISSIONS;

  if (role === 'instructor' && isPrimary) {
    return { ...DEFAULT_INSTRUCTOR_COURSE_PERMISSIONS };
  }

  const resolved: CourseMemberPermissions = {
    ...base,
    ...(permissions || {}),
  };

  if (permissions?.manage_people !== undefined) {
    resolved.view_people = permissions.manage_people;
    resolved.add_people = permissions.manage_people;
    resolved.remove_people = permissions.manage_people;
    resolved.edit_member_permissions = permissions.manage_people;
  }
  if (permissions?.manage_sections !== undefined) {
    resolved.view_sections = permissions.manage_sections;
    resolved.create_sections = permissions.manage_sections;
    resolved.update_sections = permissions.manage_sections;
    resolved.delete_sections = permissions.manage_sections;
    resolved.manage_section_students = permissions.manage_sections;
  }
  if (permissions?.manage_teams !== undefined) {
    resolved.view_teams = permissions.manage_teams;
    resolved.create_teams = permissions.manage_teams;
    resolved.update_teams = permissions.manage_teams;
    resolved.delete_teams = permissions.manage_teams;
    resolved.manage_team_members = permissions.manage_teams;
  }
  if (permissions?.manage_assignments !== undefined) {
    resolved.view_assignments = permissions.manage_assignments;
    resolved.create_assignments = permissions.manage_assignments;
    resolved.update_assignments = permissions.manage_assignments;
    resolved.delete_assignments = permissions.manage_assignments;
  }
  if (permissions?.manage_exam_scores !== undefined) {
    resolved.view_exam_scores = permissions.manage_exam_scores;
    resolved.create_exam_scores = permissions.manage_exam_scores;
    resolved.update_exam_scores = permissions.manage_exam_scores;
    resolved.delete_exam_scores = permissions.manage_exam_scores;
    resolved.update_exam_settings = permissions.manage_exam_scores;
  }
  if (permissions?.manage_attendance_sessions !== undefined) {
    resolved.view_attendance = permissions.manage_attendance_sessions;
    resolved.create_attendance_sessions = permissions.manage_attendance_sessions;
    resolved.update_attendance_sessions = permissions.manage_attendance_sessions;
    resolved.delete_attendance_sessions = permissions.manage_attendance_sessions;
  }
  if (permissions?.manage_queue !== undefined) {
    resolved.view_queue = permissions.manage_queue;
    resolved.create_queue_sessions = permissions.manage_queue;
    resolved.update_queue_sessions = permissions.manage_queue;
    resolved.delete_queue_sessions = permissions.manage_queue;
    resolved.manage_queue_bookings = permissions.manage_queue;
  }

  if (resolved.add_people || resolved.remove_people || resolved.edit_member_permissions) {
    resolved.view_people = true;
  }
  if (resolved.create_sections || resolved.update_sections || resolved.delete_sections || resolved.manage_section_students) {
    resolved.view_sections = true;
  }
  if (resolved.create_teams || resolved.update_teams || resolved.delete_teams || resolved.manage_team_members) {
    resolved.view_teams = true;
  }
  if (resolved.create_assignments || resolved.update_assignments || resolved.delete_assignments || resolved.grade_assignments || resolved.edit_scores) {
    resolved.view_assignments = true;
  }

  if (resolved.review_all_score_requests) {
    resolved.review_own_score_requests = true;
  }
  if (resolved.create_exam_scores || resolved.update_exam_scores || resolved.delete_exam_scores || resolved.update_exam_settings) {
    resolved.view_exam_scores = true;
  }
  if (resolved.create_attendance_sessions || resolved.update_attendance_sessions || resolved.delete_attendance_sessions || resolved.update_attendance_status) {
    resolved.view_attendance = true;
  }
  if (resolved.create_queue_sessions || resolved.update_queue_sessions || resolved.delete_queue_sessions || resolved.manage_queue_bookings) {
    resolved.view_queue = true;
  }

  return resolved;
}

export function getCurrentCourseMemberPermissions(
  course: Pick<Course, 'instructors' | 'tas'> | null | undefined,
  currentUserId: number | null,
  userRole?: string,
): CourseMemberPermissions {
  if (userRole === 'admin') {
    return { ...DEFAULT_INSTRUCTOR_COURSE_PERMISSIONS };
  }

  if (currentUserId && course?.instructors) {
    const instructor = course.instructors.find((member) => member.id === currentUserId);
    if (instructor) {
      return resolveCourseMemberPermissions(
        'instructor',
        instructor.CourseInstructor?.permissions,
        instructor.CourseInstructor?.is_primary,
      );
    }
  }

  if (currentUserId && course?.tas) {
    const ta = course.tas.find((member) => member.id === currentUserId);
    if (ta) {
      return resolveCourseMemberPermissions('ta', ta.CourseTA?.permissions);
    }
  }

  if (userRole === 'instructor') {
    return { ...DEFAULT_INSTRUCTOR_COURSE_PERMISSIONS };
  }

  return { ...DEFAULT_TA_COURSE_PERMISSIONS };
}

export interface Instructor {
  id: number;
  full_name: string;
  email: string | null;
  username: string;
  avatar: string | null;
  CourseInstructor?: {
    is_primary: boolean;
    assigned_at: string;
    permissions: CourseMemberPermissions;
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
    permissions: CourseMemberPermissions;
  };
}

export interface CreateCourseTAAccountDto {
  username: string;
  full_name: string;
  email?: string;
  avatar?: string;
}

export interface CreateCourseTAAccountResponse {
  user: TA;
  credentials: {
    username: string;
    password: string;
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

export interface StudentCourseGroupMember {
  id: number;
  student_id: string;
  full_name: string;
}

export interface StudentCourseGroup {
  id: number;
  name: string;
  group_type: 'permanent' | 'temporary';
  week_number: number | null;
  members: StudentCourseGroupMember[];
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
  cover_position_x: number;
  cover_position_y: number;
  cover_zoom: number;
  is_active: boolean;
  attention_threshold: number;
  created_at: string;
  updated_at: string;
  instructor?: Instructor | null;
  sections?: CourseSection[];
  tas?: TA[];
  taCount?: number;
  studentCount?: number;
  my_section_no?: string;
  my_groups?: StudentCourseGroup[];
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
  cover_position_x?: number;
  cover_position_y?: number;
  cover_zoom?: number;
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
  cover_position_x?: number;
  cover_position_y?: number;
  cover_zoom?: number;
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

export interface CourseActivationConflict {
  conflict_type: string;
  course_code: string;
  year: number;
  semester: number;
  active_course_id: string;
  active_course_name: string;
  inactive_course_id: string;
  inactive_course_name: string;
}

export interface CourseConflictListResponse {
  items: CourseActivationConflict[];
  total: number;
}

export interface SectionStudent {
  id: number;
  student_id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  enrolled_at: string;
}

export interface RemovedSectionStudent {
  removal_id: number;
  section_id: number;
  section_no: string;
  student_ref_id: number;
  student_id: string;
  full_name: string;
  removed_at: string;
  restore_until: string;
  remaining_days: number;
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
  added: number;
  moved: number;
  skipped: number;
  conflicts: Array<{
    student_id: number;
    current_section_id: number;
    current_section_no: string;
  }>;
}

export interface MoveStudentResponse {
  from_section_id: number;
  to_section_id: number;
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
   * Wraps a mutating call so the SWR cache is refreshed once it succeeds.
   *
   * Invalidation lives here rather than at each call site because there are
   * dozens of them across the app: a missed one is invisible — the request goes
   * through, the server is updated, and the user keeps looking at the old value
   * until something else happens to trigger a refetch. Doing it in the service
   * means every caller, including future ones, gets it for free.
   *
   * Only successful writes invalidate: a failed request changed nothing, so
   * throwing away good cache would just cost a needless round trip.
   */
  private async afterWrite<T extends { success: boolean }>(
    call: Promise<T>,
  ): Promise<T> {
    const response = await call;
    if (response.success) {
      void invalidateCourses();
    }
    return response;
  }

  private normalizeCourse(course: Course): Course {
    return {
      ...course,
      sections: course.sections?.map((section: CourseSection & { student_count?: number }) => ({
        ...section,
        studentCount: section.studentCount ?? section.student_count ?? 0,
      })) || [],
    };
  }

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
   * Get activation conflicts where inactive courses collide with active ones
   */
  async getConflicts(params?: { search?: string; year?: number; semester?: number; limit?: number }) {
    const queryParams: Record<string, string> = {};

    if (params?.search && params.search.trim()) queryParams.search = params.search.trim();
    if (params?.year && !isNaN(params.year)) queryParams.year = params.year.toString();
    if (params?.semester && !isNaN(params.semester)) queryParams.semester = params.semester.toString();
    if (params?.limit && !isNaN(params.limit)) queryParams.limit = params.limit.toString();

    return apiService.get<CourseConflictListResponse>(API_ENDPOINTS.COURSES.CONFLICTS, { params: queryParams });
  }

  async bulkToggle(courseIds: string[], action: 'enable' | 'disable') {
    return this.afterWrite(apiService.patch<{ toggled: number; skipped: number }>(
      API_ENDPOINTS.COURSES.BULK_TOGGLE,
      { course_ids: courseIds, action },
    ));
  }

  async bulkDelete(courseIds: string[]) {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const url = `${API_BASE}${API_ENDPOINTS.COURSES.BULK_DELETE}`;
    const res = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Type': 'web',
        ...csrfHeader(),
      },
      body: JSON.stringify({ course_ids: courseIds }),
    });
    if (!res.ok) throw new Error('Bulk delete failed');
    const data = await res.json() as { success: boolean; data?: { deleted: number } };
    // Uses raw fetch rather than apiService, so it cannot go through
    // afterWrite() like the other mutations — invalidated explicitly instead.
    if (data.success) {
      void invalidateCourses();
    }
    return data;
  }

  async exportCSV(params?: { search?: string; year?: number; semester?: number; status?: string }) {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.year) query.set('year', String(params.year));
    if (params?.semester) query.set('semester', String(params.semester));
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    const url = `${API_BASE}${API_ENDPOINTS.COURSES.EXPORT}${query.toString() ? '?' + query.toString() : ''}`;
    const res = await fetch(url, { credentials: 'include', headers: { 'X-Client-Type': 'web' } });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `courses_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /**
   * Get single course by ID
   */
  async getCourseById(id: string) {
    const response = await apiService.get<Course>(API_ENDPOINTS.COURSES.BY_ID(id));
    if (response.success && response.data) {
      response.data = this.normalizeCourse(response.data);
    }
    return response;
  }

  /**
   * Create new course
   */
  async createCourse(data: CreateCourseDto) {
    return this.afterWrite(apiService.post<Course>(API_ENDPOINTS.COURSES.CREATE, data));
  }

  /**
   * Update course
   */
  async updateCourse(id: string, data: UpdateCourseDto) {
    return this.afterWrite(apiService.put<Course>(API_ENDPOINTS.COURSES.UPDATE(id), data));
  }

  /**
   * Delete course
   */
  async deleteCourse(id: string) {
    return this.afterWrite(apiService.delete(API_ENDPOINTS.COURSES.DELETE(id)));
  }

  /**
   * Toggle course status
   */
  async toggleStatus(id: string) {
    return this.afterWrite(apiService.patch<Course>(API_ENDPOINTS.COURSES.TOGGLE_STATUS(id)));
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
    return this.afterWrite(apiService.post<CourseSection>(API_ENDPOINTS.COURSES.ADD_SECTION(courseId), data));
  }

  /**
   * Update section
   */
  async updateSection(courseId: string, sectionId: number, data: { section_no: string; note?: string }) {
    return this.afterWrite(apiService.put<CourseSection>(`/courses/${courseId}/sections/${sectionId}`, data));
  }

  /**
   * Remove section from course
   */
  async removeSection(courseId: string, sectionId: number) {
    return this.afterWrite(apiService.delete(API_ENDPOINTS.COURSES.REMOVE_SECTION(courseId, sectionId)));
  }

  // TA Management
  /**
   * Add TA to course
   */
  async addTA(courseId: string, userId: number) {
    return this.afterWrite(apiService.post<TA>(API_ENDPOINTS.COURSES.ADD_TA(courseId), { user_id: userId }));
  }

  async createTAAccount(courseId: string, data: CreateCourseTAAccountDto) {
    return this.afterWrite(apiService.post<CreateCourseTAAccountResponse>(API_ENDPOINTS.COURSES.CREATE_TA_ACCOUNT(courseId), data));
  }

  /**
   * Add multiple TAs to course
   */
  async bulkAddTAs(courseId: string, userIds: number[]) {
    return this.afterWrite(apiService.post<{ added: TA[]; skipped: number }>(`/courses/${courseId}/tas/bulk`, { user_ids: userIds }));
  }

  /**
   * Remove TA from course
   */
  async removeTA(courseId: string, userId: number) {
    return this.afterWrite(apiService.delete(API_ENDPOINTS.COURSES.REMOVE_TA(courseId, userId)));
  }

  async updateTAPermissions(courseId: string, userId: number, permissions: CourseMemberPermissions) {
    return this.afterWrite(apiService.patch(`/courses/${courseId}/tas/${userId}/permissions`, { permissions }));
  }

  // Instructor Management in Courses
  /**
   * Add instructor to course
   */
  async addCourseInstructor(courseId: string, userId: number) {
    return this.afterWrite(apiService.post<Instructor>(`/courses/${courseId}/instructors`, { user_id: userId }));
  }

  /**
   * Add multiple instructors to course
   */
  async bulkAddCourseInstructors(courseId: string, userIds: number[]) {
    return this.afterWrite(apiService.post<{ added: Instructor[]; skipped: number }>(`/courses/${courseId}/instructors/bulk`, { user_ids: userIds }));
  }

  /**
   * Remove instructor from course
   */
  async removeCourseInstructor(courseId: string, userId: number) {
    return this.afterWrite(apiService.delete(`/courses/${courseId}/instructors/${userId}`));
  }

  async updateCourseInstructorPermissions(courseId: string, userId: number, permissions: CourseMemberPermissions) {
    return this.afterWrite(apiService.patch(`/courses/${courseId}/instructors/${userId}/permissions`, { permissions }));
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
    return this.afterWrite(apiService.post(API_ENDPOINTS.COURSES.ADD_STUDENT(courseId, sectionId), { student_id: studentId }));
  }

  /**
   * Move student between sections
   */
  async moveStudentToSection(courseId: string, fromSectionId: number, studentId: number, targetSectionId: number) {
    return apiService.post<MoveStudentResponse>(API_ENDPOINTS.COURSES.MOVE_STUDENT(courseId, fromSectionId, studentId), {
      target_section_id: targetSectionId,
    });
  }

  /**
   * Bulk add students to section
   */
  async bulkAddStudentsToSection(
    courseId: string,
    sectionId: number,
    studentIds: number[],
    resolveConflicts: "skip" | "move" = "skip"
  ) {
    return this.afterWrite(apiService.post<BulkAddStudentsResponse>(`/courses/${courseId}/sections/${sectionId}/students/bulk`, {
      student_ids: studentIds,
      resolve_conflicts: resolveConflicts,
    }));
  }

  /**
   * Remove student from section
   */
  async removeStudentFromSection(courseId: string, sectionId: number, studentId: number) {
    return this.afterWrite(apiService.delete(API_ENDPOINTS.COURSES.REMOVE_STUDENT(courseId, sectionId, studentId)));
  }

  /**
   * Get students removed from sections but still restorable
   */
  async getRemovedStudents(courseId: string, sectionId?: number) {
    const endpoint = API_ENDPOINTS.COURSES.REMOVED_STUDENTS(courseId);
    const params = sectionId ? { section_id: sectionId.toString() } : undefined;
    return apiService.get<RemovedSectionStudent[]>(endpoint, { params });
  }

  /**
   * Restore student back to section within retention window
   */
  async restoreStudentToSection(courseId: string, sectionId: number, studentId: number) {
    return apiService.post(API_ENDPOINTS.COURSES.RESTORE_STUDENT(courseId, sectionId, studentId));
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
