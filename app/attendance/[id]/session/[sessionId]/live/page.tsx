"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
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

// ── ขนาดของทุกอย่างบนจอ เปลี่ยนตามขนาดหน้าต่างเพื่อไม่ให้ต้องเลื่อนจอ ──
type ScreenProfile = {
    key: "big" | "standard" | "small" | "half" | "third";
    narrow: boolean;
    pad: number; gap: number; bigR: number;
    head: number; headPad: number; logo: number;
    codeF: number; titleF: number; subF: number; metaF: number; clockF: number;
    panel: number; panelPad: number; panelGap: number;
    tileH: number; pinF: number; tileGap: number; barRow: number;
    qr: number; qrLogo: number; urlF: number;
    stat: number; countF: number; barH: number;
    rosterHead: number; rosterPad: number; rosterTitleF: number;
    minCardW: number; cardH: number; gridGap: number;
    cardGap: number; cardR: number; av: number; avR: number; avF: number; nameF: number; moreF: number;
};

const PROFILES: Record<ScreenProfile["key"], ScreenProfile> = {
    big: {
        key: "big", narrow: false, pad: 28, gap: 22, bigR: 30, head: 112, headPad: 32, logo: 70,
        codeF: 28, titleF: 32, subF: 18, metaF: 16, clockF: 36,
        panel: 660, panelPad: 30, panelGap: 16, tileH: 140, pinF: 74, tileGap: 12, barRow: 44,
        qr: 340, qrLogo: 74, urlF: 28, stat: 150, countF: 74, barH: 20,
        rosterHead: 70, rosterPad: 20, rosterTitleF: 27,
        minCardW: 230, cardH: 100, gridGap: 16,
        cardGap: 14, cardR: 20, av: 50, avR: 16, avF: 23, nameF: 19, moreF: 46,
    },
    standard: {
        key: "standard", narrow: false, pad: 24, gap: 20, bigR: 26, head: 96, headPad: 28, logo: 60,
        codeF: 24, titleF: 27, subF: 16, metaF: 14, clockF: 30,
        panel: 560, panelPad: 26, panelGap: 14, tileH: 116, pinF: 60, tileGap: 10, barRow: 40,
        qr: 288, qrLogo: 64, urlF: 24, stat: 130, countF: 62, barH: 18,
        rosterHead: 62, rosterPad: 18, rosterTitleF: 22,
        minCardW: 210, cardH: 86, gridGap: 14,
        cardGap: 12, cardR: 18, av: 44, avR: 14, avF: 20, nameF: 17, moreF: 40,
    },
    small: {
        key: "small", narrow: false, pad: 18, gap: 16, bigR: 22, head: 76, headPad: 22, logo: 48,
        codeF: 19, titleF: 21, subF: 13, metaF: 13, clockF: 24,
        panel: 440, panelPad: 20, panelGap: 12, tileH: 86, pinF: 44, tileGap: 8, barRow: 32,
        qr: 196, qrLogo: 46, urlF: 18, stat: 96, countF: 46, barH: 14,
        rosterHead: 50, rosterPad: 13, rosterTitleF: 17,
        minCardW: 190, cardH: 74, gridGap: 11,
        cardGap: 10, cardR: 16, av: 40, avR: 13, avF: 18, nameF: 16, moreF: 34,
    },
    half: {
        key: "half", narrow: true, pad: 16, gap: 14, bigR: 22, head: 76, headPad: 18, logo: 48,
        codeF: 19, titleF: 20, subF: 13, metaF: 13, clockF: 24,
        panel: 0, panelPad: 18, panelGap: 12, tileH: 112, pinF: 58, tileGap: 8, barRow: 30,
        qr: 190, qrLogo: 46, urlF: 17, stat: 92, countF: 46, barH: 14,
        rosterHead: 52, rosterPad: 14, rosterTitleF: 18,
        minCardW: 200, cardH: 82, gridGap: 12,
        cardGap: 11, cardR: 16, av: 42, avR: 14, avF: 19, nameF: 17, moreF: 34,
    },
    third: {
        key: "third", narrow: true, pad: 14, gap: 12, bigR: 18, head: 64, headPad: 14, logo: 40,
        codeF: 16, titleF: 16, subF: 12, metaF: 12, clockF: 20,
        panel: 0, panelPad: 14, panelGap: 10, tileH: 68, pinF: 30, tileGap: 6, barRow: 26,
        qr: 260, qrLogo: 54, urlF: 14, stat: 80, countF: 38, barH: 12,
        rosterHead: 46, rosterPad: 11, rosterTitleF: 16,
        minCardW: 150, cardH: 68, gridGap: 9,
        cardGap: 9, cardR: 14, av: 36, avR: 12, avF: 17, nameF: 15, moreF: 30,
    },
};

function pickProfile(width: number): ScreenProfile {
    if (width >= 1750) return PROFILES.big;
    if (width >= 1440) return PROFILES.standard;
    if (width >= 1100) return PROFILES.small;
    if (width >= 780) return PROFILES.half;
    return PROFILES.third;
}

// วัดขนาดกล่องจริงเพื่อคำนวณจำนวนการ์ดที่ใส่ได้พอดี
function useElementSize<E extends HTMLElement>() {
    const ref = useRef<E | null>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const element = ref.current;
        if (!element || typeof ResizeObserver === "undefined") return;

        const observer = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (!rect) return;
            setSize((prev) =>
                Math.abs(prev.width - rect.width) < 1 && Math.abs(prev.height - rect.height) < 1
                    ? prev
                    : { width: rect.width, height: rect.height }
            );
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return [ref, size] as const;
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
    const S = useMemo(() => pickProfile(viewportWidth), [viewportWidth]);

    const [gridRef, gridSize] = useElementSize<HTMLDivElement>();
    const [pinRowRef, pinRowSize] = useElementSize<HTMLDivElement>();

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
        });

        socket.on("instructor-join-rejected", () => {
            console.warn("Attendance socket: room join rejected, live updates are off. Reload to retry.");
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
    }, [sessionId, isEnglish]);

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

    // ── อนิเมชันการ์ดที่เพิ่งเช็กเข้ามา ──
    const seenRecordIdsRef = useRef<Set<number>>(new Set());
    const hasSeededRef = useRef(false);
    const [enteringIds, setEnteringIds] = useState<number[]>([]);
    const [splash, setSplash] = useState<{ id: number; name: string } | null>(null);
    const [countBump, setCountBump] = useState(0);

    useEffect(() => {
        const seen = seenRecordIdsRef.current;

        if (!hasSeededRef.current) {
            if (isLoading) return;
            checkedInRecords.forEach((record) => seen.add(record.id));
            hasSeededRef.current = true;
            return;
        }

        const fresh = checkedInRecords.filter((record) => !seen.has(record.id));
        if (fresh.length === 0) return;

        fresh.forEach((record) => seen.add(record.id));
        const freshIds = fresh.map((record) => record.id);
        setEnteringIds((prev) => [...prev, ...freshIds]);

        const newest = fresh[0];
        setSplash({ id: newest.id, name: newest.student?.full_name || t("นักศึกษา", "Student") });
        setCountBump((value) => value + 1);

        const clearEnter = window.setTimeout(() => {
            setEnteringIds((prev) => prev.filter((id) => !freshIds.includes(id)));
        }, 1300);
        const clearSplash = window.setTimeout(() => {
            setSplash((current) => (current && current.id === newest.id ? null : current));
        }, 2200);

        return () => {
            window.clearTimeout(clearEnter);
            window.clearTimeout(clearSplash);
        };
    }, [checkedInRecords, isLoading, isEnglish]);

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
    const checkInUrlLabel = checkInUrl.replace(/^https?:\/\//, "");

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
    const pendingCount = Math.max(0, totalStudents - stats.checkedIn);

    // ── จำนวนการ์ดที่ใส่ได้พอดีในพื้นที่ที่เหลือ ──
    const capacity = useMemo(() => {
        if (!gridSize.width || !gridSize.height) {
            return { cols: S.narrow ? 2 : 4, cells: S.narrow ? 8 : 20 };
        }
        const cols = Math.max(1, Math.floor((gridSize.width + S.gridGap) / (S.minCardW + S.gridGap)));
        const rows = Math.max(1, Math.floor((gridSize.height + S.gridGap) / (S.cardH + S.gridGap)));
        return { cols, cells: cols * rows };
    }, [gridSize, S]);

    const hasOverflow = checkedInRecords.length > capacity.cells;
    const visibleRecords = hasOverflow
        ? checkedInRecords.slice(0, Math.max(0, capacity.cells - 1))
        : checkedInRecords;
    const hiddenCount = checkedInRecords.length - visibleRecords.length;

    // ขนาดตัวเลข PIN คำนวณจากความกว้างที่เหลือจริง จะได้ไม่ล้นแถว
    const pinDigits = (session?.pin_code || "").split("");
    const pinFontSize = useMemo(() => {
        if (!pinRowSize.width || pinDigits.length === 0) return S.pinF;
        const tileWidth = (pinRowSize.width - (pinDigits.length - 1) * S.tileGap) / pinDigits.length;
        return Math.max(18, Math.min(S.pinF, Math.floor(tileWidth * 1.1), Math.floor(S.tileH * 0.86)));
    }, [pinRowSize.width, pinDigits.length, S]);

    const qrSize = S.narrow
        ? Math.max(120, Math.min(S.qr, Math.round(viewportWidth * 0.42)))
        : S.qr;

    // QR ในหน้าต่างขยาย ใหญ่ที่สุดเท่าที่จอรับได้โดยไม่ต้องเลื่อน
    const modalQrSize = Math.max(200, Math.min(460, Math.round(viewportWidth * 0.5), Math.round(viewportHeight * 0.46)));
    const modalPinFontSize = Math.max(28, Math.min(60, Math.round(viewportHeight * 0.07)));

    if (!session && !isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Card className="max-w-md border-2 border-dashed border-default-300 bg-content1 shadow-xl">
                    <CardBody className="py-12 text-center">
                        <Icon icon="solar:clipboard-remove-bold-duotone" className="mx-auto mb-4 text-6xl text-default-300" />
                        <p className="mb-2 text-lg text-default-600">{t("ไม่พบข้อมูลการเช็กชื่อ", "Attendance session not found")}</p>
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

    const headerSubtitle = [
        session.title,
        lateThresholdDisplay ? (isEnglish ? `late after ${lateThresholdDisplay}` : `เกณฑ์เวลาสาย ${lateThresholdDisplay} น.`) : null,
    ].filter(Boolean).join(isEnglish ? " — " : "   ");

    // ── ส่วนประกอบย่อย ──
    const pinBlock = (
        <>
            <div style={{ fontSize: S.metaF }} className="font-medium tracking-[0.1em] text-default-400">
                {t("รหัส PIN สำหรับเช็กชื่อ", "PIN for check-in")}
            </div>
            {pinDigits.length > 0 ? (
                <div
                    ref={pinRowRef}
                    className="flex cursor-pointer"
                    style={{ gap: S.tileGap, height: S.tileH }}
                    onClick={copyPIN}
                    title={t("คลิกเพื่อคัดลอกรหัส PIN", "Click to copy the PIN")}
                >
                    {pinDigits.map((digit, index) => (
                        <div
                            key={`${digit}-${index}`}
                            className="flex min-w-0 flex-1 items-center justify-center overflow-hidden border border-blue-100 bg-blue-50 font-mono font-bold leading-none text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
                            style={{ borderRadius: S.cardR + 4, fontSize: pinFontSize }}
                        >
                            {digit}
                        </div>
                    ))}
                </div>
            ) : (
                <div
                    className="flex items-center justify-center rounded-2xl border border-dashed border-default-300 bg-content2 px-4 text-center text-default-500"
                    style={{ height: S.tileH, fontSize: S.metaF }}
                >
                    {pinAvailabilityMessage}
                </div>
            )}

            {isRotatingPinSession(session) ? (
                <div className="flex items-center" style={{ height: S.barRow, gap: 10 }}>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-default-200">
                        <div
                            className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                                pinCountdown !== null && pinCountdown <= 10 ? "bg-red-500"
                                    : pinCountdown !== null && pinCountdown <= 20 ? "bg-amber-400" : "bg-blue-400"
                            }`}
                            style={{
                                width: pinCountdown !== null && pinTotal
                                    ? `${Math.max(0, (pinCountdown / pinTotal) * 100)}%`
                                    : "100%",
                            }}
                        />
                    </div>
                    <span className="shrink-0 text-default-500" style={{ fontSize: S.metaF }}>
                        {t("เปลี่ยนรหัสใน", "New PIN in")}{" "}
                        <span className="font-mono font-semibold tabular-nums text-foreground">
                            {pinCountdown !== null ? pinCountdown : "--"}
                        </span>{" "}
                        {t("วินาที", "s")}
                    </span>
                </div>
            ) : (
                <div className="flex items-center text-default-500" style={{ height: S.barRow, fontSize: S.metaF }}>
                    {t("PIN คงที่ตลอดรอบนี้", "This PIN stays fixed for the whole session")}
                </div>
            )}
        </>
    );

    const qrBlock = (
        <div
            className="relative shrink-0 cursor-pointer border-2 border-blue-100 bg-white p-3 transition-colors hover:border-blue-300 dark:border-blue-900/50"
            style={{ borderRadius: S.bigR, padding: S.narrow ? 8 : 12 }}
            onClick={() => setIsQRModalOpen(true)}
            title={t("คลิกเพื่อขยาย QR Code", "Click to enlarge the QR code")}
        >
            <QRCodeSVG value={checkInUrl} size={qrSize} level="L" fgColor="#0f172a" bgColor="#ffffff" marginSize={1} />
            <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-blue-100 bg-white"
                style={{
                    width: S.qrLogo,
                    height: S.qrLogo,
                    borderRadius: Math.round(S.qrLogo * 0.28),
                    padding: Math.round(S.qrLogo * 0.11),
                }}
            >
                <Image
                    src="/images/logo-cp.png"
                    alt={t("ตราสัญลักษณ์คณะ", "Faculty logo")}
                    width={96}
                    height={96}
                    className="h-full w-full object-contain"
                />
            </div>
        </div>
    );

    const statBlock = (
        <div
            className="flex shrink-0 items-center border border-default-200 bg-content1"
            style={{ height: S.stat, borderRadius: S.bigR - 2, paddingLeft: S.panelPad, paddingRight: S.panelPad, gap: S.narrow ? 16 : 26 }}
        >
            <div className="shrink-0">
                <div className="font-medium text-default-500" style={{ fontSize: S.metaF }}>
                    {t("เช็กชื่อแล้ว", "Checked in")}
                </div>
                <div className="flex items-baseline gap-1.5">
                    <span
                        key={countBump}
                        className="attendance-count-bump inline-block font-mono font-bold leading-none tabular-nums text-blue-600 dark:text-blue-400"
                        style={{ fontSize: S.countF }}
                    >
                        {stats.checkedIn}
                    </span>
                    <span className="font-mono text-default-400" style={{ fontSize: Math.round(S.countF * 0.42) }}>
                        / {totalStudents}
                    </span>
                </div>
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex overflow-hidden rounded-full bg-default-200" style={{ height: S.barH }}>
                    <div
                        className="bg-green-500 transition-[width] duration-500"
                        style={{ width: totalStudents ? `${(stats.present / totalStudents) * 100}%` : "0%" }}
                    />
                    <div
                        className="bg-amber-400 transition-[width] duration-500"
                        style={{ width: totalStudents ? `${(stats.late / totalStudents) * 100}%` : "0%" }}
                    />
                </div>
                <div className="mt-2 flex flex-wrap text-default-600" style={{ gap: S.narrow ? 12 : 22, fontSize: S.subF }}>
                    <span className="whitespace-nowrap">
                        <span className="mr-1.5 inline-block h-3 w-3 rounded bg-green-500 align-middle" />
                        {t("มาเรียน", "Present")} {stats.present}
                    </span>
                    <span className="whitespace-nowrap">
                        <span className="mr-1.5 inline-block h-3 w-3 rounded bg-amber-400 align-middle" />
                        {t("สาย", "Late")} {stats.late}
                    </span>
                    <span className="whitespace-nowrap">
                        <span className="mr-1.5 inline-block h-3 w-3 rounded bg-default-300 align-middle" />
                        {t("ยังไม่เช็กชื่อ", "Not yet")} {pendingCount}
                    </span>
                </div>
            </div>
        </div>
    );

    const studentCard = (record: AttendanceRecord, isNewest: boolean) => {
        const late = record.status === "late";
        const entering = enteringIds.includes(record.id);
        const name = record.student?.full_name || t("ไม่ทราบชื่อ", "Unknown");
        return (
            <button
                key={record.id}
                type="button"
                onClick={() => {
                    setSelectedRecord(record);
                    setIsStatusModalOpen(true);
                }}
                className={`attendance-card flex items-center overflow-hidden border bg-content1 text-left ${
                    isNewest ? "border-blue-400 shadow-md shadow-blue-500/20" : "border-default-200"
                } ${entering ? "attendance-card-enter" : ""}`}
                style={{ borderRadius: S.cardR, gap: S.cardGap, paddingLeft: S.cardGap, paddingRight: S.cardGap }}
            >
                <div
                    className={`flex shrink-0 items-center justify-center border font-semibold ${
                        late
                            ? "border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400"
                            : "border-green-100 bg-green-50 text-green-600 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-400"
                    }`}
                    style={{ width: S.av, height: S.av, borderRadius: S.avR, fontSize: S.avF }}
                >
                    {name.trim().charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                    <div
                        className="truncate font-medium leading-snug text-foreground"
                        style={{ fontSize: S.nameF }}
                    >
                        {name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${late ? "bg-amber-400" : "bg-green-500"}`} />
                        <span
                            className={`font-mono font-semibold ${late ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}
                            style={{ fontSize: S.metaF }}
                        >
                            {formatClock(record.check_in_time, isEnglish)}
                        </span>
                        <span className="truncate text-default-400" style={{ fontSize: S.metaF }}>
                            {isNewest ? t("เพิ่งเช็กชื่อ", "just checked in") : getStatusLabel(record.status, isEnglish)}
                        </span>
                    </div>
                </div>
            </button>
        );
    };

    const rosterBlock = (
        <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden border border-default-200 bg-content1"
            style={{ borderRadius: S.bigR }}
        >
            <div
                className="flex shrink-0 items-center justify-between gap-3 border-b border-divider"
                style={{ height: S.rosterHead, paddingLeft: S.panelPad, paddingRight: S.panelPad }}
            >
                <span className="shrink-0 font-semibold text-foreground" style={{ fontSize: S.rosterTitleF }}>
                    {t("รายชื่อผู้เช็กชื่อล่าสุด", "Latest check-ins")}
                </span>
                <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-default-500" style={{ fontSize: S.metaF }}>
                        {t(
                            `เรียงจากคนล่าสุด แสดงบนจอนี้ ${visibleRecords.length} คน`,
                            `Newest first, showing ${visibleRecords.length} here`
                        )}
                    </span>
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => setIsRosterModalOpen(true)}
                        aria-label={t("ดูรายชื่อผู้เช็กชื่อทั้งหมด", "See the full list")}
                    >
                        <Icon icon="solar:list-check-linear" className="text-lg text-default-500" />
                    </Button>
                </div>
            </div>

            <div className="relative min-h-0 flex-1">
                {splash && (
                    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
                        <div className="attendance-splash flex max-w-[90%] items-center gap-2 rounded-full bg-linear-to-r from-blue-400 to-indigo-500 px-5 py-2 text-white shadow-lg">
                            <Icon icon="solar:confetti-minimalistic-bold" className="text-xl" />
                            <span className="truncate font-medium" style={{ fontSize: S.subF }}>
                                {t(`${splash.name} เช็กชื่อแล้ว`, `${splash.name} just checked in`)}
                            </span>
                        </div>
                    </div>
                )}

                {checkedInRecords.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <Icon icon="solar:users-group-rounded-linear" className="mb-3 text-5xl text-default-300" />
                        <p className="font-medium text-default-500" style={{ fontSize: S.subF }}>
                            {t("ยังไม่มีนักศึกษาเช็กชื่อ", "No students have checked in yet")}
                        </p>
                        <p className="mt-1 text-default-400" style={{ fontSize: S.metaF }}>
                            {t("รอนักศึกษาสแกน QR Code หรือกรอกรหัส PIN", "Waiting for students to scan the QR code or enter the PIN")}
                        </p>
                    </div>
                )}

                <div
                    ref={gridRef}
                    className={`absolute inset-0 grid content-start ${checkedInRecords.length === 0 ? "invisible" : ""}`}
                    style={{
                        padding: S.rosterPad,
                        gap: S.gridGap,
                        gridTemplateColumns: `repeat(${capacity.cols}, minmax(0, 1fr))`,
                        gridAutoRows: `${S.cardH}px`,
                    }}
                >
                    {visibleRecords.map((record, index) => studentCard(record, index === 0))}

                    {hasOverflow && (
                        <button
                            type="button"
                            onClick={() => setIsRosterModalOpen(true)}
                            className="flex flex-col items-center justify-center border-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            style={{ borderRadius: S.cardR }}
                        >
                            <div className="flex items-baseline gap-1">
                                <span className="font-mono font-bold leading-none" style={{ fontSize: S.moreF }}>
                                    +{hiddenCount}
                                </span>
                                <span style={{ fontSize: S.metaF }}>{t("คน", "more")}</span>
                            </div>
                            <div style={{ fontSize: S.metaF }}>{t("ที่เช็กชื่อแล้ว", "already checked in")}</div>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div
            className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background"
            style={{ padding: S.pad, gap: S.gap }}
        >
            {/* หัวจอ */}
            <div
                className="flex shrink-0 items-center justify-between gap-4 bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                style={{ height: S.head, borderRadius: S.bigR, paddingLeft: S.headPad, paddingRight: S.headPad }}
            >
                <div className="flex min-w-0 items-center" style={{ gap: Math.round(S.headPad * 0.7) }}>
                    <div
                        className="shrink-0 bg-white"
                        style={{
                            width: S.logo,
                            height: S.logo,
                            borderRadius: Math.round(S.logo * 0.3),
                            padding: Math.round(S.logo * 0.12),
                        }}
                    >
                        <Image
                            src="/images/logo-cp.png"
                            alt={t("ตราสัญลักษณ์คณะ", "Faculty logo")}
                            width={96}
                            height={96}
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <div className="min-w-0">
                        <div className="flex min-w-0 items-baseline gap-2.5">
                            <span className="shrink-0 font-mono font-bold" style={{ fontSize: S.codeF }}>
                                {session.course?.code || "-"}
                            </span>
                            <span className="truncate font-semibold" style={{ fontSize: S.titleF }}>
                                {session.course?.name || session.title}
                            </span>
                        </div>
                        <div className="truncate text-white/85" style={{ fontSize: S.subF }}>
                            {headerSubtitle}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 items-center" style={{ gap: S.narrow ? 10 : 18 }}>
                    <div
                        className="flex items-center gap-2 rounded-full bg-white/20 font-medium"
                        style={{ fontSize: S.subF, padding: `${Math.round(S.subF / 2)}px ${S.narrow ? 12 : 18}px` }}
                    >
                        <span className="relative flex h-2.5 w-2.5">
                            {sessionOpen && (
                                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusChip.dot} opacity-75`} />
                            )}
                            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusChip.dot}`} />
                        </span>
                        {statusChip.label}
                    </div>
                    <div className="text-right">
                        <div className="text-white/85" style={{ fontSize: S.metaF }}>{countdownLabel}</div>
                        <div className="font-mono font-bold leading-tight tabular-nums" style={{ fontSize: S.clockF }}>
                            {countdownValue}
                        </div>
                    </div>
                    {session.status === "active" && (
                        <Button
                            isIconOnly={S.narrow}
                            variant="flat"
                            className="bg-white/20 text-white"
                            size={S.narrow ? "sm" : "md"}
                            isLoading={isClosing}
                            onPress={handleCloseSession}
                            aria-label={t("ปิดรับการเช็กชื่อ", "Close check-in")}
                            startContent={S.narrow ? undefined : <Icon icon="solar:close-circle-linear" className="text-lg" />}
                        >
                            {S.narrow ? <Icon icon="solar:close-circle-linear" className="text-lg" /> : t("ปิดรับการเช็กชื่อ", "Close check-in")}
                        </Button>
                    )}
                </div>
            </div>

            {S.narrow ? (
                <>
                    {/* จอแคบ วาง QR กับ PIN ไว้การ์ดเดียวกัน แล้วเรียงลงมา */}
                    <div
                        className="flex shrink-0 border border-default-200 bg-content1"
                        style={{ borderRadius: S.bigR, padding: S.panelPad, gap: S.panelGap }}
                    >
                        {qrBlock}
                        <div className="flex min-w-0 flex-1 flex-col justify-center" style={{ gap: S.panelGap - 2 }}>
                            {pinBlock}
                            <div className="truncate text-default-500" style={{ fontSize: S.metaF }}>
                                {t("สแกน QR Code หรือเปิด", "Scan the QR code, or open")}{" "}
                                <span className="font-mono font-semibold text-blue-700 dark:text-blue-300" style={{ fontSize: S.urlF }}>
                                    {checkInUrlLabel}
                                </span>
                            </div>
                        </div>
                    </div>
                    {statBlock}
                    {rosterBlock}
                </>
            ) : (
                <div className="flex min-h-0 flex-1" style={{ gap: S.gap }}>
                    {/* เสาซ้าย PIN และ QR */}
                    <div
                        className="flex shrink-0 flex-col border border-default-200 bg-content1"
                        style={{ width: S.panel, borderRadius: S.bigR, padding: S.panelPad, gap: S.panelGap }}
                    >
                        {pinBlock}
                        <div className="h-px bg-divider" />
                        <div className="flex min-h-0 flex-1 flex-col items-center justify-center" style={{ gap: S.panelGap }}>
                            {qrBlock}
                            <div className="text-center">
                                <div className="text-default-500" style={{ fontSize: S.metaF }}>
                                    {t("สแกน QR Code หรือเปิดลิงก์แล้วกรอกรหัส PIN", "Scan the QR code, or open the link and enter the PIN")}
                                </div>
                                <div className="font-mono font-semibold text-blue-700 dark:text-blue-300" style={{ fontSize: S.urlF }}>
                                    {checkInUrlLabel}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* เสาขวา สถิติและรายชื่อ */}
                    <div className="flex min-w-0 flex-1 flex-col" style={{ gap: S.gap - 2 }}>
                        {statBlock}
                        {rosterBlock}
                    </div>
                </div>
            )}

            {/* QR เต็มจอ */}
            <Modal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} size="full">
                <ModalContent className="bg-content1">
                    <ModalBody className="flex h-[100dvh] flex-col items-center justify-center gap-1 overflow-hidden py-6">
                        <h2 className="mb-2 text-3xl font-bold text-foreground">{session.title}</h2>
                        <p className="mb-6 text-default-500">{t("สแกน QR Code เพื่อเช็กชื่อเข้าเรียน", "Scan the QR code to check in")}</p>

                        <div className="rounded-3xl border-4 border-default-200 bg-white p-2 shadow-xl">
                            <QRCodeSVG value={checkInUrl} size={modalQrSize} level="L" fgColor="#000000" bgColor="#ffffff" marginSize={1} />
                        </div>

                        <div className="mt-6 text-center">
                            {session.pin_code ? (
                                <div className="inline-block rounded-2xl bg-slate-800 px-10 py-5 shadow-lg dark:bg-slate-700">
                                    <p
                                        className="font-mono font-bold tracking-[0.22em] leading-none text-white"
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
                            <p className="mt-3 text-xs text-default-400">
                                {isRotatingPinSession(session)
                                    ? t("PIN เปลี่ยนทุก 1 นาที", "PIN rotates every minute")
                                    : t("PIN คงที่ตลอดรอบนี้", "This PIN stays fixed for the whole session")}
                            </p>
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
        </div>
    );
}
