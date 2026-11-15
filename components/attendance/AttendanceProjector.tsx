"use client";

import { useEffect, useRef, useState } from "react";
import localFont from "next/font/local";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import type { AttendanceRecord, AttendanceSession } from "@/services/attendance.service";
import styles from "./AttendanceProjector.module.css";

const projectorFont = localFont({
    src: [
        { path: "../../public/fonts/attendance/NotoSansThai-Regular.ttf", weight: "400", style: "normal" },
        { path: "../../public/fonts/attendance/NotoSansThai-SemiBold.ttf", weight: "600", style: "normal" },
        { path: "../../public/fonts/attendance/NotoSansThai-ExtraBold.ttf", weight: "800", style: "normal" },
    ],
    display: "swap",
});

type Props = {
    session: AttendanceSession;
    records: AttendanceRecord[];
    isEnglish: boolean;
    statusLabel: string;
    countdownLabel: string;
    countdownValue: string;
    subtitle: string;
    checkInUrl: string;
    checkInEnded: boolean;
    notStarted: boolean;
    pinMessage: string;
    pinCountdown: number | null;
    pinTotal: number | null;
    rotating: boolean;
    checkedIn: number;
    totalStudents: number;
    present: number;
    late: number;
    isClosing: boolean;
    onCopyPin: () => void;
    onExpandQR: () => void;
    onOpenRoster: () => void;
    onSelectRecord: (record: AttendanceRecord) => void;
    onCloseSession: () => void;
};

/** Projector surface: deliberately light regardless of the instructor's app theme. */
export default function AttendanceProjector(props: Props) {
    const { session, isEnglish, checkInEnded, notStarted } = props;
    const t = (thai: string, english: string) => isEnglish ? english : thai;
    const scanRef = useRef<HTMLDivElement>(null);
    const captionRef = useRef<HTMLDivElement>(null);
    const [qrSize, setQrSize] = useState(240);

    useEffect(() => {
        const scan = scanRef.current;
        const caption = captionRef.current;
        if (!scan || !caption) return;
        const observer = new ResizeObserver(() => {
            const available = Math.min(scan.clientWidth, scan.clientHeight - caption.offsetHeight - 12);
            setQrSize(Math.max(48, Math.floor(available)));
        });
        observer.observe(scan);
        observer.observe(caption);
        return () => observer.disconnect();
    }, [checkInEnded, notStarted]);

    const canCheckIn = !checkInEnded && !notStarted;
    const pin = session.pin_code || "";
    const displayPin = pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin;
    const sections = session.sections?.map(section => section.section_no).join(", ")
        || session.section?.section_no;
    const pinProgress = props.pinCountdown !== null && props.pinTotal
        ? Math.max(0, Math.min(100, props.pinCountdown / props.pinTotal * 100)) : 100;
    const networkNote = session.session_type !== "online" && session.require_campus_network !== false
        ? t("ใช้ Wi-Fi มหาวิทยาลัย", "Use campus Wi-Fi")
        : t("สแกน QR หรือกรอก PIN ในเมนูเช็กชื่อ", "Scan QR or enter the PIN in Check-in");

    return (
        <main className={`${styles.screen} ${projectorFont.className}`} aria-label={t("จอเช็กชื่อเข้าเรียน", "Live attendance display")}>
            <header className={styles.header}>
                <div className={styles.course}>
                    <h1 title={session.course?.name || session.title}>{session.course?.name || session.title}</h1>
                    <p>{session.course?.code || ""}{sections ? ` · ${t("กลุ่ม", "Section")} ${sections}` : ""}</p>
                    {props.subtitle && <p className={styles.subtitle} title={props.subtitle}>{props.subtitle}</p>}
                </div>
                <div className={styles.sessionMeta}>
                    <span className={styles.status}>
                        <Icon icon={canCheckIn ? "solar:check-circle-linear" : "solar:clock-circle-linear"} aria-hidden="true" />
                        {props.statusLabel}
                    </span>
                    {!checkInEnded && <span className={styles.clock}>{props.countdownLabel} <strong>{props.countdownValue}</strong></span>}
                </div>
            </header>

            <section className={styles.pinPanel} aria-label={t("รหัสเช็กชื่อ", "Check-in PIN")}>
                <h2>{t("รหัสเช็กชื่อ", "Check-in PIN")}</h2>
                {canCheckIn && pin ? (
                    <button type="button" className={styles.pin} onClick={props.onCopyPin} aria-label={t(`คัดลอกรหัส PIN ${pin}`, `Copy PIN ${pin}`)}>{displayPin}</button>
                ) : (
                    <p className={styles.unavailable}>{checkInEnded ? t("ปิดรับการเช็กชื่อแล้ว", "Check-in has ended") : props.pinMessage}</p>
                )}
                {canCheckIn && pin && <div className={styles.rotation}>
                    {props.rotating ? <>
                        <div className={styles.track} aria-hidden="true"><span style={{ width: `${pinProgress}%` }} /></div>
                        <span>{t("รหัสใหม่ใน", "New PIN in")} <b>{props.pinCountdown ?? "--"}</b> {t("วินาที", "s")}</span>
                    </> : <span>{t("PIN คงที่ตลอดรอบนี้", "This PIN stays fixed for this session")}</span>}
                </div>}
            </section>

            <section className={styles.scan} ref={scanRef} aria-label={t("QR สำหรับเช็กชื่อ", "Check-in QR code")}>
                {canCheckIn ? <>
                    <button type="button" className={styles.qrButton} onClick={props.onExpandQR} aria-label={t("ขยาย QR Code", "Enlarge QR code")}>
                        <QRCodeSVG value={props.checkInUrl} size={qrSize} level="M" marginSize={4} boostLevel fgColor="#000000" bgColor="#ffffff" />
                    </button>
                    <div className={styles.scanCaption} ref={captionRef}>{t("สแกน QR เพื่อเช็กชื่อ", "Scan QR to check in")}</div>
                </> : <div className={styles.scanUnavailable}>
                    <Icon icon="solar:clock-circle-linear" aria-hidden="true" />
                    <h2>{checkInEnded ? t("รอบเช็กชื่อนี้สิ้นสุดแล้ว", "This check-in window has ended") : t("ยังไม่ถึงเวลาเริ่มเช็กชื่อ", "Check-in has not started")}</h2>
                    <p>{checkInEnded ? t("QR Code และ PIN ปิดใช้งานแล้ว", "The QR code and PIN are no longer active") : props.countdownValue}</p>
                </div>}
            </section>

            <section className={styles.summary} aria-label={t("สรุปการเช็กชื่อ", "Attendance summary")}>
                <div><h2>{t("เช็กชื่อแล้ว", "Checked in")}</h2><p className={styles.breakdown}>{t("มา", "Present")} {props.present} · {t("สาย", "Late")} {props.late} · {t("ยังไม่เช็กชื่อ", "Not yet")} {Math.max(0, props.totalStudents - props.checkedIn)}</p></div>
                <p className={styles.total}><strong>{props.checkedIn}</strong><span> / {props.totalStudents} {t("คน", "students")}</span></p>
            </section>

            <section className={styles.latest} aria-label={t("เช็กชื่อล่าสุด", "Latest check-ins")}>
                <h2>{t("เช็กชื่อล่าสุด", "Latest check-ins")}</h2>
                {props.records.length ? props.records.slice(0, 2).map(record => <button type="button" key={record.id} onClick={() => props.onSelectRecord(record)} className={styles.recentRecord} title={record.student?.full_name}>
                    <span>{record.student?.full_name || t("นักศึกษา", "Student")}</span>
                    <span>{record.status === "late" ? t("สาย", "Late") : t("เช็กชื่อแล้ว", "Checked in")}</span>
                </button>) : <p>{t("ยังไม่มีนักศึกษาเช็กชื่อ", "No students have checked in yet")}</p>}
            </section>

            <footer className={styles.footer}>
                <p>{networkNote}</p>
                <div className={styles.actions}>
                    <button type="button" onClick={props.onOpenRoster}>{t("รายชื่อทั้งหมด", "All check-ins")}</button>
                    {session.status === "active" && <button type="button" onClick={props.onCloseSession} disabled={props.isClosing}>{props.isClosing ? t("กำลังปิด…", "Closing…") : t("ปิดรับเช็กชื่อ", "Close check-in")}</button>}
                </div>
            </footer>
        </main>
    );
}
