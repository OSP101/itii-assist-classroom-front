"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Progress } from "@heroui/progress";
import { Input } from "@heroui/input";
import {
    Table,
    TableHeader,
    TableBody,
    TableColumn,
    TableRow,
    TableCell,
} from "@heroui/table";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import { getRealtimeSocketBaseUrl, io, type Socket } from "@/services/realtime-socket";
import attendanceDisplayService, {
    type AttendanceDisplayCurrent,
    AttendanceDisplayError,
} from "@/services/attendance-display.service";
import type { AttendanceRecord, AttendanceSession } from "@/services/attendance.service";
import { isRotatingPinSession, useAttendancePinPresentation } from "@/hooks/useAttendancePinPresentation";
import { getAppUrl } from "@/lib/app-url";
import { buildCourseTitleContext, buildPageTitle } from "@/lib/page-title";

// Status config
const statusConfig: Record<
    string,
    { label: string; color: "success" | "warning" | "danger" | "default"; icon: string }
> = {
    present: { label: "มา", color: "success", icon: "solar:check-circle-bold" },
    late: { label: "สาย", color: "warning", icon: "solar:clock-circle-bold" },
    leave: { label: "ลา", color: "default", icon: "solar:document-bold" },
    absent: { label: "ขาด", color: "danger", icon: "solar:close-circle-bold" },
};

function formatTime(dateString: string | null): string {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function formatShortDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function upsertRecord(list: AttendanceRecord[], record: AttendanceRecord): AttendanceRecord[] {
    const idx = list.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
        const next = [...list];
        next[idx] = record;
        return next;
    }
    return [...list, record];
}

export default function DisplayLivePage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const sessionId = Number(params.sessionId);

    const [current, setCurrent] = useState<AttendanceDisplayCurrent | null>(null);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpired, setIsExpired] = useState(false);
    const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<{
        hours: number;
        minutes: number;
        seconds: number;
    } | null>(null);
    const [isPastLateThreshold, setIsPastLateThreshold] = useState(false);
    const [lateThresholdDisplay, setLateThresholdDisplay] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const socketRef = useRef<Socket | null>(null);
    const lastKnownPinRef = useRef("");
    const pinSyncInFlightRef = useRef(false);
    const socketUrl = getRealtimeSocketBaseUrl();

    const session = current?.session ?? null;
    const { secondsLeft: pinCountdown, totalSeconds: pinTotal } = useAttendancePinPresentation(session);
    const pinAvailabilityMessage = !session
        ? ""
        : session.status === "closed"
            ? "PIN ถูกคืนเข้าระบบแล้ว"
            : new Date() < new Date(session.start_time)
                ? "PIN จะออกเมื่อเริ่มรอบเช็กชื่อ"
                : "กำลังออกรหัสใหม่...";

    const stats = {
        total: records.length,
        present: records.filter((r) => r.status === "present").length,
        late: records.filter((r) => r.status === "late").length,
        leave: records.filter((r) => r.status === "leave").length,
        absent: records.filter((r) => r.status === "absent").length,
        checkedIn: records.filter((r) => r.check_in_time).length,
    };

    const handleAccessDenied = useCallback((message?: string) => {
        const description = message || "อุปกรณ์นี้ไม่มีสิทธิ์เข้าถึงหน้านี้";
        setAccessDeniedMessage(description);
        addToast({
            title: "ไม่มีสิทธิ์เข้าถึง",
            description,
            color: "danger",
            timeout: 3500,
            shouldShowTimeoutProgress: true,
        });
    }, []);

    const handleGrantExpired = useCallback(() => {
        setIsExpired(true);
        addToast({
            title: "หมดสิทธิ์การแสดงผล",
            description: "การเช็กชื่อสิ้นสุดแล้ว",
            color: "warning",
            timeout: 3000,
            shouldShowTimeoutProgress: true,
        });
    }, []);

    useEffect(() => {
        const pageLabel = "หน้าจอเช็กชื่อ";
        const courseContext = buildCourseTitleContext(session?.course);
        document.title = buildPageTitle(pageLabel, courseContext);
    }, [session?.course]);

    // Fetch initial data
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        // Inner helper so we can retry once on 401 (cookie might not be relayed yet)
        const attempt = async (isRetry: boolean): Promise<void> => {
            try {
                const [currentData, recordsData] = await Promise.all([
                    attendanceDisplayService.getCurrent(),
                    attendanceDisplayService.getRecords(),
                ]);
                // Validate that this grant belongs to the session in the URL
                if (
                    currentData.attendance_session_id !== sessionId ||
                    currentData.course_id !== courseId
                ) {
                    console.error("[display-live] session mismatch", {
                        got_session: currentData.attendance_session_id,
                        want_session: sessionId,
                        got_course: currentData.course_id,
                        want_course: courseId,
                    });
                    handleAccessDenied("ลิงก์นี้ไม่ตรงกับสิทธิ์ของอุปกรณ์ที่ยืนยันไว้");
                    return;
                }
                setCurrent(currentData);
                setRecords(recordsData);
            } catch (error) {
                const status = error instanceof AttendanceDisplayError ? error.status : 0;
                console.error("[display-live] fetchData error", { status, error, isRetry });

                if (status === 401 && !isRetry) {
                    // Cookie may not have been stored yet — wait 600 ms then retry once
                    await new Promise((r) => setTimeout(r, 600));
                    return attempt(true);
                }

                if (status === 401 || status === 403) {
                    handleAccessDenied("อุปกรณ์นี้ยังไม่ได้รับสิทธิ์ กรุณายืนยันสิทธิ์บนอุปกรณ์นี้ก่อน");
                } else if (status === 410) {
                    // Truly expired grant
                    handleGrantExpired();
                } else {
                    addToast({
                        title: "เกิดข้อผิดพลาด",
                        description:
                            error instanceof AttendanceDisplayError
                                ? error.message
                                : "ไม่สามารถโหลดข้อมูลได้",
                        color: "danger",
                        timeout: 3000,
                        shouldShowTimeoutProgress: true,
                    });
                }
            }
        };
        await attempt(false);
        setIsLoading(false);
    }, [sessionId, courseId, handleAccessDenied, handleGrantExpired]);

    const refreshPinState = useCallback(async () => {
        const currentData = await attendanceDisplayService.getCurrent();
        if (
            currentData.attendance_session_id !== sessionId ||
            currentData.course_id !== courseId
        ) {
            handleAccessDenied("ลิงก์นี้ไม่ตรงกับสิทธิ์ของอุปกรณ์ที่ยืนยันไว้");
            return;
        }
        setCurrent(currentData);
    }, [courseId, handleAccessDenied, sessionId]);

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
            refreshPinState().catch((error) => {
                const status = error instanceof AttendanceDisplayError ? error.status : 0;
                if (status === 401 || status === 403) {
                    handleAccessDenied("อุปกรณ์นี้ยังไม่ได้รับสิทธิ์ กรุณายืนยันสิทธิ์บนอุปกรณ์นี้ก่อน");
                    return;
                }
                if (status === 410) {
                    handleGrantExpired();
                    return;
                }
                console.error("Display live pin sync fallback failed:", error);
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
        handleAccessDenied,
        handleGrantExpired,
        pinCountdown,
        refreshPinState,
        session?.auto_rotate_pin,
        session?.pin_code,
        session?.pin_mode,
        session?.status,
    ]);

    useEffect(() => {
        if (isExpired) return;

        const interval = window.setInterval(() => {
            Promise.all([
                attendanceDisplayService.getCurrent(),
                attendanceDisplayService.getRecords(),
            ])
                .then(([currentData, recordsData]) => {
                    if (
                        currentData.attendance_session_id !== sessionId ||
                        currentData.course_id !== courseId
                    ) {
                        handleAccessDenied("ลิงก์นี้ไม่ตรงกับสิทธิ์ของอุปกรณ์ที่ยืนยันไว้");
                        return;
                    }
                    setCurrent(currentData);
                    setRecords(recordsData);
                })
                .catch((error) => {
                    const status = error instanceof AttendanceDisplayError ? error.status : 0;
                    if (status === 401 || status === 403) {
                        handleAccessDenied("อุปกรณ์นี้ยังไม่ได้รับสิทธิ์ กรุณายืนยันสิทธิ์บนอุปกรณ์นี้ก่อน");
                        return;
                    }
                    if (status === 410) {
                        handleGrantExpired();
                        return;
                    }
                    console.error("Display live refresh failed:", error);
                });
        }, 15000);

        return () => window.clearInterval(interval);
    }, [courseId, handleAccessDenied, handleGrantExpired, isExpired, sessionId]);

    // Socket connection
    useEffect(() => {
        if (!current || !socketUrl || isExpired) return;

        let disposed = false;
        let activeSocket: Socket | null = null;

        const connect = async () => {
            try {
                const ticket = await attendanceDisplayService.getSocketTicket();
                if (disposed) return;

                activeSocket = io(socketUrl, {
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                });
                socketRef.current = activeSocket;

                activeSocket.on("connect", () => {
                    activeSocket?.emit("join-display", { ticket: ticket.ticket });
                });

                activeSocket.on("student-checked-in", (data?: { record?: AttendanceRecord }) => {
                    const record = data?.record;
                    if (!record) return;
                    setRecords((prev) => upsertRecord(prev, record));
                    addToast({
                        title: "นักศึกษาเช็กชื่อ",
                        description: `${record.student?.full_name || "นักศึกษา"} เช็กชื่อเรียบร้อย`,
                        color: "success",
                        timeout: 2500,
                        shouldShowTimeoutProgress: true,
                    });
                });

                activeSocket.on("attendance-updated", (data?: { record?: AttendanceRecord }) => {
                    const record = data?.record;
                    if (!record) return;
                    setRecords((prev) => upsertRecord(prev, record));
                });

                activeSocket.on("attendance-pin-updated", (data?: { pin_code?: string; pin_issued_at?: string | null; pin_rotates_at?: string | null; auto_rotate_pin?: boolean; pin_mode?: AttendanceSession["pin_mode"]; status?: "draft" | "active" | "closed" }) => {
                    setCurrent((prev) => prev
                        ? {
                            ...prev,
                            session: prev.session
                                ? {
                                    ...prev.session,
                                    pin_code: data?.pin_code ?? "",
                                    auto_rotate_pin: data?.auto_rotate_pin ?? prev.session.auto_rotate_pin,
                                    pin_mode: data?.pin_mode ?? prev.session.pin_mode,
                                    pin_issued_at: data?.pin_issued_at ?? null,
                                    pin_rotates_at: data?.pin_rotates_at ?? null,
                                    status: data?.status ?? prev.session.status,
                                }
                                : prev.session,
                        }
                        : prev);
                });

                activeSocket.on("session-closed", () => {
                    setCurrent((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  session: prev.session
                                      ? { ...prev.session, status: "closed" }
                                      : prev.session,
                              }
                            : prev
                    );
                    addToast({
                        title: "ปิดรอบเช็กชื่อแล้ว",
                        description: "รอบนี้ปิดแล้ว หน้าจอนี้ยังดูข้อมูลล่าสุดได้",
                        color: "warning",
                        timeout: 4000,
                        shouldShowTimeoutProgress: true,
                    });
                });
            } catch (err) {
                if (err instanceof AttendanceDisplayError) {
                    if (err.status === 401 || err.status === 403) {
                        handleAccessDenied("อุปกรณ์นี้ไม่มีสิทธิ์เชื่อมต่อการแสดงผลแบบเรียลไทม์");
                        return;
                    }
                    if (err.status === 410) {
                        handleGrantExpired();
                        return;
                    }
                }
                console.error("Display socket error:", err);
            }
        };

        connect();

        return () => {
            disposed = true;
            activeSocket?.disconnect();
            if (socketRef.current === activeSocket) socketRef.current = null;
        };
    }, [current, socketUrl, isExpired, handleAccessDenied, handleGrantExpired]);

    // Countdown + expiry monitor
    useEffect(() => {
        if (!session || !current) return;

        let lateThreshold: Date;
        if (session.late_threshold_time) {
            const sessionDate = new Date(session.start_time);
            const [hours, minutes, seconds = 0] = session.late_threshold_time.split(":").map(Number);
            lateThreshold = new Date(sessionDate);
            lateThreshold.setHours(hours, minutes, seconds, 0);
            setLateThresholdDisplay(
                `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
            );
        } else {
            lateThreshold = new Date(session.start_time);
            lateThreshold.setMinutes(lateThreshold.getMinutes() + (session.late_threshold_minutes ?? 0));
            setLateThresholdDisplay(
                lateThreshold.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
            );
        }

        const tick = () => {
            const now = new Date();
            const grantExpiry = new Date(current.expires_at);

            // Redirect when grant expires
            if (now >= grantExpiry) {
                handleGrantExpired();
                return;
            }

            const endTime = new Date(session.end_time);
            const startTime = new Date(session.start_time);
            const diff = endTime.getTime() - now.getTime();
            const startDiff = startTime.getTime() - now.getTime();

            setIsPastLateThreshold(now > lateThreshold);

            if (startDiff > 0) {
                const h = Math.floor(startDiff / (1000 * 60 * 60));
                const m = Math.floor((startDiff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((startDiff % (1000 * 60)) / 1000);
                setTimeRemaining({ hours: h, minutes: m, seconds: s });
            } else if (diff <= 0) {
                setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
            } else {
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeRemaining({ hours: h, minutes: m, seconds: s });
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [session, current, handleGrantExpired]);

    const checkInUrl = getAppUrl(`/check-in/${sessionId}`);

    const checkedInRecords = records.filter((r) => !!r.check_in_time && r.status !== "absent");

    const filteredRecords = checkedInRecords.filter((r) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            r.student?.full_name?.toLowerCase().includes(q) ||
            r.student?.student_id?.toLowerCase().includes(q)
        );
    });

    const sortedFilteredRecords = [...filteredRecords].sort((a, b) => {
        const timeA = a.check_in_time ? new Date(a.check_in_time).getTime() : 0;
        const timeB = b.check_in_time ? new Date(b.check_in_time).getTime() : 0;
        return timeB - timeA;
    });

    if (isExpired) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-slate-50">
                <Card className="max-w-sm shadow-xl">
                    <CardBody className="text-center py-12">
                        <Icon icon="solar:clock-circle-bold-duotone" className="text-6xl text-amber-400 mx-auto mb-4" aria-label="หมดเวลาการเช็กชื่อ" />
                        <p className="text-lg font-semibold text-slate-700 mb-2">หมดเวลาการเช็กชื่อ</p>
                        <p className="text-sm text-slate-400">สิทธิ์การแสดงผลสิ้นสุดแล้ว</p>
                    </CardBody>
                </Card>
            </div>
        );
    }

    if (accessDeniedMessage) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-slate-50 p-4">
                <Card className="max-w-md w-full shadow-xl border border-red-100">
                    <CardBody className="text-center py-12">
                        <Icon icon="solar:shield-cross-bold-duotone" className="text-6xl text-red-400 mx-auto mb-4" aria-label="ไม่มีสิทธิ์เข้าถึง" />
                        <p className="text-xl font-semibold text-slate-800 mb-2">ไม่มีสิทธิ์เข้าถึง</p>
                        <p className="text-sm text-slate-500 mb-6">{accessDeniedMessage}</p>
                        <div className="flex justify-center gap-3">
                            <Button variant="bordered" onPress={() => window.close()}>ปิดหน้านี้</Button>
                        </div>
                    </CardBody>
                </Card>
            </div>
        );
    }

    if (isLoading || !session) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-slate-50">
                <div className="text-center">
                    <Icon icon="solar:refresh-circle-bold-duotone" className="text-5xl text-blue-400 mx-auto mb-3 animate-spin" aria-label="กำลังโหลด" />
                    <p className="text-slate-500">กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 p-4 lg:p-6">
            {/* Header */}
            <Card className="mb-6 shadow-lg border-0 overflow-hidden">
                <CardBody className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Chip
                                    size="sm"
                                    color={session.status === "active" ? "success" : "default"}
                                    variant="flat"
                                    startContent={
                                        <Icon
                                            icon={
                                                session.status === "active"
                                                    ? "solar:play-circle-bold"
                                                    : "solar:stop-circle-bold"
                                            }
                                            className="text-sm"
                                        />
                                    }
                                >
                                    {session.status === "active" ? "กำลังเปิดรับ" : "ปิดรับแล้ว"}
                                </Chip>
                            </div>
                            <h1 className="text-3xl font-bold text-slate-800 mb-2">{session.title}</h1>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                                <span>รหัสวิชา: {session.course?.code || "-"}</span>
                                <span>ชื่อวิชา: {session.course?.name || "-"}</span>
                                <span>ปีการศึกษา: {session.course?.year || "-"}</span>
                                <span>ภาคเรียน: {session.course?.semester || "-"}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-sm text-right">
                            <div className="flex items-center gap-2 text-green-600">
                                <Icon icon="solar:clock-circle-linear" className="text-base" />
                                <span>เริ่ม: {formatShortDateTime(session.start_time)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-orange-500">
                                <Icon icon="solar:clock-circle-linear" className="text-base" />
                                <span>สิ้นสุด: {formatShortDateTime(session.end_time)}</span>
                            </div>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                {/* Left — PIN & QR (4 cols) */}
                <div className="lg:col-span-4">
                    <Card className="shadow-lg border-0 h-full">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:key-minimalistic-square-2-linear" className="text-xl text-blue-500" />
                                <h3 className="text-lg font-semibold text-slate-700">รหัสและช่องทางการเช็กชื่อ</h3>
                            </div>
                        </CardHeader>
                        <CardBody className="text-center pt-2">
                            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">PIN CODE</p>
                            {session.pin_code ? (
                                <div className="text-5xl font-bold text-blue-500 tracking-[0.2em] mb-3">
                                    {session.pin_code}
                                </div>
                            ) : (
                                <div className="mb-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                    {pinAvailabilityMessage}
                                </div>
                            )}
                            {/* PIN rotation progress bar */}
                            {!isRotatingPinSession(session) ? (
                                <p className="mb-6 text-xs text-slate-400">PIN คงที่ตลอดรอบนี้</p>
                            ) : session.status === "active" && pinCountdown !== null && pinTotal !== null ? (
                                <div className="mb-6 w-full">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs text-slate-400">PIN เปลี่ยนทุก 1 นาที</span>
                                        <span className={`text-xs font-mono font-semibold tabular-nums ${
                                            pinCountdown <= 10 ? "text-red-500" :
                                            pinCountdown <= 20 ? "text-amber-500" : "text-blue-400"
                                        }`}>{pinCountdown}s</span>
                                    </div>
                                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200">
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
                                <p className="mb-6 text-xs text-slate-400">PIN เปลี่ยนทุก 1 นาที</p>
                            )}

                            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">QR CODE</p>
                            <div className="flex justify-center p-4 bg-white rounded-xl border-2 border-slate-200 mb-4">
                                <QRCodeSVG
                                    value={checkInUrl}
                                    size={300}
                                    level="L"
                                    fgColor="#000000"
                                    bgColor="#ffffff"
                                    marginSize={2}
                                />
                            </div>

                            {/* Countdown */}
                            <div className="mt-4">
                                <div className="flex items-center justify-center gap-1 text-slate-400 mb-2">
                                    <Icon icon="solar:clock-circle-linear" className="text-base" />
                                    <span className="text-xs">เวลาที่เหลือ</span>
                                </div>
                                <div
                                    className={`inline-block px-6 py-3 rounded-xl ${
                                        isPastLateThreshold ? "bg-amber-500" : "bg-slate-700"
                                    }`}
                                >
                                    <span className="text-2xl font-mono font-bold text-white">
                                        {timeRemaining
                                            ? `${String(timeRemaining.hours).padStart(2, "0")}:${String(
                                                  timeRemaining.minutes
                                              ).padStart(2, "0")}:${String(timeRemaining.seconds).padStart(
                                                  2,
                                                  "0"
                                              )}`
                                            : "00:00:00"}
                                    </span>
                                </div>
                                {lateThresholdDisplay && (
                                    <div className="mt-2 text-xs text-amber-400">
                                        <Icon icon="solar:alarm-bold" className="inline mr-1" />
                                        ตัดสาย {lateThresholdDisplay} น.
                                    </div>
                                )}
                            </div>
                        </CardBody>
                    </Card>
                </div>

                {/* Right — Stats & List (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Stats */}
                    <Card className="shadow-lg border-0">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:chart-2-linear" className="text-xl text-blue-500" />
                                <h3 className="text-lg font-semibold text-slate-700">สถิติภาพรวมการเช็กชื่อ</h3>
                            </div>
                        </CardHeader>
                        <CardBody>
                            {lateThresholdDisplay && (
                                <div
                                    className={`mb-4 p-3 rounded-xl flex items-center gap-3 ${
                                        isPastLateThreshold
                                            ? "bg-amber-100 border border-amber-300"
                                            : "bg-amber-50 border border-amber-200"
                                    }`}
                                >
                                    <Icon
                                        icon="solar:clock-circle-bold"
                                        className={`text-2xl ${
                                            isPastLateThreshold ? "text-amber-600" : "text-amber-500"
                                        }`}
                                    />
                                    <p
                                        className={`text-sm font-medium ${
                                            isPastLateThreshold ? "text-amber-800" : "text-amber-700"
                                        }`}
                                    >
                                        เกณฑ์เวลาสาย:{" "}
                                        <span className="font-bold">{lateThresholdDisplay} น.</span>
                                        {isPastLateThreshold && (
                                            <span className="ml-2 text-red-600">(เลยเวลาตัดสายแล้ว)</span>
                                        )}
                                    </p>
                                    <p className="text-xs text-amber-600">
                                        เช็กชื่อหลัง {lateThresholdDisplay} น. จะถือว่า "สาย"
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-blue-100 rounded-lg">
                                            <Icon icon="solar:users-group-rounded-bold" className="text-lg text-blue-500" />
                                        </div>
                                        <p className="text-xs text-blue-600 font-medium">เช็กชื่อแล้ว</p>
                                    </div>
                                    <p className="text-2xl font-bold text-blue-600">{stats.checkedIn}</p>
                                </div>
                                <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-green-100 rounded-lg">
                                            <Icon icon="solar:check-circle-bold" className="text-lg text-green-500" />
                                        </div>
                                        <p className="text-xs text-green-600 font-medium">มาเรียน</p>
                                    </div>
                                    <p className="text-2xl font-bold text-green-600">{stats.present}</p>
                                </div>
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-amber-100 rounded-lg">
                                            <Icon icon="solar:clock-circle-bold" className="text-lg text-amber-500" />
                                        </div>
                                        <p className="text-xs text-amber-600 font-medium">สาย</p>
                                    </div>
                                    <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-slate-100 rounded-lg">
                                            <Icon icon="solar:document-bold" className="text-lg text-slate-500" />
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium">ลา</p>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-600">{stats.leave}</p>
                                </div>
                                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-red-100 rounded-lg">
                                            <Icon icon="solar:close-circle-bold" className="text-lg text-red-500" />
                                        </div>
                                        <p className="text-xs text-red-600 font-medium">ขาด</p>
                                    </div>
                                    <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="mt-4">
                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                    <span>ความคืบหน้าการเช็กชื่อ</span>
                                    <span>
                                        {stats.checkedIn}/{stats.total} คน
                                    </span>
                                </div>
                                <Progress
                                    value={stats.total > 0 ? (stats.checkedIn / stats.total) * 100 : 0}
                                    aria-label="ความคืบหน้าการเช็กชื่อ"
                                    color="success"
                                    className="h-2"
                                />
                            </div>
                        </CardBody>
                    </Card>

                    {/* Checked-in List */}
                    <Card className="shadow-lg border-0 overflow-hidden">
                        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-slate-200 bg-blue-50/50">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Icon icon="solar:checklist-minimalistic-linear" className="text-xl text-blue-600" />
                                รายชื่อผู้เช็กชื่อ
                                <Chip size="sm" variant="flat" color="primary">{stats.checkedIn} คน</Chip>
                            </h2>
                            <Input
                                placeholder="ค้นหาชื่อ / รหัสนักศึกษา..."
                                value={searchQuery}
                                onValueChange={setSearchQuery}
                                size="sm"
                                variant="bordered"
                                isClearable
                                startContent={<Icon icon="solar:magnifer-linear" className="text-slate-400" />}
                                classNames={{
                                    inputWrapper: "h-9 min-h-9 bg-white",
                                    input: "text-sm",
                                }}
                                className="w-full sm:w-64"
                            />
                        </CardHeader>
                        <CardBody className="p-0">
                            <div className="overflow-y-auto max-h-100 p-3">
                                <Table
                                    aria-label="รายชื่อผู้เช็กชื่อ"
                                    removeWrapper
                                    classNames={{
                                        th: "bg-slate-50 text-slate-500 font-medium text-xs uppercase",
                                        td: "py-3",
                                    }}
                                >
                                    <TableHeader>
                                        <TableColumn>สถานะ</TableColumn>
                                        <TableColumn>ชื่อนักศึกษา / รหัส</TableColumn>
                                        <TableColumn align="center">เวลาเช็กชื่อ</TableColumn>
                                    </TableHeader>
                                    <TableBody
                                        emptyContent={
                                            <div className="py-16 text-center">
                                                <div className="inline-block p-4 bg-slate-100 rounded-full mb-4">
                                                    <Icon
                                                        icon="solar:users-group-rounded-linear"
                                                        className="text-5xl text-slate-300"
                                                    />
                                                </div>
                                                <p className="text-slate-500 font-medium">ยังไม่มีผู้เช็กชื่อ</p>
                                                <p className="text-slate-400 text-sm mt-1">
                                                    รอนักศึกษาสแกน QR Code หรือกรอก PIN
                                                </p>
                                            </div>
                                        }
                                    >
                                        {sortedFilteredRecords.map((record) => {
                                            const sc = statusConfig[record.status] ?? {
                                                label: record.status,
                                                color: "default" as const,
                                                icon: "solar:question-circle-bold",
                                            };
                                            return (
                                                <TableRow key={record.id}>
                                                    <TableCell>
                                                        <Chip
                                                            size="sm"
                                                            color={sc.color}
                                                            variant="flat"
                                                            startContent={<Icon icon={sc.icon} className="text-xs" />}
                                                        >
                                                            {sc.label}
                                                        </Chip>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar
                                                                name={record.student?.full_name || "?"}
                                                                size="sm"
                                                                className="bg-linear-to-br from-blue-400 to-indigo-500"
                                                            />
                                                            <div>
                                                                <p className="font-medium text-slate-800">
                                                                    {record.student?.full_name || "-"}
                                                                </p>
                                                                <p className="text-xs text-slate-400">
                                                                    {record.student?.student_id || "-"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-center">
                                                            <span className="font-mono text-slate-600 text-sm">
                                                                {formatTime(record.check_in_time)}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
}
