/**
 * useMonitoringData - Custom hook for real-time monitoring data
 *
 * Features:
 * - Auto-refresh every 5 seconds (configurable)
 * - Parallel fetching of system, container, and website metrics
 * - Error tracking with retry logic
 * - Connection status indicator
 * - Manual refresh capability
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { monitoringService } from '@/services/monitoring.service';
import type {
  SystemMetrics,
  ContainerMetrics,
  WebsiteMetrics,
} from '@/services/monitoring.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonitoringData {
  system: SystemMetrics | null;
  containers: ContainerMetrics[];
  website: WebsiteMetrics | null;
  lastUpdated: Date | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  consecutiveErrors: number;
}

interface UseMonitoringDataOptions {
  /** Refresh interval in milliseconds (default: 5000 = 5s) */
  refreshInterval?: number;
  /** Whether to auto-refresh (default: true) */
  autoRefresh?: boolean;
  /** Max consecutive errors before pausing auto-refresh (default: 5) */
  maxConsecutiveErrors?: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMonitoringData(options: UseMonitoringDataOptions = {}) {
  const {
    refreshInterval = 5000,
    autoRefresh = true,
    maxConsecutiveErrors = 5,
  } = options;

  const [data, setData] = useState<MonitoringData>({
    system: null,
    containers: [],
    website: null,
    lastUpdated: null,
    isLoading: true,
    isRefreshing: false,
    error: null,
    connectionStatus: 'connecting',
    consecutiveErrors: 0,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  // Fetch all monitoring data
  const fetchData = useCallback(async (isInitial = false) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!isMountedRef.current) return;

    setData((prev) => ({
      ...prev,
      isLoading: isInitial && !prev.lastUpdated,
      isRefreshing: !isInitial || !!prev.lastUpdated,
    }));

    try {
      const [system, containers, website] = await Promise.all([
        monitoringService.getSystemMetrics(),
        monitoringService.getContainerMetrics(),
        monitoringService.getWebsiteMetrics(),
      ]);

      if (!isMountedRef.current) return;

      setData((prev) => ({
        ...prev,
        system: system ?? prev.system,
        containers: containers.length > 0 ? containers : prev.containers,
        website: website ?? prev.website,
        lastUpdated: new Date(),
        isLoading: false,
        isRefreshing: false,
        error: null,
        connectionStatus: 'connected',
        consecutiveErrors: 0,
      }));
    } catch (error) {
      if (!isMountedRef.current) return;

      setData((prev) => {
        const newErrors = prev.consecutiveErrors + 1;
        return {
          ...prev,
          isLoading: false,
          isRefreshing: false,
          error: error instanceof Error ? error.message : 'Failed to fetch monitoring data',
          connectionStatus: newErrors >= maxConsecutiveErrors ? 'disconnected' : 'connecting',
          consecutiveErrors: newErrors,
        };
      });
    } finally {
      isFetchingRef.current = false;
    }
  }, [maxConsecutiveErrors]);

  // Manual refresh
  const refresh = useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  // Reset connection (clear errors and retry)
  const resetConnection = useCallback(() => {
    setData((prev) => ({
      ...prev,
      consecutiveErrors: 0,
      connectionStatus: 'connecting',
      error: null,
    }));
    fetchData(true);
  }, [fetchData]);

  // Initial fetch + auto-refresh setup
  useEffect(() => {
    isMountedRef.current = true;
    fetchData(true);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchData]);

  // Auto-refresh interval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (autoRefresh && data.consecutiveErrors < maxConsecutiveErrors) {
      intervalRef.current = setInterval(() => {
        fetchData(false);
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, data.consecutiveErrors, maxConsecutiveErrors, fetchData]);

  return {
    ...data,
    refresh,
    resetConnection,
  };
}

export default useMonitoringData;
