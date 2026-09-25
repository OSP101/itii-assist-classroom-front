"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Icon } from "@iconify/react";
import { StatusIndicator, getProgressColor } from "./shared";
import { useI18n } from "@/hooks/useI18n";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import type { ContainerMetrics } from "@/services/monitoring.service";

type Translate = ReturnType<typeof useI18n>;

function formatDuration(seconds: number, t: Translate): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return t("uptimeDaysHours", { days, hours });
  if (hours > 0) return t("uptimeHoursMinutes", { hours, minutes });
  return t("uptimeMinutes", { minutes });
}

function secondsSince(iso: string): number {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return 0;
  return Math.max(0, (Date.now() - time) / 1000);
}

// Problems first (restarting, unhealthy), then running, then stopped — the
// standby blue/green slot is always stopped and would otherwise push the
// live containers down the list.
function sortRank(container: ContainerMetrics): number {
  if (container.status === "restarting") return 0;
  if (container.status === "running" && container.health === "unhealthy") return 1;
  if (container.status === "running") return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// Container List Card
// ---------------------------------------------------------------------------

interface ContainerListCardProps {
  containers: ContainerMetrics[];
  /** Two columns on md+; only when the card spans the full page width. */
  wide?: boolean;
}

export function ContainerListCard({ containers, wide = false }: ContainerListCardProps) {
  const t = useI18n();

  if (!containers || containers.length === 0) {
    return (
      <Card className="border border-default-200 shadow-sm">
        <CardHeader className="pb-1 pt-3 px-4">
          <div className="flex items-center gap-2">
            <Icon icon="solar:box-bold" className="text-default-500" />
            <p className="text-xs text-default-500 font-medium">Containers</p>
          </div>
        </CardHeader>
        <CardBody className="pt-2 px-4 pb-4">
          <p className="text-sm text-default-400 text-center py-4">
            {t("adminMonitoringContainersEmpty")}
          </p>
        </CardBody>
      </Card>
    );
  }

  const runningCount = containers.filter((c) => c.status === "running").length;
  const hasProblem = containers.some(
    (c) => c.status === "restarting" || c.health === "unhealthy",
  );
  const sorted = [...containers].sort(
    (a, b) => sortRank(a) - sortRank(b) || a.name.localeCompare(b.name),
  );

  return (
    <Card className="border border-default-200 shadow-sm">
      <CardHeader className="pb-1 pt-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="solar:box-bold" className="text-default-500" />
          <p className="text-xs text-default-500 font-medium">Containers</p>
        </div>
        <Chip
          size="sm"
          variant="flat"
          color={hasProblem ? "warning" : "success"}
          className="text-[10px] h-5"
        >
          {t("adminMonitoringContainersRunning", {
            running: runningCount,
            total: containers.length,
          })}
        </Chip>
      </CardHeader>
      <CardBody className="pt-2 px-4 pb-4">
        <div className={`grid gap-3 ${wide ? "md:grid-cols-2" : ""}`}>
          {sorted.map((container) => (
            <ContainerRow key={container.name} container={container} t={t} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Container Row
// ---------------------------------------------------------------------------

interface ContainerRowProps {
  container: ContainerMetrics;
  t: Translate;
}

function ContainerRow({ container, t }: ContainerRowProps) {
  const { language } = useGlobalSettings();
  const isRunning = container.status === "running";

  // cpuPercent is `docker stats` style (100% = one core), so scale the bar
  // against the container's own quota when it has one.
  const cpuBarPercent =
    container.cpuLimitCores > 0
      ? container.cpuPercent / container.cpuLimitCores
      : container.cpuPercent;
  const memPercent =
    container.memoryLimitMB > 0
      ? (container.memoryUsageMB / container.memoryLimitMB) * 100
      : 0;

  const statusLabel: Record<ContainerMetrics["status"], string> = {
    running: t("adminMonitoringContainerStatusRunning"),
    stopped: t("adminMonitoringContainerStatusStopped"),
    restarting: t("adminMonitoringContainerStatusRestarting"),
  };
  const healthLabel: Record<string, { text: string; color: "success" | "danger" | "warning" }> = {
    healthy: { text: t("adminMonitoringContainerHealthHealthy"), color: "success" },
    unhealthy: { text: t("adminMonitoringContainerHealthUnhealthy"), color: "danger" },
    starting: { text: t("adminMonitoringContainerHealthStarting"), color: "warning" },
  };
  const health = healthLabel[container.health];

  const startedTitle = container.startedAt
    ? t("adminMonitoringContainerStartedAt", {
        time: new Date(container.startedAt).toLocaleString(
          language === "th" ? "th-TH" : "en-GB",
        ),
      })
    : undefined;

  let timeline: string | null = null;
  if (isRunning && container.uptimeSeconds > 0) {
    timeline = t("adminMonitoringContainerUpFor", {
      duration: formatDuration(container.uptimeSeconds, t),
    });
  } else if (!isRunning && container.finishedAt) {
    timeline = t("adminMonitoringContainerStoppedFor", {
      duration: formatDuration(secondsSince(container.finishedAt), t),
    });
  }

  return (
    <div
      className={`p-2.5 rounded-lg bg-default-50 dark:bg-default-50/50 border border-default-100 ${
        container.status === "stopped" ? "opacity-60" : ""
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="mt-1.5">
            <StatusIndicator status={isRunning ? "up" : "down"} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{container.name}</p>
            {container.image && (
              <p className="text-[11px] text-default-400 font-mono truncate">
                {container.image}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {health && (
            <Chip size="sm" variant="flat" color={health.color} className="text-[10px] h-5">
              {health.text}
            </Chip>
          )}
          {container.restarts > 0 && (
            <Chip
              size="sm"
              variant="flat"
              color="warning"
              className="text-[10px] h-5"
              startContent={<Icon icon="solar:restart-bold" className="text-[10px]" />}
            >
              {t("adminMonitoringContainerRestarts", { count: container.restarts })}
            </Chip>
          )}
          <Chip
            size="sm"
            variant="flat"
            color={isRunning ? "success" : container.status === "restarting" ? "warning" : "default"}
            className="text-[10px] h-5"
          >
            {statusLabel[container.status]}
          </Chip>
        </div>
      </div>

      {timeline && (
        <div
          className="flex items-center gap-1 text-[11px] text-default-500 mb-2"
          title={startedTitle}
        >
          <Icon icon="solar:clock-circle-linear" className="text-xs shrink-0" />
          <span>{timeline}</span>
        </div>
      )}

      {/* CPU + Memory bars (only meaningful while running) */}
      {isRunning && (
        <div className="space-y-1.5">
          <div>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-default-400">CPU</span>
              <span className="font-mono font-medium">
                {container.cpuPercent.toFixed(1)}%
                <span className="text-default-400 font-sans font-normal ml-1">
                  (
                  {container.cpuLimitCores > 0
                    ? t("adminMonitoringContainerCpuLimit", { cores: container.cpuLimitCores })
                    : t("adminMonitoringContainerNoLimit")}
                  )
                </span>
              </span>
            </div>
            <div className="h-1.5 bg-default-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 bg-${getProgressColor(
                  cpuBarPercent,
                )}`}
                style={{ width: `${Math.min(cpuBarPercent, 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-default-400">Memory</span>
              <span className="font-mono font-medium">
                {container.memoryUsageMB.toFixed(0)} MB
                {container.memoryLimitMB > 0 &&
                  ` / ${container.memoryLimitMB.toFixed(0)} MB`}
              </span>
            </div>
            <div className="h-1.5 bg-default-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 bg-${getProgressColor(
                  memPercent,
                )}`}
                style={{ width: `${Math.min(memPercent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
