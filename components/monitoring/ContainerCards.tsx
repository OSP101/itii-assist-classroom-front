"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Icon } from "@iconify/react";
import { StatusIndicator, getProgressColor } from "./shared";
import type { ContainerMetrics } from "@/services/monitoring.service";

// ---------------------------------------------------------------------------
// Container List Card
// ---------------------------------------------------------------------------

interface ContainerListCardProps {
  containers: ContainerMetrics[];
}

export function ContainerListCard({ containers }: ContainerListCardProps) {
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
            ไม่มีข้อมูล container
          </p>
        </CardBody>
      </Card>
    );
  }

  const runningCount = containers.filter((c) => c.status === "running").length;

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
          color={runningCount === containers.length ? "success" : "warning"}
          className="text-[10px] h-5"
        >
          {runningCount}/{containers.length} running
        </Chip>
      </CardHeader>
      <CardBody className="pt-2 px-4 pb-4">
        <div className="space-y-3">
          {containers.map((container) => (
            <ContainerRow key={container.name} container={container} />
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
}

function ContainerRow({ container }: ContainerRowProps) {
  const memPercent =
    container.memoryLimitMB > 0
      ? (container.memoryUsageMB / container.memoryLimitMB) * 100
      : 0;

  const statusMap: Record<string, "up" | "down"> = {
    running: "up",
    stopped: "down",
    restarting: "down",
  };

  return (
    <div className="p-2.5 rounded-lg bg-default-50 dark:bg-default-50/50 border border-default-100">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <StatusIndicator
            status={statusMap[container.status] || "down"}
          />
          <span className="text-sm font-medium truncate max-w-[180px]">
            {container.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {container.restarts > 0 && (
            <Chip
              size="sm"
              variant="flat"
              color="warning"
              className="text-[10px] h-5"
              startContent={
                <Icon icon="solar:restart-bold" className="text-[10px]" />
              }
            >
              {container.restarts}
            </Chip>
          )}
          <Chip
            size="sm"
            variant="flat"
            color={container.status === "running" ? "success" : "danger"}
            className="text-[10px] h-5 capitalize"
          >
            {container.status}
          </Chip>
        </div>
      </div>

      {/* CPU + Memory bars */}
      <div className="space-y-1.5">
        {/* CPU */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-0.5">
            <span className="text-default-400">CPU</span>
            <span className="font-mono font-medium">
              {container.cpuPercent.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-default-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 bg-${getProgressColor(
                container.cpuPercent
              )}`}
              style={{
                width: `${Math.min(container.cpuPercent, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Memory */}
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
                memPercent
              )}`}
              style={{
                width: `${Math.min(memPercent, 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
