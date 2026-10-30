"use client";

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Icon } from "@iconify/react";
import queueService, { ClassroomConflictError, type ClassroomConflictInfo, type CreateQueueSessionData, type QueueSession } from "@/services/queue.service";
import { classroomService, type Classroom } from "@/services/classroom.service";
import assignmentService, { type Assignment } from "@/services/assignment.service";
import attendanceService, { type AttendanceSession } from "@/services/attendance.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { instructorPrimaryButtonClass, instructorFlatButtonClass } from "@/components/ui/instructor-button-styles";
import type { RuleMessage } from "@/lib/attendance/session-rules";
import {
    QUEUE_DESCRIPTION_MAX_LENGTH,
    QUEUE_TITLE_MAX_LENGTH,
    attendancePhase,
    checkQueue,
    describeQueueProblems,
    usableDeskCount,
} from "@/lib/queue/session-rules";

type StepIndex = 0 | 1 | 2;
const LAST_STEP: StepIndex = 2;

export interface QueueSectionInfo {
    id: number;
    section_no: string;
}

export type QueueCreateOutcome =
    | { kind: "draft"; session: QueueSession }
    | { kind: "active"; session: QueueSession }
    | { kind: "conflict"; session: QueueSession; conflict: ClassroomConflictInfo }
    | { kind: "start_failed"; session: QueueSession };

interface FormState {
    title: string;
    description: string;
    classroomId: string;
    assignmentId: number | null;
    /** Empty means attendance is not required. */
    attendanceIds: number[];
    startNow: boolean;
}

const STEP_LABELS = [
    { long: "ข้อมูลคิว", short: "ข้อมูล", longEn: "Details", shortEn: "Details" },
    { long: "เงื่อนไขการจอง", short: "เงื่อนไข", longEn: "Booking rules", shortEn: "Rules" },
    { long: "ตรวจทานและสร้าง", short: "ตรวจทาน", longEn: "Review and create", shortEn: "Review" },
];

const inputClassNames = {
    inputWrapper: "bg-content1 border-default-200 data-[hover=true]:border-indigo-300 group-data-[focus=true]:!border-indigo-500",
    input: "text-base sm:text-sm",
    label: "text-sm font-medium text-default-700",
};

const TONE_CLASS: Record<RuleMessage["tone"], { box: string; head: string; headEn: string }> = {
    block: { box: "border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200", head: "สร้างไม่ได้", headEn: "Can't create" },
    warn: { box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100", head: "ตรวจอีกครั้ง", headEn: "Check again" },
    info: { box: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100", head: "แจ้งให้ทราบ", headEn: "Note" },
};

function RuleMessages({ messages, isEnglish }: { messages: RuleMessage[]; isEnglish: boolean }) {
    if (!messages.length) return null;
    return (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
            {messages.map((m, i) => (
                <div key={`${m.tone}-${i}`} className={`flex flex-col gap-0.5 rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed sm:flex-row sm:gap-2.5 ${TONE_CLASS[m.tone].box}`}>
                    <b className="shrink-0 font-semibold">{isEnglish ? TONE_CLASS[m.tone].headEn : TONE_CLASS[m.tone].head}</b>
                    <span>{m.text}</span>
                </div>
            ))}
        </div>
    );
}

/** A selectable row in a single-choice list (rooms, assignments, attendance sessions). */
function ChoiceRow({ name, checked, onSelect, title, detail, badge, invalid, multiple }: { name: string; checked: boolean; onSelect: () => void; title: ReactNode; detail?: ReactNode; badge?: ReactNode; invalid?: boolean; multiple?: boolean }) {
    return (
        <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-500 ${invalid ? "border-danger-300 bg-danger-50/60 dark:bg-danger-500/10" : checked ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/12" : "border-default-200 bg-content1 hover:border-default-300"}`}>
            <input type={multiple ? "checkbox" : "radio"} name={name} className="h-5 w-5 shrink-0 accent-indigo-600" checked={checked} onChange={onSelect} />
            <span className="min-w-0 flex-1">
                <span className="block break-words text-[0.9375rem] font-semibold text-foreground">{title}</span>
                {detail && <span className="block text-[0.8125rem] text-default-600">{detail}</span>}
            </span>
            {badge}
        </label>
    );
}

interface CreateQueueModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
    isCourseActive?: boolean;
    sections: QueueSectionInfo[];
    queues: QueueSession[];
    /** Prefill, e.g. when duplicating a queue. */
    initialData?: CreateQueueSessionData | null;
    /** roomLabel is the chosen room as shown in the form, for the success modal. */
    onCreated: (outcome: QueueCreateOutcome, roomLabel: string) => void;
}

function emptyForm(initial?: CreateQueueSessionData | null): FormState {
    return {
        title: initial?.title ?? "",
        description: initial?.description ?? "",
        classroomId: initial?.classroom_id ?? "",
        assignmentId: initial?.linked_assignment_id ?? null,
        attendanceIds: !initial?.require_attendance
            ? []
            : initial.linked_attendance_session_ids?.length
                ? [...initial.linked_attendance_session_ids]
                : initial.linked_attendance_session_id != null ? [initial.linked_attendance_session_id] : [],
        startNow: false,
    };
}

function CreateQueueModalComponent({ isOpen, onClose, courseId, isCourseActive = true, sections, queues, initialData, onCreated }: CreateQueueModalProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const t = (th: string, en: string) => (isEnglish ? en : th);

    const [form, setForm] = useState<FormState>(() => emptyForm(initialData));
    const [step, setStep] = useState<StepIndex>(0);
    const [attempted, setAttempted] = useState<boolean[]>([false, false, false]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [now, setNow] = useState(() => new Date());
    const [rooms, setRooms] = useState<Classroom[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [roomQuery, setRoomQuery] = useState("");
    const [assignmentQuery, setAssignmentQuery] = useState("");
    const contentRef = useRef<HTMLDivElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const stepChangedByUser = useRef(false);

    // Reset and load fresh options on every open, so a room, assignment or
    // attendance session made a moment ago is already in the lists.
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setForm(emptyForm(initialData));
        setStep(0);
        setAttempted([false, false, false]);
        setServerError(null);
        setRoomQuery("");
        setAssignmentQuery("");
        setNow(new Date());
        stepChangedByUser.current = false;
        setIsLoading(true);
        setLoadFailed(false);
        Promise.all([
            classroomService.getClassrooms({ limit: 200 }),
            assignmentService.getAssignments(courseId),
            attendanceService.getSessions(courseId),
        ])
            .then(([roomRes, assignmentList, attendanceList]) => {
                if (cancelled) return;
                const list = [...(roomRes?.data?.classrooms ?? [])].sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) || a.building.localeCompare(b.building, undefined, { numeric: true, sensitivity: "base" }));
                setRooms(list);
                setAssignments(assignmentList ?? []);
                setAttendance([...(attendanceList ?? [])].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));
                // A single room is the obvious choice; more than one is the instructor's call.
                if (list.length === 1) setForm((prev) => (prev.classroomId ? prev : { ...prev, classroomId: list[0].id }));
            })
            .catch((error) => {
                console.error("Failed to load queue options:", error);
                if (!cancelled) setLoadFailed(true);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        const timer = window.setInterval(() => setNow(new Date()), 30000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [isOpen, initialData, courseId]);

    useEffect(() => {
        contentRef.current?.scrollTo({ top: 0 });
        if (stepChangedByUser.current) headingRef.current?.focus({ preventScroll: true });
    }, [step]);

    const update = (patch: Partial<FormState>) => {
        setServerError(null);
        setForm((prev) => ({ ...prev, ...patch }));
    };

    const check = checkQueue(
        { title: form.title, description: form.description, classroomId: form.classroomId, assignmentId: form.assignmentId, attendanceIds: form.attendanceIds, startNow: form.startNow },
        { rooms, queues: queues.map((q) => ({ ...q, id: String(q.id) })), assignments, attendance, sections, now },
        isEnglish,
    );
    const loadBlock: RuleMessage[] = loadFailed ? [{ tone: "block", text: t("โหลดรายการห้อง งาน และรอบเช็กชื่อไม่สำเร็จ ปิดแล้วเปิดหน้าต่างนี้ใหม่", "Couldn't load rooms, assignments and attendance sessions. Close and reopen this window.") }] : [];
    // The title problem is shown under the field itself, so it is left out of the list.
    const titleError = check.bad.title ? check.details.messages.find((m) => m.tone === "block")?.text : undefined;
    const detailsMessages = isLoading ? [] : [...loadBlock, ...check.details.messages.filter((m) => m.text !== titleError)];
    const stepValid = [
        !isLoading && !loadFailed && !check.details.blocked,
        !isLoading && !loadFailed && !check.booking.blocked,
        !isLoading && !loadFailed && !check.details.blocked && !check.booking.blocked && !check.review.blocked,
    ];
    const isDirty = form.title.trim() !== "" || form.description.trim() !== "";

    const room = rooms.find((r) => r.id === form.classroomId);
    const assignment = assignments.find((a) => a.id === form.assignmentId);
    // Shown and saved in time order, so the first link is the earliest session.
    const chosenAttendance = form.attendanceIds
        .map((id) => attendance.find((a) => a.id === id))
        .filter((a): a is AttendanceSession => !!a)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const orderedAttendanceIds = [...chosenAttendance.map((a) => a.id), ...form.attendanceIds.filter((id) => !chosenAttendance.some((a) => a.id === id))];
    const toggleAttendance = (id: number) =>
        update({ attendanceIds: form.attendanceIds.includes(id) ? form.attendanceIds.filter((x) => x !== id) : [...form.attendanceIds, id] });
    // Several sections usually each have their own session on the same day.
    const todayIds = attendance.filter((a) => new Date(a.start_time).toDateString() === now.toDateString()).map((a) => a.id);
    const canPickToday = todayIds.length > 1 && todayIds.some((id) => !form.attendanceIds.includes(id));
    const trimmedTitle = form.title.trim();
    const roomText = room ? `${room.name}${room.building ? `, ${room.building}` : ""}${room.floor ? t(` ชั้น ${room.floor}`, `, floor ${room.floor}`) : ""}` : t("ยังไม่ได้เลือกห้อง", "No room chosen");
    const dateText = (iso: string) => {
        const d = new Date(iso);
        return `${d.toLocaleDateString(isEnglish ? "en-US" : "th-TH", { weekday: "short", day: "numeric", month: "short" })} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}${isEnglish ? "" : " น."}`;
    };
    const phaseLabel = (a: AttendanceSession) => {
        const p = attendancePhase(a, now);
        return p === "upcoming"
            ? { text: t("ยังไม่เปิด", "Not open yet"), cls: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100" }
            : p === "open"
                ? { text: t("เปิดอยู่", "Open"), cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100" }
                : { text: t("ปิดแล้ว", "Closed"), cls: "bg-default-100 text-default-700" };
    };

    // ---- navigation ----
    const markAttempted = (i: number) => setAttempted((prev) => prev.map((v, k) => (k === i ? true : v)));
    const moveTo = (target: StepIndex) => {
        stepChangedByUser.current = true;
        setStep(target);
    };
    const goToStep = (target: StepIndex) => {
        if (target <= step) return moveTo(target);
        for (let i = 0; i < target; i += 1) {
            if (!stepValid[i]) {
                markAttempted(i);
                return moveTo(i as StepIndex);
            }
        }
        moveTo(target);
    };

    const submit = async () => {
        if (isSubmitting) return;
        const firstInvalid = stepValid.findIndex((v) => !v);
        if (firstInvalid !== -1) {
            markAttempted(firstInvalid);
            moveTo(firstInvalid as StepIndex);
            return;
        }
        const data: CreateQueueSessionData = {
            title: trimmedTitle,
            description: form.description.trim(),
            classroom_id: form.classroomId,
            linked_assignment_id: form.assignmentId,
            require_attendance: orderedAttendanceIds.length > 0,
            linked_attendance_session_id: orderedAttendanceIds[0] ?? null,
            linked_attendance_session_ids: orderedAttendanceIds,
            is_cutoff_enabled: false,
            cutoff_at: null,
            cutoff_note: "",
        };
        setIsSubmitting(true);
        setServerError(null);
        try {
            const { session, message, problems } = await queueService.createQueueSessionWithResult(courseId, data);
            if (!session) {
                setServerError(describeQueueProblems(problems, isEnglish) || message || t("สร้างคิวไม่สำเร็จ ลองใหม่อีกครั้ง", "The queue was not created. Try again."));
                return;
            }
            if (!form.startNow) return onCreated({ kind: "draft", session }, roomText);
            try {
                const started = await queueService.updateQueueSessionStatus(courseId, session.id, "active");
                onCreated({ kind: "active", session: { ...session, ...started, status: "active" } }, roomText);
            } catch (error) {
                // The queue exists as a draft either way; the parent explains why it didn't open.
                if (error instanceof ClassroomConflictError) onCreated({ kind: "conflict", session, conflict: error.conflict }, roomText);
                else onCreated({ kind: "start_failed", session }, roomText);
            }
        } catch (error) {
            console.error("Failed to create queue:", error);
            setServerError(t("สร้างคิวไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองใหม่", "The queue was not created. Check your connection and try again."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrimary = () => {
        if (step < LAST_STEP) {
            if (!stepValid[step]) return markAttempted(step);
            return goToStep((step + 1) as StepIndex);
        }
        void submit();
    };

    const isLast = step === LAST_STEP;
    const primaryDisabled = isLoading || (isLast && (!isCourseActive || !stepValid[2]));
    const primaryLabel = !isLast
        ? t("ถัดไป", "Next")
        : !stepValid[2]
            ? t("แก้ข้อที่สร้างไม่ได้ก่อน", "Fix the blocking issues first")
            : form.startNow
                ? t("สร้างและเปิดให้จอง", "Create and open for booking")
                : t("สร้างคิว (ฉบับร่าง)", "Create queue (draft)");
    const primaryClass = !isLast
        ? instructorPrimaryButtonClass("min-w-28")
        : form.startNow
            ? instructorFlatButtonClass("min-w-28 bg-emerald-700 text-white data-[hover=true]:bg-emerald-800")
            : instructorFlatButtonClass("min-w-28 bg-indigo-600 text-white data-[hover=true]:bg-indigo-700");
    const footerHint = isLast && !isCourseActive
        ? t("รายวิชานี้ปิดแล้ว สร้างคิวไม่ได้", "This course is closed, so queues cannot be created.")
        : t(`ขั้นที่ ${step + 1} จาก 3`, `Step ${step + 1} of 3`);

    const heading = (title: string, detail: string) => (
        <div className="space-y-1">
            <h3 ref={headingRef} tabIndex={-1} className="text-[1.375rem] font-semibold leading-tight text-foreground outline-none sm:text-2xl">{title}</h3>
            <p className="max-w-[65ch] text-sm leading-relaxed text-default-600">{detail}</p>
        </div>
    );
    const searchBox = (value: string, onChange: (v: string) => void, label: string) => (
        <label className="relative block">
            <span className="sr-only">{label}</span>
            <Icon icon="solar:magnifer-linear" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-default-500" aria-hidden="true" />
            <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={label}
                className="h-11 w-full rounded-xl border border-default-300 bg-content1 pl-10 pr-3 text-base text-foreground outline-none placeholder:text-default-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm" />
        </label>
    );
    const loadingList = (
        <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-default-100 motion-reduce:animate-none" />)}
        </div>
    );

    // ---- steps ----
    const visibleRooms = useMemo(() => {
        const q = roomQuery.trim().toLowerCase();
        if (!q) return rooms;
        return rooms.filter((r) => `${r.name} ${r.building} ${r.floor ?? ""}`.toLowerCase().includes(q));
    }, [rooms, roomQuery]);
    const visibleAssignments = useMemo(() => {
        const q = assignmentQuery.trim().toLowerCase();
        return q ? assignments.filter((a) => a.name.toLowerCase().includes(q)) : assignments;
    }, [assignments, assignmentQuery]);

    const renderDetails = () => (
        <div className="flex flex-col gap-6">
            {heading(t("ข้อมูลคิว", "Queue details"), t("ตั้งชื่อคิวให้นักศึกษาเห็นชัดว่าจองตรวจงานอะไร แล้วเลือกห้องที่ใช้ตรวจ", "Give the queue a name students will recognise, then choose the room."))}
            <Input
                label={<>{t("ชื่อคิว", "Queue title")} <span className="font-normal text-default-500">{t("(ต้องระบุ)", "(required)")}</span></>}
                labelPlacement="outside"
                placeholder={t("เช่น ตรวจ Lab 1", "e.g. Lab 1 review")}
                variant="bordered"
                value={form.title}
                maxLength={QUEUE_TITLE_MAX_LENGTH}
                onValueChange={(v) => update({ title: v })}
                isInvalid={attempted[0] && !!check.bad.title}
                errorMessage={attempted[0] ? titleError : undefined}
                classNames={inputClassNames}
                autoComplete="off"
            />
            <Textarea
                label={<>{t("คำอธิบาย", "Description")} <span className="font-normal text-default-500">{t("(ไม่บังคับ)", "(optional)")}</span></>}
                labelPlacement="outside"
                placeholder={t("เช่น เตรียมโค้ดและผลรันให้พร้อมก่อนถึงคิว", "e.g. Have your code and output ready before your turn")}
                variant="bordered"
                minRows={2}
                maxRows={5}
                value={form.description}
                maxLength={QUEUE_DESCRIPTION_MAX_LENGTH}
                onValueChange={(v) => update({ description: v })}
                classNames={inputClassNames}
            />
            <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2.5 text-sm font-medium text-default-700">{t("ห้องที่ใช้ตรวจ", "Room")} <span className="font-normal text-default-500">{t("(ต้องระบุ)", "(required)")}</span></legend>
                {rooms.length > 6 && searchBox(roomQuery, setRoomQuery, t("ค้นหาห้อง อาคาร หรือชั้น", "Search room, building or floor"))}
                {isLoading ? loadingList : (
                    <div className="grid max-h-[22rem] gap-2 overflow-y-auto overscroll-contain pr-0.5 sm:grid-cols-2">
                        {visibleRooms.map((r) => {
                            const desks = usableDeskCount(r);
                            const busy = queues.find((q) => q.status === "active" && q.classroom_id === r.id);
                            return (
                                <ChoiceRow key={r.id} name="queue-room" checked={form.classroomId === r.id} onSelect={() => update({ classroomId: r.id })}
                                    invalid={attempted[0] && check.bad.room && form.classroomId === r.id}
                                    title={r.name}
                                    detail={[r.building, r.floor ? t(`ชั้น ${r.floor}`, `Floor ${r.floor}`) : null, desks ? t(`${desks} โต๊ะ`, `${desks} desks`) : t("ไม่มีโต๊ะที่เปิดใช้", "No enabled desks")].filter(Boolean).join(", ")}
                                    badge={busy ? <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">{t("มีคิวเปิดอยู่", "Queue open")}</span> : undefined}
                                />
                            );
                        })}
                        {visibleRooms.length === 0 && rooms.length > 0 && (
                            <p className="rounded-2xl border border-dashed border-default-300 px-4 py-6 text-center text-sm text-default-600 sm:col-span-2">{t("ไม่พบห้องที่ค้นหา", "No room matches that search.")}</p>
                        )}
                    </div>
                )}
            </fieldset>
            <RuleMessages messages={attempted[0] ? detailsMessages : detailsMessages.filter((m) => m.tone !== "block" || loadFailed || rooms.length === 0)} isEnglish={isEnglish} />
        </div>
    );

    const renderBooking = () => (
        <div className="flex flex-col gap-6">
            {heading(t("เงื่อนไขการจอง", "Booking rules"), t("เลือกงานที่จะบันทึกคะแนนให้เอง และกำหนดว่าต้องเช็กชื่อก่อนจองหรือไม่ ทั้งสองข้อไม่บังคับ", "Choose the assignment scores go to, and whether students must be checked in to book. Both are optional."))}
            <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2.5 text-sm font-medium text-default-700">{t("บันทึกคะแนนลงงาน", "Save scores to")}</legend>
                {assignments.length > 6 && searchBox(assignmentQuery, setAssignmentQuery, t("ค้นหาหัวข้องาน", "Search assignments"))}
                {isLoading ? loadingList : (
                    <div className="flex max-h-[20rem] flex-col gap-2 overflow-y-auto overscroll-contain pr-0.5">
                        <ChoiceRow name="queue-assignment" checked={form.assignmentId == null} onSelect={() => update({ assignmentId: null })}
                            title={t("ไม่ลิงก์หัวข้องาน", "Don't link an assignment")} detail={t("ตรวจในคิวได้ แต่คะแนนไม่ถูกบันทึกลงงานใด", "Grading still works, but scores aren't saved to an assignment.")} />
                        {visibleAssignments.map((a) => (
                            <ChoiceRow key={a.id} name="queue-assignment" checked={form.assignmentId === a.id} onSelect={() => update({ assignmentId: a.id })}
                                invalid={!!check.bad.assignment && form.assignmentId === a.id}
                                title={a.name} detail={t(`คะแนนเต็ม ${a.max_score}`, `Out of ${a.max_score}`)} />
                        ))}
                        {assignments.length === 0 && <p className="px-1 text-sm text-default-600">{t("รายวิชานี้ยังไม่มีหัวข้องาน", "This course has no assignments yet.")}</p>}
                    </div>
                )}
            </fieldset>
            <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-1 text-sm font-medium text-default-700">{t("ต้องเช็กชื่อก่อนจอง", "Require attendance to book")}</legend>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="text-[0.8125rem] text-default-600" aria-live="polite">
                        {form.attendanceIds.length === 0
                            ? t("ไม่ได้เลือก นักศึกษาทุกคนในรายวิชาจองได้ เลือกได้หลายรอบ เช่น รอบของแต่ละกลุ่มเรียน", "None chosen, so every student can book. You can choose several, e.g. one per section.")
                            : form.attendanceIds.length === 1
                                ? t("เลือก 1 รอบ ต้องมาเรียนหรือมาสายในรอบนี้จึงจองได้ เลือกเพิ่มได้ถ้าแต่ละกลุ่มมีรอบของตัวเอง", "1 chosen. Students must be present or late in it to book. Add more if each section has its own session.")
                                : t(`เลือก ${form.attendanceIds.length} รอบ มาเรียนหรือมาสายรอบใดรอบหนึ่งก็จองได้`, `${form.attendanceIds.length} chosen. Present or late in any one of them is enough to book.`)}
                    </p>
                    <span className="flex gap-3">
                        {canPickToday && (
                            <button type="button" className="min-h-11 text-sm font-medium text-indigo-700 underline underline-offset-2 dark:text-indigo-300" onClick={() => update({ attendanceIds: Array.from(new Set([...form.attendanceIds, ...todayIds])) })}>
                                {t("เลือกทุกรอบของวันนี้", "Pick all of today's")}
                            </button>
                        )}
                        {form.attendanceIds.length > 0 && (
                            <button type="button" className="min-h-11 text-sm font-medium text-indigo-700 underline underline-offset-2 dark:text-indigo-300" onClick={() => update({ attendanceIds: [] })}>
                                {t("ไม่บังคับเช็กชื่อ", "Don't require")}
                            </button>
                        )}
                    </span>
                </div>
                {isLoading ? loadingList : (
                    <div className="flex max-h-[20rem] flex-col gap-2 overflow-y-auto overscroll-contain pr-0.5">
                        {attendance.map((a) => {
                            const phase = phaseLabel(a);
                            const checked = form.attendanceIds.includes(a.id);
                            return (
                                <ChoiceRow key={a.id} multiple name="queue-attendance" checked={checked} onSelect={() => toggleAttendance(a.id)}
                                    title={a.title} detail={dateText(a.start_time)}
                                    badge={<span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${phase.cls}`}>{phase.text}</span>} />
                            );
                        })}
                        {attendance.length === 0 && <p className="px-1 text-sm text-default-600">{t("รายวิชานี้ยังไม่มีรอบเช็กชื่อ", "This course has no attendance sessions yet.")}</p>}
                    </div>
                )}
            </fieldset>
            <RuleMessages messages={check.booking.messages} isEnglish={isEnglish} />
        </div>
    );

    const reviewRows = [
        { label: t("ชื่อคิว", "Title"), value: trimmedTitle || t("ยังไม่ได้กรอก", "Not entered"), ok: !check.bad.title, at: 0 as StepIndex },
        { label: t("ห้อง", "Room"), value: roomText, ok: !check.bad.room, at: 0 as StepIndex },
        { label: t("บันทึกคะแนนลง", "Scores go to"), value: assignment ? assignment.name : t("ไม่ลิงก์หัวข้องาน", "No assignment"), ok: !check.bad.assignment, at: 1 as StepIndex },
        {
            label: t("เช็กชื่อก่อนจอง", "Attendance"),
            value: chosenAttendance.length
                ? chosenAttendance.map((a) => `${a.title} (${dateText(a.start_time)})`).join(", ") + (chosenAttendance.length > 1 ? t(" รอบใดรอบหนึ่ง", ", any one") : "")
                : t("ไม่บังคับ", "Not required"),
            ok: !check.bad.attendance,
            at: 1 as StepIndex,
        },
    ];

    const renderReview = () => (
        <div className="flex flex-col gap-5">
            {heading(t("ตรวจทานและสร้าง", "Review and create"), t("ตรวจทุกค่าอีกครั้ง แล้วเลือกว่าจะเก็บเป็นฉบับร่างหรือเปิดให้จองทันที", "Check everything once more, then choose whether to keep it as a draft or open it for booking now."))}
            <ul className="divide-y divide-default-200 rounded-2xl border border-default-200">
                {reviewRows.map((r) => (
                    <li key={r.label} className="flex min-h-14 items-center gap-3 px-4 py-3">
                        <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.ok ? "bg-emerald-600" : "bg-danger-500"}`} />
                        <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-3">
                            <span className="block text-[0.8125rem] text-default-600 sm:w-32 sm:shrink-0 sm:text-sm">{r.label}</span>
                            <span className={`block break-words text-[0.9375rem] font-medium ${r.ok ? "text-foreground" : "text-danger-700 dark:text-danger-300"}`}>{r.value}{!r.ok && <span className="sr-only"> {t("(ยังไม่ถูกต้อง)", "(needs fixing)")}</span>}</span>
                        </span>
                        <button type="button" className="min-h-11 shrink-0 px-1 text-sm font-medium text-indigo-700 underline underline-offset-2 dark:text-indigo-300" onClick={() => moveTo(r.at)}>{t("แก้ไข", "Edit")}</button>
                    </li>
                ))}
            </ul>
            <fieldset>
                <legend className="mb-2.5 text-sm font-medium text-default-700">{t("หลังสร้าง", "After creating")}</legend>
                <div role="radiogroup" className="grid gap-2.5 sm:grid-cols-2">
                    {[
                        { start: false, title: t("เก็บเป็นฉบับร่าง", "Keep as a draft"), detail: t("นักศึกษายังจองไม่ได้ กดเริ่มคิวจากรายการเมื่อพร้อม", "Students can't book yet. Start it from the list when you're ready."), icon: "solar:document-text-linear" },
                        { start: true, title: t("เปิดให้จองทันที", "Open for booking now"), detail: t("นักศึกษาจองด้วย PIN ได้ทันที และทีเอเข้าหน้ารับคิวได้", "Students can book with the PIN right away, and TAs can open the worker view."), icon: "solar:play-circle-linear" },
                    ].map((o) => {
                        const on = form.startNow === o.start;
                        return (
                            <button key={String(o.start)} type="button" role="radio" aria-checked={on} onClick={() => update({ startNow: o.start })}
                                className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${on ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/12" : "border-default-200 bg-content1 hover:border-default-300"}`}>
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${on ? "bg-indigo-600 text-white" : "bg-default-100 text-default-500"}`}><Icon icon={o.icon} className="text-xl" aria-hidden="true" /></span>
                                <span>
                                    <span className="block text-[0.9375rem] font-semibold text-foreground">{o.title}</span>
                                    <span className="block text-[0.8125rem] text-default-600">{o.detail}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </fieldset>
            <RuleMessages messages={[...check.review.messages, ...check.booking.messages.filter((m) => m.tone === "warn")]} isEnglish={isEnglish} />
            {serverError && (
                <div role="alert" className="flex flex-col gap-0.5 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-sm text-danger-800 sm:flex-row sm:gap-2.5 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
                    <b className="shrink-0 font-semibold">{t("ระบบไม่รับ", "Refused")}</b><span>{serverError}</span>
                </div>
            )}
        </div>
    );

    const status = form.startNow
        ? { title: t("เปิดให้จองทันที", "Opens for booking now"), cls: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100" }
        : { title: t("เก็บเป็นฉบับร่าง", "Saved as a draft"), cls: "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100" };

    const preview = (
        <div className="rounded-2xl border border-default-200 bg-default-100/70 p-3 dark:bg-default-50">
            <p className="mb-2.5 px-1 text-[0.8125rem] font-medium text-default-600">{t("ตัวอย่างคิว", "Queue preview")}</p>
            <div className="space-y-2.5 rounded-xl bg-content1 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${form.startNow ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200" : "bg-default-100 text-default-700"}`}>{form.startNow ? t("กำลังเปิด", "Open") : t("ฉบับร่าง", "Draft")}</span>
                <p className="break-words text-[1.0625rem] font-semibold leading-snug text-foreground">{trimmedTitle || t("[ชื่อคิว]", "[Queue title]")}</p>
                <p className="flex items-center gap-1.5 text-[0.8125rem] text-default-600"><Icon icon="solar:map-point-linear" aria-hidden="true" />{roomText}</p>
                <div className="flex flex-wrap gap-1.5 border-t border-default-200 pt-2.5">
                    <span className="rounded-full bg-default-100 px-2.5 py-0.5 text-xs font-medium text-default-700">{assignment ? t(`คะแนนลง ${assignment.name}`, `Scores to ${assignment.name}`) : t("ไม่ลิงก์งาน", "No assignment")}</span>
                    <span className="rounded-full bg-default-100 px-2.5 py-0.5 text-xs font-medium text-default-700">{form.attendanceIds.length > 1 ? t(`เช็กชื่อ ${form.attendanceIds.length} รอบใดก็ได้`, `Any of ${form.attendanceIds.length} sessions`) : form.attendanceIds.length ? t("ต้องเช็กชื่อก่อน", "Attendance required") : t("ทุกคนจองได้", "Anyone can book")}</span>
                </div>
            </div>
        </div>
    );

    const content = [renderDetails, renderBooking, renderReview][step];

    return (
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
                        <h2 className="text-[1.0625rem] font-semibold leading-tight text-foreground sm:text-xl">{t("สร้างการจองคิว", "Create queue")}</h2>
                        <p className="truncate text-[0.8125rem] font-normal text-default-600">{trimmedTitle || t("ยังไม่ได้ตั้งชื่อคิว", "Untitled queue")}</p>
                    </div>
                    <Button isIconOnly variant="light" className="h-11 w-11 min-w-11 shrink-0 text-default-600" aria-label={t("ปิด", "Close")} onPress={onClose} isDisabled={isSubmitting}>
                        <Icon icon="solar:close-circle-linear" className="text-2xl" aria-hidden="true" />
                    </Button>
                </ModalHeader>

                <nav aria-label={t("ขั้นตอนการสร้างคิว", "Queue steps")} className="shrink-0 border-b border-divider px-2 pb-3 pt-3 sm:px-16 sm:pt-4">
                    <ol className="relative grid grid-cols-3">
                        <span aria-hidden="true" className="absolute bottom-[0.8125rem] left-[16.667%] right-[16.667%] h-0.5 rounded-full bg-default-200" />
                        <span aria-hidden="true" className="absolute bottom-[0.8125rem] left-[16.667%] h-0.5 rounded-full bg-indigo-500 transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${step * 33.333}%` }} />
                        {STEP_LABELS.map((label, i) => {
                            const cur = i === step;
                            const done = i < step;
                            const issue = !cur && attempted[i] && !stepValid[i];
                            return (
                                <li key={label.long} className="relative flex justify-center">
                                    <button type="button" onClick={() => goToStep(i as StepIndex)} aria-current={cur ? "step" : undefined}
                                        className="group flex min-h-11 flex-col items-center gap-2 rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                                        <span className={`text-xs sm:text-sm ${cur ? "font-semibold text-foreground" : done ? "font-medium text-foreground" : "font-medium text-default-500"} group-hover:text-foreground`}>
                                            <span className="sm:hidden">{isEnglish ? label.shortEn : label.short}</span>
                                            <span className="hidden sm:inline">{isEnglish ? label.longEn : label.long}</span>
                                            {issue && <span className="sr-only">{t(" (ยังไม่ครบ)", " (needs attention)")}</span>}
                                        </span>
                                        <span className="flex h-[1.625rem] w-[1.625rem] items-center justify-center">
                                            {issue ? (
                                                <span className="flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded-full bg-danger-500 text-white"><Icon icon="solar:danger-triangle-bold" className="text-sm" aria-hidden="true" /></span>
                                            ) : done ? (
                                                <span className="flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded-full bg-indigo-500 text-white"><Icon icon="solar:check-read-linear" className="text-base" aria-hidden="true" /></span>
                                            ) : cur ? (
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
                        {content()}
                    </div>
                    <aside className="hidden h-full space-y-3 overflow-y-auto py-6 pr-8 lg:block" aria-label={t("ตัวอย่าง", "Preview")}>
                        {preview}
                        <div className={`rounded-2xl border px-4 py-3.5 ${status.cls}`} aria-live="polite">
                            <p className="text-sm font-semibold">{status.title}</p>
                            <p className="mt-0.5 text-[0.8125rem] leading-relaxed">
                                {form.startNow
                                    ? t("นักศึกษาจองได้ทันทีที่กดสร้าง", "Students can book as soon as you create it.")
                                    : t("เลือกเปิดให้จองทันทีได้ที่ขั้นตรวจทาน", "You can choose to open it right away in the review step.")}
                            </p>
                        </div>
                    </aside>
                </ModalBody>

                <ModalFooter className="shrink-0 flex-col gap-2 border-t border-divider px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-3.5">
                    <p className={`text-center text-[0.8125rem] sm:text-left sm:text-sm ${isLast && !isCourseActive ? "text-warning-700 dark:text-warning-400" : "text-default-600"}`} aria-live="polite">{footerHint}</p>
                    <div className="flex w-full gap-2.5 sm:w-auto">
                        <Button variant="bordered" className="h-12 flex-1 border-default-300 text-[0.9375rem] font-medium sm:h-11 sm:flex-none sm:px-5"
                            onPress={() => (step === 0 ? onClose() : moveTo((step - 1) as StepIndex))} isDisabled={isSubmitting}>
                            {step === 0 ? t("ยกเลิก", "Cancel") : t("กลับ", "Back")}
                        </Button>
                        <Button className={`h-12 flex-[2] text-[0.9375rem] sm:h-11 sm:flex-none sm:px-6 ${primaryClass}`} onPress={handlePrimary} isLoading={isSubmitting} isDisabled={primaryDisabled}>
                            {primaryLabel}
                        </Button>
                    </div>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

export const CreateQueueModal = memo(CreateQueueModalComponent);
