"use client";

import { memo, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import attendanceService, { type AttendanceSession, type CreateAttendanceData } from "@/services/attendance.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { instructorPrimaryButtonClass, instructorFlatButtonClass } from "@/components/ui/instructor-button-styles";
import {
    KKU_CAMPUS_AREAS,
    MAX_AHEAD_DAYS,
    addMinutesToClock,
    checkSecurity,
    checkTime,
    combineLocal,
    describeSettingsProblems,
    formatDayLabel,
    formatShortSpan,
    insideKKUCampus,
    minutesBetweenClocks,
    toDateInput,
    toTimeInput,
    type ExistingSessionWindow,
    type RuleMessage,
} from "@/lib/attendance/session-rules";
import type { Section } from "../config";

const LocationPicker = lazy(() => import("@/components/map/LocationPicker"));

type SessionType = "lecture" | "lab" | "online";
type PinMode = "rotating" | "static";
type StepIndex = 0 | 1 | 2 | 3;
const LAST_STEP: StepIndex = 3;
const TITLE_MAX_LENGTH = 255;

interface FormState {
    title: string;
    sessionType: SessionType;
    sectionIds: number[];
    date: string;
    start: string;
    late: string;
    end: string;
    pin: PinMode;
    requireMobile: boolean;
    requireNetwork: boolean;
    gps: boolean;
    lat?: number;
    lng?: number;
    radius: number;
}

function initialForm(sections: Section[], now: Date): FormState {
    const start = toTimeInput(now);
    return {
        title: "",
        sessionType: "lecture",
        sectionIds: sections.map((s) => s.id),
        date: toDateInput(now),
        start,
        late: addMinutesToClock(start, 15),
        end: addMinutesToClock(start, 120),
        pin: "rotating",
        // Same as every session before these switches existed.
        requireMobile: true,
        requireNetwork: true,
        gps: false,
        lat: undefined,
        lng: undefined,
        radius: 50,
    };
}

interface Preset {
    key: string;
    label: string;
    labelEn: string;
    detail: string;
    detailEn: string;
    apply: Partial<FormState>;
}

const PRESETS: Preset[] = [
    { key: "max", label: "ปลอดภัยสูงสุด", labelEn: "Strictest", detail: "มือถือ, เครือข่าย มข., GPS", detailEn: "Phone, KKU network, GPS", apply: { pin: "rotating", requireMobile: true, requireNetwork: true, gps: true, radius: 50 } },
    { key: "standard", label: "มาตรฐาน (แบบเดิม)", labelEn: "Standard (as before)", detail: "มือถือ, เครือข่าย มข.", detailEn: "Phone, KKU network", apply: { pin: "rotating", requireMobile: true, requireNetwork: true, gps: false } },
    { key: "field", label: "นอกสถานที่", labelEn: "Off site", detail: "มือถือ, GPS ตามจุดที่ปัก", detailEn: "Phone, GPS at your pin", apply: { pin: "rotating", requireMobile: true, requireNetwork: false, gps: true, radius: 100 } },
    { key: "open", label: "ยืดหยุ่น", labelEn: "Flexible", detail: "PIN อย่างเดียว ทุกอุปกรณ์", detailEn: "PIN only, any device", apply: { pin: "rotating", requireMobile: false, requireNetwork: false, gps: false } },
];

const TYPE_OPTIONS: { key: SessionType; icon: string; label: string; labelEn: string; hint: string; hintEn: string }[] = [
    { key: "lecture", icon: "solar:presentation-graph-linear", label: "บรรยาย", labelEn: "Lecture", hint: "เรียนในห้องบรรยาย", hintEn: "In the lecture room" },
    { key: "lab", icon: "solar:monitor-smartphone-linear", label: "ปฏิบัติการ", labelEn: "Lab", hint: "ลงมือทำในห้องปฏิบัติการ", hintEn: "Hands-on session" },
    { key: "online", icon: "solar:videocamera-record-linear", label: "ออนไลน์", labelEn: "Online", hint: "นักศึกษาเรียนจากที่อื่น", hintEn: "Students join remotely" },
];

const STEP_LABELS = [
    { long: "ข้อมูลรอบ", short: "ข้อมูล", longEn: "Details", shortEn: "Details" },
    { long: "เวลา", short: "เวลา", longEn: "Time", shortEn: "Time" },
    { long: "ความปลอดภัย", short: "ความปลอดภัย", longEn: "Security", shortEn: "Security" },
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

function RuleMessages({ messages, isEnglish, blockHead }: { messages: RuleMessage[]; isEnglish: boolean; blockHead?: string }) {
    if (!messages.length) return null;
    return (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
            {messages.map((m, i) => {
                const tone = TONE_CLASS[m.tone];
                const head = m.tone === "block" && blockHead ? blockHead : isEnglish ? tone.headEn : tone.head;
                return (
                    <div key={`${m.tone}-${i}`} className={`flex flex-col gap-0.5 rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed sm:flex-row sm:gap-2.5 ${tone.box}`}>
                        <b className="shrink-0 font-semibold">{head}</b>
                        <span>{m.text}</span>
                    </div>
                );
            })}
        </div>
    );
}

function Toggle({ on, onChange, label, detail, invalid, children }: { on: boolean; onChange: (v: boolean) => void; label: string; detail: string; invalid?: boolean; children?: ReactNode }) {
    return (
        <div className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors ${invalid ? "border-2 border-danger-400 bg-danger-50/60 dark:bg-danger-500/10" : on ? "border-indigo-200 bg-indigo-50/40 dark:border-indigo-500/30 dark:bg-indigo-500/5" : "border-default-200 bg-content1"}`}>
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[0.9375rem] font-semibold text-foreground">{label}</p>
                    <p className="text-[0.8125rem] text-default-600">{detail}</p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={label}
                    onClick={() => onChange(!on)}
                    className={`flex h-[30px] w-[52px] shrink-0 cursor-pointer rounded-full p-[3px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${invalid ? "justify-end bg-danger-500" : on ? "justify-end bg-indigo-600" : "justify-start bg-default-300"}`}
                >
                    <span className="h-6 w-6 rounded-full bg-white shadow" />
                </button>
            </div>
            {children}
        </div>
    );
}

interface CreateAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
    isCourseActive?: boolean;
    sections: Section[];
    existingSessions: AttendanceSession[];
    onCreated: (session: AttendanceSession) => void;
}

function CreateAttendanceModalComponent({ isOpen, onClose, courseId, isCourseActive = true, sections, existingSessions, onCreated }: CreateAttendanceModalProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const t = (th: string, en: string) => (isEnglish ? en : th);

    const [now, setNow] = useState(() => new Date());
    const [form, setForm] = useState<FormState>(() => initialForm(sections, new Date()));
    const [step, setStep] = useState<StepIndex>(0);
    const [attempted, setAttempted] = useState<boolean[]>([false, false, false, false]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const stepChangedByUser = useRef(false);

    // Reset on every open; the clock ticks while the modal is open so "starts
    // in 2 hours" and "already late" stay true as the instructor fills it in.
    useEffect(() => {
        if (!isOpen) return;
        const opened = new Date();
        setNow(opened);
        setForm(initialForm(sections, opened));
        setStep(0);
        setAttempted([false, false, false, false]);
        setServerError(null);
        stepChangedByUser.current = false;
        const timer = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(timer);
    }, [isOpen, sections]);

    useEffect(() => {
        contentRef.current?.scrollTo({ top: 0 });
        if (stepChangedByUser.current) headingRef.current?.focus({ preventScroll: true });
    }, [step]);

    const update = (patch: Partial<FormState>) => {
        setServerError(null);
        setForm((prev) => ({ ...prev, ...patch }));
    };
    const onPinMoved = useCallback((lat: number, lng: number) => {
        setServerError(null);
        setForm((prev) => ({ ...prev, lat, lng }));
    }, []);

    const online = form.sessionType === "online";
    const trimmedTitle = form.title.trim();
    const titleError = !trimmedTitle
        ? t("กรอกชื่อรอบการเช็กชื่อ", "Enter a session title.")
        : trimmedTitle.length > TITLE_MAX_LENGTH
            ? t(`ชื่อรอบยาวได้ไม่เกิน ${TITLE_MAX_LENGTH} ตัวอักษร`, `Keep the title within ${TITLE_MAX_LENGTH} characters.`)
            : null;
    const sectionsError = sections.length === 0
        ? t("รายวิชานี้ยังไม่มีกลุ่มเรียน เพิ่มกลุ่มเรียนก่อนสร้างรอบเช็กชื่อ", "This course has no sections yet. Add a section first.")
        : form.sectionIds.length === 0
            ? t("เลือกกลุ่มเรียนอย่างน้อย 1 กลุ่ม", "Choose at least one section.")
            : null;

    const existingWindows = useMemo<ExistingSessionWindow[]>(
        () => existingSessions.map((s) => ({
            title: s.title,
            start: new Date(s.start_time),
            end: new Date(s.end_time),
            sectionIds: s.course_section_ids?.length ? s.course_section_ids : s.course_section_id ? [s.course_section_id] : [],
        })),
        [existingSessions],
    );

    const time = checkTime({ date: form.date, start: form.start, late: form.late, end: form.end, sectionIds: form.sectionIds }, now, existingWindows, isEnglish);
    const security = checkSecurity({
        sessionType: form.sessionType,
        pin: form.pin,
        requireMobile: online ? false : form.requireMobile,
        requireNetwork: online ? false : form.requireNetwork,
        gps: online ? false : form.gps,
        lat: form.lat,
        lng: form.lng,
        radius: form.radius,
    }, isEnglish);

    const stepValid = [!titleError && !sectionsError, !time.blocked, !security.blocked, !titleError && !sectionsError && !time.blocked && !security.blocked];
    const isDirty = form.title.trim() !== "" || form.gps;

    const picked = sections.filter((s) => form.sectionIds.includes(s.id));
    const people = picked.reduce((sum, s) => sum + (s.studentCount || 0), 0);
    const typeOption = TYPE_OPTIONS.find((o) => o.key === form.sessionType) ?? TYPE_OPTIONS[0];
    const openMinutes = minutesBetweenClocks(form.start, form.end);
    const lateAfter = minutesBetweenClocks(form.start, form.late);
    const latePct = openMinutes > 0 ? Math.max(0, Math.min(100, (lateAfter / openMinutes) * 100)) : 0;
    const dayText = time.startAt ? formatDayLabel(time.startAt, isEnglish) : form.date;
    const timeSummary = time.blocked
        ? t("เวลายังไม่ถูกต้อง", "The time is not valid yet.")
        : isEnglish
            ? `${dayText}, ${form.start} to ${form.end}, late after ${form.late}`
            : `${dayText} ${form.start} ถึง ${form.end} น. สายหลัง ${form.late} น.`;
    const sectionSummary = picked.length
        ? isEnglish
            ? `Section ${picked.map((s) => s.section_no).join(", ")}${people ? ` (${people} students)` : ""}`
            : `กลุ่ม ${picked.map((s) => s.section_no).join(", ")}${people ? ` รวม ${people} คน` : ""}`
        : t("ยังไม่ได้เลือกกลุ่มเรียน", "No section chosen");
    const securityParts = [form.pin === "rotating" ? t("PIN เปลี่ยนทุกนาที", "PIN rotates every minute") : t("PIN คงที่", "Fixed PIN")];
    if (!online && form.requireMobile) securityParts.push(t("มือถือเท่านั้น", "Phones only"));
    if (!online && form.requireNetwork) securityParts.push(t("เครือข่าย มข.", "KKU network"));
    if (!online && form.gps) securityParts.push(t(`GPS ${form.radius} ม.`, `GPS ${form.radius} m`));
    const levelNames = isEnglish ? ["Low", "Basic", "Medium", "High", "Highest"] : ["ต่ำ", "พื้นฐาน", "ปานกลาง", "สูง", "สูงสุด"];
    const levelColors = ["bg-danger-500", "bg-amber-500", "bg-yellow-500", "bg-emerald-600", "bg-emerald-700"];
    const securitySummary = security.blocked
        ? security.messages[0]?.text ?? ""
        : `${securityParts.join(", ")} (${t("ระดับ", "level ")}${levelNames[security.level]})`;

    const status = (() => {
        if (time.blocked) return { chip: t("แก้เวลาก่อน", "Fix the time"), title: t("ยังสร้างไม่ได้", "Can't create yet"), detail: time.messages[0]?.text ?? "", cls: "border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200" };
        if (time.state === "future" && time.startAt && time.endAt) {
            return {
                chip: t(`เปิดอีก ${formatShortSpan(time.startAt.getTime() - now.getTime(), false)}`, `Opens in ${formatShortSpan(time.startAt.getTime() - now.getTime(), true)}`),
                title: t("เปิดให้เองเมื่อถึงเวลา", "Opens on its own"),
                detail: timeSummary,
                cls: "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100",
            };
        }
        const warned = time.state === "running" || time.messages.some((m) => m.tone === "warn");
        return {
            chip: t("เปิดทันที", "Opens now"),
            title: t("เปิดรับทันทีเมื่อกดสร้าง", "Opens as soon as you create it"),
            detail: t(`ถึง ${form.end} น.`, `Until ${form.end}`),
            cls: warned
                ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
        };
    })();

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

    const useCurrentLocation = () => {
        if (!navigator.geolocation) {
            addToast({ title: t("ไม่รองรับ", "Not supported"), description: t("เบราว์เซอร์นี้ดึงตำแหน่งไม่ได้", "This browser cannot share its location."), color: "danger", timeout: 3000 });
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                onPinMoved(pos.coords.latitude, pos.coords.longitude);
                setIsLocating(false);
            },
            (err) => {
                setIsLocating(false);
                addToast({
                    title: t("ดึงตำแหน่งไม่สำเร็จ", "Couldn't get your location"),
                    description: err.code === err.PERMISSION_DENIED
                        ? t("ไม่ได้อนุญาตให้เข้าถึงตำแหน่ง เปิดสิทธิ์ในการตั้งค่าเบราว์เซอร์ หรือปักหมุดบนแผนที่แทน", "Location access was denied. Allow it in browser settings, or click the map instead.")
                        : t("ลองใหม่อีกครั้ง หรือปักหมุดบนแผนที่แทน", "Try again, or click the map instead."),
                    color: "danger",
                    timeout: 4000,
                });
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
    };

    const submit = async () => {
        if (isSubmitting) return;
        const firstInvalid = stepValid.findIndex((v) => !v);
        if (firstInvalid !== -1) {
            markAttempted(firstInvalid);
            moveTo(firstInvalid as StepIndex);
            return;
        }
        const startAt = combineLocal(form.date, form.start);
        const endAt = combineLocal(form.date, form.end);
        const lateAt = combineLocal(form.date, form.late);
        if (!startAt || !endAt || !lateAt) return;
        const ids = form.sectionIds;
        const gps = !online && form.gps;
        const data: CreateAttendanceData = {
            course_id: courseId,
            course_section_id: ids.length === 1 ? ids[0] : null,
            course_section_ids: ids,
            title: trimmedTitle,
            auto_rotate_pin: form.pin === "rotating",
            session_type: form.sessionType,
            check_location: gps,
            location_lat: gps ? form.lat : undefined,
            location_lng: gps ? form.lng : undefined,
            radius_meters: form.radius,
            start_time: startAt.toISOString(),
            end_time: endAt.toISOString(),
            late_threshold_minutes: Math.round((lateAt.getTime() - startAt.getTime()) / 60000),
            late_threshold_time: `${form.late}:00`,
            require_mobile: online ? false : form.requireMobile,
            require_campus_network: online ? false : form.requireNetwork,
        };
        setIsSubmitting(true);
        setServerError(null);
        try {
            const { session, message, problems } = await attendanceService.createSessionWithResult(data);
            if (!session) {
                setServerError(describeSettingsProblems(problems, isEnglish) || message || t("สร้างรอบเช็กชื่อไม่สำเร็จ ลองใหม่อีกครั้ง", "The session was not created. Try again."));
                return;
            }
            onCreated(session);
        } catch (error) {
            console.error("Failed to create attendance session:", error);
            setServerError(t("สร้างรอบเช็กชื่อไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองใหม่", "The session was not created. Check your connection and try again."));
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
    const primaryDisabled = isLast && (!isCourseActive || !stepValid[3]);
    const primaryLabel = !isLast
        ? t("ถัดไป", "Next")
        : !stepValid[3]
            ? t("แก้ข้อที่สร้างไม่ได้ก่อน", "Fix the blocking issues first")
            : time.state === "future"
                ? t(`สร้างรอบ (เปิด ${dayText} ${form.start} น.)`, `Create (opens ${dayText} ${form.start})`)
                : t("สร้างและเปิดเช็กชื่อ", "Create and open check-in");
    const primaryClass = !isLast
        ? instructorPrimaryButtonClass("min-w-28")
        : time.state === "future"
            ? instructorFlatButtonClass("min-w-28 bg-indigo-600 text-white data-[hover=true]:bg-indigo-700")
            : instructorFlatButtonClass("min-w-28 bg-emerald-700 text-white data-[hover=true]:bg-emerald-800");
    const footerHint = isLast && !isCourseActive
        ? t("รายวิชานี้ปิดแล้ว สร้างรอบเช็กชื่อไม่ได้", "This course is closed, so sessions cannot be created.")
        : t(`ขั้นที่ ${step + 1} จาก 4`, `Step ${step + 1} of 4`);

    const heading = (title: string, detail: string) => (
        <div className="space-y-1">
            <h3 ref={headingRef} tabIndex={-1} className="text-[1.375rem] font-semibold leading-tight text-foreground outline-none sm:text-2xl">{title}</h3>
            <p className="max-w-[65ch] text-sm leading-relaxed text-default-600">{detail}</p>
        </div>
    );
    const chip = (on: boolean) =>
        `h-10 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${on ? "border-indigo-600 bg-indigo-600 font-semibold text-white" : "border-default-300 bg-content1 text-default-700 hover:border-default-400"}`;
    const timeInputClass = (bad?: boolean, late?: boolean) =>
        `h-11 w-full rounded-xl border px-3 text-base text-foreground outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm ${bad ? "border-danger-500 bg-danger-50 dark:bg-danger-500/10" : late ? "border-amber-300 bg-content1 dark:border-amber-500/50" : "border-default-300 bg-content1"}`;

    // ---- steps ----
    const renderDetails = () => (
        <div className="flex flex-col gap-6">
            {heading(t("ข้อมูลรอบ", "Session details"), t("ตั้งชื่อรอบ เลือกประเภทการเรียน และกลุ่มเรียนที่ต้องเช็กชื่อ", "Name the session, choose the class type, and pick the sections."))}
            <Input
                label={<>{t("ชื่อรอบการเช็กชื่อ", "Session title")} <span className="font-normal text-default-500">{t("(ต้องระบุ)", "(required)")}</span></>}
                labelPlacement="outside"
                placeholder={t("เช่น เช็กชื่อสัปดาห์ที่ 1, Lab 1", "e.g. Week 1 attendance, Lab 1")}
                variant="bordered"
                value={form.title}
                maxLength={TITLE_MAX_LENGTH}
                onValueChange={(v) => update({ title: v })}
                isInvalid={attempted[0] && !!titleError}
                errorMessage={attempted[0] ? titleError ?? undefined : undefined}
                classNames={inputClassNames}
                autoComplete="off"
            />
            <fieldset>
                <legend className="mb-2.5 text-sm font-medium text-default-700">{t("ประเภทการเรียน", "Class type")}</legend>
                <div className="grid grid-cols-3 gap-2.5">
                    {TYPE_OPTIONS.map((o) => {
                        const on = form.sessionType === o.key;
                        return (
                            <button
                                key={o.key}
                                type="button"
                                aria-pressed={on}
                                onClick={() => update(o.key === "online" ? { sessionType: o.key, requireNetwork: false, gps: false } : { sessionType: o.key })}
                                className={`flex min-h-[6.5rem] flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:p-4 ${on ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/12" : "border-default-200 bg-content1 hover:border-default-300"}`}
                            >
                                <span className={`mb-1 flex h-9 w-9 items-center justify-center rounded-xl ${on ? "bg-indigo-600 text-white" : "bg-default-100 text-default-500"}`}><Icon icon={o.icon} className="text-xl" aria-hidden="true" /></span>
                                <span className="text-[0.9375rem] font-semibold text-foreground">{isEnglish ? o.labelEn : o.label}</span>
                                <span className="hidden text-[0.8125rem] text-default-600 sm:block">{isEnglish ? o.hintEn : o.hint}</span>
                            </button>
                        );
                    })}
                </div>
            </fieldset>
            <fieldset>
                <div className="mb-2.5 flex items-center justify-between gap-3">
                    <legend className="text-sm font-medium text-default-700">{t("กลุ่มเรียน", "Sections")}</legend>
                    {sections.length > 1 && (
                        <button type="button" className="py-2 text-sm font-medium text-indigo-700 underline underline-offset-2 dark:text-indigo-300" onClick={() => update({ sectionIds: form.sectionIds.length === sections.length ? [] : sections.map((s) => s.id) })}>
                            {form.sectionIds.length === sections.length ? t("ไม่เลือกทั้งหมด", "Clear all") : t("เลือกทั้งหมด", "Select all")}
                        </button>
                    )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sections.map((s) => {
                        const checked = form.sectionIds.includes(s.id);
                        return (
                            <label key={s.id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-500 ${checked ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/12" : "border-default-200 bg-content1 hover:border-default-300"}`}>
                                <input type="checkbox" className="h-5 w-5 shrink-0 accent-indigo-600" checked={checked} onChange={() => update({ sectionIds: checked ? form.sectionIds.filter((id) => id !== s.id) : [...form.sectionIds, s.id] })} />
                                <span className="min-w-0">
                                    <span className="block text-[0.9375rem] font-semibold text-foreground">{t(`กลุ่ม ${s.section_no}`, `Section ${s.section_no}`)}</span>
                                    <span className="text-[0.8125rem] text-default-600">{[s.note, s.studentCount ? t(`${s.studentCount} คน`, `${s.studentCount} students`) : null].filter(Boolean).join(", ") || " "}</span>
                                </span>
                            </label>
                        );
                    })}
                </div>
                {attempted[0] && sectionsError && <p role="alert" className="mt-2 text-sm text-danger-600 dark:text-danger-400">{sectionsError}</p>}
            </fieldset>
        </div>
    );

    const renderTime = () => (
        <div className="flex flex-col gap-5">
            {heading(t("เวลา", "Time"), t("กำหนดวัน เวลาเปิดรับ เวลานับสาย และเวลาปิดรับในที่เดียว ระบบตรวจให้ทันทีว่าสร้างได้หรือไม่", "Set the date, open time, late cutoff and close time in one place. The checks run as you type."))}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-default-700">
                    {t("วันที่", "Date")}
                    <input type="date" className={timeInputClass(time.bad.date)} min={toDateInput(now)} max={(() => { const d = new Date(now); d.setDate(d.getDate() + MAX_AHEAD_DAYS); return toDateInput(d); })()} value={form.date} onChange={(e) => update({ date: e.target.value })} />
                </label>
                <Button
                    variant="flat"
                    className="h-11 bg-blue-50 px-3 text-sm font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                    startContent={<Icon icon="solar:clock-circle-linear" className="text-lg" aria-hidden="true" />}
                    onPress={() => {
                        const s = toTimeInput(new Date());
                        const keepOpen = openMinutes > 0 ? openMinutes : 120;
                        const keepLate = lateAfter >= 0 ? lateAfter : 15;
                        setNow(new Date());
                        update({ date: toDateInput(new Date()), start: s, end: addMinutesToClock(s, keepOpen), late: addMinutesToClock(s, Math.min(keepLate, keepOpen)) });
                    }}
                >
                    {t("เริ่มตอนนี้", "Start now")}
                </Button>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-default-700">{t("เปิดรับ", "Opens")}<input type="time" className={timeInputClass(time.bad.start)} value={form.start} onChange={(e) => update({ start: e.target.value })} /></label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">{t("นับสาย", "Late after")}<input type="time" className={timeInputClass(time.bad.late, true)} min={form.start} max={form.end} value={form.late} onChange={(e) => update({ late: e.target.value })} /></label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-default-700">{t("ปิดรับ", "Closes")}<input type="time" className={timeInputClass(time.bad.end)} min={form.start} value={form.end} onChange={(e) => update({ end: e.target.value })} /></label>
            </div>
            <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
                <div aria-hidden="true" className="flex h-3.5 overflow-hidden rounded-full bg-default-200">
                    <span className="h-full bg-emerald-600 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${latePct}%` }} />
                    <span className="h-full flex-1 bg-amber-500" />
                </div>
                <div className="relative mt-2 h-10 text-xs text-default-700 sm:text-[0.8125rem]">
                    <span className="absolute left-0"><b className="block tabular-nums">{form.start}</b>{t("เปิดรับ", "Opens")}</span>
                    <span className="absolute -translate-x-1/2 text-center text-amber-800 dark:text-amber-300" style={{ left: `${Math.min(Math.max(latePct, 14), 86)}%` }}><b className="block tabular-nums">{form.late}</b>{t("นับสาย", "Late")}</span>
                    <span className="absolute right-0 text-right"><b className="block tabular-nums">{form.end}</b>{t("ปิดรับ", "Closes")}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-default-200 pt-3">
                    <span className="w-full text-[0.8125rem] text-default-600 sm:w-24">{t("ระยะเวลา", "Duration")}</span>
                    {[60, 90, 120, 180].map((m) => (
                        <button key={m} type="button" aria-pressed={openMinutes === m} className={chip(openMinutes === m)} onClick={() => update({ end: addMinutesToClock(form.start, m) })}>
                            {m % 60 === 0 ? t(`${m / 60} ชม.`, `${m / 60} h`) : t(`${Math.floor(m / 60)} ชม. ${m % 60} นาที`, `${Math.floor(m / 60)} h ${m % 60} min`)}
                        </button>
                    ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="w-full text-[0.8125rem] text-default-600 sm:w-24">{t("สายหลังเริ่ม", "Late after")}</span>
                    {[5, 10, 15, 20, 30].map((m) => (
                        <button key={m} type="button" aria-pressed={lateAfter === m} className={chip(lateAfter === m)} onClick={() => update({ late: addMinutesToClock(form.start, m) })}>
                            {t(`${m} นาที`, `${m} min`)}
                        </button>
                    ))}
                </div>
            </div>
            <RuleMessages messages={time.messages} isEnglish={isEnglish} />
        </div>
    );

    const renderSecurity = () => (
        <div className="flex flex-col gap-5">
            {heading(t("ความปลอดภัย", "Security"), t("เปิดเฉพาะการตรวจที่ต้องการ ระบบเตือนทันทีถ้าค่าที่เลือกขัดกันเอง", "Turn on only the checks you need. You are warned right away if they contradict each other."))}
            <div className="flex items-center gap-3 rounded-2xl border border-default-200 bg-default-50 px-4 py-3">
                <span className="shrink-0 text-sm text-default-600">{t("ความปลอดภัย", "Security")}</span>
                <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-default-200">
                    <span className={`block h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${security.blocked ? "bg-danger-500" : levelColors[security.level]}`} style={{ width: `${security.blocked ? 100 : Math.max(8, security.level * 25)}%` }} />
                </span>
                <span className={`shrink-0 text-sm font-semibold ${security.blocked ? "text-danger-600 dark:text-danger-400" : "text-foreground"}`}>
                    {security.blocked ? t("ค่าขัดกัน แก้ก่อนไปต่อ", "Conflicting, fix to continue") : `${t("ระดับ", "Level: ")}${levelNames[security.level]}`}
                </span>
            </div>
            {!online && (
                <fieldset>
                    <legend className="mb-2.5 text-sm font-medium text-default-700">{t("เริ่มจากชุดค่าที่ใช้บ่อย แล้วปรับเองได้", "Start from a preset, then adjust")}</legend>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                        {PRESETS.map((p) => {
                            const on = (Object.keys(p.apply) as (keyof FormState)[]).every((k) => form[k] === p.apply[k]);
                            return (
                                <button key={p.key} type="button" aria-pressed={on} onClick={() => update(p.apply)}
                                    className={`flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${on ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/12" : "border-default-200 bg-content1 hover:border-default-300"}`}>
                                    <span className="text-sm font-semibold text-foreground">{isEnglish ? p.labelEn : p.label}</span>
                                    <span className="text-xs text-default-600">{isEnglish ? p.detailEn : p.detail}</span>
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
            )}
            <fieldset>
                <legend className="mb-2.5 text-sm font-medium text-default-700">{t("รหัส PIN", "PIN")}</legend>
                <div role="radiogroup" aria-label={t("รหัส PIN", "PIN")} className="grid grid-cols-2 gap-1 rounded-xl bg-default-100 p-1">
                    {(["rotating", "static"] as PinMode[]).map((p) => {
                        const on = form.pin === p;
                        return (
                            <button key={p} type="button" role="radio" aria-checked={on} onClick={() => update({ pin: p })}
                                className={`h-11 rounded-lg text-[0.9375rem] transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${on ? "bg-content1 font-semibold text-indigo-700 shadow-sm dark:text-indigo-200" : "font-medium text-default-600"}`}>
                                {p === "rotating" ? t("เปลี่ยนทุก 1 นาที", "Rotates every minute") : t("คงที่ตลอดรอบ", "Fixed for the session")}
                            </button>
                        );
                    })}
                </div>
            </fieldset>
            {online ? (
                <p className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                    {t("รอบออนไลน์ไม่ตรวจอุปกรณ์ เครือข่าย และ GPS เพราะนักศึกษาเรียนจากที่อื่น ใช้ PIN อย่างเดียว", "Online sessions skip the device, network and GPS checks because students join from elsewhere. Only the PIN applies.")}
                </p>
            ) : (
                <>
                    <Toggle on={form.requireMobile} onChange={(v) => update({ requireMobile: v })} invalid={security.bad.mobile}
                        label={t("ใช้ได้เฉพาะมือถือหรือแท็บเล็ต", "Phones and tablets only")}
                        detail={t("ไม่รับการเช็กชื่อจากคอมพิวเตอร์ ระบบดูจากข้อมูลเบราว์เซอร์", "Computers can't check in. Detected from the browser.")} />
                    <Toggle on={form.requireNetwork} onChange={(v) => update({ requireNetwork: v })} invalid={security.bad.network}
                        label={t("ต้องใช้เครือข่ายของ มข. เท่านั้น", "KKU network only")}
                        detail={t("KKU-WiFi หรือสาย LAN ในมหาวิทยาลัย ไม่รับเน็ตมือถือและ VPN", "KKU-WiFi or campus LAN. Mobile data and VPN are refused.")} />
                    <Toggle on={form.gps} onChange={(v) => update({ gps: v })} invalid={security.bad.gps}
                        label={t("ตรวจตำแหน่ง GPS", "Check GPS location")}
                        detail={t("ต้องอยู่ในรัศมีจากหมุดที่ปักจึงเช็กชื่อได้", "Students must be within the radius of your pin.")}>
                        {form.gps && (
                            <div className="flex flex-col gap-3">
                                <Suspense fallback={<div className="flex h-[300px] items-center justify-center rounded-xl border border-default-200 bg-default-100 text-sm text-default-600">{t("กำลังโหลดแผนที่", "Loading map")}</div>}>
                                    <LocationPicker latitude={form.lat} longitude={form.lng} radius={form.radius} onLocationChange={onPinMoved} highlightAreas={KKU_CAMPUS_AREAS} />
                                </Suspense>
                                <p className="text-[0.8125rem] text-default-600">{t("กรอบเส้นประสีเขียวคือเขตมหาวิทยาลัย", "The dashed green outline is the campus boundary.")}</p>
                                {typeof form.lat === "number" && typeof form.lng === "number" ? (
                                    <p className={`text-sm font-medium tabular-nums ${insideKKUCampus(form.lat, form.lng) ? "text-default-700" : "text-danger-600 dark:text-danger-400"}`}>
                                        {t("หมุด", "Pin")}: {form.lat.toFixed(6)}, {form.lng.toFixed(6)} {insideKKUCampus(form.lat, form.lng) ? "" : t("(นอกมหาวิทยาลัย)", "(off campus)")}
                                    </p>
                                ) : (
                                    <p className="text-sm font-medium text-danger-600 dark:text-danger-400">{t("ยังไม่ได้ปักหมุด คลิกบนแผนที่ หรือใช้ตำแหน่งปัจจุบัน", "No pin yet. Click the map or use your current location.")}</p>
                                )}
                                <Button variant="bordered" className="h-11 border-dashed border-blue-300 text-blue-700 dark:border-blue-500/50 dark:text-blue-200" isLoading={isLocating}
                                    startContent={!isLocating && <Icon icon="solar:gps-linear" className="text-lg" aria-hidden="true" />} onPress={useCurrentLocation}>
                                    {t("ใช้ตำแหน่งปัจจุบันของเครื่อง", "Use this device's location")}
                                </Button>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="w-full text-[0.8125rem] text-default-600 sm:w-28">{t("รัศมีจากหมุด", "Radius")}</span>
                                    {[10, 50, 100, 200].map((r) => (
                                        <button key={r} type="button" aria-pressed={form.radius === r} className={chip(form.radius === r)} onClick={() => update({ radius: r })}>{t(`${r} ม.`, `${r} m`)}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Toggle>
                </>
            )}
            <RuleMessages messages={security.messages} isEnglish={isEnglish} blockHead={t("บันทึกไม่ได้", "Can't save")} />
        </div>
    );

    const reviewRows = [
        { label: t("ชื่อรอบ", "Title"), value: trimmedTitle || t("ยังไม่ได้กรอก", "Not entered"), ok: !titleError, at: 0 as StepIndex },
        { label: t("ประเภทและกลุ่ม", "Type and sections"), value: `${isEnglish ? typeOption.labelEn : typeOption.label}, ${sectionSummary}`, ok: !sectionsError, at: 0 as StepIndex },
        { label: t("เวลา", "Time"), value: timeSummary, ok: !time.blocked, at: 1 as StepIndex },
        { label: t("ความปลอดภัย", "Security"), value: securitySummary, ok: !security.blocked, at: 2 as StepIndex },
    ];

    const renderReview = () => (
        <div className="flex flex-col gap-4">
            {heading(t("ตรวจทานและสร้าง", "Review and create"), t("ตรวจทุกค่าอีกครั้ง ปุ่มสร้างบอกว่าเปิดรับทันทีหรือรอเวลา", "Check everything once more. The create button says whether check-in opens now or later."))}
            <div className="lg:hidden">{renderPreview()}</div>
            <ul className="divide-y divide-default-200 rounded-2xl border border-default-200">
                {reviewRows.map((r) => (
                    <li key={r.label} className="flex min-h-14 items-center gap-3 px-4 py-3">
                        <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.ok ? "bg-emerald-600" : "bg-danger-500"}`} />
                        <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-3">
                            <span className="block text-[0.8125rem] text-default-600 sm:w-32 sm:shrink-0 sm:text-sm">{r.label}</span>
                            <span className={`block text-[0.9375rem] font-medium ${r.ok ? "text-foreground" : "text-danger-700 dark:text-danger-300"}`}>{r.value}{!r.ok && <span className="sr-only"> {t("(ยังไม่ถูกต้อง)", "(needs fixing)")}</span>}</span>
                        </span>
                        <button type="button" className="min-h-11 shrink-0 px-1 text-sm font-medium text-indigo-700 underline underline-offset-2 dark:text-indigo-300" onClick={() => moveTo(r.at)}>{t("แก้ไข", "Edit")}</button>
                    </li>
                ))}
            </ul>
            <RuleMessages messages={time.messages} isEnglish={isEnglish} />
            {serverError && (
                <div role="alert" className="flex flex-col gap-0.5 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-sm text-danger-800 sm:flex-row sm:gap-2.5 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
                    <b className="shrink-0 font-semibold">{t("ระบบไม่รับ", "Refused")}</b><span>{serverError}</span>
                </div>
            )}
        </div>
    );

    function renderPreview() {
        return (
            <div className="rounded-2xl border border-default-200 bg-default-100/70 p-3 dark:bg-default-50">
                <p className="mb-2.5 px-1 text-[0.8125rem] font-medium text-default-600">{t("ตัวอย่างรอบเช็กชื่อ", "Session preview")}</p>
                <div className="space-y-2.5 rounded-xl bg-content1 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                    <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200">{isEnglish ? typeOption.labelEn : typeOption.label}</span>
                    <p className="break-words text-[1.0625rem] font-semibold leading-snug text-foreground">{trimmedTitle || t("[ชื่อรอบ]", "[Session title]")}</p>
                    <p className="text-[0.8125rem] text-default-600">{sectionSummary}</p>
                    <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-default-200"><span className="h-full bg-emerald-600" style={{ width: `${latePct}%` }} /><span className="h-full flex-1 bg-amber-500" /></div>
                    <p className="text-[0.8125rem] text-default-700">{timeSummary}</p>
                    <div className="flex flex-wrap gap-1.5 border-t border-default-200 pt-2.5">
                        {securityParts.map((p) => <span key={p} className="rounded-full bg-default-100 px-2.5 py-0.5 text-xs font-medium text-default-700">{p}</span>)}
                    </div>
                </div>
            </div>
        );
    }

    const content = [renderDetails, renderTime, renderSecurity, renderReview][step];

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
                base: "!m-0 h-full max-h-full w-full max-w-full !rounded-none sm:!m-6 sm:h-[min(54rem,calc(100dvh-3rem))] sm:max-w-5xl sm:!rounded-2xl",
            }}
        >
            <ModalContent className="flex flex-col overflow-hidden border-default-200 bg-content1 text-foreground sm:border">
                <ModalHeader className="flex shrink-0 items-center gap-3 border-b border-divider px-4 py-3 sm:px-7 sm:py-4">
                    <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:flex dark:bg-blue-500/15 dark:text-blue-200">
                        <Icon icon="solar:clipboard-check-linear" className="text-2xl" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-[1.0625rem] font-semibold leading-tight text-foreground sm:text-xl">{t("สร้างรอบเช็กชื่อ", "Create attendance session")}</h2>
                        <p className="truncate text-[0.8125rem] font-normal text-default-600">{trimmedTitle || t("ยังไม่ได้ตั้งชื่อรอบ", "Untitled session")}</p>
                    </div>
                    <span className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline ${status.cls}`}>{status.chip}</span>
                    <Button isIconOnly variant="light" className="h-11 w-11 min-w-11 shrink-0 text-default-600" aria-label={t("ปิด", "Close")} onPress={onClose} isDisabled={isSubmitting}>
                        <Icon icon="solar:close-circle-linear" className="text-2xl" aria-hidden="true" />
                    </Button>
                </ModalHeader>

                <nav aria-label={t("ขั้นตอนการสร้างรอบเช็กชื่อ", "Session steps")} className="shrink-0 border-b border-divider px-2 pb-3 pt-3 sm:px-12 sm:pt-4">
                    <ol className="relative grid grid-cols-4">
                        <span aria-hidden="true" className="absolute bottom-[0.8125rem] left-[12.5%] right-[12.5%] h-0.5 rounded-full bg-default-200" />
                        <span aria-hidden="true" className="absolute bottom-[0.8125rem] left-[12.5%] h-0.5 rounded-full bg-indigo-500 transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${step * 25}%` }} />
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
                        {renderPreview()}
                        <div className={`rounded-2xl border px-4 py-3.5 ${status.cls}`} aria-live="polite">
                            <p className="text-sm font-semibold">{status.title}</p>
                            <p className="mt-0.5 text-[0.8125rem] leading-relaxed">{status.detail}</p>
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

export const CreateAttendanceModal = memo(CreateAttendanceModalComponent);
