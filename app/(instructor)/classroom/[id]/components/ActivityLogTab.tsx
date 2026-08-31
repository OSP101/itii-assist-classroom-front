"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Tabs, Tab } from "@heroui/tabs";
import { Tooltip } from "@heroui/tooltip";
import { Avatar } from "@heroui/avatar";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { RadioGroup, Radio } from "@heroui/radio";
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
import { instructorFlatButtonClass } from "@/components/ui/instructor-button-styles";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import TablePaginationFooter from "@/components/ui/table-pagination-footer";
import {
  getActivityLogs,
  exportActivityLogs,
  getActivityStats,
  getActivityFilters,
  type ActivityLog,
  type Pagination as PaginationData,
  type ActivityLogFilters,
  type ActivityLogStats,
  type ActivityEventType,
  type ResolvedRef,
} from "@/services/courseActivityLog.service";
import {
  STICKY_ACTION_HEADER_CLASS,
  STICKY_ACTION_CELL_CLASS,
  STICKY_SCROLL_CONTAINER_CLASS,
  useHorizontalOverflow,
} from "./shared/stickyActionColumn";
import ActivityLogDetailModal from "./activity-log/ActivityLogDetailModal";
import ActivityTimelineList from "./activity-log/ActivityTimelineList";
import {
  buildDetailExportText,
  formatDevice,
  formatTarget,
  isOutsiderAdminView,
  isSystemDetectedEvent,
  splitDetailParts,
} from "./activity-log/activityDetail";

interface ActivityLogTabProps {
  courseId: string;
  courseCode?: string;
}

// ============================================
// Category/Action Display Helpers
// ============================================

function getCategoryConfig(isEnglish: boolean): Record<string, { label: string; icon: string; bgClass: string; iconClass: string }> {
  return {
    course: { label: isEnglish ? "Course" : "รายวิชา", icon: "solar:book-bold", bgClass: "bg-blue-100", iconClass: "text-blue-600" },
    member: { label: isEnglish ? "People" : "สมาชิก", icon: "solar:users-group-rounded-bold", bgClass: "bg-indigo-100", iconClass: "text-indigo-600" },
    assignment: { label: isEnglish ? "Classwork" : "งาน", icon: "solar:clipboard-list-bold", bgClass: "bg-emerald-100", iconClass: "text-emerald-600" },
    score: { label: isEnglish ? "Scores" : "คะแนน", icon: "solar:chart-square-bold", bgClass: "bg-amber-100", iconClass: "text-amber-600" },
    attendance: { label: isEnglish ? "Attendance" : "เช็กชื่อ", icon: "solar:user-check-bold", bgClass: "bg-rose-100", iconClass: "text-rose-600" },
    queue: { label: isEnglish ? "Queue" : "คิว", icon: "solar:sort-by-time-bold", bgClass: "bg-content3", iconClass: "text-default-600" },
    access: { label: isEnglish ? "Viewed" : "การเข้าดู", icon: "solar:eye-bold", bgClass: "bg-cyan-100", iconClass: "text-cyan-600" },
    general: { label: isEnglish ? "General" : "ทั่วไป", icon: "solar:info-circle-bold", bgClass: "bg-content3", iconClass: "text-default-600" },
  };
}

const categoryChipColor: Record<string, "primary" | "secondary" | "success" | "warning" | "danger" | "default"> = {
  course: "primary",
  member: "secondary",
  assignment: "success",
  score: "warning",
  attendance: "danger",
  queue: "default",
  access: "secondary",
  general: "default",
};

function getActionLabels(isEnglish: boolean): Record<string, string> {
  return {
    create_course: isEnglish ? "Create course" : "สร้างรายวิชา",
    update_course: isEnglish ? "Update course" : "แก้ไขรายวิชา",
    delete_course: isEnglish ? "Delete course" : "ลบรายวิชา",
    activate_course: isEnglish ? "Activate course" : "เปิดใช้งานรายวิชา",
    deactivate_course: isEnglish ? "Close course" : "ปิดใช้งานรายวิชา",
    add_section: isEnglish ? "Add section" : "เพิ่มกลุ่มเรียน",
    remove_section: isEnglish ? "Remove section" : "ลบกลุ่มเรียน",
    update_section: isEnglish ? "Update section" : "แก้ไขกลุ่มเรียน",
    add_ta: isEnglish ? "Add teaching assistant" : "เพิ่มผู้ช่วยสอน",
    bulk_add_tas: isEnglish ? "Bulk add teaching assistants" : "เพิ่มผู้ช่วยสอน (จำนวนมาก)",
    remove_ta: isEnglish ? "Remove teaching assistant" : "นำผู้ช่วยสอนออก",
    add_instructor: isEnglish ? "Add instructor" : "เพิ่มอาจารย์",
    bulk_add_instructors: isEnglish ? "Bulk add instructors" : "เพิ่มอาจารย์ (จำนวนมาก)",
    remove_instructor: isEnglish ? "Remove instructor" : "นำอาจารย์ออก",
    add_student: isEnglish ? "Add student" : "เพิ่มนักศึกษา",
    bulk_add_students: isEnglish ? "Bulk add students" : "เพิ่มนักศึกษา (จำนวนมาก)",
    remove_student: isEnglish ? "Remove student" : "นำนักศึกษาออก",
    create_assignment: isEnglish ? "Create assignment" : "สร้างงาน",
    update_assignment: isEnglish ? "Update assignment" : "แก้ไขงาน",
    delete_assignment: isEnglish ? "Delete assignment" : "ลบงาน",
    submit_score: isEnglish ? "Submit score" : "ให้คะแนน",
    submit_bulk_scores: isEnglish ? "Submit scores in bulk" : "ให้คะแนน (จำนวนมาก)",
    submit_group_score: isEnglish ? "Submit group score" : "ให้คะแนนกลุ่ม",
    request_score_edit: isEnglish ? "Request score edit" : "ขอแก้ไขคะแนน",
    approve_score_edit: isEnglish ? "Approve score edit" : "อนุมัติแก้ไขคะแนน",
    reject_score_edit: isEnglish ? "Reject score edit" : "ปฏิเสธแก้ไขคะแนน",
    create_attendance: isEnglish ? "Create attendance" : "สร้างเช็กชื่อ",
    update_attendance: isEnglish ? "Update attendance" : "แก้ไขเช็กชื่อ",
    activate_attendance: isEnglish ? "Open attendance" : "เปิดเช็กชื่อ",
    close_attendance: isEnglish ? "Close attendance" : "ปิดเช็กชื่อ",
    delete_attendance: isEnglish ? "Delete attendance" : "ลบเช็กชื่อ",
    create_queue_session: isEnglish ? "Create queue" : "สร้างคิว",
    update_queue_session: isEnglish ? "Update queue" : "แก้ไขคิว",
    delete_queue_session: isEnglish ? "Delete queue" : "ลบคิว",
    queue_session_active: isEnglish ? "Open queue" : "เปิดคิว",
    queue_session_paused: isEnglish ? "Pause queue" : "หยุดคิวชั่วคราว",
    queue_session_closed: isEnglish ? "Close queue" : "ปิดคิว",
    start_queue_session: isEnglish ? "Start queue" : "เริ่มคิว",
    pause_queue_session: isEnglish ? "Pause queue" : "หยุดคิวชั่วคราว",
    resume_queue_session: isEnglish ? "Resume queue" : "เริ่มคิวต่อ",
    close_queue_session: isEnglish ? "Close queue" : "ปิดคิว",
    update_queue_session_status: isEnglish ? "Update queue status" : "เปลี่ยนสถานะคิว",
    regenerate_queue_pin: isEnglish ? "Regenerate queue PIN" : "สร้าง PIN คิวใหม่",
    create_queue_booking: isEnglish ? "Create booking" : "สร้างการจอง",
    cancel_queue_booking: isEnglish ? "Cancel booking" : "ยกเลิกการจอง",
    update_queue_booking: isEnglish ? "Update booking" : "อัปเดตการจอง",
    complete_queue_booking: isEnglish ? "Complete booking" : "เสร็จสิ้นการจอง",
    skip_queue_booking: isEnglish ? "Skip booking" : "ข้ามการจอง",
    join_queue_worker: isEnglish ? "Join queue (worker)" : "เข้าร่วมรับงาน",
    leave_queue_worker: isEnglish ? "Leave queue (worker)" : "ออกจากการรับงาน",
    give_bonus_score: isEnglish ? "Give bonus score" : "ให้คะแนนพิเศษ",
    submit_exam_score: isEnglish ? "Submit exam score" : "บันทึกคะแนนสอบ",
    bulk_submit_exam_scores: isEnglish ? "Bulk submit exam scores" : "บันทึกคะแนนสอบ (จำนวนมาก)",
    create_attendance_session: isEnglish ? "Create attendance" : "สร้างเช็กชื่อ",
    update_attendance_session: isEnglish ? "Update attendance" : "แก้ไขเช็กชื่อ",
    activate_attendance_session: isEnglish ? "Open attendance" : "เปิดเช็กชื่อ",
    close_attendance_session: isEnglish ? "Close attendance" : "ปิดเช็กชื่อ",
    delete_attendance_session: isEnglish ? "Delete attendance" : "ลบเช็กชื่อ",
    update_attendance_record: isEnglish ? "Update attendance record" : "แก้ไขสถิติเช็กชื่อ",
    bulk_update_attendance_records: isEnglish ? "Bulk update attendance" : "แก้ไขสถิติเช็กชื่อ (จำนวนมาก)",
    apply_attendance_time_change: isEnglish ? "Apply time change" : "ปรับเวลาเช็กชื่อ",
    reorder_assignments: isEnglish ? "Reorder assignments" : "จัดเรียงลำดับงาน",
    link_assignment_attendance: isEnglish ? "Link assignment to attendance" : "เชื่อมงานกับเช็กชื่อ",
    bulk_submit_scores: isEnglish ? "Submit scores in bulk" : "ให้คะแนน (จำนวนมาก)",
    create_score_edit_request: isEnglish ? "Request score edit" : "ขอแก้ไขคะแนน",
    create_batch_score_edit_request: isEnglish ? "Batch request score edit" : "ขอแก้ไขคะแนน (กลุ่ม)",
    create_detailed_batch_score_edit_request: isEnglish ? "Detailed batch request" : "ขอแก้ไขคะแนน (รายละเอียด)",
    cancel_score_edit_request: isEnglish ? "Cancel score edit request" : "ยกเลิกคำขอแก้ไขคะแนน",
    approve_score_edit_request: isEnglish ? "Approve score edit" : "อนุมัติแก้ไขคะแนน",
    reject_score_edit_request: isEnglish ? "Reject score edit" : "ปฏิเสธแก้ไขคะแนน",
    batch_approve_score_edit_requests: isEnglish ? "Batch approve score edits" : "อนุมัติแก้ไขคะแนน (กลุ่ม)",
    batch_reject_score_edit_requests: isEnglish ? "Batch reject score edits" : "ปฏิเสธแก้ไขคะแนน (กลุ่ม)",

    // Read audit (category "access")
    view_course: isEnglish ? "Opened the course" : "เข้าดูรายวิชา",
    view_scores: isEnglish ? "Viewed scores" : "เข้าดูคะแนน",
    view_roster: isEnglish ? "Viewed student list" : "เข้าดูรายชื่อนักศึกษา",
    view_attendance: isEnglish ? "Viewed attendance" : "เข้าดูข้อมูลเช็กชื่อ",
    view_exam: isEnglish ? "Viewed exam data" : "เข้าดูข้อมูลสอบ",
    view_activity_log: isEnglish ? "Opened the activity log" : "เข้าดูบันทึกกิจกรรม",
    export_exam_seats: isEnglish ? "Exported exam seating" : "ส่งออกผังที่นั่งสอบ",
    export_activity_log: isEnglish ? "Exported the activity log" : "ส่งออกบันทึกกิจกรรม",

    // Mirrored from the check-in security log
    attendance_checkin_failed: isEnglish ? "Check-in failed" : "เช็กชื่อไม่สำเร็จ",
    attendance_checkin_blocked: isEnglish ? "Check-in blocked by campus guard" : "เช็กชื่อถูกด่านเครือข่ายปฏิเสธ",
    attendance_checkin_rate_limited: isEnglish ? "Check-in rate limited" : "เช็กชื่อถี่เกินกำหนด",
  };
}

function formatDate(dateStr: string, isEnglish: boolean) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return isEnglish ? "Just now" : "เมื่อสักครู่";
  if (diffMin < 60) return isEnglish ? `${diffMin} min ago` : `${diffMin} นาทีที่แล้ว`;
  if (diffHour < 24) return isEnglish ? `${diffHour} hr ago` : `${diffHour} ชั่วโมงที่แล้ว`;
  if (diffDay < 7) return isEnglish ? `${diffDay} day${diffDay === 1 ? "" : "s"} ago` : `${diffDay} วันที่แล้ว`;

  return date.toLocaleDateString(isEnglish ? "en-US" : "th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================
// Date range helpers
// ============================================

type DatePreset = "" | "today" | "week" | "month" | "custom";
type ExportDatePreset = "today" | "week" | "month" | "year" | "custom";
type Granularity = "daily" | "weekly" | "monthly" | "yearly";

function padTwo(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`; }

function getDateRangeFromPreset(preset: ExportDatePreset | DatePreset): { start: string; end: string } {
  const today = new Date();
  if (preset === "today") {
    const s = fmtDate(today);
    return { start: s, end: s };
  }
  if (preset === "week") {
    const day = today.getDay();
    const mon = new Date(today); mon.setDate(today.getDate() - ((day + 6) % 7));
    return { start: fmtDate(mon), end: fmtDate(today) };
  }
  if (preset === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: fmtDate(start), end: fmtDate(today) };
  }
  if (preset === "year") {
    const start = new Date(today.getFullYear(), 0, 1);
    return { start: fmtDate(start), end: fmtDate(today) };
  }
  return { start: "", end: "" };
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getGroupKey(date: Date, granularity: Granularity, isEnglish: boolean): string {
  const locale = isEnglish ? "en-US" : "th-TH";
  if (granularity === "daily") {
    return date.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  if (granularity === "weekly") {
    const wk = getWeekNumber(date);
    return isEnglish ? `Week ${wk}, ${date.getFullYear()}` : `สัปดาห์ที่ ${wk} ปี ${date.getFullYear()}`;
  }
  if (granularity === "monthly") {
    return date.toLocaleDateString(locale, { year: "numeric", month: "long" });
  }
  return String(date.getFullYear());
}

function downloadCSV(logs: ActivityLog[], granularity: Granularity, actionLabels: Record<string, string>, isEnglish: boolean, courseCode: string, startDate: string, endDate: string) {
  const locale = isEnglish ? "en-US" : "th-TH";
  const headers = [
    isEnglish ? "Timestamp" : "วันที่-เวลา",
    isEnglish ? "Actor Name" : "ชื่อผู้ดำเนินการ",
    isEnglish ? "Role (snapshot)" : "บทบาท (snapshot)",
    isEnglish ? "Email (snapshot)" : "อีเมล (snapshot)",
    isEnglish ? "IP Address" : "IP Address",
    isEnglish ? "Action" : "การกระทำ",
    isEnglish ? "Category" : "หมวดหมู่",
    isEnglish ? "Target" : "เป้าหมาย",
    isEnglish ? "Details" : "รายละเอียด",
    isEnglish ? "Device" : "อุปกรณ์",
    isEnglish ? "User Agent" : "User Agent",
  ];

  const escape = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;

  const rows: string[] = [headers.map(escape).join(",")];
  let lastGroup = "";

  for (const log of logs) {
    const date = new Date(log.created_at);
    const group = getGroupKey(date, granularity, isEnglish);
    if (group !== lastGroup) {
      if (lastGroup !== "") rows.push("");
      rows.push([escape(`▶ ${group}`), ...Array(headers.length - 1).fill('""')].join(","));
      lastGroup = group;
    }
    rows.push([
      escape(date.toLocaleString(locale)),
      // System-detected rows carry no user account; naming the student the row
      // is about beats an "Unknown" column in an exported audit trail.
      escape(
        log.actor?.full_name
          ?? (isSystemDetectedEvent(log)
            ? `${isEnglish ? "System" : "ระบบ"} (${formatTarget(log, isEnglish) || "-"})`
            : "Unknown"),
      ),
      escape(log.actor_role ?? log.actor?.role ?? ""),
      escape(log.actor_email ?? log.actor?.email ?? ""),
      escape(log.ip_address ?? ""),
      escape(actionLabels[log.action] ?? log.action),
      escape(log.category),
      escape(formatTarget(log, isEnglish)),
      escape(buildDetailExportText(log, isEnglish)),
      escape(formatDevice(log, isEnglish)),
      escape(log.user_agent ?? ""),
    ].join(","));
  }

  const rangePart = startDate && endDate ? `_${startDate}_${endDate}` : startDate ? `_from_${startDate}` : "";
  const filename = `activity-log-${courseCode}${rangePart}_${granularity}.csv`;
  const bom = "\uFEFF";
  const blob = new Blob([bom + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================
// Main Component
// ============================================

export default function ActivityLogTab({ courseId, courseCode }: ActivityLogTabProps) {
  const { language } = useGlobalSettings();
  const isEnglish = language === "en";
  const categoryConfig = useMemo(() => getCategoryConfig(isEnglish), [isEnglish]);
  const actionLabels = useMemo(() => getActionLabels(isEnglish), [isEnglish]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 30, totalPages: 0 });
  const [stats, setStats] = useState<ActivityLogStats | null>(null);
  const [filters, setFilters] = useState<ActivityLogFilters | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rowsPerPage, setRowsPerPage] = useState(30);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const { scrollRef, hasOverflow } = useHorizontalOverflow();

  // Filter state
  const [category, setCategory] = useState("");
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [eventType, setEventType] = useState<ActivityEventType>("");
  const [actorRole, setActorRole] = useState("");
  /** The one entity the timeline is narrowed to, e.g. a single student. */
  const [subject, setSubject] = useState<{ type: string; id: string; label: string } | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");
  const [activeSubTab, setActiveSubTab] = useState("timeline");

  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const { startDate, endDate } = useMemo(() => {
    if (datePreset === "" ) return { startDate: "", endDate: "" };
    if (datePreset === "custom") return { startDate: customStartDate, endDate: customEndDate };
    const r = getDateRangeFromPreset(datePreset);
    return { startDate: r.start, endDate: r.end };
  }, [datePreset, customStartDate, customEndDate]);

  // Export modal state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPreset, setExportPreset] = useState<ExportDatePreset>("month");
  const [exportCustomStart, setExportCustomStart] = useState("");
  const [exportCustomEnd, setExportCustomEnd] = useState("");
  const [exportGranularity, setExportGranularity] = useState<Granularity>("daily");
  const [exportLoading, setExportLoading] = useState(false);

  const exportDateRange = useMemo(() => {
    if (exportPreset === "custom") return { start: exportCustomStart, end: exportCustomEnd };
    return getDateRangeFromPreset(exportPreset);
  }, [exportPreset, exportCustomStart, exportCustomEnd]);

  // Fetch logs
  const fetchLogs = useCallback(
    async (page = 1, limit = rowsPerPage) => {
      setLoading(true);
      try {
        const data = await getActivityLogs(courseId, {
          page,
          limit,
          eventType,
          actorRole,
          subjectType: subject?.type ?? "",
          subjectId: subject?.id ?? "",
          category,
          action,
          actorId,
          startDate,
          endDate,
          search: searchText,
        });
        setLogs(data.logs);
        setPagination(data.pagination);
      } catch {
        addToast({ title: isEnglish ? "Error" : "เกิดข้อผิดพลาด", description: isEnglish ? "Unable to load activity logs." : "ไม่สามารถโหลดข้อมูลได้", color: "danger", timeout: 3000,
                shouldShowTimeoutProgress: true, });
      } finally {
        setLoading(false);
      }
    },
    [action, actorId, actorRole, category, courseId, endDate, eventType, isEnglish, rowsPerPage, searchText, startDate, subject],
  );

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getActivityStats(courseId, 30);
      setStats(data);
    } catch {
      // silent fail for stats
    } finally {
      setStatsLoading(false);
    }
  }, [courseId]);

  // Fetch filters
  const fetchFilters = useCallback(async () => {
    try {
      const data = await getActivityFilters(courseId);
      setFilters(data);
    } catch {
      // silent
    }
  }, [courseId]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
    fetchFilters();
  }, [fetchStats, fetchFilters]);

  // Filter actions by selected category
  const filteredActions = useMemo(() => {
    if (!filters) return [];
    if (!category) return filters.actions;
    return filters.actions.filter((a) => a.category === category);
  }, [filters, category]);

  const getRoleLabel = useCallback((role?: string | null) => {
    if (role === "instructor") return isEnglish ? "Instructor" : "อาจารย์";
    if (role === "ta") return "TA";
    if (role === "admin") return isEnglish ? "Admin" : "แอดมิน";
    return role || "";
  }, [isEnglish]);

  // Narrowing to one entity is the log's most-asked question ("who touched this
  // student's scores"), so any resolved reference in the UI is a way in.
  const focusSubject = useCallback((ref: ResolvedRef) => {
    setSubject({ type: ref.type, id: ref.id, label: ref.sub ? `${ref.label} (${ref.sub})` : ref.label });
    setSelectedLog(null);
  }, []);

  const handleExport = useCallback(async () => {
    setExportLoading(true);
    try {
      const logs = await exportActivityLogs(courseId, {
        eventType,
        actorRole,
        subjectType: subject?.type ?? "",
        subjectId: subject?.id ?? "",
        category,
        action,
        actorId,
        startDate: exportDateRange.start,
        endDate: exportDateRange.end,
        search: searchText,
      });
      if (logs.length === 0) {
        addToast({ title: isEnglish ? "No data" : "ไม่มีข้อมูล", description: isEnglish ? "No activity logs found for the selected period." : "ไม่พบบันทึกกิจกรรมในช่วงเวลาที่เลือก", color: "warning", timeout: 4000, shouldShowTimeoutProgress: true });
        return;
      }
      downloadCSV(logs, exportGranularity, actionLabels, isEnglish, courseCode || courseId, exportDateRange.start, exportDateRange.end);
      setExportOpen(false);
      addToast({ title: isEnglish ? "Export complete" : "ส่งออกสำเร็จ", description: isEnglish ? `Downloaded ${logs.length} records.` : `ดาวน์โหลด ${logs.length} รายการ`, color: "success", timeout: 3000, shouldShowTimeoutProgress: true });
    } catch {
      addToast({ title: isEnglish ? "Export failed" : "ส่งออกไม่สำเร็จ", description: isEnglish ? "Failed to export activity logs." : "เกิดข้อผิดพลาดในการส่งออก", color: "danger", timeout: 3000, shouldShowTimeoutProgress: true });
    } finally {
      setExportLoading(false);
    }
  }, [action, actionLabels, actorId, actorRole, category, courseId, eventType, exportDateRange.end, exportDateRange.start, exportGranularity, isEnglish, searchText, subject]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{isEnglish ? "Activity log" : "บันทึกกิจกรรม"}</h2>
          <p className="text-sm text-default-500">{isEnglish ? "Track changes made across this course." : "ติดตามการเปลี่ยนแปลงทั้งหมดภายในรายวิชา"}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="flat"
            startContent={<Icon icon="solar:export-linear" className="text-sm" />}
            onPress={() => setExportOpen(true)}
            className={instructorFlatButtonClass("bg-emerald-50 text-emerald-700 hover:bg-emerald-100")}
          >
            {isEnglish ? "Export CSV" : "ส่งออก CSV"}
          </Button>
          <Button
            size="sm"
            variant="flat"
            onPress={() => { fetchLogs(1); fetchStats(); fetchFilters(); }}
            className={instructorFlatButtonClass("bg-content2 text-default-600 hover:bg-content3")}
          >
            {isEnglish ? "Refresh" : "รีเฟรช"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        selectedKey={activeSubTab}
        onSelectionChange={(key) => setActiveSubTab(key as string)}
        variant="underlined"
        classNames={{
          tabList: "gap-4 md:gap-6 flex-nowrap min-w-max",
          cursor: "bg-blue-500",
          tab: "px-0 h-10",
          tabContent: "group-data-[selected=true]:text-blue-600 text-default-500 font-medium text-sm",
        }}
      >
        <Tab
          key="timeline"
          title={
            <div className="flex items-center gap-2">
              <span>{isEnglish ? "Activity timeline" : "ไทม์ไลน์กิจกรรม"}</span>
              {pagination.total > 0 && (
                <Chip size="sm" variant="flat" color="primary" className="h-5 px-1.5 text-xs">
                  {pagination.total}
                </Chip>
              )}
            </div>
          }
        />
        <Tab
          key="summary"
          title={
            <div className="flex items-center gap-2">
              <span>{isEnglish ? "Overview summary" : "สรุปภาพรวม"}</span>
            </div>
          }
        />
      </Tabs>

      {/* Timeline Sub-Tab */}
      {activeSubTab === "timeline" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <Card className="border border-default-200 shadow-sm">
            <CardBody className="py-3 px-4">
              <div className="flex flex-col gap-3">
                {/* Subject banner: everything that happened to one entity */}
                {subject && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 p-2.5 dark:bg-primary-100/10">
                    <Icon icon="solar:target-bold" className="text-primary-600" width={16} />
                    <span className="text-sm text-primary-700 dark:text-primary-400">
                      {isEnglish ? "Showing everything about" : "กำลังแสดงทุกอย่างที่เกี่ยวกับ"}
                    </span>
                    <Chip size="sm" variant="flat" color="primary">
                      {subject.label}
                    </Chip>
                    <Button
                      size="sm"
                      variant="light"
                      className="ml-auto text-default-600"
                      startContent={<Icon icon="solar:close-circle-linear" width={14} />}
                      onPress={() => setSubject(null)}
                    >
                      {isEnglish ? "Clear" : "ล้างตัวกรองนี้"}
                    </Button>
                  </div>
                )}

                {/* Event kind row */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-default-500 shrink-0">{isEnglish ? "Show:" : "แสดง:"}</span>
                  {(["", "changes", "access"] as ActivityEventType[]).map((kind) => {
                    const label = kind === ""
                      ? (isEnglish ? "Everything" : "ทั้งหมด")
                      : kind === "changes"
                        ? (isEnglish ? "Changes" : "การแก้ไข")
                        : (isEnglish ? "Views" : "การเข้าดู");
                    const active = eventType === kind;
                    return (
                      <Button
                        key={kind || "all"}
                        size="sm"
                        variant={active ? "solid" : "flat"}
                        color={active ? "primary" : "default"}
                        onPress={() => setEventType(kind)}
                        className={active ? "text-white" : "text-default-600"}
                        startContent={
                          kind === "access"
                            ? <Icon icon="solar:eye-linear" className="text-sm" />
                            : kind === "changes"
                              ? <Icon icon="solar:pen-2-linear" className="text-sm" />
                              : undefined
                        }
                      >
                        {label}
                      </Button>
                    );
                  })}

                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={actorRole === "admin" ? "solid" : "flat"}
                      color={actorRole === "admin" ? "danger" : "default"}
                      className={actorRole === "admin" ? "text-white" : "text-default-600"}
                      startContent={<Icon icon="solar:shield-warning-linear" className="text-sm" />}
                      onPress={() => setActorRole((prev) => (prev === "admin" ? "" : "admin"))}
                    >
                      {isEnglish ? "Admins only" : "เฉพาะแอดมิน"}
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      className="text-default-600"
                      startContent={
                        <Icon
                          icon={viewMode === "table" ? "solar:calendar-linear" : "solar:list-linear"}
                          className="text-sm"
                        />
                      }
                      onPress={() => setViewMode((prev) => (prev === "table" ? "timeline" : "table"))}
                    >
                      {viewMode === "table"
                        ? (isEnglish ? "Timeline" : "มุมมองไทม์ไลน์")
                        : (isEnglish ? "Table" : "มุมมองตาราง")}
                    </Button>
                  </div>
                </div>

                {/* Date preset row */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-default-500 shrink-0">{isEnglish ? "Period:" : "ช่วงเวลา:"}</span>
                  {(["", "today", "week", "month", "custom"] as DatePreset[]).map((preset) => {
                    const label = preset === "" ? (isEnglish ? "All time" : "ทั้งหมด")
                      : preset === "today" ? (isEnglish ? "Today" : "วันนี้")
                      : preset === "week" ? (isEnglish ? "This week" : "สัปดาห์นี้")
                      : preset === "month" ? (isEnglish ? "This month" : "เดือนนี้")
                      : (isEnglish ? "Custom" : "กำหนดเอง");
                    const active = datePreset === preset;
                    return (
                      <Button
                        key={preset}
                        size="sm"
                        variant={active ? "solid" : "flat"}
                        color={active ? "primary" : "default"}
                        onPress={() => setDatePreset(preset)}
                        className={active ? "text-white" : "text-default-600"}
                      >
                        {label}
                      </Button>
                    );
                  })}
                  {datePreset === "custom" && (
                    <div className="flex gap-2 items-center flex-wrap mt-1">
                      <Input
                        type="date"
                        size="sm"
                        variant="bordered"
                        label={isEnglish ? "From" : "ตั้งแต่"}
                        value={customStartDate}
                        onValueChange={setCustomStartDate}
                        className="w-40"
                        classNames={{ inputWrapper: "bg-content1 border-default-200" }}
                      />
                      <Input
                        type="date"
                        size="sm"
                        variant="bordered"
                        label={isEnglish ? "To" : "ถึง"}
                        value={customEndDate}
                        onValueChange={setCustomEndDate}
                        className="w-40"
                        classNames={{ inputWrapper: "bg-content1 border-default-200" }}
                      />
                    </div>
                  )}
                  {(startDate || endDate) && datePreset !== "custom" && (
                    <span className="text-xs text-blue-500 font-mono">
                      {startDate}{startDate && endDate ? " – " : ""}{endDate}
                    </span>
                  )}
                </div>

                {/* Search + dropdowns row */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="flex gap-2 items-center flex-1">
                  <Input
                    placeholder={isEnglish ? "Search..." : "ค้นหา..."}
                    value={searchText}
                    onValueChange={setSearchText}
                    startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400 text-sm" />}
                    className="w-full sm:max-w-xs"
                    size="md"
                    variant="bordered"
                    isClearable
                    onClear={() => setSearchText("")}
                    classNames={{
                      inputWrapper: "bg-content1 border-default-200 hover:border-default-300 focus-within:!border-blue-400",
                    }}
                  />
                </div>

                <div className="flex gap-2 items-center flex-wrap">
                  {/* Category Filter */}
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        variant="bordered"
                        size="md"
                        className="min-w-28 justify-between border-default-200"
                      >
                        {category ? (categoryConfig[category]?.label || category) : (isEnglish ? "All categories" : "ทุกหมวดหมู่")}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      selectionMode="single"
                      selectedKeys={category ? new Set([category]) : new Set([])}
                      onSelectionChange={(keys) => {
                        const val = Array.from(keys)[0] as string || "";
                        setCategory(val);
                        setAction("");
                      }}
                      items={[
                        { key: "", label: isEnglish ? "All categories" : "ทุกหมวดหมู่" },
                        ...(filters?.categories || []).map((cat) => ({
                          key: cat,
                          label: categoryConfig[cat]?.label || cat,
                        })),
                      ]}
                    >
                      {(item) => <DropdownItem key={item.key}>{item.label}</DropdownItem>}
                    </DropdownMenu>
                  </Dropdown>

                  {/* Action Filter */}
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        variant="bordered"
                        size="md"
                        className="min-w-28 justify-between border-default-200"
                      >
                        {action ? (actionLabels[action] || action) : (isEnglish ? "All actions" : "ทุกการกระทำ")}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      selectionMode="single"
                      selectedKeys={action ? new Set([action]) : new Set([])}
                      onSelectionChange={(keys) => setAction(Array.from(keys)[0] as string || "")}
                      items={[
                        { key: "", label: isEnglish ? "All actions" : "ทุกการกระทำ" },
                        ...filteredActions.map((a) => ({
                          key: a.action,
                          label: actionLabels[a.action] || a.action,
                        })),
                      ]}
                    >
                      {(item) => <DropdownItem key={item.key}>{item.label}</DropdownItem>}
                    </DropdownMenu>
                  </Dropdown>

                  {/* Actor Filter */}
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        variant="bordered"
                        size="md"
                        className="min-w-28 justify-between border-default-200"
                        endContent={<Icon icon="solar:alt-arrow-down-linear" className="text-default-400 text-sm" />}
                      >
                        {actorId
                          ? (filters?.actors.find((a) => String(a.id) === actorId)?.fullName || (isEnglish ? "Actor" : "ผู้ดำเนินการ"))
                          : (isEnglish ? "Everyone" : "ทุกคน")}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      selectionMode="single"
                      selectedKeys={actorId ? new Set([actorId]) : new Set([])}
                      onSelectionChange={(keys) => setActorId(Array.from(keys)[0] as string || "")}
                      items={[
                        { key: "", label: isEnglish ? "Everyone" : "ทุกคน" },
                        ...(filters?.actors || []).map((actor) => ({
                          key: String(actor.id),
                          label: `${actor.fullName} (${getRoleLabel(actor.role)})`,
                        })),
                      ]}
                    >
                      {(item) => <DropdownItem key={item.key}>{item.label}</DropdownItem>}
                    </DropdownMenu>
                  </Dropdown>
                </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Log Table */}
          <Card className="border border-default-200 shadow-sm">
            <CardBody className="p-2">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-20">
                  <Icon icon="solar:clipboard-list-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                  <p className="text-default-500">{isEnglish ? "No activity logs yet." : "ยังไม่มีบันทึกกิจกรรม"}</p>
                </div>
              ) : viewMode === "timeline" ? (
                <div className="px-1 py-2">
                  <ActivityTimelineList
                    logs={logs}
                    isEnglish={isEnglish}
                    categoryConfig={categoryConfig}
                    actionLabels={actionLabels}
                    getRoleLabel={getRoleLabel}
                    onSelect={setSelectedLog}
                    onSubjectSelect={focusSubject}
                  />
                  <TablePaginationFooter
                    totalItems={pagination.total}
                    currentPage={pagination.page}
                    rowsPerPage={rowsPerPage}
                    totalPages={Math.max(1, pagination.totalPages)}
                    isEnglish={isEnglish}
                    nounEnglish="activity"
                    nounEnglishPlural="activities"
                    nounThai="รายการ"
                    rowsPerPageOptions={[10, 20, 30, 50]}
                    onPageChange={(nextPage) => {
                      void fetchLogs(nextPage);
                    }}
                    onRowsPerPageChange={(nextRows) => {
                      setRowsPerPage(nextRows);
                      void fetchLogs(1, nextRows);
                    }}
                  />
                </div>
              ) : (
                <div
                  ref={scrollRef}
                  data-overflow={hasOverflow ? "true" : "false"}
                  className={STICKY_SCROLL_CONTAINER_CLASS}
                >
                <Table
                  aria-label="Activity log table"
                  removeWrapper
                  classNames={{
                    base: "min-w-225",
                    th: "bg-content2 text-default-600 font-semibold text-sm whitespace-nowrap",
                    td: "py-3 whitespace-nowrap",
                    tr: "hover:bg-content2/70",
                  }}
                >
                  <TableHeader>
                    <TableColumn className="min-w-40">{isEnglish ? "Actor" : "ผู้ดำเนินการ"}</TableColumn>
                    <TableColumn className="min-w-35">{isEnglish ? "Action" : "การกระทำ"}</TableColumn>
                    <TableColumn className="min-w-25">{isEnglish ? "Category" : "หมวดหมู่"}</TableColumn>
                    <TableColumn className="min-w-37.5">{isEnglish ? "Target" : "เป้าหมาย"}</TableColumn>
                    <TableColumn className="min-w-35">{isEnglish ? "Details" : "รายละเอียด"}</TableColumn>
                    <TableColumn className="min-w-30">{isEnglish ? "Time" : "เวลา"}</TableColumn>
                    <TableColumn align="center" className={`${STICKY_ACTION_HEADER_CLASS} min-w-20`}>
                      {isEnglish ? "Detail" : "รายละเอียด"}
                    </TableColumn>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const catConf = categoryConfig[log.category] || categoryConfig.general;
                      const chipColor = categoryChipColor[log.category] || "default";
                      const { changes: changeParts, summary: detailText } = splitDetailParts(log, isEnglish);
                      const targetText = formatTarget(log, isEnglish);
                      const deviceText = formatDevice(log, isEnglish);
                      const outsiderAdmin = isOutsiderAdminView(log);
                      const systemDetected = isSystemDetectedEvent(log);

                      return (
                        <TableRow
                          key={log.id}
                          className={outsiderAdmin ? "bg-danger-50/60 dark:bg-danger-100/10" : undefined}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {systemDetected ? (
                                <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${catConf.bgClass}`}>
                                  <Icon icon="solar:shield-check-bold" width={16} className={catConf.iconClass} />
                                </div>
                              ) : (
                                <Avatar
                                  name={log.actor?.full_name || "Unknown"}
                                  size="sm"
                                  src={log.actor?.avatar || undefined}
                                  className={`shrink-0 ${catConf.bgClass} `}
                                />
                              )}
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {systemDetected
                                    ? (targetText || (isEnglish ? "Student" : "นักศึกษา"))
                                    : (log.actor?.full_name || (isEnglish ? "Unknown user" : "ไม่ทราบผู้ใช้"))}
                                </p>
                                {systemDetected ? (
                                    <span className="text-xs text-default-400">
                                      {isEnglish ? "detected by the system" : "ระบบตรวจพบ"}
                                    </span>
                                ) : (log.actor_role || log.actor?.role) === "admin" ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger-600 dark:text-danger-400">
                                        <Icon icon="solar:shield-warning-bold" width={12} />
                                        {getRoleLabel(log.actor_role || log.actor?.role)}
                                        {outsiderAdmin && (
                                          <Tooltip content={isEnglish ? "This admin is not an instructor or TA on this course." : "แอดมินคนนี้ไม่ได้เป็นอาจารย์หรือผู้ช่วยสอนในรายวิชานี้"}>
                                            <span className="rounded-md bg-danger-100 px-1 py-px text-[10px] font-semibold text-danger-700 dark:bg-danger-100/20 dark:text-danger-400">
                                              {isEnglish ? "outside course" : "นอกรายวิชา"}
                                            </span>
                                          </Tooltip>
                                        )}
                                    </span>
                                ) : (
                                    <p className="text-xs text-default-400">
                                        {getRoleLabel(log.actor_role || log.actor?.role)}
                                    </p>
                                )}
                                {log.ip_address && (
                                  <p className="text-xs text-default-300 font-mono">{log.ip_address}</p>
                                )}
                                {(log.browser || log.os) && (
                                  <p className="text-xs text-default-300">{deviceText}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip size="sm" variant="flat" color={chipColor}>
                              {actionLabels[log.action] || log.action}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Icon icon={catConf.icon} width={14} className={catConf.iconClass} />
                              <span className="text-sm text-default-600">{catConf.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {targetText ? (
                              <Tooltip
                                content={
                                  log.target_ref
                                    ? (isEnglish ? "Show everything about this" : "ดูทุกอย่างที่เกี่ยวกับรายการนี้")
                                    : targetText
                                }
                              >
                                {log.target_ref ? (
                                  <button
                                    type="button"
                                    className="block max-w-37.5 truncate text-left text-sm text-primary-600 hover:underline"
                                    onClick={() => log.target_ref && focusSubject(log.target_ref)}
                                  >
                                    {targetText}
                                  </button>
                                ) : (
                                  <span className="block max-w-37.5 truncate text-sm text-default-700">
                                    {targetText}
                                  </span>
                                )}
                              </Tooltip>
                            ) : (
                              <span className="text-default-300">-</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {changeParts.map((part) => (
                              <div key={part.key} className="mb-1 flex flex-wrap items-center gap-1 text-xs">
                                <span className="text-default-400">{part.label}</span>
                                <span className="text-default-400 line-through">{part.change?.from}</span>
                                <Icon icon="solar:arrow-right-linear" width={12} className="text-default-400" />
                                <span className={part.tone === "score" ? "font-semibold text-amber-600" : "font-medium text-success-600"}>
                                  {part.change?.to}
                                </span>
                              </div>
                            ))}
                            {detailText ? (
                              <Tooltip content={detailText} className="max-w-xs">
                                <span className="line-clamp-2 block max-w-60 text-xs text-default-500">
                                  {detailText}
                                </span>
                              </Tooltip>
                            ) : changeParts.length === 0 ? (
                              <span className="text-default-300">-</span>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Tooltip content={new Date(log.created_at).toLocaleString(isEnglish ? "en-US" : "th-TH")}>
                              <span className="whitespace-nowrap text-sm text-default-500">
                                {formatDate(log.created_at, isEnglish)}
                              </span>
                            </Tooltip>
                          </TableCell>
                          <TableCell className={STICKY_ACTION_CELL_CLASS}>
                            <Tooltip content={isEnglish ? "View full detail" : "ดูรายละเอียดทั้งหมด"}>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                aria-label={isEnglish ? "View full detail" : "ดูรายละเอียดทั้งหมด"}
                                onPress={() => setSelectedLog(log)}
                              >
                                <Icon icon="solar:document-text-linear" className="text-lg text-default-500" />
                              </Button>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <TablePaginationFooter
                  totalItems={pagination.total}
                  currentPage={pagination.page}
                  rowsPerPage={rowsPerPage}
                  totalPages={Math.max(1, pagination.totalPages)}
                  isEnglish={isEnglish}
                  nounEnglish="activity"
                  nounEnglishPlural="activities"
                  nounThai="รายการ"
                  rowsPerPageOptions={[10, 20, 30, 50]}
                  onPageChange={(nextPage) => {
                    void fetchLogs(nextPage);
                  }}
                  onRowsPerPageChange={(nextRows) => {
                    setRowsPerPage(nextRows);
                    void fetchLogs(1, nextRows);
                  }}
                />
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Summary Sub-Tab */}
      {activeSubTab === "summary" && (
        <div className="space-y-4">
          {statsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" color="primary" />
            </div>
          ) : stats ? (
            <>
              {/* Stats Cards - matching PeopleTab pattern */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card className="border border-default-200 shadow-sm">
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-100 rounded-xl">
                        <Icon icon="solar:clipboard-list-bold" className="text-2xl text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-default-500">{isEnglish ? "Total activities" : "กิจกรรมทั้งหมด"}</p>
                        <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm">
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-100 rounded-xl">
                        <Icon icon="solar:widget-bold" className="text-2xl text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-default-500">{isEnglish ? "Categories" : "หมวดหมู่"}</p>
                        <p className="text-2xl font-bold text-foreground">{stats.categoryStats.length}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm">
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-100 rounded-xl">
                        <Icon icon="solar:users-group-rounded-bold" className="text-2xl text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-default-500">{isEnglish ? "Actors" : "ผู้ดำเนินการ"}</p>
                        <p className="text-2xl font-bold text-foreground">{stats.actorStats.length}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Category Breakdown Table */}
              <Card className="border border-default-200 shadow-sm">
                <CardBody className="p-2">
                  <div className="px-3 py-2">
                    <h3 className="text-base font-semibold text-foreground">{isEnglish ? "Activity by category (last 30 days)" : "กิจกรรมตามหมวดหมู่ (30 วันล่าสุด)"}</h3>
                  </div>
                  <Table
                    aria-label="Category stats"
                    removeWrapper
                    classNames={{
                      th: "bg-content2 text-default-600 font-semibold text-sm",
                      td: "py-3",
                    }}
                  >
                    <TableHeader>
                      <TableColumn>{isEnglish ? "Category" : "หมวดหมู่"}</TableColumn>
                      <TableColumn>{isEnglish ? "Share" : "สัดส่วน"}</TableColumn>
                      <TableColumn align="end">{isEnglish ? "Count" : "จำนวน"}</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {stats.categoryStats.map((cat) => {
                        const conf = categoryConfig[cat.category] || categoryConfig.general;
                        const maxCount = Math.max(...stats.categoryStats.map((c) => Number(c.count)));
                        const pct = maxCount > 0 ? (Number(cat.count) / maxCount) * 100 : 0;
                        const progressClass = conf.bgClass.startsWith("bg-content") ? "bg-default-400" : conf.bgClass.replace("100", "400");
                        return (
                          <TableRow key={cat.category}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${conf.bgClass}`}>
                                  <Icon icon={conf.icon} width={14} className={conf.iconClass} />
                                </div>
                                <span className="text-sm font-medium text-default-700">{conf.label}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex min-w-30 items-center gap-2">
                                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-content3">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${progressClass}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-semibold text-foreground">{cat.count}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>

              {/* Top Actions Table */}
              <Card className="border border-default-200 shadow-sm">
                <CardBody className="p-2">
                  <div className="px-3 py-2">
                    <h3 className="text-base font-semibold text-foreground">{isEnglish ? "Most frequent actions (last 30 days)" : "การกระทำที่พบบ่อย (30 วันล่าสุด)"}</h3>
                  </div>
                  <Table
                    aria-label="Top actions"
                    removeWrapper
                    classNames={{
                      th: "bg-content2 text-default-600 font-semibold text-sm",
                      td: "py-3",
                    }}
                  >
                    <TableHeader>
                      <TableColumn width={40}>#</TableColumn>
                      <TableColumn>{isEnglish ? "Action" : "การกระทำ"}</TableColumn>
                      <TableColumn align="end">{isEnglish ? "Times" : "จำนวนครั้ง"}</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {stats.actionStats.slice(0, 10).map((a, idx) => (
                        <TableRow key={a.action}>
                          <TableCell>
                            <span className="text-xs text-default-400">{idx + 1}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-default-700">{actionLabels[a.action] || a.action}</span>
                          </TableCell>
                          <TableCell>
                            <Chip size="sm" variant="flat" color="primary">
                              {a.count} {isEnglish ? "times" : "ครั้ง"}
                            </Chip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>

              {/* Active Users Table */}
              <Card className="border border-default-200 shadow-sm">
                <CardBody className="p-2">
                  <div className="px-3 py-2">
                    <h3 className="text-base font-semibold text-foreground">{isEnglish ? "Active people (last 30 days)" : "ผู้ดำเนินการ (30 วันล่าสุด)"}</h3>
                  </div>
                  <Table
                    aria-label="Active users"
                    removeWrapper
                    classNames={{
                      th: "bg-content2 text-default-600 font-semibold text-sm",
                      td: "py-3",
                    }}
                  >
                    <TableHeader>
                      <TableColumn>{isEnglish ? "Full name" : "ชื่อ-นามสกุล"}</TableColumn>
                      <TableColumn>{isEnglish ? "Role" : "บทบาท"}</TableColumn>
                      <TableColumn align="end">{isEnglish ? "Activities" : "จำนวนกิจกรรม"}</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {stats.actorStats.map((actor) => (
                        <TableRow key={actor.userId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={actor.fullName}
                                size="sm"
                                src={actor.avatar || undefined}
                                className="bg-blue-100 shrink-0"
                              />
                              <span className="text-sm font-medium text-foreground">{actor.fullName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip size="sm" variant="flat" color={actor.role === "instructor" ? "primary" : "secondary"}>
                              {getRoleLabel(actor.role)}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-foreground">{actor.count} {isEnglish ? "times" : "ครั้ง"}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>
            </>
          ) : (
            <Card className="border border-default-200 shadow-sm">
              <CardBody className="py-16">
                <div className="text-center">
                  <Icon icon="solar:chart-2-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                  <p className="text-default-500">{isEnglish ? "No statistics available." : "ไม่มีข้อมูลสถิติ"}</p>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* Export Modal                                 */}
      {/* ============================================ */}
      <Modal
        isOpen={exportOpen}
        onOpenChange={setExportOpen}
        size="md"
        scrollBehavior="inside"
        classNames={{ backdrop: "bg-black/40" }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:export-bold" className="text-emerald-600 text-xl" />
                  <span>{isEnglish ? "Export activity log" : "ส่งออกบันทึกกิจกรรม"}</span>
                </div>
                <p className="text-sm font-normal text-default-500">
                  {isEnglish ? "Choose the period and grouping for your export." : "เลือกช่วงเวลาและรูปแบบการแบ่งกลุ่มที่ต้องการส่งออก"}
                </p>
              </ModalHeader>

              <ModalBody className="gap-6 py-4">
                {/* Period selector */}
                <div>
                  <p className="text-sm font-semibold text-foreground mb-3">
                    {isEnglish ? "1. Time period" : "1. ช่วงเวลาที่ต้องการส่งออก"}
                  </p>
                  <RadioGroup
                    value={exportPreset}
                    onValueChange={(v) => setExportPreset(v as ExportDatePreset)}
                    classNames={{ wrapper: "gap-2" }}
                  >
                    <Radio value="today" description={isEnglish ? fmtDate(new Date()) : new Date().toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}>
                      {isEnglish ? "Today" : "วันนี้"}
                    </Radio>
                    <Radio value="week" description={(() => { const r = getDateRangeFromPreset("week"); return `${r.start} – ${r.end}`; })()}>
                      {isEnglish ? "This week" : "สัปดาห์นี้"}
                    </Radio>
                    <Radio value="month" description={new Date().toLocaleDateString(isEnglish ? "en-US" : "th-TH", { year: "numeric", month: "long" })}>
                      {isEnglish ? "This month" : "เดือนนี้"}
                    </Radio>
                    <Radio value="year" description={String(new Date().getFullYear())}>
                      {isEnglish ? "This year" : "ปีนี้"}
                    </Radio>
                    <Radio value="custom">
                      {isEnglish ? "Custom range" : "กำหนดช่วงเวลาเอง"}
                    </Radio>
                  </RadioGroup>

                  {exportPreset === "custom" && (
                    <div className="mt-3 flex gap-3 flex-wrap pl-6">
                      <Input
                        type="date"
                        size="sm"
                        variant="bordered"
                        label={isEnglish ? "From" : "ตั้งแต่วันที่"}
                        value={exportCustomStart}
                        onValueChange={setExportCustomStart}
                        className="w-44"
                        classNames={{ inputWrapper: "bg-content1 border-default-200" }}
                      />
                      <Input
                        type="date"
                        size="sm"
                        variant="bordered"
                        label={isEnglish ? "To" : "ถึงวันที่"}
                        value={exportCustomEnd}
                        onValueChange={setExportCustomEnd}
                        className="w-44"
                        classNames={{ inputWrapper: "bg-content1 border-default-200" }}
                      />
                    </div>
                  )}
                </div>

                {/* Granularity selector */}
                <div>
                  <p className="text-sm font-semibold text-foreground mb-3">
                    {isEnglish ? "2. Group rows by" : "2. แบ่งกลุ่มข้อมูลตาม"}
                  </p>
                  <RadioGroup
                    value={exportGranularity}
                    onValueChange={(v) => setExportGranularity(v as Granularity)}
                    classNames={{ wrapper: "gap-2" }}
                  >
                    <Radio value="daily" description={isEnglish ? "One group per day" : "แยกกลุ่มรายวัน"}>
                      {isEnglish ? "Daily" : "รายวัน"}
                    </Radio>
                    <Radio value="weekly" description={isEnglish ? "One group per week" : "แยกกลุ่มรายสัปดาห์"}>
                      {isEnglish ? "Weekly" : "รายสัปดาห์"}
                    </Radio>
                    <Radio value="monthly" description={isEnglish ? "One group per month" : "แยกกลุ่มรายเดือน"}>
                      {isEnglish ? "Monthly" : "รายเดือน"}
                    </Radio>
                    <Radio value="yearly" description={isEnglish ? "One group per year" : "แยกกลุ่มรายปี"}>
                      {isEnglish ? "Yearly" : "รายปี"}
                    </Radio>
                  </RadioGroup>
                </div>

                {/* Active filters notice */}
                {(category || action || actorId || searchText || actorRole || subject || eventType) && (
                  <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1.5">
                      {isEnglish ? "3. Active filters (will be applied to export)" : "3. ตัวกรองที่ใช้งานอยู่ (จะส่งออกเฉพาะข้อมูลที่ผ่านตัวกรองนี้)"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {category && <Chip size="sm" variant="flat" color="primary">{categoryConfig[category]?.label || category}</Chip>}
                      {action && <Chip size="sm" variant="flat" color="secondary">{actionLabels[action] || action}</Chip>}
                      {actorId && <Chip size="sm" variant="flat" color="default">{filters?.actors.find((a) => String(a.id) === actorId)?.fullName || actorId}</Chip>}
                      {searchText && <Chip size="sm" variant="flat" color="warning">&ldquo;{searchText}&rdquo;</Chip>}
                      {eventType && (
                        <Chip size="sm" variant="flat" color="primary">
                          {eventType === "access"
                            ? (isEnglish ? "Views only" : "เฉพาะการเข้าดู")
                            : (isEnglish ? "Changes only" : "เฉพาะการแก้ไข")}
                        </Chip>
                      )}
                      {actorRole && <Chip size="sm" variant="flat" color="danger">{getRoleLabel(actorRole)}</Chip>}
                      {subject && <Chip size="sm" variant="flat" color="secondary">{subject.label}</Chip>}
                    </div>
                  </div>
                )}

                {/* Export info */}
                <p className="text-xs text-default-400">
                  {isEnglish
                    ? "Export format: CSV (UTF-8 with BOM for Excel compatibility). Max 10,000 rows."
                    : "รูปแบบไฟล์: CSV (UTF-8 with BOM รองรับ Excel) สูงสุด 10,000 แถว"}
                </p>
              </ModalBody>

              <ModalFooter>
                <Button variant="flat" onPress={onClose} className="text-default-600">
                  {isEnglish ? "Cancel" : "ยกเลิก"}
                </Button>
                <Button
                  color="success"
                  isLoading={exportLoading}
                  onPress={handleExport}
                  startContent={!exportLoading && <Icon icon="solar:download-bold" className="text-sm" />}
                  className="text-white"
                >
                  {exportLoading
                    ? (isEnglish ? "Exporting..." : "กำลังส่งออก...")
                    : (isEnglish ? "Export CSV" : "ส่งออก CSV")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* ============================================ */}
      {/* Detail Drill-down Modal                      */}
      {/* ============================================ */}
      <ActivityLogDetailModal
        log={selectedLog}
        isOpen={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        isEnglish={isEnglish}
        actionLabel={selectedLog ? (actionLabels[selectedLog.action] || selectedLog.action) : ""}
        categoryLabel={
          selectedLog
            ? (categoryConfig[selectedLog.category] || categoryConfig.general).label
            : ""
        }
        categoryIcon={
          selectedLog
            ? (categoryConfig[selectedLog.category] || categoryConfig.general).icon
            : "solar:info-circle-bold"
        }
        roleLabel={getRoleLabel(selectedLog?.actor_role || selectedLog?.actor?.role)}
        onSubjectSelect={focusSubject}
      />
    </div>
  );
}