/**
 * Monitoring Service
 * 
 * Provides methods to fetch system monitoring data.
 *
 * NOTE: Backend exposes /api/system/* routes for system, containers, and website.
 * 
 * The backend returns raw metrics (bytes, seconds) — this service
 * transforms them into the UI-friendly units the components expect.
 */

import { apiService } from './api.service';
import { API_ENDPOINTS } from '@/config/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SystemMetrics {
  cpu: {
    usagePercent: number;
    cores: number;
    model: string;
    status: 'normal' | 'warning' | 'critical';
  };
  memory: {
    totalGB: number;
    usedGB: number;
    availableGB: number;
    usagePercent: number;
    status: 'normal' | 'warning' | 'critical';
  };
  disk: {
    totalGB: number;
    usedGB: number;
    availableGB: number;
    usagePercent: number;
    status: 'normal' | 'warning' | 'critical';
  };
  network: {
    receiveMBps: number;
    transmitMBps: number;
  };
  load: {
    load1m: number;
    load5m: number;
    load15m: number;
    cpuCount: number;
    status: 'normal' | 'warning' | 'critical';
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
}

export interface ContainerMetrics {
  name: string;
  cpuPercent: number;
  memoryUsageMB: number;
  memoryLimitMB: number;
  memoryPercent: number;
  restarts: number;
  status: 'running' | 'stopped' | 'restarting';
}

export interface WebsiteMetrics {
  uptime: {
    isUp: boolean;
    uptimePercent: number;
    lastDowntime: string | null;
  };
  responseTime: {
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    status: 'good' | 'slow' | 'critical';
  };
  errorRate: {
    percent: number;
    total5xx: number;
    total4xx: number;
    totalRequests: number;
    status: 'normal' | 'warning' | 'critical';
  };
  statusCodes: {
    code: string;
    count: number;
  }[];
  requestRate: {
    perSecond: number;
    perMinute: number;
  };
}

export interface MonitoringOverview {
  system: SystemMetrics;
  containers: ContainerMetrics[];
  website: WebsiteMetrics;
  timestamp: string;
}

export interface MonitoringTrendPoint {
  timestamp: string;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  responseAvgMs: number;
  errorPercent: number;
  requestsPerMinute: number;
  runningContainers: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const bytesToGB = (bytes: number | null): number =>
  bytes ? parseFloat((bytes / 1073741824).toFixed(2)) : 0;

const bytesToMBps = (bytesPerSec: number | null): number =>
  bytesPerSec ? parseFloat((bytesPerSec / 1048576).toFixed(3)) : 0;

function formatUptime(seconds: number | null): string {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} วัน ${h} ชม.`;
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${m} นาที`;
}

// ---------------------------------------------------------------------------
// Backend response types (raw format from API)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawData = Record<string, any>;

// ---------------------------------------------------------------------------
// Service Methods
// ---------------------------------------------------------------------------

/**
 * Fetch system health metrics (CPU, RAM, disk, network, load)
 * Backend returns bytes/seconds → we convert to GB/MBps
 */
async function getSystemMetrics(): Promise<SystemMetrics | null> {
  try {
    const response = await apiService.get<RawData>(
      API_ENDPOINTS.MONITORING.SYSTEM
    );
    if (!response.success || !response.data) return null;

    // Backend wraps in { success, data: { cpu, memory, disk, ... } }
    const d = response.data;

    return {
      cpu: {
        usagePercent: d.cpu?.usagePercent ?? 0,
        cores: d.cpu?.cores ?? 0,
        model: d.cpu?.model ?? '—',
        status: d.cpu?.status ?? 'normal',
      },
      memory: {
        totalGB: bytesToGB(d.memory?.totalBytes),
        usedGB: bytesToGB(d.memory?.usedBytes),
        availableGB: bytesToGB(d.memory?.availableBytes),
        usagePercent: d.memory?.usagePercent ?? 0,
        status: d.memory?.status ?? 'normal',
      },
      disk: {
        totalGB: bytesToGB(d.disk?.totalBytes),
        usedGB: bytesToGB(d.disk?.usedBytes),
        availableGB: bytesToGB(d.disk?.availableBytes),
        usagePercent: d.disk?.usagePercent ?? 0,
        status: d.disk?.status ?? 'normal',
      },
      network: {
        receiveMBps: bytesToMBps(d.network?.receiveBytesPerSec),
        transmitMBps: bytesToMBps(d.network?.transmitBytesPerSec),
      },
      load: {
        load1m: d.load?.load1 ?? 0,
        load5m: d.load?.load5 ?? 0,
        load15m: d.load?.load15 ?? 0,
        cpuCount: d.cpu?.cores ?? 0,
        status: computeLoadStatus(d.load?.load1, d.cpu?.cores),
      },
      uptime: {
        seconds: d.uptime?.seconds ?? 0,
        formatted: formatUptime(d.uptime?.seconds),
      },
    };
  } catch (error) {
    console.error('Failed to fetch system metrics:', error);
    return null;
  }
}

function computeLoadStatus(
  load1: number | undefined,
  cores: number | undefined
): 'normal' | 'warning' | 'critical' {
  if (!load1 || !cores) return 'normal';
  const ratio = load1 / cores;
  if (ratio > 2) return 'critical';
  if (ratio > 1) return 'warning';
  return 'normal';
}

/**
 * Fetch container metrics.
 */
async function getContainerMetrics(): Promise<ContainerMetrics[]> {
  try {
    const response = await apiService.get<RawData[]>(
      API_ENDPOINTS.MONITORING.CONTAINERS
    );
    if (!response.success || !Array.isArray(response.data)) return [];

    return response.data.map((row) => ({
      name: String(row.name ?? 'unknown'),
      cpuPercent: Number(row.cpuPercent ?? 0),
      memoryUsageMB: Number(row.memoryUsageMB ?? 0),
      memoryLimitMB: Number(row.memoryLimitMB ?? 0),
      memoryPercent: Number(row.memoryPercent ?? 0),
      restarts: Number(row.restarts ?? 0),
      status: (row.status as ContainerMetrics['status']) ?? 'stopped',
    }));
  } catch (error) {
    console.error('Failed to fetch container metrics:', error);
    return [];
  }
}

/**
 * Fetch website health metrics.
 */
async function getWebsiteMetrics(): Promise<WebsiteMetrics | null> {
  try {
    const response = await apiService.get<RawData>(
      API_ENDPOINTS.MONITORING.WEBSITE
    );
    if (!response.success || !response.data) return null;

    const d = response.data;
    return {
      uptime: {
        isUp: Boolean(d.uptime?.isUp),
        uptimePercent: Number(d.uptime?.uptimePercent ?? 0),
        lastDowntime: d.uptime?.lastDowntime ?? null,
      },
      responseTime: {
        avgMs: Number(d.responseTime?.avgMs ?? 0),
        p50Ms: Number(d.responseTime?.p50Ms ?? 0),
        p95Ms: Number(d.responseTime?.p95Ms ?? 0),
        p99Ms: Number(d.responseTime?.p99Ms ?? 0),
        status: (d.responseTime?.status as WebsiteMetrics['responseTime']['status']) ?? 'good',
      },
      errorRate: {
        percent: Number(d.errorRate?.percent ?? 0),
        total5xx: Number(d.errorRate?.total5xx ?? 0),
        total4xx: Number(d.errorRate?.total4xx ?? 0),
        totalRequests: Number(d.errorRate?.totalRequests ?? 0),
        status: (d.errorRate?.status as WebsiteMetrics['errorRate']['status']) ?? 'normal',
      },
      statusCodes: Array.isArray(d.statusCodes)
        ? d.statusCodes.map((row: RawData) => ({
            code: String(row.code ?? '-'),
            count: Number(row.count ?? 0),
          }))
        : [],
      requestRate: {
        perSecond: Number(d.requestRate?.perSecond ?? 0),
        perMinute: Number(d.requestRate?.perMinute ?? 0),
      },
    };
  } catch (error) {
    console.error('Failed to fetch website metrics:', error);
    return null;
  }
}

/**
 * Fetch all monitoring data in parallel
 */
async function getMonitoringOverview(): Promise<MonitoringOverview | null> {
  try {
    const [system, containers, website] = await Promise.all([
      getSystemMetrics(),
      getContainerMetrics(),
      getWebsiteMetrics(),
    ]);

    if (!system && !website) return null;

    return {
      system: system!,
      containers,
      website: website!,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to fetch monitoring overview:', error);
    return null;
  }
}

async function getTrendHistory(range: '15m' | '1h' | '6h' | '24h' | 'all'): Promise<MonitoringTrendPoint[]> {
  try {
    const endpoint = `${API_ENDPOINTS.MONITORING.TRENDS}?range=${encodeURIComponent(range)}`;
    const response = await apiService.get<RawData>(endpoint);
    if (!response.success || !response.data || !Array.isArray(response.data.points)) return [];

    return response.data.points.map((row: RawData) => ({
      timestamp: String(row.timestamp ?? new Date().toISOString()),
      cpuPercent: Number(row.cpuPercent ?? 0),
      memoryPercent: Number(row.memoryPercent ?? 0),
      diskPercent: Number(row.diskPercent ?? 0),
      responseAvgMs: Number(row.responseAvgMs ?? 0),
      errorPercent: Number(row.errorPercent ?? 0),
      requestsPerMinute: Number(row.requestsPerMinute ?? 0),
      runningContainers: Number(row.runningContainers ?? 0),
    }));
  } catch (error) {
    console.error('Failed to fetch monitoring trend history:', error);
    return [];
  }
}

export const monitoringService = {
  getSystemMetrics,
  getContainerMetrics,
  getWebsiteMetrics,
  getMonitoringOverview,
  getTrendHistory,
};

export default monitoringService;
