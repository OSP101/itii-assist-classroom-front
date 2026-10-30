"use client";

import { useState, useEffect, useMemo, useRef, memo, type ReactNode } from "react";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import type { AssignmentType } from "../types";
import type { AttendanceSession } from "@/services/attendance.service";
import assignmentService, {
    SubItemsHaveScoresError,
    type CreateAssignmentData,
    type SubItemWithScores,
    type UpdateAssignmentData,
} from "@/services/assignment.service";
import attendanceService from "@/services/attendance.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import {
    instructorFlatButtonClass,
    instructorPrimaryButtonClass,
} from "@/components/ui/instructor-button-styles";

// assignments.max_score and assignment_sub_items.max_score are decimal(5,2).
const MAX_SCORE_LIMIT = 999.99;
// assignments.name is varchar(255).
const NAME_MAX_LENGTH = 255;

type AssignmentKind = "individual" | "permanent_group" | "weekly_group" | "assignment";
type PublishMode = "draft" | "schedule" | "now";
type StepIndex = 0 | 1 | 2 | 3;

const STEP_COUNT = 4;
const LAST_STEP: StepIndex = 3;

function formatCount(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

function formatScore(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function formatLocalizedDate(value: string, isEnglish: boolean): string {
    return new Date(value).toLocaleDateString(isEnglish ? "en-US" : "th-TH", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: isEnglish ? "numeric" : "2-digit",
    });
}

function formatLocalizedTime(value: string, isEnglish: boolean): string {
    return new Date(value).toLocaleTimeString(isEnglish ? "en-US" : "th-TH", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatPublishDateTime(date: Date, isEnglish: boolean): string {
    const locale = isEnglish ? "en-US" : "th-TH";
    const dateText = date.toLocaleDateString(locale, { dateStyle: "long" });
    const timeText = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    return isEnglish ? `${dateText} at ${timeText}` : `${dateText} เวลา ${timeText} น.`;
}

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

// <input type="date"> and <input type="time"> speak local wall-clock time.
function toDateInputValue(date: Date): string {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toTimeInputValue(date: Date): string {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function combineLocalDateTime(dateValue: string, timeValue: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) return null;
    const date = new Date(`${dateValue}T${timeValue}`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseScore(value: string): number | null {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function roundScore(value: number): number {
    return Math.round(value * 100) / 100;
}

function getLinkedAttendanceSessionIds(assignment: AssignmentType): number[] {
    if (assignment.linkedAttendanceSessions && assignment.linkedAttendanceSessions.length > 0) {
        return assignment.linkedAttendanceSessions.map((session) => session.id);
    }

    if (assignment.linkedAttendanceSession) {
        return [assignment.linkedAttendanceSession.id];
    }

    if (assignment.linked_attendance_session_id) {
        return [assignment.linked_attendance_session_id];
    }

    return [];
}

interface LocalSubItem {
    id?: number;
    name: string;
    // Kept as typed so a half-entered number ("1.", "") survives re-renders.
    max_score: string;
}

// A save the backend refused because it would destroy scores, held while the
// instructor decides whether to go ahead.
interface PendingScoreDeletion {
    subItems: SubItemWithScores[];
    totalScores: number;
}

interface AssignmentFormData {
    name: string;
    assignment_type: AssignmentKind;
    week_number?: number;
    linked_attendance_session_ids: number[];
    attendance_condition: "and" | "or";
    hasSubItems: boolean;
    subItems: LocalSubItem[];
    maxScore: string;
    dueDate: string;
    description: string;
    isScoreVisible: boolean;
    publishMode: PublishMode | null;
    publishDate: string;
    publishTime: string;
}

interface AssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
    editingAssignment: AssignmentType | null;
    onSuccess: () => void;
    weeklyTeams?: Record<number, unknown[]>;
    isCourseActive?: boolean;
}

const initialFormData: AssignmentFormData = {
    name: "",
    assignment_type: "individual",
    linked_attendance_session_ids: [],
    attendance_condition: "or",
    hasSubItems: false,
    subItems: [],
    maxScore: "10",
    dueDate: "",
    description: "",
    isScoreVisible: true,
    publishMode: null,
    publishDate: "",
    publishTime: "",
};

interface TypeOption {
    key: AssignmentKind;
    icon: string;
    label: string;
    labelEn: string;
    hint: string;
    hintEn: string;
    selectedCard: string;
    selectedIcon: string;
    chip: string;
}

const TYPE_OPTIONS: TypeOption[] = [
    {
        key: "individual",
        icon: "solar:monitor-bold",
        label: "Lab",
        labelEn: "Lab",
        hint: "งานในคาบ",
        hintEn: "In-class work",
        selectedCard: "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/12",
        selectedIcon: "bg-indigo-500 text-white",
        chip: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
    },
    {
        key: "assignment",
        icon: "solar:document-text-bold",
        label: "Assignment",
        labelEn: "Assignment",
        hint: "การบ้าน",
        hintEn: "Homework",
        selectedCard: "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-500/12",
        selectedIcon: "bg-amber-500 text-white",
        chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    },
    {
        key: "permanent_group",
        icon: "solar:users-group-rounded-bold",
        label: "กลุ่มโปรเจกต์",
        labelEn: "Project group",
        hint: "งานกลุ่มถาวร",
        hintEn: "Permanent teams",
        selectedCard: "border-purple-500 bg-purple-50 dark:border-purple-400 dark:bg-purple-500/12",
        selectedIcon: "bg-purple-500 text-white",
        chip: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200",
    },
    {
        key: "weekly_group",
        icon: "solar:calendar-bold",
        label: "กลุ่มสัปดาห์",
        labelEn: "Weekly group",
        hint: "กลุ่มรายสัปดาห์",
        hintEn: "Weekly teams",
        selectedCard: "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-500/12",
        selectedIcon: "bg-emerald-600 text-white",
        chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    },
];

interface ModeOption {
    key: PublishMode;
    icon: string;
    title: string;
    titleEn: string;
    detail: string;
    detailEn: string;
    selectedRow: string;
}

const MODE_OPTIONS: ModeOption[] = [
    {
        key: "draft",
        icon: "solar:pen-new-square-linear",
        title: "บันทึกเป็นฉบับร่าง",
        titleEn: "Save as draft",
        detail: "เก็บไว้แก้ต่อ ผู้ช่วยสอนและนักศึกษายังไม่เห็นงานนี้",
        detailEn: "Keep working on it later. Staff and students cannot see it yet.",
        selectedRow: "border-yellow-300 bg-yellow-50 dark:border-yellow-500/40 dark:bg-yellow-500/10",
    },
    {
        key: "schedule",
        icon: "solar:clock-circle-linear",
        title: "ตั้งเวลาเผยแพร่",
        titleEn: "Schedule publishing",
        detail: "เก็บเป็นฉบับร่างไว้ก่อน แล้วระบบเผยแพร่ให้ตามวันเวลาที่กำหนด",
        detailEn: "Stays a draft until the time you pick, then publishes on its own.",
        selectedRow: "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/12",
    },
    {
        key: "now",
        icon: "solar:plain-2-linear",
        title: "เผยแพร่ทันที",
        titleEn: "Publish now",
        detail: "ผู้ช่วยสอนลงคะแนนได้และนักศึกษาเห็นงานนี้ทันทีที่บันทึก",
        detailEn: "Staff can grade it and students see it as soon as you save.",
        selectedRow: "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10",
    },
];

const STEP_LABELS: { long: string; short: string; longEn: string; shortEn: string }[] = [
    { long: "ข้อมูลงาน", short: "ข้อมูลงาน", longEn: "Details", shortEn: "Details" },
    { long: "คะแนน", short: "คะแนน", longEn: "Scoring", shortEn: "Scoring" },
    { long: "เงื่อนไขเช็กชื่อ", short: "เช็กชื่อ", longEn: "Attendance rule", shortEn: "Attendance" },
    { long: "การเผยแพร่", short: "เผยแพร่", longEn: "Publishing", shortEn: "Publish" },
];

// Inputs stay at 16px on phones: the instructor zone does not lock zoom, and
// iOS Safari zooms into any smaller field on focus.
const inputClassNames = {
    inputWrapper: "bg-content1 border-default-200 data-[hover=true]:border-indigo-300 group-data-[focus=true]:!border-indigo-500",
    input: "text-base sm:text-sm",
    label: "text-sm font-medium text-default-700",
};

function FieldHint({ children }: { children: ReactNode }) {
    return <span className="font-normal text-default-500">{children}</span>;
}

function AssignmentModalComponent({
    isOpen,
    onClose,
    courseId,
    editingAssignment,
    onSuccess,
    weeklyTeams = {},
    isCourseActive = true,
}: AssignmentModalProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const isEditing = !!editingAssignment;
    const isEditingPublished = !!editingAssignment && !editingAssignment.is_draft;

    const [formData, setFormData] = useState<AssignmentFormData>(initialFormData);
    const [originalFormData, setOriginalFormData] = useState<AssignmentFormData | null>(null);
    const [step, setStep] = useState<StepIndex>(0);
    // Errors for a step stay hidden until the instructor tries to leave it, so
    // an untouched form does not open covered in red.
    const [attemptedSteps, setAttemptedSteps] = useState<boolean[]>([false, false, false, false]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [sessionsFailed, setSessionsFailed] = useState(false);
    const [pendingScoreDeletion, setPendingScoreDeletion] = useState<PendingScoreDeletion | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const stepChangedByUser = useRef(false);

    const weekOptions = useMemo(
        () => Object.keys(weeklyTeams).map(Number).filter(Number.isFinite).sort((a, b) => a - b),
        [weeklyTeams],
    );

    // Fetched on open and again every time the attendance step is entered, so a
    // session created a moment ago (even in another tab while this modal is
    // open) is in the list without reloading the page. Only the first load
    // shows a spinner; later ones swap the list in quietly.
    const isAttendanceStep = step === 2;
    const hasLoadedSessions = useRef(false);
    useEffect(() => {
        if (!isOpen) hasLoadedSessions.current = false;
    }, [isOpen]);
    useEffect(() => {
        if (!isOpen || !courseId) return;
        // Leaving the step needs no fetch; arriving at it (or opening) does.
        if (hasLoadedSessions.current && !isAttendanceStep) return;
        let cancelled = false;
        if (!hasLoadedSessions.current) setIsLoadingSessions(true);
        setSessionsFailed(false);
        attendanceService
            .getSessions(courseId)
            .then((sessions) => {
                if (cancelled) return;
                setAttendanceSessions(sessions);
                hasLoadedSessions.current = true;
            })
            .catch((error) => {
                console.error("Failed to fetch attendance sessions:", error);
                if (!cancelled) setSessionsFailed(true);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingSessions(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, courseId, isAttendanceStep]);

    useEffect(() => {
        if (!isOpen) return;
        setPendingScoreDeletion(null);
        setStep(0);
        setAttemptedSteps([false, false, false, false]);
        stepChangedByUser.current = false;

        if (!editingAssignment) {
            setFormData(initialFormData);
            setOriginalFormData(null);
            return;
        }

        const publishAt = editingAssignment.publish_at ? new Date(editingAssignment.publish_at) : null;
        const hasValidPublishAt = !!publishAt && !Number.isNaN(publishAt.getTime());
        const populated: AssignmentFormData = {
            name: editingAssignment.name,
            assignment_type: editingAssignment.assignment_type,
            week_number: editingAssignment.week_number,
            linked_attendance_session_ids: getLinkedAttendanceSessionIds(editingAssignment),
            attendance_condition: editingAssignment.attendance_condition || "or",
            hasSubItems: !!(editingAssignment.subItems && editingAssignment.subItems.length > 0),
            subItems: editingAssignment.subItems?.map((s) => ({
                id: s.id,
                name: s.name,
                max_score: formatScore(Number(s.max_score)),
            })) || [],
            maxScore: formatScore(Number(editingAssignment.max_score)),
            dueDate: editingAssignment.due_date || "",
            description: editingAssignment.description || "",
            isScoreVisible: editingAssignment.is_score_visible !== false,
            publishMode: editingAssignment.is_draft ? (hasValidPublishAt ? "schedule" : "draft") : null,
            publishDate: hasValidPublishAt && publishAt ? toDateInputValue(publishAt) : "",
            publishTime: hasValidPublishAt && publishAt ? toTimeInputValue(publishAt) : "",
        };
        setFormData(populated);
        setOriginalFormData(populated);
    }, [isOpen, editingAssignment]);

    // A new step starts at its top, and screen-reader focus moves to its heading.
    useEffect(() => {
        contentRef.current?.scrollTo({ top: 0 });
        if (stepChangedByUser.current) {
            headingRef.current?.focus({ preventScroll: true });
        }
    }, [step]);

    const update = (patch: Partial<AssignmentFormData>) => setFormData((prev) => ({ ...prev, ...patch }));

    // ------------------------------------------------------------------
    // Derived values and validation
    // ------------------------------------------------------------------

    const trimmedName = formData.name.trim();
    const singleMaxScore = parseScore(formData.maxScore);
    const subItemScores = formData.subItems.map((item) => parseScore(item.max_score));
    const subItemTotal = roundScore(subItemScores.reduce<number>((sum, value) => sum + (value ?? 0), 0));
    const effectiveMaxScore = formData.hasSubItems ? subItemTotal : (singleMaxScore ?? 0);
    const linkedCount = formData.linked_attendance_session_ids.length;
    const scheduledAt = formData.publishMode === "schedule"
        ? combineLocalDateTime(formData.publishDate, formData.publishTime)
        : null;

    const nameError = !trimmedName
        ? (isEnglish ? "Enter an assignment name." : "กรอกชื่องาน")
        : trimmedName.length > NAME_MAX_LENGTH
            ? (isEnglish ? `Keep the name within ${NAME_MAX_LENGTH} characters.` : `ชื่องานยาวได้ไม่เกิน ${NAME_MAX_LENGTH} ตัวอักษร`)
            : null;

    const weekError = formData.assignment_type !== "weekly_group"
        ? null
        : weekOptions.length === 0
            ? (isEnglish ? "Create weekly groups first." : "กรุณาสร้างกลุ่มประจำสัปดาห์ก่อน")
            : !formData.week_number
                ? (isEnglish ? "Choose the week." : "เลือกสัปดาห์")
                : null;

    const scoreRangeText = isEnglish
        ? `Must be more than 0 and at most ${MAX_SCORE_LIMIT}.`
        : `ต้องมากกว่า 0 และไม่เกิน ${MAX_SCORE_LIMIT}`;

    const maxScoreError = formData.hasSubItems
        ? null
        : singleMaxScore === null || singleMaxScore <= 0 || singleMaxScore > MAX_SCORE_LIMIT
            ? scoreRangeText
            : null;

    const subItemErrors = formData.subItems.map((item, index) => {
        const value = subItemScores[index];
        return {
            name: item.name.trim() ? null : (isEnglish ? "Name this item." : "ตั้งชื่อข้อย่อย"),
            score: value === null || value < 0 || value > MAX_SCORE_LIMIT
                ? (isEnglish ? `0 to ${MAX_SCORE_LIMIT}` : `0 ถึง ${MAX_SCORE_LIMIT}`)
                : null,
        };
    });

    const subTotalError = !formData.hasSubItems
        ? null
        : formData.subItems.length === 0
            ? (isEnglish ? "Add at least one item." : "เพิ่มข้อย่อยอย่างน้อย 1 ข้อ")
            : subItemTotal <= 0 || subItemTotal > MAX_SCORE_LIMIT
                ? (isEnglish ? `The total ${scoreRangeText.toLowerCase()}` : `คะแนนรวม${scoreRangeText}`)
                : null;

    const modeError = !isEditingPublished && !formData.publishMode
        ? (isEnglish ? "Choose how to save this assignment." : "เลือกวิธีบันทึกงานนี้")
        : null;

    const scheduleError = formData.publishMode !== "schedule"
        ? null
        : !scheduledAt
            ? (isEnglish ? "Pick the date and time." : "เลือกวันที่และเวลาเผยแพร่")
            : scheduledAt.getTime() <= Date.now()
                ? (isEnglish ? "Pick a time in the future." : "เวลาเผยแพร่ต้องเป็นเวลาในอนาคต")
                : null;

    const stepValid: boolean[] = [
        !nameError && !weekError,
        !maxScoreError && !subTotalError && subItemErrors.every((e) => !e.name && !e.score),
        true,
        !modeError && !scheduleError,
    ];

    const showErrors = (index: StepIndex) => attemptedSteps[index];

    const hasFormChanges = useMemo(() => {
        if (!originalFormData) return true;
        return JSON.stringify(formData) !== JSON.stringify(originalFormData);
    }, [formData, originalFormData]);

    const isDirty = isEditing ? hasFormChanges : JSON.stringify(formData) !== JSON.stringify(initialFormData);

    const typeOption = TYPE_OPTIONS.find((option) => option.key === formData.assignment_type) ?? TYPE_OPTIONS[0];
    const modeOption = MODE_OPTIONS.find((option) => option.key === formData.publishMode) ?? null;

    const attendanceNote = linkedCount === 0
        ? (isEnglish ? "Not linked. Every student can receive a score." : "ไม่ผูกกับการเช็กชื่อ นักศึกษาทุกคนลงคะแนนได้")
        : linkedCount === 1
            ? (isEnglish ? "Students absent from this session cannot receive a score." : "นักศึกษาที่ขาดเรียนในรอบนี้จะลงคะแนนไม่ได้")
            : formData.attendance_condition === "or"
                ? (isEnglish
                    ? `Students absent from all ${linkedCount} sessions cannot receive a score.`
                    : `นักศึกษาที่ขาดเรียนทั้ง ${linkedCount} รอบจะลงคะแนนไม่ได้`)
                : (isEnglish
                    ? `Students must attend all ${linkedCount} sessions to receive a score.`
                    : `นักศึกษาต้องมาเรียนครบทั้ง ${linkedCount} รอบจึงจะลงคะแนนได้`);

    const attendanceShort = linkedCount === 0
        ? (isEnglish ? "Not linked" : "ไม่ผูก")
        : linkedCount === 1
            ? (isEnglish ? "1 session required" : "ต้องมาเรียน 1 รอบ")
            : formData.attendance_condition === "or"
                ? (isEnglish ? `At least 1 of ${linkedCount}` : `อย่างน้อย 1 จาก ${linkedCount} รอบ`)
                : (isEnglish ? `All ${linkedCount} sessions` : `ครบทั้ง ${linkedCount} รอบ`);

    const scoreSummary = formData.hasSubItems
        ? (isEnglish
            ? `${formatScore(subItemTotal)} points (${formatCount(formData.subItems.length, "item", "items")})`
            : `${formatScore(subItemTotal)} คะแนน (${formData.subItems.length} ข้อย่อย)`)
        : (isEnglish ? `${formatScore(singleMaxScore ?? 0)} points` : `${formatScore(singleMaxScore ?? 0)} คะแนน`);

    const statusChip = isEditingPublished
        ? { label: isEnglish ? "Published" : "เผยแพร่แล้ว", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200" }
        : formData.publishMode === "draft"
            ? { label: isEnglish ? "Draft" : "ฉบับร่าง", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200" }
            : formData.publishMode === "schedule"
                ? { label: isEnglish ? "Scheduled" : "ตั้งเวลา", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200" }
                : formData.publishMode === "now"
                    ? { label: isEnglish ? "Publish now" : "เผยแพร่ทันที", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200" }
                    : { label: isEnglish ? "Not saved" : "ยังไม่บันทึก", className: "bg-default-100 text-default-700" };

    const statusBox = (() => {
        if (isEditingPublished) {
            return {
                title: isEnglish ? "Published" : "เผยแพร่แล้ว",
                detail: isEnglish
                    ? "Changes apply right away. A published assignment cannot go back to draft."
                    : "การแก้ไขมีผลทันที งานที่เผยแพร่แล้วย้อนกลับเป็นฉบับร่างไม่ได้",
                className: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
            };
        }
        if (!modeOption) {
            return {
                title: isEnglish ? "How to save is not chosen yet" : "ยังไม่ได้เลือกวิธีเผยแพร่",
                detail: isEnglish ? "You choose it in the last step." : "เลือกได้ในขั้นสุดท้าย",
                className: "border-default-200 bg-default-50 text-default-700",
            };
        }
        const detail = modeOption.key === "schedule"
            ? (scheduledAt
                ? (isEnglish ? `Publishes ${formatPublishDateTime(scheduledAt, true)}` : `เผยแพร่ ${formatPublishDateTime(scheduledAt, false)}`)
                : (isEnglish ? "Pick the date and time in the last step." : "เลือกวันที่และเวลาในขั้นสุดท้าย"))
            : (isEnglish ? modeOption.detailEn : modeOption.detail);
        return {
            title: isEnglish ? modeOption.titleEn : modeOption.title,
            detail,
            className: modeOption.key === "draft"
                ? "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-100"
                : modeOption.key === "schedule"
                    ? "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
        };
    })();

    // ------------------------------------------------------------------
    // Navigation
    // ------------------------------------------------------------------

    const markAttempted = (index: number) =>
        setAttemptedSteps((prev) => prev.map((value, i) => (i === index ? true : value)));

    const moveTo = (target: StepIndex) => {
        stepChangedByUser.current = true;
        setStep(target);
    };

    // Going back is always free. Going forward stops at the first earlier step
    // that is still incomplete, so nothing is skipped by jumping ahead.
    const goToStep = (target: StepIndex) => {
        if (target <= step) {
            moveTo(target);
            return;
        }
        for (let index = 0; index < target; index += 1) {
            if (!stepValid[index]) {
                markAttempted(index);
                moveTo(index as StepIndex);
                return;
            }
        }
        moveTo(target);
    };

    // ------------------------------------------------------------------
    // Saving
    // ------------------------------------------------------------------

    const buildSubItems = () =>
        formData.subItems.map((item, index) => ({
            id: item.id,
            name: item.name.trim(),
            max_score: roundScore(parseScore(item.max_score) ?? 0),
            order_index: index,
        }));

    const persistAssignment = async (confirmDeleteScores: boolean) => {
        setIsSubmitting(true);
        const mode: PublishMode = isEditingPublished ? "now" : (formData.publishMode ?? "draft");
        const isDraft = mode !== "now";
        const publishAtIso = mode === "schedule" && scheduledAt ? scheduledAt.toISOString() : undefined;
        const hadPublishAt = !!editingAssignment?.publish_at;
        const linkedIds = formData.linked_attendance_session_ids;
        const common = {
            name: trimmedName,
            assignment_type: formData.assignment_type,
            week_number: formData.assignment_type === "weekly_group" ? formData.week_number : undefined,
            linked_attendance_session_ids: linkedIds,
            attendance_condition: linkedIds.length > 1 ? formData.attendance_condition : undefined,
            max_score: roundScore(effectiveMaxScore),
            due_date: formData.dueDate || undefined,
            is_score_visible: formData.isScoreVisible,
            is_draft: isDraft,
            publish_at: publishAtIso,
        };

        try {
            let result;
            if (editingAssignment) {
                const payload: UpdateAssignmentData = {
                    ...common,
                    // Sent even when empty so a cleared description is cleared.
                    description: formData.description.trim(),
                    sub_items: formData.hasSubItems ? buildSubItems() : undefined,
                    clear_publish_at: !publishAtIso && hadPublishAt ? true : undefined,
                    confirm_delete_scores: confirmDeleteScores || undefined,
                };
                result = await assignmentService.updateAssignment(editingAssignment.id, payload);
            } else {
                const payload: CreateAssignmentData = {
                    ...common,
                    course_id: courseId,
                    description: formData.description.trim() || undefined,
                    sub_items: formData.hasSubItems
                        ? buildSubItems().map(({ name, max_score, order_index }) => ({ name, max_score, order_index }))
                        : undefined,
                };
                result = await assignmentService.createAssignment(payload);
            }

            if (!result) {
                throw new Error(isEnglish ? "Unable to save the assignment." : "ไม่สามารถบันทึกงานได้");
            }

            setPendingScoreDeletion(null);
            const description = (() => {
                if (isEditingPublished) return isEnglish ? "Assignment updated." : "แก้ไขงานเรียบร้อย";
                if (mode === "schedule" && scheduledAt) {
                    return isEnglish
                        ? `Scheduled to publish ${formatPublishDateTime(scheduledAt, true)}.`
                        : `ตั้งเวลาเผยแพร่ ${formatPublishDateTime(scheduledAt, false)} เรียบร้อย`;
                }
                if (mode === "draft") {
                    return isEditing
                        ? (isEnglish ? "Draft saved." : "บันทึกฉบับร่างเรียบร้อย")
                        : (isEnglish ? "Draft created." : "สร้างฉบับร่างเรียบร้อย");
                }
                return isEditing
                    ? (isEnglish ? "Assignment published." : "เผยแพร่งานเรียบร้อย")
                    : (isEnglish ? "Assignment created and published." : "สร้างและเผยแพร่งานเรียบร้อย");
            })();
            addToast({
                title: isEnglish ? "Saved" : "สำเร็จ",
                description,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            onSuccess();
            onClose();
        } catch (error: unknown) {
            // Not a failure: the backend is asking whether the scores may go.
            if (error instanceof SubItemsHaveScoresError) {
                setPendingScoreDeletion({ subItems: error.subItems, totalScores: error.totalScores });
                return;
            }
            console.error("Failed to save assignment:", error);
            const message = error instanceof Error && error.message ? error.message : null;
            addToast({
                title: isEnglish ? "Could not save" : "บันทึกไม่สำเร็จ",
                description: isEnglish
                    ? "The assignment was not saved. Check your connection and try again."
                    : (message || "ไม่สามารถบันทึกงานได้ ลองใหม่อีกครั้ง"),
                color: "danger",
                timeout: 4000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;
        const firstInvalid = stepValid.findIndex((valid) => !valid);
        if (firstInvalid !== -1) {
            markAttempted(firstInvalid);
            moveTo(firstInvalid as StepIndex);
            return;
        }
        await persistAssignment(false);
    };

    const handlePrimary = () => {
        if (step < LAST_STEP) {
            if (!stepValid[step]) {
                markAttempted(step);
                return;
            }
            goToStep((step + 1) as StepIndex);
            return;
        }
        void handleSubmit();
    };

    const handleConfirmScoreDeletion = async () => {
        if (!pendingScoreDeletion) return;
        setPendingScoreDeletion(null);
        await persistAssignment(true);
    };

    const isLastStep = step === LAST_STEP;
    const saveBlockedByCourse = !isCourseActive;
    const saveBlockedByNoChanges = isEditing && !hasFormChanges;

    const primaryLabel = !isLastStep
        ? (isEnglish ? "Next" : "ถัดไป")
        : isEditingPublished
            ? (isEnglish ? "Save changes" : "บันทึกการแก้ไข")
            : formData.publishMode === "draft"
                ? (isEnglish ? "Save draft" : "บันทึกฉบับร่าง")
                : formData.publishMode === "schedule"
                    ? (isEnglish ? "Schedule" : "ตั้งเวลาเผยแพร่")
                    : formData.publishMode === "now"
                        ? (isEditing ? (isEnglish ? "Save and publish" : "บันทึกและเผยแพร่") : (isEnglish ? "Publish" : "เผยแพร่งาน"))
                        : (isEnglish ? "Choose how to save" : "เลือกวิธีบันทึกก่อน");

    const primaryClassName = !isLastStep
        ? instructorPrimaryButtonClass("min-w-28")
        : isEditingPublished || formData.publishMode === "now"
            ? instructorFlatButtonClass("min-w-28 bg-emerald-700 text-white data-[hover=true]:bg-emerald-800")
            : formData.publishMode === "draft"
                ? instructorFlatButtonClass("min-w-28 bg-yellow-200 text-yellow-900 data-[hover=true]:bg-yellow-300 dark:bg-yellow-400 dark:text-yellow-950")
                : formData.publishMode === "schedule"
                    ? instructorFlatButtonClass("min-w-28 bg-indigo-600 text-white data-[hover=true]:bg-indigo-700")
                    : instructorFlatButtonClass("min-w-28");

    const primaryDisabled = isLastStep && (
        saveBlockedByCourse
        || saveBlockedByNoChanges
        || (!isEditingPublished && !formData.publishMode)
    );

    const footerHint = isLastStep && saveBlockedByCourse
        ? (isEnglish ? "This course is closed, so changes cannot be saved." : "รายวิชานี้ปิดแล้ว บันทึกการเปลี่ยนแปลงไม่ได้")
        : isLastStep && saveBlockedByNoChanges
            ? (isEnglish ? "Nothing has changed yet." : "ยังไม่มีการเปลี่ยนแปลง")
            : (isEnglish ? `Step ${step + 1} of ${STEP_COUNT}` : `ขั้นที่ ${step + 1} จาก ${STEP_COUNT}`);

    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    const stepHeading = (title: string, detail: string) => (
        <div className="space-y-1">
            <h3
                ref={headingRef}
                tabIndex={-1}
                className="text-[1.375rem] font-semibold leading-tight text-foreground outline-none sm:text-2xl"
            >
                {title}
            </h3>
            <p className="max-w-[65ch] text-sm leading-relaxed text-default-600">{detail}</p>
        </div>
    );

    const inlineError = (message: string | null) =>
        message ? (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-danger-600 dark:text-danger-400">
                <Icon icon="solar:danger-circle-linear" className="shrink-0" aria-hidden="true" />
                {message}
            </p>
        ) : null;

    const renderDetailsStep = () => (
        <div className="flex flex-col gap-6">
            {stepHeading(
                isEnglish ? "Assignment details" : "ข้อมูลงาน",
                isEditing
                    ? (isEnglish ? "The type was set when the assignment was created and cannot change." : "ประเภทงานกำหนดไว้ตอนสร้างและเปลี่ยนไม่ได้")
                    : (isEnglish ? "Name the assignment and choose its type. The type cannot change later." : "ตั้งชื่องานและเลือกประเภท ประเภทงานแก้ภายหลังไม่ได้"),
            )}

            <Input
                label={<>{isEnglish ? "Assignment name" : "ชื่องาน"} <FieldHint>{isEnglish ? "(required)" : "(ต้องระบุ)"}</FieldHint></>}
                labelPlacement="outside"
                placeholder={isEnglish ? "e.g. Lab 1, Quiz 1, Group project" : "เช่น งานที่ 1, Quiz 1, โปรเจกต์กลุ่ม"}
                variant="bordered"
                value={formData.name}
                maxLength={NAME_MAX_LENGTH}
                onValueChange={(value) => update({ name: value })}
                isInvalid={showErrors(0) && !!nameError}
                errorMessage={showErrors(0) ? nameError ?? undefined : undefined}
                classNames={inputClassNames}
                autoComplete="off"
            />

            <fieldset className="space-y-2.5">
                <legend className="mb-2.5 text-sm font-medium text-default-700">
                    {isEnglish ? "Assignment type" : "ประเภทงาน"}
                </legend>
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                    {TYPE_OPTIONS.map((option) => {
                        const selected = formData.assignment_type === option.key;
                        return (
                            <button
                                key={option.key}
                                type="button"
                                aria-pressed={selected}
                                disabled={isEditing}
                                onClick={() => update({
                                    assignment_type: option.key,
                                    week_number: option.key === "weekly_group"
                                        ? (formData.week_number ?? weekOptions[weekOptions.length - 1])
                                        : undefined,
                                })}
                                className={`flex min-h-[7.25rem] flex-col items-start gap-1 rounded-2xl border-2 p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:p-4 ${
                                    selected
                                        ? option.selectedCard
                                        : "border-default-200 bg-content1 hover:border-default-300"
                                } ${isEditing ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                            >
                                <span className={`mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl ${selected ? option.selectedIcon : "bg-default-100 text-default-500"}`}>
                                    <Icon icon={option.icon} className="text-xl" aria-hidden="true" />
                                </span>
                                <span className="text-[0.9375rem] font-semibold text-foreground">{isEnglish ? option.labelEn : option.label}</span>
                                <span className="text-[0.8125rem] text-default-600">{isEnglish ? option.hintEn : option.hint}</span>
                            </button>
                        );
                    })}
                </div>
            </fieldset>

            {formData.assignment_type === "weekly_group" && (
                <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    {weekOptions.length > 0 ? (
                        <Select
                            label={<>{isEnglish ? "Week" : "สัปดาห์ที่"} <FieldHint>{isEnglish ? "(required)" : "(ต้องระบุ)"}</FieldHint></>}
                            labelPlacement="outside"
                            placeholder={isEnglish ? "Select week" : "เลือกสัปดาห์"}
                            selectedKeys={formData.week_number ? [String(formData.week_number)] : []}
                            onSelectionChange={(keys) => {
                                const value = Array.from(keys)[0];
                                if (value !== undefined) update({ week_number: Number(value) });
                            }}
                            variant="bordered"
                            isInvalid={showErrors(0) && !!weekError}
                            errorMessage={showErrors(0) ? weekError ?? undefined : undefined}
                            classNames={{ trigger: "bg-content1 border-default-200", value: "text-base sm:text-sm text-foreground", label: "text-sm font-medium text-default-700" }}
                        >
                            {weekOptions.map((weekNum) => (
                                <SelectItem key={String(weekNum)} textValue={isEnglish ? `Week ${weekNum}` : `สัปดาห์ที่ ${weekNum}`}>
                                    <div className="flex w-full items-center justify-between gap-3">
                                        <span>{isEnglish ? `Week ${weekNum}` : `สัปดาห์ที่ ${weekNum}`}</span>
                                        <span className="text-xs text-default-500">
                                            {isEnglish
                                                ? formatCount(weeklyTeams[weekNum]?.length || 0, "group", "groups")
                                                : `${weeklyTeams[weekNum]?.length || 0} กลุ่ม`}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </Select>
                    ) : (
                        <div className="flex items-start gap-2.5 text-sm text-emerald-900 dark:text-emerald-100">
                            <Icon icon="solar:info-circle-linear" className="mt-0.5 shrink-0 text-lg" aria-hidden="true" />
                            <div>
                                <p className="font-medium">{isEnglish ? "No weekly groups yet" : "ยังไม่มีกลุ่มประจำสัปดาห์"}</p>
                                <p>{isEnglish ? "Create weekly groups first, then come back to this assignment." : "กรุณาสร้างกลุ่มประจำสัปดาห์ก่อน แล้วค่อยกลับมาสร้างงานนี้"}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Textarea
                label={<>{isEnglish ? "Additional details" : "รายละเอียดเพิ่มเติม"} <FieldHint>{isEnglish ? "(optional)" : "(ไม่บังคับ)"}</FieldHint></>}
                labelPlacement="outside"
                placeholder={isEnglish ? "Tell students what this assignment asks of them" : "บอกนักศึกษาว่างานนี้ต้องทำอะไร"}
                variant="bordered"
                minRows={3}
                maxRows={8}
                value={formData.description}
                onValueChange={(value) => update({ description: value })}
                classNames={inputClassNames}
            />
        </div>
    );

    const renderScoringStep = () => (
        <div className="flex flex-col gap-6">
            {stepHeading(
                isEnglish ? "Scoring" : "คะแนน",
                isEditing
                    ? (isEnglish ? "The score format was set when the assignment was created. Item names and points can still change." : "รูปแบบคะแนนกำหนดไว้ตอนสร้าง แก้ชื่อและคะแนนของข้อย่อยได้")
                    : (isEnglish ? "Choose how this assignment is scored. The format cannot change later." : "เลือกรูปแบบการให้คะแนน รูปแบบคะแนนแก้ภายหลังไม่ได้"),
            )}

            <fieldset>
                <legend className="mb-2.5 text-sm font-medium text-default-700">{isEnglish ? "Score format" : "รูปแบบคะแนน"}</legend>
                <div className="grid gap-2.5 sm:grid-cols-2">
                    {[
                        {
                            sub: false,
                            icon: "solar:document-linear",
                            title: isEnglish ? "Single score" : "คะแนนเดียว",
                            detail: isEnglish ? "One total score for the assignment" : "ให้คะแนนรวมทั้งงาน",
                        },
                        {
                            sub: true,
                            icon: "solar:checklist-minimalistic-linear",
                            title: isEnglish ? "Sub-items" : "มีข้อย่อย",
                            detail: isEnglish ? "Several graded items, totalled for you" : "แบ่งเป็นหลายข้อ รวมคะแนนเต็มให้อัตโนมัติ",
                        },
                    ].map((option) => {
                        const selected = formData.hasSubItems === option.sub;
                        return (
                            <button
                                key={String(option.sub)}
                                type="button"
                                aria-pressed={selected}
                                disabled={isEditing}
                                onClick={() => update(option.sub
                                    ? {
                                        hasSubItems: true,
                                        subItems: formData.subItems.length > 0
                                            ? formData.subItems
                                            : [{ name: isEnglish ? "Item 1" : "ข้อ 1", max_score: "10" }],
                                    }
                                    : { hasSubItems: false, subItems: [] })}
                                className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                                    selected
                                        ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/12"
                                        : "border-default-200 bg-content1 hover:border-default-300"
                                } ${isEditing ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                            >
                                <Icon icon={option.icon} className={`shrink-0 text-2xl ${selected ? "text-indigo-600 dark:text-indigo-300" : "text-default-500"}`} aria-hidden="true" />
                                <span>
                                    <span className="block text-[0.9375rem] font-semibold text-foreground">{option.title}</span>
                                    <span className="text-[0.8125rem] text-default-600">{option.detail}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </fieldset>

            {!formData.hasSubItems ? (
                <Input
                    type="number"
                    inputMode="decimal"
                    label={<>{isEnglish ? "Max score" : "คะแนนเต็ม"} <FieldHint>{isEnglish ? "(required)" : "(ต้องระบุ)"}</FieldHint></>}
                    labelPlacement="outside"
                    placeholder={isEnglish ? "e.g. 10, 20, 100" : "เช่น 10, 20, 100"}
                    variant="bordered"
                    min={0}
                    max={MAX_SCORE_LIMIT}
                    step="any"
                    value={formData.maxScore}
                    onValueChange={(value) => update({ maxScore: value })}
                    isInvalid={showErrors(1) && !!maxScoreError}
                    errorMessage={showErrors(1) ? maxScoreError ?? undefined : undefined}
                    endContent={<span className="text-sm text-default-500">{isEnglish ? "points" : "คะแนน"}</span>}
                    className="max-w-xs"
                    classNames={inputClassNames}
                />
            ) : (
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-default-700">
                            {isEnglish
                                ? `Sub-items (${formatCount(formData.subItems.length, "item", "items")})`
                                : `ข้อย่อย (${formData.subItems.length} ข้อ)`}
                        </span>
                        <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-900 tabular-nums dark:bg-amber-500/20 dark:text-amber-100">
                            {isEnglish ? `Total ${formatScore(subItemTotal)} points` : `รวม ${formatScore(subItemTotal)} คะแนน`}
                        </Chip>
                    </div>
                    <ol className="space-y-2">
                        {formData.subItems.map((subItem, index) => {
                            const errors = subItemErrors[index];
                            return (
                                <li
                                    key={subItem.id ?? `new-${index}`}
                                    className="flex items-start gap-2 rounded-2xl border border-default-200 bg-default-50 p-2 sm:gap-3 sm:p-2.5"
                                >
                                    <span className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[0.8125rem] font-semibold text-indigo-800 tabular-nums dark:bg-indigo-500/20 dark:text-indigo-200">
                                        {index + 1}
                                    </span>
                                    <Input
                                        aria-label={isEnglish ? `Name of item ${index + 1}` : `ชื่อข้อย่อยที่ ${index + 1}`}
                                        placeholder={isEnglish ? "Item name" : "ชื่อข้อย่อย"}
                                        variant="bordered"
                                        value={subItem.name}
                                        maxLength={NAME_MAX_LENGTH}
                                        onValueChange={(value) => update({
                                            subItems: formData.subItems.map((s, i) => (i === index ? { ...s, name: value } : s)),
                                        })}
                                        isInvalid={showErrors(1) && !!errors?.name}
                                        errorMessage={showErrors(1) ? errors?.name ?? undefined : undefined}
                                        className="min-w-0 flex-1"
                                        classNames={inputClassNames}
                                    />
                                    <Input
                                        type="number"
                                        inputMode="decimal"
                                        aria-label={isEnglish ? `Points for item ${index + 1}` : `คะแนนเต็มข้อที่ ${index + 1}`}
                                        placeholder="0"
                                        variant="bordered"
                                        min={0}
                                        max={MAX_SCORE_LIMIT}
                                        step="any"
                                        value={subItem.max_score}
                                        onValueChange={(value) => update({
                                            subItems: formData.subItems.map((s, i) => (i === index ? { ...s, max_score: value } : s)),
                                        })}
                                        isInvalid={showErrors(1) && !!errors?.score}
                                        errorMessage={showErrors(1) ? errors?.score ?? undefined : undefined}
                                        className="w-20 shrink-0 sm:w-32"
                                        classNames={inputClassNames}
                                        endContent={<span className="hidden text-xs text-default-500 sm:inline">{isEnglish ? "pts" : "คะแนน"}</span>}
                                    />
                                    <Button
                                        isIconOnly
                                        variant="light"
                                        color="danger"
                                        className="mt-0.5 h-10 w-10 min-w-10 shrink-0"
                                        aria-label={isEnglish ? `Remove item ${index + 1}` : `ลบข้อย่อยที่ ${index + 1}`}
                                        isDisabled={formData.subItems.length <= 1}
                                        onPress={() => update({ subItems: formData.subItems.filter((_, i) => i !== index) })}
                                    >
                                        <Icon icon="solar:trash-bin-trash-linear" className="text-lg" aria-hidden="true" />
                                    </Button>
                                </li>
                            );
                        })}
                    </ol>
                    <Button
                        variant="bordered"
                        className="h-11 border-dashed border-indigo-300 text-indigo-700 dark:border-indigo-500/50 dark:text-indigo-200"
                        startContent={<Icon icon="solar:add-circle-linear" className="text-lg" aria-hidden="true" />}
                        onPress={() => update({
                            subItems: [
                                ...formData.subItems,
                                { name: isEnglish ? `Item ${formData.subItems.length + 1}` : `ข้อ ${formData.subItems.length + 1}`, max_score: "10" },
                            ],
                        })}
                    >
                        {isEnglish ? "Add item" : "เพิ่มข้อย่อย"}
                    </Button>
                    {showErrors(1) && inlineError(subTotalError)}
                </div>
            )}

            <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
                <Switch
                    isSelected={formData.isScoreVisible}
                    onValueChange={(value) => update({ isScoreVisible: value })}
                    color="success"
                    classNames={{
                        base: "flex w-full max-w-none flex-row-reverse items-center justify-between gap-4",
                        label: "ms-0 min-w-0",
                    }}
                >
                    <span className="block text-[0.9375rem] font-medium text-foreground">
                        {isEnglish ? "Students can see this score" : "ให้นักศึกษาเห็นคะแนนงานนี้"}
                    </span>
                    <span className="block text-[0.8125rem] text-default-600">
                        {formData.isScoreVisible
                            ? (isEnglish ? "Students can look up their score for this assignment." : "นักศึกษาค้นหาและดูคะแนนงานนี้ได้")
                            : (isEnglish
                                ? "Hidden from student score lookup. Grading and Excel export still work."
                                : "ซ่อนจากหน้าค้นหาคะแนนของนักศึกษา แต่ยังลงคะแนนและ Export Excel ได้ตามปกติ")}
                    </span>
                </Switch>
            </div>
        </div>
    );

    const renderAttendanceStep = () => (
        <div className="flex flex-col gap-6">
            {stepHeading(
                isEnglish ? "Attendance rule" : "เงื่อนไขเช็กชื่อ",
                isEnglish
                    ? "Link attendance sessions so absent students cannot receive a score. Optional, so you can skip this step."
                    : "ผูกงานกับรอบเช็กชื่อ นักศึกษาที่ขาดเรียนตามเงื่อนไขจะลงคะแนนไม่ได้ ข้ามขั้นนี้ได้ถ้าไม่ต้องการ",
            )}

            {isLoadingSessions ? (
                <div className="flex items-center gap-2 rounded-2xl border border-default-200 p-4 text-sm text-default-600" role="status">
                    <Icon icon="svg-spinners:3-dots-fade" className="text-xl" aria-hidden="true" />
                    {isEnglish ? "Loading attendance sessions" : "กำลังโหลดรอบเช็กชื่อ"}
                </div>
            ) : sessionsFailed ? (
                <div className="flex items-start gap-2.5 rounded-2xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200" role="alert">
                    <Icon icon="solar:danger-circle-linear" className="mt-0.5 shrink-0 text-lg" aria-hidden="true" />
                    <span>{isEnglish ? "Attendance sessions could not be loaded. Close this window and open it again to retry." : "โหลดรอบเช็กชื่อไม่สำเร็จ ปิดหน้าต่างนี้แล้วเปิดใหม่เพื่อลองอีกครั้ง"}</span>
                </div>
            ) : attendanceSessions.length === 0 ? (
                <div className="flex items-start gap-2.5 rounded-2xl border border-default-200 bg-default-50 p-4 text-sm text-default-700">
                    <Icon icon="solar:clipboard-list-linear" className="mt-0.5 shrink-0 text-lg" aria-hidden="true" />
                    <span>{isEnglish ? "This course has no attendance sessions yet, so there is nothing to link." : "รายวิชานี้ยังไม่มีรอบเช็กชื่อ จึงยังไม่มีอะไรให้ผูก"}</span>
                </div>
            ) : (
                <fieldset>
                    <legend className="sr-only">{isEnglish ? "Attendance sessions" : "รอบเช็กชื่อ"}</legend>
                    <ul className="space-y-2">
                        {attendanceSessions.map((session) => {
                            const checked = formData.linked_attendance_session_ids.includes(session.id);
                            return (
                                <li key={session.id}>
                                    <label
                                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-500 ${
                                            checked
                                                ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/12"
                                                : "border-default-200 bg-content1 hover:border-default-300"
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 shrink-0 accent-indigo-600"
                                            checked={checked}
                                            onChange={() => update({
                                                linked_attendance_session_ids: checked
                                                    ? formData.linked_attendance_session_ids.filter((id) => id !== session.id)
                                                    : [...formData.linked_attendance_session_ids, session.id],
                                            })}
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[0.9375rem] font-medium text-foreground">{session.title}</span>
                                            <span className="text-[0.8125rem] text-default-600">
                                                {isEnglish
                                                    ? `${formatLocalizedDate(session.start_time, true)} at ${formatLocalizedTime(session.start_time, true)}`
                                                    : `${formatLocalizedDate(session.start_time, false)} เวลา ${formatLocalizedTime(session.start_time, false)} น.`}
                                            </span>
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                </fieldset>
            )}

            {linkedCount > 1 && (
                <fieldset>
                    <legend className="mb-2.5 text-sm font-medium text-default-700">
                        {isEnglish ? "When several sessions are linked" : "เงื่อนไขเมื่อผูกหลายรอบ"}
                    </legend>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                        {([
                            {
                                key: "or" as const,
                                title: isEnglish ? "At least one session" : "อย่างน้อย 1 รอบ",
                                detail: isEnglish ? "Attending any linked session is enough." : "มาเรียนรอบใดรอบหนึ่งก็ลงคะแนนได้",
                            },
                            {
                                key: "and" as const,
                                title: isEnglish ? "Every session" : "ครบทุกรอบ",
                                detail: isEnglish ? "Students must attend every linked session." : "ต้องมาเรียนครบทุกรอบจึงลงคะแนนได้",
                            },
                        ]).map((option) => {
                            const selected = formData.attendance_condition === option.key;
                            return (
                                <button
                                    key={option.key}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => update({ attendance_condition: option.key })}
                                    className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                                        selected
                                            ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/12"
                                            : "border-default-200 bg-content1 hover:border-default-300"
                                    }`}
                                >
                                    <span className="block text-[0.9375rem] font-semibold text-foreground">{option.title}</span>
                                    <span className="text-[0.8125rem] text-default-600">{option.detail}</span>
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
            )}

            <div className="flex items-start gap-2.5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100" aria-live="polite">
                <Icon icon="solar:info-circle-linear" className="mt-0.5 shrink-0 text-lg" aria-hidden="true" />
                <span>{attendanceNote}</span>
            </div>
        </div>
    );

    const renderPreviewCard = (compact: boolean) => (
        <div className="rounded-2xl border border-default-200 bg-default-100/70 p-3 dark:bg-default-50">
            <p className="mb-2.5 px-1 text-[0.8125rem] font-medium text-default-600">
                {isEnglish ? "What students see" : "ตัวอย่างที่นักศึกษาเห็น"}
            </p>
            <div className="space-y-2.5 rounded-xl bg-content1 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeOption.chip}`}>
                    {isEnglish ? typeOption.labelEn : typeOption.label}
                </span>
                <p className="break-words text-[1.0625rem] font-semibold leading-snug text-foreground">
                    {trimmedName || (isEnglish ? "[Assignment name]" : "[ชื่องาน]")}
                </p>
                {!compact && (
                    <p className="line-clamp-4 whitespace-pre-line break-words text-[0.8125rem] leading-relaxed text-default-600">
                        {formData.description.trim() || (isEnglish ? "No additional details yet." : "ยังไม่มีรายละเอียดเพิ่มเติม")}
                    </p>
                )}
                <dl className="space-y-1.5 border-t border-default-200 pt-2.5 text-[0.8125rem]">
                    {[
                        { label: isEnglish ? "Max score" : "คะแนนเต็ม", value: scoreSummary },
                        { label: isEnglish ? "Attendance" : "เช็กชื่อ", value: attendanceShort },
                        { label: isEnglish ? "Score" : "คะแนน", value: formData.isScoreVisible ? (isEnglish ? "Visible to students" : "นักศึกษาเห็น") : (isEnglish ? "Hidden from students" : "ซ่อนจากนักศึกษา") },
                    ].map((row) => (
                        <div key={row.label} className="flex justify-between gap-3">
                            <dt className="text-default-600">{row.label}</dt>
                            <dd className="text-right font-medium text-foreground tabular-nums">{row.value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </div>
    );

    const renderStatusBox = () => (
        <div className={`rounded-2xl border px-4 py-3.5 ${statusBox.className}`} aria-live="polite">
            <p className="text-sm font-semibold">{statusBox.title}</p>
            <p className="mt-0.5 text-[0.8125rem] leading-relaxed">{statusBox.detail}</p>
        </div>
    );

    const todayValue = toDateInputValue(new Date());

    const renderPublishStep = () => (
        <div className="flex flex-col gap-6">
            {stepHeading(
                isEnglish ? "Publishing" : "การเผยแพร่",
                isEditingPublished
                    ? (isEnglish ? "This assignment is already published. Review it, then save your changes." : "งานนี้เผยแพร่แล้ว ตรวจทานแล้วบันทึกการแก้ไขได้เลย")
                    : (isEnglish ? "Keep it as a draft, schedule it, or publish it now." : "เลือกว่าจะเก็บเป็นฉบับร่าง ตั้งเวลา หรือเผยแพร่ทันที"),
            )}

            <div className="lg:hidden">{renderPreviewCard(true)}</div>

            {isEditingPublished ? (
                renderStatusBox()
            ) : (
                <>
                    <fieldset>
                        <legend className="sr-only">{isEnglish ? "How to save" : "วิธีบันทึกงาน"}</legend>
                        <div className="space-y-1 rounded-2xl border border-default-300 p-1.5">
                            {MODE_OPTIONS.map((option) => {
                                const selected = formData.publishMode === option.key;
                                return (
                                    <label
                                        key={option.key}
                                        className={`flex min-h-16 cursor-pointer items-start gap-3.5 rounded-xl border px-3.5 py-3 transition-colors focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-indigo-500 sm:px-4 ${
                                            selected ? option.selectedRow : "border-transparent hover:bg-default-100"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="assignment-publish-mode"
                                            className="mt-1 h-5 w-5 shrink-0 accent-indigo-600"
                                            checked={selected}
                                            onChange={() => {
                                                const patch: Partial<AssignmentFormData> = { publishMode: option.key };
                                                if (option.key === "schedule" && (!formData.publishDate || !formData.publishTime)) {
                                                    const tomorrow = new Date();
                                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                                    patch.publishDate = toDateInputValue(tomorrow);
                                                    patch.publishTime = "08:00";
                                                }
                                                update(patch);
                                            }}
                                        />
                                        <span className="min-w-0">
                                            <span className="flex items-center gap-2 text-[0.9375rem] font-semibold text-foreground">
                                                <Icon icon={option.icon} className="shrink-0 text-lg text-default-600" aria-hidden="true" />
                                                {isEnglish ? option.titleEn : option.title}
                                            </span>
                                            <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-default-600">
                                                {isEnglish ? option.detailEn : option.detail}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>
                    {showErrors(3) && inlineError(modeError)}

                    {formData.publishMode === "schedule" && (
                        <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    type="date"
                                    label={isEnglish ? "Publish date" : "วันที่เผยแพร่"}
                                    labelPlacement="outside"
                                    placeholder=" "
                                    variant="bordered"
                                    min={todayValue}
                                    value={formData.publishDate}
                                    onValueChange={(value) => update({ publishDate: value })}
                                    classNames={inputClassNames}
                                />
                                <Input
                                    type="time"
                                    label={isEnglish ? "Time" : "เวลา"}
                                    labelPlacement="outside"
                                    placeholder=" "
                                    variant="bordered"
                                    value={formData.publishTime}
                                    onValueChange={(value) => update({ publishTime: value })}
                                    classNames={inputClassNames}
                                />
                            </div>
                            {scheduleError ? (
                                inlineError(scheduleError)
                            ) : scheduledAt ? (
                                <p className="text-sm text-indigo-900 dark:text-indigo-100">
                                    {isEnglish
                                        ? `Publishes on its own ${formatPublishDateTime(scheduledAt, true)}. Until then it stays a draft you can edit.`
                                        : `ระบบจะเผยแพร่ให้ ${formatPublishDateTime(scheduledAt, false)} ก่อนถึงเวลานั้นงานยังเป็นฉบับร่างและแก้ไขได้`}
                                </p>
                            ) : null}
                        </div>
                    )}

                    {formData.publishMode === "now" && (
                        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                            <Icon icon="solar:info-circle-linear" className="mt-0.5 shrink-0 text-lg" aria-hidden="true" />
                            <span>{isEnglish ? "A published assignment can still be edited, but it cannot go back to draft." : "งานที่เผยแพร่แล้วยังแก้ไขได้ แต่ย้อนกลับเป็นฉบับร่างไม่ได้"}</span>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    const stepContent = [renderDetailsStep, renderScoringStep, renderAttendanceStep, renderPublishStep][step];

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                size="5xl"
                placement="center"
                scrollBehavior="normal"
                hideCloseButton
                isDismissable={!isDirty && !isSubmitting}
                isKeyboardDismissDisabled={isDirty || isSubmitting}
                classNames={{
                    wrapper: "overflow-hidden",
                    // The wrapper tracks the visual viewport, so h-full keeps the
                    // footer above the iOS keyboard where h-dvh would not.
                    base: "!m-0 h-full max-h-full w-full max-w-full !rounded-none sm:!m-6 sm:h-[min(52rem,calc(100dvh-3rem))] sm:max-w-5xl sm:!rounded-2xl",
                }}
            >
                <ModalContent className="flex flex-col overflow-hidden border-default-200 bg-content1 text-foreground sm:border">
                    <ModalHeader className="flex shrink-0 items-center gap-3 border-b border-divider px-4 py-3 sm:px-7 sm:py-4">
                        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:flex dark:bg-blue-500/15 dark:text-blue-200">
                            <Icon icon="solar:clipboard-list-linear" className="text-2xl" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-[1.0625rem] font-semibold leading-tight text-foreground sm:text-xl">
                                {isEditing ? (isEnglish ? "Edit assignment" : "แก้ไขงาน") : (isEnglish ? "Create assignment" : "สร้างงานใหม่")}
                            </h2>
                            <p className="truncate text-[0.8125rem] font-normal text-default-600">
                                {trimmedName || (isEnglish ? "Untitled assignment" : "ยังไม่ได้ตั้งชื่องาน")}
                            </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusChip.className}`}>
                            {statusChip.label}
                        </span>
                        <Button
                            isIconOnly
                            variant="light"
                            className="h-11 w-11 min-w-11 shrink-0 text-default-600"
                            aria-label={isEnglish ? "Close" : "ปิด"}
                            onPress={onClose}
                            isDisabled={isSubmitting}
                        >
                            <Icon icon="solar:close-circle-linear" className="text-2xl" aria-hidden="true" />
                        </Button>
                    </ModalHeader>

                    <nav aria-label={isEnglish ? "Assignment steps" : "ขั้นตอนการสร้างงาน"} className="shrink-0 border-b border-divider px-2 pb-3 pt-3 sm:px-12 sm:pt-4">
                        <ol className="relative grid grid-cols-4">
                            <span aria-hidden="true" className="absolute bottom-[0.8125rem] left-[12.5%] right-[12.5%] h-0.5 rounded-full bg-default-200" />
                            <span
                                aria-hidden="true"
                                className="absolute bottom-[0.8125rem] left-[12.5%] h-0.5 rounded-full bg-indigo-500 transition-[width] duration-300 ease-out motion-reduce:transition-none"
                                style={{ width: `${step * 25}%` }}
                            />
                            {STEP_LABELS.map((label, index) => {
                                const isCurrent = index === step;
                                const isDone = index < step;
                                const hasIssue = !isCurrent && attemptedSteps[index] && !stepValid[index];
                                return (
                                    <li key={label.long} className="relative flex justify-center">
                                        <button
                                            type="button"
                                            onClick={() => goToStep(index as StepIndex)}
                                            aria-current={isCurrent ? "step" : undefined}
                                            className="group flex min-h-11 flex-col items-center gap-2 rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                        >
                                            <span className={`text-xs sm:text-sm ${isCurrent ? "font-semibold text-foreground" : isDone ? "font-medium text-foreground" : "font-medium text-default-500"} group-hover:text-foreground`}>
                                                <span className="sm:hidden">{isEnglish ? label.shortEn : label.short}</span>
                                                <span className="hidden sm:inline">{isEnglish ? label.longEn : label.long}</span>
                                                {hasIssue && <span className="sr-only">{isEnglish ? " (needs attention)" : " (ยังไม่ครบ)"}</span>}
                                            </span>
                                            <span className="flex h-[1.625rem] w-[1.625rem] items-center justify-center">
                                                {hasIssue ? (
                                                    <span className="flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded-full bg-amber-500 text-white">
                                                        <Icon icon="solar:danger-triangle-bold" className="text-sm" aria-hidden="true" />
                                                    </span>
                                                ) : isDone ? (
                                                    <span className="flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded-full bg-indigo-500 text-white">
                                                        <Icon icon="solar:check-read-linear" className="text-base" aria-hidden="true" />
                                                    </span>
                                                ) : isCurrent ? (
                                                    <span className="h-[1.625rem] w-[1.625rem] rounded-full border-[7px] border-indigo-500 bg-content1" />
                                                ) : (
                                                    <span className="h-[1.125rem] w-[1.125rem] rounded-full border-2 border-default-400 bg-content1" />
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </nav>

                    <ModalBody className="min-h-0 flex-1 gap-0 p-0 lg:grid lg:grid-cols-[minmax(0,1fr)_18.75rem]">
                        <div ref={contentRef} className="h-full overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-6 lg:pr-6">
                            {stepContent()}
                        </div>
                        <aside className="hidden h-full space-y-3 overflow-y-auto py-6 pr-8 lg:block" aria-label={isEnglish ? "Preview" : "ตัวอย่าง"}>
                            {renderPreviewCard(false)}
                            {renderStatusBox()}
                        </aside>
                    </ModalBody>

                    <ModalFooter className="shrink-0 flex-col gap-2 border-t border-divider px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-3.5">
                        <p className={`text-center text-[0.8125rem] sm:text-left sm:text-sm ${isLastStep && (saveBlockedByCourse || saveBlockedByNoChanges) ? "text-warning-700 dark:text-warning-400" : "text-default-600"}`} aria-live="polite">
                            {footerHint}
                        </p>
                        <div className="flex w-full gap-2.5 sm:w-auto">
                            <Button
                                variant="bordered"
                                className="h-12 flex-1 border-default-300 text-[0.9375rem] font-medium sm:h-11 sm:flex-none sm:px-5"
                                onPress={() => (step === 0 ? onClose() : moveTo((step - 1) as StepIndex))}
                                isDisabled={isSubmitting}
                            >
                                {step === 0 ? (isEnglish ? "Cancel" : "ยกเลิก") : (isEnglish ? "Back" : "กลับ")}
                            </Button>
                            <Button
                                className={`h-12 flex-[2] text-[0.9375rem] sm:h-11 sm:flex-none sm:px-6 ${primaryClassName}`}
                                onPress={handlePrimary}
                                isLoading={isSubmitting}
                                isDisabled={primaryDisabled}
                            >
                                {primaryLabel}
                            </Button>
                        </div>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={pendingScoreDeletion !== null}
                onClose={() => setPendingScoreDeletion(null)}
                size="lg"
            >
                <ModalContent className="border border-default-200 bg-content1 text-foreground">
                    <ModalHeader className="flex items-center gap-3 px-6 pb-4 pt-6">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                            <Icon icon="solar:danger-triangle-bold" className="text-xl" aria-hidden="true" />
                        </span>
                        <h3 className="text-lg font-bold text-foreground">
                            {isEnglish ? "Existing scores will be deleted" : "คะแนนที่ลงไว้แล้วจะถูกลบ"}
                        </h3>
                    </ModalHeader>
                    <ModalBody className="px-6 pb-2">
                        <p className="text-sm text-default-700">
                            {isEnglish
                                ? "Removing these sub-items also deletes the scores already recorded against them. This cannot be undone."
                                : "การลบข้อย่อยเหล่านี้จะลบคะแนนที่ตรวจไว้แล้วไปด้วย และกู้คืนไม่ได้"}
                        </p>
                        <ul className="mt-1 flex flex-col gap-2">
                            {pendingScoreDeletion?.subItems.map((subItem) => (
                                <li
                                    key={subItem.id}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-900/60 dark:bg-rose-950/40"
                                >
                                    <span className="text-sm font-medium text-foreground">{subItem.name}</span>
                                    <Chip size="sm" color="danger" variant="flat">
                                        {isEnglish
                                            ? formatCount(subItem.score_count, "score", "scores")
                                            : `${subItem.score_count} คะแนน`}
                                    </Chip>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-1 text-sm font-semibold text-danger">
                            {isEnglish
                                ? `${formatCount(pendingScoreDeletion?.totalScores ?? 0, "score", "scores")} will be deleted in total.`
                                : `รวมคะแนนที่จะถูกลบทั้งหมด ${pendingScoreDeletion?.totalScores ?? 0} รายการ`}
                        </p>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4">
                        <Button variant="light" onPress={() => setPendingScoreDeletion(null)}>
                            {isEnglish ? "Keep the sub-items" : "เก็บข้อย่อยไว้"}
                        </Button>
                        <Button
                            color="danger"
                            onPress={handleConfirmScoreDeletion}
                            isLoading={isSubmitting}
                            className={instructorFlatButtonClass("bg-rose-600 text-white")}
                        >
                            {isEnglish ? "Delete scores and save" : "ลบคะแนนแล้วบันทึก"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}

export const AssignmentModal = memo(AssignmentModalComponent);
