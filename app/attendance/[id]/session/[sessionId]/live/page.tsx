"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Avatar } from "@heroui/avatar";
import { Spinner } from "@heroui/spinner";
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
import { io, Socket } from "socket.io-client";
import attendanceService, {
    type AttendanceSession,
    type AttendanceRecord,
} from "@/services/attendance.service";

// Status display config
const statusConfig: Record<
    string,
    { label: string; color: "success" | "warning" | "danger" | "default"; icon: string }
> = {
    present: { label: "มา", color: "success", icon: "solar:check-circle-bold" },
    late: { label: "สาย", color: "warning", icon: "solar:clock-circle-bold" },
    leave: { label: "ลา", color: "default", icon: "solar:document-bold" },
    absent: { label: "ขาด", color: "danger", icon: "solar:close-circle-bold" },
};

// Format time
function formatTime(dateString: string | null): string {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

// Format datetime
function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function LiveAttendancePage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.id as string;
    const sessionId = Number(params.sessionId);

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

    // Modal states
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [newStatus, setNewStatus] = useState<string>("");
    const [statusNote, setStatusNote] = useState("");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // QR Modal
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);

    // Search filter
    const [searchQuery, setSearchQuery] = useState("");

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
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [sessionData, recordsData] = await Promise.all([
                attendanceService.getSession(sessionId),
                attendanceService.getRecords(sessionId),
            ]);

            if (sessionData) {
                setSession(sessionData);
            }

            setRecords(recordsData);
        } catch (error) {
            console.error("Error fetching data:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถโหลดข้อมูลได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

    // Initialize socket connection
    useEffect(() => {
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || window.location.origin;
        
        const socket = io(socketUrl, {
            path: "/socket.io",
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on("connect", () => {
            console.log("✅ Socket connected:", socket.id);
            socket.emit("join-instructor", sessionId);
        });

        socket.on("connect_error", (err) => {
            console.error("❌ Socket connect error:", err.message);
        });

        socket.on("disconnect", (reason) => {
            console.warn("⚠️ Socket disconnected:", reason);
        });

        // Listen for new check-ins
        socket.on("student-checked-in", (data: { record: AttendanceRecord }) => {
            console.log("Student checked in:", data);
            setRecords((prev) => {
                const existing = prev.find((r) => r.id === data.record.id);
                if (existing) {
                    return prev.map((r) => (r.id === data.record.id ? data.record : r));
                }
                return [...prev, data.record];
            });
            addToast({
                title: "นักศึกษาเช็คชื่อ",
                description: `${data.record.student?.full_name || "นักศึกษา"} เช็คชื่อเรียบร้อย`,
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

        // Listen for session closed
        socket.on("session-closed", () => {
            addToast({
                title: "ปิดรอบเช็คชื่อแล้ว",
                description: "รอบการเช็คชื่อถูกปิดแล้ว",
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
    }, [sessionId]);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
                lateThreshold.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
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
    }, [session]);

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
                setSession({ ...session, status: "closed" });
                addToast({
                    title: "สำเร็จ",
                    description: "ปิดรอบการเช็คชื่อเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            console.error("Error closing session:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถปิดรอบเช็คชื่อได้",
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
                    title: "สำเร็จ",
                    description: "อัปเดตสถานะเรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            console.error("Error updating status:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถอัปเดตสถานะได้",
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
                title: "คัดลอกแล้ว",
                description: "PIN ถูกคัดลอกไปยังคลิปบอร์ดแล้ว",
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
            title: "คัดลอกแล้ว",
            description: "URL ถูกคัดลอกไปยังคลิปบอร์ดแล้ว",
            color: "success",
            timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
    };

    const sessionOpen = isSessionOpen();
    const now = new Date();
    const notStarted = session ? now < new Date(session.start_time) : false;

    // Format short datetime
    const formatShortDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString("th-TH", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Total students count (should be fetched from course enrollment)
    const totalStudents = (session?.course as { enrollment_count?: number } | undefined)?.enrollment_count || records.length || 0;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-15 h-15 bg-gradient-to-br from-blue-400 to-indigo-500 rounded flex items-center justify-center text-white text-4xl">
                        <IoSchool />
                    </div>
                    <Spinner size="lg" color="primary" />
                    <p className="text-slate-500">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-slate-50">
                <Card className="max-w-md shadow-xl border-2 border-dashed">
                    <CardBody className="text-center py-12">
                        <Icon icon="solar:clipboard-remove-bold-duotone" className="text-6xl text-slate-300 mx-auto mb-4" />
                        <p className="text-lg text-slate-600 mb-2">ไม่พบข้อมูลการเช็คชื่อ</p>
                        <p className="text-sm text-slate-400 mb-6">กรุณาตรวจสอบลิงก์อีกครั้ง</p>
                        <Button
                            className="w-full bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-lg"
                            onPress={() => router.back()}
                        >
                            กลับหน้าหลัก
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 p-4 lg:p-6">
            {/* Header Card with Purple Gradient Bar */}
            <Card className="mb-6 shadow-lg border-0 overflow-hidden">
                {/* Purple Gradient Bar */}
                {/* <div className="h-2 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400" /> */}

                <CardBody className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        {/* Left - Title & Course Info */}
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 mb-2">
                                {session.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                                <span>รหัสวิชา: {session.course?.code || "-"}</span>
                                <span>ชื่อวิชา: {session.course?.name || "-"}</span>
                                <span>ปีการศึกษา: {session.course?.year || "-"}</span>
                                <span>ภาคเรียน: {session.course?.semester || "-"}</span>
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
                                    ปิดรับการเช็คชื่อ
                                </Button>
                            )}

                            {/* Time Info */}
                            <div className="text-sm text-right">
                                <div className="flex items-center gap-2 text-green-600">
                                    <Icon icon="solar:clock-circle-linear" className="text-base" />
                                    <span>เริ่ม: {formatShortDateTime(session.start_time)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-orange-500 mt-1">
                                    <Icon icon="solar:clock-circle-linear" className="text-base" />
                                    <span>สิ้นสุด: {formatShortDateTime(session.end_time)}</span>
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
                    <Card className="shadow-lg border-0 h-full">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:key-minimalistic-square-2-linear" className="text-xl text-blue-500" />
                                <h3 className="text-lg font-semibold text-slate-700">รหัสและช่องทางการเช็คชื่อ</h3>
                            </div>
                        </CardHeader>
                        <CardBody className="text-center pt-2">
                            {/* PIN CODE */}
                            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">PIN CODE</p>
                            <div
                                className="text-5xl font-bold text-blue-500 tracking-[0.2em] mb-6 cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={copyPIN}
                            >
                                {session.pin_code}
                            </div>

                            {/* QR CODE */}
                            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">QR CODE (คลิกเพื่อขยาย)</p>
                            <div
                                className="flex justify-center p-4 bg-white rounded-xl border-2 border-slate-200 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all mb-4"
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
                                <div className="flex items-center justify-center gap-1 text-slate-400 mb-2">
                                    <Icon icon="solar:clock-circle-linear" className="text-base" />
                                    <span className="text-xs">เวลาที่เหลือ</span>
                                </div>
                                <div className={`inline-block px-6 py-3 rounded-xl ${isPastLateThreshold ? 'bg-amber-500' : 'bg-slate-700'}`}>
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
                                        ตัดสาย {lateThresholdDisplay} น.
                                    </div>
                                )}
                            </div>
                        </CardBody>
                    </Card>
                </div>

                {/* Right Column - Stats & Student List (8/12) */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="shadow-lg border-0">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:chart-2-linear" className="text-xl text-blue-500" />
                                <h3 className="text-lg font-semibold text-slate-700">สถิติภาพรวมการเช็คชื่อ</h3>
                            </div>
                        </CardHeader>
                        <CardBody>
                            {/* Late threshold info */}
                            {lateThresholdDisplay && (
                                <div className={`mb-4 p-3 rounded-xl flex items-center gap-3 ${isPastLateThreshold ? 'bg-amber-100 border border-amber-300' : 'bg-amber-50 border border-amber-200'}`}>
                                    <Icon icon="solar:clock-circle-bold" className={`text-2xl ${isPastLateThreshold ? 'text-amber-600' : 'text-amber-500'}`} />
                                    <div>
                                        <p className={`text-sm font-medium ${isPastLateThreshold ? 'text-amber-800' : 'text-amber-700'}`}>
                                            เกณฑ์เวลาสาย: <span className="font-bold">{lateThresholdDisplay} น.</span>
                                            {isPastLateThreshold && <span className="ml-2 text-red-600">(เลยเวลาตัดสายแล้ว)</span>}
                                        </p>
                                        <p className="text-xs text-amber-600">
                                            เช็คชื่อหลัง {lateThresholdDisplay} น. จะถือว่า "สาย"
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                {/* นักศึกษาทั้งหมด */}
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-blue-100 rounded-lg">
                                            <Icon icon="solar:users-group-rounded-bold" className="text-lg text-blue-500" />
                                        </div>
                                        <p className="text-xs text-blue-600 font-medium">เช็คชื่อแล้ว</p>
                                    </div>
                                    <p className="text-2xl font-bold text-blue-600">{stats.checkedIn}</p>
                                </div>

                                {/* มาเรียน (Present) */}
                                <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-green-100 rounded-lg">
                                            <Icon icon="solar:check-circle-bold" className="text-lg text-green-500" />
                                        </div>
                                        <p className="text-xs text-green-600 font-medium">มาเรียน</p>
                                    </div>
                                    <p className="text-2xl font-bold text-green-600">{stats.present}</p>
                                </div>

                                {/* สาย (Late) */}
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-amber-100 rounded-lg">
                                            <Icon icon="solar:clock-circle-bold" className="text-lg text-amber-500" />
                                        </div>
                                        <p className="text-xs text-amber-600 font-medium">สาย</p>
                                    </div>
                                    <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
                                </div>

                                {/* ลา (Leave) */}
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-slate-100 rounded-lg">
                                            <Icon icon="solar:document-bold" className="text-lg text-slate-500" />
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium">ลา</p>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-600">{stats.leave}</p>
                                </div>

                                {/* ขาด (Absent) */}
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
                        </CardBody>
                    </Card>

                    {/* Student List Table */}
                    <Card className="shadow-lg border-0 overflow-hidden">
                        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-slate-200 bg-blue-50/50">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Icon icon="solar:checklist-minimalistic-linear" className="text-xl text-blue-600" />
                                รายชื่อผู้เช็คชื่อ
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
                                    input: "text-sm"
                                }}
                                className="w-full sm:w-64"
                            />
                        </CardHeader>
                        <CardBody className="p-0">
                            <div className="overflow-y-auto max-h-[400px] p-3">
                                <Table
                                    aria-label="Student attendance table"
                                    removeWrapper
                                    classNames={{
                                        th: "bg-slate-50 text-slate-500 font-medium text-xs uppercase",
                                        td: "py-3",
                                    }}
                                >
                                    <TableHeader>
                                        {[
                                            <TableColumn key="status">สถานะ</TableColumn>,
                                            <TableColumn key="name">ชื่อนักศึกษา / รหัส</TableColumn>,
                                            <TableColumn key="time" align="center">เวลาเช็คชื่อ</TableColumn>,
                                            ...(session.check_location ? [<TableColumn key="distance" align="center">ระยะห่าง</TableColumn>] : [])
                                        ]}
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
                                                <p className="text-slate-500 font-medium">ยังไม่มีนักศึกษาเช็คชื่อ</p>
                                                <p className="text-slate-400 text-sm mt-1">
                                                    รอนักศึกษาสแกน QR Code หรือกรอก PIN
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
                                                            {statusConfig[record.status]?.label || record.status}
                                                        </Chip>
                                                    </TableCell>,
                                                    <TableCell key="name">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar
                                                                name={record.student?.full_name || "?"}
                                                                size="sm"
                                                                className="bg-gradient-to-br from-blue-400 to-indigo-500"
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
                                                    </TableCell>,
                                                    <TableCell key="time">
                                                        <span className="font-mono text-slate-600 text-sm">
                                                            {formatTime(record.check_in_time)}
                                                        </span>
                                                    </TableCell>,
                                                    ...(session.check_location ? [
                                                        <TableCell key="distance">
                                                            {record.distance_meters !== null ? (
                                                                <Tooltip content={record.location_verified ? "ตำแหน่งถูกต้อง" : "ตำแหน่งไม่ตรง"}>
                                                                    <Chip
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color={record.location_verified ? "success" : "warning"}
                                                                        startContent={<Icon icon={record.location_verified ? "solar:map-point-bold" : "solar:map-point-wave-bold"} className="text-xs" />}
                                                                    >
                                                                        {record.distance_meters < 1000
                                                                            ? `${Math.round(record.distance_meters)} ม.`
                                                                            : `${(record.distance_meters / 1000).toFixed(1)} กม.`
                                                                        }
                                                                    </Chip>
                                                                </Tooltip>
                                                            ) : (
                                                                <span className="text-xs text-slate-400">-</span>
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
                        <ModalContent className="bg-white">
                            <ModalBody className="flex flex-col items-center justify-center min-h-screen py-10">
                                <h2 className="text-3xl font-bold text-slate-800 mb-2">
                                    {session.title}
                                </h2>
                                <p className="text-slate-500 mb-6">สแกน QR Code เพื่อเช็คชื่อเข้าเรียน</p>
                                
                                {/* QR Code - optimized for scanning */}
                                <div className="p-2 bg-white rounded-3xl shadow-xl border-4 border-slate-100">
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
                                    <div className="inline-block px-10 py-5 bg-slate-800 rounded-2xl shadow-lg">
                                        <p className="text-6xl font-bold tracking-[0.4em] text-white font-mono">
                                            {session.pin_code}
                                        </p>
                                    </div>
                                </div>

                                {/* Late threshold info */}
                                {session.late_threshold_minutes > 0 && (
                                    <div className="mt-6 flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                                        <Icon icon="solar:clock-circle-bold" className="text-xl" />
                                        <span className="text-sm">เช็คชื่อหลัง {session.late_threshold_minutes} นาที ถือว่าสาย</span>
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
                            เปลี่ยนสถานะการเช็คชื่อ
                        </div>
                    </ModalHeader>
                    <ModalBody className="py-4">
                        {selectedRecord && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                                    <Avatar
                                        name={selectedRecord.student?.full_name || "?"}
                                        size="md"
                                        className="bg-gradient-to-br from-blue-400 to-indigo-500"
                                    />
                                    <div>
                                        <p className="font-semibold text-slate-800">
                                            {selectedRecord.student?.full_name}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            ID: {selectedRecord.student?.student_id}
                                        </p>
                                    </div>
                                </div>

                                <Select
                                    label="สถานะ"
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
                                        มา
                                    </SelectItem>
                                    <SelectItem
                                        key="late"
                                        startContent={
                                            <Icon icon="solar:clock-circle-bold" className="text-amber-500" />
                                        }
                                    >
                                        สาย
                                    </SelectItem>
                                    <SelectItem
                                        key="leave"
                                        startContent={
                                            <Icon icon="solar:document-bold" className="text-slate-500" />
                                        }
                                    >
                                        ลา
                                    </SelectItem>
                                    <SelectItem
                                        key="absent"
                                        startContent={
                                            <Icon icon="solar:close-circle-bold" className="text-red-500" />
                                        }
                                    >
                                        ขาด
                                    </SelectItem>
                                </Select>

                                <Input
                                    label="หมายเหตุ (ถ้ามี)"
                                    placeholder="ระบุเหตุผล..."
                                    value={statusNote}
                                    onValueChange={setStatusNote}
                                />
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={() => setIsStatusModalOpen(false)}>
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleUpdateStatus}
                            isLoading={isUpdatingStatus}
                        >
                            บันทึก
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
