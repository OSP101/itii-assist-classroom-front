/**
 * Rules for creating a grading queue: what blocks saving, what deserves a
 * second look, and what is only information. The create modal runs them on
 * every change; the backend repeats the blocking ones
 * (handlers/queue_session_rules.go), so keep them in step.
 */

import type { RuleMessage } from "@/lib/attendance/session-rules";

export const QUEUE_TITLE_MAX_LENGTH = 255;
export const QUEUE_DESCRIPTION_MAX_LENGTH = 2000;
export const QUEUE_MAX_ATTENDANCE_LINKS = 30;

export interface QueueRoomOption {
    id: string;
    name: string;
    building: string;
    floor?: string;
    desks?: { is_enabled: boolean; type: string }[];
}

export interface QueueOption {
    id: string | number;
    title: string;
    status: string;
    classroom_id: string;
    linked_assignment_id?: number | null;
}

export interface QueueAttendanceOption {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    status: string;
    course_section_id?: number | null;
    course_section_ids?: number[];
    sections?: { id: number }[];
}

export interface QueueSectionOption {
    id: number;
    section_no: string;
}

export interface QueueRuleInput {
    title: string;
    description: string;
    classroomId: string;
    assignmentId: number | null;
    /** Empty means attendance is not required. */
    attendanceIds: number[];
    startNow: boolean;
}

export interface QueueRuleContext {
    rooms: QueueRoomOption[];
    queues: QueueOption[];
    assignments: { id: number; name: string }[];
    attendance: QueueAttendanceOption[];
    sections: QueueSectionOption[];
    now: Date;
}

export interface QueueStepCheck {
    messages: RuleMessage[];
    blocked: boolean;
}

export interface QueueCheck {
    details: QueueStepCheck;
    booking: QueueStepCheck;
    review: QueueStepCheck;
    /** The open queue of this course that already uses the chosen room, if any. */
    roomBusyWith: QueueOption | null;
    bad: { title?: boolean; room?: boolean; assignment?: boolean; attendance?: boolean };
}

/** Desks students can pick when booking (teacher desks are excluded). */
export function usableDeskCount(room: QueueRoomOption | undefined): number {
    return (room?.desks ?? []).filter((d) => d.is_enabled && d.type !== "teacher").length;
}

export function attendanceSectionIds(a: QueueAttendanceOption): number[] {
    if (a.course_section_ids?.length) return a.course_section_ids;
    if (a.sections?.length) return a.sections.map((s) => s.id);
    return a.course_section_id ? [a.course_section_id] : [];
}

export type AttendancePhase = "upcoming" | "open" | "ended";

export function attendancePhase(a: QueueAttendanceOption, now: Date): AttendancePhase {
    if (a.status === "closed" || new Date(a.end_time).getTime() <= now.getTime()) return "ended";
    if (new Date(a.start_time).getTime() > now.getTime()) return "upcoming";
    return "open";
}

function sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(d: Date, isEnglish: boolean): string {
    return d.toLocaleDateString(isEnglish ? "en-US" : "th-TH", { weekday: "short", day: "numeric", month: "short" });
}

function clock(d: Date, isEnglish: boolean): string {
    const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return isEnglish ? hm : `${hm} น.`;
}

export function checkQueue(input: QueueRuleInput, ctx: QueueRuleContext, isEnglish: boolean): QueueCheck {
    const t = (th: string, en: string) => (isEnglish ? en : th);
    const bad: QueueCheck["bad"] = {};
    const step = () => ({ blocks: [] as string[], warns: [] as string[], infos: [] as string[] });
    const d = step();
    const b = step();
    const r = step();
    const finish = (s: ReturnType<typeof step>): QueueStepCheck => ({
        messages: [
            ...s.blocks.map((text) => ({ tone: "block" as const, text })),
            ...s.warns.map((text) => ({ tone: "warn" as const, text })),
            ...s.infos.map((text) => ({ tone: "info" as const, text })),
        ],
        blocked: s.blocks.length > 0,
    });

    // ---- details ----
    const title = input.title.trim();
    if (!title) {
        d.blocks.push(t("กรอกชื่อคิว", "Enter a queue title."));
        bad.title = true;
    } else if (title.length > QUEUE_TITLE_MAX_LENGTH) {
        d.blocks.push(t(`ชื่อคิวยาวได้ไม่เกิน ${QUEUE_TITLE_MAX_LENGTH} ตัวอักษร`, `Keep the title within ${QUEUE_TITLE_MAX_LENGTH} characters.`));
        bad.title = true;
    }
    if (input.description.length > QUEUE_DESCRIPTION_MAX_LENGTH) {
        d.blocks.push(t(`คำอธิบายยาวได้ไม่เกิน ${QUEUE_DESCRIPTION_MAX_LENGTH} ตัวอักษร`, `Keep the description within ${QUEUE_DESCRIPTION_MAX_LENGTH} characters.`));
    }
    const room = ctx.rooms.find((x) => x.id === input.classroomId);
    if (ctx.rooms.length === 0) {
        d.blocks.push(t("ยังไม่มีห้องเรียนในระบบ ให้ผู้ดูแลระบบเพิ่มห้องก่อนสร้างคิว", "There are no classrooms yet. Ask an admin to add one first."));
        bad.room = true;
    } else if (!input.classroomId) {
        d.blocks.push(t("เลือกห้องที่ใช้ตรวจงาน", "Choose the room for this queue."));
        bad.room = true;
    } else if (!room) {
        d.blocks.push(t("ห้องที่เลือกไม่มีในระบบแล้ว เลือกห้องใหม่", "The chosen room no longer exists. Choose another."));
        bad.room = true;
    }
    const openQueues = ctx.queues.filter((q) => q.status !== "closed");
    if (title && openQueues.some((q) => q.title.trim().toLowerCase() === title.toLowerCase())) {
        d.warns.push(t(`มีคิวชื่อ "${title}" ที่ยังไม่ปิดอยู่แล้ว นักศึกษาอาจจองผิดคิว ตั้งชื่อให้ต่างกัน`, `An open queue is already called "${title}". Students may book the wrong one, so use a different name.`));
    }
    if (room && usableDeskCount(room) === 0) {
        d.warns.push(t("ห้องนี้ยังไม่มีโต๊ะที่เปิดใช้งาน นักศึกษาจะเลือกโต๊ะตอนจองไม่ได้ ให้ผู้ดูแลระบบตั้งค่าโต๊ะก่อน", "This room has no enabled desks, so students can't pick a desk when booking. Ask an admin to set up the desks."));
    }
    const roomBusyWith = room ? openQueues.find((q) => q.status === "active" && q.classroom_id === room.id) ?? null : null;
    if (roomBusyWith) {
        d.infos.push(t(`ห้องนี้มีคิว "${roomBusyWith.title}" เปิดอยู่ คิวใหม่จะเปิดได้หลังหยุดหรือปิดคิวนั้น`, `"${roomBusyWith.title}" is open in this room. The new queue can open after that one is paused or closed.`));
    }

    // ---- booking conditions ----
    if (input.assignmentId != null) {
        const assignment = ctx.assignments.find((x) => x.id === input.assignmentId);
        if (!assignment) {
            b.blocks.push(t("หัวข้องานที่เลือกไม่มีในรายวิชานี้แล้ว เลือกใหม่หรือไม่ลิงก์", "The chosen assignment is no longer in this course. Pick another or don't link one."));
            bad.assignment = true;
        } else {
            const other = openQueues.find((q) => q.linked_assignment_id === input.assignmentId);
            if (other) {
                b.warns.push(t(`งาน "${assignment.name}" ลิงก์กับคิว "${other.title}" อยู่แล้ว คะแนนจะถูกบันทึกจากทั้งสองคิว ตรวจว่าตั้งใจแบ่งตรวจหลายคิวจริง`, `"${assignment.name}" is already linked to "${other.title}". Scores will be saved from both queues, so check that you really mean to split it.`));
            }
            b.infos.push(t(`คะแนนที่ตรวจในคิวนี้จะบันทึกลงงาน "${assignment.name}" ให้เอง`, `Scores given in this queue are saved to "${assignment.name}" automatically.`));
        }
    } else {
        b.infos.push(t("ไม่ได้ลิงก์หัวข้องาน คะแนนที่ตรวจในคิวจะไม่ถูกบันทึกลงงานใด", "No assignment is linked, so scores given in this queue aren't saved to any assignment."));
    }

    if (input.attendanceIds.length > 0) {
        const chosen = input.attendanceIds.map((id) => ctx.attendance.find((x) => x.id === id));
        const found = chosen.filter((a): a is QueueAttendanceOption => !!a);
        if (found.length !== chosen.length) {
            b.blocks.push(t("รอบเช็กชื่อบางรอบที่เลือกไม่มีแล้ว เอาออกแล้วเลือกใหม่", "Some chosen attendance sessions no longer exist. Remove them and pick again."));
            bad.attendance = true;
        }
        if (input.attendanceIds.length > QUEUE_MAX_ATTENDANCE_LINKS) {
            b.blocks.push(t(`เลือกรอบเช็กชื่อได้ไม่เกิน ${QUEUE_MAX_ATTENDANCE_LINKS} รอบ`, `Choose at most ${QUEUE_MAX_ATTENDANCE_LINKS} attendance sessions.`));
            bad.attendance = true;
        }
        const upcoming = found.filter((a) => attendancePhase(a, ctx.now) === "upcoming");
        if (upcoming.length) {
            const first = upcoming.reduce((m, a) => (new Date(a.start_time) < new Date(m.start_time) ? a : m));
            const start = new Date(first.start_time);
            const names = upcoming.map((a) => `"${a.title}"`).join(", ");
            b.warns.push(upcoming.length === found.length
                ? t(
                    `ทุกรอบที่เลือกยังไม่เปิดเช็กชื่อ (รอบแรกเปิด ${dayLabel(start, false)} ${clock(start, false)}) ถ้าเปิดคิวก่อน นักศึกษาจะจองได้ก็ต่อเมื่อเช็กชื่อแล้ว`,
                    `None of the chosen sessions has opened yet (the first opens ${dayLabel(start, true)} ${clock(start, true)}). If the queue opens first, students can only book after they check in.`,
                )
                : t(
                    `รอบ ${names} ยังไม่เปิดเช็กชื่อ นักศึกษาในรอบนั้นจะจองได้หลังเช็กชื่อแล้ว`,
                    `${names} ${upcoming.length === 1 ? "hasn't" : "haven't"} opened yet. Students in ${upcoming.length === 1 ? "that session" : "those sessions"} can book once they check in.`,
                ));
        }
        const old = found.filter((a) => attendancePhase(a, ctx.now) === "ended" && !sameDay(new Date(a.start_time), ctx.now));
        if (old.length) {
            const days = Array.from(new Set(old.map((a) => dayLabel(new Date(a.start_time), isEnglish)))).join(", ");
            b.infos.push(t(`ใช้ผลเช็กชื่อที่ปิดไปแล้วของวัน ${days}`, `This uses closed sessions from ${days}.`));
        }
        // Sections are covered by the chosen sessions together; a session with
        // no section list (older data) counts as covering everyone.
        const coversAll = found.some((a) => attendanceSectionIds(a).length === 0);
        const covered = new Set(found.flatMap((a) => attendanceSectionIds(a)));
        const missing = coversAll || !found.length ? [] : ctx.sections.filter((s) => !covered.has(s.id));
        if (missing.length) {
            const list = missing.map((s) => s.section_no).join(", ");
            b.warns.push(t(
                `รอบเช็กชื่อที่เลือกไม่รวมกลุ่ม ${list} นักศึกษากลุ่มนี้จะจองคิวไม่ได้เลย เพิ่มรอบของกลุ่มนี้หรือไม่บังคับเช็กชื่อ`,
                `The chosen sessions leave out section ${list}, so those students can never book. Add a session for that section, or don't require attendance.`,
            ));
        }
        b.infos.push(found.length > 1
            ? t("จองได้ถ้ามาเรียนหรือมาสายในรอบใดรอบหนึ่งที่เลือก คนที่ขาดหรือลาทุกรอบจะจองไม่ได้", "Students marked present or late in any one of the chosen sessions can book. Those absent or on leave in all of them cannot.")
            : t("จองได้เฉพาะนักศึกษาที่มาเรียนหรือมาสายในรอบนี้ คนที่ขาดหรือลาจะจองไม่ได้", "Only students marked present or late in this session can book. Absent students and those on leave cannot."));
    }

    // ---- review ----
    if (input.startNow && roomBusyWith) {
        r.blocks.push(t(
            `เปิดให้จองทันทีไม่ได้ เพราะห้องนี้มีคิว "${roomBusyWith.title}" เปิดอยู่ เลือกเก็บเป็นฉบับร่าง หรือเปลี่ยนห้อง`,
            `It can't open right away because "${roomBusyWith.title}" is open in this room. Save it as a draft, or choose another room.`,
        ));
    }

    return { details: finish(d), booking: finish(b), review: finish(r), roomBusyWith, bad };
}

/** One reason the server refused a queue (handlers/queue_session_rules.go). */
export interface QueueSettingsProblem {
    code: string;
    message: string;
}

const PROBLEM_TEXT: Record<string, [string, string]> = {
    title_required: ["กรอกชื่อคิว", "Enter a queue title."],
    title_too_long: [`ชื่อคิวยาวได้ไม่เกิน ${QUEUE_TITLE_MAX_LENGTH} ตัวอักษร`, `Keep the title within ${QUEUE_TITLE_MAX_LENGTH} characters.`],
    description_too_long: [`คำอธิบายยาวได้ไม่เกิน ${QUEUE_DESCRIPTION_MAX_LENGTH} ตัวอักษร`, `Keep the description within ${QUEUE_DESCRIPTION_MAX_LENGTH} characters.`],
    classroom_not_found: ["ไม่พบห้องที่เลือก", "The chosen room was not found."],
    assignment_not_in_course: ["หัวข้องานที่เลือกไม่ได้อยู่ในรายวิชานี้", "The chosen assignment isn't in this course."],
    attendance_not_in_course: ["รอบเช็กชื่อที่เลือกไม่ได้อยู่ในรายวิชานี้", "A chosen attendance session isn't in this course."],
    too_many_attendance: [`เลือกรอบเช็กชื่อได้ไม่เกิน ${QUEUE_MAX_ATTENDANCE_LINKS} รอบ`, `Choose at most ${QUEUE_MAX_ATTENDANCE_LINKS} attendance sessions.`],
};

export function describeQueueProblems(problems: QueueSettingsProblem[] | undefined, isEnglish: boolean): string | undefined {
    if (!problems?.length) return undefined;
    return problems.map((p) => PROBLEM_TEXT[p.code]?.[isEnglish ? 1 : 0] ?? p.message).join(" ");
}
