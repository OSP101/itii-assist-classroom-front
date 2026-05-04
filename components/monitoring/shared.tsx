"use client";

import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Icon } from "@iconify/react";

// ---------------------------------------------------------------------------
// Shared types & utilities
// ---------------------------------------------------------------------------

export type StatusLevel = "normal" | "warning" | "critical";
export type WebsiteStatus = "good" | "slow" | "critical";

export function getStatusColor(status: StatusLevel | WebsiteStatus): string {
  switch (status) {
    case "normal":
    case "good":
      return "success";
    case "warning":
    case "slow":
      return "warning";
    case "critical":
      return "danger";
    default:
      return "default";
  }
}

export function getStatusBgClass(status: StatusLevel | WebsiteStatus): string {
  switch (status) {
    case "normal":
    case "good":
      return "bg-success-50 dark:bg-success-50/10";
    case "warning":
    case "slow":
      return "bg-warning-50 dark:bg-warning-50/10";
    case "critical":
      return "bg-danger-50 dark:bg-danger-50/10";
    default:
      return "bg-default-50";
  }
}

export function getStatusIconColor(status: StatusLevel | WebsiteStatus): string {
  switch (status) {
    case "normal":
    case "good":
      return "text-success";
    case "warning":
    case "slow":
      return "text-warning";
    case "critical":
      return "text-danger";
    default:
      return "text-default-500";
  }
}

export function getProgressColor(percent: number): "success" | "warning" | "danger" {
  if (percent < 70) return "success";
  if (percent < 85) return "warning";
  return "danger";
}

export function formatBytes(gb: number): string {
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(gb * 1024).toFixed(0)} MB`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ---------------------------------------------------------------------------
// CircularProgress - a simple SVG donut gauge
// ---------------------------------------------------------------------------

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
}

export function CircularProgress({
  value,
  size = 100,
  strokeWidth = 8,
  label,
  sublabel,
  color,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;
  const resolvedColor =
    color || (value < 70 ? "#17c964" : value < 85 ? "#f5a524" : "#f31260");

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-default-200 dark:text-default-100"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none">
          {value.toFixed(1)}%
        </span>
        {label && (
          <span className="text-[10px] text-default-500 mt-0.5">{label}</span>
        )}
        {sublabel && (
          <span className="text-[10px] text-default-400">{sublabel}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricCard - reusable stat card
// ---------------------------------------------------------------------------

interface MetricCardProps {
  title: string;
  icon: string;
  value: string | number;
  subtitle?: string;
  status?: StatusLevel | WebsiteStatus;
  children?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  title,
  icon,
  value,
  subtitle,
  status,
  children,
  className = "",
}: MetricCardProps) {
  return (
    <Card
      className={`border border-default-200 shadow-sm ${className}`}
    >
      <CardBody className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${
                status ? getStatusBgClass(status) : "bg-default-100"
              }`}
            >
              <Icon
                icon={icon}
                className={`text-lg ${
                  status ? getStatusIconColor(status) : "text-default-500"
                }`}
              />
            </div>
            <div>
              <p className="text-xs text-default-500 font-medium">{title}</p>
              <p className="text-xl font-bold leading-tight">{value}</p>
            </div>
          </div>
          {status && (
            <Chip
              size="sm"
              variant="flat"
              color={getStatusColor(status) as "success" | "warning" | "danger" | "default"}
              className="capitalize text-[10px] h-5"
            >
              {status}
            </Chip>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-default-400 mb-2">{subtitle}</p>
        )}
        {children}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ConnectionStatusBadge
// ---------------------------------------------------------------------------

interface ConnectionStatusBadgeProps {
  status: "connected" | "disconnected" | "connecting";
  lastUpdated: Date | null;
  onReconnect?: () => void;
}

export function ConnectionStatusBadge({
  status,
  lastUpdated,
  onReconnect,
}: ConnectionStatusBadgeProps) {
  const statusConfig = {
    connected: {
      icon: "solar:check-circle-bold",
      color: "success" as const,
      label: "เชื่อมต่อแล้ว",
    },
    disconnected: {
      icon: "solar:close-circle-bold",
      color: "danger" as const,
      label: "ขาดการเชื่อมต่อ",
    },
    connecting: {
      icon: "solar:refresh-circle-bold",
      color: "warning" as const,
      label: "กำลังเชื่อมต่อ...",
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <Tooltip
        content={
          lastUpdated
            ? `อัปเดตล่าสุด: ${lastUpdated.toLocaleTimeString()}`
            : "ยังไม่มีข้อมูล"
        }
      >
        <Chip
          startContent={
            <Icon
              icon={config.icon}
              className={`text-sm ${
                status === "connecting" ? "animate-spin" : ""
              }`}
            />
          }
          variant="flat"
          color={config.color}
          size="sm"
          className="cursor-default"
        >
          {config.label}
        </Chip>
      </Tooltip>
      {status === "disconnected" && onReconnect && (
        <button
          onClick={onReconnect}
          className="text-xs text-primary hover:underline"
        >
          ลองใหม่
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusIndicator - small inline dot indicator
// ---------------------------------------------------------------------------

interface StatusIndicatorProps {
  status: StatusLevel | WebsiteStatus | "up" | "down";
  label?: string;
  size?: "sm" | "md";
}

export function StatusIndicator({
  status,
  label,
  size = "sm",
}: StatusIndicatorProps) {
  const dotSize = size === "sm" ? "w-2 h-2" : "w-3 h-3";
  const colorMap: Record<string, string> = {
    normal: "bg-success",
    good: "bg-success",
    up: "bg-success",
    warning: "bg-warning",
    slow: "bg-warning",
    critical: "bg-danger",
    down: "bg-danger",
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${dotSize} rounded-full ${
          colorMap[status] || "bg-default-400"
        } ${status === "critical" || status === "down" ? "animate-pulse" : ""}`}
      />
      {label && (
        <span className="text-xs text-default-500 capitalize">{label}</span>
      )}
    </span>
  );
}
