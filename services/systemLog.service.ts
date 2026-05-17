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
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
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
export const cleanupLogs = async (retentionDays: number = 90) => {
  return api.post<{ deletedCount: number; cutoffDate: string }>('/logs/cleanup', { 
    retention_days: retentionDays 
  });
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
 * Format bytes to human readable
 */
export const formatBytes = (bytes: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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