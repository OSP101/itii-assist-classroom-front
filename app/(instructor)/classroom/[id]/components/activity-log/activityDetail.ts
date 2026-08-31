/**
 * Activity log detail formatting.
 *
 * The backend stores a free-form JSON `detail` per log plus a `resolved` map
 * where every foreign key it recognised has been hydrated into a named entity.
 * This module turns that pair into display parts.
 *
 * Unlike the old whitelist approach, every key in `detail` produces a part: keys
 * we know get a translated label, keys we do not get a humanised fallback. No
 * information is silently dropped.
 */

import type { ActivityLog, FieldChange, ResolvedRef } from "@/services/courseActivityLog.service";

export interface DetailPart {
  key: string;
  label: string;
  /** Flattened text, used in the compact table cell and in CSV export. */
  text: string;
  /** Resolved entities behind this key, when the value was a foreign key. */
  refs?: ResolvedRef[];
  /** Raw value, kept for the full drill-down panel. */
  raw: unknown;
  /** Highlights the part in the UI. */
  tone?: "score" | "warn" | "default";
  /**
   * Set when this part came from a before/after diff, so the UI can render the
   * two sides as "8 → 10" rather than as one flat string.
   */
  change?: { from: string; to: string };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

function keyLabels(isEnglish: boolean): Record<string, string> {
  return {
    // Scores
    score: isEnglish ? "Score" : "คะแนน",
    new_score: isEnglish ? "New score" : "คะแนนใหม่",
    max_score: isEnglish ? "Max score" : "คะแนนเต็ม",
    score_id: isEnglish ? "Score ID" : "รหัสคะแนน",
    exam_setting_id: isEnglish ? "Exam setting" : "การตั้งค่าสอบ",
    exam_date: isEnglish ? "Exam date" : "วันที่สอบ",

    // People and structure
    student_id: isEnglish ? "Student" : "นักศึกษา",
    student_ids: isEnglish ? "Students" : "นักศึกษา",
    student_count: isEnglish ? "Students" : "จำนวนนักศึกษา",
    user_id: isEnglish ? "User" : "ผู้ใช้",
    member_ids: isEnglish ? "Members" : "สมาชิก",
    instructor_ids: isEnglish ? "Instructors" : "อาจารย์ผู้สอน",
    section_id: isEnglish ? "Section" : "กลุ่มเรียน",
    section_no: isEnglish ? "Section" : "กลุ่มเรียน",
    from_section_id: isEnglish ? "From section" : "จากกลุ่มเรียน",
    to_section_id: isEnglish ? "To section" : "ไปกลุ่มเรียน",
    target_section_id: isEnglish ? "Target section" : "กลุ่มเรียนปลายทาง",
    group_id: isEnglish ? "Group" : "กลุ่ม",
    team_id: isEnglish ? "Team" : "ทีม",
    team_ids: isEnglish ? "Teams" : "ทีม",
    group_type: isEnglish ? "Group type" : "ประเภทกลุ่ม",
    created_account: isEnglish ? "New account created" : "สร้างบัญชีใหม่",

    // Assignments
    assignment_id: isEnglish ? "Assignment" : "งาน",
    assignment_type: isEnglish ? "Assignment type" : "ประเภทงาน",
    week_number: isEnglish ? "Week" : "สัปดาห์ที่",
    sub_item_count: isEnglish ? "Sub items" : "จำนวนหัวข้อย่อย",
    sub_item_scores: isEnglish ? "Sub item scores" : "คะแนนรายหัวข้อย่อย",
    replace_sub_items: isEnglish ? "Sub items replaced" : "แทนที่หัวข้อย่อยเดิม",
    score_comment: isEnglish ? "Comment" : "ความเห็น",
    linked_assignment_id: isEnglish ? "Linked assignment" : "งานที่เชื่อม",
    origin_assignment_id: isEnglish ? "Origin assignment" : "งานต้นทาง",
    ordered_ids: isEnglish ? "New order" : "ลำดับใหม่",
    sub_item_id: isEnglish ? "Sub item" : "หัวข้อย่อย",

    // Attendance
    session_ids: isEnglish ? "Attendance sessions" : "คาบเช็กชื่อ",
    attendance_session_id: isEnglish ? "Attendance session" : "คาบเช็กชื่อ",
    linked_attendance_session_id: isEnglish ? "Linked attendance" : "คาบเช็กชื่อที่เชื่อม",
    require_attendance: isEnglish ? "Attendance required" : "ต้องเช็กชื่อก่อน",
    start_time: isEnglish ? "Start time" : "เวลาเริ่ม",
    end_time: isEnglish ? "End time" : "เวลาสิ้นสุด",
    check_location: isEnglish ? "Location check" : "ตรวจสอบตำแหน่ง",
    late_threshold_minutes: isEnglish ? "Late after (minutes)" : "นับสายหลัง (นาที)",
    late_threshold_time: isEnglish ? "Late after (time)" : "นับสายหลังเวลา",
    course_section_ids: isEnglish ? "Sections" : "กลุ่มเรียน",
    invalidated: isEnglish ? "Invalidated" : "ยกเลิกผล",
    present_to_late: isEnglish ? "Present to late" : "จากมาเป็นสาย",
    late_to_present: isEnglish ? "Late to present" : "จากสายเป็นมา",
    recovered: isEnglish ? "Recovered" : "กู้คืน",
    unchanged: isEnglish ? "Unchanged" : "ไม่เปลี่ยนแปลง",

    // Queue
    queue_session_id: isEnglish ? "Queue" : "คิว",
    classroom_id: isEnglish ? "Classroom" : "ห้องเรียน",
    classroom_ids: isEnglish ? "Classrooms" : "ห้องเรียน",
    booking_type: isEnglish ? "Booking type" : "ประเภทการจอง",
    desk_id: isEnglish ? "Desk" : "โต๊ะ",
    desk_number: isEnglish ? "Desk" : "โต๊ะ",
    seat_number: isEnglish ? "Seat" : "ที่นั่ง",
    seat_count: isEnglish ? "Seats" : "จำนวนที่นั่ง",
    worker_note: isEnglish ? "Grader note" : "บันทึกผู้ตรวจ",
    reject_reason: isEnglish ? "Rejection reason" : "เหตุผลที่ปฏิเสธ",
    accept_grading: isEnglish ? "Accepts grading" : "รับตรวจงาน",
    accept_help: isEnglish ? "Accepts help requests" : "รับคำขอช่วยเหลือ",
    regenerated: isEnglish ? "Regenerated" : "สร้างใหม่",

    // Course
    code: isEnglish ? "Course code" : "รหัสวิชา",
    year: isEnglish ? "Academic year" : "ปีการศึกษา",
    semester: isEnglish ? "Semester" : "ภาคเรียน",
    attention_threshold: isEnglish ? "Attention threshold" : "เกณฑ์แจ้งเตือน",
    is_active: isEnglish ? "Active" : "เปิดใช้งาน",
    is_visible: isEnglish ? "Visible to students" : "แสดงต่อนักศึกษา",
    title: isEnglish ? "Title" : "ชื่อ",
    description: isEnglish ? "Description" : "คำอธิบาย",

    // Bulk action item lists
    added_student_ids: isEnglish ? "Students added" : "นักศึกษาที่เพิ่ม",
    moved_student_ids: isEnglish ? "Students moved" : "นักศึกษาที่ย้ายกลุ่ม",
    skipped_student_ids: isEnglish ? "Students skipped" : "นักศึกษาที่ข้าม",
    added_user_ids: isEnglish ? "People added" : "ผู้ที่เพิ่ม",
    created_team_ids: isEnglish ? "Groups created" : "กลุ่มที่สร้าง",
    deleted_team_ids: isEnglish ? "Groups deleted" : "กลุ่มที่ลบ",
    graded_scores: isEnglish ? "Scores given" : "คะแนนที่ให้",
    record_updates: isEnglish ? "Records changed" : "ระเบียนที่แก้",
    rejected_entries: isEnglish ? "Rejected rows" : "แถวที่ไม่ผ่าน",

    // Mirrored check-in events
    result: isEnglish ? "Result" : "ผลลัพธ์",
    fail_code: isEnglish ? "Failure code" : "รหัสข้อผิดพลาด",
    failed_checks: isEnglish ? "Failed guards" : "ด่านที่ไม่ผ่าน",
    email: isEnglish ? "Email" : "อีเมล",

    // Counters and outcomes
    count: isEnglish ? "Count" : "จำนวน",
    added: isEnglish ? "Added" : "เพิ่ม",
    moved: isEnglish ? "Moved" : "ย้าย",
    skipped: isEnglish ? "Skipped" : "ข้าม",
    skipped_count: isEnglish ? "Skipped" : "จำนวนที่ข้าม",
    saved: isEnglish ? "Saved" : "บันทึก",
    created: isEnglish ? "Created" : "สร้าง",
    created_count: isEnglish ? "Created" : "จำนวนที่สร้าง",
    updated: isEnglish ? "Updated" : "อัปเดต",
    deleted_count: isEnglish ? "Deleted" : "จำนวนที่ลบ",
    imported: isEnglish ? "Imported" : "นำเข้า",
    assigned: isEnglish ? "Assigned" : "จัดให้แล้ว",
    errors: isEnglish ? "Errors" : "ข้อผิดพลาด",
    image_count: isEnglish ? "Attached images" : "จำนวนรูปแนบ",

    // Read audit
    path: isEnglish ? "Endpoint" : "เส้นทางที่เรียก",
    method: isEnglish ? "HTTP method" : "เมธอด HTTP",
    is_course_member: isEnglish ? "Member of this course" : "เป็นสมาชิกรายวิชานี้",
    is_outsider_admin: isEnglish ? "Admin from outside the course" : "แอดมินที่ไม่ได้อยู่ในรายวิชา",

    // Diff
    changes: isEnglish ? "Changes" : "การเปลี่ยนแปลง",
    comment: isEnglish ? "Comment" : "ความเห็น",
    note: isEnglish ? "Note" : "หมายเหตุ",
    due_date: isEnglish ? "Due date" : "กำหนดส่ง",
    first_grade: isEnglish ? "First time graded" : "ให้คะแนนครั้งแรก",
    attendance_policy: isEnglish ? "Attendance condition" : "เงื่อนไขเช็กชื่อ",
    attendance_links: isEnglish ? "Linked attendance" : "คาบเช็กชื่อที่เชื่อม",

    // Generic
    status: isEnglish ? "Status" : "สถานะ",
    new_status: isEnglish ? "New status" : "สถานะใหม่",
    reason: isEnglish ? "Reason" : "เหตุผล",
    action: isEnglish ? "Sub action" : "การกระทำย่อย",
    source: isEnglish ? "Source" : "ที่มา",
    request_id: isEnglish ? "Request ID" : "รหัสคำขอ",
    record_id: isEnglish ? "Record ID" : "รหัสระเบียน",
  };
}

/** Enum-like values that read badly when printed raw. */
function valueLabels(isEnglish: boolean): Record<string, string> {
  return {
    "status:present": isEnglish ? "Present" : "มาเรียน",
    "status:absent": isEnglish ? "Absent" : "ขาดเรียน",
    "status:late": isEnglish ? "Late" : "มาสาย",
    "status:excused": isEnglish ? "Excused" : "ลา",
    "status:active": isEnglish ? "Active" : "เปิดอยู่",
    "status:paused": isEnglish ? "Paused" : "หยุดชั่วคราว",
    "status:closed": isEnglish ? "Closed" : "ปิดแล้ว",
    "status:pending": isEnglish ? "Pending" : "รอดำเนินการ",
    "status:approved": isEnglish ? "Approved" : "อนุมัติแล้ว",
    "status:rejected": isEnglish ? "Rejected" : "ปฏิเสธแล้ว",
    "booking_type:grading": isEnglish ? "Grading" : "ตรวจงาน",
    "booking_type:help": isEnglish ? "Help" : "ขอความช่วยเหลือ",
    "result:failed": isEnglish ? "Failed" : "เช็กชื่อไม่สำเร็จ",
    "result:network_blocked": isEnglish ? "Blocked by campus guard" : "ถูกด่านเครือข่ายปฏิเสธ",
    "result:rate_limited": isEnglish ? "Rate limited" : "พยายามถี่เกินไป",
    "assignment_type:individual": isEnglish ? "Individual" : "งานเดี่ยว",
    "assignment_type:group": isEnglish ? "Group" : "งานกลุ่ม",
    "assignment_type:weekly_group": isEnglish ? "Weekly group" : "งานกลุ่มรายสัปดาห์",
    "status:offline": isEnglish ? "Offline" : "ออฟไลน์",
    "status:online": isEnglish ? "Online" : "ออนไลน์",
    "group_type:permanent": isEnglish ? "Permanent" : "ถาวร",
    "group_type:temporary": isEnglish ? "Temporary" : "ชั่วคราว",
    "source:projector": isEnglish ? "Projector screen" : "หน้าจอฉาย",
    "action:approve": isEnglish ? "Approve" : "อนุมัติ",
    "action:reject": isEnglish ? "Reject" : "ปฏิเสธ",
  };
}

/** Entity kind prefixes, so a bare name still says what it refers to. */
function refTypeLabels(isEnglish: boolean): Record<string, string> {
  return {
    student: isEnglish ? "Student" : "นักศึกษา",
    user: isEnglish ? "User" : "ผู้ใช้",
    section: isEnglish ? "Section" : "กลุ่มเรียน",
    assignment: isEnglish ? "Assignment" : "งาน",
    sub_item: isEnglish ? "Sub item" : "หัวข้อย่อย",
    group: isEnglish ? "Group" : "กลุ่ม",
    classroom: isEnglish ? "Classroom" : "ห้องเรียน",
    exam_setting: isEnglish ? "Exam" : "การสอบ",
    attendance_session: isEnglish ? "Attendance" : "คาบเช็กชื่อ",
    queue_session: isEnglish ? "Queue" : "คิว",
  };
}

/** Values that carry no meaning for a reader and only add noise. */
const HIDDEN_KEYS = new Set(["audit_scope", "privileged_action"]);

/**
 * Detail keys holding a list of objects, where one field is a foreign key the
 * backend resolved positionally and another is the value worth reading beside
 * it. Queue grading writes sub_item_scores as [{sub_item_id, score}].
 */
const NESTED_LIST_KEYS: Record<string, { idKey: string; valueKey: string; valueLabelKey: string }> = {
  sub_item_scores: { idKey: "sub_item_id", valueKey: "score", valueLabelKey: "score" },
  graded_scores: { idKey: "student_id", valueKey: "score", valueLabelKey: "score" },
  record_updates: { idKey: "student_id", valueKey: "status", valueLabelKey: "status" },
};

/** The detail key holding the before/after diff written by the backend. */
const CHANGES_KEY = "changes";

/**
 * Suffix the backend adds when a bulk action's item list was too long to store
 * in full. It is folded into the parent key's text rather than shown as its own
 * field, so a truncated list never reads as the complete set.
 */
const TRUNCATED_SUFFIX = "_truncated";

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Keys worth keeping in the drill-down but not in the table cell. The read audit
 * records the endpoint and method on every row; repeating them in the compact
 * summary would push the part that differs off the end of the line.
 */
const COMPACT_HIDDEN_KEYS = new Set(["path", "method", "is_course_member"]);

/**
 * Compact-cell ordering. Keys listed here come first, in this order; anything
 * else keeps its natural order behind them.
 */
const PRIORITY_KEYS = [
  "is_outsider_admin",
  "changes.score",
  "changes.status",
  "student_id",
  "score",
  "new_score",
  "status",
  "new_status",
  "reason",
  "count",
  "added",
  "moved",
  "skipped",
  "saved",
  "section_no",
  "section_id",
  "assignment_id",
  "sub_item_id",
  "action",
];

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function humaniseKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function formatRef(ref: ResolvedRef, isEnglish: boolean): string {
  const label = ref.label?.trim();
  const sub = ref.sub?.trim();
  if (label && sub) return `${label} (${sub})`;
  if (label) return label;
  const typeLabel = refTypeLabels(isEnglish)[ref.type] || ref.type;
  return `${typeLabel} #${ref.id}`;
}

function asRefList(value: ResolvedRef | ResolvedRef[] | undefined): ResolvedRef[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

function formatScalar(key: string, value: unknown, isEnglish: boolean): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") {
    return value ? (isEnglish ? "Yes" : "ใช่") : (isEnglish ? "No" : "ไม่");
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const mapped = valueLabels(isEnglish)[`${key}:${value}`];
    if (mapped) return mapped;
    if (ISO_DATETIME.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString(isEnglish ? "en-US" : "th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return isEnglish ? "none" : "ไม่มี";
    return value.map((item) => formatScalar(key, item, isEnglish)).join(", ");
  }
  return JSON.stringify(value);
}

/**
 * Expands `detail.changes` into one part per changed field.
 *
 * A side that the backend resolved to an entity is shown by name; otherwise the
 * raw value is formatted the same way any other value of that field would be,
 * so a status reads "มาเรียน" on both sides rather than "present".
 */
function buildChangeParts(
  value: unknown,
  resolvedChanges: unknown,
  labels: Record<string, string>,
  isEnglish: boolean,
): DetailPart[] {
  if (!value || typeof value !== "object") return [];

  const changes = value as Record<string, FieldChange>;
  const resolvedSides = (resolvedChanges ?? {}) as Record<string, { from?: ResolvedRef; to?: ResolvedRef }>;
  const emptyLabel = isEnglish ? "(none)" : "(ไม่มี)";

  const describe = (field: string, side: unknown, ref: ResolvedRef | undefined): string => {
    if (ref) return formatRef(ref, isEnglish);
    if (side === null || side === undefined || side === "") return emptyLabel;
    return formatScalar(field, side, isEnglish);
  };

  return Object.entries(changes)
    .filter(([, pair]) => pair && typeof pair === "object")
    .map(([field, pair]) => {
      const sides = resolvedSides[field] ?? {};
      const from = describe(field, pair.from, sides.from);
      const to = describe(field, pair.to, sides.to);
      return {
        key: `${CHANGES_KEY}.${field}`,
        label: labels[field] || humaniseKey(field),
        text: `${from} → ${to}`,
        raw: pair,
        tone: field === "score" || field === "max_score" ? "score" : "default",
        change: { from, to },
      } satisfies DetailPart;
    });
}

/**
 * Turns one log's detail JSON into ordered, labelled parts. Every visible key
 * in `detail` yields exactly one part.
 */
export function buildDetailParts(log: ActivityLog, isEnglish: boolean): DetailPart[] {
  const detail = (log.detail ?? {}) as Record<string, unknown>;
  const resolved = log.resolved ?? {};
  const labels = keyLabels(isEnglish);

  const parts: DetailPart[] = [];

  // Handlers log both the new value and the diff for the same field, so the
  // plain key is dropped wherever a before/after pair already covers it. Showing
  // "Score: 10" next to "Score: 8 → 10" says the same thing twice.
  const changedFields = new Set(
    detail[CHANGES_KEY] && typeof detail[CHANGES_KEY] === "object"
      ? Object.keys(detail[CHANGES_KEY] as Record<string, unknown>)
      : [],
  );

  for (const [key, value] of Object.entries(detail)) {
    if (HIDDEN_KEYS.has(key)) continue;
    if (value === null || value === undefined || value === "") continue;
    if (key !== CHANGES_KEY && changedFields.has(key)) continue;
    if (key.endsWith(TRUNCATED_SUFFIX) && detail[key.slice(0, -TRUNCATED_SUFFIX.length)] !== undefined) continue;

    // The diff is expanded into one part per changed field, so each reads as a
    // labelled "before → after" line instead of a nested blob.
    if (key === CHANGES_KEY) {
      parts.push(...buildChangeParts(value, resolved[CHANGES_KEY], labels, isEnglish));
      continue;
    }

    const label = labels[key] || humaniseKey(key);

    // Lists of objects: pair each entry's resolved entity with its own value.
    const nested = NESTED_LIST_KEYS[key];
    if (nested && Array.isArray(value)) {
      if (value.length === 0) continue;
      const positional = (resolved[key] as unknown as (ResolvedRef | null)[] | undefined) ?? [];
      const entries = value.map((item, index) => {
        const row = (item ?? {}) as Record<string, unknown>;
        const ref = positional[index] ?? null;
        const name = ref
          ? formatRef(ref, isEnglish)
          : `${labels[nested.idKey] || humaniseKey(nested.idKey)} #${String(row[nested.idKey] ?? "?")}`;
        const entryValue = row[nested.valueKey];
        return entryValue === null || entryValue === undefined
          ? name
          : `${name}: ${formatScalar(nested.valueLabelKey, entryValue, isEnglish)}`;
      });
      const droppedEntries = detail[key + TRUNCATED_SUFFIX];
      if (typeof droppedEntries === "number" && droppedEntries > 0) {
        entries.push(isEnglish ? `+${droppedEntries} not recorded` : `อีก ${droppedEntries} รายการไม่ได้บันทึกไว้`);
      }
      parts.push({
        key,
        label,
        text: entries.join(", "),
        refs: positional.filter((ref): ref is ResolvedRef => ref !== null),
        raw: value,
        tone: "score",
      });
      continue;
    }

    const refs = asRefList(resolved[key] as ResolvedRef | ResolvedRef[] | undefined);

    let text: string;
    if (refs && refs.length > 0) {
      const shown = refs.slice(0, 3).map((ref) => formatRef(ref, isEnglish));
      const remaining = refs.length - shown.length;
      text = remaining > 0
        ? `${shown.join(", ")} ${isEnglish ? `and ${remaining} more` : `และอีก ${remaining} รายการ`}`
        : shown.join(", ");
      // An unresolved tail means some entities no longer exist; say so rather
      // than quietly showing a shorter list than the raw value implies.
      const rawCount = Array.isArray(value) ? value.length : 1;
      if (rawCount > refs.length) {
        text += isEnglish
          ? ` (${rawCount - refs.length} not found)`
          : ` (ไม่พบข้อมูล ${rawCount - refs.length} รายการ)`;
      }
    } else {
      text = formatScalar(key, value, isEnglish);
    }

    let tone: DetailPart["tone"] = "default";
    if (key === "score" || key === "new_score" || key === "max_score") tone = "score";
    if (key === "errors" || key === "reject_reason" || key === "invalidated") tone = "warn";

    const dropped = detail[key + TRUNCATED_SUFFIX];
    if (typeof dropped === "number" && dropped > 0) {
      text += isEnglish
        ? ` (+${dropped} not recorded)`
        : ` (อีก ${dropped} รายการไม่ได้บันทึกไว้)`;
    }

    parts.push({ key, label, text, refs, raw: value, tone });
  }

  const priorityOf = (key: string) => {
    const index = PRIORITY_KEYS.indexOf(key);
    return index === -1 ? PRIORITY_KEYS.length : index;
  };
  parts.sort((a, b) => priorityOf(a.key) - priorityOf(b.key));

  return parts;
}

/**
 * Splits a log's parts for the table cell: before/after pairs are rendered as
 * their own two-sided chips, everything else collapses into one summary line.
 */
export function splitDetailParts(
  log: ActivityLog,
  isEnglish: boolean,
): { changes: DetailPart[]; summary: string } {
  const parts = buildDetailParts(log, isEnglish).filter((part) => !COMPACT_HIDDEN_KEYS.has(part.key));
  const changes = parts.filter((part) => part.change !== undefined);
  const rest = parts.filter((part) => part.change === undefined);
  return { changes, summary: joinParts(rest, isEnglish, 3) };
}

/** Compact one-line summary of every part, for tooltips and CSV. */
export function buildDetailSummary(log: ActivityLog, isEnglish: boolean, maxParts = 3): string {
  const parts = buildDetailParts(log, isEnglish).filter((part) => !COMPACT_HIDDEN_KEYS.has(part.key));
  return joinParts(parts, isEnglish, maxParts);
}

function joinParts(parts: DetailPart[], isEnglish: boolean, maxParts: number): string {
  if (parts.length === 0) return "";
  const shown = parts.slice(0, maxParts).map((part) => `${part.label}: ${part.text}`);
  const remaining = parts.length - shown.length;
  if (remaining > 0) shown.push(isEnglish ? `+${remaining} more` : `+อีก ${remaining}`);
  return shown.join(" · ");
}

/** Full flattened text for CSV export. */
export function buildDetailExportText(log: ActivityLog, isEnglish: boolean): string {
  return buildDetailParts(log, isEnglish)
    .map((part) => `${part.label}=${part.text}`)
    .join("; ");
}

/**
 * True when this row records an admin who is not on the course reading its data.
 * The backend resolves membership at write time, so this stays accurate even if
 * the admin is added to the course later.
 */
export function isOutsiderAdminView(log: ActivityLog): boolean {
  const detail = log.detail as Record<string, unknown> | null | undefined;
  return detail?.is_outsider_admin === true;
}

/**
 * True when the row records something the system detected about a student
 * rather than an action by a signed-in account. Students are not user rows, so
 * these carry no actor; the student is the target instead.
 */
export function isSystemDetectedEvent(log: ActivityLog): boolean {
  return log.actor_user_id === 0;
}

/** Human label for a resolved target, falling back to the stored target name. */
export function formatTarget(log: ActivityLog, isEnglish: boolean): string {
  if (log.target_ref) return formatRef(log.target_ref, isEnglish);
  return log.target_name?.trim() || "";
}

export function getRefTypeLabel(type: string, isEnglish: boolean): string {
  return refTypeLabels(isEnglish)[type] || type;
}

/** Device summary built from the parsed user agent, for the drill-down panel. */
export function formatDevice(log: ActivityLog, isEnglish: boolean): string {
  const parts = [log.browser, log.os].filter((value) => !!value && value !== "Other");
  if (parts.length === 0) return isEnglish ? "Unknown device" : "ไม่ทราบอุปกรณ์";
  return parts.join(" · ");
}
