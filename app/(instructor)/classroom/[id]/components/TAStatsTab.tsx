"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Skeleton } from "@heroui/skeleton";
import { Tooltip } from "@heroui/tooltip";
import { Avatar } from "@heroui/avatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import TablePaginationFooter from "@/components/ui/table-pagination-footer";
import {
    useHorizontalOverflow,
    STICKY_SCROLL_CONTAINER_CLASS,
    STICKY_ACTION_HEADER_CLASS,
    STICKY_ACTION_CELL_CLASS,
} from "./shared/stickyActionColumn";
import {
  getTAStats,
  getTADetail,
  type TAStat,
  type TAStatsData,
  type TADetailScore,
  type TADetailData,
  type KPIBreakdown,
  type AnomalyFlag,
} from "@/services/courseActivityLog.service";

interface TAStatsTabProps {
  courseId: string;
}

type SortField = "total-work" | "term-share" | "graded" | "name";
type SortDirection = "asc" | "desc";

type TAWorkRow = {
  ta: TAStat;
  gradedCount: number;
  queueCompleted: number;
  totalWork: number;
  termSharePct: number;
  equalSharePct: number;
  assignmentCoveragePct: number;
  hasQueueWork: boolean;
};

function formatDateTime(dateStr: string | null, isEnglish: boolean) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString(isEnglish ? "en-US" : "th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDecimal(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toFixed(digits);
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-amber-600";
  return "text-rose-600";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-50";
  if (score >= 60) return "bg-blue-50";
  if (score >= 40) return "bg-amber-50";
  return "bg-rose-50";
}

function getScoreLabel(score: number, isEnglish: boolean): string {
  if (score >= 80) return isEnglish ? "Excellent" : "ดีมาก";
  if (score >= 60) return isEnglish ? "Good" : "ดี";
  if (score >= 40) return isEnglish ? "Fair" : "ปานกลาง";
  return isEnglish ? "Needs improvement" : "ควรติดตาม";
}

function getConfidenceChip(level: string, isEnglish: boolean) {
  const map: Record<string, { label: string; className: string }> = {
    high: { label: isEnglish ? "High" : "สูง", className: "bg-emerald-50 text-emerald-600" },
    medium: { label: isEnglish ? "Medium" : "ปานกลาง", className: "bg-amber-50 text-amber-600" },
    low: { label: isEnglish ? "Low" : "ต่ำ", className: "bg-content3 text-default-500" },
  };
  return map[level] || map.low;
}

function getWorkState(equalSharePct: number, isEnglish: boolean) {
  if (equalSharePct >= 120) {
    return {
      label: isEnglish ? "Above expected" : "มากกว่าค่าเฉลี่ย",
      className: "bg-blue-50 text-blue-600",
    };
  }
  if (equalSharePct >= 80) {
    return {
      label: isEnglish ? "On track" : "ใกล้เคียงค่าเฉลี่ย",
      className: "bg-emerald-50 text-emerald-600",
    };
  }
  return {
    label: isEnglish ? "Below expected" : "ต่ำกว่าค่าเฉลี่ย",
    className: "bg-amber-50 text-amber-600",
  };
}

function StatsCardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="border border-default-200 shadow-sm">
          <CardBody className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-28 rounded-lg" />
                <Skeleton className="h-6 w-20 rounded-lg" />
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function TATableSkeleton() {
  return (
    <Card className="border border-default-200 shadow-sm">
      <CardBody className="p-4">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40 rounded-lg" />
                <Skeleton className="h-3 w-56 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function OverviewCard({
  icon,
  label,
  value,
  hint,
  iconClassName,
}: {
  icon: string;
  label: string;
  value: string;
  hint: string;
  iconClassName: string;
}) {
  return (
    <Card className="border border-default-200 shadow-sm">
      <CardBody className="p-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-2xl p-2.5 ${iconClassName}`}>
            <Icon icon={icon} className="text-xl" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-default-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
            <p className="mt-1 text-xs text-default-400">{hint}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function AnomalyFlagsCard({ anomalies }: { anomalies: AnomalyFlag[] }) {
  const { language } = useGlobalSettings();
  const isEnglish = language === "en";

  if (anomalies.length === 0) return null;

  return (
    <Card className="border border-amber-200 shadow-sm">
      <CardBody className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-amber-100 p-2">
            <Icon icon="solar:danger-triangle-bold" className="text-lg text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {isEnglish ? "Items to review" : "ประเด็นที่ควรตรวจสอบ"}
            </h3>
            <p className="text-xs text-default-500">
              {anomalies.length} {isEnglish ? "flags" : "รายการ"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {anomalies.map((item, index) => (
            <div
              key={`${item.kind}-${index}`}
              className={`rounded-xl border px-3 py-2 ${
                item.severity === "danger"
                  ? "border-rose-100 bg-rose-50"
                  : "border-amber-100 bg-amber-50"
              }`}
            >
              <p className="text-sm text-default-700">{item.message}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function KPIBreakdownCard({
  kpi,
  confidenceLevel,
}: {
  kpi: KPIBreakdown;
  confidenceLevel?: string;
}) {
  const { language } = useGlobalSettings();
  const isEnglish = language === "en";

  const items = [
    {
      key: "workload",
      icon: "solar:case-round-bold",
      color: "text-blue-600",
      bg: "bg-blue-100",
      ...kpi.workload,
      label: isEnglish ? "Workload" : kpi.workload.label,
    },
    {
      key: "coverage",
      icon: "solar:clipboard-check-bold",
      color: "text-indigo-600",
      bg: "bg-indigo-100",
      ...kpi.coverage,
      label: isEnglish ? "Coverage" : kpi.coverage.label,
    },
    {
      key: "consistency",
      icon: "solar:scale-bold",
      color: "text-emerald-600",
      bg: "bg-emerald-100",
      ...kpi.consistency,
      label: isEnglish ? "Consistency" : kpi.consistency.label,
    },
    {
      key: "spread",
      icon: "solar:chart-bold",
      color: "text-violet-600",
      bg: "bg-violet-100",
      ...kpi.spread,
      label: isEnglish ? "Score spread" : kpi.spread.label,
    },
    {
      key: "queue",
      icon: "solar:sort-by-time-bold",
      color: "text-amber-600",
      bg: "bg-amber-100",
      ...kpi.queue,
      label: isEnglish ? "Queue work" : kpi.queue.label,
    },
    {
      key: "anomaly",
      icon: "solar:shield-warning-bold",
      color: "text-rose-600",
      bg: "bg-rose-100",
      ...kpi.anomaly,
      label: isEnglish ? "Anomaly check" : kpi.anomaly.label,
    },
  ];

  const confidenceInfo = getConfidenceChip(confidenceLevel || "low", isEnglish);

  return (
    <Card className="border border-default-200 shadow-sm">
      <CardBody className="space-y-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {isEnglish ? "Evaluation breakdown" : "รายละเอียดคะแนนประเมิน"}
            </h3>
            <p className="text-xs text-default-500">
              {isEnglish
                ? "Use this as a conversation aid, not the only decision signal."
                : "ใช้เป็นข้อมูลประกอบการประเมิน ไม่ควรใช้แทนการพิจารณาทั้งหมด"}
            </p>
          </div>
          <Chip size="sm" variant="flat" className={confidenceInfo.className}>
            {isEnglish ? "Confidence" : "ความน่าเชื่อถือ"}: {confidenceInfo.label}
          </Chip>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.key} className="rounded-2xl border border-default-200 bg-content2 p-3">
              <div className="mb-3 flex items-start gap-2">
                <div className={`rounded-xl p-1.5 ${item.bg}`}>
                  <Icon icon={item.icon} className={`text-sm ${item.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-[11px] text-default-400">
                    {isEnglish ? "Weight" : "น้ำหนัก"} {(item.weight * 100).toFixed(0)}%
                  </p>
                </div>
                <span className={`text-lg font-semibold ${getScoreColor(item.score)}`}>{item.score}</span>
              </div>
              <div className="h-2 rounded-full bg-content3">
                <div
                  className={`h-2 rounded-full ${
                    item.score >= 80
                      ? "bg-emerald-500"
                      : item.score >= 60
                        ? "bg-blue-500"
                        : item.score >= 40
                          ? "bg-amber-500"
                          : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.min(item.score, 100)}%` }}
                />
              </div>
              {item.description ? (
                <p className="mt-2 text-xs leading-relaxed text-default-500">{item.description}</p>
              ) : null}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function TASnapshotCard({
  row,
  totalAssignments,
  averageTermShare,
  isEnglish,
  onView,
}: {
  row: TAWorkRow;
  totalAssignments: number;
  averageTermShare: number;
  isEnglish: boolean;
  onView: () => void;
}) {
  const workState = getWorkState(row.equalSharePct, isEnglish);
  const flagCount = row.ta.anomalies?.length || 0;
  const score = row.ta.performanceScore;
  const barMax = Math.max(row.termSharePct, averageTermShare * 1.5, 1);

  return (
    <Card className="border border-default-200 shadow-sm">
      <CardBody className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              name={row.ta.fullName}
              size="md"
              src={row.ta.avatar || undefined}
              className="bg-linear-to-br from-blue-500 to-indigo-500 text-white"
            />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{row.ta.fullName}</p>
              <p className="truncate text-xs text-default-400">{row.ta.email}</p>
            </div>
          </div>
          {score != null ? (
            <Tooltip
              content={
                <div className="max-w-64 px-1 py-1 text-xs">
                  <p className="font-semibold">
                    {getScoreLabel(score, isEnglish)} ({score}/100)
                  </p>
                  <p className="mt-1 text-default-300">
                    {isEnglish
                      ? "Support signal based on workload, coverage, consistency, queue work, and anomaly checks."
                      : "คะแนนประกอบจากภาระงาน ความครอบคลุม ความสม่ำเสมอ งานคิว และจุดที่ระบบตั้งข้อสังเกต"}
                  </p>
                </div>
              }
            >
              <div className={`flex shrink-0 flex-col items-center rounded-2xl px-3 py-1.5 ${getScoreBg(score)}`}>
                <span className={`text-lg font-bold leading-none ${getScoreColor(score)}`}>{score}</span>
                <span className={`mt-0.5 text-[10px] font-medium leading-none ${getScoreColor(score)}`}>
                  {getScoreLabel(score, isEnglish)}
                </span>
              </div>
            </Tooltip>
          ) : (
            <span className="shrink-0 text-xs text-default-300">-</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Chip size="sm" variant="flat" className={workState.className}>
            {workState.label}
          </Chip>
          {flagCount > 0 ? (
            <Chip size="sm" variant="flat" className="bg-amber-50 text-amber-600">
              <Icon icon="solar:danger-triangle-bold" className="mr-1 inline text-xs" />
              {flagCount} {isEnglish ? "flags" : "ประเด็น"}
            </Chip>
          ) : null}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl bg-content2 px-1 py-2 text-center">
            <p className="text-sm font-semibold text-blue-600">{row.gradedCount}</p>
            <p className="text-[10px] text-default-400">{isEnglish ? "Grading" : "ตรวจปกติ"}</p>
          </div>
          <div className="rounded-xl bg-content2 px-1 py-2 text-center">
            <p className="text-sm font-semibold text-amber-600">{row.queueCompleted}</p>
            <p className="text-[10px] text-default-400">{isEnglish ? "Queue" : "งานคิว"}</p>
          </div>
          <div className="rounded-xl bg-content2 px-1 py-2 text-center">
            <p className="text-sm font-semibold text-foreground">{row.totalWork}</p>
            <p className="text-[10px] text-default-400">{isEnglish ? "Total" : "รวม"}</p>
          </div>
          <div className="rounded-xl bg-content2 px-1 py-2 text-center">
            <p className="text-sm font-semibold text-violet-600">
              {row.ta.assignmentsGraded}/{totalAssignments}
            </p>
            <p className="text-[10px] text-default-400">{isEnglish ? "Coverage" : "ครอบคลุม"}</p>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-default-500">
            <span>{isEnglish ? "Term share" : "สัดส่วนทั้งเทอม"}</span>
            <span className="font-medium text-foreground">{formatPercent(row.termSharePct)}</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-content3">
            <div
              className={`h-full rounded-full ${row.equalSharePct >= 80 ? "bg-blue-500" : "bg-amber-500"}`}
              style={{ width: `${Math.min((row.termSharePct / barMax) * 100, 100)}%` }}
            />
            <div
              className="absolute inset-y-0 border-l-2 border-dashed border-default-500/60"
              style={{ left: `${Math.min((averageTermShare / barMax) * 100, 100)}%` }}
            />
          </div>
        </div>

        <Button
          size="sm"
          variant="flat"
          onPress={onView}
          fullWidth
          className="bg-blue-50 text-blue-600 hover:bg-blue-100"
        >
          {isEnglish ? "View details" : "ดูรายละเอียด"}
        </Button>
      </CardBody>
    </Card>
  );
}

function TADetailView({
  courseId,
  ta,
  allAssignments,
  onClose,
}: {
  courseId: string;
  ta: TAStat;
  allAssignments: { assignmentId: number; assignmentName: string }[];
  onClose: () => void;
}) {
  const { language } = useGlobalSettings();
  const isEnglish = language === "en";
  const [detail, setDetail] = useState<TADetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterAssignment, setFilterAssignment] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(30);

  const queueCompleted = ta.queueStats?.totalCompleted || 0;
  const totalWork = ta.totalScoresGraded + queueCompleted;

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTADetail(courseId, ta.userId, {
        assignmentId: filterAssignment ? parseInt(filterAssignment, 10) : undefined,
        page,
        limit: rowsPerPage,
      });
      setDetail(result);
    } catch {
      addToast({
        title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
        description: isEnglish ? "Unable to load TA details." : "ไม่สามารถโหลดรายละเอียดการทำงานของ TA ได้",
        color: "danger",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
      });
    } finally {
      setLoading(false);
    }
  }, [courseId, filterAssignment, isEnglish, page, rowsPerPage, ta.userId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            onPress={onClose}
            className="bg-content2 text-default-600 hover:bg-content3"
          >
            <Icon icon="solar:arrow-left-linear" width={18} />
          </Button>
          <Avatar
            name={ta.fullName}
            size="lg"
            src={ta.avatar || undefined}
            className="bg-linear-to-br from-blue-500 to-indigo-500 text-white"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{ta.fullName}</h3>
              {ta.performanceScore != null ? (
                <Chip
                  size="sm"
                  variant="flat"
                  className={`${getScoreBg(ta.performanceScore)} ${getScoreColor(ta.performanceScore)}`}
                >
                  {isEnglish ? "Evaluation" : "คะแนนประเมิน"} {ta.performanceScore}/100
                </Chip>
              ) : null}
            </div>
            <p className="text-sm text-default-500">{ta.email}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard
          icon="solar:clipboard-check-bold"
          label={isEnglish ? "Regular grading" : "งานตรวจปกติ"}
          value={String(ta.totalScoresGraded)}
          hint={isEnglish ? "Items graded in this course" : "จำนวนรายการที่ตรวจในรายวิชานี้"}
          iconClassName="bg-blue-100 text-blue-600"
        />
        <OverviewCard
          icon="solar:sort-by-time-bold"
          label={isEnglish ? "Queue work" : "งานจากคิว"}
          value={String(queueCompleted)}
          hint={isEnglish ? "Completed queue bookings" : "จำนวนคิวที่ปิดงานสำเร็จ"}
          iconClassName="bg-amber-100 text-amber-600"
        />
        <OverviewCard
          icon="solar:layers-bold"
          label={isEnglish ? "Total workload" : "ภาระงานรวม"}
          value={String(totalWork)}
          hint={isEnglish ? "Regular grading + queue work" : "รวมงานตรวจปกติและงานจากคิว"}
          iconClassName="bg-emerald-100 text-emerald-600"
        />
        <OverviewCard
          icon="solar:notebook-bold"
          label={isEnglish ? "Assignments touched" : "งานที่มีส่วนร่วม"}
          value={String(ta.assignmentsGraded)}
          hint={isEnglish ? "Different assignments graded" : "จำนวนงานที่เคยตรวจ"}
          iconClassName="bg-violet-100 text-violet-600"
        />
      </div>

      {ta.kpiBreakdown ? (
        <KPIBreakdownCard kpi={ta.kpiBreakdown} confidenceLevel={ta.confidenceLevel} />
      ) : null}

      {ta.anomalies && ta.anomalies.length > 0 ? <AnomalyFlagsCard anomalies={ta.anomalies} /> : null}

      <Card className="border border-default-200 shadow-sm">
        <CardBody className="p-2">
          <div className="px-3 py-2">
            <h3 className="text-base font-semibold text-foreground">
              {isEnglish ? "Assignment-level summary" : "สรุประดับงาน"}
            </h3>
            <p className="text-xs text-default-500">
              {isEnglish
                ? "Shows how much work this TA handled on each assignment."
                : "ใช้ดูว่า TA คนนี้รับผิดชอบงานไหนมากน้อยเพียงใด"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table
              aria-label="TA assignment summary"
              removeWrapper
              classNames={{
                th: "bg-content2 text-default-600 font-semibold text-sm",
                td: "py-3",
              }}
            >
              <TableHeader>
                <TableColumn>{isEnglish ? "Assignment" : "งาน"}</TableColumn>
                <TableColumn align="center">{isEnglish ? "Graded" : "ตรวจแล้ว"}</TableColumn>
                <TableColumn align="center">{isEnglish ? "Average" : "คะแนนเฉลี่ย"}</TableColumn>
                <TableColumn align="center">{isEnglish ? "Range" : "ช่วงคะแนน"}</TableColumn>
                <TableColumn align="center">{isEnglish ? "Sub-items" : "รายการย่อย"}</TableColumn>
              </TableHeader>
              <TableBody
                emptyContent={
                  <div className="py-10 text-center">
                    <Icon icon="solar:clipboard-list-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                    <p className="text-default-400">
                      {isEnglish ? "This TA has not graded any assignment yet." : "TA คนนี้ยังไม่มีข้อมูลการตรวจงาน"}
                    </p>
                  </div>
                }
              >
                {ta.perAssignment.map((item) => (
                  <TableRow key={item.assignmentId}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{item.assignmentName}</p>
                        <p className="text-xs text-default-400">
                          {isEnglish ? "Full score" : "คะแนนเต็ม"} {item.maxScore}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-blue-600">{item.totalGraded}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-emerald-600">{formatDecimal(item.avgScore)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-default-600">
                        {formatDecimal(item.minScore)} - {formatDecimal(item.maxScore_given)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-default-600">{item.subItemScoresCount}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      <Card className="border border-default-200 shadow-sm">
        <CardBody className="p-2">
          <div className="flex flex-col gap-3 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {isEnglish ? "Grading history" : "ประวัติการตรวจ"}
              </h3>
              <p className="text-xs text-default-500">
                {isEnglish
                  ? "Review recent score entries by this TA."
                  : "ใช้ตรวจงานที่ TA คนนี้บันทึกไว้ล่าสุด"}
              </p>
            </div>
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="bordered"
                  size="sm"
                  className="min-w-36 justify-between border-default-200 bg-content1"
                  endContent={<Icon icon="solar:alt-arrow-down-linear" className="text-sm text-default-400" />}
                >
                  {filterAssignment
                    ? allAssignments.find((item) => String(item.assignmentId) === filterAssignment)?.assignmentName ||
                      (isEnglish ? "Assignment" : "งาน")
                    : isEnglish
                      ? "All assignments"
                      : "ทุกงาน"}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                selectionMode="single"
                selectedKeys={filterAssignment ? new Set([filterAssignment]) : new Set([])}
                onSelectionChange={(keys) => {
                  setFilterAssignment((Array.from(keys)[0] as string) || "");
                  setPage(1);
                }}
                items={[
                  { key: "", label: isEnglish ? "All assignments" : "ทุกงาน" },
                  ...allAssignments.map((item) => ({
                    key: String(item.assignmentId),
                    label: item.assignmentName,
                  })),
                ]}
              >
                {(item) => <DropdownItem key={item.key}>{item.label}</DropdownItem>}
              </DropdownMenu>
            </Dropdown>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" color="primary" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table
                  aria-label="TA grading history"
                  removeWrapper
                  classNames={{
                    th: "bg-content2 text-default-600 font-semibold text-sm",
                    td: "py-3",
                    tr: "hover:bg-content2/60",
                  }}
                >
                  <TableHeader>
                    <TableColumn>{isEnglish ? "Assignment" : "งาน"}</TableColumn>
                    <TableColumn>{isEnglish ? "Sub-item" : "รายการย่อย"}</TableColumn>
                    <TableColumn>{isEnglish ? "Student" : "นักศึกษา"}</TableColumn>
                    <TableColumn align="end">{isEnglish ? "Score" : "คะแนน"}</TableColumn>
                    <TableColumn>{isEnglish ? "Graded on" : "วันที่ตรวจ"}</TableColumn>
                  </TableHeader>
                  <TableBody
                    emptyContent={
                      <div className="py-10 text-center">
                        <Icon icon="solar:clipboard-list-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                        <p className="text-default-400">
                          {isEnglish ? "No grading history found." : "ไม่พบประวัติการตรวจ"}
                        </p>
                      </div>
                    }
                  >
                    {(detail?.scores || []).map((score: TADetailScore) => (
                      <TableRow key={score.id}>
                        <TableCell>
                          <span className="font-medium text-foreground">{score.assignment?.name || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-default-500">{score.subItem?.name || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-foreground">{score.student?.full_name || "-"}</p>
                            <p className="text-xs text-default-400">{score.student?.student_id}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-foreground">{score.score}</span>
                          <span className="text-xs text-default-400">
                            /{score.subItem?.max_score || score.assignment?.max_score || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap text-default-500">
                            {formatDateTime(score.graded_at, isEnglish)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <TablePaginationFooter
                totalItems={detail?.pagination.total || 0}
                currentPage={page}
                rowsPerPage={rowsPerPage}
                totalPages={Math.max(1, detail?.pagination.totalPages || 0)}
                isEnglish={isEnglish}
                nounEnglish="history entry"
                nounEnglishPlural="history entries"
                nounThai="รายการ"
                rowsPerPageOptions={[10, 20, 30, 50]}
                onPageChange={setPage}
                onRowsPerPageChange={(nextRows) => {
                  setRowsPerPage(nextRows);
                  setPage(1);
                }}
              />
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default function TAStatsTab({ courseId }: TAStatsTabProps) {
  const { language } = useGlobalSettings();
  const isEnglish = language === "en";
  const [data, setData] = useState<TAStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTA, setSelectedTA] = useState<TAStat | null>(null);
  // Pin the actions column so it stays visible when the table scrolls sideways.
  const { scrollRef, hasOverflow } = useHorizontalOverflow();
  const [sortField, setSortField] = useState<SortField>("total-work");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTAStats(courseId);
      setData(result);
    } catch {
      addToast({
        title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
        description: isEnglish ? "Unable to load TA statistics." : "ไม่สามารถโหลดสถิติการทำงานของ TA ได้",
        color: "danger",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
      });
    } finally {
      setLoading(false);
    }
  }, [courseId, isEnglish]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const derived = useMemo(() => {
    if (!data) return null;

    const totalQueueCompleted = data.taStats.reduce((sum, ta) => sum + (ta.queueStats?.totalCompleted || 0), 0);
    const totalCombinedWork = data.summary.totalScoresGraded + totalQueueCompleted;
    const averageCombinedPerTA = data.summary.totalTAs > 0 ? totalCombinedWork / data.summary.totalTAs : 0;
    const averageTermShare = data.summary.totalTAs > 0 ? 100 / data.summary.totalTAs : 0;
    const fairnessGap =
      averageCombinedPerTA > 0
        ? data.taStats.reduce((sum, ta) => {
            const totalWork = ta.totalScoresGraded + (ta.queueStats?.totalCompleted || 0);
            return sum + Math.abs(totalWork - averageCombinedPerTA);
          }, 0) / data.taStats.length
        : 0;

    const workloadRows: TAWorkRow[] = data.taStats.map((ta) => {
      const gradedCount = ta.totalScoresGraded;
      const queueCompleted = ta.queueStats?.totalCompleted || 0;
      const totalWork = gradedCount + queueCompleted;
      const termSharePct = totalCombinedWork > 0 ? (totalWork / totalCombinedWork) * 100 : 0;
      const equalSharePct = averageCombinedPerTA > 0 ? (totalWork / averageCombinedPerTA) * 100 : 0;
      const assignmentCoveragePct =
        data.summary.totalAssignments > 0
          ? (ta.assignmentsGraded / data.summary.totalAssignments) * 100
          : 0;

      return {
        ta,
        gradedCount,
        queueCompleted,
        totalWork,
        termSharePct,
        equalSharePct,
        assignmentCoveragePct,
        hasQueueWork: queueCompleted > 0,
      };
    });

    const maxTotalWork = Math.max(...workloadRows.map((row) => row.totalWork), 1);
    const maxTermSharePct = Math.max(...workloadRows.map((row) => row.termSharePct), 1);
    const mostActiveTA = [...workloadRows].sort((a, b) => b.totalWork - a.totalWork)[0] || null;
    const tasWithoutQueueWork = workloadRows.filter((row) => !row.hasQueueWork).length;
    const flaggedTAs = data.taStats.filter((ta) => (ta.anomalies?.length || 0) > 0).length;

    return {
      totalQueueCompleted,
      totalCombinedWork,
      averageCombinedPerTA,
      averageTermShare,
      fairnessGap,
      workloadRows,
      maxTotalWork,
      maxTermSharePct,
      mostActiveTA,
      tasWithoutQueueWork,
      flaggedTAs,
    };
  }, [data]);

  const sortedRows = useMemo(() => {
    if (!derived) return [];

    return [...derived.workloadRows].sort((a, b) => {
      if (sortField === "name") {
        return sortDirection === "asc"
          ? a.ta.fullName.localeCompare(b.ta.fullName, isEnglish ? "en" : "th")
          : b.ta.fullName.localeCompare(a.ta.fullName, isEnglish ? "en" : "th");
      }

      const valueA =
        sortField === "graded"
          ? a.gradedCount
          : sortField === "term-share"
            ? a.termSharePct
            : a.totalWork;
      const valueB =
        sortField === "graded"
          ? b.gradedCount
          : sortField === "term-share"
            ? b.termSharePct
            : b.totalWork;

      return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
    });
  }, [derived, isEnglish, sortDirection, sortField]);

  const highlightedFlags = useMemo(() => {
    if (!derived) return [];

    return derived.workloadRows.flatMap((row) => {
      const items = [...(row.ta.anomalies || [])];

      if (row.equalSharePct < 60) {
        items.unshift({
          kind: "low_volume",
          severity: "warning",
          message: isEnglish
            ? `${row.ta.fullName} handled only ${formatPercent(row.termSharePct)} of the total term workload.`
            : `${row.ta.fullName} รับภาระงานรวมเพียง ${formatPercent(row.termSharePct)} ของทั้งเทอม`,
        });
      }

      if (!row.hasQueueWork) {
        items.push({
          kind: "low_coverage",
          severity: "warning",
          message: isEnglish
            ? `${row.ta.fullName} has no completed queue work recorded.`
            : `${row.ta.fullName} ยังไม่มีข้อมูลงานคิวที่ปิดสำเร็จ`,
        });
      }

      return items;
    });
  }, [derived, isEnglish]);

  if (selectedTA && data) {
    return (
      <TADetailView
        courseId={courseId}
        ta={selectedTA}
        allAssignments={data.assignments.map((item) => ({
          assignmentId: item.assignmentId,
          assignmentName: item.assignmentName,
        }))}
        onClose={() => setSelectedTA(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {isEnglish ? "TA workload overview" : "ภาพรวมการทำงานของ TA"}
          </h2>
          <p className="text-sm text-default-500">
            {isEnglish
              ? "Designed for end-of-term review by combining regular grading and queue work."
              : "สรุปภาระงานทั้งเทอม โดยรวมทั้งงานตรวจปกติและงานจากคิวเพื่อช่วยประเมินผู้ช่วยสอน"}
          </p>
        </div>
        <Button
          size="sm"
          variant="flat"
          onPress={fetchData}
          isDisabled={loading}
          className="bg-content2 text-default-600 hover:bg-content3"
        >
          {isEnglish ? "Refresh" : "รีเฟรช"}
        </Button>
      </div>

      {loading ? (
        <>
          <StatsCardSkeleton />
          <TATableSkeleton />
        </>
      ) : !data || !derived ? (
        <Card className="border border-dashed border-default-300 bg-content2/50 shadow-sm">
          <CardBody className="py-16 text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-linear-to-br from-blue-100 to-indigo-100">
              <Icon icon="solar:chart-2-bold-duotone" className="text-5xl text-blue-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-default-700">
              {isEnglish ? "Unable to load data" : "ไม่สามารถโหลดข้อมูลได้"}
            </h3>
            <p className="mx-auto mb-6 max-w-md text-default-500">
              {isEnglish ? "Please refresh and try again." : "กรุณาลองรีเฟรชแล้วตรวจสอบอีกครั้ง"}
            </p>
            <Button color="primary" onPress={fetchData}>
              {isEnglish ? "Try again" : "ลองอีกครั้ง"}
            </Button>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewCard
              icon="solar:users-group-rounded-bold"
              label={isEnglish ? "Teaching assistants" : "จำนวนผู้ช่วยสอน"}
              value={String(data.summary.totalTAs)}
              hint={
                isEnglish
                  ? "People included in this course evaluation"
                  : "จำนวน TA ที่ถูกนำมาคิดในการประเมินรายวิชานี้"
              }
              iconClassName="bg-blue-100 text-blue-600"
            />
            <OverviewCard
              icon="solar:clipboard-check-bold"
              label={isEnglish ? "Regular grading items" : "งานตรวจปกติ"}
              value={String(data.summary.totalScoresGraded)}
              hint={
                isEnglish
                  ? "Score entries created across the whole term"
                  : "จำนวนรายการคะแนนที่ถูกตรวจตลอดทั้งเทอม"
              }
              iconClassName="bg-emerald-100 text-emerald-600"
            />
            <OverviewCard
              icon="solar:sort-by-time-bold"
              label={isEnglish ? "Completed queue work" : "งานจากคิวที่สำเร็จ"}
              value={String(derived.totalQueueCompleted)}
              hint={
                isEnglish
                  ? "Finished queue bookings across all TAs"
                  : "จำนวนคิวที่ปิดงานสำเร็จรวมของ TA ทุกคน"
              }
              iconClassName="bg-amber-100 text-amber-600"
            />
            <OverviewCard
              icon="solar:layers-bold"
              label={isEnglish ? "Total term workload" : "ภาระงานรวมทั้งเทอม"}
              value={String(derived.totalCombinedWork)}
              hint={
                isEnglish
                  ? "Regular grading + queue work"
                  : "คำนวณจากงานตรวจปกติรวมกับงานจากคิว"
              }
              iconClassName="bg-violet-100 text-violet-600"
            />
          </div>

          <Card className="border border-default-200 shadow-sm">
            <CardBody className="space-y-4 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {isEnglish ? "What this page adds" : "สิ่งที่หน้าใหม่นี้ช่วยเพิ่ม"}
                  </h3>
                  <p className="text-sm text-default-500">
                    {isEnglish
                      ? "It highlights end-of-term workload share, whether each TA is above or below an equal split, and who may need a closer review."
                      : "หน้านี้เน้นให้เห็นสัดส่วนงานทั้งเทอมของแต่ละ TA เทียบกับการกระจายงานแบบเฉลี่ยเท่ากัน และชี้คนที่ควรตรวจสอบเพิ่มเติม"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="flat" className="bg-content2 text-default-600">
                    {isEnglish ? "Average per TA" : "เฉลี่ยต่อ TA"} {derived.averageCombinedPerTA.toFixed(1)}
                  </Chip>
                  <Chip size="sm" variant="flat" className="bg-content2 text-default-600">
                    {isEnglish ? "Average share" : "สัดส่วนเฉลี่ย"} {formatPercent(derived.averageTermShare)}
                  </Chip>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-default-200 bg-content2 p-4">
                  <p className="text-xs font-medium text-default-500">
                    {isEnglish ? "Most active TA" : "TA ที่รับงานมากที่สุด"}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {derived.mostActiveTA?.ta.fullName || "-"}
                  </p>
                  <p className="mt-1 text-sm text-default-500">
                    {derived.mostActiveTA
                      ? `${derived.mostActiveTA.totalWork} ${isEnglish ? "items" : "รายการ"} • ${formatPercent(derived.mostActiveTA.termSharePct)}`
                      : "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-default-200 bg-content2 p-4">
                  <p className="text-xs font-medium text-default-500">
                    {isEnglish ? "TAs without queue work" : "TA ที่ยังไม่มีงานจากคิว"}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{derived.tasWithoutQueueWork}</p>
                  <p className="mt-1 text-sm text-default-500">
                    {isEnglish
                      ? "Useful when queue support should be shared across the team."
                      : "ช่วยเช็กได้ว่าภาระงานคิวกระจายถึงทุกคนหรือไม่"}
                  </p>
                </div>

                <div className="rounded-2xl border border-default-200 bg-content2 p-4">
                  <p className="text-xs font-medium text-default-500">
                    {isEnglish ? "TAs with review flags" : "TA ที่มีประเด็นให้ตรวจสอบ"}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{derived.flaggedTAs}</p>
                  <p className="mt-1 text-sm text-default-500">
                    {isEnglish
                      ? "Combine this with instructor context before making a decision."
                      : "ควรใช้ร่วมกับบริบทจริงจากอาจารย์ก่อนตัดสินผลประเมิน"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-default-300 bg-content1 px-4 py-3 text-sm text-default-600">
                {isEnglish
                  ? "Term share percentage = (regular grading items + completed queue work of that TA) / (combined workload of all TAs in this course)."
                  : "เปอร์เซ็นต์ของทั้งเทอม = (งานตรวจปกติ + งานจากคิวของ TA คนนั้น) / (ภาระงานรวมของ TA ทุกคนในรายวิชานี้)"}
              </div>
            </CardBody>
          </Card>

          {highlightedFlags.length > 0 ? <AnomalyFlagsCard anomalies={highlightedFlags} /> : null}

          <Card className="border border-default-200 shadow-sm">
            <CardBody className="space-y-4 p-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {isEnglish ? "Workload share by TA" : "สัดส่วนภาระงานรายคน"}
                </h3>
                <p className="text-sm text-default-500">
                  {isEnglish
                    ? "Solid bar = actual total work, dashed line = equal-share expectation."
                    : "แท่งสีคือภาระงานจริง และเส้นประคือระดับงานที่ควรได้หากแบ่งเท่ากัน"}
                </p>
              </div>

              <div className="space-y-3">
                {sortedRows.map((row) => {
                  const fillPct = derived.maxTotalWork > 0 ? (row.totalWork / derived.maxTotalWork) * 100 : 0;
                  const expectedPct =
                    derived.maxTotalWork > 0 ? (derived.averageCombinedPerTA / derived.maxTotalWork) * 100 : 0;

                  return (
                    <div key={row.ta.userId} className="grid gap-2 lg:grid-cols-[220px_minmax(0,1fr)_180px] lg:items-center">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={row.ta.fullName}
                          size="sm"
                          src={row.ta.avatar || undefined}
                          className="bg-linear-to-br from-blue-500 to-indigo-500 text-white"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{row.ta.fullName}</p>
                          <p className="truncate text-xs text-default-400">{row.ta.email}</p>
                        </div>
                      </div>

                      <div className="relative h-5 overflow-hidden rounded-full bg-content3">
                        <div
                          className={`h-full rounded-full ${row.equalSharePct >= 80 ? "bg-blue-500" : "bg-amber-500"}`}
                          style={{ width: `${Math.min(fillPct, 100)}%` }}
                        />
                        <div
                          className="absolute inset-y-0 border-l-2 border-dashed border-default-500/60"
                          style={{ left: `${Math.min(expectedPct, 100)}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Chip size="sm" variant="flat" className="bg-content2 text-default-700">
                          {row.totalWork} {isEnglish ? "items" : "รายการ"}
                        </Chip>
                        <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
                          {formatPercent(row.termSharePct)}
                        </Chip>
                        <Chip size="sm" variant="flat" className={getWorkState(row.equalSharePct, isEnglish).className}>
                          {getWorkState(row.equalSharePct, isEnglish).label}
                        </Chip>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card className="border border-default-200 bg-content1 shadow-sm">
            <CardBody className="p-2">
              <div className="flex flex-col gap-3 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {isEnglish ? "Per-person summary" : "สรุปรายบุคคล"}
                  </h3>
                  <p className="text-sm text-default-500">
                    {isEnglish
                      ? "See how each TA is doing, then switch to the table for exact numbers."
                      : "ดูภาพรวมของ TA แต่ละคนได้ทันที แล้วสลับไปดูตัวเลขละเอียดในมุมมองตาราง"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center overflow-hidden rounded-lg border border-default-200 bg-content1">
                    <Tooltip content={isEnglish ? "Grid view" : "มุมมองการ์ด"}>
                      <Button
                        aria-label={isEnglish ? "Show grid view" : "แสดงมุมมองการ์ด"}
                        isIconOnly
                        size="sm"
                        variant="light"
                        className={`rounded-none ${viewMode === "grid" ? "bg-content3" : ""}`}
                        onPress={() => setViewMode("grid")}
                      >
                        <Icon
                          icon="solar:widget-bold"
                          className={`text-base ${viewMode === "grid" ? "text-blue-600" : "text-default-400"}`}
                        />
                      </Button>
                    </Tooltip>
                    <div className="h-5 w-px bg-divider" />
                    <Tooltip content={isEnglish ? "List view" : "มุมมองตาราง"}>
                      <Button
                        aria-label={isEnglish ? "Show list view" : "แสดงมุมมองตาราง"}
                        isIconOnly
                        size="sm"
                        variant="light"
                        className={`rounded-none ${viewMode === "list" ? "bg-content3" : ""}`}
                        onPress={() => setViewMode("list")}
                      >
                        <Icon
                          icon="solar:list-bold"
                          className={`text-base ${viewMode === "list" ? "text-blue-600" : "text-default-400"}`}
                        />
                      </Button>
                    </Tooltip>
                  </div>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button size="sm" variant="flat" className="min-w-36 justify-between bg-content3 text-default-600">
                        {sortField === "total-work"
                          ? isEnglish
                            ? "Total work"
                            : "ภาระงานรวม"
                          : sortField === "term-share"
                            ? isEnglish
                              ? "Term share"
                              : "สัดส่วนทั้งเทอม"
                            : sortField === "graded"
                              ? isEnglish
                                ? "Regular grading"
                                : "งานตรวจปกติ"
                              : isEnglish
                                ? "Name"
                                : "ชื่อ"}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      selectionMode="single"
                      selectedKeys={new Set([sortField])}
                      onSelectionChange={(keys) => {
                        const next = Array.from(keys)[0] as SortField;
                        if (!next) return;
                        if (next === sortField) {
                          setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
                          return;
                        }
                        setSortField(next);
                        setSortDirection(next === "name" ? "asc" : "desc");
                      }}
                      items={[
                        { key: "total-work", label: isEnglish ? "Total work" : "ภาระงานรวม" },
                        { key: "term-share", label: isEnglish ? "Term share" : "สัดส่วนทั้งเทอม" },
                        { key: "graded", label: isEnglish ? "Regular grading" : "งานตรวจปกติ" },
                        { key: "name", label: isEnglish ? "Name" : "ชื่อ" },
                      ]}
                    >
                      {(item) => <DropdownItem key={item.key}>{item.label}</DropdownItem>}
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>

              {sortedRows.length === 0 ? (
                <Card className="m-3 border border-dashed border-default-200 bg-content2 shadow-none">
                  <CardBody className="py-12 text-center">
                    <Icon icon="solar:users-group-rounded-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                    <p className="font-medium text-default-500">
                      {isEnglish ? "No TA has been added to this course yet." : "ยังไม่มีผู้ช่วยสอนในรายวิชานี้"}
                    </p>
                    <p className="mt-1 text-sm text-default-400">
                      {isEnglish
                        ? "Add teaching assistants from the People tab first."
                        : "กรุณาเพิ่มผู้ช่วยสอนจากแท็บรายชื่อก่อน"}
                    </p>
                  </CardBody>
                </Card>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {sortedRows.map((row) => (
                    <TASnapshotCard
                      key={row.ta.userId}
                      row={row}
                      totalAssignments={data.summary.totalAssignments}
                      averageTermShare={derived.averageTermShare}
                      isEnglish={isEnglish}
                      onView={() => setSelectedTA(row.ta)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  ref={scrollRef}
                  data-overflow={hasOverflow ? "true" : "false"}
                  className={STICKY_SCROLL_CONTAINER_CLASS}
                >
                  <Table
                    aria-label="TA workload summary table"
                    removeWrapper
                    classNames={{
                      th: "bg-content2 text-default-600 font-semibold text-sm",
                      td: "py-3 align-top",
                    }}
                  >
                    <TableHeader>
                      <TableColumn>{isEnglish ? "TA" : "ผู้ช่วยสอน"}</TableColumn>
                      <TableColumn align="center">{isEnglish ? "Regular grading" : "งานตรวจปกติ"}</TableColumn>
                      <TableColumn align="center">{isEnglish ? "Queue work" : "งานจากคิว"}</TableColumn>
                      <TableColumn align="center">{isEnglish ? "Total work" : "ภาระงานรวม"}</TableColumn>
                      <TableColumn align="center">{isEnglish ? "Term share" : "สัดส่วนทั้งเทอม"}</TableColumn>
                      <TableColumn align="center">{isEnglish ? "Assignment coverage" : "ความครอบคลุมงาน"}</TableColumn>
                      <TableColumn align="center">{isEnglish ? "Evaluation" : "คะแนนประเมิน"}</TableColumn>
                      <TableColumn align="center" className={STICKY_ACTION_HEADER_CLASS}>{isEnglish ? "Action" : "การจัดการ"}</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {sortedRows.map((row) => {
                        const workState = getWorkState(row.equalSharePct, isEnglish);

                        return (
                          <TableRow key={row.ta.userId}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar
                                  name={row.ta.fullName}
                                  size="sm"
                                  src={row.ta.avatar || undefined}
                                  className="bg-linear-to-br from-blue-500 to-indigo-500 text-white"
                                />
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">{row.ta.fullName}</p>
                                  <p className="truncate text-xs text-default-400">{row.ta.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-blue-600">{row.gradedCount}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-amber-600">{row.queueCompleted}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-semibold text-foreground">{row.totalWork}</span>
                                <Chip size="sm" variant="flat" className={workState.className}>
                                  {formatPercent(row.equalSharePct)}
                                </Chip>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-semibold text-emerald-600">
                                  {formatPercent(row.termSharePct)}
                                </span>
                                <span className="text-xs text-default-400">
                                  {isEnglish ? "of all TA work" : "ของภาระงาน TA ทั้งหมด"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-semibold text-violet-600">
                                  {formatPercent(row.assignmentCoveragePct)}
                                </span>
                                <span className="text-xs text-default-400">
                                  {row.ta.assignmentsGraded}/{data.summary.totalAssignments}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {row.ta.performanceScore != null ? (
                                <Tooltip
                                  content={
                                    <div className="max-w-64 px-1 py-1 text-xs">
                                      <p className="font-semibold">
                                        {getScoreLabel(row.ta.performanceScore, isEnglish)} ({row.ta.performanceScore}/100)
                                      </p>
                                      <p className="mt-1 text-default-300">
                                        {isEnglish
                                          ? "This is a support signal based on workload, coverage, consistency, queue work, and anomaly checks."
                                          : "เป็นคะแนนประกอบจากภาระงาน ความครอบคลุม ความสม่ำเสมอ งานคิว และจุดที่ระบบตั้งข้อสังเกต"}
                                      </p>
                                    </div>
                                  }
                                >
                                  <div className="cursor-help">
                                    <Chip
                                      size="sm"
                                      variant="flat"
                                      className={`${getScoreBg(row.ta.performanceScore)} ${getScoreColor(row.ta.performanceScore)}`}
                                    >
                                      {row.ta.performanceScore}
                                    </Chip>
                                  </div>
                                </Tooltip>
                              ) : (
                                <span className="text-default-300">-</span>
                              )}
                            </TableCell>
                            <TableCell className={`${STICKY_ACTION_CELL_CLASS} text-center`}>
                              <Button
                                size="sm"
                                variant="flat"
                                onPress={() => setSelectedTA(row.ta)}
                                className="bg-blue-50 text-blue-600 hover:bg-blue-100"
                              >
                                {isEnglish ? "View details" : "ดูรายละเอียด"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="border border-default-200 bg-content1 shadow-sm">
            <CardBody className="p-2">
              <div className="px-3 py-2">
                <h3 className="text-base font-semibold text-foreground">
                  {isEnglish ? "Comparison by assignment" : "เปรียบเทียบตามงาน"}
                </h3>
                <p className="text-sm text-default-500">
                  {isEnglish
                    ? "Helps spot which assignments are concentrated on a small set of TAs."
                    : "ช่วยดูว่างานไหนกระจุกอยู่ที่ TA บางคนมากเกินไป"}
                </p>
              </div>

              {data.assignments.filter((item) => item.totalGraded > 0).length === 0 ? (
                <div className="px-3 py-12 text-center">
                  <Icon icon="solar:chart-2-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                  <p className="text-default-400">
                    {isEnglish ? "No graded assignment data yet." : "ยังไม่มีข้อมูลการตรวจงาน"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 px-3 pb-3">
                  {data.assignments
                    .filter((item) => item.totalGraded > 0)
                    .map((assignment) => {
                      const rows = data.taStats
                        .map((ta) => {
                          const assignmentStat = ta.perAssignment.find((item) => item.assignmentId === assignment.assignmentId);
                          if (!assignmentStat) return null;

                          return {
                            ta,
                            assignmentStat,
                          };
                        })
                        .filter(Boolean) as { ta: TAStat; assignmentStat: TAStat["perAssignment"][number] }[];

                      if (rows.length === 0) return null;

                      return (
                        <div key={assignment.assignmentId} className="rounded-2xl border border-default-200 bg-content2 p-3">
                          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h4 className="font-medium text-foreground">{assignment.assignmentName}</h4>
                              <p className="text-xs text-default-400">
                                {assignment.totalGraded} {isEnglish ? "graded items" : "รายการตรวจ"} •{" "}
                                {isEnglish ? "Full score" : "คะแนนเต็ม"} {assignment.maxScore}
                              </p>
                            </div>
                            <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
                              {isEnglish ? "Overall average" : "ค่าเฉลี่ยรวม"} {formatDecimal(assignment.avgScore)} / {assignment.maxScore}
                            </Chip>
                          </div>

                          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                            {rows.map(({ ta, assignmentStat }) => {
                              const ratio =
                                assignment.totalGraded > 0
                                  ? (assignmentStat.totalGraded / assignment.totalGraded) * 100
                                  : 0;
                              const avgDiff =
                                assignment.avgScore !== null && assignmentStat.avgScore !== null
                                  ? assignmentStat.avgScore - assignment.avgScore
                                  : null;

                              return (
                                <div
                                  key={`${assignment.assignmentId}-${ta.userId}`}
                                  className="rounded-xl border border-default-200 bg-content1 px-3 py-2"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-foreground">{ta.fullName}</p>
                                      <p className="text-xs text-default-400">
                                        {assignmentStat.totalGraded} {isEnglish ? "items" : "รายการ"} • {formatPercent(ratio)}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-semibold text-foreground">
                                        {formatDecimal(assignmentStat.avgScore)}
                                      </p>
                                      <p className={`text-xs ${avgDiff === null ? "text-default-400" : avgDiff >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                        {avgDiff === null
                                          ? "-"
                                          : `${avgDiff >= 0 ? "+" : ""}${avgDiff.toFixed(1)}`}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
