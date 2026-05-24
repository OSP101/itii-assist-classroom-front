import { apiService } from './api.service';
import { API_ENDPOINTS } from '@/config/api';

export interface CloudOverview {
  provider: string;
  overallStatus: 'up' | 'warning' | 'degraded';
  storage: {
    totalBytes: number;
    totalGB: number;
    objectCount: number;
    lastBackupAt?: string | null;
  };
  r2: {
    status: 'up' | 'down';
    detail: string;
  };
  backup: {
    running: boolean;
    lastStatus?: string;
    lastError?: string;
    lastBackupAt?: string | null;
    updatedAt?: string;
  };
  timestamp: string;
}

export interface CloudCost {
  currency: string;
  estimated: boolean;
  mtd: {
    storage: number;
    operations: number;
    total: number;
  };
  forecast: {
    monthly: number;
  };
  assumptions: {
    storageRatePerGBMonth: number;
    operationsRatePer1000: number;
    daysElapsed: number;
  };
  timestamp: string;
}

async function getCloudOverview(): Promise<CloudOverview | null> {
  const response = await apiService.get<CloudOverview>(API_ENDPOINTS.MONITORING.CLOUD_OVERVIEW);
  if (!response.success || !response.data) return null;
  return response.data;
}

async function getCloudCost(): Promise<CloudCost | null> {
  const response = await apiService.get<CloudCost>(API_ENDPOINTS.MONITORING.CLOUD_COST);
  if (!response.success || !response.data) return null;
  return response.data;
}

export const cloudMonitoringService = {
  getCloudOverview,
  getCloudCost,
};
