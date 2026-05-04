"use client";

import { CircularProgress, MetricCard, formatBytes } from "./shared";
import type { SystemMetrics } from "@/services/monitoring.service";

// ---------------------------------------------------------------------------
// CPU Card
// ---------------------------------------------------------------------------

interface CpuCardProps {
  data: SystemMetrics["cpu"] | null;
}

export function CpuCard({ data }: CpuCardProps) {
  if (!data) {
    return (
      <MetricCard title="การใช้งาน CPU" icon="solar:cpu-bolt-bold" value="--" />
    );
  }

  return (
    <MetricCard
      title="การใช้งาน CPU"
      icon="solar:cpu-bolt-bold"
      value={`${data.usagePercent.toFixed(1)}%`}
      subtitle={`${data.cores} cores · ${data.model || "ไม่ทราบ"}`}
      status={data.status}
    >
      <div className="flex justify-center mt-2">
        <CircularProgress
          value={data.usagePercent}
          size={90}
          strokeWidth={7}
          label="CPU"
        />
      </div>
    </MetricCard>
  );
}

// ---------------------------------------------------------------------------
// Memory Card
// ---------------------------------------------------------------------------

interface MemoryCardProps {
  data: SystemMetrics["memory"] | null;
}

export function MemoryCard({ data }: MemoryCardProps) {
  if (!data) {
    return (
      <MetricCard title="หน่วยความจำ" icon="solar:ram-bold" value="--" />
    );
  }

  return (
    <MetricCard
      title="หน่วยความจำ"
      icon="solar:ram-bold"
      value={`${data.usagePercent.toFixed(1)}%`}
      subtitle={`${formatBytes(data.usedGB)} / ${formatBytes(data.totalGB)}`}
      status={data.status}
    >
      <div className="flex justify-center mt-2">
        <CircularProgress
          value={data.usagePercent}
          size={90}
          strokeWidth={7}
          label="RAM"
          sublabel={`${formatBytes(data.availableGB)} ว่าง`}
        />
      </div>
    </MetricCard>
  );
}

// ---------------------------------------------------------------------------
// Disk Card
// ---------------------------------------------------------------------------

interface DiskCardProps {
  data: SystemMetrics["disk"] | null;
}

export function DiskCard({ data }: DiskCardProps) {
  if (!data) {
    return (
      <MetricCard title="ดิสก์" icon="solar:hard-drive-bold" value="--" />
    );
  }

  return (
    <MetricCard
      title="ดิสก์"
      icon="solar:hard-drive-bold"
      value={`${data.usagePercent.toFixed(1)}%`}
      subtitle={`${formatBytes(data.usedGB)} / ${formatBytes(data.totalGB)}`}
      status={data.status}
    >
      <div className="flex justify-center mt-2">
        <CircularProgress
          value={data.usagePercent}
          size={90}
          strokeWidth={7}
          label="Disk"
          sublabel={`${formatBytes(data.availableGB)} ว่าง`}
        />
      </div>
    </MetricCard>
  );
}

// ---------------------------------------------------------------------------
// Network Card
// ---------------------------------------------------------------------------

interface NetworkCardProps {
  data: SystemMetrics["network"] | null;
}

export function NetworkCard({ data }: NetworkCardProps) {
  if (!data) {
    return (
      <MetricCard
        title="เครือข่าย"
        icon="solar:global-bold"
        value="--"
      />
    );
  }

  return (
    <MetricCard
      title="Network I/O"
      icon="solar:global-bold"
      value={`↓ ${data.receiveMBps.toFixed(2)} MB/s`}
      subtitle={`↑ ${data.transmitMBps.toFixed(2)} MB/s`}
    >
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-default-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            รับ
          </span>
          <span className="font-mono font-medium">
            {data.receiveMBps.toFixed(2)} MB/s
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-default-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            ส่ง
          </span>
          <span className="font-mono font-medium">
            {data.transmitMBps.toFixed(2)} MB/s
          </span>
        </div>
      </div>
    </MetricCard>
  );
}

// ---------------------------------------------------------------------------
// Load Average Card
// ---------------------------------------------------------------------------

interface LoadAverageCardProps {
  data: SystemMetrics["load"] | null;
}

export function LoadAverageCard({ data }: LoadAverageCardProps) {
  if (!data) {
    return (
      <MetricCard
        title="Load Average"
        icon="solar:chart-bold"
        value="--"
      />
    );
  }

  return (
    <MetricCard
      title="Load Average"
      icon="solar:chart-bold"
      value={data.load1m.toFixed(2)}
      subtitle={`${data.cpuCount} CPU cores`}
      status={data.status}
    >
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-bold">{data.load1m.toFixed(2)}</p>
          <p className="text-[10px] text-default-400">1 min</p>
        </div>
        <div>
          <p className="text-sm font-bold">{data.load5m.toFixed(2)}</p>
          <p className="text-[10px] text-default-400">5 min</p>
        </div>
        <div>
          <p className="text-sm font-bold">{data.load15m.toFixed(2)}</p>
          <p className="text-[10px] text-default-400">15 min</p>
        </div>
      </div>
    </MetricCard>
  );
}

// ---------------------------------------------------------------------------
// Uptime Card
// ---------------------------------------------------------------------------

interface UptimeCardProps {
  data: SystemMetrics["uptime"] | null;
}

export function UptimeCard({ data }: UptimeCardProps) {
  if (!data) {
    return (
      <MetricCard
        title="เวลาทำงาน"
        icon="solar:clock-circle-bold"
        value="--"
      />
    );
  }

  return (
    <MetricCard
      title="เวลาทำงานเซิร์ฟเวอร์"
      icon="solar:clock-circle-bold"
      value={data.formatted || formatBigUptime(data.seconds)}
    >
      <p className="text-xs text-default-400 mt-1">
        ทำงานมาแล้ว {Math.floor(data.seconds / 86400)} วัน
      </p>
    </MetricCard>
  );
}

function formatBigUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
