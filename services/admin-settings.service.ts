import { API_ENDPOINTS } from "@/config/api";
import { apiService } from "./api.service";

export interface DatabaseBackupRecord {
  id: number;
  backup_name: string;
  storage_path: string;
  storage_provider?: string;
  storage_slot?: number;
  checksum_sha256?: string;
  file_size_bytes: number;
  created_by?: number;
  created_at: string;
  deleted_at?: string;
}

export interface RestoreBackupPayload {
  backup_id: number;
  confirm_text: string;
  reason?: string;
}

export interface BackupOperationStatus {
  running: boolean;
  last_trigger?: string;
  last_status?: string;
  last_error?: string;
  last_backup_id?: number;
  last_backup_at?: string;
  last_restore_at?: string;
  updated_at?: string;
}

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  updated_at?: string;
}

export interface Announcement {
  id: number;
  title: string;
  title_th?: string;
  title_en?: string;
  message: string;
  message_th?: string;
  message_en?: string;
  content_type: "text" | "image" | "mixed";
  display_mode: "banner_top" | "fullscreen";
  image_url?: string;
  action_label?: string;
  action_label_th?: string;
  action_label_en?: string;
  action_url?: string;
  is_dismissible: boolean;
  display_paths?: string[];
  scheduled_at?: string;
  expires_at?: string;
  audience: string[];
  require_acknowledge: boolean;
  is_active: boolean;
  created_at: string;
  ack_count: number;
  is_acknowledged?: boolean;
}

export interface MaintenanceConfig {
  enabled: boolean;
  schedule_type?: "indefinite" | "scheduled";
  message: string;
  start_time?: string | null;
  end_time?: string | null;
  whitelist_admin_users: number[];
  updated_at?: string;
}

export interface StudentProgram {
  short_name: string;
  full_name: string;
  original_short_name?: string;
}

export interface ServiceDependency {
  name: string;
  status: "up" | "down";
  detail: string;
}

export interface ServiceHealth {
  overall_status: "up" | "degraded";
  timestamp: string;
  dependencies: ServiceDependency[];
}

export interface AnnouncementPayload {
  title: string;
  title_th?: string | null;
  title_en?: string | null;
  message: string;
  message_th?: string | null;
  message_en?: string | null;
  content_type: "text" | "image" | "mixed";
  display_mode: "banner_top" | "fullscreen";
  image_url?: string | null;
  action_label?: string | null;
  action_label_th?: string | null;
  action_label_en?: string | null;
  action_url?: string | null;
  is_dismissible: boolean;
  display_paths: string[];
  scheduled_at?: string | null;
  expires_at?: string | null;
  audience: string[];
  require_acknowledge: boolean;
  is_active: boolean;
}

async function getBackups(limit = 20): Promise<DatabaseBackupRecord[]> {
  const response = await apiService.get<DatabaseBackupRecord[]>(API_ENDPOINTS.SYSTEM_SETTINGS.BACKUPS, {
    params: { limit: String(limit) },
  });
  if (!response.success || !response.data) return [];
  return response.data;
}

async function getBackupStatus(): Promise<BackupOperationStatus | null> {
  const response = await apiService.get<BackupOperationStatus>(API_ENDPOINTS.SYSTEM_SETTINGS.BACKUPS_STATUS);
  if (!response.success || !response.data) return null;
  return response.data;
}

let _lastBackupActionError: { code?: string; message?: string } | null = null;

async function runBackupNow(reason?: string, stepUpToken?: string): Promise<DatabaseBackupRecord | null> {
  _lastBackupActionError = null;
  const response = await apiService.post<DatabaseBackupRecord>(
    API_ENDPOINTS.SYSTEM_SETTINGS.BACKUPS_RUN_NOW,
    { reason },
    stepUpToken ? { headers: { "X-Step-Up-Token": stepUpToken } } : undefined,
  );
  if (!response.success || !response.data) {
    _lastBackupActionError = {
      code: (response as unknown as { code?: string }).code,
      message: response.message,
    };
    return null;
  }
  return response.data;
}

async function restoreBackup(payload: RestoreBackupPayload, stepUpToken?: string): Promise<boolean> {
  _lastBackupActionError = null;
  const response = await apiService.post(
    API_ENDPOINTS.SYSTEM_SETTINGS.BACKUPS_RESTORE,
    payload,
    stepUpToken ? { headers: { "X-Step-Up-Token": stepUpToken } } : undefined,
  );
  if (!response.success) {
    _lastBackupActionError = {
      code: (response as unknown as { code?: string }).code,
      message: response.message,
    };
    return false;
  }
  return true;
}

async function getBackupDownloadURL(id: number, stepUpToken?: string): Promise<string | null> {
  _lastBackupActionError = null;
  const response = await apiService.get<{ url: string }>(
    API_ENDPOINTS.SYSTEM_SETTINGS.BACKUP_DOWNLOAD_URL(id),
    stepUpToken ? { headers: { "X-Step-Up-Token": stepUpToken } } : undefined,
  );
  if (!response.success || !response.data?.url) {
    _lastBackupActionError = {
      code: (response as unknown as { code?: string }).code,
      message: response.message,
    };
    return null;
  }
  return response.data.url;
}

async function getAnnouncements(includeExpired = false): Promise<Announcement[]> {
  const response = await apiService.get<Announcement[]>(API_ENDPOINTS.SYSTEM_SETTINGS.ANNOUNCEMENTS, {
    params: { includeExpired: String(includeExpired) },
  });
  if (!response.success || !response.data) return [];
  return response.data;
}

async function getActiveAnnouncements(): Promise<Announcement[]> {
  const response = await apiService.get<Announcement[]>(API_ENDPOINTS.SYSTEM_SETTINGS.ANNOUNCEMENTS_ACTIVE);
  if (!response.success || !response.data) return [];
  return response.data;
}

async function uploadAnnouncementImage(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append("image", file);
  const response = await apiService.post<{ url: string }>(API_ENDPOINTS.SYSTEM_SETTINGS.ANNOUNCEMENT_UPLOAD_IMAGE, formData);
  if (!response.success || !response.data?.url) return null;
  return response.data.url;
}

async function createAnnouncement(payload: AnnouncementPayload): Promise<Announcement | null> {
  const response = await apiService.post<Announcement>(API_ENDPOINTS.SYSTEM_SETTINGS.ANNOUNCEMENTS, payload);
  if (!response.success || !response.data) return null;
  return response.data;
}

async function updateAnnouncement(id: number, payload: AnnouncementPayload): Promise<Announcement | null> {
  const response = await apiService.put<Announcement>(API_ENDPOINTS.SYSTEM_SETTINGS.ANNOUNCEMENT_BY_ID(id), payload);
  if (!response.success || !response.data) return null;
  return response.data;
}

async function acknowledgeAnnouncement(id: number): Promise<boolean> {
  const response = await apiService.post(API_ENDPOINTS.SYSTEM_SETTINGS.ANNOUNCEMENT_ACK(id));
  return response.success;
}

const INSTRUCTOR_TA_FEATURE_FLAG_KEYS = new Set([
  "menu.attendance",
  "menu.queue",
  "menu.assignments",
  "menu.scores",
  "menu.exams",
  "menu.teams",
  "menu.people",
  "menu.activity-log",
  "menu.ta-stats",
  "menu.settings",
]);

async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const response = await apiService.get<FeatureFlag[]>(API_ENDPOINTS.SYSTEM_SETTINGS.FEATURE_FLAGS);
  if (!response.success || !response.data) return [];
  return response.data.filter((flag) => INSTRUCTOR_TA_FEATURE_FLAG_KEYS.has(flag.key));
}

let _lastFlagUpdateError: { code?: string; message?: string } | null = null;

async function updateFeatureFlag(key: string, enabled: boolean, stepUpToken?: string): Promise<FeatureFlag | null> {
  _lastFlagUpdateError = null;
  const response = await apiService.put<FeatureFlag>(
    API_ENDPOINTS.SYSTEM_SETTINGS.FEATURE_FLAG_BY_KEY(key),
    { enabled },
    stepUpToken ? { headers: { "X-Step-Up-Token": stepUpToken } } : undefined,
  );
  if (!response.success || !response.data) {
    _lastFlagUpdateError = {
      code: (response as unknown as { code?: string }).code,
      message: response.message,
    };
    return null;
  }
  return response.data;
}

async function getMaintenanceConfig(): Promise<MaintenanceConfig | null> {
  const response = await apiService.get<MaintenanceConfig>(API_ENDPOINTS.SYSTEM_SETTINGS.MAINTENANCE);
  if (!response.success || !response.data) return null;
  return response.data;
}

async function updateMaintenanceConfig(payload: MaintenanceConfig, stepUpToken?: string): Promise<MaintenanceConfig | null> {
  const response = await apiService.put<MaintenanceConfig>(
    API_ENDPOINTS.SYSTEM_SETTINGS.MAINTENANCE,
    payload,
    stepUpToken ? { headers: { "X-Step-Up-Token": stepUpToken } } : undefined,
  );
  if (!response.success || !response.data) return null;
  return response.data;
}

async function getServiceHealth(): Promise<ServiceHealth | null> {
  const response = await apiService.get<ServiceHealth>(API_ENDPOINTS.SYSTEM_SETTINGS.HEALTH);
  if (!response.success || !response.data) return null;
  return response.data;
}

async function getStudentPrograms(): Promise<StudentProgram[]> {
  const response = await apiService.get<StudentProgram[]>(API_ENDPOINTS.SYSTEM_SETTINGS.PROGRAMS);
  if (!response.success || !response.data) return [];
  return response.data;
}

async function updateStudentPrograms(programs: StudentProgram[]): Promise<StudentProgram[] | null> {
  const response = await apiService.put<StudentProgram[]>(API_ENDPOINTS.SYSTEM_SETTINGS.PROGRAMS, { programs });
  if (!response.success || !response.data) return null;
  return response.data;
}

export const adminSettingsService = {
  getBackups,
  getBackupStatus,
  runBackupNow,
  restoreBackup,
  getBackupDownloadURL,
  getLastBackupActionError: () => _lastBackupActionError,
  getAnnouncements,
  getActiveAnnouncements,
  uploadAnnouncementImage,
  createAnnouncement,
  updateAnnouncement,
  acknowledgeAnnouncement,
  getFeatureFlags,
  updateFeatureFlag,
  getLastFlagUpdateError: () => _lastFlagUpdateError,
  getMaintenanceConfig,
  updateMaintenanceConfig,
  getStudentPrograms,
  updateStudentPrograms,
  getServiceHealth,
};
