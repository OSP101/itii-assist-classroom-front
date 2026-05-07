/**
 * Rule-based analytics engine for the Course Overview Dashboard.
 * No machine learning — uses threshold comparisons and weighted scoring.
 */

import type { CourseOverview, OverviewStudent } from "@/services/course.service";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type HealthLevel = "excellent" | "healthy" | "warning" | "critical";
export type RiskLevel = "low" | "medium" | "high";
export type InsightType = "success" | "info" | "warning" | "danger";

export interface HealthScoreData {
  score: number;
  level: HealthLevel;
  insight: string;
  components: {
    attendance: number;
    grading: number;
    avgScore: number;
    taCoverage: number;
  };
}

export interface InsightItem {
  id: string;
  type: InsightType;
  icon: string;
  title: string;
  description: string;
}

export interface ActionItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  count: number;
  severity: "low" | "medium" | "high";
  tab?: string;
}

export interface RiskStudent extends OverviewStudent {
  riskLevel: RiskLevel;
  recommendation: string;
  riskScore: number;
}

export interface WeeklyDataPoint {
  week: string;
  value: number;
}

// ─── Health Score ────────────────────────────────────────────────────────────

export function computeHealthScore(overview: CourseOverview): HealthScoreData {
  const { summary, assignments } = overview;

  const attendance = clampPercent(summary.attendanceRate ?? 0);

  // Grading progress = scored / (scored + unscored)
  const totalScored = assignments.reduce((s, a) => s + a.scoredCount, 0);
  const totalUnscored = assignments.reduce((s, a) => s + a.notScoredCount, 0);
  const totalExpected = totalScored + totalUnscored;
  const grading = totalExpected > 0 ? clampPercent((totalScored / totalExpected) * 100) : 100;

  const avgScorePercent =
    summary.totalMaxScore > 0
      ? clampPercent((summary.averageScore / summary.totalMaxScore) * 100)
      : 50; // neutral when no score data

  const taCoverage = summary.totalTAs > 0 ? 100 : summary.totalStudents > 15 ? 40 : 75;

  const components = {
    attendance,
    grading,
    avgScore: avgScorePercent,
    taCoverage,
  };

  const score = clampPercent(
    components.attendance * 0.30 +
    components.grading * 0.30 +
    components.avgScore * 0.25 +
    components.taCoverage * 0.15,
  );

  let level: HealthLevel;
  let insight: string;

  if (score >= 80) {
    level = "excellent";
    insight = "รายวิชาทำงานได้ดีเยี่ยมในทุกด้าน";
  } else if (score >= 65) {
    level = "healthy";
    const worstKey = (Object.keys(components) as Array<keyof typeof components>).reduce((a, b) =>
      components[a] < components[b] ? a : b,
    );
    if (worstKey === "attendance") insight = "การเข้าเรียนมีโอกาสปรับปรุงได้";
    else if (worstKey === "grading") insight = "มีงานบางส่วนที่รอการตรวจ";
    else insight = "ภาพรวมดี มีบางส่วนที่ควรติดตาม";
  } else if (score >= 50) {
    level = "warning";
    if (components.attendance < 60) insight = "อัตราการเข้าเรียนต่ำกว่าเกณฑ์";
    else if (components.grading < 50) insight = "งานจำนวนมากยังรอการตรวจ";
    else if (components.avgScore < 45) insight = "คะแนนเฉลี่ยต่ำกว่าครึ่งหนึ่ง";
    else insight = "ต้องการความใส่ใจในหลายประเด็น";
  } else {
    level = "critical";
    insight = "ตัวชี้วัดหลายด้านต่ำกว่าเกณฑ์ ควรดำเนินการแก้ไขเร่งด่วน";
  }

  return { score, level, insight, components };
}

// ─── Action Items ────────────────────────────────────────────────────────────

export function computeActionItems(overview: CourseOverview): ActionItem[] {
  const actions: ActionItem[] = [];
  const { assignments, lowPerformers, summary } = overview;

  // Ungraded assignments
  const ungradedCount = assignments.reduce((s, a) => s + a.notScoredCount, 0);
  if (ungradedCount > 0) {
    actions.push({
      id: "ungraded",
      icon: "solar:document-text-bold",
      title: "งานรอการตรวจ",
      description: `${ungradedCount} ชิ้นงานยังไม่ได้รับการตรวจ`,
      count: ungradedCount,
      severity: ungradedCount > 20 ? "high" : ungradedCount > 5 ? "medium" : "low",
      tab: "assignments",
    });
  }

  // At-risk students
  if (lowPerformers.length > 0) {
    actions.push({
      id: "at_risk",
      icon: "solar:danger-triangle-bold",
      title: "นักศึกษาเสี่ยงไม่ผ่าน",
      description: `${lowPerformers.length} คนมีคะแนนต่ำกว่าเกณฑ์`,
      count: lowPerformers.length,
      severity: lowPerformers.length > 5 ? "high" : "medium",
      tab: "people",
    });
  }

  // No TA
  if (summary.totalTAs === 0 && summary.totalStudents > 15) {
    actions.push({
      id: "no_ta",
      icon: "solar:user-hands-bold",
      title: "ยังไม่มีผู้ช่วยสอน",
      description: `มีนักศึกษา ${summary.totalStudents} คน แต่ไม่มี TA`,
      count: 0,
      severity: "medium",
      tab: "people",
    });
  }

  // Low attendance
  if (summary.attendanceRate > 0 && summary.attendanceRate < 60) {
    actions.push({
      id: "low_attendance",
      icon: "solar:calendar-mark-bold",
      title: "การเข้าเรียนต่ำ",
      description: `เฉลี่ยเข้าเรียนเพียง ${summary.attendanceRate}%`,
      count: 0,
      severity: summary.attendanceRate < 40 ? "high" : "medium",
      tab: "attendance",
    });
  }

  return actions;
}

// ─── Insights ────────────────────────────────────────────────────────────────

export function generateInsights(overview: CourseOverview): InsightItem[] {
  const insights: InsightItem[] = [];
  const { summary, assignments, lowPerformers, taActivity } = overview;
  let id = 0;
  const next = () => `insight_${++id}`;

  // Trend
  if (summary.trend === "down" && summary.trendValue > 0) {
    insights.push({
      id: next(),
      type: "warning",
      icon: "solar:graph-down-bold",
      title: "แนวโน้มคะแนนลดลง",
      description: `คะแนนเฉลี่ยลดลง ${summary.trendValue.toFixed(1)}% จากช่วงที่ผ่านมา`,
    });
  } else if (summary.trend === "up" && summary.trendValue > 0) {
    insights.push({
      id: next(),
      type: "success",
      icon: "solar:graph-up-bold",
      title: "แนวโน้มคะแนนดีขึ้น",
      description: `คะแนนเฉลี่ยเพิ่มขึ้น ${summary.trendValue.toFixed(1)}% ต่อเนื่อง`,
    });
  }

  // Low attendance
  if (summary.attendanceRate < 70 && summary.totalAttendanceSessions > 0) {
    insights.push({
      id: next(),
      type: summary.attendanceRate < 50 ? "danger" : "warning",
      icon: "solar:users-group-rounded-bold",
      title: "อัตราการเข้าเรียนต่ำ",
      description: `เฉลี่ย ${summary.attendanceRate}% จาก ${summary.totalAttendanceSessions} รอบ`,
    });
  }

  // Hard assignments (avg < 50% of max)
  const hardAssignments = assignments
    .filter(a => a.avgScore !== null && a.max_score > 0 && a.scoredCount > 2)
    .filter(a => (a.avgScore! / a.max_score) * 100 < 50)
    .sort((a, b) => (a.avgScore! / a.max_score) - (b.avgScore! / b.max_score));

  if (hardAssignments.length > 0) {
    const h = hardAssignments[0];
    const pct = Math.round((h.avgScore! / h.max_score) * 100);
    insights.push({
      id: next(),
      type: "warning",
      icon: "solar:document-text-bold",
      title: `"${h.name}" มีคะแนนต่ำผิดปกติ`,
      description: `คะแนนเฉลี่ย ${h.avgScore} / ${h.max_score} (${pct}%)`,
    });
  }

  // Many at-risk students
  if (lowPerformers.length > 5) {
    insights.push({
      id: next(),
      type: "danger",
      icon: "solar:danger-triangle-bold",
      title: `นักศึกษาเสี่ยงสอบไม่ผ่าน ${lowPerformers.length} คน`,
      description: "ควรดำเนินการช่วยเหลือและติดตามผลโดยด่วน",
    });
  }

  // TA workload imbalance
  if (taActivity.length > 1) {
    const counts = taActivity.map(ta => ta.gradedCount).filter(c => c > 0);
    if (counts.length > 1) {
      const maxC = Math.max(...counts);
      const minC = Math.min(...counts);
      if (minC > 0 && maxC / minC > 3) {
        insights.push({
          id: next(),
          type: "info",
          icon: "solar:user-hands-bold",
          title: "ภาระงาน TA ไม่สมดุล",
          description: "TA บางคนมีภาระงานมากกว่าคนอื่นมากกว่า 3 เท่า",
        });
      }
    }
  }

  // Low grading rate
  const totalScored = assignments.reduce((s, a) => s + a.scoredCount, 0);
  const totalExpected = assignments.reduce((s, a) => s + a.scoredCount + a.notScoredCount, 0);
  const gradingRate = totalExpected > 0 ? clampPercent((totalScored / totalExpected) * 100) : 100;
  if (gradingRate < 40 && summary.totalAssignments > 0) {
    insights.push({
      id: next(),
      type: "warning",
      icon: "solar:clipboard-check-bold",
      title: "งานจำนวนมากยังรอการตรวจ",
      description: `ตรวจงานแล้ว ${Math.round(gradingRate)}% ของทั้งหมด`,
    });
  }

  // All good
  if (insights.length === 0) {
    insights.push({
      id: next(),
      type: "success",
      icon: "solar:verified-check-bold",
      title: "รายวิชาอยู่ในสภาพดีเยี่ยม",
      description: "ทุกตัวชี้วัดอยู่ในเกณฑ์ที่ดี ไม่มีประเด็นที่ต้องแก้ไข",
    });
  }

  return insights.slice(0, 5);
}

// ─── Student Risk ────────────────────────────────────────────────────────────

export function computeRiskStudents(
  students: OverviewStudent[],
  totalAssignments: number,
): RiskStudent[] {
  return students.map(student => {
    const missRate =
      totalAssignments > 0 ? clampPercent((student.missedCount / totalAssignments) * 100) : 0;
    const scorePercent = clampPercent(student.percentage ?? 0);

    // Higher riskScore = more at risk
    const riskScore = Math.round(missRate * 0.45 + Math.max(0, 65 - scorePercent) * 0.55);

    let riskLevel: RiskLevel;
    if (scorePercent < 40 || missRate > 50) riskLevel = "high";
    else if (scorePercent < 60 || missRate > 25) riskLevel = "medium";
    else riskLevel = "low";

    let recommendation: string;
    if (riskLevel === "high") recommendation = "ติดต่อนักศึกษาด่วน";
    else if (riskLevel === "medium") recommendation = "แนะนำเข้าพบเพื่อขอคำปรึกษา";
    else recommendation = "ติดตามงานถัดไป";

    return { ...student, riskLevel, recommendation, riskScore };
  });
}

// ─── Synthetic Attendance Trend (deterministic) ──────────────────────────────

export function generateAttendanceTrend(
  currentRate: number,
  trend: "up" | "stable" | "down" | null,
  sessionCount: number,
): WeeklyDataPoint[] {
  const weeks = Math.min(6, Math.max(3, sessionCount));
  const result: WeeklyDataPoint[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    let value: number;
    if (trend === "down") {
      value = Math.min(100, currentRate + i * 3 + (i % 2 === 0 ? 1 : 0));
    } else if (trend === "up") {
      value = Math.max(0, currentRate - i * 3 + (i % 2 === 0 ? 1 : 0));
    } else {
      value = Math.min(100, Math.max(0, currentRate + ((i % 3) - 1)));
    }
    result.push({ week: `สัปดาห์ ${weeks - i}`, value: Math.round(value) });
  }

  return result;
}

// ─── Grade Distribution for Recharts ─────────────────────────────────────────

export interface GradeBarData {
  label: string;
  count: number;
  fill: string;
}

export function buildGradeDistributionData(
  distribution: { excellent: number; good: number; average: number; poor: number },
): GradeBarData[] {
  return [
    { label: "ดีเยี่ยม (A)", count: distribution.excellent, fill: "#10b981" },
    { label: "ดี (B)", count: distribution.good, fill: "#3b82f6" },
    { label: "ปานกลาง (C)", count: distribution.average, fill: "#f59e0b" },
    { label: "ต้องปรับปรุง (D/F)", count: distribution.poor, fill: "#ef4444" },
  ];
}

// ─── Assignment Difficulty for Recharts ──────────────────────────────────────

export interface AssignmentBarData {
  name: string;
  pct: number;
  fill: string;
}

export function buildAssignmentDifficultyData(
  assignments: CourseOverview["assignments"],
): AssignmentBarData[] {
  return assignments
    .filter(a => a.avgScore !== null && a.max_score > 0 && a.scoredCount > 0)
    .map(a => {
      const pct = clampPercent((a.avgScore! / a.max_score) * 100);
      return {
        name: a.name.length > 18 ? a.name.slice(0, 18) + "…" : a.name,
        pct,
        fill: pct >= 75 ? "#10b981" : pct >= 50 ? "#3b82f6" : pct >= 30 ? "#f59e0b" : "#ef4444",
      };
    })
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 8);
}
