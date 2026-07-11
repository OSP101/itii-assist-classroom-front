"use client";

import { useEffect, useState, useCallback, useRef, ChangeEvent } from "react";
import { useParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Spinner } from "@heroui/spinner";
import { Switch } from "@heroui/switch";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { IoSchool } from "react-icons/io5";
import { getRealtimeSocketBaseUrl, io, Socket } from "@/services/realtime-socket";
import queueService from "@/services/queue.service";
import { playNotificationSound } from "@/lib/pwa-notifications";
import QRCode from "react-qr-code";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";

import { API_BASE_URL } from "@/config/api";
import { Divider } from "@heroui/divider";
import { Skeleton } from "@heroui/skeleton";
import { getAppHostLabel, getAppUrl } from "@/lib/app-url";
import { buildPageTitle } from "@/lib/page-title";

interface DeskBooking {
    id: number;
    queue_number: number;
    booking_type: 'grading' | 'help';
    status: string;
    student_name?: string;
    assigned_worker?: {
        id: number;
        full_name: string;
        avatar?: string;
    };
    // Populated in shared-room mode so the projector can display which course
    // a booking came from (e.g. "OOP-Q001" instead of just "Q001").
    course_code?: string;
    course_name?: string;
    session_id?: string;
}

interface DeskWithStatus {
    id: string;
    number: number;
    type: string;
    label?: string;
    x: number;
    y: number;
    is_enabled: boolean;
    status: {
        grading_status: "not_started" | "waiting" | "in_progress" | "completed";
        help_status: "none" | "waiting" | "in_progress";
    };
    booking?: DeskBooking;
}

interface ProjectorViewData {
    session: {
        id: string;
        course_id?: string;
        title: string;
        pin_code: string;
        status: string;
        is_cutoff_enabled?: boolean;
        cutoff_at?: string | null;
        cutoff_note?: string;
        concurrent_group_id?: string | null;
        group_pin_code?: string | null;
    };
    classroom: {
        id: string;
        name: string;
        building: string;
    };
    desks: DeskWithStatus[];
    queueStats: {
        grading_waiting: number;
        help_waiting: number;
    };
}

// Priority ordering for choosing which booking (across two linked sessions)
// wins on a shared desk. Higher rank displaces lower.
const DESK_BOOKING_PRIORITY: Record<string, number> = {
    in_progress: 4,
    waiting: 3,
    completed: 2,
};

function pickBetterBooking(a?: DeskBooking, b?: DeskBooking): DeskBooking | undefined {
    if (!a) return b;
    if (!b) return a;
    const ra = DESK_BOOKING_PRIORITY[a.status] ?? 0;
    const rb = DESK_BOOKING_PRIORITY[b.status] ?? 0;
    return rb > ra ? b : a;
}

interface GroupSessionProjectorView {
    session: {
        id: string;
        course_id?: string;
        title: string;
        pin_code: string;
        status: string;
        is_cutoff_enabled?: boolean;
        cutoff_at?: string | null;
        cutoff_note?: string;
        concurrent_group_id?: string | null;
        group_pin_code?: string | null;
    };
    course?: { id: string; code?: string; name?: string };
    desks: DeskWithStatus[];
    queueStats: { grading_waiting: number; help_waiting: number };
}

interface GroupProjectorPayload {
    group_id: string;
    group_pin_code?: string;
    classroom: { id: string; name: string; building: string };
    sessions: GroupSessionProjectorView[];
}

// mergeGroupProjectorView collapses a multi-session concurrent group into the
// existing single-session shape the projector already renders. All sessions
// in a group share the same classroom (constrained at link time), so we merge
// per-desk status/booking across sessions and sum queueStats. Bookings carry
// their originating session's course_code so the UI can prefix queue numbers.
function mergeGroupProjectorView(
    primary: ProjectorViewData,
    group: GroupProjectorPayload | undefined | null,
): ProjectorViewData {
    if (!group || !Array.isArray(group.sessions) || group.sessions.length === 0) {
        return primary;
    }

    const deskById = new Map<string, DeskWithStatus>();
    let combinedGrading = 0;
    let combinedHelp = 0;

    for (const sessionView of group.sessions) {
        const courseCode = sessionView.course?.code;
        const courseName = sessionView.course?.name;
        const sessionId = sessionView.session?.id;
        combinedGrading += sessionView.queueStats?.grading_waiting ?? 0;
        combinedHelp += sessionView.queueStats?.help_waiting ?? 0;

        for (const desk of sessionView.desks ?? []) {
            const taggedBooking: DeskBooking | undefined = desk.booking
                ? { ...desk.booking, course_code: courseCode, course_name: courseName, session_id: sessionId }
                : undefined;

            const existing = deskById.get(desk.id);
            if (!existing) {
                deskById.set(desk.id, { ...desk, booking: taggedBooking });
                continue;
            }

            // Merge: keep desk geometry as-is; pick the higher-priority booking
            // and combine status flags so any session's active state shows up.
            const mergedStatus = mergeDeskStatus(existing.status, desk.status);
            const mergedBooking = pickBetterBooking(existing.booking, taggedBooking);
            deskById.set(desk.id, {
                ...existing,
                status: mergedStatus,
                booking: mergedBooking,
            });
        }
    }

    return {
        ...primary,
        desks: Array.from(deskById.values()),
        queueStats: {
            grading_waiting: combinedGrading,
            help_waiting: combinedHelp,
        },
    };
}

function mergeDeskStatus(a: DeskWithStatus['status'], b: DeskWithStatus['status']): DeskWithStatus['status'] {
    const gradingRank: Record<string, number> = { not_started: 0, waiting: 2, completed: 1, in_progress: 3 };
    const helpRank: Record<string, number> = { none: 0, waiting: 2, in_progress: 3 };

    const grading = (gradingRank[b.grading_status] ?? 0) > (gradingRank[a.grading_status] ?? 0)
        ? b.grading_status
        : a.grading_status;
    const help = (helpRank[b.help_status] ?? 0) > (helpRank[a.help_status] ?? 0)
        ? b.help_status
        : a.help_status;

    return { grading_status: grading, help_status: help };
}

const PROJECTOR_HEARTBEAT_MS = 30_000;
const PAUSED_SESSION_LEASE_MINUTES = 2;
const QR_BOX_MIN_SIZE = 180;
const QR_BOX_MAX_SIZE = 420;
const QR_BOX_STEP = 20;
const QR_BOX_PADDING = 16;
const QR_DEFAULT_SIZE = 240;
const QR_SIZE_PRESETS = [
    { key: "S", size: 200 },
    { key: "M", size: 240 },
    { key: "L", size: 300 },
    { key: "XL", size: 360 },
] as const;

export default function ProjectorViewPage() {
    const params = useParams();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const sessionId = params.sessionId as string;
    const t = (thai: string, english: string) => (isEnglish ? english : thai);

    const [data, setData] = useState<ProjectorViewData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDataStale, setIsDataStale] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [sidebarPosition, setSidebarPosition] = useState<'right' | 'bottom'>('right');

    // Desk action modal states
    const [selectedDesk, setSelectedDesk] = useState<DeskWithStatus | null>(null);
    const [isDeskModalOpen, setIsDeskModalOpen] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
	const [isCutoffConfirmOpen, setIsCutoffConfirmOpen] = useState(false);

    // Close session confirmation
    const [isCloseSessionOpen, setIsCloseSessionOpen] = useState(false);
    const [isClosingSession, setIsClosingSession] = useState(false);
    const [isInitialWarningOpen, setIsInitialWarningOpen] = useState(false);
    const [initialWarningCountdown, setInitialWarningCountdown] = useState(5);

    // Status toggle states
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [isTogglingCutoff, setIsTogglingCutoff] = useState(false);

    // Real-time clock
    const [currentTime, setCurrentTime] = useState(new Date());
    const [qrBoxSize, setQrBoxSize] = useState(QR_DEFAULT_SIZE);
    const [isQrSettingsOpen, setIsQrSettingsOpen] = useState(false);
    const [concurrentSessions, setConcurrentSessions] = useState<Array<{
        id: string; title: string; course_id: string; course_name: string;
        status: string; pin_code: string;
    }>>([]); 
    const [groupPinCode, setGroupPinCode] = useState<string | null>(null);

    const socketRef = useRef<Socket | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hasShownInitialWarningRef = useRef(false);
    const hasLoadedDataRef = useRef(false);
    const selectedDeskHasActiveBooking = Boolean(
        selectedDesk?.booking &&
        (selectedDesk.status.grading_status === "waiting" ||
            selectedDesk.status.grading_status === "in_progress" ||
            selectedDesk.status.help_status !== "none")
    );
    const selectedDeskHasCompletedLock = Boolean(
        selectedDesk?.booking && selectedDesk.status.grading_status === "completed"
    );

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (data) {
            hasLoadedDataRef.current = true;
        }
    }, [data]);

    useEffect(() => {
        document.title = isEnglish
            ? "Queue Projector Display - LabTAS"
            : "หน้าจอแสดงผลคิว - LabTAS";
    }, [isEnglish]);

    useEffect(() => {
        const pageLabel = isEnglish ? "Queue Projector Display" : "หน้าจอแสดงผลคิว";
        document.title = buildPageTitle(pageLabel, data?.session?.title ?? null);
    }, [data?.session?.title, isEnglish]);

    // Fetch data
    const fetchData = useCallback(async () => {
        try {
            // Use public route without auth
            const response = await fetch(`${API_BASE_URL}/queue/sessions/${sessionId}/desk-statuses`);
            const result = await response.json();

            if (result.success) {
                const singleData = result.data as ProjectorViewData;

                // Shared-room mode: when the session belongs to a concurrent
                // group, fetch the group projector view and merge partner
                // sessions' bookings + queue counts onto the same desk layout.
                // Falls back to single-session data on any failure so the
                // projector still renders something usable.
                const groupId = singleData.session?.concurrent_group_id;
                if (groupId) {
                    try {
                        const groupResp = await fetch(`${API_BASE_URL}/queue/groups/${groupId}/desk-statuses`);
                        const groupResult = await groupResp.json();
                        if (groupResult.success) {
                            const merged = mergeGroupProjectorView(singleData, groupResult.data);
                            setData(merged);
                            setError(null);
                            setIsDataStale(false);
                            return;
                        }
                    } catch (groupErr) {
                        console.warn('Falling back to single-session projector view; group fetch failed:', groupErr);
                    }
                }

                setData(singleData);
                setError(null);
                setIsDataStale(false);
            } else {
                const nextError = isEnglish ? "Unable to load the data." : (result.error?.message || "ไม่สามารถโหลดข้อมูลได้");
                if (hasLoadedDataRef.current) {
                    setIsDataStale(true);
                    console.warn("Projector data fetch failed; keeping latest snapshot:", nextError);
                } else {
                    setError(nextError);
                }
            }
        } catch (err) {
            console.error("Error fetching data:", err);
            const nextError = isEnglish ? "A connection error occurred." : "เกิดข้อผิดพลาดในการเชื่อมต่อ";
            if (hasLoadedDataRef.current) {
                setIsDataStale(true);
            } else {
                setError(nextError);
            }
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, isEnglish]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            void fetchData();
        }, 15_000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [fetchData]);

    useEffect(() => {
        if (!data?.session || data.session.status === "closed" || hasShownInitialWarningRef.current) {
            return;
        }

        hasShownInitialWarningRef.current = true;
        setInitialWarningCountdown(5);
        setIsInitialWarningOpen(true);
    }, [data?.session]);

    useEffect(() => {
        if (!isInitialWarningOpen || initialWarningCountdown <= 0) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setInitialWarningCountdown((current) => Math.max(current - 1, 0));
        }, 1000);

        return () => window.clearTimeout(timeoutId);
    }, [initialWarningCountdown, isInitialWarningOpen]);

    useEffect(() => {
        if (!data?.session.course_id || data.session.status === "closed") {
            return;
        }

        let cancelled = false;

        const sendHeartbeat = async () => {
            try {
                await queueService.heartbeatProjectorSessionPublic(sessionId);
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to send projector heartbeat:", error);
                }
            }
        };

        void sendHeartbeat();
        const intervalId = window.setInterval(() => {
            void sendHeartbeat();
        }, PROJECTOR_HEARTBEAT_MS);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [data?.session.course_id, data?.session.status, sessionId]);

    useEffect(() => {
        if (!data?.session?.id) return;
        // Use group_pin_code from the session response directly (fastest path)
        if (data.session.group_pin_code) {
            setGroupPinCode(data.session.group_pin_code);
        }
        // Also fetch concurrent sessions to get partner course name
        queueService.getConcurrentSessionsPublic(String(data.session.id))
            .then(rows => {
                const others = rows.filter(r => String(r.id) !== String(data.session.id));
                setConcurrentSessions(others as typeof concurrentSessions);
                // Prefer data.session.group_pin_code, fall back to partner row
                if (!data.session.group_pin_code) {
                    const gp = rows.find(r => r.group_pin_code)?.group_pin_code;
                    setGroupPinCode(gp || null);
                }
            })
            .catch(() => {});
    }, [data?.session?.id, data?.session?.group_pin_code]);

    // Socket connection for real-time updates
    const groupIdForSocket = data?.session?.concurrent_group_id ?? null;
    useEffect(() => {
        const socket = io(getRealtimeSocketBaseUrl(), {
            reconnection: true,
            reconnectionAttempts: Number.POSITIVE_INFINITY,
            reconnectionDelay: 2000,
        });

        socket.on("connect", () => {
            setIsDataStale(false);
            socket.emit("join-queue", sessionId);
            // In shared-room mode, also subscribe to the concurrent-group room
            // so partner-session booking/status events refresh the projector.
            if (groupIdForSocket) {
                socket.emit("join-queue-group", groupIdForSocket);
            }
            fetchData();
        });

        socket.on("disconnect", () => {
            setIsDataStale(true);
        });

        socket.on("connect_error", () => {
            setIsDataStale(true);
        });

        // Listen for booking updates
        socket.on("new-booking", () => {
            playNotificationSound();
            fetchData();
        });

        socket.on("booking-assigned", () => {
            fetchData();
        });

        socket.on("booking-completed", () => {
            fetchData();
        });

        socket.on("booking-skipped", () => {
            fetchData();
        });

        socket.on("booking-cancelled", () => {
            fetchData();
        });

        socket.on("session-status-changed", (eventData: { status: string }) => {
            if (eventData.status === "closed") {
                addToast({
                    title: t("Session ปิดแล้ว", "Session closed"),
                    description: t("การจองคิวถูกปิด", "Queue booking has been closed."),
                    color: "warning",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
            fetchData();
        });

        socket.on("session-cutoff-changed", () => {
            fetchData();
        });

        socket.on("session-unlinked", (eventData: { reason?: string }) => {
            if (eventData?.reason === "course_closed") {
                addToast({
                    title: t("ยกเลิกการเชื่อมคิวอัตโนมัติ", "Queue link auto-removed"),
                    description: t("มีวิชาในกลุ่มถูกปิด ระบบจึงถอดการเชื่อมคิวร่วมออก", "A partner course was closed, so the shared queue link has been removed."),
                    color: "warning",
                    timeout: 5000,
                    shouldShowTimeoutProgress: true,
                });
            }
            fetchData();
        });

        socket.on("pin-changed", () => {
            fetchData();
        });

        socketRef.current = socket;

        return () => {
            socket.emit("leave-queue", sessionId);
            if (groupIdForSocket) {
                socket.emit("leave-queue-group", groupIdForSocket);
            }
            socket.disconnect();
        };
    }, [sessionId, fetchData, isEnglish, groupIdForSocket]);

    // Fullscreen toggle
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Toggle queue session status (pause/resume)
    const handleToggleStatus = async () => {
        if (!data) return;

        const newStatus = data.session.status === 'active' ? 'paused' : 'active';
        setIsTogglingStatus(true);

        try {
            // Use public projector-status endpoint (no auth required)
            const response = await fetch(`${API_BASE_URL}/queue/sessions/${sessionId}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });

            const result = await response.json();

            if (result.success) {
                addToast({
                    title: newStatus === 'paused'
                        ? t("หยุดรับคิวแล้ว", "Queue paused")
                        : t("เปิดรับคิวแล้ว", "Queue resumed"),
                    description: newStatus === 'paused'
                        ? t("นักศึกษาจะไม่สามารถจองคิวใหม่ได้", "Students cannot create new bookings right now.")
                        : t("นักศึกษาสามารถจองคิวได้อีกครั้ง", "Students can create bookings again."),
                    color: newStatus === 'paused' ? "warning" : "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                fetchData();
            } else {
                addToast({
                    title: t("เกิดข้อผิดพลาด", "Error"),
                    description: isEnglish ? "Unable to change the queue status." : (result.error?.message || "ไม่สามารถเปลี่ยนสถานะได้"),
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            console.error("Error toggling status:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถเปลี่ยนสถานะได้", "Unable to change the queue status."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsTogglingStatus(false);
        }
    };

    const handleToggleCutoff = async () => {
        if (!data || isClosed) return;

        const nextEnabled = !Boolean(data.session.is_cutoff_enabled);
        setIsTogglingCutoff(true);

        try {
            const response = await fetch(`${API_BASE_URL}/queue/sessions/${sessionId}/cutoff`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_cutoff_enabled: nextEnabled }),
            });

            const result = await response.json();
            if (result.success) {
                addToast({
                    title: nextEnabled ? t("เปิด Cutoff แล้ว", "Cutoff enabled") : t("ปิด Cutoff แล้ว", "Cutoff disabled"),
                    description: nextEnabled
                        ? t("การจองใหม่จากนี้จะถูกติดป้าย Late Booking", "All new bookings will now be marked as Late Booking.")
                        : t("การจองใหม่จะไม่ถูกติดป้าย Late Booking", "New bookings will no longer be marked as Late Booking."),
                    color: nextEnabled ? "warning" : "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                fetchData();
            } else {
                addToast({
                    title: t("เกิดข้อผิดพลาด", "Error"),
                    description: isEnglish ? "Unable to change the cutoff status." : (result.error?.message || "ไม่สามารถเปลี่ยนสถานะ Cutoff ได้"),
                    color: "danger",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            console.error("Error toggling cutoff:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถเปลี่ยนสถานะ Cutoff ได้", "Unable to change the cutoff status."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsTogglingCutoff(false);
        }
    };

    const handleCloseSession = async () => {
        if (!data?.session.course_id) return;
        setIsClosingSession(true);
        try {
            await queueService.closeQueueSession(data.session.course_id, sessionId);
            addToast({
                title: t("ปิดเซสชันสำเร็จ", "Session closed"),
                description: t("นักศึกษาจะไม่สามารถจองคิวได้อีก", "Students can no longer create bookings."),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            setIsCloseSessionOpen(false);
            fetchData();
        } catch (err: unknown) {
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: err instanceof Error ? err.message : t("ไม่สามารถปิดเซสชันได้", "Unable to close session"),
                color: "danger",
                timeout: 4000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsClosingSession(false);
        }
    };

    // Handle desk click
    const handleDeskClick = (desk: DeskWithStatus) => {
        // Open the modal for active bookings and completed grading locks.
        if (desk.booking && (desk.status.grading_status === 'waiting' || desk.status.grading_status === 'in_progress' || desk.status.help_status !== 'none' || desk.status.grading_status === 'completed')) {
            setSelectedDesk(desk);
            setIsDeskModalOpen(true);
        }
    };

    // Cancel desk booking
    const handleCancelDeskBooking = async () => {
        if (!selectedDesk || !selectedDesk.booking) return;

        setIsCancelling(true);
        try {
            const response = await fetch(`${API_BASE_URL}/queue/bookings/${selectedDesk.booking.id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            const result = await response.json();

            if (result.success) {
                addToast({
                    title: t("ยกเลิกการจองสำเร็จ", "Booking cancelled"),
                    description: isEnglish
                        ? `Desk ${selectedDesk.number} has been cleared.`
                        : `โต๊ะ ${selectedDesk.number} ถูกล้างแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsDeskModalOpen(false);
                setSelectedDesk(null);
                fetchData();
            } else {
                addToast({
                    title: t("ยกเลิกไม่สำเร็จ", "Cancellation failed"),
                    description: isEnglish ? "Unable to cancel the booking." : (result.error?.message || "เกิดข้อผิดพลาด"),
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            console.error("Error cancelling booking:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถยกเลิกการจองได้", "Unable to cancel the booking."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsCancelling(false);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase();
            if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) {
                return;
            }

            if (e.key === "+") {
                setZoom((prev) => Math.min(prev + 0.05, 2));
            } else if (e.key === "-") {
                setZoom((prev) => Math.max(prev - 0.05, 0.3));
            } else if (e.key === "0") {
                setZoom(1);
            } else if (e.key === "f") {
                toggleFullscreen();
            } else if (e.key === "l") {
                setSidebarPosition((prev) => prev === 'right' ? 'bottom' : 'right');
            } else if (e.key === "[") {
                setQrBoxSize((prev) => Math.max(QR_BOX_MIN_SIZE, prev - QR_BOX_STEP));
            } else if (e.key === "]") {
                setQrBoxSize((prev) => Math.min(QR_BOX_MAX_SIZE, prev + QR_BOX_STEP));
            } else if (e.key === "\\") {
                setQrBoxSize(QR_DEFAULT_SIZE);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Get desk color based on status
    const getDeskColor = (desk: DeskWithStatus) => {
        // Priority: help_status > grading_status
        if (desk.status.help_status === "in_progress") {
            return "bg-amber-500 animate-pulse"; // กำลังช่วยเหลือ
        }
        if (desk.status.help_status === "waiting") {
            return "bg-amber-300"; // รอช่วยเหลือ
        }
        if (desk.status.grading_status === "in_progress") {
            return "bg-blue-500 animate-pulse"; // กำลังตรวจ
        }
        if (desk.status.grading_status === "waiting") {
            return "bg-blue-300"; // รอตรวจ
        }
        if (desk.status.grading_status === "completed") {
            return "bg-emerald-500"; // ตรวจเสร็จแล้ว
        }
        return "bg-content3"; // ยังไม่ได้ทำอะไร
    };

    // Get desk border based on type
    const getDeskBorder = (desk: DeskWithStatus) => {
        if (desk.type === "teacher") {
            return "border-4 border-purple-400";
        }
        if (desk.type === "computer") {
            return "border-2 border-cyan-400";
        }
        return "border border-default-400";
    };

    // Get booking URL for QR code — prefer group PIN when both courses share one QR
    const getBookingUrl = () => {
        const pin = groupPinCode || data?.session.pin_code || "";
        return getAppUrl(`/queue/book?pin=${encodeURIComponent(pin)}`);
    };

    const clampQrSize = useCallback(
        (size: number) => Math.max(QR_BOX_MIN_SIZE, Math.min(size, QR_BOX_MAX_SIZE)),
        []
    );

    const handleQrSizeSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
        setQrBoxSize(clampQrSize(Number(event.target.value)));
    };

    const handleDecreaseQrSize = () => {
        setQrBoxSize((prev) => clampQrSize(prev - QR_BOX_STEP));
    };

    const handleIncreaseQrSize = () => {
        setQrBoxSize((prev) => clampQrSize(prev + QR_BOX_STEP));
    };

    const handleResetQrSize = () => {
        setQrBoxSize(QR_DEFAULT_SIZE);
    };

    const handleSetQrPreset = (size: number) => {
        setQrBoxSize(clampQrSize(size));
    };

    const renderQrSizeControls = () => (
        <div className="w-full">
            <Button
                size="sm"
                variant="flat"
                className="w-full justify-between border border-default-200 bg-content2"
                onPress={() => setIsQrSettingsOpen((prev) => !prev)}
                endContent={
                    <Icon
                        icon={isQrSettingsOpen ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
                        className="text-base"
                    />
                }
                startContent={<Icon icon="solar:settings-bold" className="text-base" />}
            >
                {isQrSettingsOpen ? t("ซ่อนการตั้งค่า QR", "Hide QR settings") : t("ตั้งค่า QR", "QR settings")}
            </Button>

            {isQrSettingsOpen && (
                <div className="mt-2 w-full min-w-65 rounded-xl border border-default-200 bg-content2 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-default-600">
                        <span>{t("ขนาด QR", "QR size")}</span>
                        <span className="font-semibold text-default-700">{qrBoxSize}px</span>
                    </div>
                    <input
                        type="range"
                        min={QR_BOX_MIN_SIZE}
                        max={QR_BOX_MAX_SIZE}
                        step={QR_BOX_STEP}
                        value={qrBoxSize}
                        onChange={handleQrSizeSliderChange}
                        className="h-2 w-full cursor-pointer accent-primary"
                        aria-label={t("ปรับขนาด QR", "Adjust QR size")}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            variant="flat"
                            onPress={handleDecreaseQrSize}
                            isDisabled={qrBoxSize <= QR_BOX_MIN_SIZE}
                            startContent={<Icon icon="solar:minus-circle-bold" className="text-base" />}
                        >
                            {t("ย่อ", "Smaller")}
                        </Button>
                        <Button
                            size="sm"
                            variant="flat"
                            onPress={handleIncreaseQrSize}
                            isDisabled={qrBoxSize >= QR_BOX_MAX_SIZE}
                            startContent={<Icon icon="solar:add-circle-bold" className="text-base" />}
                        >
                            {t("ขยาย", "Larger")}
                        </Button>
                        <Button
                            size="sm"
                            variant="light"
                            onPress={handleResetQrSize}
                            className="ml-auto"
                        >
                            {t("รีเซ็ต", "Reset")}
                        </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        {QR_SIZE_PRESETS.map((preset) => (
                            <Button
                                key={preset.key}
                                size="sm"
                                variant={qrBoxSize === preset.size ? "solid" : "flat"}
                                color={qrBoxSize === preset.size ? "primary" : "default"}
                                onPress={() => handleSetQrPreset(preset.size)}
                                className="min-w-10"
                            >
                                {preset.key}
                            </Button>
                        ))}
                        <span className="ml-auto text-[11px] text-default-500">
                            {t("คีย์ลัด: [ ย่อ, ] ขยาย, \\ รีเซ็ต", "Shortcuts: [ smaller, ] larger, \\ reset")}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );

    const qrCodeSize = Math.max(QR_BOX_MIN_SIZE - QR_BOX_PADDING * 2, qrBoxSize - QR_BOX_PADDING * 2);

    const formatQueueStatusLabel = (status: string) => {
        switch (status) {
            case "active":
                return t("เปิดรับคิว", "Open for queue");
            case "paused":
                return t("หยุดรับคิว", "Queue paused");
            case "closed":
                return t("ปิดแล้ว", "Closed");
            default:
                return status;
        }
    };

    const formatBookingTypeLabel = (bookingType: DeskBooking["booking_type"]) => {
        return bookingType === "grading"
            ? t("ตรวจงาน", "Grading")
            : t("ขอความช่วยเหลือ", "Help request");
    };

    const formatBookingStatus = (status: string) => {
        switch (status) {
            case "waiting":
                return t("รอคิว", "Waiting");
            case "in_progress":
                return t("กำลังดำเนินการ", "In progress");
            case "completed":
                return t("เสร็จสิ้น", "Completed");
            case "cancelled":
                return t("ยกเลิกแล้ว", "Cancelled");
            case "no_show":
                return t("ถูกข้าม", "Skipped");
            default:
                return status;
        }
    };

    const formatClock = (date: Date) =>
        date.toLocaleTimeString(isEnglish ? "en-US" : "th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col gap-4 bg-background p-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="w-72 h-8 rounded-lg" />
                        <Skeleton className="w-56 h-5 rounded-lg" />
                    </div>
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-28 h-9 rounded-full" />
                        <Skeleton className="w-32 h-9 rounded-full" />
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 flex-1 min-h-0">
                    <div className="rounded-xl border border-default-200 bg-content1 p-4 shadow-sm">
                        <Skeleton className="w-full h-[62vh] rounded-lg" />
                    </div>
                    <div className="space-y-3 rounded-xl border border-default-200 bg-content1 p-4 shadow-sm">
                        <Skeleton className="w-40 h-6 rounded-lg" />
                        <Skeleton className="w-full h-48 rounded-lg" />
                        <Divider />
                        <Skeleton className="w-full h-10 rounded-lg" />
                        <Skeleton className="w-full h-10 rounded-lg" />
                        <Skeleton className="w-full h-10 rounded-lg" />
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="text-center">
                    <Icon icon="solar:danger-triangle-bold" className="text-6xl text-red-400 mb-4" />
                    <h2 className="mb-2 text-xl font-bold text-foreground">{t("เกิดข้อผิดพลาด", "Error")}</h2>
                    <p className="mb-4 text-default-500">{error || t("ไม่สามารถโหลดข้อมูลได้", "Unable to load the data.")}</p>
                    <Button color="primary" onPress={() => fetchData()}>
                        {t("ลองใหม่", "Try again")}
                    </Button>
                </div>
            </div>
        );
    }

    // Calculate canvas dimensions based on desk positions
    const desks = data.desks.filter(d => d.is_enabled);
    const maxX = Math.max(...desks.map(d => d.x || 0), 100);
    const maxY = Math.max(...desks.map(d => d.y || 0), 100);
    const canvasWidth = maxX + 100; // Add padding
    const canvasHeight = maxY + 100;

    // Check if queue is paused or closed
    const isPaused = data.session.status === "paused";
    const isClosed = data.session.status === "closed";
    const isCutoffEnabled = Boolean(data.session.is_cutoff_enabled);
    const nextCutoffEnabled = !isCutoffEnabled;
    return (
        <div ref={containerRef} className="flex min-h-screen flex-col bg-background p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{data.session.title}</h1>
                        {groupPinCode && concurrentSessions.length > 0 ? (
                            <p className="text-sm font-medium text-secondary-600 dark:text-secondary-400 mt-0.5">
                                <Icon icon="solar:link-bold" className="inline text-xs mr-1" />
                                {t("คิวร่วม", "Shared queue")} · {concurrentSessions[0].course_name}
                            </p>
                        ) : null}
                        <p className="text-default-500">
                            {data.classroom.name} • {data.classroom.building}
                        </p>
                    </div>
                    {/* Status indicator */}
                    {isPaused && (
                        <Chip
                            size="lg"
                            color="warning"
                            variant="flat"
                            startContent={<Icon icon="solar:pause-circle-bold" />}
                        >
                            {t("หยุดรับคิว", "Queue paused")}
                        </Chip>
                    )}
                    {isClosed && (
                        <Chip
                            size="lg"
                            color="danger"
                            variant="flat"
                            startContent={<Icon icon="solar:stop-circle-bold" />}
                        >
                            {t("ปิดแล้ว", "Closed")}
                        </Chip>
                    )}
                    {isCutoffEnabled && (
                        <Chip
                            size="lg"
                            color="warning"
                            variant="flat"
                            startContent={<Icon icon="solar:danger-triangle-bold" />}
                        >
                            {t("Cutoff เปิดอยู่", "Cutoff enabled")}
                        </Chip>
                    )}
                    {isDataStale && (
                        <Chip
                            size="lg"
                            color="warning"
                            variant="flat"
                            startContent={<Icon icon="solar:wifi-router-minimalistic-bold" />}
                        >
                            {t("เครือข่ายไม่เสถียร แสดงข้อมูลล่าสุดที่มี", "Connection unstable, showing latest available data")}
                        </Chip>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* Queue Stats */}
                    <div className="flex gap-3">
                        <Chip
                            size="lg"
                            color="primary"
                            variant="flat"
                            classNames={{
                                base: "bg-blue-100 border border-blue-300",
                                content: "text-blue-700 font-bold",
                            }}
                            startContent={<Icon icon="solar:clipboard-check-bold" />}
                        >
                            <p>{isEnglish ? `Waiting for grading: ${data.queueStats.grading_waiting}` : `รอตรวจ: ${data.queueStats.grading_waiting}`}</p>
                        </Chip>
                        <Chip
                            size="lg"
                            color="warning"
                            variant="flat"
                            classNames={{
                                base: "bg-amber-100 border border-amber-300",
                                content: "text-amber-700 font-bold",
                            }}
                            startContent={<Icon icon="solar:hand-shake-bold" />}
                        >
                            {isEnglish ? `Waiting for help: ${data.queueStats.help_waiting}` : `รอช่วยเหลือ: ${data.queueStats.help_waiting}`}
                        </Chip>
                    </div>



                    {/* Zoom Controls */}
                    <div className="flex items-center gap-2 rounded-xl border border-default-200 bg-content1 px-3 py-2 shadow-sm">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            className="bg-content2 text-2xl text-default-700"
                            onPress={() => setZoom((prev) => Math.max(prev - 0.05, 0.3))}
                        >
                            {/* <Icon icon="solar:minus-bold" /> */} -
                        </Button>
                        <span className="w-12 text-center text-sm text-default-700">{Math.round(zoom * 100)}%</span>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            className="bg-content2 text-2xl text-default-700"
                            onPress={() => setZoom((prev) => Math.min(prev + 0.05, 2))}
                        >
                            {/* <Icon icon="solar:add-bold" /> */} +
                        </Button>
                    </div>



                    {/* Toggle Queue Status */}
                    <div className="flex items-center gap-2 rounded-xl border border-default-200 bg-content1 px-4 py-2 shadow-sm">
                        <Switch
                            isSelected={!isPaused && !isClosed}
                            onValueChange={handleToggleStatus}
                            isDisabled={isTogglingStatus || isClosed}
                            size="lg"
                            color="success"
                            thumbIcon={({ isSelected }) =>
                                isSelected ? (
                                    <Icon icon="solar:play-bold" className="text-xs" />
                                ) : (
                                    <Icon icon="solar:pause-bold" className="text-xs" />
                                )
                            }
                        />
                        <span className={`text-sm font-medium ${isClosed ? 'text-rose-600' : isPaused ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {formatQueueStatusLabel(isClosed ? 'closed' : isPaused ? 'paused' : 'active')}
                        </span>
                    </div>

                    {/* Cutoff Toggle */}
                    <Button
                        size="lg"
                        variant="flat"
                        className={`border shadow-sm ${isCutoffEnabled
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : 'bg-content1 border-default-200 text-default-700'}`}
                        isLoading={isTogglingCutoff}
                        isDisabled={isClosed || isTogglingCutoff}
                        onPress={() => setIsCutoffConfirmOpen(true)}
                        startContent={<Icon icon={isCutoffEnabled ? "solar:lock-bold" : "solar:lock-unlocked-bold"} className="text-lg" />}
                    >
                        {isCutoffEnabled ? t('ปิด Cutoff', 'Disable cutoff') : t('เปิด Cutoff', 'Enable cutoff')}
                    </Button>

                    {/* Layout Toggle */}
                    <Button
                        isIconOnly
                        size="lg"
                        variant="flat"
                        className="border border-default-200 bg-content1 text-default-700 shadow-sm"
                        onPress={() => setSidebarPosition((prev) => prev === 'right' ? 'bottom' : 'right')}
                        title={sidebarPosition === 'right'
                            ? t('ย้ายแถบข้อมูลไปด้านล่าง', 'Move info panel to the bottom')
                            : t('ย้ายแถบข้อมูลไปด้านขวา', 'Move info panel to the right')}
                    >
                        <Icon icon={sidebarPosition === 'right' ? "solar:align-bottom-bold" : "solar:align-right-bold"} className="text-xl" />
                    </Button>

                    {/* Close Session */}
                    {!isClosed && (
                        <Button
                            isIconOnly
                            size="lg"
                            variant="flat"
                            color="danger"
                            className="border border-danger-200 shadow-sm"
                            onPress={() => setIsCloseSessionOpen(true)}
                            title={t("ปิดเซสชันคิว", "Close queue session")}
                        >
                            <Icon icon="solar:stop-circle-bold" className="text-xl" />
                        </Button>
                    )}

                    {/* Fullscreen */}
                    <Button
                        isIconOnly
                        size="lg"
                        variant="flat"
                        className="border border-default-200 bg-content1 text-default-700 shadow-sm"
                        onPress={toggleFullscreen}
                    >
                        <Icon icon={isFullscreen ? "solar:quit-full-screen-bold" : "solar:full-screen-bold"} className="text-xl" />
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 flex gap-4 ${sidebarPosition === 'bottom' ? 'flex-col' : 'flex-row'}`}>
                {/* Room Layout */}
                <div className="flex-1 overflow-auto rounded-2xl border border-default-200 bg-content1 p-4 shadow-sm">
                    <div
                        className="relative"
                        style={{
                            transform: `scale(${zoom})`,
                            transformOrigin: "top left",
                            width: canvasWidth,
                            height: canvasHeight,
                            minWidth: canvasWidth,
                            minHeight: canvasHeight,
                        }}
                    >
                        {/* Desks with absolute positioning */}
                        {desks.map((desk) => {
                            const isTeacher = desk.type === "teacher";
                            const hasActiveBooking = desk.booking && (desk.status.grading_status === 'waiting' || desk.status.grading_status === 'in_progress' || desk.status.help_status !== 'none');
                            const hasCompletedLock = desk.booking && desk.status.grading_status === 'completed';
                            const isInspectable = Boolean(hasActiveBooking || hasCompletedLock);
                            return (
                                <div
                                    key={desk.id}
                                    className={`
                                        absolute flex items-center justify-center rounded-lg
                                        ${getDeskColor(desk)} ${getDeskBorder(desk)}
                                        transition-all duration-300 
                                        ${isInspectable ? 'cursor-pointer hover:ring-2 hover:ring-red-400 hover:ring-offset-2' : 'cursor-default'}
                                    `}
                                    style={{
                                        left: desk.x,
                                        top: desk.y,
                                        width: isTeacher ? 120 : 60,
                                        height: isTeacher ? 50 : 60,
                                    }}
                                    title={isTeacher
                                        ? (isEnglish ? `Teacher desk ${desk.number}` : `โต๊ะอาจารย์ ${desk.number}`)
                                        : `${isEnglish ? 'Desk' : 'โต๊ะ'} ${desk.number}${desk.label ? ` (${desk.label})` : ""}${hasActiveBooking ? (isEnglish ? ' - click to manage' : ' - คลิกเพื่อจัดการ') : hasCompletedLock ? (isEnglish ? ' - click to inspect lock' : ' - คลิกเพื่อดูการล็อกโต๊ะ') : ''}`}
                                    onClick={() => handleDeskClick(desk)}
                                >
                                    <span className={`font-bold ${isTeacher ? "text-sm text-foreground" : "text-lg"} ${desk.status.grading_status === "not_started" && desk.status.help_status === "none" ? "text-default-700" : "text-white"}`}>
                                        {isTeacher ? `${t('อาจารย์', 'Teacher')} ${desk.number}` : desk.number}
                                    </span>

                                    {/* Status indicators */}
                                    <div className="absolute -top-1 -right-1 flex gap-0.5">
                                        {desk.status.grading_status === "completed" && (
                                            <div className="w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center">
                                                <Icon icon="solar:check-bold" className="text-white text-xs" />
                                            </div>
                                        )}
                                        {desk.status.help_status !== "none" && (
                                            <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                                                <Icon icon="solar:hand-shake-bold" className="text-white text-xs" />
                                            </div>
                                        )}
                                    </div>

                                    {desk.booking?.status === "in_progress" && desk.booking.assigned_worker && (
                                        <div
                                            className="absolute -right-3 -top-3 z-20"
                                            title={desk.booking.assigned_worker.full_name}
                                        >
                                            <Avatar
                                                src={desk.booking.assigned_worker.avatar || undefined}
                                                name={desk.booking.assigned_worker.full_name}
                                                className="h-8 w-8 border-2 border-white bg-fuchsia-500 text-[11px] font-bold text-white shadow-md"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar - QR Code & Legend */}
                {sidebarPosition === 'bottom' ? (
                    /* ── Bottom layout: compact single-row strip ── */
                    <div className="flex items-center gap-6 rounded-2xl border border-default-200 bg-content1 px-5 py-5 shadow-sm">
                        {/* QR / Status section */}
                        {isClosed ? (
                            <div className="flex items-center gap-3 text-rose-600 shrink-0">
                                <Icon icon="solar:stop-circle-bold" className="text-3xl" />
                                <div>
                                    <p className="font-bold text-sm">{t('ปิดแล้ว', 'Closed')}</p>
                                    <p className="text-xs text-rose-500">{t('การจองคิวถูกปิดแล้ว', 'Queue booking has been closed.')}</p>
                                </div>
                            </div>
                        ) : isPaused ? (
                            <div className="flex items-center gap-3 text-amber-600 shrink-0">
                                <Icon icon="solar:pause-circle-bold" className="text-3xl" />
                                <div>
                                    <p className="font-bold text-sm">{t('หยุดรับคิว', 'Queue paused')}</p>
                                    <p className="text-xs text-amber-500">{t('ไม่รับการจองคิวใหม่ชั่วคราว', 'New bookings are temporarily paused.')}</p>
                                </div>
                            </div>
                        ) : groupPinCode ? (
                            /* ── Single shared QR (bottom layout, grouped) ── */
                            <div className="flex items-center gap-4 shrink-0">
                                <div className="flex flex-col items-center gap-2">
                                    <div
                                        className="overflow-hidden rounded-2xl border-2 border-secondary-300 bg-white shadow-sm"
                                        style={{
                                            width: qrBoxSize,
                                            height: qrBoxSize,
                                            minWidth: QR_BOX_MIN_SIZE,
                                            minHeight: QR_BOX_MIN_SIZE,
                                            maxWidth: QR_BOX_MAX_SIZE,
                                            maxHeight: QR_BOX_MAX_SIZE,
                                        }}
                                    >
                                        <div
                                            className="flex h-full w-full items-center justify-center"
                                            style={{ padding: QR_BOX_PADDING }}
                                        >
                                            <QRCode value={getBookingUrl()} size={qrCodeSize} bgColor="#ffffff" fgColor="#000000" level="L" />
                                        </div>
                                    </div>
                                    {renderQrSizeControls()}
                                </div>
                                <div className="bg-secondary-100 dark:bg-secondary-900/40 rounded-xl px-4 py-2">
                                    <div className="flex items-center gap-1 mb-1">
                                        <Icon icon="solar:link-bold" className="text-secondary-500 text-xs" />
                                        <span className="text-xs font-bold text-secondary-600 dark:text-secondary-400">{t("คิวร่วมสองวิชา", "Shared Queue")}</span>
                                    </div>
                                    {concurrentSessions.length > 0 && (
                                        <p className="text-xs text-default-500 mb-1">{concurrentSessions[0].course_name}</p>
                                    )}
                                    <span className="text-sm text-default-600">Group PIN</span>
                                    <p className="text-4xl font-mono font-bold text-secondary-700 dark:text-secondary-300 text-center">{groupPinCode}</p>
                                    <Divider className="my-2" />
                                    <p className="font-mono text-foreground text-sm">{`${getAppHostLabel()}/queue/book`}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4 shrink-0">
                                <div className="flex flex-col items-center gap-2">
                                    <div
                                        className="overflow-hidden rounded-2xl border border-default-200 bg-white shadow-sm"
                                        style={{
                                            width: qrBoxSize,
                                            height: qrBoxSize,
                                            minWidth: QR_BOX_MIN_SIZE,
                                            minHeight: QR_BOX_MIN_SIZE,
                                            maxWidth: QR_BOX_MAX_SIZE,
                                            maxHeight: QR_BOX_MAX_SIZE,
                                        }}
                                    >
                                        <div
                                            className="flex h-full w-full items-center justify-center"
                                            style={{ padding: QR_BOX_PADDING }}
                                        >
                                            <QRCode value={getBookingUrl()} size={qrCodeSize} bgColor="#ffffff" fgColor="#000000" level="L" />
                                        </div>
                                    </div>
                                    {renderQrSizeControls()}
                                </div>
                                <div className="bg-blue-100 dark:bg-blue-900/40 rounded-xl px-4 py-2">
                                    <span className="text-sm text-default-600">PIN Code</span>
                                    <p className="text-4xl font-mono font-bold text-blue-700 dark:text-blue-300 text-center">{data.session.pin_code}</p>
                                    <Divider className="my-3" />
                                    <p className="font-mono text-foreground">{`${getAppHostLabel()}/queue/book`}</p>
                                </div>
                            </div>
                        )}

                        {/* Divider */}
                        <div className="h-12 w-px shrink-0 bg-divider" />

                        {/* Legend - compact inline */}
                        <div className="flex items-center gap-4 flex-wrap flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <div className="h-8 w-8 shrink-0 rounded border border-default-300 bg-content3" />
                                <span className="text-md whitespace-nowrap text-default-500">{t('ยังไม่ได้ตรวจ', 'Not started')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-blue-300 border border-blue-400 shrink-0" />
                                <span className="text-md whitespace-nowrap text-default-500">{t('รอตรวจ', 'Waiting for grading')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-blue-500 animate-pulse border border-blue-600 shrink-0" />
                                <span className="text-md whitespace-nowrap text-default-500">{t('กำลังตรวจ', 'Grading in progress')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-emerald-500 border border-emerald-600 shrink-0" />
                                <span className="text-md whitespace-nowrap text-default-500">{t('ตรวจเสร็จ', 'Completed')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-amber-300 border border-amber-400 shrink-0" />
                                <span className="text-md whitespace-nowrap text-default-500">{t('รอช่วยเหลือ', 'Waiting for help')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-amber-500 animate-pulse border border-amber-600 shrink-0" />
                                <span className="text-md whitespace-nowrap text-default-500">{t('กำลังช่วยเหลือ', 'Helping in progress')}</span>
                            </div>

                            {/* Desk types inline */}
                            <div className="h-12 w-px shrink-0 bg-divider" />
                            <div className="flex items-center gap-1.5">
                                <div className="h-8 w-8 shrink-0 rounded border-2 border-cyan-400 bg-content3" />
                                <span className="text-md whitespace-nowrap text-default-500">{t('คอมฯ', 'Computer')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-8 w-8 shrink-0 rounded border-[3px] border-purple-400 bg-content3" />
                                <span className="text-md whitespace-nowrap text-default-500">{t('โต๊ะอาจารย์', 'Teacher desk')}</span>
                            </div>

                            <div className="h-12 w-px shrink-0 bg-divider" />

                            <div className="flex max-w-full items-center justify-center gap-2 rounded-xl border border-default-200 bg-content1 px-4 py-2 shadow-sm">
                                {/* <Icon icon="solar:clock-circle-bold" className="text-slate-400 text-lg" /> */}
                                <span className="font-mono text-2xl font-semibold text-default-700 tabular-nums">
                                    {formatClock(currentTime)}
                                </span>
                            </div>
                        </div>

                    </div>
                ) : (
                    /* ── Right sidebar layout (original) ── */
                    <div
                        className="flex shrink-0 flex-col gap-4"
                        style={{ width: isClosed || isPaused ? 288 : Math.max(288, qrBoxSize + 56) }}
                    >
                        {/* QR Code - Hide when paused or closed */}
                        {isClosed ? (
                            <div className="bg-rose-50 rounded-2xl p-6 text-center border-2 border-rose-200">
                                <Icon icon="solar:stop-circle-bold" className="text-6xl text-rose-500 mb-3" />
                                <h3 className="text-lg font-bold text-rose-700 mb-1">{t('ปิดแล้ว', 'Closed')}</h3>
                                <p className="text-sm text-rose-600">
                                    {t('การจองคิวถูกปิดแล้ว', 'Queue booking has been closed.')}
                                </p>
                            </div>
                        ) : isPaused ? (
                            <div className="bg-amber-50 rounded-2xl p-6 text-center border-2 border-amber-200 justify-center">
                                <Icon icon="solar:pause-circle-bold" className="text-6xl text-amber-500 mb-3 text-center w-full" />
                                <h3 className="text-lg font-bold text-amber-700 mb-1">{t('หยุดรับคิว', 'Queue paused')}</h3>
                                <p className="text-sm text-amber-600">
                                    {t('ไม่รับการจองคิวใหม่ชั่วคราว', 'New bookings are temporarily paused.')}
                                </p>
                            </div>
                        ) : groupPinCode ? (
                            /* ── Single shared QR when sessions are grouped ── */
                            <div className="rounded-2xl border-2 border-secondary-400 bg-content1 p-5 text-center shadow-md">
                                <div className="flex items-center justify-center gap-1.5 mb-3">
                                    <Icon icon="solar:link-bold" className="text-secondary-500 text-base" />
                                    <span className="text-xs font-bold text-secondary-600 dark:text-secondary-400 uppercase tracking-wide">
                                        {t("คิวร่วมสองวิชา", "Shared Queue")}
                                    </span>
                                </div>
                                {concurrentSessions.length > 0 && (
                                    <p className="text-xs text-default-500 mb-3 leading-relaxed">
                                        {data.session.title.split(' ').slice(0, 3).join(' ')}
                                        {" + "}
                                        {concurrentSessions[0].course_name}
                                    </p>
                                )}
                                <div className="mb-3 flex justify-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div
                                            className="overflow-hidden rounded-2xl border-2 border-secondary-200 bg-white shadow-sm"
                                            style={{
                                                width: qrBoxSize,
                                                height: qrBoxSize,
                                                minWidth: QR_BOX_MIN_SIZE,
                                                minHeight: QR_BOX_MIN_SIZE,
                                                maxWidth: QR_BOX_MAX_SIZE,
                                                maxHeight: QR_BOX_MAX_SIZE,
                                            }}
                                        >
                                            <div
                                                className="flex h-full w-full items-center justify-center"
                                                style={{ padding: QR_BOX_PADDING }}
                                            >
                                                <QRCode
                                                    value={getBookingUrl()}
                                                    size={qrCodeSize}
                                                    bgColor="#ffffff" fgColor="#000000" level="L"
                                                />
                                            </div>
                                        </div>
                                        {renderQrSizeControls()}
                                    </div>
                                </div>
                                <div className="bg-secondary-100 dark:bg-secondary-900/40 rounded-xl px-4 py-3">
                                    <span className="text-xs text-secondary-600 dark:text-secondary-400">{t("Group PIN", "Group PIN")}</span>
                                    <p className="text-4xl font-mono font-bold text-secondary-700 dark:text-secondary-300">{groupPinCode}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-default-200 bg-content1 p-6 text-center shadow-sm">
                                <div className="mb-3 flex justify-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div
                                            className="overflow-hidden rounded-2xl border border-default-200 bg-white shadow-sm"
                                            style={{
                                                width: qrBoxSize,
                                                height: qrBoxSize,
                                                minWidth: QR_BOX_MIN_SIZE,
                                                minHeight: QR_BOX_MIN_SIZE,
                                                maxWidth: QR_BOX_MAX_SIZE,
                                                maxHeight: QR_BOX_MAX_SIZE,
                                            }}
                                        >
                                            <div
                                                className="flex h-full w-full items-center justify-center"
                                                style={{ padding: QR_BOX_PADDING }}
                                            >
                                                <QRCode
                                                    value={getBookingUrl()}
                                                    size={qrCodeSize}
                                                    bgColor="#ffffff" fgColor="#000000" level="L"
                                                />
                                            </div>
                                        </div>
                                        {renderQrSizeControls()}
                                    </div>
                                </div>
                                <div className="bg-blue-100 dark:bg-blue-900/40 rounded-xl px-4 py-2">
                                    <span className="text-sm text-default-600">PIN Code</span>
                                    <p className="text-4xl font-mono font-bold text-blue-700 dark:text-blue-300">{data.session.pin_code}</p>
                                </div>
                            </div>
                        )}

                        {/* Partner session cards removed — single group QR shown above when linked */}

                        {/* Legend */}
                        <div className="rounded-2xl border border-default-200 bg-content1 p-4 shadow-sm">
                            <h3 className="mb-3 font-semibold text-foreground">{t('สัญลักษณ์', 'Legend')}</h3>
                            <div className="space-y-2 grid grid-cols-2">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded border border-default-300 bg-content3" />
                                    <span className="text-sm text-default-600">{t('ยังไม่ได้ตรวจ', 'Not started')}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-emerald-500 border border-emerald-600" />
                                    <span className="text-sm text-default-600">{t('ตรวจเสร็จแล้ว', 'Completed')}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-blue-300 border border-blue-400" />
                                    <span className="text-sm text-default-600">{t('รอตรวจงาน', 'Waiting for grading')}</span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-amber-300 border border-amber-400" />
                                    <span className="text-sm text-default-600">{t('รอช่วยเหลือ', 'Waiting for help')}</span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-blue-500 animate-pulse border border-blue-600" />
                                    <span className="text-sm text-default-600">{t('กำลังตรวจ', 'Grading in progress')}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-amber-500 animate-pulse border border-amber-600" />
                                    <span className="text-sm text-default-600">{t('กำลังช่วยเหลือ', 'Helping in progress')}</span>
                                </div>
                            </div>

                            {/* Desk types */}
                            <div className="mt-4 border-t border-divider pt-4">
                                <h4 className="mb-2 text-sm text-default-500">{t('ประเภทโต๊ะ', 'Desk types')}</h4>
                                <div className="space-y-2 grid grid-cols-2">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded border-2 border-cyan-400 bg-content3" />
                                        <span className="text-sm text-default-600">{t('คอมพิวเตอร์', 'Computer')}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded border-4 border-purple-400 bg-content3" />
                                        <span className="text-sm text-default-600">{t('โต๊ะอาจารย์', 'Teacher desk')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Clock */}
                        <div className="flex items-center justify-center gap-2 rounded-xl border border-default-200 bg-content1 px-4 py-2 shadow-sm">
                            {/* <Icon icon="solar:clock-circle-bold" className="text-slate-400 text-lg" /> */}
                            <span className="font-mono text-2xl font-semibold text-default-700 tabular-nums">
                                {formatClock(currentTime)}
                            </span>
                        </div>
                        {/* Keyboard shortcuts */}
                        {/* <div className="bg-slate-800 rounded-2xl p-4">
                        <h3 className="text-white font-semibold mb-2">ทางลัด</h3>
                        <div className="text-xs text-slate-400 space-y-1">
                            <p><kbd className="px-1 bg-slate-700 rounded">+</kbd> ซูมเข้า</p>
                            <p><kbd className="px-1 bg-slate-700 rounded">-</kbd> ซูมออก</p>
                            <p><kbd className="px-1 bg-slate-700 rounded">0</kbd> รีเซ็ตซูม</p>
                            <p><kbd className="px-1 bg-slate-700 rounded">F</kbd> เต็มจอ</p>
                        </div>
                    </div> */}
                    </div>
                )}
            </div>

            {/* Desk Action Modal */}
            <Modal isOpen={isDeskModalOpen} onClose={() => setIsDeskModalOpen(false)}>
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2">
                        <div className="p-2 bg-linear-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
                            <Icon icon="solar:square-bold" className="text-xl text-white" />
                        </div>
                        <span>{isEnglish ? `Desk ${selectedDesk?.number}` : `โต๊ะ ${selectedDesk?.number}`}</span>
                    </ModalHeader>
                    <ModalBody>
                        {selectedDesk?.booking && (
                            <div className="space-y-4">
                                <div className="rounded-xl bg-content2 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-default-600">{t('คิวที่', 'Queue number')}</span>
                                        <span className="text-2xl font-bold text-blue-600">
                                            {selectedDesk.booking.course_code
                                                ? `${selectedDesk.booking.course_code}-Q${selectedDesk.booking.queue_number}`
                                                : selectedDesk.booking.queue_number}
                                        </span>
                                    </div>
                                    {selectedDesk.booking.course_code && selectedDesk.booking.course_name && (
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-default-600">{t('รายวิชา', 'Course')}</span>
                                            <Chip size="sm" color="secondary" variant="flat" startContent={<Icon icon="solar:link-bold" className="text-xs" />}>
                                                {selectedDesk.booking.course_code} · {selectedDesk.booking.course_name}
                                            </Chip>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-default-600">{t('ประเภท', 'Type')}</span>
                                        <Chip
                                            size="sm"
                                            color={selectedDesk.booking.booking_type === 'grading' ? 'primary' : 'warning'}
                                            variant="flat"
                                        >
                                            {formatBookingTypeLabel(selectedDesk.booking.booking_type)}
                                        </Chip>
                                    </div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-default-600">{t('สถานะ', 'Status')}</span>
                                        <span className="font-medium text-foreground">{formatBookingStatus(selectedDesk.booking.status)}</span>
                                    </div>
                                    {selectedDesk.booking.assigned_worker && (
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-default-600">{t('ผู้ตรวจ', 'Checker')}</span>
                                            <span className="font-medium text-foreground">{selectedDesk.booking.assigned_worker.full_name}</span>
                                        </div>
                                    )}
                                    {selectedDesk.booking.student_name && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-default-600">{t('นักศึกษา', 'Student')}</span>
                                            <span className="text-foreground">{selectedDesk.booking.student_name}</span>
                                        </div>
                                    )}
                                </div>

                                {selectedDeskHasActiveBooking ? (
                                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                        <div className="flex items-start gap-2">
                                            <Icon icon="solar:danger-triangle-bold" className="text-amber-600 text-lg mt-0.5" />
                                            <div className="text-sm text-amber-700">
                                                <p className="font-medium">{t('ยกเลิกการจองนี้?', 'Cancel this booking?')}</p>
                                                <p className="mt-1">{t('ใช้เมื่อมีปัญหาหรือข้อผิดพลาดเท่านั้น โต๊ะจะว่างและนักศึกษาสามารถจองใหม่ได้', 'Use this only when there is a problem or mistake. The desk will become available and the student can book again.')}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : selectedDeskHasCompletedLock ? (
                                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                                        <div className="flex items-start gap-2">
                                            <Icon icon="solar:lock-bold" className="text-emerald-600 text-lg mt-0.5" />
                                            <div className="text-sm text-emerald-700">
                                                <p className="font-medium">{t('โต๊ะนี้ถูกล็อกแล้ว', 'This desk is locked')}</p>
                                                <p className="mt-1">{t('โต๊ะนี้มีผลตรวจสำเร็จแล้ว จึงถูกผูกไว้กับนักศึกษาคนเดิมและไม่ควรเปิดให้คนอื่นจองต่อ', 'A grading result has already been completed on this desk, so it stays linked to the same student and should not be reopened for someone else.')}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setIsDeskModalOpen(false)}>
                            {t('ปิด', 'Close')}
                        </Button>
                        {selectedDeskHasActiveBooking && (
                            <Button
                                color="primary"
                                onPress={handleCancelDeskBooking}
                                isLoading={isCancelling}
                                className="bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                            >
                                {t('ยกเลิกการจอง', 'Cancel booking')}
                            </Button>
                        )}
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Close Session Confirmation Modal */}
            <Modal isOpen={isCloseSessionOpen} onClose={() => setIsCloseSessionOpen(false)} size="sm">
                <ModalContent>
                    <ModalHeader className="text-danger">
                        {t("ปิดเซสชันคิว", "Close Queue Session")}
                    </ModalHeader>
                    <ModalBody>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 rounded-lg bg-warning-50 border border-warning-200 p-3">
                                <Icon icon="solar:danger-triangle-bold" className="text-warning-600 text-xl shrink-0 mt-0.5" />
                                <p className="text-sm text-warning-700">
                                    {t(
                                        "กรุณาปิดเซสชันก่อนปิดหน้าต่างนี้ เพื่อให้นักศึกษาทราบว่าการจองคิวสิ้นสุดแล้ว",
                                        "Please close the session before closing this window so students know queue booking has ended."
                                    )}
                                </p>
                            </div>
                            <p className="text-sm text-default-600">
                                {t(
                                    "เมื่อปิดแล้ว นักศึกษาจะไม่สามารถจองคิวใหม่ได้ และเซสชันจะสิ้นสุด",
                                    "Once closed, students cannot create new bookings and the session will end."
                                )}
                            </p>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={() => setIsCloseSessionOpen(false)} isDisabled={isClosingSession}>
                            {t("ยกเลิก", "Cancel")}
                        </Button>
                        <Button color="danger" onPress={handleCloseSession} isLoading={isClosingSession}>
                            {t("ปิดเซสชัน", "Close Session")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={isInitialWarningOpen} hideCloseButton isDismissable={false} size="md">
                <ModalContent>
                    <ModalHeader className="text-warning-700">
                        {t("โปรดอ่านก่อนใช้งาน", "Please read before using")}
                    </ModalHeader>
                    <ModalBody>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 p-3">
                                <Icon icon="solar:danger-triangle-bold" className="mt-0.5 shrink-0 text-xl text-warning-600" />
                                <div className="space-y-2 text-sm text-warning-800">
                                    <p className="font-semibold">
                                        {isPaused
                                            ? t(
                                                `ตอนนี้คิวอยู่ในโหมดหยุดรับคิวชั่วคราว ถ้าหน้า projector หายไปและไม่มีสัญญาณกลับมานานเกิน ${PAUSED_SESSION_LEASE_MINUTES} นาที ระบบจะปิดเซสชันนี้อัตโนมัติ`,
                                                `The queue is currently paused. If the projector page disappears and does not come back for more than ${PAUSED_SESSION_LEASE_MINUTES} minutes, this session will be closed automatically.`
                                            )
                                            : t(
                                                "หากหน้าเว็บค้าง คุณสามารถรีเฟรชหรือเปิดหน้านี้กลับมาใหม่ได้ตามปกติ ระบบจะไม่ปิดเซสชันอัตโนมัติขณะยัง active อยู่",
                                                "If the page freezes, you can refresh or reopen this page normally. The system will not auto-close the session while it is still active."
                                            )}
                                    </p>
                                    <p>
                                        {t(
                                            "เมื่อเลิกใช้งานห้องจริง ให้กดปิดเซสชันคิวทุกครั้ง เพื่อไม่ให้ห้องค้างจนคนอื่นเปิดใช้ต่อไม่ได้",
                                            "When you are truly done using the room, close the queue session so the next team can use the room without getting blocked."
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="warning"
                            onPress={() => setIsInitialWarningOpen(false)}
                            isDisabled={initialWarningCountdown > 0}
                        >
                            {initialWarningCountdown > 0
                                ? t(`ตกลง (${initialWarningCountdown})`, `OK (${initialWarningCountdown})`)
                                : t("ตกลง", "OK")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={isCutoffConfirmOpen} onClose={() => setIsCutoffConfirmOpen(false)}>
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2">
                        <div className="p-2 bg-linear-to-br from-rose-400 to-pink-500 rounded-lg shadow-lg shadow-rose-500/30">
                            <Icon icon="solar:danger-triangle-bold" className="text-xl text-white" />
                        </div>
                        <span>{nextCutoffEnabled ? t("ยืนยันเปิด Cutoff", "Confirm cutoff enable") : t("ยืนยันปิด Cutoff", "Confirm cutoff disable")}</span>
                    </ModalHeader>
                    <ModalBody>
                        <div className="space-y-3 text-sm text-default-700">
                            <p>
                                {nextCutoffEnabled
                                    ? t("หลังจากนี้การจองใหม่ทั้งหมดจะถูกติดป้ายว่า Late Booking", "All new bookings from now on will be marked as Late Booking.")
                                    : t("หลังจากนี้การจองใหม่จะไม่ถูกติดป้าย Late Booking", "New bookings from now on will not be marked as Late Booking.")}
                            </p>
                            {nextCutoffEnabled && (
                                <p className="text-rose-600">
                                    {t("แจ้งนักศึกษาให้เรียบร้อยก่อนกดยืนยันเพื่อป้องกันความสับสน", "Inform students before confirming to avoid confusion.")}
                                </p>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setIsCutoffConfirmOpen(false)}>
                            {t('ยกเลิก', 'Cancel')}
                        </Button>
                        <Button
                            color="primary"
                            onPress={async () => {
                                setIsCutoffConfirmOpen(false);
                                await handleToggleCutoff();
                            }}
                            isLoading={isTogglingCutoff}
                            className="bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {nextCutoffEnabled ? t("ยืนยันเปิด Cutoff", "Enable cutoff") : t("ยืนยันปิด Cutoff", "Disable cutoff")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
