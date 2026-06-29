"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";
import { formatScoreValue } from "@/lib/score-input";
import {
  studentService,
  type AttendanceRecordData,
  type AssignmentScore,
  type ExamScoreData,
  type MyStudentCourseResponse,
  type StudentCourseGroup,
} from "@/services/student.service";
import userNotificationService, { type UserNotificationItem } from "@/services/user-notification.service";
import { getMyExamSeats, type MyExamSeat } from "@/services/examSeat.service";
import { CourseCoverImage } from "@/components/course";

// ─── tabs ─────────────────────────────────────────────────────────────────────

const tabs    = ["ภาพรวม", "คะแนน", "เช็กชื่อ", "ที่นั่งสอบ", "อัปเดต"] as const;
const tabKeys = ["Overview", "Scores", "Attendance", "ExamSeats", "Updates"] as const;
type TabKey = (typeof tabKeys)[number];
type ScoreCategoryKey = "all" | "lab" | "homework" | "group" | "weekly" | "exams" | "bonus";

const TAB_MAP: Record<string, TabKey> = {
  Overview: "Overview", Scores: "Scores", Attendance: "Attendance", ExamSeats: "ExamSeats", Updates: "Updates",
};

const TAB_ICONS: Record<TabKey, string> = {
  Overview:   "solar:chart-square-bold-duotone",
  Scores:     "solar:medal-star-bold-duotone",
  Attendance: "solar:calendar-mark-bold-duotone",
  ExamSeats:  "solar:armchair-bold-duotone",
  Updates:    "solar:bell-bing-bold-duotone",
};

// ─── utils ────────────────────────────────────────────────────────────────────

function fmt(value: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return "-";
  const defaults: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };
  return new Date(value).toLocaleString("th-TH", { ...defaults, ...opts });
}

function bonusDateKey(value: string | null | undefined) {
  if (!value) return "unknown";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const ATTEND_STATUS_COLORS: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  late:    "bg-amber-50  text-amber-700  border-amber-200",
  leave:   "bg-sky-50    text-sky-700    border-sky-200",
  absent:  "bg-rose-50   text-rose-700   border-rose-200",
};
const ATTEND_STATUS_TH: Record<string, string> = {
  present: "มาเรียน", late: "สาย", leave: "ลา", absent: "ขาดเรียน",
};

function assignTypeTH(type: string) {
  if (type === "assignment") return "งานบ้าน";
  if (type === "permanent_group" || type === "weekly_group") return "งานกลุ่ม";
  return "งานในคาบ";
}

function assignTypeIcon(type: string) {
  if (type === "assignment") return "solar:notebook-bold-duotone";
  if (type === "permanent_group" || type === "weekly_group") return "solar:users-group-rounded-bold-duotone";
  return "solar:laptop-bold-duotone";
}

function assignTypeColor(type: string): string {
  if (type === "assignment") return "bg-violet-50 text-violet-700 border-violet-100";
  if (type === "permanent_group" || type === "weekly_group") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-sky-50 text-sky-700 border-sky-100";
}

function examTypeTH(type: string, component: string) {
  const t = type === "midterm" ? "กลางภาค" : "ปลายภาค";
  const c = component === "lab" ? "(Lab)" : "(บรรยาย)";
  return `${t} ${c}`;
}

function notifTypeIcon(type: string) {
  if (type.startsWith("queue")) return "solar:users-group-rounded-bold-duotone";
  if (type.startsWith("attendance")) return "solar:calendar-bold-duotone";
  if (type.startsWith("score")) return "solar:medal-ribbons-bold-duotone";
  return "solar:bell-bing-bold-duotone";
}

function notifTypeColor(type: string) {
  if (type.startsWith("queue")) return "bg-violet-50 text-violet-600";
  if (type.startsWith("attendance")) return "bg-emerald-50 text-emerald-600";
  if (type.startsWith("score")) return "bg-amber-50 text-amber-600";
  return "bg-sky-50 text-sky-600";
}

function displayScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? formatScoreValue(value) : "-";
}

function studentGroupTypeLabel(group: StudentCourseGroup) {
  if (group.group_type === "permanent") return "กลุ่มโปรเจกต์";
  if (group.week_number != null) return `กลุ่มสัปดาห์ ${group.week_number}`;
  return "กลุ่มสัปดาห์";
}

// ─── sub-components ───────────────────────────────────────────────────────────

function AttendanceRow({ record }: { record: AttendanceRecordData }) {
  const colorClass = ATTEND_STATUS_COLORS[record.status] ?? "bg-slate-50 text-slate-600 border-slate-200";
  const labelTh = ATTEND_STATUS_TH[record.status] ?? record.status;
  return (
    <div className="flex items-center gap-4 rounded-4xl border border-slate-100 bg-white/90 p-4 shadow-sm">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900">{record.session_title}</p>
        <p className="mt-0.5 text-xs text-slate-400">{fmt(record.date, { day: "numeric", month: "short", year: "numeric" })}</p>
        {record.check_in_time && <p className="mt-0.5 text-xs text-slate-400">เช็กอิน: {fmt(record.check_in_time)}</p>}
        {record.note && <p className="mt-1 text-xs text-slate-500">{record.note}</p>}
      </div>
      <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${colorClass}`}>{labelTh}</span>
    </div>
  );
}

function AssignmentCard({ a }: { a: AssignmentScore }) {
  const [expanded, setExpanded] = useState(false);
  const hasSubItems = a.sub_items && a.sub_items.length > 0;
  const pct = a.score != null && a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : null;
  const scoreColor = pct == null ? "text-slate-400" : pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-rose-600";
  const barColor  = pct == null ? "bg-slate-200"   : pct >= 80 ? "bg-emerald-500"   : pct >= 60 ? "bg-amber-400"   : "bg-rose-400";

  return (
    <div className="rounded-4xl border border-slate-100 bg-white/90 shadow-sm overflow-hidden">
      <button className="w-full text-left p-4" onClick={() => hasSubItems && setExpanded((v) => !v)}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border text-sm ${assignTypeColor(a.type)}`}>
            <Icon icon={assignTypeIcon(a.type)} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-900 leading-snug">{a.title}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${assignTypeColor(a.type)}`}>
                {assignTypeTH(a.type)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: pct != null ? `${pct}%` : "0%" }} />
              </div>
              <span className={`text-sm font-bold tabular-nums ${scoreColor}`}>
                {displayScore(a.score)} / {displayScore(a.max_score)}
              </span>
            </div>
          </div>
          {a.status === "graded" ? (
            <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold text-emerald-700">ตรวจแล้ว</span>
          ) : (
            <span className="shrink-0 rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-500">รอตรวจ</span>
          )}
        </div>
        {a.status === "graded" && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {a.grader && (
              <span className="flex items-center gap-1">
                <Icon icon="solar:user-bold" className="text-slate-400" />{a.grader}
              </span>
            )}
            {a.graded_at && (
              <span className="flex items-center gap-1">
                <Icon icon="solar:clock-circle-bold" className="text-slate-400" />{fmt(a.graded_at)}
              </span>
            )}
            {a.graded_via && (
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.graded_via === "queue" ? "bg-violet-50 text-violet-700" : "bg-slate-50 text-slate-600"}`}>
                <Icon icon={a.graded_via === "queue" ? "solar:sort-by-time-bold" : "solar:pen-new-square-bold"} />
                {a.graded_via === "queue" ? "จองคิว" : "กรอกตรง"}
              </span>
            )}
            {a.is_group_assignment && a.group_info && (
              <span className="flex items-center gap-1">
                <Icon icon="solar:users-group-rounded-bold" className="text-slate-400" />{a.group_info.name}
              </span>
            )}
          </div>
        )}
        {a.comment && (
          <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600 border border-slate-100">{a.comment}</p>
        )}
        {hasSubItems && (
          <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
            <Icon icon="solar:alt-arrow-down-bold" className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "ซ่อนรายละเอียดย่อย" : `ดูรายละเอียดย่อย ${a.sub_items.length} หัวข้อ`}
          </div>
        )}
      </button>
      {hasSubItems && expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 space-y-2">
          {a.sub_items.map((si) => (
            <div key={si.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700">{si.name}</p>
                {si.grader && <p className="text-[10px] text-slate-400">{si.grader}{si.graded_at ? ` · ${fmt(si.graded_at)}` : ""}</p>}
              </div>
              <span className="text-xs font-bold tabular-nums text-slate-700">
                {displayScore(si.score)} / {displayScore(si.max_score)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function shouldHideGroupAssignment(a: AssignmentScore) {
  const isGroupAssignment = a.type === "permanent_group" || a.type === "weekly_group";
  return isGroupAssignment && !a.group_info;
}

function ExamCard({ e }: { e: ExamScoreData }) {
  const pct = e.score != null && e.max_score > 0 ? Math.round((e.score / e.max_score) * 100) : null;
  const scoreColor = pct == null ? "text-slate-400" : pct >= 60 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-rose-600";
  const barColor  = pct == null ? "bg-slate-200"   : pct >= 60 ? "bg-emerald-500"   : pct >= 40 ? "bg-amber-400"   : "bg-rose-400";
  return (
    <div className="rounded-4xl border border-slate-100 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm">
          <Icon icon="solar:diploma-bold-duotone" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">{examTypeTH(e.exam_type, e.component)}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: pct != null ? `${pct}%` : "0%" }} />
            </div>
            <span className={`text-sm font-bold tabular-nums ${scoreColor}`}>
              {displayScore(e.score)} / {displayScore(e.max_score)}
            </span>
          </div>
        </div>
      </div>
      {e.grader && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1"><Icon icon="solar:user-bold" className="text-slate-400" />{e.grader}</span>
          {e.graded_at && <span className="flex items-center gap-1"><Icon icon="solar:clock-circle-bold" className="text-slate-400" />{fmt(e.graded_at)}</span>}
        </div>
      )}
      {e.comment && <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600 border border-slate-100">{e.comment}</p>}
    </div>
  );
}

function NotifCard({ n }: { n: UserNotificationItem }) {
  return (
    <div className={`flex items-start gap-3 rounded-3xl border bg-white/90 p-3.5 shadow-sm ${!n.is_read ? "border-slate-300" : "border-slate-200/80"}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-sm ${notifTypeColor(n.type)}`}>
        <Icon icon={notifTypeIcon(n.type)} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-bold text-slate-800 leading-snug">{n.title}</p>
          {!n.is_read && <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-slate-700" />}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed line-clamp-2">{n.message}</p>
        <p className="mt-1 text-[10px] text-slate-400">{fmt(n.created_at)}</p>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function StudentCourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const t = useI18n();
  const requestedTab = searchParams.get("tab");
  const initialTabKey: TabKey = (requestedTab && TAB_MAP[requestedTab]) ? TAB_MAP[requestedTab] : "Overview";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTabKey);
  const [selectedScoreCategory, setSelectedScoreCategory] = useState<ScoreCategoryKey>("all");
  const [data, setData] = useState<MyStudentCourseResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<UserNotificationItem[]>([]);
  const [examSeats, setExamSeats] = useState<MyExamSeat[]>([]);
  const [isExamSeatsLoading, setIsExamSeatsLoading] = useState(false);
  const [expandedBonusDays, setExpandedBonusDays] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!params.courseId) return;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [courseRes, notifRes] = await Promise.all([
          studentService.getMyCourse(params.courseId),
          userNotificationService.getNotifications(20, 0, params.courseId),
        ]);
        if (!active) return;
        if (!courseRes.success || !courseRes.data) {
          setErrorMessage(courseRes.message || "ไม่พบข้อมูลรายวิชา");
          setData(null);
          return;
        }
        setData(courseRes.data);
        setNotifs(notifRes.items);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "โหลดข้อมูลรายวิชาไม่สำเร็จ");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [params.courseId]);

  useEffect(() => {
    const key = requestedTab && TAB_MAP[requestedTab] ? TAB_MAP[requestedTab] : "Overview";
    setActiveTab(key);
  }, [requestedTab]);

  useEffect(() => {
    if (activeTab !== "ExamSeats" || !params.courseId) return;
    let active = true;
    const loadSeats = async () => {
      setIsExamSeatsLoading(true);
      try {
        const seats = await getMyExamSeats(params.courseId);
        if (active) setExamSeats(seats);
      } catch {
        // silently ignore — seats may not be configured yet
      } finally {
        if (active) setIsExamSeatsLoading(false);
      }
    };
    void loadSeats();
    return () => { active = false; };
  }, [activeTab, params.courseId]);

  useEffect(() => {
    setExpandedBonusDays({});
  }, [params.courseId]);

  useEffect(() => {
    setSelectedScoreCategory("all");
  }, [params.courseId]);

  const bonusRecords = data?.course.bonusScore?.records ?? [];
  const bonusGroups = useMemo(() => {
    const grouped = new Map<string, { label: string; total: number; records: typeof bonusRecords }>();

    bonusRecords.forEach((record) => {
      const key = bonusDateKey(record.given_at);
      const existing = grouped.get(key);
      if (existing) {
        existing.total += record.score;
        existing.records.push(record);
        return;
      }

      grouped.set(key, {
        label: fmt(record.given_at, { day: "numeric", month: "long", year: "numeric" }),
        total: record.score,
        records: [record],
      });
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({
        key,
        label: value.label,
        total: value.total,
        records: value.records.sort((a, b) => new Date(b.given_at).getTime() - new Date(a.given_at).getTime()),
      }));
  }, [bonusRecords]);

  // ── loading ──
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3 rounded-4xl border border-slate-100 bg-white/90 p-6">
          <div className="h-5 w-20 rounded-full bg-slate-200" />
          <div className="h-7 w-2/3 rounded-full bg-slate-200" />
          <div className="h-4 w-full rounded-full bg-slate-100" />
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[1,2,3,4].map((i) => <div key={i} className="h-20 rounded-3xl bg-slate-100" />)}
          </div>
        </div>
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-20 animate-pulse rounded-4xl bg-white/80" />)}</div>
      </div>
    );
  }

  // ── error ──
  if (errorMessage || !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-4 rounded-4xl border border-rose-200 bg-rose-50/80 p-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100">
            <Icon icon="solar:danger-triangle-bold-duotone" className="text-2xl text-rose-600" />
          </span>
          <div>
            <p className="font-bold text-rose-900">ไม่สามารถเปิดรายวิชาได้</p>
            <p className="mt-1 text-sm text-rose-700/80">{errorMessage ?? "ไม่พบข้อมูลรายวิชา"}</p>
            <Link href="/student" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-95">
              <Icon icon="solar:arrow-left-bold" />กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const course = data.course;
  const totalAttend = course.attendance.summary.present + course.attendance.summary.late + course.attendance.summary.leave + course.attendance.summary.absent;
  const attendPct = totalAttend > 0 ? Math.round((course.attendance.summary.present / totalAttend) * 100) : 0;
  const initials = course.course.code.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || course.course.code.slice(0, 2).toUpperCase();
  const tabLabels: Record<TabKey, string> = {
    Overview: tabs[0],
    Scores: tabs[1],
    Attendance: tabs[2],
    ExamSeats: t("examSeats"),
    Updates: "อัปเดต",
  };
  const formatExamSeatType = (seat: MyExamSeat) => {
    const examTypeLabel = seat.exam_type === "midterm" ? t("midtermExam") : t("finalExam");
    const componentLabel = seat.component === "lab" ? t("practicalComponent") : t("lectureComponent");
    return `${examTypeLabel} (${componentLabel})`;
  };

  // group assignments by type
  const visibleAssignments = course.assignments.filter((a) => !shouldHideGroupAssignment(a));
  const visibleTotalScore = visibleAssignments.reduce((sum, a) => sum + (a.score ?? 0), 0);
  const visibleTotalMaxScore = visibleAssignments.reduce((sum, a) => sum + a.max_score, 0);

  const assignByType: Record<string, AssignmentScore[]> = {};
  for (const a of visibleAssignments) {
    const g = a.type === "assignment" ? "assignment" : (a.type === "permanent_group" || a.type === "weekly_group") ? "group" : "individual";
    if (!assignByType[g]) assignByType[g] = [];
    assignByType[g].push(a);
  }
  const assignGroups = [
    { key: "individual", label: "งานในคาบ",  icon: "solar:laptop-bold-duotone",                  cls: "text-sky-600 bg-sky-50 border-sky-100" },
    { key: "assignment", label: "งานบ้าน",   icon: "solar:notebook-bold-duotone",                cls: "text-violet-600 bg-violet-50 border-violet-100" },
    { key: "group",      label: "งานกลุ่ม",  icon: "solar:users-group-rounded-bold-duotone",     cls: "text-amber-600 bg-amber-50 border-amber-100" },
  ].filter((g) => (assignByType[g.key]?.length ?? 0) > 0);

  function groupSummary(key: string) {
    const arr = assignByType[key] ?? [];
    return {
      total:    arr.reduce((s, a) => s + (a.score ?? 0), 0),
      maxTotal: arr.reduce((s, a) => s + a.max_score, 0),
      graded:   arr.filter((a) => a.status === "graded").length,
      count:    arr.length,
    };
  }

  const scoreAssignmentGroups = {
    lab: visibleAssignments.filter((a) => a.type !== "assignment" && a.type !== "permanent_group" && a.type !== "weekly_group"),
    homework: visibleAssignments.filter((a) => a.type === "assignment"),
    group: visibleAssignments.filter((a) => a.type === "permanent_group"),
    weekly: visibleAssignments.filter((a) => a.type === "weekly_group"),
  };
  const scoreCategoryOptions = [
    { key: "all",      label: "ทั้งหมด",      count: visibleAssignments.length + course.examScores.length + bonusGroups.length },
    { key: "lab",      label: "คะแนนแลป",     count: scoreAssignmentGroups.lab.length },
    { key: "homework", label: "การบ้าน",      count: scoreAssignmentGroups.homework.length },
    { key: "group",    label: "งานกลุ่ม",     count: scoreAssignmentGroups.group.length },
    { key: "weekly",   label: "งานสัปดาห์",   count: scoreAssignmentGroups.weekly.length },
    { key: "exams",    label: "คะแนนสอบ",     count: course.examScores.length },
    { key: "bonus",    label: "คะแนนพิเศษ",   count: bonusGroups.length },
  ].filter((option) => option.key === "all" || option.count > 0) as Array<{ key: ScoreCategoryKey; label: string; count: number }>;
  const scoreCategorySections = [
    { key: "lab" as const,      label: "คะแนนแลป",   icon: "solar:laptop-bold-duotone",              cls: "text-sky-600 bg-sky-50 border-sky-100", items: scoreAssignmentGroups.lab },
    { key: "homework" as const, label: "การบ้าน",    icon: "solar:notebook-bold-duotone",            cls: "text-violet-600 bg-violet-50 border-violet-100", items: scoreAssignmentGroups.homework },
    { key: "group" as const,    label: "งานกลุ่ม",   icon: "solar:users-group-rounded-bold-duotone", cls: "text-amber-600 bg-amber-50 border-amber-100", items: scoreAssignmentGroups.group },
    { key: "weekly" as const,   label: "งานสัปดาห์", icon: "solar:calendar-bold-duotone",            cls: "text-orange-600 bg-orange-50 border-orange-100", items: scoreAssignmentGroups.weekly },
  ].filter((section) => section.items.length > 0);
  const filteredScoreSections = selectedScoreCategory === "all"
    ? scoreCategorySections
    : scoreCategorySections.filter((section) => section.key === selectedScoreCategory);
  assignByType.lab = scoreAssignmentGroups.lab;
  assignByType.homework = scoreAssignmentGroups.homework;
  assignByType.weekly = scoreAssignmentGroups.weekly;

  const summaryItems = [
    { label: "มาเรียน", val: course.attendance.summary.present, icon: "solar:check-circle-bold-duotone", cls: "text-emerald-600 bg-emerald-50" },
    { label: "สาย",     val: course.attendance.summary.late,    icon: "solar:clock-circle-bold-duotone",  cls: "text-amber-600 bg-amber-50" },
    { label: "ลา",      val: course.attendance.summary.leave,   icon: "solar:letter-bold-duotone",        cls: "text-sky-600 bg-sky-50" },
    { label: "ขาด",     val: course.attendance.summary.absent,  icon: "solar:close-circle-bold-duotone",  cls: "text-rose-600 bg-rose-50" },
  ];

  return (
    <div className="space-y-4 pb-2">
      {/* ── course header ──────────────────────────────── */}
      <div className="relative overflow-hidden rounded-4xl border border-slate-200/70 bg-slate-900 shadow-lg shadow-slate-300/40">
        {course.course.image ? (
          <CourseCoverImage
            src={course.course.image}
            alt={course.course.name}
            positionX={course.course.cover_position_x}
            positionY={course.course.cover_position_y}
            zoom={course.course.cover_zoom}
            className="h-44 w-full sm:h-48"
            overlay={<div className="absolute inset-0 bg-linear-to-r from-slate-950/75 via-slate-900/45 to-slate-950/20" />}
          />
        ) : null}
        <span className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-start gap-4 p-5 sm:p-6">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white ring-2 ring-white/25 backdrop-blur-sm ${course.course.image ? "bg-white/15 -mt-8" : "bg-white/20"}`}>
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-300">{course.course.code}</p>
            <h2 className="mt-0.5 text-lg font-bold leading-snug text-white sm:text-xl">{course.course.name}</h2>
            <p className="mt-1 text-xs text-slate-400">
              {data.student.full_name} · ปีการศึกษา {course.course.year} เทอม {course.course.semester}
              {course.course.sections.length > 0 && (
                <> · Sec {course.course.sections.map((s) => s.section_no).filter(Boolean).join(", ") || course.course.sections.map((s) => s.id).join(", ")}</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── tab bar ────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto rounded-4xl border border-slate-100 bg-white/80 p-1.5 shadow-sm scrollbar-hide">
        {tabKeys.filter((key) => key !== "ExamSeats").map((key, i) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-3xl px-3 py-2 text-xs font-semibold transition ${
              activeTab === key ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            <Icon icon={TAB_ICONS[key]} className="text-sm" />
            {tabLabels[key] ?? tabs[i]}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW tab ───────────────────────────────── */}
      {activeTab === "Overview" && (
        <div className="space-y-4">
          {/* My groups */}
          <div className="rounded-4xl border border-slate-100 bg-white/90 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Icon icon="solar:users-group-rounded-bold-duotone" className="text-base text-slate-700" />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">กลุ่มของฉัน</p>
            </div>
            {course.course.my_groups && course.course.my_groups.length > 0 ? (
              <div className="space-y-2.5">
                {course.course.my_groups.map((group) => (
                  <div key={group.id} className="rounded-3xl border border-slate-200/80 bg-slate-50/90 p-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        <Icon icon="solar:users-group-rounded-bold" className="text-[11px]" />
                        {group.name}
                      </span>
                      <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        {studentGroupTypeLabel(group)}
                      </span>
                    </div>
                    {group.members.length > 0 ? (
                      <div className="mt-2 rounded-2xl border border-slate-200/80 bg-white/90 p-2">
                        <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">สมาชิก</p>
                        <ul className="mt-1 space-y-1">
                          {group.members.map((member) => (
                            <li key={member.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                              <span className="truncate font-medium text-slate-700">{member.full_name}</span>
                              <span className="shrink-0 rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                                {member.student_id}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-slate-500">ยังไม่มีสมาชิกในกลุ่ม</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white/60 p-4">
                <Icon icon="solar:users-group-rounded-bold-duotone" className="text-xl text-slate-300 shrink-0" />
                <p className="text-xs text-slate-400">ยังไม่ถูกจัดกลุ่มในรายวิชานี้</p>
              </div>
            )}
          </div>

          {/* Course notifications */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Icon icon="solar:bell-bing-bold-duotone" className="text-base text-slate-700" />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">ประกาศจากรายวิชา</p>
            </div>
            {notifs.length > 0 ? (
              <div className="space-y-2">{notifs.map((n) => <NotifCard key={n.id} n={n} />)}</div>
            ) : (
              <div className="flex items-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white/60 p-4">
                <Icon icon="solar:bell-off-bold-duotone" className="text-xl text-slate-300 shrink-0" />
                <p className="text-xs text-slate-400">ยังไม่มีประกาศจากรายวิชานี้</p>
              </div>
            )}
          </div>

          {/* Attendance summary */}
          <div className="rounded-4xl border border-emerald-100 bg-white/90 p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">สรุปการเข้าเรียน</p>
            <div className="grid grid-cols-4 gap-2">
              {summaryItems.map((s) => (
                <div key={s.label} className={`flex flex-col items-center gap-1 rounded-3xl ${s.cls} py-3`}>
                  <Icon icon={s.icon} className="text-xl" />
                  <p className="text-lg font-bold text-slate-900">{s.val}</p>
                  <p className="text-[10px] font-semibold text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400 transition-all" style={{ width: `${attendPct}%` }} />
            </div>
            <p className="mt-1.5 text-right text-xs text-slate-400">{attendPct}% เข้าเรียน</p>
          </div>

          {/* Score summary by type */}
          {assignGroups.length > 0 && (
            <div className="rounded-4xl border border-slate-100 bg-white/90 p-5 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">สรุปคะแนนงาน</p>
              <div className="space-y-3">
                {assignGroups.map((g) => {
                  const { total, maxTotal, graded, count } = groupSummary(g.key);
                  const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
                  const barCls = pct >= 80 ? "from-emerald-500 to-teal-400" : pct >= 60 ? "from-amber-400 to-orange-400" : "from-rose-400 to-pink-400";
                  return (
                    <div key={g.key}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-xl border text-xs ${g.cls}`}><Icon icon={g.icon} /></span>
                        <p className="text-xs font-semibold text-slate-700">{g.label}</p>
                        <span className="ml-auto text-xs text-slate-400">ตรวจแล้ว {graded}/{count}</span>
                        <span className="text-xs font-bold text-slate-800 tabular-nums">{displayScore(total)} / {displayScore(maxTotal)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full bg-linear-to-r ${barCls} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {course.bonusScore && course.bonusScore.total > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-3xl bg-amber-50 border border-amber-100 px-3 py-2">
                  <Icon icon="solar:gift-bold-duotone" className="text-amber-500" />
                  <p className="text-xs font-semibold text-amber-800">โบนัสพิเศษ <span className="font-bold">+{course.bonusScore.total}</span> คะแนน</p>
                </div>
              )}
            </div>
          )}

          {/* Exam scores summary */}
          {course.examScores && course.examScores.length > 0 && (
            <div className="rounded-4xl border border-indigo-100 bg-white/90 p-5 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">สรุปคะแนนสอบ</p>
              <div className="space-y-3">
                {course.examScores.map((e) => {
                  const pct = e.score != null && e.max_score > 0 ? Math.round((e.score / e.max_score) * 100) : null;
                  const barCls = pct == null ? "bg-slate-200" : pct >= 60 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-rose-400";
                  return (
                    <div key={e.id}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon icon="solar:diploma-bold-duotone" className="text-indigo-500 text-sm shrink-0" />
                        <p className="text-xs font-semibold text-slate-700">{examTypeTH(e.exam_type, e.component)}</p>
                        <span className="ml-auto text-xs font-bold text-slate-800 tabular-nums">{displayScore(e.score)} / {displayScore(e.max_score)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: pct != null ? `${pct}%` : "0%" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sections */}
          {course.course.sections.length > 0 && (
            <div className="rounded-4xl border border-slate-100 bg-white/90 p-5 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">กลุ่มเรียน</p>
              <div className="flex flex-wrap gap-2">
                {course.course.sections.map((s) => (
                  <span key={s.id} className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    Section {s.section_no || s.name || s.id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SCORES tab ─────────────────────────────────── */}
      {activeTab === "Scores" && (
        <div className="space-y-4">
          {/* Score total banner */}
          <div className="rounded-4xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">คะแนนรวม (งาน)</p>
              <span className="text-xl font-bold text-slate-900 tabular-nums">
                {displayScore(visibleTotalScore)} <span className="text-sm font-medium text-slate-400">/ {displayScore(visibleTotalMaxScore)}</span>
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900 transition-all"
                style={{ width: `${visibleTotalMaxScore > 0 ? Math.round((visibleTotalScore / visibleTotalMaxScore) * 100) : 0}%` }}
              />
            </div>
          </div>

          <div className="rounded-4xl border border-slate-100 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Icon icon="solar:filter-bold-duotone" className="text-base text-slate-500" />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">เลือกหมวดคะแนน</p>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {scoreCategoryOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSelectedScoreCategory(option.key)}
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    selectedScoreCategory === option.key
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  {option.label} ({option.count})
                </button>
              ))}
            </div>
          </div>

          {filteredScoreSections.length === 0 && course.examScores.length === 0 && bonusGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-4xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
              <Icon icon="solar:medal-star-bold-duotone" className="text-3xl text-slate-300" />
              <p className="text-sm text-slate-400">ยังไม่มีงานที่แสดงได้</p>
            </div>
          ) : (
            filteredScoreSections.map((g) => (
              <div key={g.key}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-xl border text-xs ${g.cls}`}><Icon icon={g.icon} /></span>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{g.label}</p>
                  <span className="text-xs text-slate-400">({(assignByType[g.key] ?? []).length} งาน)</span>
                </div>
                <div className="space-y-2">
                  {g.items.map((a) => <AssignmentCard key={a.id} a={a} />)}
                </div>
              </div>
            ))
          )}

          {/* Bonus scores */}
          {course.bonusScore && course.bonusScore.total > 0 && (selectedScoreCategory === "all" || selectedScoreCategory === "bonus") && (
            <div className="rounded-4xl border border-amber-100 bg-white/90 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Icon icon="solar:gift-bold-duotone" className="text-amber-500 text-base" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">โบนัสพิเศษ</p>
                <span className="ml-auto text-sm font-bold text-amber-700">+{course.bonusScore.total}</span>
              </div>
              <div className="space-y-2">
                {bonusGroups.map((group) => {
                  const isExpanded = expandedBonusDays[group.key] ?? false;
                  const previewRecords = isExpanded ? group.records : group.records.slice(0, 1);

                  return (
                    <div key={group.key} className="rounded-3xl border border-amber-100 bg-amber-50/70 p-3">
                      <button
                        type="button"
                        onClick={() => setExpandedBonusDays((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-amber-500">
                          <Icon icon="solar:star-bold" className="text-sm" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-amber-800">{group.label}</p>
                          <p className="text-[10px] text-amber-600">{group.records.length} รายการในวัน +{group.total}</p>
                        </div>
                        <Icon
                          icon={isExpanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
                          className="shrink-0 text-base text-amber-500"
                        />
                      </button>

                      <div className="mt-3 space-y-2">
                        {previewRecords.map((b, i) => (
                          <div key={`${group.key}-${i}`} className="flex items-start gap-3 rounded-2xl bg-white/80 p-3">
                            <Icon icon="solar:star-bold" className="mt-0.5 shrink-0 text-sm text-amber-400" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-amber-800">{b.reason}</p>
                              {b.given_by && <p className="mt-0.5 text-[10px] text-amber-600">โดย {b.given_by} · {fmt(b.given_at)}</p>}
                            </div>
                            <span className="shrink-0 text-xs font-bold text-amber-700 tabular-nums">+{b.score}</span>
                          </div>
                        ))}
                        {!isExpanded && group.records.length > 1 && (
                          <p className="px-1 text-[10px] font-medium text-amber-600">และอีก {group.records.length - 1} รายการ</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Exam scores */}
          {course.examScores && course.examScores.length > 0 && (selectedScoreCategory === "all" || selectedScoreCategory === "exams") && (
            <div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <Icon icon="solar:diploma-bold-duotone" className="text-blue-700 text-base" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">คะแนนสอบ</p>
              </div>
              <div className="space-y-2">
                {course.examScores.map((e) => <ExamCard key={e.id} e={e} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ATTENDANCE tab ─────────────────────────────── */}
      {activeTab === "Attendance" && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {summaryItems.map((s) => (
              <div key={s.label} className={`flex flex-col items-center gap-1 rounded-3xl ${s.cls} py-3`}>
                <Icon icon={s.icon} className="text-xl" />
                <p className="text-lg font-bold text-slate-900">{s.val}</p>
                <p className="text-[10px] font-semibold text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
          {course.attendance.records.length > 0 ? (
            course.attendance.records.map((r) => <AttendanceRow key={r.id} record={r} />)
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-4xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
              <Icon icon="solar:calendar-bold-duotone" className="text-3xl text-slate-300" />
              <p className="text-sm text-slate-400">ยังไม่มีบันทึกการเช็กชื่อ</p>
            </div>
          )}
        </div>
      )}

      {/* ── EXAM SEATS tab ─────────────────────────────── */}
      {activeTab === "ExamSeats" && (
        <div className="space-y-3">
          {isExamSeatsLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-slate-700" />
            </div>
          ) : examSeats.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-4xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
              <Icon icon="solar:armchair-bold-duotone" className="text-3xl text-slate-300" />
              <p className="text-sm text-slate-400">{t("studentExamSeatEmpty")}</p>
            </div>
          ) : (
            examSeats.map((seat) => (
              <div key={`${seat.session_id}-${seat.exam_type}-${seat.component}`} className="rounded-4xl border border-blue-100 bg-white/90 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700">
                    <Icon icon="solar:armchair-bold-duotone" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900">{formatExamSeatType(seat)}</p>
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {seat.exam_date}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{seat.start_time}–{seat.end_time}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        <Icon icon="solar:buildings-bold" className="text-slate-500" />
                        {seat.classroom_name}
                      </span>
                      <span className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <Icon icon="solar:chair-bold" className="text-emerald-500" />
                        {t("studentExamSeatChip", { seat: seat.seat_label || `${seat.classroom_name}-${seat.desk_number}` })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── UPDATES tab ────────────────────────────────── */}
      {activeTab === "Updates" && (
        <div className="space-y-2">
          {notifs.length > 0 ? (
            notifs.map((n) => <NotifCard key={n.id} n={n} />)
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-4xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
              <Icon icon="solar:bell-bing-bold-duotone" className="text-3xl text-slate-300" />
              <p className="text-sm text-slate-400">ยังไม่มีการแจ้งเตือนจากรายวิชานี้</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
