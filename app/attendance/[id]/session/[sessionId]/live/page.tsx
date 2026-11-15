"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Avatar } from "@heroui/avatar";
import {
    Table,
    TableHeader,
    TableBody,
    TableColumn,
    TableRow,
    TableCell,
} from "@heroui/table";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Input } from "@heroui/input";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import AttendanceProjector from "@/components/attendance/AttendanceProjector";
import Loading from "./loading";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { isRotatingPinSession, useAttendancePinPresentation } from "@/hooks/useAttendancePinPresentation";
import { buildCourseTitleContext, buildPageTitle } from "@/lib/page-title";
import { getAppUrl } from "@/lib/app-url";
import { getRealtimeSocketBaseUrl, io, Socket } from "@/services/realtime-socket";
import attendanceService, {
    type AttendanceSession,
    type AttendanceRecord,
} from "@/services/attendance.service";

// Status display config
const statusConfig: Record<
    string,
    {
        label: string;
        labelEn: string;
        color: "success" | "warning" | "danger" | "default";
        icon: string;
    }
> = {
    present: { label: "มา", labelEn: "Present", color: "success", icon: "solar:check-circle-bold" },
    late: { label: "สาย", labelEn: "Late", color: "warning", icon: "solar:clock-circle-bold" },
    leave: { label: "ลา", labelEn: "On leave", color: "default", icon: "solar:document-bold" },
    absent: { label: "ขาด", labelEn: "Absent", color: "danger", icon: "solar:close-circle-bold" },
};

// Format time
function formatTime(dateString: string | null, isEnglish = false): string {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleTimeString(isEnglish ? "en-US" : "th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function formatClock(dateString: string | null, isEnglish = false): string {
    if (!dateString) return "--:--";
    return new Date(dateString).toLocaleTimeString(isEnglish ? "en-US" : "th-TH", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getStatusLabel(status: string, isEnglish = false): string {
    const config = statusConfig[status];
    if (!config) return status;
    return isEnglish ? config.labelEn : config.label;
}

function formatDistance(distanceMeters: number, isEnglish = false): string {
    if (distanceMeters < 1000) {
        return `${Math.round(distanceMeters)} ${isEnglish ? "m" : "ม."}`;
    }

    return `${(distanceMeters / 1000).toFixed(1)} ${isEnglish ? "km" : "กม."}`;
}

export default function LiveAttendancePage() {
    const params = useParams();
    const router = useRouter();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const sessionId = Number(params.sessionId);
    const t = (thai: string, english: string) => (isEnglish ? english : thai);
    const formatStudentCount = (count: number) =>
        isEnglish ? `${count} ${count === 1 ? "student" : "students"}` : `${count} คน`;

    // State
    const [session, setSession] = useState<AttendanceSession | null>(null);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [timeRemaining, setTimeRemaining] = useState<{
        hours: number;
        minutes: number;
        seconds: number;
    } | null>(null);
    const [isPastLateThreshold, setIsPastLateThreshold] = useState(false);
    const [lateThresholdDisplay, setLateThresholdDisplay] = useState<string | null>(null);
    const [isClosing, setIsClosing] = useState(false);

    // Socket
    const socketRef = useRef<Socket | null>(null);
    const hasWarnedAboutConnectError = useRef(false);
    const lastKnownPinRef = useRef("");
    const pinSyncInFlightRef = useRef(false);

    // Modal states
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [newStatus, setNewStatus] = useState<string>("");
    const [statusNote, setStatusNote] = useState("");
    const [originalStatus, setOriginalStatus] = useState<string>("");
    const [originalNote, setOriginalNote] = useState<string>("");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // QR / full roster modals
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);
    const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);

    // Campus Wi-Fi / device reminder shown once when the projector page opens
    const [showNetworkReminder, setShowNetworkReminder] = useState(true);

    // Search filter (ใช้ในหน้าต่างรายชื่อทั้งหมด)
    const [searchQuery, setSearchQuery] = useState("");
    const { secondsLeft: pinCountdown, totalSeconds: pinTotal } = useAttendancePinPresentation(session);

    // ── ขนาดหน้าต่างและโปรไฟล์ขนาดจอ ──
    const [viewportWidth, setViewportWidth] = useState(1600);
    const [viewportHeight, setViewportHeight] = useState(900);
    useEffect(() => {
        const update = () => {
            setViewportWidth(window.innerWidth);
            setViewportHeight(window.innerHeight);
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    // Calculate stats
    const stats = {
        total: records.length,
        present: records.filter((r) => r.status === "present").length,
        late: records.filter((r) => r.status === "late").length,
        leave: records.filter((r) => r.status === "leave").length,
        absent: records.filter((r) => r.status === "absent").length,
        checkedIn: records.filter((r) => r.check_in_time).length,
        notCheckedIn: records.filter((r) => !r.check_in_time).length,
    };

    // Fetch session and records
    const refreshSession = useCallback(async () => {
        const sessionData = await attendanceService.getSession(sessionId);
        if (sessionData) {
            setSession(sessionData);
        }
        return sessionData;
    }, [sessionId]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [sessionData, recordsData] = await Promise.all([
                refreshSession(),
                attendanceService.getRecords(sessionId),
            ]);

            if (sessionData) {
                setSession(sessionData);
            }

            setRecords(recordsData);
        } catch (error) {
            console.error("Error fetching data:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถโหลดข้อมูลได้", "Unable to load the data."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, [refreshSession, sessionId, isEnglish]);

    // Initialize socket connection
    useEffect(() => {
        const socketUrl = getRealtimeSocketBaseUrl();

        const socket = io(socketUrl, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        // The instructor room streams the live PIN and every check-in record, so
        // the hub now refuses to admit a client without a ticket minted behind
        // the same permission checks that guard this page. Fetch one on every
        // connect (tickets are short-lived, and a reconnect needs a fresh one).
        let disposed = false;
        // Every check-in that lands while this socket is down (a network
        // blip, a backend restart during the burst) is missed — the room
        // resubscribe above only gets FUTURE events, not what already
        // happened. A reconnect has to pull the current roster the same way
        // the student check-in page pulls the current PIN on its own
        // reconnect (plan.md ระยะ 3). The very first connect is skipped —
        // the mount effect below already calls fetchData().
        let hasConnectedBefore = false;

        const joinInstructorRoom = async () => {
            try {
                const ticket = await attendanceService.getSocketTicket(sessionId);
                if (disposed || !socket.connected) {
                    return;
                }
                if (!ticket) {
                    console.warn("Attendance socket: no ticket issued — live updates are off for this session.");
                    return;
                }
                socket.emit("join-instructor", { ticket });
            } catch (error) {
                if (!disposed) {
                    console.error("Attendance socket: could not obtain a room ticket:", error);
                }
            }
        };

        socket.on("connect", () => {
            hasWarnedAboutConnectError.current = false;
            void joinInstructorRoom();
            if (hasConnectedBefore) {
                void fetchData();
            }
            hasConnectedBefore = true;
        });

        socket.on("instructor-join-rejected", () => {
            console.warn("Attendance socket: room join rejected, live updates are off. Reload to retry.");
        });

        // Backend fan-out (realtime/redis_bus.go, plan.md ระยะ 4.1): when a
        // multi-replica backend's bus subscription itself reconnects, every
        // replica tells its own local clients to resync — treat it exactly
        // like a reconnect on this socket, since the same "may have missed a
        // check-in or PIN update" concern applies.
        socket.on("resync", () => {
            void fetchData();
        });

        socket.on("connect_error", (err) => {
            if (!hasWarnedAboutConnectError.current) {
                const message = err instanceof Error ? err.message : "WebSocket connection error";
                console.warn("Attendance socket unavailable:", message);
                hasWarnedAboutConnectError.current = true;
            }
        });

        // Listen for new check-ins
        socket.on("student-checked-in", (data: { record: AttendanceRecord }) => {
            setRecords((prev) => {
                const existing = prev.find((r) => r.id === data.record.id);
                if (existing) {
                    return prev.map((r) => (r.id === data.record.id ? data.record : r));
                }
                return [...prev, data.record];
            });
        });

        // Listen for status updates
        socket.on("attendance-updated", (data: { record: AttendanceRecord }) => {
            setRecords((prev) =>
                prev.map((r) => (r.id === data.record.id ? data.record : r))
            );
        });

        socket.on("attendance-pin-updated", (data: { pin_code?: string; pin_issued_at?: string | null; pin_rotates_at?: string | null; auto_rotate_pin?: boolean; pin_mode?: AttendanceSession["pin_mode"]; status?: AttendanceSession["status"] }) => {
            setSession((prev) => prev
                ? {
                    ...prev,
                    pin_code: data.pin_code ?? "",
                    auto_rotate_pin: data.auto_rotate_pin ?? prev.auto_rotate_pin,
                    pin_mode: data.pin_mode ?? prev.pin_mode,
                    pin_issued_at: data.pin_issued_at ?? null,
                    pin_rotates_at: data.pin_rotates_at ?? null,
                    status: data.status ?? prev.status,
                }
                : prev);
        });

        // Listen for session closed
        socket.on("session-closed", () => {
            addToast({
                title: t("ปิดรอบเช็กชื่อแล้ว", "Check-in closed"),
                description: t("รอบการเช็กชื่อถูกปิดแล้ว", "This attendance session has been closed."),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            setSession((prev) => (prev ? { ...prev, status: "closed" } : null));
        });

        socketRef.current = socket;

        return () => {
            disposed = true;
            socket.emit("leave-instructor", sessionId);
            socket.disconnect();
        };
    }, [sessionId, isEnglish, fetchData]);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        lastKnownPinRef.current = session?.pin_code || "";
    }, [session?.pin_code]);

    useEffect(() => {
        const isRotatingMode = session?.status === "active" && isRotatingPinSession(session);

        if (!isRotatingMode || pinCountdown === null || pinCountdown > 2 || !session?.pin_code) {
            return;
        }

        if (session.pin_code !== lastKnownPinRef.current) {
            return;
        }

        let disposed = false;
        let attempts = 0;
        const maxAttempts = 20;

        const syncPinState = () => {
            if (disposed || pinSyncInFlightRef.current) {
                return;
            }
            pinSyncInFlightRef.current = true;
            refreshSession().catch((error) => {
                console.error("Live attendance pin sync fallback failed:", error);
            }).finally(() => {
                pinSyncInFlightRef.current = false;
            });
        };

        syncPinState();
        const interval = window.setInterval(() => {
            attempts += 1;
            if (attempts >= maxAttempts) {
                window.clearInterval(interval);
                return;
            }
            syncPinState();
        }, 500);

        return () => {
            disposed = true;
            window.clearInterval(interval);
        };
    }, [
        pinCountdown,
        refreshSession,
        session?.auto_rotate_pin,
        session?.pin_code,
        session?.pin_mode,
        session?.status,
    ]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            refreshSession().catch((error) => {
                console.error("Error refreshing attendance session:", error);
            });
        }, 15000);

        return () => window.clearInterval(interval);
    }, [refreshSession]);

    useEffect(() => {
        const pageLabel = isEnglish ? "Live Attendance" : "เช็กชื่อ Live";
        const courseContext = buildCourseTitleContext(session?.course);
        document.title = buildPageTitle(pageLabel, courseContext);
    }, [isEnglish, session?.course]);

    // Capture original status when modal opens
    useEffect(() => {
        if (isStatusModalOpen && selectedRecord) {
            setOriginalStatus(selectedRecord.status);
            setOriginalNote(selectedRecord.note || "");
            setNewStatus(selectedRecord.status);
            setStatusNote(selectedRecord.note || "");
        }
    }, [isStatusModalOpen, selectedRecord]);

    // Countdown timer
    useEffect(() => {
        if (!session) return;

        // Calculate late threshold time once
        let lateThreshold: Date;
        if (session.late_threshold_time) {
            // Use absolute time
            const sessionDate = new Date(session.start_time);
            const [hours, minutes, seconds = 0] = session.late_threshold_time.split(':').map(Number);
            lateThreshold = new Date(sessionDate);
            lateThreshold.setHours(hours, minutes, seconds, 0);
            // Format for display (HH:MM)
            setLateThresholdDisplay(
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
            );
        } else {
            // Fallback to relative minutes
            lateThreshold = new Date(session.start_time);
            lateThreshold.setMinutes(lateThreshold.getMinutes() + session.late_threshold_minutes);
            // Format for display
            setLateThresholdDisplay(
                lateThreshold.toLocaleTimeString(isEnglish ? "en-US" : "th-TH", { hour: "2-digit", minute: "2-digit" })
            );
        }

        const updateCountdown = () => {
            const now = new Date();
            const endTime = new Date(session.end_time);
            const startTime = new Date(session.start_time);
            const diff = endTime.getTime() - now.getTime();
            const startDiff = startTime.getTime() - now.getTime();

            // Check if past late threshold
            setIsPastLateThreshold(now > lateThreshold);

            if (startDiff > 0) {
                // ยังไม่ถึงเวลาเริ่มต้น
                const hours = Math.floor(startDiff / (1000 * 60 * 60));
                const minutes = Math.floor((startDiff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((startDiff % (1000 * 60)) / 1000);
                setTimeRemaining({ hours, minutes, seconds });
            } else if (diff <= 0) {
                // หมดเวลาแล้ว
                setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
            } else {
                // กำลังเปิดอยู่
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeRemaining({ hours, minutes, seconds });
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [session, isEnglish]);

    // ── รายชื่อที่เช็กแล้ว เรียงคนล่าสุดไว้หน้าสุด ──
    const checkedInRecords = useMemo(() => {
        return records
            .filter((r) => r.check_in_time)
            .sort((a, b) => {
                const timeA = a.check_in_time ? new Date(a.check_in_time).getTime() : 0;
                const timeB = b.check_in_time ? new Date(b.check_in_time).getTime() : 0;
                return timeB - timeA;
            });
    }, [records]);

    // Check session status
    const isSessionOpen = () => {
        if (!session) return false;
        const now = new Date();
        const start = new Date(session.start_time);
        const end = new Date(session.end_time);
        return session.status === "active" && now >= start && now <= end;
    };

    // Close session
    const handleCloseSession = async () => {
        if (!session) return;

        setIsClosing(true);
        try {
            const result = await attendanceService.closeSession(session.id);
            if (result) {
                setSession(result);
                addToast({
                    title: t("สำเร็จ", "Success"),
                    description: t("ปิดรอบการเช็กชื่อเรียบร้อยแล้ว", "The attendance session was closed successfully."),
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            console.error("Error closing session:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถปิดรอบเช็กชื่อได้", "Unable to close the attendance session."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsClosing(false);
        }
    };

    // Update record status
    const handleUpdateStatus = async () => {
        if (!selectedRecord || !newStatus) return;

        setIsUpdatingStatus(true);
        try {
            const result = await attendanceService.updateRecord(sessionId, selectedRecord.id, {
                status: newStatus,
                note: statusNote || undefined,
            });
            if (result) {
                setRecords((prev) =>
                    prev.map((r) => (r.id === selectedRecord.id ? result : r))
                );
                setIsStatusModalOpen(false);
                setSelectedRecord(null);
                setNewStatus("");
                setStatusNote("");
                addToast({
                    title: t("สำเร็จ", "Updated"),
                    description: t("อัปเดตสถานะเรียบร้อย", "Attendance status updated successfully."),
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            console.error("Error updating status:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถอัปเดตสถานะได้", "Unable to update the attendance status."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    // Generate check-in URL
    const checkInUrl = getAppUrl(`/check-in/${sessionId}`);

    // Copy PIN to clipboard
    const copyPIN = () => {
        if (session?.pin_code) {
            navigator.clipboard.writeText(session.pin_code);
            addToast({
                title: t("คัดลอกแล้ว", "Copied"),
                description: t("PIN ถูกคัดลอกไปยังคลิปบอร์ดแล้ว", "The PIN has been copied to the clipboard."),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        }
    };

    const sessionOpen = isSessionOpen();
    const now = new Date();
    const notStarted = session ? now < new Date(session.start_time) : false;
    const pinAvailabilityMessage = !session
        ? ""
        : session.status === "closed"
            ? t("PIN ถูกคืนเข้าระบบแล้ว", "PIN has been released.")
            : notStarted
                ? t("PIN จะออกเมื่อเริ่มรอบเช็กชื่อ", "PIN will be issued when check-in opens.")
                : t("กำลังออกรหัสใหม่", "Refreshing PIN");

    // Total students count (should be fetched from course enrollment)
    const totalStudents = (session?.course as { enrollment_count?: number } | undefined)?.enrollment_count || records.length || 0;

    // QR ในหน้าต่างขยาย ใหญ่ที่สุดเท่าที่จอรับได้โดยไม่ต้องเลื่อน
    const modalQrSize = Math.max(200, Math.min(460, Math.round(viewportWidth * 0.5), Math.round(viewportHeight * 0.46)));
    const modalPinFontSize = Math.max(28, Math.min(60, Math.round(viewportHeight * 0.07)));

    if (!session && !isLoading) {
        return (
            <div className="light flex min-h-screen items-center justify-center bg-white text-slate-900">
                <Card className="max-w-md border-2 border-dashed border-default-300 bg-content1 shadow-xl">
                    <CardBody className="py-12 text-center">
                        <Icon icon="solar:clipboard-remove-bold-duotone" className="mx-auto mb-4 text-6xl text-default-300" />
                        <p className="mb-2 text-lg text-default-600">{t("ไม่พบข้อมูลการเช็กชื่อ", "Attendance session not found")}</p>
                        <p className="mb-6 text-sm text-default-400">{t("กรุณาตรวจสอบลิงก์อีกครั้ง", "Please check the link and try again.")}</p>
                        <Button
                            className="w-full bg-blue-700 text-white"
                            onPress={() => router.back()}
                        >
                            {t("กลับหน้าหลัก", "Go back")}
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    if (!session) {
        return <Loading />;
    }

    const statusChip = session.status === "closed"
        ? { label: t("ปิดรับการเช็กชื่อแล้ว", "Closed"), dot: "bg-red-300" }
        : notStarted
            ? { label: t("ยังไม่ถึงเวลาเริ่ม", "Not started yet"), dot: "bg-amber-200" }
            : sessionOpen
                ? { label: t("เปิดรับอยู่", "Open now"), dot: "bg-green-300" }
                : { label: t("หมดเวลาเช็กชื่อแล้ว", "Time is up"), dot: "bg-red-300" };

    const countdownLabel = notStarted ? t("เริ่มในอีก", "Starts in") : t("ปิดรับในอีก", "Closes in");
    const countdownValue = timeRemaining
        ? `${String(timeRemaining.hours).padStart(2, "0")}:${String(timeRemaining.minutes).padStart(2, "0")}:${String(timeRemaining.seconds).padStart(2, "0")}`
        : "00:00:00";

    // รอบเช็กชื่อจบแล้ว ไม่ว่าจะถูกปิดเองหรือหมดเวลาไปตามธรรมชาติ ต้องเลิกแสดง QR และ PIN
    const checkInEnded = session.status === "closed" || (!notStarted && !sessionOpen);
    const pinRotating = isRotatingPinSession(session) && session.status === "active";

    const headerSubtitle = [
        session.title,
        lateThresholdDisplay ? (isEnglish ? `late after ${lateThresholdDisplay}` : `เกณฑ์เวลาสาย ${lateThresholdDisplay} น.`) : null,
    ].filter(Boolean).join(isEnglish ? " — " : "   ");

    return (
        <>
            <AttendanceProjector
                session={session}
                records={checkedInRecords}
                isEnglish={isEnglish}
                statusLabel={statusChip.label}
                countdownLabel={countdownLabel}
                countdownValue={countdownValue}
                subtitle={headerSubtitle}
                checkInUrl={checkInUrl}
                checkInEnded={checkInEnded}
                notStarted={notStarted}
                pinMessage={pinAvailabilityMessage}
                pinCountdown={pinCountdown}
                pinTotal={pinTotal}
                rotating={pinRotating}
                checkedIn={stats.checkedIn}
                totalStudents={totalStudents}
                present={stats.present}
                late={stats.late}
                isClosing={isClosing}
                onCopyPin={copyPIN}
                onExpandQR={() => setIsQRModalOpen(true)}
                onOpenRoster={() => setIsRosterModalOpen(true)}
                onSelectRecord={(record) => {
                    setSelectedRecord(record);
                    setIsStatusModalOpen(true);
                }}
                onCloseSession={handleCloseSession}
            />

            {/* QR เต็มจอ */}
            <Modal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} size="full">
                <ModalContent className="light bg-white text-slate-900">
                    <ModalBody className="flex h-[100dvh] flex-col items-center justify-center gap-1 overflow-hidden py-6">
                        <h2 className="mb-1 text-3xl font-bold text-foreground">{session.title}</h2>
                        <p className="mb-4 text-default-500">
                            {checkInEnded
                                ? t("รอบเช็กชื่อนี้สิ้นสุดแล้ว", "This check-in window has ended")
                                : t("สแกน QR Code เพื่อเช็กชื่อเข้าเรียน", "Scan the QR code to check in")}
                        </p>

                        {/* นาฬิกาถอยหลังของรอบเช็กชื่อ */}
                        {!checkInEnded && (
                            <div className="mb-4 flex flex-col items-center gap-1">
                                <span className="text-sm text-default-400">{countdownLabel}</span>
                                <span
                                    className={`font-mono text-4xl font-bold tabular-nums ${isPastLateThreshold ? "text-amber-500" : "text-foreground"}`}
                                >
                                    {countdownValue}
                                </span>
                            </div>
                        )}

                        {checkInEnded ? (
                            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-default-300 bg-content2 px-16 py-14 text-center">
                                <Icon icon="solar:clock-circle-bold-duotone" className="text-7xl text-default-300" />
                                <p className="text-3xl font-bold text-foreground">
                                    {t("หมดเวลาเช็กชื่อแล้ว", "Check-in time is up")}
                                </p>
                                <p className="text-default-500">
                                    {t("QR Code และรหัส PIN ถูกปิดใช้งานแล้ว", "The QR code and PIN are no longer active.")}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="rounded-3xl border-4 border-default-200 bg-white p-2 shadow-xl">
                                    <QRCodeSVG value={checkInUrl} size={modalQrSize} level="M" fgColor="#000000" bgColor="#ffffff" marginSize={4} boostLevel />
                                </div>

                                <div className="mt-6 text-center">
                                    {session.pin_code ? (
                                        <div className="inline-block rounded-2xl bg-blue-50 px-10 py-5">
                                            <p
                                                className="font-mono font-bold tracking-[0.12em] leading-none text-slate-900"
                                                style={{ fontSize: modalPinFontSize }}
                                            >
                                                {session.pin_code}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="inline-block rounded-2xl border border-dashed border-default-300 bg-content2 px-8 py-6 text-sm text-default-500">
                                            {pinAvailabilityMessage}
                                        </div>
                                    )}

                                    {/* นับถอยหลังรอบหมุน PIN เฉพาะโหมดที่ PIN เปลี่ยนทุก 1 นาที */}
                                    {pinRotating && session.pin_code ? (
                                        <div className="mx-auto mt-3 w-72">
                                            <div className="mb-1 flex items-center justify-between text-xs text-default-400">
                                                <span>{t("เปลี่ยนรหัสใน", "New PIN in")}</span>
                                                <span
                                                    className={`font-mono font-semibold tabular-nums ${
                                                        pinCountdown !== null && pinCountdown <= 10 ? "text-red-500"
                                                            : pinCountdown !== null && pinCountdown <= 20 ? "text-amber-500" : "text-default-500"
                                                    }`}
                                                >
                                                    {pinCountdown !== null ? pinCountdown : "--"} {t("วินาที", "s")}
                                                </span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-default-200">
                                                <div
                                                    className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                                                        pinCountdown !== null && pinCountdown <= 10 ? "bg-red-500"
                                                            : pinCountdown !== null && pinCountdown <= 20 ? "bg-amber-400" : "bg-blue-500"
                                                    }`}
                                                    style={{
                                                        width: pinCountdown !== null && pinTotal
                                                            ? `${Math.max(0, (pinCountdown / pinTotal) * 100)}%`
                                                            : "100%",
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-xs text-default-400">
                                            {t("PIN คงที่ตลอดรอบนี้", "This PIN stays fixed for the whole session")}
                                        </p>
                                    )}
                                </div>

                                {lateThresholdDisplay && (
                                    <div className={`mt-6 flex items-center gap-2 rounded-lg px-4 py-2 ${isPastLateThreshold ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"}`}>
                                        <Icon icon="solar:clock-circle-bold" className="text-xl" />
                                        <span className="text-sm">
                                            {isEnglish
                                                ? `Check-ins after ${lateThresholdDisplay} are marked as late`
                                                : `เช็กชื่อหลัง ${lateThresholdDisplay} น. จะถือว่าสาย`}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* รายชื่อทั้งหมด พร้อมค้นหา */}
            <Modal isOpen={isRosterModalOpen} onClose={() => setIsRosterModalOpen(false)} size="3xl" scrollBehavior="inside">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:checklist-minimalistic-linear" className="text-xl text-blue-600" />
                            {t("รายชื่อผู้เช็กชื่อ", "Checked-in students")}
                            <Chip size="sm" variant="flat" color="primary">{formatStudentCount(stats.checkedIn)}</Chip>
                        </div>
                        <Input
                            placeholder={t("ค้นหาจากชื่อหรือรหัสนักศึกษา", "Search by name or student ID")}
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                            size="sm"
                            variant="bordered"
                            isClearable
                            startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                            className="w-full sm:w-64"
                        />
                    </ModalHeader>
                    <ModalBody className="pb-6">
                        <Table aria-label="Student attendance table" removeWrapper>
                            <TableHeader>
                                {[
                                    <TableColumn key="status">{t("สถานะ", "Status")}</TableColumn>,
                                    <TableColumn key="name">{t("ชื่อนักศึกษา / รหัส", "Student / ID")}</TableColumn>,
                                    <TableColumn key="time" align="center">{t("เวลาเช็กชื่อ", "Check-in time")}</TableColumn>,
                                    ...(session.check_location ? [<TableColumn key="distance" align="center">{t("ระยะห่าง", "Distance")}</TableColumn>] : []),
                                ]}
                            </TableHeader>
                            <TableBody
                                emptyContent={
                                    <div className="py-12 text-center">
                                        <p className="font-medium text-default-500">{t("ยังไม่มีนักศึกษาเช็กชื่อ", "No students have checked in yet")}</p>
                                    </div>
                                }
                            >
                                {checkedInRecords
                                    .filter((r) => {
                                        if (!searchQuery.trim()) return true;
                                        const query = searchQuery.toLowerCase();
                                        return (
                                            r.student?.full_name?.toLowerCase().includes(query) ||
                                            r.student?.student_id?.toLowerCase().includes(query)
                                        );
                                    })
                                    .map((record) => (
                                        <TableRow
                                            key={record.id}
                                            className="cursor-pointer"
                                            onClick={() => {
                                                setSelectedRecord(record);
                                                setIsStatusModalOpen(true);
                                            }}
                                        >
                                            {[
                                                <TableCell key="status">
                                                    <Chip
                                                        size="sm"
                                                        color={statusConfig[record.status]?.color || "default"}
                                                        variant="flat"
                                                        startContent={<Icon icon={statusConfig[record.status]?.icon} className="text-xs" />}
                                                    >
                                                        {getStatusLabel(record.status, isEnglish)}
                                                    </Chip>
                                                </TableCell>,
                                                <TableCell key="name">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            name={record.student?.full_name || "?"}
                                                            size="sm"
                                                            className="bg-linear-to-br from-blue-400 to-indigo-500"
                                                        />
                                                        <div>
                                                            <p className="font-medium text-foreground">{record.student?.full_name || "-"}</p>
                                                            <p className="text-xs text-default-400">{record.student?.student_id || "-"}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>,
                                                <TableCell key="time">
                                                    <span className="font-mono text-sm text-default-600">
                                                        {formatTime(record.check_in_time, isEnglish)}
                                                    </span>
                                                </TableCell>,
                                                ...(session.check_location ? [
                                                    <TableCell key="distance">
                                                        {record.distance_meters !== null ? (
                                                            <Tooltip content={record.location_verified ? t("ตำแหน่งถูกต้อง", "Location verified") : t("ตำแหน่งไม่ตรง", "Location mismatch")}>
                                                                <Chip
                                                                    size="sm"
                                                                    variant="flat"
                                                                    color={record.location_verified ? "success" : "warning"}
                                                                    startContent={<Icon icon={record.location_verified ? "solar:map-point-bold" : "solar:map-point-wave-bold"} className="text-xs" />}
                                                                >
                                                                    {formatDistance(record.distance_meters, isEnglish)}
                                                                </Chip>
                                                            </Tooltip>
                                                        ) : (
                                                            <span className="text-xs text-default-400">-</span>
                                                        )}
                                                    </TableCell>,
                                                ] : []),
                                            ]}
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* Campus Wi-Fi / device reminder */}
            <Modal
                isOpen={showNetworkReminder && !!session && session.session_type !== "online"}
                onClose={() => setShowNetworkReminder(false)}
            >
                <ModalContent>
                    <ModalHeader>
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:wi-fi-router-bold-duotone" className="text-xl text-amber-500" />
                            {t("ข้อควรทราบก่อนเช็กชื่อ", "Before students check in")}
                        </div>
                    </ModalHeader>
                    <ModalBody className="py-4">
                        <p className="text-sm text-default-600">
                            {t(
                                "นักศึกษาต้องเชื่อมต่อ Wi-Fi ของมหาวิทยาลัยขอนแก่น (WiFi-KKU) และเช็กชื่อผ่านมือถือหรือแท็บเล็ตเท่านั้น ทั้งนี้ คอมพิวเตอร์ โน้ตบุ๊ก หรือเครือข่ายนอกมหาวิทยาลัยจะไม่สามารถเช็กชื่อได้",
                                "Students must be connected to KKU campus Wi-Fi (WiFi-KKU) and check in using a mobile phone or tablet only — desktop/laptop or off-campus networks will be blocked."
                            )}
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button color="primary" onPress={() => setShowNetworkReminder(false)}>
                            {t("เข้าใจแล้ว", "Got it")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Status Update Modal */}
            <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)}>
                <ModalContent>
                    <ModalHeader>
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:pen-new-square-linear" className="text-xl text-blue-500" />
                            {t("เปลี่ยนสถานะการเช็กชื่อ", "Change attendance status")}
                        </div>
                    </ModalHeader>
                    <ModalBody className="py-4">
                        {selectedRecord && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 rounded-xl bg-content2 p-4">
                                    <Avatar
                                        name={selectedRecord.student?.full_name || "?"}
                                        size="md"
                                        className="bg-linear-to-br from-blue-400 to-indigo-500"
                                    />
                                    <div>
                                        <p className="font-semibold text-foreground">{selectedRecord.student?.full_name}</p>
                                        <p className="text-sm text-default-500">
                                            {t("รหัส", "ID")}: {selectedRecord.student?.student_id}
                                        </p>
                                    </div>
                                </div>

                                <Select
                                    label={t("สถานะ", "Status")}
                                    selectedKeys={[newStatus]}
                                    onSelectionChange={(keys) => setNewStatus(Array.from(keys)[0] as string)}
                                >
                                    <SelectItem key="present" startContent={<Icon icon="solar:check-circle-bold" className="text-green-500" />}>
                                        {t("มา", "Present")}
                                    </SelectItem>
                                    <SelectItem key="late" startContent={<Icon icon="solar:clock-circle-bold" className="text-amber-500" />}>
                                        {t("สาย", "Late")}
                                    </SelectItem>
                                    <SelectItem key="leave" startContent={<Icon icon="solar:document-bold" className="text-default-500" />}>
                                        {t("ลา", "On leave")}
                                    </SelectItem>
                                    <SelectItem key="absent" startContent={<Icon icon="solar:close-circle-bold" className="text-red-500" />}>
                                        {t("ขาด", "Absent")}
                                    </SelectItem>
                                </Select>

                                <Input
                                    label={t("หมายเหตุ (ถ้ามี)", "Note (optional)")}
                                    placeholder={t("ระบุเหตุผล", "Add a note")}
                                    value={statusNote}
                                    onValueChange={setStatusNote}
                                />
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={() => setIsStatusModalOpen(false)}>
                            {t("ยกเลิก", "Cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleUpdateStatus}
                            isLoading={isUpdatingStatus}
                            isDisabled={newStatus === originalStatus && statusNote === originalNote}
                            className="bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {t("บันทึก", "Save")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
