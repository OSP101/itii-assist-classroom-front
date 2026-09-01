"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Skeleton } from "@heroui/skeleton";
import { Tooltip } from "@heroui/tooltip";
import { Icon } from "@iconify/react";

import { useMonitoringData } from "@/hooks/useMonitoringData";
import { useI18n } from "@/hooks/useI18n";
import {
  ConnectionStatusBadge,
  CpuCard,
  MemoryCard,
  DiskCard,
  NetworkCard,
  LoadAverageCard,
  UptimeCard,
  WebsiteStatusCard,
  ResponseTimeCard,
  ErrorRateCard,
  RequestRateCard,
  StatusCodesCard,
  ContainerListCard,
  SystemOperationsControlCard,
  MonitoringTrendCharts,
} from "@/components/monitoring";
import { cloudMonitoringService, type CloudCost, type CloudOverview } from "@/services/cloud-monitoring.service";

// ---------------------------------------------------------------------------
// Skeleton / Loading state
// ---------------------------------------------------------------------------


function CardSkeleton() {
  return (
    <Card className="border border-default-200 shadow-sm">
      <CardBody className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="w-20 h-3 rounded-lg" />
              <Skeleton className="w-14 h-5 rounded-lg" />
            </div>
          </div>
          <Skeleton className="w-14 h-5 rounded-full" />
        </div>
        <Skeleton className="w-full h-20 rounded-lg" />
      </CardBody>
    </Card>
  );
}

function LoadingGrid() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Sections
// ---------------------------------------------------------------------------

type TabKey = "overview" | "system" | "website" | "containers";

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "ภาพรวม", icon: "solar:chart-2-bold" },
  { key: "system", label: "สุขภาพเซิร์ฟเวอร์", icon: "solar:server-bold" },
  { key: "website", label: "เว็บไซต์", icon: "solar:monitor-bold" },
  { key: "containers", label: "Containers", icon: "solar:box-bold" },
];

const TAB_SET = new Set<TabKey>(tabs.map((tab) => tab.key));

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

interface MonitoringPageProps {
  initialTab?: TabKey;
}

export function MonitoringPage({ initialTab = "overview" }: MonitoringPageProps) {
  const pathname = usePathname();
  const t = useI18n();

  // Derive tab from current pathname (for initial render / real Next.js navigation)
  const tabFromPath = useMemo<TabKey | null>(() => {
    const segments = pathname.split("/").filter(Boolean);
    const maybeTab = segments[segments.length - 1] as TabKey;
    return TAB_SET.has(maybeTab) ? maybeTab : null;
  }, [pathname]);

  const [activeTab, setActiveTab] = useState<TabKey>(tabFromPath ?? initialTab);
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);
  const [cloudOverview, setCloudOverview] = useState<CloudOverview | null>(null);
  const [cloudCost, setCloudCost] = useState<CloudCost | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCloudData = useCallback(async () => {
    const [overview, cost] = await Promise.all([
      cloudMonitoringService.getCloudOverview(),
      cloudMonitoringService.getCloudCost(),
    ]);
    setCloudOverview(overview);
    setCloudCost(cost);
  }, []);


  // Sync activeTab when Next.js pathname changes (real navigation, not pushState)
  useEffect(() => {
    if (tabFromPath && tabFromPath !== activeTab) {
      setActiveTab(tabFromPath);
    }
  }, [tabFromPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateToTab = useCallback(
    (tab: TabKey) => {
      if (tab === activeTab) return;
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      setIsTabTransitioning(true);
      transitionTimerRef.current = setTimeout(() => {
        setActiveTab(tab);
        window.history.pushState(null, "", `/admin/monitoring/${tab}`);
        setIsTabTransitioning(false);
      }, 80);
    },
    [activeTab]
  );

  useEffect(() => {
    const onPopState = () => {
      const segments = window.location.pathname.split("/").filter(Boolean);
      const maybeTab = segments[segments.length - 1] as TabKey;
      if (TAB_SET.has(maybeTab)) setActiveTab(maybeTab);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    loadCloudData();
  }, [loadCloudData]);
  const {
    system,
    containers,
    website,
    lastUpdated,
    isLoading,
    isRefreshing,
    error,
    connectionStatus,
    refresh,
    resetConnection,
  } = useMonitoringData({ refreshInterval: 5000 });

  // Quick health summary for overview
  const healthSummary = {
    issues: [
      system?.cpu?.status === "critical" && "CPU วิกฤต",
      system?.cpu?.status === "warning" && "CPU สูง",
      system?.memory?.status === "critical" && "Memory วิกฤต",
      system?.memory?.status === "warning" && "Memory สูง",
      system?.disk?.status === "critical" && "Disk วิกฤต",
      system?.disk?.status === "warning" && "Disk เหลือน้อย",
      website?.uptime?.isUp === false && "เว็บไซต์ล่ม",
      website?.errorRate?.status === "critical" && "Error Rate สูง",
    ].filter(Boolean) as string[],
  };

  const overallStatus =
    healthSummary.issues.some((i) => i.includes("Critical") || i.includes("Down"))
      ? "critical"
      : healthSummary.issues.length > 0
      ? "warning"
      : "healthy";

  const handleRefreshAll = useCallback(async () => {
    refresh();
    await loadCloudData();
  }, [refresh, loadCloudData]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-50/10">
            <Icon
              icon="solar:monitor-smartphone-bold"
              className="text-2xl text-primary"
            />
          </div>
          <div>
            <h2 className="text-lg font-bold">ระบบมอนิเตอร์</h2>
            <p className="text-xs text-default-400">
              ติดตามเซิร์ฟเวอร์ เว็บไซต์ และ container แบบเรียลไทม์
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ConnectionStatusBadge
            status={connectionStatus}
            lastUpdated={lastUpdated}
            onReconnect={resetConnection}
          />
          <Tooltip content="รีเฟรชทันที">
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              isLoading={isRefreshing}
              onPress={handleRefreshAll}
            >
              <Icon icon="solar:refresh-bold" className="text-lg" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Overall Health Banner */}
      {!isLoading && (
        <Card
          className={`border shadow-sm ${
            overallStatus === "healthy"
              ? "border-success/30 bg-success-50/30 dark:bg-success-50/5"
              : overallStatus === "warning"
              ? "border-warning/30 bg-warning-50/30 dark:bg-warning-50/5"
              : "border-danger/30 bg-danger-50/30 dark:bg-danger-50/5"
          }`}
        >
          <CardBody className="p-3 flex flex-row items-center gap-3">
            <Icon
              icon={
                overallStatus === "healthy"
                  ? "solar:check-circle-bold"
                  : overallStatus === "warning"
                  ? "solar:danger-triangle-bold"
                  : "solar:close-circle-bold"
              }
              className={`text-2xl ${
                overallStatus === "healthy"
                  ? "text-success"
                  : overallStatus === "warning"
                  ? "text-warning"
                  : "text-danger"
              }`}
            />
            <div>
              <p className="text-sm font-semibold">
                {overallStatus === "healthy" ? "ระบบปกติ" : overallStatus === "warning" ? "ระบบแจ้งเตือน" : "ระบบวิกฤต"}
              </p>
              <p className="text-xs text-default-500">
                {overallStatus === "healthy"
                  ? "ทุกระบบทำงานปกติ"
                  : `${healthSummary.issues.length} ปัญหา: ${healthSummary.issues.join(", ")}`}
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Error Banner */}
      {error && (
        <Card className="border border-danger/30 bg-danger-50/30 dark:bg-danger-50/5 shadow-sm">
          <CardBody className="p-3 flex flex-row items-center gap-3">
            <Icon
              icon="solar:shield-warning-bold"
              className="text-xl text-danger"
            />
            <div>
              <p className="text-sm font-medium text-danger">
                ข้อผิดพลาดการเชื่อมต่อ
              </p>
              <p className="text-xs text-default-500">{error}</p>
            </div>
            <Button
              size="sm"
              variant="flat"
              color="danger"
              className="ml-auto"
              onPress={resetConnection}
            >
              ลองใหม่
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-default-100 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => navigateToTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-default-500 hover:text-foreground"
            }`}
          >
            <Icon icon={tab.icon} className="text-sm" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          opacity: isTabTransitioning ? 0.72 : 1,
          transition: "opacity 80ms ease",
        }}
      >
      {isLoading ? (
        <LoadingGrid />
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Top-level gauges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <CpuCard data={system?.cpu ?? null} />
                <MemoryCard data={system?.memory ?? null} />
                <DiskCard data={system?.disk ?? null} />
                <WebsiteStatusCard data={website} />
              </div>

              {/* Secondary metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <ResponseTimeCard data={website?.responseTime ?? null} />
                <ErrorRateCard data={website?.errorRate ?? null} />
                <RequestRateCard data={website?.requestRate ?? null} />
              </div>

              <MonitoringTrendCharts
                system={system}
                website={website}
                containers={containers}
                lastUpdated={lastUpdated}
              />

              {/* Containers + extras */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ContainerListCard containers={containers} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NetworkCard data={system?.network ?? null} />
                  <LoadAverageCard data={system?.load ?? null} />
                  <UptimeCard data={system?.uptime ?? null} />
                  <StatusCodesCard data={website?.statusCodes ?? null} />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border border-default-200 shadow-sm">
                  <CardHeader className="pb-1 pt-3 px-4 flex items-center justify-between">
                    <p className="text-xs text-default-500 font-medium">Cloud Overview</p>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={
                        cloudOverview?.overallStatus === "up"
                          ? "success"
                          : cloudOverview?.overallStatus === "warning"
                          ? "warning"
                          : "danger"
                      }
                    >
                      {cloudOverview?.overallStatus ?? "unknown"}
                    </Chip>
                  </CardHeader>
                  <CardBody className="pt-2 px-4 pb-4">
                    {!cloudOverview ? (
                      <p className="text-sm text-default-400">ไม่มีข้อมูล cloud</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-default-500">Provider</span>
                          <span className="font-medium">{cloudOverview.provider}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">Storage Used</span>
                          <span className="font-medium">{cloudOverview.storage.totalGB.toFixed(2)} GB</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">Objects</span>
                          <span className="font-medium">{cloudOverview.storage.objectCount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">R2 Status</span>
                          <span className={cloudOverview.r2.status === "up" ? "text-success" : "text-danger"}>{cloudOverview.r2.status}</span>
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>

                <Card className="border border-default-200 shadow-sm">
                  <CardHeader className="pb-1 pt-3 px-4">
                    <p className="text-xs text-default-500 font-medium">Estimated Cloud Cost</p>
                  </CardHeader>
                  <CardBody className="pt-2 px-4 pb-4">
                    {!cloudCost ? (
                      <p className="text-sm text-default-400">ไม่มีข้อมูลต้นทุน</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-default-500">MTD Total</span>
                          <span className="font-semibold">{cloudCost.mtd.total.toFixed(4)} {cloudCost.currency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">Storage</span>
                          <span>{cloudCost.mtd.storage.toFixed(4)} {cloudCost.currency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">Operations</span>
                          <span>{cloudCost.mtd.operations.toFixed(4)} {cloudCost.currency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">Forecast / month</span>
                          <span className="font-medium">{cloudCost.forecast.monthly.toFixed(4)} {cloudCost.currency}</span>
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>

              <SystemOperationsControlCard title={t("adminSystemOpsRecentTitle")} />
            </div>
          )}

          {/* SYSTEM TAB */}
          {activeTab === "system" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <CpuCard data={system?.cpu ?? null} />
                <MemoryCard data={system?.memory ?? null} />
                <DiskCard data={system?.disk ?? null} />
                <NetworkCard data={system?.network ?? null} />
                <LoadAverageCard data={system?.load ?? null} />
                <UptimeCard data={system?.uptime ?? null} />
              </div>
            </div>
          )}

          {/* WEBSITE TAB */}
          {activeTab === "website" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <WebsiteStatusCard data={website} />
                <ResponseTimeCard data={website?.responseTime ?? null} />
                <ErrorRateCard data={website?.errorRate ?? null} />
                <RequestRateCard data={website?.requestRate ?? null} />
                <StatusCodesCard data={website?.statusCodes ?? null} />
              </div>
            </div>
          )}

          {/* CONTAINERS TAB */}
          {activeTab === "containers" && (
            <div className="space-y-6">
              <ContainerListCard containers={containers} />
            </div>
          )}
        </>
      )}
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between text-[11px] text-default-400 pt-2">
        <span>รีเฟรชอัตโนมัติ: ทุก 5 วินาที</span>
        {lastUpdated && (
          <span>
            อัปเดตล่าสุด: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
