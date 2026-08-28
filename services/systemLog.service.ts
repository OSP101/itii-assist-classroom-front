/**
 * System Logs Service - API calls for System Logs Management
 * ระบบบันทึก Log ตามมาตรฐาน พ.ร.บ. คอมพิวเตอร์ พ.ศ. 2550
 */

import api from './api.service';

// Types
export type LogType = 'access' | 'error' | 'auth' | 'security';
export type SeverityLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface SystemLog {
  id: number;
  log_type: LogType;
  severity: SeverityLevel;
  actor_user_id: number | null;
  session_id: string | null;
  auth_method: string | null;
  action: string;
  http_method: string | null;
  url: string | null;
  query_params: Record<string, unknown> | null;
  status_code: number | null;
  response_time_ms: number | null;
  detail: Record<string, unknown> | null;
  error_message: string | null;
  error_stack: string | null;
  error_code: string | null;
  resource_type: string | null;
  resource_id: string | null;
  request_body: Record<string, unknown> | null;
  request_size: number | null;
  response_size: number | null;
  ip_address: string | null;
  user_agent: string | null;
  referer: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  created_at: string;
  actor_user?: {
    id: number;
    email: string;
    full_name: string;
    role: string;
  };
  actor_student?: {
    id: number;
    student_no: string;
    full_name: string;
    email: string;
  };
}

export interface LogsFilter {
  log_type?: LogType;
  severity?: SeverityLevel;
  user_id?: number;
  action_group?: 'permission_changes' | 'member_changes' | 'feedback_actions' | 'course_governance';
  privileged_only?: boolean;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LogStats {
  total: number;
  uniqueIps: number;
  byType: Array<{ log_type: LogType; count: number }>;
  bySeverity: Array<{ severity: SeverityLevel; count: number }>;
  byActionGroup: Array<{ key: 'permission_changes' | 'member_changes' | 'feedback_actions' | 'course_governance'; count: number }>;
  byStatusCode: Array<{ status_code: number; count: number }>;
}

export interface TimelineData {
  timeline: Array<{
    time_bucket: string;
    log_type: LogType;
    count: number;
  }>;
  interval: string;
  startDate: string;
  endDate: string;
}

export interface FilterOptions {
  logTypes: LogType[];
  severityLevels: SeverityLevel[];
  httpMethods: string[];
}

// API Functions

/**
 * Get system logs with filters and pagination
 */
export const getLogs = async (filters: LogsFilter = {}) => {
  const params = new URLSearchParams();
  
  if (filters.log_type) params.append('log_type', filters.log_type);
  if (filters.severity) params.append('severity', filters.severity);
  if (filters.user_id) params.append('user_id', String(filters.user_id));
  if (filters.action_group) params.append('action_group', filters.action_group);
  if (filters.privileged_only) params.append('privileged_only', 'true');
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.search) params.append('search', filters.search);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.sort_by) params.append('sort_by', filters.sort_by);
  if (filters.sort_order) params.append('sort_order', filters.sort_order);
  
  const queryString = params.toString();
  const url = queryString ? `/logs?${queryString}` : '/logs';
  
  return api.get<{
    logs: SystemLog[];
    pagination: Pagination;
  }>(url);
};

/**
 * Get single log by ID
 */
export const getLogById = async (id: number) => {
  return api.get<SystemLog>(`/logs/${id}`);
};

/**
 * Get log statistics
 */
export const getLogStats = async (startDate?: string, endDate?: string, privilegedOnly?: boolean) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (privilegedOnly) params.append('privileged_only', 'true');
  
  const queryString = params.toString();
  const url = queryString ? `/logs/stats?${queryString}` : '/logs/stats';
  
  return api.get<LogStats>(url);
};

/**
 * Get logs timeline for charts
 */
export const getLogsTimeline = async (
  startDate?: string,
  endDate?: string,
  interval: 'hour' | 'day' | 'week' = 'hour',
  logType?: LogType,
  privilegedOnly?: boolean
) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  params.append('interval', interval);
  if (logType) params.append('log_type', logType);
  if (privilegedOnly) params.append('privileged_only', 'true');
  
  return api.get<TimelineData>(`/logs/timeline?${params.toString()}`);
};

/**
 * Get filter options (log types, severity levels, etc.)
 */
export const getFilterOptions = async () => {
  return api.get<FilterOptions>('/logs/filters');
};

/**
 * Export logs as CSV
 */
export const exportLogs = async (filters: LogsFilter = {}) => {
  const params = new URLSearchParams();
  
  if (filters.log_type) params.append('log_type', filters.log_type);
  if (filters.severity) params.append('severity', filters.severity);
  if (filters.user_id) params.append('user_id', String(filters.user_id));
  if (filters.action_group) params.append('action_group', filters.action_group);
  if (filters.privileged_only) params.append('privileged_only', 'true');
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.search) params.append('search', filters.search);
  
  const queryString = params.toString();
  const url = queryString ? `/logs/export?${queryString}` : '/logs/export';
  
  // Get the CSV data
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}${url}`, {
    credentials: 'include',
    headers: {
      'X-Client-Type': 'web',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to export logs');
  }
  
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `system_logs_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
};

/**
 * Get recent error logs
 */
export const getRecentErrors = async (limit: number = 10) => {
  return api.get<SystemLog[]>(`/logs/errors/recent?limit=${limit}`);
};

/**
 * Get recent security events
 */
export const getRecentSecurityEvents = async (limit: number = 10) => {
  return api.get<SystemLog[]>(`/logs/security/recent?limit=${limit}`);
};

/**
 * Cleanup old logs (manual trigger)
 */
export const cleanupLogs = async (retentionDays: number = 90, stepUpToken?: string) => {
  return api.post<{ deletedCount: number; cutoffDate: string }>(
    '/logs/cleanup',
    {
      retention_days: retentionDays,
    },
    stepUpToken ? { headers: { 'X-Step-Up-Token': stepUpToken } } : undefined,
  );
};

export const isPrivilegedSystemLog = (log: SystemLog): boolean => {
  return Boolean(log.detail && log.detail.privileged_action === true);
};

export const getSystemLogRiskLevel = (log: SystemLog): string | null => {
  const value = log.detail?.risk_level;
  return typeof value === 'string' ? value : null;
};

// Helper functions

/**
 * Get badge color for log type
 */
export const getLogTypeBadgeColor = (logType: LogType): 'primary' | 'danger' | 'warning' | 'secondary' => {
  switch (logType) {
    case 'access':
      return 'primary';
    case 'error':
      return 'danger';
    case 'auth':
      return 'warning';
    case 'security':
      return 'secondary';
    default:
      return 'primary';
  }
};

/**
 * Get badge color for severity level
 */
export const getSeverityBadgeColor = (severity: SeverityLevel): 'default' | 'primary' | 'warning' | 'danger' => {
  switch (severity) {
    case 'debug':
      return 'default';
    case 'info':
      return 'primary';
    case 'warn':
      return 'warning';
    case 'error':
    case 'critical':
      return 'danger';
    default:
      return 'default';
  }
};

/**
 * Get label for log type (Thai)
 */
export const getLogTypeLabel = (logType: LogType): string => {
  switch (logType) {
    case 'access':
      return 'การเข้าถึง';
    case 'error':
      return 'ข้อผิดพลาด';
    case 'auth':
      return 'การยืนยันตัวตน';
    case 'security':
      return 'ความปลอดภัย';
    default:
      return logType;
  }
};

/**
 * Get label for severity level (Thai)
 */
export const getSeverityLabel = (severity: SeverityLevel): string => {
  switch (severity) {
    case 'debug':
      return 'Debug';
    case 'info':
      return 'ข้อมูล';
    case 'warn':
      return 'เตือน';
    case 'error':
      return 'ผิดพลาด';
    case 'critical':
      return 'วิกฤต';
    default:
      return severity;
  }
};

/**
 * Get status code color
 */
export const getStatusCodeColor = (statusCode: number): 'success' | 'warning' | 'danger' | 'default' => {
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode >= 300 && statusCode < 400) return 'warning';
  if (statusCode >= 400) return 'danger';
  return 'default';
};

/**
 * Human-readable actor for a log row, regardless of whether the actor is a
 * staff user (users table) or a student (students table — students carry no
 * actor_user_id, so their identity lives only in `detail.student_id` and is
 * resolved server-side into `actor_student`).
 */
export interface LogActorLabel {
  name: string;
  sub: string;
  isStudent: boolean;
}

export const getLogActor = (log: SystemLog): LogActorLabel | null => {
  if (log.actor_user) {
    return { name: log.actor_user.full_name, sub: log.actor_user.email, isStudent: false };
  }
  if (log.actor_student) {
    return {
      name: log.actor_student.full_name,
      sub: `${log.actor_student.student_no} · ${log.actor_student.email}`,
      isStudent: true,
    };
  }
  return null;
};

/**
 * Thai labels for the most common action codes so the log table reads as
 * plain language instead of raw action strings. Anything not in this map
 * falls back to a prettified version of the code (underscores/dots -> spaces,
 * each word capitalized) via getActionLabel, so nothing ever renders as a
 * bare machine-readable string.
 */
const ACTION_LABELS: Record<string, string> = {
  // Auth
  "auth.login.success": "เข้าสู่ระบบสำเร็จ",
  "auth.login.failed": "เข้าสู่ระบบล้มเหลว",
  "auth.logout": "ออกจากระบบ",
  "auth.2fa.verified": "ยืนยันตัวตนสองขั้นตอนสำเร็จ",
  "auth.token.revoked": "เพิกถอน token",
  "auth.oauth.linked": "เชื่อมโยงบัญชี OAuth",
  change_password: "เปลี่ยนรหัสผ่าน",
  force_change_password: "บังคับเปลี่ยนรหัสผ่าน",
  update_profile: "แก้ไขโปรไฟล์",
  disable_2fa: "ปิดการยืนยันตัวตนสองขั้นตอน",
  link_oauth_account: "เชื่อมโยงบัญชี OAuth",
  unlink_oauth_account: "ยกเลิกการเชื่อมโยงบัญชี OAuth",
  admin_unlink_oauth_account: "แอดมินยกเลิกการเชื่อมโยงบัญชี OAuth ของผู้ใช้",

  // Score
  "score.updated": "บันทึก/แก้ไขคะแนน",
  "score.edit_request.created": "ยื่นคำร้องขอแก้ไขคะแนน",
  "score.edit_request.approved": "อนุมัติคำร้องขอแก้ไขคะแนน",
  "score.edit_request.rejected": "ปฏิเสธคำร้องขอแก้ไขคะแนน",
  "exam_score.updated": "บันทึก/แก้ไขคะแนนสอบ",
  submit_exam_score: "บันทึกคะแนนสอบ",
  bulk_submit_exam_scores: "บันทึกคะแนนสอบ (หลายรายการ)",
  delete_exam_score: "ลบคะแนนสอบ",
  update_exam_setting: "แก้ไขการตั้งค่าการสอบ",
  "bonus_score.given": "ให้คะแนนพิเศษ",
  "bonus_score.deleted": "ลบคะแนนพิเศษ",

  // Course
  "course.ta.added": "เพิ่มผู้ช่วยสอนในรายวิชา",
  "course.ta.removed": "ลบผู้ช่วยสอนออกจากรายวิชา",
  "course.student.removed": "ลบนักศึกษาออกจากรายวิชา",
  "course.section.created": "สร้าง Section รายวิชา",
  create_course: "สร้างรายวิชา",
  update_course: "แก้ไขรายวิชา",
  delete_course: "ลบรายวิชา",
  update_ta_permissions: "แก้ไขสิทธิ์ผู้ช่วยสอน",
  update_instructor_permissions: "แก้ไขสิทธิ์ผู้สอน",

  // User
  create_user: "สร้างบัญชีผู้ใช้งาน",
  update_user: "แก้ไขบัญชีผู้ใช้งาน",
  delete_user: "ลบบัญชีผู้ใช้งาน",
  deactivate_user: "ปิดใช้งานบัญชีผู้ใช้งาน",
  activate_user: "เปิดใช้งานบัญชีผู้ใช้งาน",
  deactivate_user_conflict: "ปิดใช้งานบัญชี (ตรวจพบความขัดแย้ง)",
  broadcast_notification: "ส่งประกาศแจ้งเตือนผู้ใช้งาน",

  // Student
  create_student: "เพิ่มข้อมูลนักศึกษา",
  update_student: "แก้ไขข้อมูลนักศึกษา",
  delete_student: "ลบข้อมูลนักศึกษา",
  import_students: "นำเข้าข้อมูลนักศึกษา",
  activate_student: "เปิดใช้งานบัญชีนักศึกษา",
  deactivate_student: "ปิดใช้งานบัญชีนักศึกษา",

  // Assignment / classwork
  create_assignment: "สร้างงานในชั้นเรียน",
  update_assignment: "แก้ไขงานในชั้นเรียน",
  delete_assignment: "ลบงานในชั้นเรียน",

  // Attendance
  "attendance.session.created": "สร้างรอบเช็กชื่อ",
  "attendance.record.updated": "แก้ไขสถานะการเช็กชื่อ",
  activate_attendance_session: "เปิดรอบเช็กชื่อ",
  close_attendance_session: "ปิดรอบเช็กชื่อ",

  // Queue
  "queue.session.opened": "เปิดรอบจองคิว",
  "queue.session.closed": "ปิดรอบจองคิว",
  "queue.booking.created": "จองคิว",
  "queue.booking.called": "เรียกคิว",
  cancel_queue_booking: "ยกเลิกการจองคิว",
  update_queue_cutoff: "แก้ไขเวลาปิดรับจองคิว",

  // Classroom
  create_classroom: "เพิ่มห้องเรียน",
  update_classroom: "แก้ไขห้องเรียน",
  update_classroom_layout: "แก้ไขผังที่นั่งห้องเรียน",
  toggle_classroom_status: "เปิด/ปิดใช้งานห้องเรียน",
  restore_classroom: "กู้คืนห้องเรียน",
  delete_classroom: "ลบห้องเรียน",

  // Admin
  "admin.user.deactivated": "แอดมินปิดใช้งานบัญชีผู้ใช้",
  "admin.user.activated": "แอดมินเปิดใช้งานบัญชีผู้ใช้",
  "admin.config.changed": "แก้ไขการตั้งค่าระบบ",
};

const prettifyActionCode = (action: string): string => {
  return action
    .replace(/[._]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Human-readable label for a log action code. Known codes get a curated Thai
 * label; anything else is prettified so it never renders as a raw code like
 * "auth.login.success" or "create_user".
 */
export const getActionLabel = (action: string): string => {
  return ACTION_LABELS[action] || prettifyActionCode(action);
};

/**
 * Format bytes to human readable
 */
export const formatBytes = (bytes: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

// ============================================================
// Course Activity Logs (admin cross-course view)
// Expected API: GET /logs/course-activity
// Response shape: { logs: CourseActivityLog[]; pagination: Pagination }
// ============================================================

export interface CourseActivityLog {
  id: number;
  course_id: string;
  actor_user_id: number;
  actor_email: string;
  actor_role: string;
  action: string;
  category: string;
  target_type: string;
  target_id: string;
  description: string;
  request_id: string;
  ip_address: string;
  created_at: string;
}

export interface CourseActivityLogFilters {
  course_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export const getCourseActivityLogs = async (filters: CourseActivityLogFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.course_id) params.append('course_id', filters.course_id);
  if (filters.search) params.append('search', filters.search);
  if (filters.date_from) params.append('date_from', filters.date_from);
  if (filters.date_to) params.append('date_to', filters.date_to);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));

  const queryString = params.toString();
  const url = queryString ? `/logs/course-activity?${queryString}` : '/logs/course-activity';

  return api.get<{
    logs: CourseActivityLog[];
    pagination: Pagination;
  }>(url);
};

export default {
  getLogs,
  getLogById,
  getLogStats,
  getLogsTimeline,
  getFilterOptions,
  exportLogs,
  getRecentErrors,
  getRecentSecurityEvents,
  cleanupLogs,
};