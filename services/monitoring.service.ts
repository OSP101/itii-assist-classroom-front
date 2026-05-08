/**
 * Monitoring Service
 * 
 * Provides methods to fetch system monitoring data.
 *
 * NOTE: Backend currently exposes only /api/system/* routes.
 * Container and website monitoring endpoints are not available yet.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const bytesToGB = (bytes: number | null): number =>
  bytes ? parseFloat((bytes / 1073741824).toFixed(2)) : 0;

const bytesToMB = (bytes: number | null): number =>
  bytes ? parseFloat((bytes / 1048576).toFixed(2)) : 0;

const bytesToMBps = (bytesPerSec: number | null): number =>
  bytesPerSec ? parseFloat((bytesPerSec / 1048576).toFixed(3)) : 0;

const secToMs = (sec: number | null): number =>
  sec ? parseFloat((sec * 1000).toFixed(2)) : 0;

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
 *
 * TODO: Backend endpoint for container monitoring is not implemented.
 * Return an empty list until /api/system/containers (or equivalent) exists.
 */
async function getContainerMetrics(): Promise<ContainerMetrics[]> {
  return [];
}

/**
 * Fetch website health metrics.
 *
 * TODO: Backend endpoint for website monitoring is not implemented.
 * Return a safe fallback model so UI can render without crashing.
 */
async function getWebsiteMetrics(): Promise<WebsiteMetrics | null> {
  return {
    uptime: {
      isUp: false,
      uptimePercent: 0,
      lastDowntime: null,
    },
    responseTime: {
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      status: 'critical',
    },
    errorRate: {
      percent: 0,
      total5xx: 0,
      total4xx: 0,
      totalRequests: 0,
      status: 'normal',
    },
    statusCodes: [],
    requestRate: {
      perSecond: 0,
      perMinute: 0,
    },
  };
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

export const monitoringService = {
  getSystemMetrics,
  getContainerMetrics,
  getWebsiteMetrics,
  getMonitoringOverview,
};

export default monitoringService;
