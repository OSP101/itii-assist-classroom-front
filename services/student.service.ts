/**
 * Student Service - API calls for Student Management
 */

import { apiService } from './api.service';
import { API_ENDPOINTS } from '@/config/api';

// Types
export interface Student {
  id: number;
  student_id: string;
  full_name: string;
  email: string | null;
  extra: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateStudentDto {
  student_id: string;
  full_name: string;
  email?: string;
  extra?: Record<string, unknown>;
}

export interface UpdateStudentDto {
  student_id?: string;
  full_name?: string;
  email?: string;
  extra?: Record<string, unknown>;
  is_active?: boolean;
}

export interface StudentListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface StudentListResponse {
  students: Student[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasMore: boolean;
  };
}

export interface StudentStats {
  total: number;
  byStatus: {
    active: number;
    inactive: number;
  };
}

export interface ImportResult {
  created: number;
  skipped: number;
  failed: number;
  duplicates: Array<{ student_id: string; full_name: string }>;
  errors: Array<{ student_id: string; error: string }>;
}

// Student Score Lookup types
export interface AssignmentSubItemScore {
  id: number;
  name: string;
  max_score: number;
  score: number | null;
  grader: string | null;
  graded_at: string | null;
}

export interface AssignmentScore {
  id: number;
  title: string;
  type: string;
  max_score: number;
  score: number | null;
  status: 'pending' | 'graded';
  grader: string | null;
  graded_at: string | null;
  comment: string | null;
  graded_via: 'queue' | 'direct' | null;
  sub_items: AssignmentSubItemScore[];
  is_group_assignment?: boolean;
  group_info?: {
    id: number;
    name: string;
  } | null;
}

export interface AttendanceRecordData {
  id: number;
  session_title: string;
  date: string;
  status: 'present' | 'late' | 'leave' | 'absent';
  check_in_time: string | null;
  note: string | null;
}

export interface AttendanceSummary {
  present: number;
  late: number;
  leave: number;
  absent: number;
}

export interface BonusScoreRecord {
  score: number;
  reason: string;
  given_by: string | null;
  given_at: string;
}

export interface BonusScoreData {
  total: number;
  records: BonusScoreRecord[];
}

export interface ExamScoreData {
  id: number;
  exam_type: 'midterm' | 'final';
  component: 'lab' | 'lecture';
  score: number | null;
  max_score: number;
  grader: string | null;
  graded_at: string | null;
  comment: string | null;
}

export interface CourseScoreData {
  course: {
    id: string;
    code: string;
    name: string;
    year: number;
    semester: number;
    image: string | null;
    cover_position_x: number;
    cover_position_y: number;
    cover_zoom: number;
    is_active: boolean;
    sections: Array<{ id: number; section_no?: string; name?: string; week_number?: number | null }>;
  };
  assignments: AssignmentScore[];
  totalScore: number;
  totalMaxScore: number;
  progress: number;
  bonusScore: BonusScoreData;
  attendance: {
    records: AttendanceRecordData[];
    summary: AttendanceSummary;
  };
  examScores: ExamScoreData[];
}

export interface StudentQueueOverviewSession {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'paused';
  require_attendance: boolean;
  linked_assignment_id?: number | null;
  linked_attendance_session_id?: number | null;
  cutoff_at?: string | null;
  cutoff_note?: string;
  classroom?: {
    id: string;
    name: string;
    building: string;
    floor?: string;
  } | null;
  linkedAssignment?: {
    id: number;
    name: string;
    max_score: string;
  } | null;
  linkedAttendanceSession?: {
    id: number;
    title: string;
  } | null;
  stats: {
    total: number;
    waiting: number;
    in_progress: number;
    completed: number;
  };
  my_booking?: {
    id: number;
    queue_number: number;
    booking_type: 'grading' | 'help';
    status: 'waiting' | 'in_progress';
    desk_id: string;
    desk_number: number;
    note?: string;
    assigned_at?: string | null;
    started_at?: string | null;
    created_at: string;
  } | null;
}

export interface StudentScoreLookupResponse {
  student: {
    id: number;
    student_id: string;
    full_name: string;
    email: string | null;
  };
  courses: CourseScoreData[];
}

export interface MyStudentCourseResponse {
  student: StudentScoreLookupResponse['student'];
  course: CourseScoreData;
  queue: {
    sessions: StudentQueueOverviewSession[];
  };
}

class StudentService {
  /**
   * Get list of students with pagination and filters
   */
  async getStudents(params?: StudentListParams) {
    const queryParams: Record<string, string> = {};
    
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.search) queryParams.search = params.search;
    if (params?.status) queryParams.status = params.status;
    if (params?.sortBy) queryParams.sortBy = params.sortBy;
    if (params?.sortOrder) queryParams.sortOrder = params.sortOrder;

    return apiService.get<StudentListResponse>(API_ENDPOINTS.STUDENTS, { params: queryParams });
  }

  /**
   * Get student statistics
   */
  async getStats() {
    return apiService.get<StudentStats>(`${API_ENDPOINTS.STUDENTS}/stats`);
  }

  /**
   * Get single student by ID
   */
  async getStudentById(id: number) {
    return apiService.get<Student>(`${API_ENDPOINTS.STUDENTS}/${id}`);
  }

  /**
   * Create new student
   */
  async createStudent(data: CreateStudentDto) {
    return apiService.post<Student>(API_ENDPOINTS.STUDENTS, data);
  }

  /**
   * Update student
   */
  async updateStudent(id: number, data: UpdateStudentDto) {
    return apiService.put<Student>(`${API_ENDPOINTS.STUDENTS}/${id}`, data);
  }

  /**
   * Delete student
   */
  async deleteStudent(id: number) {
    return apiService.delete(`${API_ENDPOINTS.STUDENTS}/${id}`);
  }

  /**
   * Toggle student active status
   */
  async toggleStatus(id: number) {
    return apiService.patch<Student>(`${API_ENDPOINTS.STUDENTS}/${id}/status`);
  }

  /**
   * Import students from array
   */
  async importStudents(students: CreateStudentDto[]) {
    return apiService.post<ImportResult>(`${API_ENDPOINTS.STUDENTS}/import`, { students });
  }

  /**
   * Lookup student scores by student_id (public endpoint)
   */
  async lookupStudentScores(studentId: string) {
    return apiService.get<StudentScoreLookupResponse>(`${API_ENDPOINTS.STUDENTS}/lookup/${studentId}`);
  }

  async getMyCourse(courseId: string) {
    return apiService.get<MyStudentCourseResponse>(`${API_ENDPOINTS.STUDENTS}/me/courses/${courseId}`);
  }

  /**
   * Search students by multiple student IDs within a specific course/section
   * @param studentIds - Array of student IDs to search
   * @param courseId - Optional course ID to filter by enrollment (string or number)
   * @param section - Optional section to filter (use 'all' for all sections in course)
   */
  async searchStudentsByIds(studentIds: string[], courseId?: string | number, section?: string) {
    return apiService.post<{
      found: Array<{
        input: string;
        student: {
          id: number;
          student_id: string;
          full_name: string;
          email: string | null;
        };
      }>;
      not_found: string[];
    }>(`${API_ENDPOINTS.STUDENTS}/search-by-ids`, { 
      student_ids: studentIds,
      course_id: courseId,
      section: section,
    });
  }
}

export const studentService = new StudentService();
export default studentService;
