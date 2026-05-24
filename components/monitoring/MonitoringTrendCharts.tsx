"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { monitoringService } from "@/services/monitoring.service";
import type { ContainerMetrics, SystemMetrics, WebsiteMetrics } from "@/services/monitoring.service";

type RangeKey = "15m" | "1h" | "6h" | "24h" | "all";

interface TrendPoint {
  timestamp: number;
  label: string;
  cpu: number;
  memory: number;
  disk: number;
  responseMs: number;
  errorRate: number;
  requestsPerMin: number;
  runningContainers: number;
}

interface MonitoringTrendChartsProps {
  system: SystemMetrics | null;
  website: WebsiteMetrics | null;
  containers: ContainerMetrics[];
  lastUpdated: Date | null;
}

const RANGE_MS: Record<Exclude<RangeKey, "all">, number> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

const SAMPLE_INTERVAL_MS = 20 * 1000;

function toTimeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function safeNum(v: number | undefined): number {
  if (!Number.isFinite(v)) return 0;
  return Number(v);
}

export function MonitoringTrendCharts({
  system,
  website,
  containers,
  lastUpdated,
}: MonitoringTrendChartsProps) {
  const [range, setRange] = useState<RangeKey>("1h");
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      const rows = await monitoringService.getTrendHistory(range);
      if (cancelled) return;

      const mapped = rows
        .map((row) => {
          const ts = new Date(row.timestamp).getTime();
          if (!Number.isFinite(ts)) return null;
          return {
            timestamp: ts,
            label: toTimeLabel(ts),
            cpu: safeNum(row.cpuPercent),
            memory: safeNum(row.memoryPercent),
            disk: safeNum(row.diskPercent),
            responseMs: safeNum(row.responseAvgMs),
            errorRate: safeNum(row.errorPercent),
            requestsPerMin: safeNum(row.requestsPerMinute),
            runningContainers: safeNum(row.runningContainers),
          } satisfies TrendPoint;
        })
        .filter((row): row is TrendPoint => row !== null)
        .sort((a, b) => a.timestamp - b.timestamp);

      setPoints(mapped);
      setIsLoadingHistory(false);
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [range]);

  useEffect(() => {
    if (!lastUpdated || !system || !website) return;

    const ts = lastUpdated.getTime();
    setPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && ts - last.timestamp < SAMPLE_INTERVAL_MS) {
        return prev;
      }

      const nextPoint: TrendPoint = {
        timestamp: ts,
        label: toTimeLabel(ts),
        cpu: safeNum(system.cpu?.usagePercent),
        memory: safeNum(system.memory?.usagePercent),
        disk: safeNum(system.disk?.usagePercent),
        responseMs: safeNum(website.responseTime?.avgMs),
        errorRate: safeNum(website.errorRate?.percent),
        requestsPerMin: safeNum(website.requestRate?.perMinute),
        runningContainers: containers.filter((c) => c.status === "running").length,
      };

      return [...prev, nextPoint].sort((a, b) => a.timestamp - b.timestamp);
    });
  }, [lastUpdated, system, website, containers]);

  const filteredPoints = useMemo(() => {
    if (range === "all") return points;
    const now = Date.now();
    const from = now - RANGE_MS[range];
    return points.filter((p) => p.timestamp >= from);
  }, [points, range]);

  const insight = useMemo(() => {
    if (filteredPoints.length === 0) {
      return {
        peakCpu: 0,
        avgResponse: 0,
        incidents: 0,
      };
    }

    const peakCpu = filteredPoints.reduce((m, p) => Math.max(m, p.cpu), 0);
    const avgResponse =
      filteredPoints.reduce((s, p) => s + p.responseMs, 0) / filteredPoints.length;
    const incidents = filteredPoints.filter((p) => p.errorRate >= 1.5 || p.responseMs >= 1500).length;

    return {
      peakCpu,
      avgResponse,
      incidents,
    };
  }, [filteredPoints]);

  return (
    <div className="space-y-4">
      <Card className="border border-default-200 shadow-sm">
        <CardHeader className="pb-2 pt-3 px-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Monitoring Trends</p>
            <p className="text-xs text-default-500">ดูย้อนหลังได้สูงสุด 24 ชั่วโมง พร้อมภาพรวมที่อ่านง่าย</p>
          </div>
          <Select
            aria-label="Select trend range"
            selectedKeys={[range]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0];
              if (typeof value === "string") {
                setRange(value as RangeKey);
              }
            }}
            className="w-40"
            size="sm"
            variant="bordered"
          >
            <SelectItem key="15m">ล่าสุด 15 นาที</SelectItem>
            <SelectItem key="1h">ล่าสุด 1 ชั่วโมง</SelectItem>
            <SelectItem key="6h">ล่าสุด 6 ชั่วโมง</SelectItem>
            <SelectItem key="24h">ล่าสุด 24 ชั่วโมง</SelectItem>
            <SelectItem key="all">ตั้งแต่เปิดหน้า</SelectItem>
          </Select>
        </CardHeader>
        <CardBody className="pt-1 px-4 pb-4">
          {isLoadingHistory && filteredPoints.length === 0 ? (
            <div className="rounded-lg border border-dashed border-default-300 p-4 text-sm text-default-500">
              กำลังโหลดประวัติแนวโน้มย้อนหลัง...
            </div>
          ) : filteredPoints.length < 2 ? (
            <div className="rounded-lg border border-dashed border-default-300 p-4 text-sm text-default-500">
              กำลังเก็บข้อมูลแนวโน้ม... ระบบจะสร้างกราฟเมื่อมีข้อมูลสะสมอย่างน้อย 2 จุด
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-lg border border-default-200 bg-default-50 p-3">
                <p className="text-xs text-default-500">Peak CPU</p>
                <p className="mt-1 text-xl font-semibold">{insight.peakCpu.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-default-200 bg-default-50 p-3">
                <p className="text-xs text-default-500">Avg Response</p>
                <p className="mt-1 text-xl font-semibold">{insight.avgResponse.toFixed(0)} ms</p>
              </div>
              <div className="rounded-lg border border-default-200 bg-default-50 p-3">
                <p className="text-xs text-default-500">Incidents</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-xl font-semibold">{insight.incidents}</p>
                  <Chip size="sm" variant="flat" color={insight.incidents > 0 ? "warning" : "success"}>
                    {insight.incidents > 0 ? "ต้องเฝ้าดู" : "ปกติ"}
                  </Chip>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border border-default-200 shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4">
            <p className="text-xs text-default-500 font-medium">System Utilization Trend (%)</p>
          </CardHeader>
          <CardBody className="pt-2 px-4 pb-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredPoints} margin={{ top: 8, right: 10, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={22} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip />
                  <Line type="monotone" dataKey="cpu" name="CPU" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="memory" name="Memory" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="disk" name="Disk" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card className="border border-default-200 shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4">
            <p className="text-xs text-default-500 font-medium">Website Quality Trend</p>
          </CardHeader>
          <CardBody className="pt-2 px-4 pb-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredPoints} margin={{ top: 8, right: 10, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={22} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={34} />
                  <Tooltip />
                  <Area yAxisId="right" type="monotone" dataKey="errorRate" name="Error %" stroke="#ef4444" fill="#fecaca" fillOpacity={0.55} />
                  <Line yAxisId="left" type="monotone" dataKey="responseMs" name="Response (ms)" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card className="border border-default-200 shadow-sm xl:col-span-2">
          <CardHeader className="pb-1 pt-3 px-4">
            <p className="text-xs text-default-500 font-medium">Traffic & Runtime Trend</p>
          </CardHeader>
          <CardBody className="pt-2 px-4 pb-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredPoints} margin={{ top: 8, right: 10, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={22} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={34} />
                  <Tooltip />
                  <Area yAxisId="left" type="monotone" dataKey="requestsPerMin" name="Requests/min" stroke="#6366f1" fill="#c7d2fe" fillOpacity={0.5} />
                  <Line yAxisId="right" type="monotone" dataKey="runningContainers" name="Running containers" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
