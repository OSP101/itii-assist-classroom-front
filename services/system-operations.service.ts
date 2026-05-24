import { apiService } from './api.service';
import { API_ENDPOINTS } from '@/config/api';

export interface SystemOperationRecord {
  id: string;
  action: 'restart_service' | 'reboot_host';
  target: string;
  status: 'success' | 'failed' | 'cancelled';
  reason: string;
  requested_by: number;
  requested_at: string;
  completed_at?: string;
  duration_ms: number;
  dry_run: boolean;
  output?: string;
  error?: string;
  meta?: Record<string, unknown>;
}

interface RestartServicePayload {
  service: string;
  reason: string;
  dry_run?: boolean;
  force?: boolean;
}

interface RebootHostPayload {
  reason: string;
  delay_seconds?: number;
  dry_run?: boolean;
  force?: boolean;
}

interface CancelOperationPayload {
  operation_id: string;
  reason: string;
}

let _lastError: { code?: string; message?: string } | null = null;

async function getHistory(): Promise<SystemOperationRecord[]> {
  const response = await apiService.get<SystemOperationRecord[]>(
    API_ENDPOINTS.MONITORING.ACTIONS_HISTORY
  );
  if (!response.success || !response.data) return [];
  return response.data;
}

async function restartService(
  payload: RestartServicePayload,
  stepUpToken?: string
): Promise<SystemOperationRecord | null> {
  _lastError = null;
  const response = await apiService.post<SystemOperationRecord>(
    API_ENDPOINTS.MONITORING.RESTART_SERVICE,
    payload,
    stepUpToken ? { headers: { 'X-Step-Up-Token': stepUpToken } } : undefined
  );
  if (!response.success || !response.data) {
    _lastError = {
      code: (response as unknown as { code?: string }).code,
      message: response.message,
    };
    return null;
  }
  return response.data;
}

async function rebootHost(
  payload: RebootHostPayload,
  stepUpToken?: string
): Promise<SystemOperationRecord | null> {
  _lastError = null;
  const response = await apiService.post<SystemOperationRecord>(
    API_ENDPOINTS.MONITORING.REBOOT_HOST,
    payload,
    stepUpToken ? { headers: { 'X-Step-Up-Token': stepUpToken } } : undefined
  );
  if (!response.success || !response.data) {
    _lastError = {
      code: (response as unknown as { code?: string }).code,
      message: response.message,
    };
    return null;
  }
  return response.data;
}

async function cancelOperation(
  payload: CancelOperationPayload,
  stepUpToken?: string
): Promise<SystemOperationRecord | null> {
  _lastError = null;
  const response = await apiService.post<SystemOperationRecord>(
    API_ENDPOINTS.MONITORING.CANCEL_OPERATION,
    payload,
    stepUpToken ? { headers: { 'X-Step-Up-Token': stepUpToken } } : undefined
  );
  if (!response.success || !response.data) {
    _lastError = {
      code: (response as unknown as { code?: string }).code,
      message: response.message,
    };
    return null;
  }
  return response.data;
}

export const systemOperationsService = {
  getHistory,
  restartService,
  rebootHost,
  cancelOperation,
  getLastError: () => _lastError,
};
