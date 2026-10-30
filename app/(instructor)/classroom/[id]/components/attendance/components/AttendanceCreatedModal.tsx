"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import type { AttendanceSession } from "@/services/attendance.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { getAppUrl } from "@/lib/app-url";
import { isStaticPinSession } from "@/hooks/useAttendancePinPresentation";
import { formatClock, formatDayLabel, formatSpan } from "@/lib/attendance/session-rules";
import type { Section } from "../config";

const QR_SVG_ID = "attendance-created-qr";

interface AttendanceCreatedModalProps {
    session: AttendanceSession | null;
    courseId: string;
    sections: Section[];
    onClose: () => void;
    onConnectProjector?: (session: AttendanceSession) => void;
}

function safeFileName(title: string): string {
    return title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, "-").slice(0, 60) || "attendance";
}

function bodyFont(): string {
    return getComputedStyle(document.body).fontFamily || "sans-serif";
}

function savePng(canvas: HTMLCanvasElement, name: string) {
    const link = document.createElement("a");
    link.download = `${name}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
}

/** Draws the on-screen QR SVG into a canvas at any size, so prints stay sharp. */
function loadQrImage(): Promise<HTMLImageElement | null> {
    const svg = document.getElementById(QR_SVG_ID);
    if (!svg) return Promise.resolve(null);
    const data = new XMLSerializer().serializeToString(svg);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(data)));
    });
}

function AttendanceCreatedModalComponent({ session, courseId, sections, onClose, onConnectProjector }: AttendanceCreatedModalProps) {
    const router = useRouter();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const t = (th: string, en: string) => (isEnglish ? en : th);
    const [now, setNow] = useState(() => new Date());
    const [feedback, setFeedback] = useState("");
    const feedbackTimer = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!session) return;
        setNow(new Date());
        setFeedback("");
        const timer = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(timer);
    }, [session]);
    useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);

    if (!session) return null;

    const say = (text: string) => {
        setFeedback(text);
        window.clearTimeout(feedbackTimer.current);
        feedbackTimer.current = window.setTimeout(() => setFeedback(""), 4000);
    };

    const startAt = new Date(session.start_time);
    const endAt = new Date(session.end_time);
    const lateAt = new Date(startAt.getTime() + (session.late_threshold_minutes || 0) * 60000);
    const isFuture = startAt.getTime() > now.getTime();
    const hasEnded = endAt.getTime() <= now.getTime();
    const latePassed = !isFuture && now.getTime() >= lateAt.getTime() && lateAt.getTime() < endAt.getTime();
    const isStatic = isStaticPinSession(session);
    const pin = isStatic ? session.pin_code || "" : "";
    const checkInUrl = getAppUrl(`/check-in/${session.id}`);
    const fileBase = safeFileName(session.title);

    const sectionIds = session.course_section_ids?.length ? session.course_section_ids : session.course_section_id ? [session.course_section_id] : [];
    const picked = sections.filter((s) => sectionIds.includes(s.id));
    const people = picked.reduce((sum, s) => sum + (s.studentCount || 0), 0);
    const sectionText = picked.length
        ? isEnglish
            ? `${picked.map((s) => s.section_no).join(", ")}${people ? `, ${people} students` : ""}`
            : `${picked.map((s) => s.section_no).join(", ")}${people ? ` รวม ${people} คน` : ""}`
        : t("ทุกกลุ่ม", "All sections");
    const typeText = session.session_type === "lab" ? t("ปฏิบัติการ", "Lab") : session.session_type === "online" ? t("ออนไลน์", "Online") : t("บรรยาย", "Lecture");
    const sameDay = startAt.toDateString() === now.toDateString();
    const dayText = sameDay ? t("วันนี้", "Today") : formatDayLabel(startAt, isEnglish);
    const whenText = isEnglish
        ? `${dayText}, ${formatClock(startAt, true)} to ${formatClock(endAt, true)}`
        : `${dayText} ${formatClock(startAt, false).replace(" น.", "")} ถึง ${formatClock(endAt, false)}`;
    const lateText = lateAt.getTime() < endAt.getTime()
        ? t(`สายหลัง ${formatClock(lateAt, false)}`, `Late after ${formatClock(lateAt, true)}`)
        : t("ไม่มีช่วงนับสาย", "No late window");

    const online = session.session_type === "online";
    const secParts = [isStatic ? t("PIN คงที่", "Fixed PIN") : t("PIN เปลี่ยนทุก 1 นาที", "PIN rotates every minute")];
    if (!online && session.require_mobile !== false) secParts.push(t("มือถือเท่านั้น", "Phones only"));
    if (!online && session.require_campus_network !== false) secParts.push(t("เครือข่าย มข.", "KKU network"));
    if (!online && session.check_location) secParts.push(t(`GPS ${session.radius_meters} ม.`, `GPS ${session.radius_meters} m`));

    const bannerTitle = isFuture
        ? t(`รอเปิดรับเช็กชื่อ อีก ${formatSpan(startAt.getTime() - now.getTime(), false)}`, `Opens in ${formatSpan(startAt.getTime() - now.getTime(), true)}`)
        : hasEnded
            ? t("รอบนี้ปิดรับแล้ว", "This session has closed")
            : t(`เปิดรับเช็กชื่ออยู่ตอนนี้ ถึง ${formatClock(endAt, false)}`, `Check-in is open now, until ${formatClock(endAt, true)}`);
    const bannerDetail = isFuture
        ? t(`ระบบเปิดให้เอง ${formatDayLabel(startAt, false)} เวลา ${formatClock(startAt, false)} ไม่ต้องกดเริ่มเอง`, `It opens on its own on ${formatDayLabel(startAt, true)} at ${formatClock(startAt, true)}. No need to start it.`)
        : hasEnded
            ? t("ดูผลการเช็กชื่อได้จากรายการรอบเช็กชื่อ", "See the results in the session list.")
            : t(`เหลือเวลา ${formatSpan(endAt.getTime() - now.getTime(), false)} นักศึกษาเช็กชื่อได้ทันที`, `${formatSpan(endAt.getTime() - now.getTime(), true)} left. Students can check in now.`);

    const copy = async (text: string, done: string) => {
        try {
            await navigator.clipboard.writeText(text);
            say(done);
        } catch {
            say(t("คัดลอกไม่สำเร็จ", "Couldn't copy"));
        }
    };

    const downloadQr = async () => {
        const img = await loadQrImage();
        if (!img) return say(t("ดาวน์โหลดไม่สำเร็จ", "Download failed"));
        const size = 1024;
        const pad = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size + pad * 2;
        canvas.height = size + pad * 2;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, pad, pad, size, size);
        savePng(canvas, `${fileBase}-QR`);
        say(t("ดาวน์โหลด QR แล้ว", "QR downloaded"));
    };

    const downloadPin = async () => {
        if (!pin) return;
        await document.fonts?.ready;
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 600;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const font = bodyFont();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 1200, 600);
        ctx.fillStyle = "#475569";
        ctx.textAlign = "center";
        ctx.font = `500 40px ${font}`;
        ctx.fillText(session.title, 600, 110, 1080);
        ctx.font = `400 30px ${font}`;
        ctx.fillText(t("รหัส PIN เช็กชื่อ", "Check-in PIN"), 600, 170);
        const digits = pin.split("");
        const box = 140;
        const gap = 24;
        const total = digits.length * box + (digits.length - 1) * gap;
        digits.forEach((d, i) => {
            const x = 600 - total / 2 + i * (box + gap);
            ctx.fillStyle = "#eef2ff";
            ctx.strokeStyle = "#c7d2fe";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(x, 230, box, 180, 24);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#312e81";
            ctx.font = `700 110px ${font}`;
            ctx.fillText(d, x + box / 2, 360);
        });
        ctx.fillStyle = "#475569";
        ctx.font = `400 30px ${font}`;
        ctx.fillText(isEnglish ? `${whenText}, ${lateText}` : `${whenText} ${lateText}`, 600, 500, 1080);
        savePng(canvas, `${fileBase}-PIN`);
        say(t("ดาวน์โหลด PIN แล้ว", "PIN downloaded"));
    };

    const downloadPoster = async () => {
        const img = await loadQrImage();
        if (!img) return say(t("ดาวน์โหลดไม่สำเร็จ", "Download failed"));
        await document.fonts?.ready;
        const W = 1240;
        const H = 1754;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const font = bodyFont();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center";
        ctx.fillStyle = "#0f172a";
        ctx.font = `600 64px ${font}`;
        ctx.fillText(session.title, W / 2, 170, W - 160);
        ctx.fillStyle = "#475569";
        ctx.font = `400 38px ${font}`;
        ctx.fillText(isEnglish ? `${whenText}, ${lateText}` : `${whenText} ${lateText}`, W / 2, 240, W - 160);
        ctx.fillText(t(`กลุ่ม ${sectionText}`, `Section ${sectionText}`), W / 2, 296, W - 160);
        const qr = 760;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, (W - qr) / 2, 370, qr, qr);
        ctx.fillStyle = "#0f172a";
        ctx.font = `500 40px ${font}`;
        ctx.fillText(t("สแกน QR แล้วกรอกรหัส PIN", "Scan the QR, then enter the PIN"), W / 2, 1220);
        if (pin) {
            ctx.fillStyle = "#312e81";
            ctx.font = `700 200px ${font}`;
            ctx.fillText(pin.split("").join(" "), W / 2, 1460);
        }
        ctx.fillStyle = "#64748b";
        ctx.font = `400 30px ${font}`;
        ctx.fillText(checkInUrl, W / 2, 1620, W - 160);
        savePng(canvas, `${fileBase}-poster`);
        say(t("ดาวน์โหลดแผ่นประกาศแล้ว", "Poster downloaded"));
    };

    const goLive = () => {
        onClose();
        router.push(`/attendance/${courseId}/session/${session.id}/live`);
    };

    const tone = isFuture
        ? { icon: "bg-indigo-600", banner: "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100", dot: "bg-indigo-500" }
        : hasEnded
            ? { icon: "bg-default-500", banner: "border-default-200 bg-default-100 text-default-800", dot: "bg-default-400" }
            : { icon: "bg-emerald-600", banner: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100", dot: "bg-emerald-500 ring-[5px] ring-emerald-500/20" };
    const softBtn = "h-11 bg-blue-50 px-4 text-[0.9375rem] font-medium text-blue-700 data-[hover=true]:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:data-[hover=true]:bg-blue-500/25";

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="3xl"
            placement="center"
            scrollBehavior="inside"
            hideCloseButton
            classNames={{
                wrapper: "overflow-hidden",
                base: "!m-0 h-full max-h-full w-full max-w-full !rounded-none sm:!m-6 sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:max-w-3xl sm:!rounded-2xl",
            }}
        >
            <ModalContent className="flex flex-col overflow-hidden bg-content1 text-foreground">
                <ModalHeader className="flex shrink-0 items-center gap-4 px-4 pb-3 pt-5 sm:px-7 sm:pt-6">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white sm:h-14 sm:w-14 ${tone.icon}`}>
                        <Icon icon="solar:check-read-linear" className="text-3xl" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-semibold leading-tight text-foreground sm:text-[1.375rem]">
                            {isFuture ? t("สร้างรอบเช็กชื่อแล้ว", "Session created") : t("สร้างและเปิดเช็กชื่อแล้ว", "Created and open for check-in")}
                        </h2>
                        <p className="mt-0.5 text-sm font-normal text-default-600">
                            {isEnglish ? `${session.title}, ${typeText}, section ${sectionText}` : `${session.title}, ${typeText}, กลุ่ม ${sectionText}`}
                        </p>
                    </div>
                    <Button isIconOnly variant="light" className="h-11 w-11 min-w-11 shrink-0 text-default-600" aria-label={t("ปิด", "Close")} onPress={onClose}>
                        <Icon icon="solar:close-circle-linear" className="text-2xl" aria-hidden="true" />
                    </Button>
                </ModalHeader>

                <ModalBody className="min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-5 pt-1 sm:px-7">
                    <div role="status" className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 ${tone.banner}`}>
                        <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${tone.dot}`} />
                        <span>
                            <span className="block text-base font-semibold">{bannerTitle}</span>
                            <span className="text-sm">{bannerDetail}</span>
                        </span>
                    </div>

                    {latePassed && !hasEnded && (
                        <div className="flex flex-col gap-0.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm leading-relaxed text-amber-900 sm:flex-row sm:gap-2.5 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                            <b className="shrink-0 font-semibold">{t("ตรวจอีกครั้ง", "Check again")}</b>
                            <span>{t(
                                `เลยเวลานับสาย ${formatClock(lateAt, false)} แล้ว นักศึกษาที่เช็กชื่อตั้งแต่ตอนนี้จะถูกนับว่าสายทุกคน แก้เวลาได้ที่เมนูแก้ไขของรอบนี้`,
                                `The late cutoff ${formatClock(lateAt, true)} has passed. Everyone who checks in from now on will be marked late. You can change the time from this session's edit menu.`,
                            )}</span>
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14.75rem] sm:items-start sm:gap-5">
                        <div className="flex flex-col gap-3.5">
                            <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-2xl border border-default-200 px-4 py-3.5 text-sm leading-relaxed">
                                <dt className="text-default-600">{t("วันและเวลา", "When")}</dt>
                                <dd className="font-medium text-foreground">{whenText}<span className="block font-normal text-amber-800 dark:text-amber-300">{lateText}</span></dd>
                                <dt className="text-default-600">{t("กลุ่มเรียน", "Sections")}</dt>
                                <dd className="font-medium text-foreground">{sectionText}</dd>
                                <dt className="text-default-600">{t("ความปลอดภัย", "Security")}</dt>
                                <dd className="font-medium text-foreground">{secParts.join(", ")}</dd>
                            </dl>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[0.8125rem] text-default-600">{t("ลิงก์เช็กชื่อ", "Check-in link")}</span>
                                <div className="flex gap-2">
                                    <code className="min-w-0 flex-1 truncate rounded-xl border border-default-200 bg-default-50 px-3 py-2.5 text-[0.8125rem] text-blue-700 dark:text-blue-300">{checkInUrl}</code>
                                    <Button variant="bordered" className="h-11 border-default-300 text-sm font-medium" onPress={() => copy(checkInUrl, t("คัดลอกลิงก์แล้ว", "Link copied"))}>
                                        {t("คัดลอก", "Copy")}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-default-200 bg-default-50 p-3.5">
                            <div className="rounded-lg bg-white p-2">
                                <QRCodeSVG id={QR_SVG_ID} value={checkInUrl} size={180} level="M" fgColor="#0f172a" bgColor="#ffffff" marginSize={0} role="img" aria-label={t("QR code สำหรับเช็กชื่อ", "Check-in QR code")} />
                            </div>
                            <span className="text-center text-xs text-default-600">{t("QR ใช้ได้ตลอด ไม่เปลี่ยนตาม PIN", "The QR never changes, even when the PIN does.")}</span>
                            {!isFuture && (
                                <Button className={`${softBtn} w-full`} startContent={<Icon icon="solar:download-minimalistic-linear" className="text-lg" aria-hidden="true" />} onPress={downloadQr}>
                                    {t("ดาวน์โหลด QR", "Download QR")}
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 rounded-2xl border border-default-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[0.9375rem] font-semibold">{t("รหัส PIN", "PIN")}</span>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isStatic ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"}`}>
                                {isStatic ? t("คงที่ตลอดรอบ", "Fixed for the session") : t("เปลี่ยนทุก 1 นาที", "Rotates every minute")}
                            </span>
                        </div>
                        {isStatic && pin ? (
                            <div className="flex flex-wrap items-center gap-3.5">
                                <div aria-label={`PIN ${pin}`} className="flex gap-1.5 sm:gap-2">
                                    {pin.split("").map((d, i) => (
                                        <span key={i} aria-hidden="true" className="flex h-14 w-11 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-[1.875rem] font-bold tabular-nums text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-100">{d}</span>
                                    ))}
                                </div>
                                <Button variant="bordered" className="h-11 border-default-300 text-sm font-medium" onPress={() => copy(pin, t("คัดลอก PIN แล้ว", "PIN copied"))}>
                                    {t("คัดลอก PIN", "Copy PIN")}
                                </Button>
                            </div>
                        ) : (
                            <p className="text-sm leading-relaxed text-default-600">
                                {isStatic
                                    ? t("PIN ยังไม่พร้อม เปิดดูได้จากปุ่ม QR ของรอบนี้ในรายการ", "The PIN isn't ready yet. Open it later from this session's QR button in the list.")
                                    : isFuture
                                        ? t("PIN จะแสดงบนหน้าเช็กชื่อเมื่อเปิดรับ และเปลี่ยนทุก 1 นาที จึงดาวน์โหลดล่วงหน้าไม่ได้ ตอนเริ่มคาบให้เปิดหน้าเช็กชื่อบนจอฉายในห้อง", "The PIN appears on the check-in page once it opens and changes every minute, so it can't be downloaded ahead. At the start of class, show the check-in page on the projector.")
                                        : t("PIN แสดงอยู่บนหน้าเช็กชื่อและเปลี่ยนทุก 1 นาที กดไปหน้าเช็กชื่อแล้วฉายขึ้นจอให้นักศึกษาเห็น", "The PIN is on the check-in page and changes every minute. Go to the check-in page and put it on the projector.")}
                            </p>
                        )}
                    </div>

                    {isFuture && (
                        <div className="flex flex-col gap-2">
                            <span className="text-[0.9375rem] font-semibold">{t("เตรียมก่อนถึงเวลา", "Get ready ahead of time")}</span>
                            <div className="flex flex-wrap gap-2">
                                {isStatic && pin && (
                                    <Button className="h-11 bg-indigo-600 px-4 text-[0.9375rem] font-medium text-white data-[hover=true]:bg-indigo-700" startContent={<Icon icon="solar:download-minimalistic-linear" className="text-lg" aria-hidden="true" />} onPress={downloadPoster}>
                                        {t("แผ่นประกาศ QR และ PIN", "QR and PIN poster")}
                                    </Button>
                                )}
                                <Button className={softBtn} startContent={<Icon icon="solar:download-minimalistic-linear" className="text-lg" aria-hidden="true" />} onPress={downloadQr}>
                                    {t("ดาวน์โหลด QR", "Download QR")}
                                </Button>
                                {isStatic && pin && (
                                    <Button className={softBtn} startContent={<Icon icon="solar:download-minimalistic-linear" className="text-lg" aria-hidden="true" />} onPress={downloadPin}>
                                        {t("ดาวน์โหลด PIN", "Download PIN")}
                                    </Button>
                                )}
                            </div>
                            <p className="text-[0.8125rem] text-default-600">{t("ใช้ใส่สไลด์ ติดหน้าห้อง หรือตั้งเวลาโพสต์ในกลุ่มรายวิชา ไฟล์เป็น PNG", "For slides, the classroom door, or a scheduled post in the course group. Files are PNG.")}</p>
                        </div>
                    )}
                </ModalBody>

                <ModalFooter className="shrink-0 flex-col-reverse gap-2 border-t border-divider px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-3.5">
                    <span aria-live="polite" className="min-h-5 text-center text-sm font-medium text-emerald-700 sm:text-left dark:text-emerald-400">{feedback}</span>
                    <div className="flex w-full gap-2.5 sm:w-auto">
                        {isFuture || hasEnded ? (
                            <Button className="h-12 flex-1 bg-foreground px-6 text-[0.9375rem] font-medium text-background sm:h-11 sm:flex-none" onPress={onClose}>
                                {t("เสร็จสิ้น", "Done")}
                            </Button>
                        ) : (
                            <>
                                {onConnectProjector && (
                                    <Button variant="bordered" className="h-12 flex-1 border-default-300 text-[0.9375rem] font-medium sm:h-11 sm:flex-none" onPress={() => onConnectProjector(session)}>
                                        {t("เชื่อมต่อจอฉาย", "Connect a projector")}
                                    </Button>
                                )}
                                <Button className="h-12 flex-[2] bg-emerald-700 px-6 text-[0.9375rem] font-medium text-white data-[hover=true]:bg-emerald-800 sm:h-11 sm:flex-none" endContent={<Icon icon="solar:arrow-right-linear" className="text-lg" aria-hidden="true" />} onPress={goLive}>
                                    {t("ไปหน้าเช็กชื่อ", "Go to check-in")}
                                </Button>
                            </>
                        )}
                    </div>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

export const AttendanceCreatedModal = memo(AttendanceCreatedModalComponent);
