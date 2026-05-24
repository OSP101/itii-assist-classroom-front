"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Icon } from "@iconify/react";
import { MetricCard, StatusIndicator, getProgressColor } from "./shared";
import type { WebsiteMetrics } from "@/services/monitoring.service";

// ---------------------------------------------------------------------------
// Website Status Card
// ---------------------------------------------------------------------------

interface WebsiteStatusCardProps {
  data: WebsiteMetrics | null;
}

export function WebsiteStatusCard({ data }: WebsiteStatusCardProps) {
  if (!data) {
    return (
      <MetricCard
        title="สถานะเว็บไซต์"
        icon="solar:monitor-bold"
        value="--"
      />
    );
  }

  return (
    <MetricCard
      title="สถานะเว็บไซต์"
      icon="solar:monitor-bold"
      value={data.uptime.isUp ? "ออนไลน์" : "ออฟไลน์"}
      status={data.uptime.isUp ? "good" : "critical"}
    >
      <div className="mt-2 space-y-2">
        <p className="text-[11px] leading-4 text-default-400">
          วัดจาก URL ที่ backend ตั้งไว้ใน MONITOR_PROBE_URLS ถ้าเข้าไม่ถึงจาก container ระบบจะขึ้นออฟไลน์
        </p>
        <div className="flex items-center justify-between text-xs">
          <span className="text-default-500">Uptime</span>
          <span className="font-mono font-medium">
            {data.uptime.uptimePercent.toFixed(2)}%
          </span>
        </div>
        {data.uptime.lastDowntime && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-default-500">ล่มล่าสุด</span>
            <span className="font-mono text-danger text-[11px]">
              {new Date(data.uptime.lastDowntime).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </MetricCard>
  );
}

// ---------------------------------------------------------------------------
// Response Time Card
// ---------------------------------------------------------------------------

interface ResponseTimeCardProps {
  data: WebsiteMetrics["responseTime"] | null;
}

export function ResponseTimeCard({ data }: ResponseTimeCardProps) {
  if (!data) {
    return (
      <MetricCard
        title="เวลาตอบสนอง"
        icon="solar:stopwatch-bold"
        value="--"
      />
    );
  }

  const maxBar = Math.max(data.p99Ms, 1);

  return (
    <MetricCard
      title="เวลาตอบสนอง"
      icon="solar:stopwatch-bold"
      value={`${data.avgMs.toFixed(0)} ms`}
      subtitle="เวลาตอบสนองเฉลี่ย"
      status={data.status}
    >
      <div className="mt-2 space-y-2">
        {/* Percentile bars */}
        {[
          { label: "p50", value: data.p50Ms },
          { label: "p95", value: data.p95Ms },
          { label: "p99", value: data.p99Ms },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-default-500 uppercase">{label}</span>
              <span className="font-mono font-medium">{value.toFixed(0)} ms</span>
            </div>
            <div className="h-1.5 bg-default-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  value < 500
                    ? "bg-success"
                    : value < 2000
                    ? "bg-warning"
                    : "bg-danger"
                }`}
                style={{ width: `${Math.min((value / maxBar) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </MetricCard>
  );
}

// ---------------------------------------------------------------------------
// Error Rate Card
// ---------------------------------------------------------------------------

interface ErrorRateCardProps {
  data: WebsiteMetrics["errorRate"] | null;
}

export function ErrorRateCard({ data }: ErrorRateCardProps) {
  if (!data) {
    return (
      <MetricCard
        title="Error Rate"
        icon="solar:danger-triangle-bold"
        value="--"
      />
    );
  }

  return (
    <MetricCard
      title="Error Rate"
      icon="solar:danger-triangle-bold"
      value={`${data.percent.toFixed(2)}%`}
      subtitle={`${data.totalRequests.toLocaleString()} คำขอทั้งหมด`}
      status={data.status}
    >
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-default-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-danger" />
            5xx Errors
          </span>
          <span className="font-mono font-medium text-danger">
            {data.total5xx.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-default-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-warning" />
            4xx Errors
          </span>
          <span className="font-mono font-medium text-warning">
            {data.total4xx.toLocaleString()}
          </span>
        </div>
      </div>
    </MetricCard>
  );
}

// ---------------------------------------------------------------------------
// Request Rate Card
// ---------------------------------------------------------------------------

interface RequestRateCardProps {
  data: WebsiteMetrics["requestRate"] | null;
}

export function RequestRateCard({ data }: RequestRateCardProps) {
  if (!data) {
    return (
      <MetricCard
        title="Request Rate"
        icon="solar:graph-up-bold"
        value="--"
      />
    );
  }

  return (
    <MetricCard
      title="Request Rate"
      icon="solar:graph-up-bold"
      value={`${data.perSecond.toFixed(1)} req/s`}
      subtitle={`${data.perMinute.toFixed(0)} req/min`}
    />
  );
}

// ---------------------------------------------------------------------------
// Status Codes Card
// ---------------------------------------------------------------------------

interface StatusCodesCardProps {
  data: WebsiteMetrics["statusCodes"] | null;
}

export function StatusCodesCard({ data }: StatusCodesCardProps) {
  if (!data || data.length === 0) {
    return (
      <MetricCard
        title="Status Codes"
        icon="solar:document-medicine-bold"
        value="--"
      />
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;

  const codeColor = (code: string): string => {
    if (code.startsWith("2")) return "bg-success";
    if (code.startsWith("3")) return "bg-primary";
    if (code.startsWith("4")) return "bg-warning";
    if (code.startsWith("5")) return "bg-danger";
    return "bg-default-400";
  };

  return (
    <Card className="border border-default-200 shadow-sm">
      <CardHeader className="pb-1 pt-3 px-4">
        <div className="flex items-center gap-2">
          <Icon icon="solar:document-medicine-bold" className="text-default-500" />
          <p className="text-xs text-default-500 font-medium">
            HTTP Status Codes
          </p>
        </div>
      </CardHeader>
      <CardBody className="pt-1 px-4 pb-4">
        {/* Stacked bar */}
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-3">
          {data.map(({ code, count }) => (
            <div
              key={code}
              className={`${codeColor(code)} transition-all duration-500`}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${code}: ${count}`}
            />
          ))}
        </div>
        {/* Legend */}
        <div className="grid grid-cols-2 gap-1.5">
          {data.map(({ code, count }) => (
            <div key={code} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-default-500">
                <span
                  className={`w-2 h-2 rounded-full ${codeColor(code)}`}
                />
                {code}
              </span>
              <span className="font-mono font-medium">
                {count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
