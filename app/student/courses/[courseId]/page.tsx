"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { formatScoreValue } from "@/lib/score-input";
import { notifStyleFor } from "@/lib/student-notification-style";
import { getNotificationHeadline, getNotificationMessage } from "@/lib/notification-display";
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
import { CourseCoverImage, courseCoverFallback } from "@/components/course";

// ─── tabs ─────────────────────────────────────────────────────────────────────

const tabKeys = ["Overview", "Scores", "Attendance", "ExamSeats", "Updates"] as const;
type TabKey = (typeof tabKeys)[number];
type ScoreCategoryKey = "all" | "lab" | "homework" | "group" | "weekly" | "exams" | "bonus";

const TAB_MAP: Record<string, TabKey> = {
  Overview: "Overview", Scores: "Scores", Attendance: "Attendance", ExamSeats: "ExamSeats", Updates: "Updates",
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

const ATTEND_BADGE: Record<string, string> = {
  present: "cg-badge-success",
  late: "cg-badge-warning",
  leave: "cg-badge-info",
  absent: "cg-badge-danger",
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
  if (type === "assignment") return "solar:notebook-linear";
  if (type === "permanent_group" || type === "weekly_group") return "solar:users-group-rounded-linear";
  return "solar:laptop-linear";
}

function assignTypeTone(type: string): { bg: string; fg: string } {
  if (type === "assignment") return { bg: "var(--cg-violet-soft)", fg: "var(--cg-violet)" };
  if (type === "permanent_group" || type === "weekly_group") return { bg: "var(--cg-warning-soft)", fg: "var(--cg-warning)" };
  return { bg: "var(--cg-info-soft)", fg: "var(--cg-info)" };
}

function examTypeTH(type: string, component: string) {
  const t = type === "midterm" ? "กลางภาค" : "ปลายภาค";
  const c = component === "lab" ? "(ปฏิบัติ)" : "(บรรยาย)";
  return `${t} ${c}`;
}

function displayScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? formatScoreValue(value) : "-";
}

function scoreTone(pct: number | null): string {
  if (pct == null) return "var(--cg-text-3)";
  if (pct >= 80) return "var(--cg-success)";
  if (pct >= 60) return "var(--cg-warning)";
  return "var(--cg-danger)";
}

function studentGroupTypeLabel(group: StudentCourseGroup) {
  if (group.group_type === "permanent") return "กลุ่มโปรเจกต์";
  if (group.week_number != null) return `กลุ่มสัปดาห์ที่ ${group.week_number}`;
  return "กลุ่มสัปดาห์";
}

function shouldHideGroupAssignment(a: AssignmentScore) {
  const isGroupAssignment = a.type === "permanent_group" || a.type === "weekly_group";
  return isGroupAssignment && !a.group_info;
}

// ─── rows ─────────────────────────────────────────────────────────────────────

function ScoreBar({ score, max }: { score: number | null | undefined; max: number }) {
  const pct = score != null && max > 0 ? Math.round((score / max) * 100) : null;
  const tone = scoreTone(pct);
  return (
    <span className="mt-1.5 flex items-center gap-2.5">
      <span className="cg-progress flex-1">
        <i style={{ width: pct != null ? `${Math.min(pct, 100)}%` : "0%", background: tone }} />
      </span>
      <span className="cg-mono shrink-0 text-xs font-medium" style={{ color: tone }}>
        {displayScore(score)}/{displayScore(max)}
      </span>
    </span>
  );
}

function AssignmentRow({ a }: { a: AssignmentScore }) {
  const [expanded, setExpanded] = useState(false);
  const hasSubItems = Boolean(a.sub_items && a.sub_items.length > 0);
  const tone = assignTypeTone(a.type);
  const isGraded = a.status === "graded";

  return (
    <>
      <button
        type="button"
        className="cg-row items-start"
        onClick={() => hasSubItems && setExpanded((v) => !v)}
        style={hasSubItems ? undefined : { cursor: "default" }}
      >
        <span className="cg-row-ico mt-0.5" style={{ background: tone.bg, color: tone.fg }}>
          <Icon icon={assignTypeIcon(a.type)} width={17} height={17} />
        </span>
        <span className="cg-row-body">
          <span className="cg-row-title">{a.title}</span>
          {isGraded ? <ScoreBar score={a.score} max={a.max_score} /> : null}
          <span className="cg-row-sub">
            {isGraded
              ? [
                  a.grader ? `ตรวจโดย ${a.grader}` : "ตรวจแล้ว",
                  a.graded_via === "queue" ? "ผ่านการจองคิว" : "",
                  a.is_group_assignment && a.group_info ? a.group_info.name : "",
                ].filter(Boolean).join(" ")
              : `${assignTypeTH(a.type)} รอผู้ตรวจ`}
          </span>
          {a.comment && (
            <span className="cg-row-sub mt-1.5 block rounded-xl px-2.5 py-2" style={{ background: "var(--cg-fill)" }}>
              {a.comment}
            </span>
          )}
          {hasSubItems && (
            <span className="cg-row-sub mt-1 flex items-center gap-1" style={{ color: "var(--cg-accent)" }}>
              <Icon icon={expanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width={12} height={12} />
              {expanded ? "ซ่อนรายละเอียดย่อย" : `ดูรายละเอียดย่อย ${a.sub_items.length} หัวข้อ`}
            </span>
          )}
        </span>
        {!isGraded && <span className="cg-badge cg-badge-neutral mt-0.5">รอตรวจ</span>}
      </button>

      {hasSubItems && expanded && (
        <div className="flex flex-col gap-1.5 px-3.5 pb-3.5" style={{ background: "var(--cg-fill)" }}>
          {a.sub_items.map((si) => (
            <div key={si.id} className="flex items-center justify-between gap-3 rounded-[10px] px-2.5 py-2" style={{ background: "var(--cg-surface)" }}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-medium">{si.name}</span>
                {si.grader && (
                  <span className="block text-[10.5px] font-light" style={{ color: "var(--cg-text-3)" }}>
                    {si.grader}{si.graded_at ? ` ${fmt(si.graded_at)}` : ""}
                  </span>
                )}
              </span>
              <span className="cg-mono shrink-0 text-[11.5px] font-medium">
                {displayScore(si.score)}/{displayScore(si.max_score)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ExamRow({ e }: { e: ExamScoreData }) {
  const graded = e.score != null;
  return (
    <div className="cg-row items-start">
      <span className="cg-row-ico mt-0.5" style={graded ? { background: "var(--cg-info-soft)", color: "var(--cg-info)" } : undefined}>
        <Icon icon="solar:diploma-linear" width={17} height={17} />
      </span>
      <span className="cg-row-body">
        <span className="cg-row-title">{examTypeTH(e.exam_type, e.component)}</span>
        {graded ? <ScoreBar score={e.score} max={e.max_score} /> : <span className="cg-row-sub">ยังไม่มีคะแนน</span>}
        {e.grader && <span className="cg-row-sub">ตรวจโดย {e.grader}{e.graded_at ? ` เมื่อ ${fmt(e.graded_at)}` : ""}</span>}
        {e.comment && (
          <span className="cg-row-sub mt-1.5 block rounded-xl px-2.5 py-2" style={{ background: "var(--cg-fill)" }}>
            {e.comment}
          </span>
        )}
      </span>
    </div>
  );
}

function AttendanceRow({ record }: { record: AttendanceRecordData }) {
  const badge = ATTEND_BADGE[record.status] ?? "cg-badge-neutral";
  const label = ATTEND_STATUS_TH[record.status] ?? record.status;
  return (
    <div className="cg-row">
      <span className="cg-row-body">
        <span className="cg-row-title">{record.session_title}</span>
        <span className="cg-row-sub">
          {fmt(record.date, { day: "numeric", month: "short", year: "numeric" })}
          {record.check_in_time ? ` เวลา ${fmt(record.check_in_time, { hour: "2-digit", minute: "2-digit", day: undefined, month: undefined, year: undefined })} น.` : ""}
        </span>
        {record.note && <span className="cg-row-sub">{record.note}</span>}
      </span>
      <span className={`cg-badge ${badge}`}>{label}</span>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function StudentCourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useI18n();
  const { language } = useGlobalSettings();

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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
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
    setSelectedScoreCategory("all");
  }, [params.courseId]);

  const bonusRecords = useMemo(() => data?.course.bonusScore?.records ?? [], [data]);
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
      <div className="flex flex-col gap-4">
        <div className="cg-cover animate-pulse" style={{ background: "var(--cg-fill-strong)" }} />
        <div className="cg-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="cg-row animate-pulse">
              <div className="h-9 w-9 shrink-0 rounded-xl" style={{ background: "var(--cg-fill-strong)" }} />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 rounded-full" style={{ background: "var(--cg-fill-strong)" }} />
                <div className="h-2.5 w-1/2 rounded-full" style={{ background: "var(--cg-fill)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── error ──
  if (errorMessage || !data) {
    return (
      <div className="flex flex-col gap-4" style={{ paddingTop: "calc(var(--app-safe-top) + 24px)" }}>
        <div className="cg-list">
          <div className="cg-row items-start">
            <span className="cg-row-ico mt-0.5" style={{ background: "var(--cg-danger-soft)", color: "var(--cg-danger)" }}>
              <Icon icon="solar:danger-triangle-linear" width={17} height={17} />
            </span>
            <span className="cg-row-body">
              <span className="cg-row-title">ไม่สามารถเปิดรายวิชาได้</span>
              <span className="cg-row-sub">{errorMessage ?? "ไม่พบข้อมูลรายวิชา"}</span>
            </span>
          </div>
        </div>
        <Link href="/student/courses" className="cg-btn text-center">กลับไปหน้ารายวิชา</Link>
      </div>
    );
  }

  const course = data.course;
  const summary = course.attendance.summary;
  const totalAttend = summary.present + summary.late + summary.leave + summary.absent;
  const attendPct = totalAttend > 0 ? Math.round((summary.present / totalAttend) * 100) : 0;

  const visibleAssignments = course.assignments.filter((a) => !shouldHideGroupAssignment(a));
  const visibleTotalScore = visibleAssignments.reduce((sum, a) => sum + (a.score ?? 0), 0);
  const visibleTotalMaxScore = visibleAssignments.reduce((sum, a) => sum + a.max_score, 0);

  const scoreGroups = {
    lab: visibleAssignments.filter((a) => a.type !== "assignment" && a.type !== "permanent_group" && a.type !== "weekly_group"),
    homework: visibleAssignments.filter((a) => a.type === "assignment"),
    group: visibleAssignments.filter((a) => a.type === "permanent_group"),
    weekly: visibleAssignments.filter((a) => a.type === "weekly_group"),
  };

  const scoreCategoryOptions = ([
    { key: "all", label: "ทั้งหมด" },
    { key: "lab", label: "งานในคาบ", count: scoreGroups.lab.length },
    { key: "homework", label: "การบ้าน", count: scoreGroups.homework.length },
    { key: "group", label: "งานกลุ่ม", count: scoreGroups.group.length },
    { key: "weekly", label: "งานสัปดาห์", count: scoreGroups.weekly.length },
    { key: "exams", label: "คะแนนสอบ", count: course.examScores.length },
    { key: "bonus", label: "คะแนนพิเศษ", count: bonusGroups.length },
  ] as Array<{ key: ScoreCategoryKey; label: string; count?: number }>)
    .filter((o) => o.key === "all" || (o.count ?? 0) > 0);

  const scoreSections = ([
    { key: "lab" as const, label: "งานในคาบ", items: scoreGroups.lab },
    { key: "homework" as const, label: "การบ้าน", items: scoreGroups.homework },
    { key: "group" as const, label: "งานกลุ่ม", items: scoreGroups.group },
    { key: "weekly" as const, label: "งานสัปดาห์", items: scoreGroups.weekly },
  ]).filter((s) => s.items.length > 0 && (selectedScoreCategory === "all" || selectedScoreCategory === s.key));

  const summaryCells = [
    { label: "มาเรียน", val: summary.present, icon: "solar:check-circle-linear", bg: "var(--cg-success-soft)", fg: "var(--cg-success)" },
    { label: "สาย", val: summary.late, icon: "solar:clock-circle-linear", bg: "var(--cg-warning-soft)", fg: "var(--cg-warning)" },
    { label: "ลา", val: summary.leave, icon: "solar:letter-linear", bg: "var(--cg-info-soft)", fg: "var(--cg-info)" },
    { label: "ขาด", val: summary.absent, icon: "solar:close-circle-linear", bg: "var(--cg-danger-soft)", fg: "var(--cg-danger)" },
  ];

  const tabLabels: Record<TabKey, string> = {
    Overview: "ภาพรวม",
    Scores: "คะแนน",
    Attendance: "เช็กชื่อ",
    ExamSeats: t("examSeats"),
    Updates: "อัปเดต",
  };

  const sectionText = course.course.sections
    .map((s) => s.section_no || s.name || String(s.id))
    .filter(Boolean)
    .join(", ");

  const formatExamSeatType = (seat: MyExamSeat) => {
    const examTypeLabel = seat.exam_type === "midterm" ? t("midtermExam") : t("finalExam");
    const componentLabel = seat.component === "lab" ? t("practicalComponent") : t("lectureComponent");
    return `${examTypeLabel} (${componentLabel})`;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── cover ──────────────────────────────────────────────────── */}
      <div className="cg-cover">
        {course.course.image ? (
          <CourseCoverImage
            src={course.course.image}
            alt={course.course.name}
            positionX={course.course.cover_position_x}
            positionY={course.course.cover_position_y}
            zoom={course.course.cover_zoom}
            className="absolute inset-0"
            priority
          />
        ) : (
          <span className="absolute inset-0" style={{ background: courseCoverFallback(course.course.code) }} />
        )}
        <span className="cg-cover-scrim" />

        <button type="button" className="cg-cover-btn left-4" onClick={() => router.back()}>
          <Icon icon="solar:alt-arrow-left-linear" width={17} height={17} />
          ย้อนกลับ
        </button>
        <span className="cg-cover-btn right-4" style={{ cursor: "default" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: course.course.is_active ? "#4ade80" : "#94a3b8" }} />
          {course.course.is_active ? "กำลังเรียน" : "ปิดแล้ว"}
        </span>

        <div className="cg-cover-text">
          <span className="cg-cover-code">{course.course.code}</span>
          <h1 className="cg-cover-name">{course.course.name}</h1>
        </div>
      </div>

      {/* ── meta ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-[7px]">
        <span className="cg-meta-chip">
          <Icon icon="solar:calendar-linear" width={13} height={13} style={{ color: "var(--cg-text-3)" }} />
          เทอม <b className="font-medium" style={{ color: "var(--cg-text)" }}>{course.course.semester}/{course.course.year}</b>
        </span>
        {sectionText && (
          <span className="cg-meta-chip">
            <Icon icon="solar:bookmark-linear" width={13} height={13} style={{ color: "var(--cg-text-3)" }} />
            กลุ่มเรียนที่ <b className="font-medium" style={{ color: "var(--cg-text)" }}>{sectionText}</b>
          </span>
        )}
        <span className="cg-meta-chip">
          <Icon icon="solar:user-linear" width={13} height={13} style={{ color: "var(--cg-text-3)" }} />
          {data.student.full_name}
        </span>
      </div>

      {/* ── tabs ───────────────────────────────────────────────────── */}
      <div className="cg-pill-row">
        {tabKeys.map((key) => (
          <button key={key} type="button" className="cg-pill" data-active={activeTab === key} onClick={() => setActiveTab(key)}>
            {tabLabels[key]}
          </button>
        ))}
      </div>

      {/* ── overview ───────────────────────────────────────────────── */}
      {activeTab === "Overview" && (
        <div className="flex flex-col gap-[18px]">
          <section className="flex flex-col gap-2">
            <p className="cg-section-label">กลุ่มของฉัน</p>
            <div className="cg-list">
              {course.course.my_groups && course.course.my_groups.length > 0 ? (
                course.course.my_groups.map((group) => {
                  const open = openGroups[group.id] ?? false;
                  return (
                    <div key={group.id}>
                      <button
                        type="button"
                        className="cg-row"
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                      >
                        <span className="cg-row-ico" style={{ background: "var(--cg-violet-soft)", color: "var(--cg-violet)" }}>
                          <Icon icon="solar:users-group-rounded-linear" width={17} height={17} />
                        </span>
                        <span className="cg-row-body">
                          <span className="cg-row-title">{group.name}</span>
                          <span className="cg-row-sub">{studentGroupTypeLabel(group)} สมาชิก {group.members.length} คน</span>
                        </span>
                        <Icon
                          icon="solar:alt-arrow-down-linear"
                          className="cg-chevron"
                          width={15}
                          height={15}
                          style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .18s" }}
                        />
                      </button>
                      {open && (
                        <div className="flex flex-col gap-1.5 px-3.5 pb-3.5 pl-[62px]">
                          {group.members.length > 0 ? group.members.map((member) => (
                            <div key={member.id} className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5" style={{ background: "var(--cg-fill)" }}>
                              <span className="truncate text-[11.5px] font-light">{member.full_name}</span>
                              <span className="cg-mono shrink-0 text-[10.5px]" style={{ color: "var(--cg-text-3)" }}>{member.student_id}</span>
                            </div>
                          )) : (
                            <p className="text-[11.5px] font-light" style={{ color: "var(--cg-text-3)" }}>ยังไม่มีสมาชิกในกลุ่ม</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="cg-empty">
                  <Icon icon="solar:users-group-rounded-linear" width={27} height={27} />
                  <span className="text-[11.5px] font-light">ยังไม่ถูกจัดกลุ่มในรายวิชานี้</span>
                </div>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <p className="cg-section-label">สรุปการเข้าเรียน</p>
            <div className="cg-stat4">
              {summaryCells.map((s) => (
                <div key={s.label} style={{ background: s.bg, color: s.fg }}>
                  <Icon icon={s.icon} width={16} height={16} />
                  <b className="cg-mono text-base font-semibold leading-tight">{s.val}</b>
                  <span className="text-[10px] font-normal" style={{ color: "var(--cg-text-2)" }}>{s.label}</span>
                </div>
              ))}
            </div>
            <div className="cg-progress mt-0.5"><i style={{ width: `${attendPct}%`, background: "var(--cg-success)" }} /></div>
            <p className="text-right text-[11px] font-light" style={{ color: "var(--cg-text-3)" }}>เข้าเรียน {attendPct}%</p>
          </section>

          <section className="flex flex-col gap-2">
            <p className="cg-section-label">สรุปคะแนน</p>
            <div className="cg-list">
              <div className="cg-row items-start">
                <span className="cg-row-ico mt-0.5" style={{ background: "var(--cg-info-soft)", color: "var(--cg-info)" }}>
                  <Icon icon="solar:medal-ribbon-linear" width={17} height={17} />
                </span>
                <span className="cg-row-body">
                  <span className="cg-row-title">คะแนนรวมจากงานทั้งหมด</span>
                  <ScoreBar score={visibleTotalScore} max={visibleTotalMaxScore} />
                </span>
              </div>
              {course.bonusScore && course.bonusScore.total > 0 && (
                <div className="cg-row">
                  <span className="cg-row-ico" style={{ background: "var(--cg-warning-soft)", color: "var(--cg-warning)" }}>
                    <Icon icon="solar:star-linear" width={17} height={17} />
                  </span>
                  <span className="cg-row-body"><span className="cg-row-title">คะแนนพิเศษสะสม</span></span>
                  <span className="cg-mono text-sm font-semibold" style={{ color: "var(--cg-warning)" }}>+{course.bonusScore.total}</span>
                </div>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <p className="cg-section-label">ประกาศจากรายวิชา</p>
            <div className="cg-list">
              {notifs.length > 0 ? notifs.slice(0, 3).map((n) => {
                const style = notifStyleFor(n.type);
                return (
                  <div key={n.id} className="cg-row items-start">
                    <span className="cg-row-ico mt-0.5" style={{ background: style.bg, color: style.fg }}>
                      <Icon icon={style.icon} width={17} height={17} />
                    </span>
                    <span className="cg-row-body">
                      <span className="cg-row-title">{getNotificationHeadline(n, language, t)}</span>
                      <span className="cg-row-sub line-clamp-2">{getNotificationMessage(n, language, t)}</span>
                    </span>
                  </div>
                );
              }) : (
                <div className="cg-empty">
                  <Icon icon="solar:bell-off-linear" width={27} height={27} />
                  <span className="text-[11.5px] font-light">ยังไม่มีประกาศจากรายวิชานี้</span>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── scores ─────────────────────────────────────────────────── */}
      {activeTab === "Scores" && (
        <div className="flex flex-col gap-4">
          <div className="cg-card flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-normal" style={{ color: "var(--cg-text-2)" }}>คะแนนรวมจากงานทั้งหมด</span>
            <span className="cg-mono text-xl font-semibold">
              {displayScore(visibleTotalScore)}
              <small className="text-[12.5px] font-normal" style={{ color: "var(--cg-text-3)" }}> / {displayScore(visibleTotalMaxScore)}</small>
            </span>
          </div>

          <div className="cg-pill-row">
            {scoreCategoryOptions.map((o) => (
              <button key={o.key} type="button" className="cg-pill" data-active={selectedScoreCategory === o.key} onClick={() => setSelectedScoreCategory(o.key)}>
                {o.label}{o.count != null ? ` (${o.count})` : ""}
              </button>
            ))}
          </div>

          {scoreSections.map((section) => (
            <section key={section.key} className="flex flex-col gap-2">
              <p className="cg-section-label">{section.label}</p>
              <div className="cg-list">
                {section.items.map((a) => <AssignmentRow key={a.id} a={a} />)}
              </div>
            </section>
          ))}

          {course.examScores.length > 0 && (selectedScoreCategory === "all" || selectedScoreCategory === "exams") && (
            <section className="flex flex-col gap-2">
              <p className="cg-section-label">คะแนนสอบ</p>
              <div className="cg-list">
                {course.examScores.map((e) => <ExamRow key={e.id} e={e} />)}
              </div>
            </section>
          )}

          {bonusGroups.length > 0 && (selectedScoreCategory === "all" || selectedScoreCategory === "bonus") && (
            <section className="flex flex-col gap-2">
              <p className="cg-section-label">คะแนนพิเศษ รวม +{course.bonusScore.total}</p>
              <div className="cg-list">
                {bonusGroups.map((group) => {
                  const isExpanded = expandedBonusDays[group.key] ?? false;
                  const shown = isExpanded ? group.records : group.records.slice(0, 1);
                  return (
                    <div key={group.key}>
                      <button
                        type="button"
                        className="cg-row"
                        onClick={() => setExpandedBonusDays((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                      >
                        <span className="cg-row-ico" style={{ background: "var(--cg-warning-soft)", color: "var(--cg-warning)" }}>
                          <Icon icon="solar:star-linear" width={17} height={17} />
                        </span>
                        <span className="cg-row-body">
                          <span className="cg-row-title">{group.label}</span>
                          <span className="cg-row-sub">{group.records.length} รายการในวันนี้</span>
                        </span>
                        <span className="cg-mono text-sm font-semibold" style={{ color: "var(--cg-warning)" }}>+{group.total}</span>
                      </button>
                      <div className="flex flex-col gap-1.5 px-3.5 pb-3.5 pl-[62px]">
                        {shown.map((b, i) => (
                          <div key={`${group.key}-${i}`} className="flex items-start justify-between gap-3 rounded-[10px] px-2.5 py-2" style={{ background: "var(--cg-fill)" }}>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[11.5px] font-medium">{b.reason}</span>
                              {b.given_by && (
                                <span className="block text-[10.5px] font-light" style={{ color: "var(--cg-text-3)" }}>
                                  โดย {b.given_by} เมื่อ {fmt(b.given_at)}
                                </span>
                              )}
                            </span>
                            <span className="cg-mono shrink-0 text-[11.5px] font-medium" style={{ color: "var(--cg-warning)" }}>+{b.score}</span>
                          </div>
                        ))}
                        {!isExpanded && group.records.length > 1 && (
                          <p className="text-[10.5px] font-light" style={{ color: "var(--cg-text-3)" }}>
                            และอีก {group.records.length - 1} รายการ
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {scoreSections.length === 0 && course.examScores.length === 0 && bonusGroups.length === 0 && (
            <div className="cg-list">
              <div className="cg-empty">
                <Icon icon="solar:medal-ribbon-linear" width={27} height={27} />
                <span className="text-[11.5px] font-light">ยังไม่มีคะแนนที่แสดงได้</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── attendance ─────────────────────────────────────────────── */}
      {activeTab === "Attendance" && (
        <div className="flex flex-col gap-4">
          <div className="cg-stat4">
            {summaryCells.map((s) => (
              <div key={s.label} style={{ background: s.bg, color: s.fg }}>
                <Icon icon={s.icon} width={16} height={16} />
                <b className="cg-mono text-base font-semibold leading-tight">{s.val}</b>
                <span className="text-[10px] font-normal" style={{ color: "var(--cg-text-2)" }}>{s.label}</span>
              </div>
            ))}
          </div>

          <div className="cg-list">
            {course.attendance.records.length > 0 ? (
              course.attendance.records.map((r) => <AttendanceRow key={r.id} record={r} />)
            ) : (
              <div className="cg-empty">
                <Icon icon="solar:calendar-linear" width={27} height={27} />
                <span className="text-[11.5px] font-light">ยังไม่มีบันทึกการเช็กชื่อ</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── exam seats ─────────────────────────────────────────────── */}
      {activeTab === "ExamSeats" && (
        <div className="flex flex-col gap-4">
          {isExamSeatsLoading ? (
            <div className="cg-list">
              <div className="cg-row animate-pulse">
                <div className="h-9 w-9 shrink-0 rounded-xl" style={{ background: "var(--cg-fill-strong)" }} />
                <div className="h-3.5 w-1/2 rounded-full" style={{ background: "var(--cg-fill-strong)" }} />
              </div>
            </div>
          ) : examSeats.length === 0 ? (
            <div className="cg-list">
              <div className="cg-empty">
                <Icon icon="solar:armchair-linear" width={27} height={27} />
                <span className="text-[11.5px] font-light">{t("studentExamSeatEmpty")}</span>
              </div>
            </div>
          ) : (
            examSeats.map((seat) => (
              <div key={`${seat.session_id}-${seat.exam_type}-${seat.component}`} className="cg-card">
                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[12.5px] font-medium">{formatExamSeatType(seat)}</span>
                  <span className="cg-badge cg-badge-success">ยืนยันที่นั่งแล้ว</span>
                </div>
                <div className="mt-3.5 flex items-center gap-4">
                  <span className="cg-queue-num">{seat.seat_label || seat.desk_number}</span>
                  <span className="self-stretch" style={{ width: 1, background: "var(--cg-line)" }} />
                  <span className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
                      <Icon icon="solar:buildings-linear" width={14} height={14} style={{ color: "var(--cg-text-3)" }} />
                      {seat.classroom_name}
                    </span>
                    <span className="flex items-center gap-1.5 text-[12.5px] font-light">
                      <Icon icon="solar:armchair-linear" width={14} height={14} style={{ color: "var(--cg-text-3)" }} />
                      โต๊ะที่ {seat.desk_number}
                    </span>
                  </span>
                </div>
                <div className="mt-3.5 flex gap-5 border-t pt-3.5" style={{ borderColor: "var(--cg-line)" }}>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[10.5px]" style={{ color: "var(--cg-text-3)" }}>วันสอบ</span>
                    <b className="cg-mono text-[13px] font-medium">{seat.exam_date}</b>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[10.5px]" style={{ color: "var(--cg-text-3)" }}>เวลา</span>
                    <b className="cg-mono text-[13px] font-medium">{seat.start_time}–{seat.end_time} น.</b>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── updates ────────────────────────────────────────────────── */}
      {activeTab === "Updates" && (
        <div className="cg-list">
          {notifs.length > 0 ? notifs.map((n) => {
            const style = notifStyleFor(n.type);
            return (
              <div key={n.id} className="cg-row items-start">
                <span className="cg-row-ico mt-0.5" style={{ background: style.bg, color: style.fg }}>
                  <Icon icon={style.icon} width={17} height={17} />
                </span>
                <span className="cg-row-body">
                  <span className="cg-row-title">{getNotificationHeadline(n, language, t)}</span>
                  <span className="cg-row-sub line-clamp-2">{getNotificationMessage(n, language, t)}</span>
                  <span className="cg-row-sub" style={{ color: "var(--cg-text-3)" }}>{fmt(n.created_at)}</span>
                </span>
              </div>
            );
          }) : (
            <div className="cg-empty">
              <Icon icon="solar:bell-off-linear" width={27} height={27} />
              <span className="text-[11.5px] font-light">ยังไม่มีการแจ้งเตือนจากรายวิชานี้</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
