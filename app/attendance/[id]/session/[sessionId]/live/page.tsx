"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Avatar } from "@heroui/avatar";
import { Progress } from "@heroui/progress";
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
import { IoSchool } from "react-icons/io5";
import { QRCodeSVG } from "qrcode.react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useAttendancePinPresentation } from "@/hooks/useAttendancePinPresentation";
import { buildCourseTitleContext, buildPageTitle } from "@/lib/page-title";
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

// Format datetime
function formatDateTime(dateString: string, isEnglish = false): string {
    const date = new Date(dateString);
    return date.toLocaleString(isEnglish ? "en-US" : "th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatShortDateTime(dateString: string, isEnglish = false): string {
    const date = new Date(dateString);
    return date.toLocaleString(isEnglish ? "en-US" : "th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
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
    const courseId = params.id as string;
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

    // Modal states
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [newStatus, setNewStatus] = useState<string>("");
    const [statusNote, setStatusNote] = useState("");
    const [originalStatus, setOriginalStatus] = useState<string>("");
    const [originalNote, setOriginalNote] = useState<string>("");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // QR Modal
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);

    // Search filter
    const [searchQuery, setSearchQuery] = useState("");
    const { secondsLeft: pinCountdown, totalSeconds: pinTotal } = useAttendancePinPresentation(session);

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

        socket.on("connect", () => {
            hasWarnedAboutConnectError.current = false;
            socket.emit("join-instructor", sessionId);
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
            addToast({
                title: t("นักศึกษาเช็คชื่อ", "Student checked in"),
                description: `${data.record.student?.full_name || t("นักศึกษา", "Student")} ${t("เช็คชื่อเรียบร้อย", "checked in successfully")}`,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        });

        // Listen for status updates
        socket.on("attendance-updated", (data: { record: AttendanceRecord }) => {
            setRecords((prev) =>
                prev.map((r) => (r.id === data.record.id ? data.record : r))
            );
        });

        socket.on("attendance-pin-updated", (data: { pin_code?: string; pin_issued_at?: string | null; pin_rotates_at?: string | null; auto_rotate_pin?: boolean; status?: AttendanceSession["status"] }) => {
            setSession((prev) => prev
                ? {
                    ...prev,
                    pin_code: data.pin_code ?? "",
                    auto_rotate_pin: data.auto_rotate_pin ?? prev.auto_rotate_pin,
                    pin_issued_at: data.pin_issued_at ?? null,
                    pin_rotates_at: data.pin_rotates_at ?? null,
                    status: data.status ?? prev.status,
                }
                : prev);
        });

        // Listen for session closed
        socket.on("session-closed", () => {
            addToast({
                title: t("ปิดรอบเช็คชื่อแล้ว", "Check-in closed"),
                description: t("รอบการเช็คชื่อถูกปิดแล้ว", "This attendance session has been closed."),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            setSession((prev) => (prev ? { ...prev, status: "closed" } : null));
        });

        socketRef.current = socket;

        return () => {
            socket.emit("leave-instructor", sessionId);
            socket.disconnect();
        };
    }, [sessionId, isEnglish]);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            refreshSession().catch((error) => {
                console.error("Error refreshing attendance session:", error);
            });
        }, 15000);

        return () => window.clearInterval(interval);
    }, [refreshSession]);

    useEffect(() => {
        document.title = isEnglish
            ? "Live Attendance - LabTAS"
            : "เช็คชื่อ Live - LabTAS";
    }, [isEnglish]);

    useEffect(() => {
        const pageLabel = isEnglish ? "Live Attendance" : "เช็คชื่อ Live";
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
                    description: t("ปิดรอบการเช็คชื่อเรียบร้อยแล้ว", "The attendance session was closed successfully."),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            console.error("Error closing session:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถปิดรอบเช็คชื่อได้", "Unable to close the attendance session."),
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
    const checkInUrl = typeof window !== "undefined"
        ? `${window.location.origin}/check-in/${sessionId}`
        : "";

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

    // Copy URL to clipboard
    const copyURL = () => {
        navigator.clipboard.writeText(checkInUrl);
        addToast({
            title: t("คัดลอกแล้ว", "Copied"),
            description: t("URL ถูกคัดลอกไปยังคลิปบอร์ดแล้ว", "The URL has been copied to the clipboard."),
            color: "success",
            timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
    };

    const sessionOpen = isSessionOpen();
    const now = new Date();
    const notStarted = session ? now < new Date(session.start_time) : false;
    const pinAvailabilityMessage = !session
        ? ""
        : session.status === "closed"
            ? t("PIN ถูกคืนเข้าระบบแล้ว", "PIN has been released.")
            : notStarted
                ? t("PIN จะออกเมื่อเริ่มรอบเช็คชื่อ", "PIN will be issued when check-in opens.")
                : t("กำลังออกรหัสใหม่...", "Refreshing PIN...");

    // Total students count (should be fetched from course enrollment)
    const totalStudents = (session?.course as { enrollment_count?: number } | undefined)?.enrollment_count || records.length || 0;

    if (!session && !isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Card className="max-w-md border-2 border-dashed border-default-300 bg-content1 shadow-xl">
                    <CardBody className="text-center py-12">
                        <Icon icon="solar:clipboard-remove-bold-duotone" className="mx-auto mb-4 text-6xl text-default-300" />
                        <p className="mb-2 text-lg text-default-600">{t("ไม่พบข้อมูลการเช็คชื่อ", "Attendance session not found")}</p>
                        <p className="mb-6 text-sm text-default-400">{t("กรุณาตรวจสอบลิงก์อีกครั้ง", "Please check the link and try again.")}</p>
                        <Button
                            className="w-full bg-linear-to-r from-blue-400 to-indigo-500 text-white shadow-lg"
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
        return null;
    }

    return (
        <div className="min-h-screen bg-background p-4 lg:p-6">
            {/* Header Card with Purple Gradient Bar */}
            <Card className="mb-6 overflow-hidden border border-default-200 bg-content1 shadow-lg">
                {/* Purple Gradient Bar */}
                {/* <div className="h-2 bg-linear-to-r from-purple-400 via-pink-400 to-purple-400" /> */}

                <CardBody className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        {/* Left - Title & Course Info */}
                        <div>
                            <h1 className="mb-2 text-3xl font-bold text-foreground">
                                {session.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-default-500">
                                <span>{t("รหัสวิชา", "Course code")}: {session.course?.code || "-"}</span>
                                <span>{t("ชื่อวิชา", "Course name")}: {session.course?.name || "-"}</span>
                                <span>{t("ปีการศึกษา", "Academic year")}: {session.course?.year || "-"}</span>
                                <span>{t("ภาคเรียน", "Semester")}: {session.course?.semester || "-"}</span>
                            </div>
                        </div>

                        {/* Right - Actions & Time */}
                        <div className="flex flex-col items-end gap-3">
                            {/* Close Button */}
                            {session.status === "active" && (
                                <Button
                                    variant="bordered"
                                    // className="border-slate-300 text-slate-600"
                                    color="danger"
                                    startContent={<Icon icon="solar:close-circle-linear" className="text-lg" />}
                                    onPress={handleCloseSession}
                                    isLoading={isClosing}
                                >
                                    {t("ปิดรับการเช็คชื่อ", "Close check-in")}
                                </Button>
                            )}

                            {/* Time Info */}
                            <div className="text-sm text-right">
                                <div className="flex items-center gap-2 text-green-600">
                                    <Icon icon="solar:clock-circle-linear" className="text-base" />
                                    <span>{t("เริ่ม", "Starts")}: {formatShortDateTime(session.start_time, isEnglish)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-orange-500 mt-1">
                                    <Icon icon="solar:clock-circle-linear" className="text-base" />
                                    <span>{t("สิ้นสุด", "Ends")}: {formatShortDateTime(session.end_time, isEnglish)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Main Content - 2 Columns (4:8 ratio) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                {/* Left Column - PIN & QR (4/12) */}
                <div className="lg:col-span-4">
                    <Card className="h-full border border-default-200 bg-content1 shadow-lg">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:key-minimalistic-square-2-linear" className="text-xl text-blue-500" />
                                <h3 className="text-lg font-semibold text-default-700">{t("รหัสและช่องทางการเช็คชื่อ", "PIN and check-in access")}</h3>
                            </div>
                        </CardHeader>
                        <CardBody className="text-center pt-2">
                            {/* PIN CODE */}
                            <p className="mb-1 text-xs uppercase tracking-wider text-default-400">PIN CODE</p>
                            {session.pin_code ? (
                                <div
                                    className="text-5xl font-bold text-blue-500 tracking-[0.2em] mb-3 cursor-pointer hover:text-blue-600 transition-colors"
                                    onClick={copyPIN}
                                >
                                    {session.pin_code}
                                </div>
                            ) : (
                                <div className="mb-3 rounded-2xl border border-dashed border-default-300 bg-content2 px-4 py-6 text-sm text-default-500">
                                    {pinAvailabilityMessage}
                                </div>
                            )}
                            {/* PIN rotation progress bar */}
                            {session.status === "active" && !session.auto_rotate_pin ? (
                                <p className="mb-4 text-xs text-default-400">{t("PIN คงที่ตลอดรอบนี้", "This PIN stays fixed for the whole session")}</p>
                            ) : session.status === "active" && pinCountdown !== null && pinTotal !== null ? (
                                <div className="mb-4 w-full">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs text-default-400">{t("PIN เปลี่ยนทุก 1 นาที", "PIN rotates every minute")}</span>
                                        <span className={`text-xs font-mono font-semibold tabular-nums ${
                                            pinCountdown <= 10 ? "text-red-500" :
                                            pinCountdown <= 20 ? "text-amber-500" : "text-blue-400"
                                        }`}>{pinCountdown}s</span>
                                    </div>
                                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-default-200">
                                        <div
                                            className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                                                pinCountdown <= 10 ? "bg-red-500" :
                                                pinCountdown <= 20 ? "bg-amber-400" : "bg-blue-500"
                                            }`}
                                            style={{ width: `${Math.max(0, (pinCountdown / pinTotal) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <p className="mb-4 text-xs text-default-400">{t("PIN เปลี่ยนทุก 1 นาที", "PIN rotates every minute")}</p>
                            )}

                            {/* QR CODE */}
                            <p className="mb-3 text-xs uppercase tracking-wider text-default-400">{t("QR CODE (คลิกเพื่อขยาย)", "QR CODE (click to expand)")}</p>
                            <div
                                className="mb-4 flex cursor-pointer justify-center rounded-xl border-2 border-default-200 bg-content1 p-4 transition-all hover:border-blue-300 hover:shadow-lg"
                                onClick={() => setIsQRModalOpen(true)}
                            >
                                <QRCodeSVG
                                    value={checkInUrl}
                                    size={300}
                                    level="L"
                                    fgColor="#000000"
                                    bgColor="#ffffff"
                                    marginSize={2}
                                />
                            </div>
                            {/* <p className="text-xs text-slate-400 mb-4 text-center">
                                หรือเข้าที่ <span className="font-mono text-blue-500">{checkInUrl.replace(/https?:\/\//, '')}</span>
                            </p> */}

                            {/* Countdown */}
                            <div className="mt-4">
                                <div className="mb-2 flex items-center justify-center gap-1 text-default-400">
                                    <Icon icon="solar:clock-circle-linear" className="text-base" />
                                    <span className="text-xs">{t("เวลาที่เหลือ", "Time remaining")}</span>
                                </div>
                                <div className={`inline-block px-6 py-3 rounded-xl ${isPastLateThreshold ? 'bg-amber-500 dark:bg-amber-600' : 'bg-slate-700 dark:bg-slate-600'}`}>
                                    <span className="text-2xl font-mono font-bold text-white">
                                        {timeRemaining
                                            ? `${String(timeRemaining.hours).padStart(2, "0")}:${String(timeRemaining.minutes).padStart(2, "0")}:${String(timeRemaining.seconds).padStart(2, "0")}`
                                            : "00:00:00"}
                                    </span>
                                </div>
                                {/* Late threshold time display */}
                                {lateThresholdDisplay && (
                                    <div className="mt-2 text-xs text-amber-400">
                                        <Icon icon="solar:alarm-bold" className="inline mr-1" />
                                        {isEnglish ? `Late after ${lateThresholdDisplay}` : `ตัดสาย ${lateThresholdDisplay} น.`}
                                    </div>
                                )}
                            </div>
                        </CardBody>
                    </Card>
                </div>

                {/* Right Column - Stats & Student List (8/12) */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="border border-default-200 bg-content1 shadow-lg">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:chart-2-linear" className="text-xl text-blue-500" />
                                <h3 className="text-lg font-semibold text-default-700">{t("สถิติภาพรวมการเช็คชื่อ", "Attendance overview")}</h3>
                            </div>
                        </CardHeader>
                        <CardBody>
                            {/* Late threshold info */}
                            {lateThresholdDisplay && (
                                <div className={`mb-4 p-3 rounded-xl flex items-center gap-3 ${isPastLateThreshold ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'}`}>
                                    <Icon icon="solar:clock-circle-bold" className={`text-2xl ${isPastLateThreshold ? 'text-amber-600 dark:text-amber-400' : 'text-amber-500 dark:text-amber-400'}`} />
                                    <div>
                                        <p className={`text-sm font-medium ${isPastLateThreshold ? 'text-amber-800 dark:text-amber-200' : 'text-amber-700 dark:text-amber-300'}`}>
                                            {t("เกณฑ์เวลาสาย", "Late threshold")}: <span className="font-bold">{isEnglish ? lateThresholdDisplay : `${lateThresholdDisplay} น.`}</span>
                                            {isPastLateThreshold && <span className="ml-2 text-red-600 dark:text-red-400"> {t("(เลยเวลาตัดสายแล้ว)", "(late threshold passed)")}</span>}
                                        </p>
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            {isEnglish
                                                ? `Check-ins after ${lateThresholdDisplay} are marked as "Late"`
                                                : `เช็คชื่อหลัง ${lateThresholdDisplay} น. จะถือว่า "สาย"`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                {/* นักศึกษาทั้งหมด */}
                                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                            <Icon icon="solar:users-group-rounded-bold" className="text-lg text-blue-500 dark:text-blue-400" />
                                        </div>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t("เช็คชื่อแล้ว", "Checked in")}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.checkedIn}</p>
                                </div>

                                {/* มาเรียน (Present) */}
                                <div className="p-3 bg-green-50 dark:bg-green-950/40 rounded-xl border border-green-100 dark:border-green-900/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-green-100 dark:bg-green-900/50 rounded-lg">
                                            <Icon icon="solar:check-circle-bold" className="text-lg text-green-500 dark:text-green-400" />
                                        </div>
                                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">{t("มาเรียน", "Present")}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.present}</p>
                                </div>

                                {/* สาย (Late) */}
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-100 dark:border-amber-900/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                                            <Icon icon="solar:clock-circle-bold" className="text-lg text-amber-500 dark:text-amber-400" />
                                        </div>
                                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{t("สาย", "Late")}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.late}</p>
                                </div>

                                {/* ลา (Leave) */}
                                <div className="rounded-xl border border-default-200 bg-content2 p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="rounded-lg bg-content3 p-1.5">
                                            <Icon icon="solar:document-bold" className="text-lg text-default-500" />
                                        </div>
                                        <p className="text-xs font-medium text-default-600">{t("ลา", "On leave")}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-default-600">{stats.leave}</p>
                                </div>

                                {/* ขาด (Absent) */}
                                <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-100 dark:border-red-900/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-red-100 dark:bg-red-900/50 rounded-lg">
                                            <Icon icon="solar:close-circle-bold" className="text-lg text-red-500 dark:text-red-400" />
                                        </div>
                                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">{t("ขาด", "Absent")}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.absent}</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Student List Table */}
                    <Card className="overflow-hidden border border-default-200 bg-content1 shadow-lg">
                        <CardHeader className="flex flex-col items-start justify-between gap-3 border-b border-divider bg-content2 p-4 sm:flex-row sm:items-center">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                                <Icon icon="solar:checklist-minimalistic-linear" className="text-xl text-blue-600" />
                                {t("รายชื่อผู้เช็คชื่อ", "Checked-in students")}
                                <Chip size="sm" variant="flat" color="primary">{formatStudentCount(stats.checkedIn)}</Chip>
                            </h2>
                            <Input
                                placeholder={t("ค้นหาชื่อ / รหัสนักศึกษา...", "Search by name / student ID...")}
                                value={searchQuery}
                                onValueChange={setSearchQuery}
                                size="sm"
                                variant="bordered"
                                isClearable
                                startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                                classNames={{
                                    inputWrapper: "h-9 min-h-9 bg-content1 border-default-200",
                                    input: "text-sm"
                                }}
                                className="w-full sm:w-64"
                            />
                        </CardHeader>
                        <CardBody className="p-0">
                            <div className="overflow-y-auto max-h-100 p-3">
                                <Table
                                    aria-label="Student attendance table"
                                    removeWrapper
                                    classNames={{
                                            th: "bg-content2 text-default-500 font-medium text-xs uppercase",
                                        td: "py-3",
                                    }}
                                >
                                    <TableHeader>
                                        {[
                                            <TableColumn key="status">{t("สถานะ", "Status")}</TableColumn>,
                                            <TableColumn key="name">{t("ชื่อนักศึกษา / รหัส", "Student / ID")}</TableColumn>,
                                            <TableColumn key="time" align="center">{t("เวลาเช็คชื่อ", "Check-in time")}</TableColumn>,
                                            ...(session.check_location ? [<TableColumn key="distance" align="center">{t("ระยะห่าง", "Distance")}</TableColumn>] : [])
                                        ]}
                                    </TableHeader>
                                    <TableBody
                                        emptyContent={
                                            <div className="py-16 text-center">
                                                <div className="mb-4 inline-block rounded-full bg-content2 p-4">
                                                    <Icon
                                                        icon="solar:users-group-rounded-linear"
                                                        className="text-5xl text-default-300"
                                                    />
                                                </div>
                                                <p className="font-medium text-default-500">{t("ยังไม่มีนักศึกษาเช็คชื่อ", "No students have checked in yet")}</p>
                                                <p className="mt-1 text-sm text-default-400">
                                                    {t("รอนักศึกษาสแกน QR Code หรือกรอก PIN", "Wait for students to scan the QR code or enter the PIN")}
                                                </p>
                                            </div>
                                        }
                                    >
                                        {records
                                            .filter(r => r.check_in_time)
                                            .filter(r => {
                                                if (!searchQuery.trim()) return true;
                                                const query = searchQuery.toLowerCase();
                                                return (
                                                    r.student?.full_name?.toLowerCase().includes(query) ||
                                                    r.student?.student_id?.toLowerCase().includes(query)
                                                );
                                            })
                                            .sort((a, b) => {
                                                // Sort by check_in_time descending (newest first)
                                                const timeA = a.check_in_time ? new Date(a.check_in_time).getTime() : 0;
                                                const timeB = b.check_in_time ? new Date(b.check_in_time).getTime() : 0;
                                                return timeB - timeA;
                                            })
                                            .map((record) => (
                                            <TableRow key={record.id}>
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
                                                                <p className="font-medium text-foreground">
                                                                    {record.student?.full_name || "-"}
                                                                </p>
                                                                <p className="text-xs text-default-400">
                                                                    {record.student?.student_id || "-"}
                                                                </p>
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
                                                        </TableCell>
                                                    ] : [])
                                                ]}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardBody>
                    </Card>

                    {/* QR Modal (Full Screen) */}
                    <Modal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} size="full">
                        <ModalContent className="bg-content1">
                            <ModalBody className="flex flex-col items-center justify-center min-h-screen py-10">
                                <h2 className="mb-2 text-3xl font-bold text-foreground">
                                    {session.title}
                                </h2>
                                <p className="mb-6 text-default-500">{t("สแกน QR Code เพื่อเช็คชื่อเข้าเรียน", "Scan the QR code to check in")}</p>
                                
                                {/* QR Code - optimized for scanning */}
                                <div className="rounded-3xl border-4 border-default-200 bg-white p-2 shadow-xl">
                                    <QRCodeSVG 
                                        value={checkInUrl} 
                                        size={450} 
                                        level="L" 
                                        fgColor="#000000"
                                        bgColor="#ffffff"
                                        marginSize={1}
                                    />
                                </div>

                                {/* URL */}
                                {/* <div className="mt-6 text-center">
                                    <p className="text-sm text-slate-400 mb-2">หรือเปิดลิงก์</p>
                                    <p className="font-mono text-lg text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
                                        {checkInUrl.replace(/https?:\/\//, '')}
                                    </p>
                                </div> */}

                                <div className="mt-6 text-center">
                                    {/* <p className="text-sm text-slate-400 mb-3">หรือใส่รหัส PIN</p> */}
                                    {session.pin_code ? (
                                        <div className="inline-block px-10 py-5 bg-slate-800 dark:bg-slate-700 rounded-2xl shadow-lg">
                                            <p className="text-6xl font-bold tracking-[0.4em] text-white font-mono">
                                                {session.pin_code}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="inline-block rounded-2xl border border-dashed border-default-300 bg-content2 px-8 py-6 text-sm text-default-500">
                                            {pinAvailabilityMessage}
                                        </div>
                                    )}
                                    <p className="mt-3 text-xs text-default-400">{t("PIN เปลี่ยนทุก 1 นาที", "PIN rotates every minute")}</p>
                                </div>

                                {/* Late threshold info */}
                                {session.late_threshold_minutes > 0 && (
                                    <div className="mt-6 flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-4 py-2 rounded-lg">
                                        <Icon icon="solar:clock-circle-bold" className="text-xl" />
                                        <span className="text-sm">{isEnglish ? `Check-ins after ${session.late_threshold_minutes} minutes are marked as late` : `เช็คชื่อหลัง ${session.late_threshold_minutes} นาที ถือว่าสาย`}</span>
                                    </div>
                                )}

                                {/* <Button
                                    className="mt-4"
                                    variant="bordered"
                                    size="lg"
                                    onPress={() => setIsQRModalOpen(false)}
                                    startContent={<Icon icon="solar:close-circle-linear" />}
                                >
                                    ปิด
                                </Button> */}
                            </ModalBody>
                        </ModalContent>
                    </Modal>
                </div>
            </div>



            {/* Status Update Modal */}
            <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)}>
                <ModalContent>
                    <ModalHeader>
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:pen-new-square-linear" className="text-xl text-blue-500" />
                            {t("เปลี่ยนสถานะการเช็คชื่อ", "Change attendance status")}
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
                                        <p className="font-semibold text-foreground">
                                            {selectedRecord.student?.full_name}
                                        </p>
                                        <p className="text-sm text-default-500">
                                            {t("รหัส", "ID")}: {selectedRecord.student?.student_id}
                                        </p>
                                    </div>
                                </div>

                                <Select
                                    label={t("สถานะ", "Status")}
                                    selectedKeys={[newStatus]}
                                    onSelectionChange={(keys) =>
                                        setNewStatus(Array.from(keys)[0] as string)
                                    }
                                >
                                    <SelectItem
                                        key="present"
                                        startContent={
                                            <Icon icon="solar:check-circle-bold" className="text-green-500" />
                                        }
                                    >
                                        {t("มา", "Present")}
                                    </SelectItem>
                                    <SelectItem
                                        key="late"
                                        startContent={
                                            <Icon icon="solar:clock-circle-bold" className="text-amber-500" />
                                        }
                                    >
                                        {t("สาย", "Late")}
                                    </SelectItem>
                                    <SelectItem
                                        key="leave"
                                        startContent={
                                            <Icon icon="solar:document-bold" className="text-default-500" />
                                        }
                                    >
                                        {t("ลา", "On leave")}
                                    </SelectItem>
                                    <SelectItem
                                        key="absent"
                                        startContent={
                                            <Icon icon="solar:close-circle-bold" className="text-red-500" />
                                        }
                                    >
                                        {t("ขาด", "Absent")}
                                    </SelectItem>
                                </Select>

                                <Input
                                    label={t("หมายเหตุ (ถ้ามี)", "Note (optional)")}
                                    placeholder={t("ระบุเหตุผล...", "Add a note...")}
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
        </div>
    );
}
