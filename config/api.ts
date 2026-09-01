/**
 * API Configuration
 */

const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const INTERNAL_API_BASE_URL = process.env.INTERNAL_API_BASE_URL || PUBLIC_API_BASE_URL;

export const API_BASE_URL = typeof window === 'undefined' ? INTERNAL_API_BASE_URL : PUBLIC_API_BASE_URL;

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  ME: '/auth/me',
  CHANGE_PASSWORD: '/auth/change-password',
  UPDATE_PROFILE: '/auth/profile',
  UPDATE_PREFERENCES: '/auth/preferences',
  GOOGLE_AUTH: '/auth/google',
  SESSIONS: '/auth/sessions',
  REVOKE_SESSION: (sessionId: number) => `/auth/sessions/${sessionId}`,
  REVOKE_ALL_SESSIONS: '/auth/sessions/revoke-all',
  UPLOAD_AVATAR: '/auth/avatar',
  REMOVE_AVATAR: '/auth/avatar',

  // System (Admin)
  SYSTEM_METRICS: '/system/metrics',
  SYSTEM_CPU: '/system/cpu',
  SYSTEM_MEMORY: '/system/memory',
  SYSTEM_INFO: '/system/info',

  // Users (Admin)
  USERS: '/users',
  USERS_STATS: '/users/stats',

  // Students
  STUDENTS: '/students',
  STUDENTS_STATS: '/students/stats',

  // Courses
  COURSES: {
    LIST: '/courses',
    STATS: '/courses/stats',
    CONFLICTS: '/courses/conflicts',
    BULK_TOGGLE: '/courses/bulk-toggle',
    BULK_DELETE: '/courses/bulk',
    EXPORT: '/courses/export',
    MY_COURSES: '/courses/my-courses',
    MY_COURSES_STATS: '/courses/my-courses/stats',
    BY_ID: (id: string) => `/courses/${id}`,
    OVERVIEW: (id: string) => `/courses/${id}/overview`,
    CREATE: '/courses',
    UPDATE: (id: string) => `/courses/${id}`,
    DELETE: (id: string) => `/courses/${id}`,
    TOGGLE_STATUS: (id: string) => `/courses/${id}/toggle-status`,
    INSTRUCTORS: '/courses/instructors',
    TAS_LIST: '/courses/tas-list',
    COVER_IMAGE_UPLOAD: '/courses/cover-image',
    // Sections
    ADD_SECTION: (courseId: string) => `/courses/${courseId}/sections`,
    REMOVE_SECTION: (courseId: string, sectionId: number) => `/courses/${courseId}/sections/${sectionId}`,
    // TAs
    ADD_TA: (courseId: string) => `/courses/${courseId}/tas`,
    CREATE_TA_ACCOUNT: (courseId: string) => `/courses/${courseId}/tas/create-account`,
    REMOVE_TA: (courseId: string, userId: number) => `/courses/${courseId}/tas/${userId}`,
    // Students
    SECTION_STUDENTS: (courseId: string, sectionId: number) => `/courses/${courseId}/sections/${sectionId}/students`,
    ADD_STUDENT: (courseId: string, sectionId: number) => `/courses/${courseId}/sections/${sectionId}/students`,
    MOVE_STUDENT: (courseId: string, sectionId: number, studentId: number) => `/courses/${courseId}/sections/${sectionId}/students/${studentId}/move`,
    REMOVE_STUDENT: (courseId: string, sectionId: number, studentId: number) => `/courses/${courseId}/sections/${sectionId}/students/${studentId}`,
    REMOVED_STUDENTS: (courseId: string) => `/courses/${courseId}/students/removed`,
    RESTORE_STUDENT: (courseId: string, sectionId: number, studentId: number) => `/courses/${courseId}/sections/${sectionId}/students/${studentId}/restore`,
  },

  // Classrooms
  CLASSROOMS: '/classrooms',
  CLASSROOMS_STATS: '/classrooms/stats',

  // System Logs
  LOGS: '/logs',
  LOGS_STATS: '/logs/stats',

  // Monitoring (Admin)
  // Monitoring (Admin) — mapped to real backend /system/* endpoints.
  // NOTE: /monitoring/containers and /monitoring/website do NOT exist in the backend yet.
  // TODO: Confirm with backend team whether container/website monitoring endpoints will be added.
  // See docs/performance-data-audit.md — "Monitoring Endpoint Mismatch" section.
  MONITORING: {
    SYSTEM: '/system/metrics',
    TRENDS: '/system/trends',
    CONTAINERS: '/system/containers',
    WEBSITE: '/system/website',
    CLOUD_OVERVIEW: '/system/cloud/overview',
    CLOUD_COST: '/system/cloud/cost',
    ACTIONS_HISTORY: '/system/actions/history',
    RESTART_SERVICE: '/system/actions/restart-service',
    REBOOT_HOST: '/system/actions/reboot-host',
    CANCEL_OPERATION: '/system/actions/cancel',
  },

  // System Settings (Admin)
  SYSTEM_SETTINGS: {
    BACKUPS: '/system-settings/backups',
    BACKUPS_STATUS: '/system-settings/backups/status',
    BACKUPS_RUN_NOW: '/system-settings/backups/run-now',
    BACKUPS_RESTORE: '/system-settings/backups/restore',
    BACKUP_DOWNLOAD_URL: (id: number) => `/system-settings/backups/${id}/download-url`,
    ANNOUNCEMENTS: '/system-settings/announcements',
    ANNOUNCEMENTS_ACTIVE: '/system-settings/announcements/active',
    ANNOUNCEMENT_UPLOAD_IMAGE: '/system-settings/announcements/upload-image',
    ANNOUNCEMENT_BY_ID: (id: number) => `/system-settings/announcements/${id}`,
    ANNOUNCEMENT_ACK: (id: number) => `/system-settings/announcements/${id}/ack`,
    ANNOUNCEMENTS_BATCH: '/system-settings/announcements/batch',
    ANNOUNCEMENT_STATUS: (id: number) => `/system-settings/announcements/${id}/status`,
    ANNOUNCEMENT_STATS: (id: number) => `/system-settings/announcements/${id}/stats`,
    ANNOUNCEMENT_DISMISS: (id: number) => `/system-settings/announcements/${id}/dismiss`,
    FEATURE_FLAGS: '/system-settings/feature-flags',
    FEATURE_FLAG_BY_KEY: (key: string) => `/system-settings/feature-flags/${key}`,
    MAINTENANCE: '/system-settings/maintenance',
    PROGRAMS: '/system-settings/programs',
    HEALTH: '/system-settings/health',
  },
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
};
