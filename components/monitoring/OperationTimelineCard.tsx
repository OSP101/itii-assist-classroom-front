"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Icon } from "@iconify/react";

import { useI18n } from "@/hooks/useI18n";
import type { SystemOperationRecord } from "@/services/system-operations.service";

interface OperationTimelineCardProps {
  operations: SystemOperationRecord[];
}

function formatElapsedMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "-";
  if (durationMs < 1000) return `${durationMs} ms`;

  const totalSec = Math.floor(durationMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

function statusColor(status: SystemOperationRecord["status"]): "success" | "danger" | "warning" {
  if (status === "success") return "success";
  if (status === "cancelled") return "warning";
  return "danger";
}

function statusIcon(status: SystemOperationRecord["status"]): string {
  if (status === "success") return "solar:check-circle-bold";
  if (status === "cancelled") return "solar:close-circle-bold";
  return "solar:danger-circle-bold";
}

function actionLabel(action: SystemOperationRecord["action"], t: ReturnType<typeof useI18n>): string {
  if (action === "restart_service") return t("adminSystemOpsActionRestart");
  return t("adminSystemOpsActionReboot");
}

function statusLabel(status: SystemOperationRecord["status"], t: ReturnType<typeof useI18n>): string {
  if (status === "success") return t("adminSystemOpsStatusSuccess");
  if (status === "failed") return t("adminSystemOpsStatusFailed");
  return t("adminSystemOpsStatusCancelled");
}

export function OperationTimelineCard({ operations }: OperationTimelineCardProps) {
  const t = useI18n();

  return (
    <Card className="border border-default-200 shadow-sm">
      <CardHeader className="pb-1 pt-3 px-4">
        <p className="text-xs text-default-500 font-medium">{t("adminSystemOpsTimelineTitle")}</p>
      </CardHeader>
      <CardBody className="pt-2 px-4 pb-4">
        {operations.length === 0 ? (
          <p className="text-sm text-default-400">{t("adminSystemOpsTimelineEmpty")}</p>
        ) : (
          <div className="space-y-3">
            {operations.map((row) => (
              <div key={row.id} className="relative pl-5">
                <span className="absolute left-0 top-0 h-full w-px bg-default-200" />
                <span className="absolute -left-1 top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />

                <div className="rounded-md border border-default-100 bg-default-50 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon icon={statusIcon(row.status)} className="text-base text-default-500" />
                      <p className="text-sm font-medium">{actionLabel(row.action, t)} • {row.target}</p>
                    </div>
                    <Chip size="sm" variant="flat" color={statusColor(row.status)}>
                      {statusLabel(row.status, t)}
                    </Chip>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-default-500">
                    <span>{new Date(row.requested_at).toLocaleString()}</span>
                    {row.completed_at && <span>{t("adminSystemOpsTimelineDoneAt", { time: new Date(row.completed_at).toLocaleTimeString() })}</span>}
                    <span>{t("adminSystemOpsTimelineByUser", { id: row.requested_by })}</span>
                    <span>{t("adminSystemOpsTimelineElapsed", { duration: formatElapsedMs(row.duration_ms) })}</span>
                    {row.dry_run && <span className="text-warning">{t("adminSystemOpsTimelineDryRun")}</span>}
                  </div>

                  {row.error && (
                    <p className="mt-1.5 text-xs text-danger">{row.error}</p>
                  )}

                  {!row.error && row.output && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-default-500">{row.output}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
