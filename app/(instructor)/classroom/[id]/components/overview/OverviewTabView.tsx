"use client";

import { memo, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Progress } from "@heroui/progress";
import { Button } from "@heroui/button";
import { Avatar } from "@heroui/avatar";
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from "@heroui/table";
import { Icon } from "@iconify/react";
import { OverviewSkeleton } from "../Skeletons";
import type {
  Course, CourseOverview, AssignmentTypeStats, OverviewAssignment, OverviewStudent,
} from "@/services/course.service";
import type { AssignmentType } from "../types";
import { getAssignmentTypeConfig, formatRelativeTime } from "./config";
import {
  computeHealthScore, computeActionItems, generateInsights,
  computeRiskStudents, buildGradeDistributionData, buildAssignmentDifficultyData,
} from "./analytics";
import {
  StudentDetailModal, HealthScoreBadge, InsightPanel, ActionCenter,
  RiskTable, GradeDistributionChart, AssignmentDifficultyChart,
  ActivityTimeline, QuickActionsBar,
} from "./components";
import type { RiskStudent } from "./analytics";

// ─── Design Tokens ──────────────────────────────────────────────────────────
const CARD = "bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm dark:shadow-zinc-950/50";
const CARD_HDR = "flex items-center gap-2.5 px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-zinc-800";

// ─── Helpers ────────────────────────────────────────────────────────────────
function CardHeader({
  icon, iconColor = "text-slate-400", title, badge, action,
}: {
  icon: string; iconColor?: string; title: string;
  badge?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className={CARD_HDR}>
      <Icon icon={icon} className={"text-[15px] " + iconColor} />
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
      {badge}
      {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
    </div>
  );
}

function Fade({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay }}
    >
      {children}
    </motion.div>
  );
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "0%";
  const bounded = Math.max(0, Math.min(100, value));
  return `${Math.round(bounded)}%`;
}

// ─── Props ──────────────────────────────────────────────────────────────────
interface OverviewTabViewProps {
  course: Course;
  overview: CourseOverview | null;
  isLoading: boolean;
  userRole: string;
  assignments: AssignmentType[];
  mounted: boolean;
  selectedAssignmentType: string;
  assignmentStatsByType: Record<string, AssignmentTypeStats>;
  availableTypes: string[];
  filteredAssignments: OverviewAssignment[];
  onNavigateToAssignments: () => void;
  onSetSelectedAssignmentType: (type: string) => void;
  onResetAssignmentTypeFilter: () => void;
  onNavigateToAttendance?: () => void;
  onNavigateToQueue?: () => void;
  onNavigateToScores?: () => void;
  onNavigateToApproval?: () => void;
  onNavigateToPeople?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────
function OverviewTabViewComponent({
  course, overview, isLoading, userRole, assignments, mounted,
  selectedAssignmentType, assignmentStatsByType, availableTypes,
  filteredAssignments, onNavigateToAssignments, onSetSelectedAssignmentType,
  onResetAssignmentTypeFilter, onNavigateToAttendance, onNavigateToQueue,
  onNavigateToScores, onNavigateToApproval, onNavigateToPeople,
}: OverviewTabViewProps) {
  const [selectedStudent, setSelectedStudent] = useState<OverviewStudent | null>(null);

  const healthScore = useMemo(() => overview ? computeHealthScore(overview) : null, [overview]);
  const actionItems = useMemo(() => overview ? computeActionItems(overview) : [], [overview]);
  const insights    = useMemo(() => overview ? generateInsights(overview) : [], [overview]);
  const riskStudents = useMemo(
    () => overview ? computeRiskStudents(overview.lowPerformers, overview.summary.totalAssignments) : [],
    [overview],
  );
  const gradeData  = useMemo(() => overview?.scoreDistribution ? buildGradeDistributionData(overview.scoreDistribution) : [], [overview?.scoreDistribution]);
  const diffData   = useMemo(() => overview?.assignments ? buildAssignmentDifficultyData(overview.assignments) : [], [overview?.assignments]);

  const handleNavigate = useMemo(() => (tab: string) => {
    const map: Record<string, (() => void) | undefined> = {
      assignments: onNavigateToAssignments,
      attendance: onNavigateToAttendance,
      queue: onNavigateToQueue,
      scores: onNavigateToScores,
      approval: onNavigateToApproval,
      people: onNavigateToPeople,
    };
    map[tab]?.();
  }, [onNavigateToAssignments, onNavigateToAttendance, onNavigateToQueue, onNavigateToScores, onNavigateToApproval, onNavigateToPeople]);

  const avgScorePct = overview?.summary.totalMaxScore && overview.summary.totalMaxScore > 0
    ? Math.max(0, Math.min(100, Math.round((overview.summary.averageScore / overview.summary.totalMaxScore) * 100)))
    : 0;

  const gradedCount = useMemo(() => {
    if (!overview?.assignments) return 0;
    return overview.assignments.filter(a => a.scoredCount > 0).length;
  }, [overview?.assignments]);

  const scoredSubmissionCount = useMemo(() => {
    if (!overview?.assignments) return 0;
    return overview.assignments.reduce((sum, a) => sum + a.scoredCount, 0);
  }, [overview?.assignments]);

  const pendingSubmissionCount = useMemo(() => {
    if (!overview?.assignments) return 0;
    return overview.assignments.reduce((sum, a) => sum + a.notScoredCount, 0);
  }, [overview?.assignments]);

  if (isLoading || !mounted) return <OverviewSkeleton />;

  // ── Metric tiles config ────────────────────────────────────────────────────
  const metrics = [
    {
      icon: "solar:users-group-rounded-bold",
      label: "นักศึกษา",
      value: overview?.summary.totalStudents ?? 0,
      sub: "คนทั้งหมด",
      iconBg: "bg-blue-50", iconColor: "text-blue-600",
    },
    {
      icon: "solar:clipboard-list-bold",
      label: "งาน",
      value: overview?.summary.totalAssignments ?? 0,
      sub: scoredSubmissionCount > 0 ? `${scoredSubmissionCount} รายการตรวจแล้ว` : `${gradedCount} งานที่มีการตรวจ`,
      iconBg: "bg-violet-50", iconColor: "text-violet-600",
    },
    {
      icon: "solar:diploma-bold",
      label: "คะแนนเฉลี่ย",
      value: avgScorePct + "%",
      sub: "ของคะแนนเต็ม",
      iconBg: "bg-emerald-50", iconColor: "text-emerald-600",
    },
    {
      icon: "solar:calendar-bold",
      label: "เข้าเรียน",
      value: formatPercent(overview?.summary.attendanceRate),
      sub: `${overview?.summary.totalAttendanceSessions ?? 0} ครั้งที่เช็คชื่อ`,
      iconBg: "bg-amber-50", iconColor: "text-amber-600",
    },
    {
      icon: "solar:user-hands-bold",
      label: "TA",
      value: overview?.summary.totalTAs ?? 0,
      sub: "ผู้ช่วยสอน",
      iconBg: "bg-rose-50", iconColor: "text-rose-600",
    },
  ];

  const healthComponents = healthScore ? [
    { label: "เข้าเรียน", value: healthScore.components.attendance },
    { label: "ตรวจงาน",  value: healthScore.components.grading },
    { label: "คะแนน",    value: healthScore.components.avgScore },
    { label: "TA",        value: healthScore.components.taCoverage },
  ] : [];

  return (
    <div className="space-y-3 sm:space-y-4">

      {/* ══ 1. COURSE HEADER ══════════════════════════════════════════════ */}
      <Fade>
        <div className={CARD + " overflow-hidden relative"}>
          <div className="absolute -top-20 -right-10 w-64 h-64 rounded-full bg-gradient-to-br from-blue-100/25 to-indigo-100/15 dark:from-blue-900/10 dark:to-transparent blur-3xl pointer-events-none" />
          <div className="relative p-4 sm:p-6">
          <div className="flex items-start gap-4">
            {/* Thumbnail */}
            <div className="w-14 h-14 shrink-0 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
              {course.image
                ? <Image src={course.image} alt={course.name} width={56} height={56} className="object-cover w-full h-full" />
                : <Icon icon="solar:book-2-bold-duotone" className="text-2xl text-slate-400" />
              }
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 rounded-md px-2 py-0.5">{course.code}</span>
                <span className="text-xs text-slate-400">{course.year} / {course.semester === 3 ? "ฤดูร้อน" : "เทอม " + course.semester}</span>
                <span className="flex items-center gap-1 text-xs font-medium">
                  <span className={"w-1.5 h-1.5 rounded-full " + (course.is_active ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                  <span className={course.is_active ? "text-emerald-600" : "text-slate-400"}>
                    {course.is_active ? "เปิดใช้งาน" : "ปิด"}
                  </span>
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">{course.name}</h1>
              {course.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{course.description}</p>}
              {course.instructor && (
                <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                  <Icon icon="solar:user-linear" className="text-xs" />
                  {course.instructor.full_name}
                </p>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <Button size="sm" variant="flat" color="default" className="bg-slate-100 text-slate-700" onPress={onNavigateToAssignments}>งาน</Button>
              {onNavigateToAttendance && (
                <Button size="sm" variant="flat" color="default" className="bg-slate-100 text-slate-700" onPress={onNavigateToAttendance}>เช็คชื่อ</Button>
              )}
              {onNavigateToQueue && (
                <Button size="sm" variant="flat" color="default" className="bg-slate-100 text-slate-700" onPress={onNavigateToQueue}>คิว</Button>
              )}
            </div>
          </div>

          <div className="mt-3 flex lg:hidden items-center gap-2 overflow-x-auto pb-1">
            <Button size="sm" variant="flat" color="default" className="bg-slate-100 text-slate-700 shrink-0" onPress={onNavigateToAssignments}>งาน</Button>
            {onNavigateToAttendance && (
              <Button size="sm" variant="flat" color="default" className="bg-slate-100 text-slate-700 shrink-0" onPress={onNavigateToAttendance}>เช็คชื่อ</Button>
            )}
            {onNavigateToQueue && (
              <Button size="sm" variant="flat" color="default" className="bg-slate-100 text-slate-700 shrink-0" onPress={onNavigateToQueue}>คิว</Button>
            )}
            {onNavigateToScores && (
              <Button size="sm" variant="flat" color="default" className="bg-slate-100 text-slate-700 shrink-0" onPress={onNavigateToScores}>คะแนน</Button>
            )}
          </div>

          {/* Health components row — mobile only */}
          {healthScore && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 lg:hidden grid grid-cols-2 sm:grid-cols-4 gap-3">
              {healthComponents.map(c => (
                <div key={c.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">{c.label}</span>
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-zinc-300">{c.value}%</span>
                  </div>
                  <Progress value={c.value} size="sm" color={c.value >= 70 ? "success" : c.value >= 50 ? "warning" : "danger"} />
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </Fade>

      {/* ══ 2. METRIC TILES ═══════════════════════════════════════════════ */}
      <Fade delay={0.05}>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className={CARD + " p-3 sm:p-4 hover:shadow-md dark:hover:shadow-zinc-900 transition-shadow duration-200"}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className={"w-8 h-8 rounded-lg flex items-center justify-center " + m.iconBg}>
                  <Icon icon={m.icon} className={"text-base " + m.iconColor} />
                </div>
                <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-widest text-right leading-tight max-w-[74px]">
                  {m.label}
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-none tabular-nums">{m.value}</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5">{m.sub}</p>
            </div>
          ))}
        </div>
      </Fade>

      {/* ══ 3. HEALTH SCORE + ACTION CENTER ══════════════════════════════ */}
      <Fade delay={0.1}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

          {/* Health Score */}
          {healthScore && (
            <div className={CARD + " md:col-span-4"}>
              <CardHeader icon="solar:heart-pulse-bold" iconColor="text-rose-400" title="Course Health" />
              <div className="p-3 sm:p-4 flex flex-col items-center">
                <HealthScoreBadge data={healthScore} />
                <div className="w-full mt-4 space-y-2">
                  {healthComponents.map(c => (
                    <div key={c.label} className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 w-16 shrink-0">{c.label}</span>
                      <Progress
                        value={c.value} size="sm" className="flex-1"
                        color={c.value >= 70 ? "success" : c.value >= 50 ? "warning" : "danger"}
                      />
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 w-7 text-right shrink-0">{c.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Center + Quick Actions */}
          <div className={CARD + " md:col-span-8 flex flex-col"}>
            <CardHeader
              icon="solar:bell-bing-bold" iconColor="text-rose-500"
              title="สิ่งที่ต้องดำเนินการ"
              badge={actionItems.length > 0
                ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold">{actionItems.length}</span>
                : null
              }
            />
            <div className="flex-1 px-4 py-3 sm:px-5 sm:py-3.5">
              {actionItems.length > 0
                ? <ActionCenter items={actionItems} onNavigate={handleNavigate} />
                : (
                  <div className="flex items-center gap-3 py-3 text-slate-400">
                    <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center">
                      <Icon icon="solar:check-circle-bold" className="text-emerald-500 text-lg" />
                    </div>
                    <span className="text-sm text-slate-500 dark:text-zinc-400">ไม่มีรายการที่ต้องดำเนินการ</span>
                  </div>
                )
              }
              {pendingSubmissionCount > 0 && (
                <p className="mt-3 text-xs text-slate-400 dark:text-zinc-500">
                  ค้างตรวจรวม {pendingSubmissionCount} รายการ
                </p>
              )}
            </div>
            {/* Quick Actions at bottom */}
            <div className="px-4 pb-3 pt-2.5 sm:px-5 sm:pb-4 sm:pt-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 dark:text-zinc-600 uppercase tracking-widest mb-2">Quick Actions</p>
              <QuickActionsBar onNavigate={handleNavigate} />
            </div>
          </div>
        </div>
      </Fade>

      {/* ══ 4. SMART INSIGHTS ════════════════════════════════════════════ */}
      {insights.length > 0 && (
        <Fade delay={0.15}>
          <div className={CARD}>
            <CardHeader
              icon="solar:lightbulb-bolt-bold" iconColor="text-amber-400"
              title="Smart Insights"
              badge={<span className="text-xs text-slate-400">— วิเคราะห์จากข้อมูลจริง</span>}
            />
            <div className="p-4">
              <InsightPanel insights={insights} />
            </div>
          </div>
        </Fade>
      )}

      {/* ══ 5. ASSIGNMENT TABLE + ACTIVITY ═══════════════════════════════ */}
      <Fade delay={0.2}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

          {/* Assignment Table */}
          <div className={CARD + " lg:col-span-2 flex flex-col"}>
            <CardHeader
              icon="solar:document-text-bold" iconColor="text-blue-500"
              title="การวิเคราะห์งาน"
              action={
                <>
                  <div className="hidden sm:flex gap-1 flex-wrap">
                    <button
                      className={"text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors " + (selectedAssignmentType === "all" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700")}
                      onClick={() => onSetSelectedAssignmentType("all")}
                    >ทั้งหมด</button>
                    {availableTypes.map(type => {
                      const cfg = getAssignmentTypeConfig(type);
                      return (
                        <button
                          key={type}
                          className={"text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 " + (selectedAssignmentType === type ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700")}
                          onClick={() => onSetSelectedAssignmentType(type)}
                        >
                          <Icon icon={cfg.icon} className="text-xs" />
                          <span className="hidden sm:inline">{cfg.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                  {assignments.length > 0 && (
                    <Button size="sm" variant="flat" color="primary" onPress={onNavigateToAssignments} className="text-xs h-7 hidden sm:flex">
                      ดูทั้งหมด
                    </Button>
                  )}
                </>
              }
            />

            <div className="sm:hidden px-4 pt-3 pb-1 flex gap-1.5 overflow-x-auto border-b border-slate-100">
              <button
                  className={"text-[11px] px-2.5 py-1 rounded-lg font-medium shrink-0 transition-colors " + (selectedAssignmentType === "all" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300")}
                onClick={() => onSetSelectedAssignmentType("all")}
              >
                ทั้งหมด
              </button>
              {availableTypes.map(type => {
                const cfg = getAssignmentTypeConfig(type);
                return (
                  <button
                    key={type}
                    className={"text-[11px] px-2.5 py-1 rounded-lg font-medium shrink-0 transition-colors flex items-center gap-1 " + (selectedAssignmentType === type ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300")}
                    onClick={() => onSetSelectedAssignmentType(type)}
                  >
                    <Icon icon={cfg.icon} className="text-xs" />
                    {cfg.shortLabel}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-x-auto">
              {filteredAssignments.length > 0 ? (
                <>
                  <div className="md:hidden px-4 py-3 space-y-2">
                    {filteredAssignments.slice(0, 6).map(assignment => {
                      const cfg = getAssignmentTypeConfig(assignment.assignment_type);
                      const isGroup = assignment.assignment_type === "permanent_group" || assignment.assignment_type === "weekly_group";
                      const submittedRate = Math.max(0, Math.min(100, assignment.submittedRate));
                      return (
                        <button
                          key={assignment.id}
                          type="button"
                          onClick={onNavigateToAssignments}
                          className="w-full text-left bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700/60 rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={"w-8 h-8 rounded-lg flex items-center justify-center shrink-0 " + cfg.bgClass}>
                                <Icon icon={cfg.icon} className={"text-sm " + cfg.textClass} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{assignment.name}</p>
                                <p className="text-[11px] text-slate-400 dark:text-zinc-500">{cfg.shortLabel} • เต็ม {assignment.max_score}</p>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                              {assignment.avgScore !== null ? Math.round(assignment.avgScore * 10) / 10 : "—"}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                            <span>ตรวจแล้ว {assignment.scoredCount}{isGroup ? " กลุ่ม" : " คน"}</span>
                            {!isGroup ? <span>ส่ง {submittedRate}%</span> : <span>งานกลุ่ม</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="hidden md:block">
                    <Table removeWrapper aria-label="Assignments">
                  <TableHeader>
                    <TableColumn className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">งาน</TableColumn>
                    <TableColumn align="center" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">คะแนนเฉลี่ย</TableColumn>
                    <TableColumn align="center" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">ตรวจแล้ว</TableColumn>
                    <TableColumn align="center" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">ความก้าวหน้า</TableColumn>
                  </TableHeader>
                  <TableBody items={filteredAssignments.slice(0, 8)}>
                    {(assignment) => {
                      const cfg = getAssignmentTypeConfig(assignment.assignment_type);
                      const isGroup = assignment.assignment_type === "permanent_group" || assignment.assignment_type === "weekly_group";
                      return (
                        <TableRow key={assignment.id} className="hover:bg-slate-50/50">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className={"w-8 h-8 rounded-xl flex items-center justify-center shrink-0 " + cfg.bgClass}>
                                <Icon icon={cfg.icon} className={"text-sm " + cfg.textClass} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1">
                                  <p className="text-sm font-medium text-slate-800 leading-tight">{assignment.name}</p>
                                  {assignment.is_score_visible === false && (
                                    <Tooltip content="คะแนนถูกซ่อน">
                                      <Icon icon="solar:eye-closed-linear" className="text-amber-400" width={12} />
                                    </Tooltip>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded-md " + cfg.bgClass + " " + cfg.textClass}>{cfg.shortLabel}</span>
                                  <span className="text-[11px] text-slate-400">/ {assignment.max_score} คะแนน</span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {assignment.avgScore !== null ? (
                              <div className="text-center tabular-nums">
                                <span className="text-sm font-semibold text-slate-700">{Math.round(assignment.avgScore * 10) / 10}</span>
                                <span className="text-[11px] text-slate-400 ml-0.5">/ {assignment.max_score}</span>
                              </div>
                            ) : <span className="block text-center text-slate-300 text-sm">—</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-center gap-0.5 tabular-nums">
                              <span className={"text-sm font-semibold " + (assignment.scoredCount > 0 ? "text-emerald-600" : "text-slate-400")}>
                                {assignment.scoredCount}
                              </span>
                              <span className="text-[10px] text-slate-400">{isGroup ? "กลุ่ม" : "คน"}</span>
                              {!isGroup && assignment.notScoredCount > 0 && (
                                <span className="text-[10px] text-rose-400">ค้าง {assignment.notScoredCount}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {!isGroup ? (
                              <div className="flex items-center gap-1.5 justify-center tabular-nums">
                                <Progress
                                  value={assignment.submittedRate} size="sm" className="w-14"
                                  color={assignment.submittedRate >= 80 ? "success" : assignment.submittedRate >= 50 ? "warning" : "danger"}
                                />
                                <span className="text-[11px] text-slate-500 w-8 text-right shrink-0">{assignment.submittedRate}%</span>
                              </div>
                            ) : <span className="block text-center text-[11px] text-slate-400">งานกลุ่ม</span>}
                          </TableCell>
                        </TableRow>
                      );
                    }}
                  </TableBody>
                </Table>
                  </div>
                </>
              ) : overview?.assignments && overview.assignments.length > 0 ? (
                <div className="py-12 text-center">
                  <Icon icon="solar:filter-linear" className="text-3xl text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 mb-3">ไม่มีงานประเภทนี้</p>
                  <Button size="sm" variant="flat" onPress={onResetAssignmentTypeFilter}>แสดงทั้งหมด</Button>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Icon icon="solar:document-add-linear" className="text-3xl text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 mb-3">ยังไม่มีงานที่มอบหมาย</p>
                  <Button size="sm" color="primary" variant="flat" onPress={onNavigateToAssignments}
                    startContent={<Icon icon="solar:add-circle-bold" />}>
                    สร้างงานใหม่
                  </Button>
                </div>
              )}
            </div>
            {assignments.length > 0 && (
              <div className="px-5 pb-4 pt-3 border-t border-slate-100 sm:hidden">
                <Button size="sm" variant="flat" color="primary" className="w-full text-xs" onPress={onNavigateToAssignments}>
                  ดูงานทั้งหมด →
                </Button>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className={CARD + " flex flex-col"}>
            <CardHeader icon="solar:history-bold" iconColor="text-purple-500" title="กิจกรรมล่าสุด" />
            <div className="flex-1 p-4 overflow-y-auto max-h-[420px]">
              <ActivityTimeline activities={overview?.recentActivities?.slice(0, 8) ?? []} />
            </div>
          </div>
        </div>
      </Fade>

      {/* ══ 6. ANALYTICS CHARTS ══════════════════════════════════════════ */}
      <Fade delay={0.25}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className={CARD}>
            <CardHeader icon="solar:chart-square-bold" iconColor="text-emerald-500" title="การกระจายคะแนน" />
            <div className="p-4">
              <GradeDistributionChart data={gradeData} />
              {gradeData.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3 justify-center">
                  {gradeData.map(d => (
                    <div key={d.label} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.fill }} />
                      <span className="text-[11px] text-slate-500">{d.label}</span>
                      <span className="text-[11px] font-semibold text-slate-700">({d.count})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={CARD}>
            <CardHeader icon="solar:graph-new-up-bold" iconColor="text-blue-500" title="ความยากของงาน (คะแนนเฉลี่ย %)" />
            <div className="p-4">
              <AssignmentDifficultyChart data={diffData} />
            </div>
          </div>
        </div>
      </Fade>

      {/* ══ 7. STUDENT RISK ANALYTICS ════════════════════════════════════ */}
      {riskStudents.length > 0 && (
        <Fade delay={0.3}>
          <div className={CARD}>
            <CardHeader
              icon="solar:danger-triangle-bold" iconColor="text-rose-500"
              title="นักศึกษากลุ่มเสี่ยง"
              badge={
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                  {riskStudents.filter((s: RiskStudent) => s.riskLevel === "high").length} เสี่ยงสูง
                </span>
              }
            />
            <div className="p-4">
              <RiskTable students={riskStudents} onSelectStudent={s => setSelectedStudent(s)} />
            </div>
          </div>
        </Fade>
      )}

      {/* ══ 8. TA ACTIVITY + COURSE INFO ═════════════════════════════════ */}
      <Fade delay={0.35}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* TA Activity (instructor/admin only) */}
          {(userRole === "instructor" || userRole === "admin") && (
            <div className={CARD}>
              <CardHeader icon="solar:user-hands-bold" iconColor="text-emerald-500" title="กิจกรรม TA" />
              <div className="p-4">
                {overview?.taActivity && overview.taActivity.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {overview.taActivity.map((ta, idx) => (
                      <div key={ta.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 border-b border-slate-50 dark:border-zinc-800/60 last:border-0">
                        <div className="relative shrink-0">
                          <Avatar name={ta.full_name} src={ta.avatar || undefined} size="sm" />
                          {idx === 0 && ta.gradedCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center">
                              <Icon icon="solar:star-bold" className="text-[8px] text-white" />
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{ta.full_name}</p>
                          <p className="text-xs text-slate-400 dark:text-zinc-500">{ta.lastActive ? formatRelativeTime(ta.lastActive) : "ยังไม่มีกิจกรรม"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-bold text-slate-800 dark:text-white">{ta.gradedCount}</p>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500">ชิ้น</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Icon icon="solar:user-hands-linear" className="text-3xl text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">ยังไม่มีผู้ช่วยสอน</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Course Info */}
          <div className={CARD + ((userRole !== "instructor" && userRole !== "admin") ? " lg:col-span-2" : "")}>
            <CardHeader icon="solar:info-circle-bold" iconColor="text-blue-500" title="ข้อมูลรายวิชา" />
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { icon: "solar:hashtag-bold",  label: "รหัสวิชา",    value: course.code,             iconColor: "text-blue-500",    bg: "bg-blue-50" },
                  { icon: "solar:calendar-bold", label: "ปีการศึกษา",  value: course.year + "",        iconColor: "text-purple-500",  bg: "bg-purple-50" },
                  { icon: "solar:notebook-bold", label: "ภาคเรียน",    value: course.semester === 3 ? "ฤดูร้อน" : "ภาค " + course.semester, iconColor: "text-emerald-500", bg: "bg-emerald-50" },
                  { icon: "solar:user-bold",     label: "อาจารย์ผู้สอน", value: course.instructor?.full_name || "—", iconColor: "text-amber-500", bg: "bg-amber-50" },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-2.5 p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-transparent dark:border-zinc-700/40 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                    <div className={"w-7 h-7 rounded-lg flex items-center justify-center shrink-0 " + item.bg}>
                      <Icon icon={item.icon} className={"text-xs " + item.iconColor} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{item.label}</p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {course.description && (
                <div className="mt-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">คำอธิบาย</p>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-3 leading-relaxed">{course.description}</p>
                </div>
              )}

              {userRole === "ta" && course.tas && course.tas.length > 0 && (
                <div className="mt-3">
                  <Divider className="mb-3" />
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">ผู้ช่วยสอน</p>
                  <div className="flex flex-wrap gap-1.5">
                    {course.tas.map(ta => (
                      <Chip key={ta.id} size="sm" variant="flat" color="success">{ta.full_name}</Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Fade>

      {/* Student Detail Modal */}
      <StudentDetailModal
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        student={selectedStudent}
        courseId={course.id}
      />
    </div>
  );
}

export const OverviewTabView = memo(OverviewTabViewComponent);
