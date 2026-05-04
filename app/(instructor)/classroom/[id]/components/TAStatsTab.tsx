"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { Pagination } from "@heroui/pagination";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import {
  getTAStats,
  getTADetail,
  type TAStat,
  type TAStatsData,
  type TADetailScore,
  type TADetailData,
  type TAPerAssignment,
  type KPIBreakdown,
  type AnomalyFlag,
} from "@/services/courseActivityLog.service";

interface TAStatsTabProps {
  courseId: string;
}

// Helper to format date
function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Performance score color helpers
function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-amber-600";
  return "text-rose-600";
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-50";
  if (score >= 60) return "bg-blue-50";
  if (score >= 40) return "bg-amber-50";
  return "bg-rose-50";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "ดีมาก";
  if (score >= 60) return "ดี";
  if (score >= 40) return "ปานกลาง";
  return "ต้องปรับปรุง";
}

function getConfidenceChip(level: string) {
  const map: Record<string, { label: string; className: string }> = {
    high: { label: "สูง", className: "bg-emerald-50 text-emerald-600" },
    medium: { label: "ปานกลาง", className: "bg-amber-50 text-amber-600" },
    low: { label: "ต่ำ", className: "bg-slate-100 text-slate-500" },
  };
  return map[level] || map.low;
}

// Anomaly Flags Card Component
function AnomalyFlagsCard({ anomalies }: { anomalies: AnomalyFlag[] }) {
  if (anomalies.length === 0) return null;
  return (
    <Card className="shadow-sm border border-amber-200">
      <CardBody className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-amber-100 rounded-xl">
            <Icon icon="solar:danger-triangle-bold" className="text-lg text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">ข้อสังเกต</h3>
            <p className="text-xs text-slate-500">{anomalies.length} รายการ</p>
          </div>
        </div>
        <div className="space-y-2">
          {anomalies.map((a, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 px-3 py-2 rounded-lg ${
                a.severity === "danger" ? "bg-rose-50 border border-rose-100" : "bg-amber-50 border border-amber-100"
              }`}
            >
              <Icon
                icon={a.severity === "danger" ? "solar:close-circle-bold" : "solar:info-circle-bold"}
                width={16}
                className={`mt-0.5 flex-shrink-0 ${a.severity === "danger" ? "text-rose-500" : "text-amber-500"}`}
              />
              <span className="text-sm text-slate-600">{a.message}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// KPI Breakdown Card Component
function KPIBreakdownCard({ kpi, confidenceLevel }: { kpi: KPIBreakdown; confidenceLevel?: string }) {
  const items = [
    { key: "workload", icon: "solar:case-round-bold", color: "text-blue-600", bg: "bg-blue-100", ...kpi.workload },
    { key: "coverage", icon: "solar:clipboard-check-bold", color: "text-indigo-600", bg: "bg-indigo-100", ...kpi.coverage },
    { key: "consistency", icon: "solar:scale-bold", color: "text-emerald-600", bg: "bg-emerald-100", ...kpi.consistency },
    { key: "spread", icon: "solar:chart-bold", color: "text-violet-600", bg: "bg-violet-100", ...kpi.spread },
    { key: "queue", icon: "solar:sort-by-time-bold", color: "text-amber-600", bg: "bg-amber-100", ...kpi.queue },
    { key: "anomaly", icon: "solar:shield-check-bold", color: "text-rose-600", bg: "bg-rose-100", ...kpi.anomaly },
  ];

  const confidenceInfo = getConfidenceChip(confidenceLevel || 'low');

  return (
    <Card className="shadow-sm border border-slate-200">
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Icon icon="solar:graph-up-bold" className="text-lg text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">KPI Breakdown</h3>
              <p className="text-xs text-slate-500">รายละเอียดแต่ละมิติ</p>
            </div>
          </div>
          <Tooltip content="ระดับความน่าเชื่อถือขึ้นอยู่กับจำนวนข้อมูลที่มี">
            <Chip size="sm" variant="flat" className={confidenceInfo.className}>
              ความน่าเชื่อถือ: {confidenceInfo.label}
            </Chip>
          </Tooltip>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((item) => (
            <div key={item.key} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 ${item.bg} rounded-lg`}>
                  <Icon icon={item.icon} className={`text-sm ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 truncate">{item.label}</p>
                  <p className="text-[10px] text-slate-400">น้ำหนัก {(item.weight * 100).toFixed(0)}%</p>
                </div>
                <span className={`text-lg font-bold ${getScoreColor(item.score)}`}>
                  {item.score}
                </span>
              </div>
              {/* Mini bar */}
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
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
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// ============================================
// Loading Skeletons (matching PeopleTab pattern)
// ============================================

function StatsCardSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="shadow-sm border border-slate-200">
          <CardBody className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="w-20 h-3 rounded-lg" />
                <Skeleton className="w-8 h-6 rounded-lg" />
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
    <Card className="shadow-sm border border-slate-200">
      <CardBody className="p-2">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="w-32 h-4 rounded-lg" />
                <Skeleton className="w-48 h-3 rounded-lg" />
              </div>
              <Skeleton className="w-12 h-5 rounded-full" />
              <Skeleton className="w-12 h-5 rounded-full" />
              <Skeleton className="w-24 h-8 rounded-lg" />
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// ============================================
// Suspicious Behavior Detection
// ============================================

function SuspiciousAlert({
  taStats,
  assignments,
}: {
  taStats: TAStat[];
  assignments: { assignmentId: number; assignmentName: string; maxScore: number; avgScore: number | null }[];
}) {
  const alerts: { taName: string; message: string; severity: "warning" | "danger" }[] = [];

  for (const ta of taStats) {
    for (const pa of ta.perAssignment) {
      const overallAssignment = assignments.find((a) => a.assignmentId === pa.assignmentId);
      if (!overallAssignment || overallAssignment.avgScore === null || pa.avgScore === null) continue;

      const diff = Math.abs(pa.avgScore - overallAssignment.avgScore);
      const threshold = overallAssignment.maxScore * 0.3;
      if (diff > threshold && pa.totalGraded >= 3) {
        alerts.push({
          taName: ta.fullName,
          message: `ค่าเฉลี่ยคะแนนงาน "${pa.assignmentName}" (${pa.avgScore}) ต่างจากค่าเฉลี่ยรวม (${overallAssignment.avgScore}) มากกว่า 30%`,
          severity: diff > overallAssignment.maxScore * 0.5 ? "danger" : "warning",
        });
      }

      if (pa.scoreDistribution.length > 0 && pa.totalGraded >= 5) {
        const maxBucket = Math.max(...pa.scoreDistribution.map((d) => d.count));
        if (maxBucket / pa.totalGraded > 0.8) {
          alerts.push({
            taName: ta.fullName,
            message: `ตรวจงาน "${pa.assignmentName}" มีคะแนนซ้ำกันมากผิดปกติ (${maxBucket}/${pa.totalGraded} อยู่ในช่วงเดียวกัน)`,
            severity: "warning",
          });
        }
      }
    }
  }

  if (alerts.length === 0) return null;

  return (
    <Card className="shadow-sm border border-amber-200">
      <CardBody className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-amber-100 rounded-xl">
            <Icon icon="solar:danger-triangle-bold" className="text-xl text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">สิ่งที่ควรตรวจสอบ</h3>
            <p className="text-xs text-slate-500">{alerts.length} รายการที่ตรวจพบ</p>
          </div>
        </div>
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 px-3 py-2 rounded-lg ${
                alert.severity === "danger" ? "bg-rose-50 border border-rose-100" : "bg-amber-50 border border-amber-100"
              }`}
            >
              <Icon
                icon={alert.severity === "danger" ? "solar:close-circle-bold" : "solar:info-circle-bold"}
                width={16}
                className={`mt-0.5 flex-shrink-0 ${alert.severity === "danger" ? "text-rose-500" : "text-amber-500"}`}
              />
              <div>
                <span className="text-sm font-medium text-slate-800">{alert.taName}: </span>
                <span className="text-sm text-slate-600">{alert.message}</span>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// ============================================
// TA Detail View
// ============================================

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
  const [detail, setDetail] = useState<TADetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterAssignment, setFilterAssignment] = useState("");
  const [page, setPage] = useState(1);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTADetail(courseId, ta.userId, {
        assignmentId: filterAssignment ? parseInt(filterAssignment) : undefined,
        page,
        limit: 30,
      });
      setDetail(data);
    } catch {
      addToast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลรายละเอียด TA ได้", color: "danger",timeout: 3000,
                shouldShowTimeoutProgress: true, });
    } finally {
      setLoading(false);
    }
  }, [courseId, ta.userId, filterAssignment, page]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return (
    <div className="space-y-4">
      {/* Detail Header */}
      <div className="flex items-center justify-start gap-1">
         <Button
          size="sm"
          variant="flat"
          onPress={onClose}
          startContent={<Icon icon="solar:arrow-left-linear" width={16} />}
          className="bg-slate-100 text-slate-600 hover:bg-slate-200"
          isIconOnly
        >
        </Button>
        <div className="flex items-center gap-3">
          <Avatar
            name={ta.fullName}
            size="md"
            src={ta.avatar || undefined}
            className="bg-gradient-to-br from-indigo-500 to-blue-500"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-800">{ta.fullName}</h3>
              {/* {ta.performanceScore != null && (
                <Chip
                  size="sm"
                  variant="flat"
                  className={`${getScoreBgColor(ta.performanceScore)} ${getScoreColor(ta.performanceScore)} font-bold`}
                >
                  {ta.performanceScore} — {getScoreLabel(ta.performanceScore)}
                </Chip>
              )} */}
            </div>
            <p className="text-xs text-slate-500">{ta.email}</p>
          </div>
        </div>
       
      </div>

      {/* KPI Breakdown (only when data is present) */}
      {/* {ta.kpiBreakdown && (
        <KPIBreakdownCard kpi={ta.kpiBreakdown} confidenceLevel={ta.confidenceLevel} />
      )} */}

      {/* Anomaly Flags (only when data is present) */}
      {/* {ta.anomalies && ta.anomalies.length > 0 && (
        <AnomalyFlagsCard anomalies={ta.anomalies} />
      )} */}

      {/* Per-Assignment Stats Table */}
      <Card className="shadow-sm border border-slate-200">
        <CardBody className="p-2">
          <div className="px-3 py-2">
            <h3 className="text-base font-semibold text-slate-800">สถิติตามงาน</h3>
          </div>
          <div className="overflow-x-auto">
            <Table
              aria-label="TA per-assignment stats"
              removeWrapper
              classNames={{
                th: "bg-slate-50 text-slate-600 font-semibold text-sm",
                td: "py-3",
              }}
            >
              <TableHeader>
                <TableColumn>ชื่องาน</TableColumn>
                <TableColumn align="center">คะแนนเต็ม</TableColumn>
                <TableColumn align="center">ตรวจแล้ว</TableColumn>
                <TableColumn align="center">เฉลี่ย</TableColumn>
                <TableColumn align="center">ต่ำสุด</TableColumn>
                <TableColumn align="center">สูงสุด</TableColumn>
                <TableColumn align="center">การกระจาย</TableColumn>
              </TableHeader>
              <TableBody
                emptyContent={
                  <div className="py-10 text-center">
                    <Icon icon="solar:clipboard-list-linear" className="text-5xl text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400">TA ยังไม่มีการตรวจงาน</p>
                  </div>
                }
              >
                {ta.perAssignment.map((a) => (
                  <TableRow key={a.assignmentId}>
                    <TableCell>
                      <span className="text-sm font-medium text-slate-800">{a.assignmentName}</span>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-600">
                        {a.maxScore}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-bold text-blue-600">{a.totalGraded}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold text-emerald-600">
                        {a.avgScore !== null ? a.avgScore : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-amber-600">
                        {a.minScore !== null ? a.minScore : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-rose-600">
                        {a.maxScore_given !== null ? a.maxScore_given : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {a.scoreDistribution.length > 0 ? (
                        <div className="flex items-end gap-0.5 h-6 min-w-[60px] justify-center">
                          {a.scoreDistribution.map((bucket, idx) => {
                            const maxCount = Math.max(...a.scoreDistribution.map((b) => b.count));
                            const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                            return (
                              <Tooltip key={idx} content={`${bucket.range}: ${bucket.count} คน`}>
                                <div
                                  className="w-2.5 bg-blue-400 rounded-t transition-all cursor-help"
                                  style={{ height: `${Math.max(height, 8)}%` }}
                                />
                              </Tooltip>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      {/* Queue Stats */}
      {/* {ta.queueStats && (
        <Card className="shadow-sm border border-slate-200">
          <CardBody className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-amber-100 rounded-xl">
                <Icon icon="solar:sort-by-time-bold" className="text-lg text-amber-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">สถิติคิวตรวจงาน</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="shadow-none border border-slate-100">
                <CardBody className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <Icon icon="solar:check-circle-bold" className="text-sm text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">สำเร็จ</p>
                      <p className="text-lg font-bold text-slate-800">{ta.queueStats.totalCompleted}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
              <Card className="shadow-none border border-slate-100">
                <CardBody className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 rounded-lg">
                      <Icon icon="solar:chart-square-bold" className="text-sm text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">เฉลี่ย</p>
                      <p className="text-lg font-bold text-slate-800">
                        {ta.queueStats.avgScore !== null ? ta.queueStats.avgScore : "-"}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
              <Card className="shadow-none border border-slate-100">
                <CardBody className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-100 rounded-lg">
                      <Icon icon="solar:arrow-down-bold" className="text-sm text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">ต่ำสุด</p>
                      <p className="text-lg font-bold text-slate-800">
                        {ta.queueStats.minScore !== null ? ta.queueStats.minScore : "-"}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
              <Card className="shadow-none border border-slate-100">
                <CardBody className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-100 rounded-lg">
                      <Icon icon="solar:arrow-up-bold" className="text-sm text-rose-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">สูงสุด</p>
                      <p className="text-lg font-bold text-slate-800">
                        {ta.queueStats.maxScore !== null ? ta.queueStats.maxScore : "-"}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </CardBody>
        </Card>
      )} */}

      {/* Score History Table */}
      <Card className="shadow-sm border border-slate-200">
        <CardBody className="p-2">
          <div className="flex items-center justify-between px-3 py-2">
            <h3 className="text-base font-semibold text-slate-800">ประวัติการตรวจ</h3>
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="bordered"
                  size="sm"
                  className="min-w-28 justify-between border-slate-200"
                  endContent={<Icon icon="solar:alt-arrow-down-linear" className="text-slate-400 text-sm" />}
                >
                  {filterAssignment
                    ? allAssignments.find((a) => String(a.assignmentId) === filterAssignment)?.assignmentName || "งาน"
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
                  { key: "", label: "ทุกงาน" },
                  ...allAssignments.map((a) => ({
                    key: String(a.assignmentId),
                    label: a.assignmentName,
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
                  aria-label="Score history table"
                  removeWrapper
                  bottomContent={
                    detail && detail.pagination.totalPages > 1 ? (
                      <div className="flex flex-col gap-2 px-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-400">
                          หน้า {page} จาก {detail.pagination.totalPages}
                        </p>
                        <Pagination
                          page={page}
                          total={detail.pagination.totalPages}
                          onChange={setPage}
                          showControls
                          isCompact
                          size="sm"
                          classNames={{
                            cursor: "bg-blue-500 text-white",
                          }}
                        />
                      </div>
                    ) : null
                  }
                  bottomContentPlacement="outside"
                  classNames={{
                    th: "bg-slate-50 text-slate-600 font-semibold text-sm",
                    td: "py-3",
                    tr: "hover:bg-slate-50/70",
                  }}
                >
                  <TableHeader>
                    <TableColumn>งาน</TableColumn>
                    <TableColumn>รายการย่อย</TableColumn>
                    <TableColumn>นักศึกษา</TableColumn>
                    <TableColumn align="end">คะแนน</TableColumn>
                    <TableColumn>วันที่ตรวจ</TableColumn>
                  </TableHeader>
                  <TableBody
                    emptyContent={
                      <div className="py-10 text-center">
                        <Icon icon="solar:clipboard-list-linear" className="text-5xl text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-400">ไม่พบประวัติการตรวจ</p>
                      </div>
                    }
                  >
                    {(detail?.scores || []).map((score: TADetailScore) => (
                      <TableRow key={score.id}>
                        <TableCell>
                          <span className="text-sm font-medium text-slate-800">
                            {score.assignment?.name || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-500">{score.subItem?.name || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm text-slate-800">{score.student?.full_name || "-"}</p>
                            <p className="text-xs text-slate-400">{score.student?.student_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-slate-800">{score.score}</span>
                            <span className="text-xs text-slate-400">
                              /{score.subItem?.max_score || score.assignment?.max_score || "-"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-500 whitespace-nowrap">
                            {formatDateTime(score.graded_at)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

            </>
          )}

          {/* Timeline chart */}
          {/* {detail && detail.timeline.length > 0 && (
            <div className="px-3 pb-3 pt-2 border-t border-slate-100">
              <h4 className="text-sm font-medium text-slate-700 mb-2">จำนวนการตรวจรายวัน</h4>
              <div className="flex items-end gap-1 h-16">
                {detail.timeline.map((point, idx) => {
                  const maxCount = Math.max(...detail.timeline.map((t) => Number(t.count)));
                  const height = maxCount > 0 ? (Number(point.count) / maxCount) * 100 : 0;
                  return (
                    <Tooltip
                      key={idx}
                      content={`${point.date}: ${point.count} รายการ (เฉลี่ย ${parseFloat(String(point.avg_score)).toFixed(1)})`}
                    >
                      <div className="flex-1 flex flex-col items-center cursor-help">
                        <div
                          className="w-full bg-blue-400 rounded-t transition-all duration-300"
                          style={{ height: `${Math.max(height, 4)}%` }}
                        />
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>{detail.timeline[0]?.date}</span>
                <span>{detail.timeline[detail.timeline.length - 1]?.date}</span>
              </div>
            </div>
          )} */}
        </CardBody>
      </Card>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function TAStatsTab({ courseId }: TAStatsTabProps) {
  const [data, setData] = useState<TAStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTA, setSelectedTA] = useState<TAStat | null>(null);
  const [sortField, setSortField] = useState<'name' | 'score' | 'workload'>('workload');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTAStats(courseId);
      setData(result);
    } catch {
      addToast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดสถิติ TA ได้", color: "danger",timeout: 3000,
                shouldShowTimeoutProgress: true, });
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================
  // Aggregate course-level analytics
  // Computed once per data change — O(T) where T = number of TAs
  // ============================================
  const analytics = useMemo(() => {
    if (!data || data.taStats.length === 0) return null;
    const tas = data.taStats;
    const n = tas.length;

    // Average performance score across all TAs
    const perfScores = tas.map(t => t.performanceScore ?? 0);
    const avgScore = parseFloat((perfScores.reduce((a, b) => a + b, 0) / n).toFixed(1));

    // Workload fairness index: 1 - CV (coefficient of variation)
    // 100 = perfectly equal distribution, 0 = highly unequal
    const workloads = tas.map(t => t.totalScoresGraded);
    const meanWorkload = workloads.reduce((a, b) => a + b, 0) / n;
    const stdWorkload = Math.sqrt(workloads.reduce((sum, w) => sum + (w - meanWorkload) ** 2, 0) / n);
    const cv = meanWorkload > 0 ? stdWorkload / meanWorkload : 0;
    const fairnessIndex = Math.round(Math.max(0, (1 - Math.min(cv, 1)) * 100));

    // Expected workload share per TA and max for bar normalization
    const expectedShare = meanWorkload;
    const maxWorkload = Math.max(...workloads, 1);

    // Confidence level distribution
    const confidenceDist = { high: 0, medium: 0, low: 0 };
    for (const t of tas) confidenceDist[t.confidenceLevel || 'low']++;

    // Total anomaly flags
    const totalAnomalies = tas.reduce((sum, t) => sum + (t.anomalies?.length || 0), 0);

    return { avgScore, fairnessIndex, expectedShare, maxWorkload, confidenceDist, totalAnomalies };
  }, [data]);

  // Sorted TA list for the comparison table
  const sortedTAs = useMemo(() => {
    if (!data) return [];
    return [...data.taStats].sort((a, b) => {
      let va: number, vb: number;
      switch (sortField) {
        case 'score':
          va = a.performanceScore ?? 0; vb = b.performanceScore ?? 0; break;
        case 'workload':
          va = a.totalScoresGraded; vb = b.totalScoresGraded; break;
        default:
          return sortDir === 'asc'
            ? a.fullName.localeCompare(b.fullName, 'th')
            : b.fullName.localeCompare(a.fullName, 'th');
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [data, sortField, sortDir]);

  // If a TA is selected, show detail view
  if (selectedTA && data) {
    return (
      <div className="space-y-4">
        <TADetailView
          courseId={courseId}
          ta={selectedTA}
          allAssignments={data.assignments.map((a) => ({
            assignmentId: a.assignmentId,
            assignmentName: a.assignmentName,
          }))}
          onClose={() => setSelectedTA(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">สถิติการทำงานของ TA</h2>
          <p className="text-sm text-slate-500">ดูภาพรวมการตรวจงานและให้คะแนนของผู้ช่วยสอน</p>
        </div>
        <Button
          size="sm"
          variant="flat"
          startContent={<Icon icon="solar:refresh-bold" width={16} />}
          onPress={fetchData}
          isDisabled={loading}
          className="bg-slate-100 text-slate-600 hover:bg-slate-200"
        >
          รีเฟรช
        </Button>
      </div>

      {/* Loading state — skeleton cards + table matching PeopleTab pattern */}
      {loading ? (
        <>
          <StatsCardSkeleton />
          <TATableSkeleton />
        </>
      ) : !data ? (
        <Card className="shadow-sm border border-dashed border-slate-300 bg-slate-50/50">
          <CardBody className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
              <Icon icon="solar:chart-2-bold-duotone" className="text-5xl text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">ไม่สามารถโหลดข้อมูลได้</h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              กรุณาลองรีเฟรชอีกครั้ง
            </p>
            <Button
              color="primary"
              startContent={<Icon icon="solar:refresh-bold" />}
              onPress={fetchData}
              className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
            >
              ลองอีกครั้ง
            </Button>
          </CardBody>
        </Card>
      ) : (
        <>
          {/* Section 1: Course Health Overview — 4 key indicators */}
          {/* <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

            <Card className="shadow-sm border border-slate-200">
              <CardBody className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 rounded-xl">
                    <Icon icon="solar:users-group-rounded-bold" className="text-2xl text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">TA ทั้งหมด</p>
                    <p className="text-2xl font-bold text-slate-800">{data.summary.totalTAs}</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="shadow-sm border border-slate-200">
              <CardBody className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-100 rounded-xl">
                    <Icon icon="solar:graph-up-bold" className="text-2xl text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">ค่าเฉลี่ยประเมิน</p>
                    <div className="flex items-baseline gap-1">
                      <p className={`text-2xl font-bold ${analytics ? getScoreColor(analytics.avgScore) : 'text-slate-800'}`}>
                        {analytics?.avgScore ?? '-'}
                      </p>
                      <span className="text-xs text-slate-400">/ 100</span>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="shadow-sm border border-slate-200">
              <CardBody className="p-4">
                <div className="flex items-center gap-3">
                  <Tooltip content="ดัชนีความเท่าเทียม: 100 = กระจายงานเท่ากัน, ต่ำ = มีความเหลื่อมล้ำ">
                    <div className="p-2.5 bg-emerald-100 rounded-xl cursor-help">
                      <Icon icon="solar:scale-bold" className="text-2xl text-emerald-600" />
                    </div>
                  </Tooltip>
                  <div>
                    <p className="text-xs text-slate-500">ความเท่าเทียม</p>
                    <div className="flex items-baseline gap-1">
                      <p className={`text-2xl font-bold ${(analytics?.fairnessIndex ?? 0) >= 70 ? 'text-emerald-600' : (analytics?.fairnessIndex ?? 0) >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {analytics?.fairnessIndex ?? '-'}
                      </p>
                      <span className="text-xs text-slate-400">%</span>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="shadow-sm border border-slate-200">
              <CardBody className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-100 rounded-xl">
                    <Icon icon="solar:chart-square-bold" className="text-2xl text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">ตรวจงานทั้งหมด</p>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-2xl font-bold text-slate-800">{data.summary.totalScoresGraded}</p>
                      <span className="text-xs text-slate-400">{data.summary.totalAssignments} งาน</span>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div> */}

          {/* Section 2: Anomaly & Warning Indicators */}
          {/* Suspicious Behavior Alerts */}
          {/* <SuspiciousAlert taStats={data.taStats} assignments={data.assignments} /> */}

          {/* Section 3: Workload Distribution — horizontal bar chart for fairness evaluation */}
          {/* {data.taStats.length > 0 && analytics && analytics.expectedShare > 0 && (
            <Card className="shadow-sm border border-slate-200">
              <CardBody className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <Icon icon="solar:chart-2-bold" className="text-lg text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">การกระจายปริมาณงาน</h3>
                    <p className="text-xs text-slate-500">เส้นประ = ส่วนแบ่งที่คาดหวัง ({Math.round(analytics.expectedShare)} รายการ/TA)</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[...data.taStats]
                    .sort((a, b) => b.totalScoresGraded - a.totalScoresGraded)
                    .map((ta) => {
                      const barPct = analytics.maxWorkload > 0 ? (ta.totalScoresGraded / analytics.maxWorkload) * 100 : 0;
                      const expectedPct = analytics.maxWorkload > 0 ? (analytics.expectedShare / analytics.maxWorkload) * 100 : 0;
                      const sharePct = Math.round((ta.totalScoresGraded / analytics.expectedShare) * 100);
                      return (
                        <div key={ta.userId} className="flex items-center gap-3">
                          <span className="text-sm text-slate-600 w-28 truncate text-right">{ta.fullName}</span>
                          <div className="flex-1 relative h-5">
                            <div className="absolute inset-0 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${sharePct >= 70 ? 'bg-blue-400' : 'bg-amber-400'}`}
                                style={{ width: `${Math.min(barPct, 100)}%` }}
                              />
                            </div>
                            <div
                              className="absolute top-0 bottom-0 border-l-2 border-dashed border-slate-500/50"
                              style={{ left: `${Math.min(expectedPct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold w-14 text-right ${sharePct >= 70 ? 'text-blue-600' : 'text-amber-600'}`}>
                            {ta.totalScoresGraded}{' '}
                            <span className="font-normal text-slate-400">({sharePct}%)</span>
                          </span>
                        </div>
                      );
                    })}
                </div>
              </CardBody>
            </Card>
          )} */}

          {/* Section 4: Per-TA Comparison Table */}
          <Card className="shadow-sm border border-slate-200">
            <CardBody className="p-2">
              <div className="flex items-center justify-between px-3 py-2">
                <h3 className="text-base font-semibold text-slate-800">สถิติรายบุคคล</h3>
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      size="sm"
                      variant="flat"
                      className="bg-slate-100 text-slate-600 min-w-[100px] justify-between"
                      startContent={<Icon icon="solar:sort-linear" width={14} />}
                      endContent={<Icon icon={sortDir === 'desc' ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-up-linear"} width={12} className="text-slate-400" />}
                    >
                      {sortField === 'score' ? 'คะแนน' : sortField === 'workload' ? 'ปริมาณงาน' : 'ชื่อ'}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    selectionMode="single"
                    selectedKeys={new Set([sortField])}
                    onSelectionChange={(keys) => {
                      const key = Array.from(keys)[0] as typeof sortField;
                      if (key === sortField) {
                        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setSortField(key);
                        setSortDir('desc');
                      }
                    }}
                  >
                    <DropdownItem key="score">คะแนนประเมิน</DropdownItem>
                    <DropdownItem key="workload">ปริมาณงาน</DropdownItem>
                    <DropdownItem key="name">ชื่อ-นามสกุล</DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
              {data.taStats.length === 0 ? (
                <Card className="shadow-none border border-dashed border-slate-300 bg-slate-50/50 m-2">
                  <CardBody className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                      <Icon icon="solar:users-group-rounded-bold-duotone" className="text-4xl text-blue-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-700 mb-1">ยังไม่มี TA</h3>
                    <p className="text-slate-500 text-sm">เพิ่มผู้ช่วยสอนในหน้าบุคลากรก่อน</p>
                  </CardBody>
                </Card>
              ) : (
                <div className="overflow-x-auto">
                  <Table
                    aria-label="TA stats overview"
                    removeWrapper
                    classNames={{
                      th: "bg-slate-50 text-slate-600 font-semibold text-sm",
                      td: "py-3",
                    }}
                  >
                    <TableHeader>
                      <TableColumn>ชื่อ-นามสกุล</TableColumn>
                      {/* <TableColumn align="center">คะแนนประเมิน</TableColumn> */}
                      <TableColumn align="center">ตรวจทั้งหมด</TableColumn>
                      <TableColumn align="center">งานที่ตรวจ</TableColumn>
                      <TableColumn align="center">คิวสำเร็จ</TableColumn>
                      {/* <TableColumn align="center">คะแนนเฉลี่ย (คิว)</TableColumn> */}
                      <TableColumn align="center">จัดการ</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {sortedTAs.map((ta) => (
                        <TableRow key={ta.userId}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar
                                name={ta.fullName}
                                size="sm"
                                src={ta.avatar || undefined}
                                className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white"
                              />
                              <div>
                                <p className="font-medium text-slate-800">{ta.fullName}</p>
                                <p className="text-xs text-slate-400">{ta.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          {/* <TableCell>
                            {ta.performanceScore != null ? (
                              <Tooltip
                                content={
                                  <div className="px-1 py-1 text-xs">
                                    <p className="font-semibold mb-1">{getScoreLabel(ta.performanceScore)} ({ta.performanceScore}/100)</p>
                                    <p>ความน่าเชื่อถือ: {getConfidenceChip(ta.confidenceLevel || 'low').label}</p>
                                    {ta.confidence && (
                                      <p className="mt-0.5">ข้อมูล {ta.confidence.sampleSize} รายการ (แนะนำ ≥{ta.confidence.minRecommended})</p>
                                    )}
                                    {ta.anomalies && ta.anomalies.length > 0 && (
                                      <p className="mt-0.5 text-amber-400">{ta.anomalies.length} ข้อสังเกต</p>
                                    )}
                                  </div>
                                }
                              >
                                <div className="flex flex-col items-center gap-0.5 cursor-help">
                                  <div className="flex items-center gap-1">
                                    <span className={`text-sm font-bold ${getScoreColor(ta.performanceScore)}`}>
                                      {ta.performanceScore}
                                    </span>
                                    {ta.anomalies && ta.anomalies.length > 0 && (
                                      <Icon icon="solar:danger-triangle-bold" width={12} className="text-amber-500" />
                                    )}
                                  </div>
                                  <div className="w-10 bg-slate-200 rounded-full h-1">
                                    <div
                                      className={`h-1 rounded-full ${
                                        ta.performanceScore >= 80
                                          ? "bg-emerald-500"
                                          : ta.performanceScore >= 60
                                            ? "bg-blue-500"
                                            : ta.performanceScore >= 40
                                              ? "bg-amber-500"
                                              : "bg-rose-500"
                                      }`}
                                      style={{ width: `${Math.min(ta.performanceScore, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </Tooltip>
                            ) : (
                              <span className="text-slate-300 text-sm">-</span>
                            )}
                          </TableCell> */}
                          <TableCell>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-sm font-bold text-blue-600">{ta.totalScoresGraded}</span>
                              {analytics && analytics.expectedShare > 0 && (
                                <Tooltip content={`${Math.round(ta.totalScoresGraded / analytics.expectedShare * 100)}% ของส่วนแบ่งที่คาดหวัง`}>
                                  <div className="w-10 bg-slate-200 rounded-full h-1 cursor-help">
                                    <div
                                      className={`h-1 rounded-full ${ta.totalScoresGraded / analytics.expectedShare >= 0.7 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                      style={{ width: `${Math.min(ta.totalScoresGraded / analytics.expectedShare * 100, 100)}%` }}
                                    />
                                  </div>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-emerald-600">{ta.assignmentsGraded}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-amber-600">
                              {ta.queueStats?.totalCompleted || 0}
                            </span>
                          </TableCell>
                          {/* <TableCell>
                            {ta.queueStats?.avgScore !== null && ta.queueStats?.avgScore !== undefined ? (
                              <Chip size="sm" variant="flat" className="bg-emerald-50 text-emerald-600">
                                {ta.queueStats.avgScore}
                              </Chip>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </TableCell> */}
                          <TableCell>
                            <div className="flex items-center justify-center">
                              <Tooltip content="ดูรายละเอียดการตรวจ">
                                <Button
                                  size="sm"
                                  variant="flat"
                                  onPress={() => setSelectedTA(ta)}
                                  className="bg-blue-50 text-blue-600 hover:bg-blue-100"
                                  startContent={<Icon icon="solar:eye-bold" width={14} />}
                                >
                                  ดูรายละเอียด
                                </Button>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Overall Assignment Comparison */}
          <Card className="shadow-sm border border-slate-200">
            <CardBody className="p-2">
              <div className="px-3 py-2">
                <h3 className="text-base font-semibold text-slate-800">เปรียบเทียบ TA ตามงาน</h3>
              </div>
              {data.assignments.filter((a) => a.totalGraded > 0).length === 0 ? (
                <div className="text-center py-12 px-3">
                  <Icon icon="solar:chart-2-linear" className="text-5xl text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">ยังไม่มีข้อมูลคะแนน</p>
                </div>
              ) : (
                <div className="space-y-3 px-3 pb-3">
                  {data.assignments
                    .filter((a) => a.totalGraded > 0)
                    .map((assignment) => {
                      const tasForAssignment = data.taStats
                        .map((ta) => {
                          const pa = ta.perAssignment.find((p) => p.assignmentId === assignment.assignmentId);
                          return pa ? { taName: ta.fullName, ...pa } : null;
                        })
                        .filter(Boolean) as (TAPerAssignment & { taName: string })[];

                      if (tasForAssignment.length === 0) return null;

                      return (
                        <div key={assignment.assignmentId} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm text-slate-800">{assignment.assignmentName}</h4>
                            <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
                              ค่าเฉลี่ยรวม: {assignment.avgScore ?? "-"} / {assignment.maxScore}
                            </Chip>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {tasForAssignment.map((ta_a) => (
                              <div
                                key={ta_a.taName}
                                className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-slate-100"
                              >
                                <span className="text-sm text-slate-700">{ta_a.taName}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-400">{ta_a.totalGraded} รายการ</span>
                                  <Chip
                                    size="sm"
                                    variant="flat"
                                    className={
                                      assignment.avgScore !== null && ta_a.avgScore !== null
                                        ? Math.abs(ta_a.avgScore - assignment.avgScore) > assignment.maxScore * 0.2
                                          ? "bg-amber-50 text-amber-600"
                                          : "bg-emerald-50 text-emerald-600"
                                        : "bg-slate-100 text-slate-600"
                                    }
                                  >
                                    {ta_a.avgScore ?? "-"}
                                  </Chip>
                                  {assignment.avgScore !== null && ta_a.avgScore !== null && (
                                    <span className={`text-[10px] font-medium ${ta_a.avgScore >= assignment.avgScore ? 'text-emerald-500' : 'text-rose-500'}`}>
                                      {ta_a.avgScore >= assignment.avgScore ? '▲' : '▼'}
                                      {Math.abs(ta_a.avgScore - assignment.avgScore).toFixed(1)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Section 6: Evaluation Methodology — transparency & explainability */}
          {/* <Card className="shadow-sm border border-slate-200">
            <CardBody className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-slate-100 rounded-xl">
                  <Icon icon="solar:document-text-bold" className="text-lg text-slate-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800">เกณฑ์การประเมินผล</h3>
                  <p className="text-xs text-slate-500">วิธีคำนวณคะแนนประเมิน TA — โปร่งใสและตรวจสอบได้</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {[
                  { label: 'ปริมาณงาน', weight: '30%', desc: 'สัดส่วนงานที่ตรวจเทียบกับค่าเฉลี่ยต่อ TA', icon: 'solar:case-round-bold', color: 'text-blue-600', bg: 'bg-blue-100' },
                  { label: 'ความสม่ำเสมอ', weight: '25%', desc: 'ค่าเฉลี่ยคะแนนใกล้เคียงค่าเฉลี่ยรวมแค่ไหน', icon: 'solar:scale-bold', color: 'text-emerald-600', bg: 'bg-emerald-100' },
                  { label: 'ความครอบคลุม', weight: '15%', desc: 'จำนวนงานที่ได้ตรวจเทียบกับงานทั้งหมด', icon: 'solar:clipboard-check-bold', color: 'text-indigo-600', bg: 'bg-indigo-100' },
                  { label: 'คิวตรวจงาน', weight: '15%', desc: 'จำนวนคิวที่สำเร็จเทียบกับค่าเฉลี่ยต่อ TA', icon: 'solar:sort-by-time-bold', color: 'text-amber-600', bg: 'bg-amber-100' },
                  { label: 'การกระจายคะแนน', weight: '10%', desc: 'ความแปรปรวนคะแนนสอดคล้องกับภาพรวม', icon: 'solar:chart-bold', color: 'text-violet-600', bg: 'bg-violet-100' },
                  { label: 'สิ่งผิดปกติ', weight: '5%', desc: 'หักคะแนนเมื่อตรวจพบพฤติกรรมที่ควรตรวจสอบ', icon: 'solar:shield-check-bold', color: 'text-rose-600', bg: 'bg-rose-100' },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`p-1 ${item.bg} rounded-md`}>
                        <Icon icon={item.icon} className={`text-xs ${item.color}`} />
                      </div>
                      <span className="text-sm font-medium text-slate-700 flex-1">{item.label}</span>
                      <Chip size="sm" variant="flat" className="bg-slate-200 text-slate-600 text-[10px] h-5">{item.weight}</Chip>
                    </div>
                    <p className="text-xs text-slate-500 pl-7">{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                คะแนนรวม (0–100) = Σ(น้ำหนัก × คะแนนแต่ละมิติ) · ความน่าเชื่อถือ: สูง (≥20 รายการ), ปานกลาง (10–19), ต่ำ (&lt;10) · ดัชนีความเท่าเทียมคำนวณจาก 1 − สัมประสิทธิ์ความแปรปรวน (CV) ของปริมาณงาน
              </p>
            </CardBody>
          </Card> */}
        </>
      )}
    </div>
  );
}
