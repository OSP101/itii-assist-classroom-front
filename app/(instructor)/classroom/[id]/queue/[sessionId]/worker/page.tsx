"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
import { Spinner } from "@heroui/spinner";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { getRealtimeSocketBaseUrl, io, Socket } from "@/services/realtime-socket";
import { courseService } from "@/services/course.service";
import queueService, {
    getQueueBookingStatusLabel,
    type QueueSession,
    type QueueWorker,
    type QueueBooking,
} from "@/services/queue.service";
import { authService } from "@/services/auth.service";
import scoreService from "@/services/score.service";
import { useNotification } from "@/contexts/NotificationContext";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { API_BASE_URL } from "@/config/api";
import { buildCourseTitleContext, buildPageTitle } from "@/lib/page-title";
import { formatScoreValue, parseScoreInput, SCORE_INPUT_PATTERN, sanitizeScoreInput } from "@/lib/score-input";


interface MiniDeskInfo {
    id: number;
    number: string;
    position_x: number;
    position_y: number;
    is_enabled: boolean;
    type?: string; // 'computer' | 'normal' | 'teacher'
}

function getDirectionGuide(
    prev: { x: number; y: number },
    curr: { x: number; y: number }
): { label: string; icon: string; distance: "ใกล้" | "ปานกลาง" | "ไกล" } {
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y; // y increases downward on canvas
    const dist = Math.sqrt(dx * dx + dy * dy);

    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const deg = (angle + 360) % 360;

    let label: string;
    let icon: string;
    if (deg >= 337.5 || deg < 22.5)       { label = "ขวา";       icon = "solar:arrow-right-bold"; }
    else if (deg < 67.5)                  { label = "ขวา-ล่าง";  icon = "solar:arrow-right-down-bold"; }
    else if (deg < 112.5)                 { label = "ล่าง";       icon = "solar:arrow-down-bold"; }
    else if (deg < 157.5)                 { label = "ซ้าย-ล่าง"; icon = "solar:arrow-left-down-bold"; }
    else if (deg < 202.5)                 { label = "ซ้าย";       icon = "solar:arrow-left-bold"; }
    else if (deg < 247.5)                 { label = "ซ้าย-บน";   icon = "solar:arrow-left-up-bold"; }
    else if (deg < 292.5)                 { label = "บน";         icon = "solar:arrow-up-bold"; }
    else                                  { label = "ขวา-บน";    icon = "solar:arrow-right-up-bold"; }

    const distance: "ใกล้" | "ปานกลาง" | "ไกล" =
        dist < 80 ? "ใกล้" : dist < 200 ? "ปานกลาง" : "ไกล";

    return { label, icon, distance };
}

function MiniRoomMap({
    desks,
    currentDeskNumber,
    previousDeskNumber,
}: {
    desks: MiniDeskInfo[];
    currentDeskNumber: string | null;
    previousDeskNumber: string | null;
}) {
    const enabled = desks.filter(
        (d) =>
            (d.is_enabled || d.type === "teacher") &&
            d.position_x !== undefined &&
            d.position_y !== undefined
    );
    if (enabled.length === 0) return null;

    const xs = enabled.map((d) => d.position_x);
    const ys = enabled.map((d) => d.position_y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const rawW = Math.max(...xs) - minX;
    const rawH = Math.max(...ys) - minY;

    const W = 300;
    const H = 180;
    const PAD = 18;
    const scale = Math.min(
        rawW > 0 ? (W - PAD * 2) / rawW : 1,
        rawH > 0 ? (H - PAD * 2) / rawH : 1
    );
    const R = 7;

    const cx = (desk: MiniDeskInfo) => PAD + (desk.position_x - minX) * scale;
    const cy = (desk: MiniDeskInfo) => PAD + (desk.position_y - minY) * scale;

    const currentDesk  = enabled.find((d) => String(d.number) === String(currentDeskNumber ?? ""))  ?? null;
    const previousDesk = enabled.find((d) => String(d.number) === String(previousDeskNumber ?? "")) ?? null;

    // Orthogonal (L-shaped) marching-ants path: previous → current
    let arrowEl: React.ReactNode = null;
    if (previousDesk && currentDesk && previousDesk.number !== currentDesk.number) {
        const x1 = cx(previousDesk), y1 = cy(previousDesk);
        const x2 = cx(currentDesk),  y2 = cy(currentDesk);
        const dx = x2 - x1, dy = y2 - y1;
        const RS = R + 3; // gap from desk edge

        // Start point – gap in horizontal direction from origin
        const sx = x1 + (dx > 0 ? RS : dx < 0 ? -RS : 0);

        let d: string;
        if (Math.abs(dy) < R * 2) {
            // Same row → pure horizontal
            const ex = x2 + (dx > 0 ? -RS : RS);
            d = `M ${sx},${y1} H ${ex}`;
        } else {
            // L-shape: horizontal first to x2, then vertical to y2
            const ey = y2 + (dy > 0 ? -RS : RS);
            d = `M ${sx},${y1} H ${x2} V ${ey}`;
        }

        arrowEl = (
            <path
                d={d}
                stroke="#6366F1"
                strokeWidth={2}
                fill="none"
                strokeDasharray="6 4"
                strokeLinecap="round"
                markerEnd="url(#miniArrow)"
                style={{ animation: "miniDash 0.45s linear infinite" }}
            />
        );
    }

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ maxHeight: 180 }}
        >
            <defs>
                <style>{`@keyframes miniDash{to{stroke-dashoffset:-10;}}`}</style>
                <marker id="miniArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#6366F1" />
                </marker>
            </defs>
            {enabled.map((desk) => {
                const isCurrent  = String(desk.number) === String(currentDeskNumber ?? "");
                const isPrevious = String(desk.number) === String(previousDeskNumber ?? "");
                const x = cx(desk);
                const y = cy(desk);

                // Teacher desk → wide green pill as a room reference landmark
                if (desk.type === "teacher") {
                    const rw = 26, rh = 10;
                    return (
                        <g key={`desk-teacher-${desk.number}-${desk.position_x}-${desk.position_y}`}>
                            <rect
                                x={x - rw / 2} y={y - rh / 2}
                                width={rw} height={rh} rx={3}
                                fill="#059669"
                            />
                        </g>
                    );
                }

                // Regular / computer desk — no stroke border
                let fill = "#CBD5E1"; // slate-300
                if (isCurrent)       fill = "#FBBF24"; // amber
                else if (isPrevious) fill = "#93C5FD"; // light-blue
                return (
                    <g key={`desk-${desk.number}-${desk.position_x}-${desk.position_y}`}>
                        {isCurrent && (
                            <circle cx={x} cy={y} r={R + 5} fill="#FDE68A" opacity={0.5}>
                                <animate
                                    attributeName="r"
                                    values={`${R + 4};${R + 9};${R + 4}`}
                                    dur="1.5s"
                                    repeatCount="indefinite"
                                />
                                <animate
                                    attributeName="opacity"
                                    values="0.5;0.1;0.5"
                                    dur="1.5s"
                                    repeatCount="indefinite"
                                />
                            </circle>
                        )}
                        <circle cx={x} cy={y} r={R} fill={fill} />
                    </g>
                );
            })}
            {arrowEl}
        </svg>
    );
}

function getWorkerLocale(isEnglish = false): "th-TH" | "en-US" {
    return isEnglish ? "en-US" : "th-TH";
}

function formatCutoffDateTime(value?: string | null, isEnglish = false): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString(getWorkerLocale(isEnglish), {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDeskLabel(deskNumber: string | number | null | undefined, isEnglish = false): string {
    if (deskNumber === null || deskNumber === undefined || deskNumber === "") return "-";
    return `${isEnglish ? "Desk" : "โต๊ะ"} ${deskNumber}`;
}

function formatBookingTypeLabel(bookingType: QueueBooking["booking_type"], isEnglish = false): string {
    return bookingType === "grading"
        ? (isEnglish ? "Grading" : "ตรวจงาน")
        : (isEnglish ? "Help" : "ช่วยเหลือ");
}

function formatDirectionLabel(label: string, isEnglish = false): string {
    if (!isEnglish) return label;

    switch (label) {
        case "ขวา":
            return "right";
        case "ขวา-ล่าง":
            return "down-right";
        case "ล่าง":
            return "down";
        case "ซ้าย-ล่าง":
            return "down-left";
        case "ซ้าย":
            return "left";
        case "ซ้าย-บน":
            return "up-left";
        case "บน":
            return "up";
        case "ขวา-บน":
            return "up-right";
        default:
            return label;
    }
}

function formatDistanceLabel(distance: "ใกล้" | "ปานกลาง" | "ไกล", isEnglish = false): string {
    if (!isEnglish) return distance;

    switch (distance) {
        case "ใกล้":
            return "near";
        case "ปานกลาง":
            return "medium";
        case "ไกล":
            return "far";
        default:
            return distance;
    }
}

function formatBookingStatusLabel(status: string, isEnglish = false): string {
    switch (status) {
        case "waiting":
            return getQueueBookingStatusLabel("waiting", isEnglish);
        case "assigned":
            return isEnglish ? "Assigned" : "มอบหมายแล้ว";
        case "in_progress":
            return getQueueBookingStatusLabel("in_progress", isEnglish);
        case "completed":
            return getQueueBookingStatusLabel("completed", isEnglish);
        case "cancelled":
            return getQueueBookingStatusLabel("cancelled", isEnglish);
        case "skipped":
            return isEnglish ? "Skipped" : "ข้ามแล้ว";
        default:
            return status;
    }
}

// ============================================================
// Main Component
// ============================================================

export default function WorkerDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const courseId = params.id as string;
    const sessionId = params.sessionId as string;
    const t = useCallback((thai: string, english: string) => (isEnglish ? english : thai), [isEnglish]);
    const rejectReasonOptions = [
        { key: "busy_with_student", label: t("ติดช่วยนักศึกษาคนอื่น", "Busy helping another student") },
        { key: "consulting_instructor", label: t("กำลังคุยกับอาจารย์", "Consulting instructor") },
        { key: "bathroom_break", label: t("ติดภารกิจส่วนตัวชั่วคราว", "Temporary personal break") },
        { key: "technical_issue", label: t("มีปัญหาทางเทคนิค", "Technical issue") },
        { key: "temporary_unavailable", label: t("ไม่สะดวกรับงานชั่วคราว", "Temporarily unavailable") },
        { key: "other", label: t("เหตุผลอื่น", "Other") },
    ];

    const [session, setSession] = useState<QueueSession | null>(null);
    const [courseContext, setCourseContext] = useState<string | null>(null);
    const [isCourseActive, setIsCourseActive] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<{ id: number; full_name: string } | null>(null);

    const showCourseClosedReadOnlyToast = useCallback(() => {
        addToast({
            title: t("รายวิชาถูกปิดแล้ว", "Course is closed"),
            description: t("วิชาที่ปิดแล้วดูข้อมูลได้อย่างเดียว ไม่สามารถจัดการคิวได้", "Closed courses are read-only. Queue actions are disabled."),
            color: "warning",
            timeout: 3000,
            shouldShowTimeoutProgress: true,
        });
    }, [t]);

    // Worker states
    const [isWorkerOnline, setIsWorkerOnline] = useState(false);
    const [workerPreferences, setWorkerPreferences] = useState({
        accept_grading: true,
        accept_help: true,
    });
    const [currentBooking, setCurrentBooking] = useState<QueueBooking | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [isPausedAfterComplete, setIsPausedAfterComplete] = useState(false); // Stop receiving after completing current

    // Complete booking modal
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
    const [isPreparingCompleteForm, setIsPreparingCompleteForm] = useState(false);
    const [completeForm, setCompleteForm] = useState<{
        score: string;
        score_comment: string;
        worker_note: string;
        sub_item_scores: { sub_item_id: number; score: string }[];
    }>({
        score: "",
        score_comment: "",
        worker_note: "",
        sub_item_scores: [],
    });
    const [isCompleting, setIsCompleting] = useState(false);
    const [existingSubItemScores, setExistingSubItemScores] = useState<{
        sub_item_id: number;
        score: number | null;
        graded_by?: { id: number; display_name: string };
        graded_at?: string | null;
    }[]>([]);
    const [isLoadingScores, setIsLoadingScores] = useState(false);

    // Skip booking modal
    const [isSkipModalOpen, setIsSkipModalOpen] = useState(false);
    const [skipReason, setSkipReason] = useState("");
    const [isSkipping, setIsSkipping] = useState(false);

    // Offer (waiting acceptance) states
    const [offerSecondsLeft, setOfferSecondsLeft] = useState<number | null>(null);
    const [isAcceptingOffer, setIsAcceptingOffer] = useState(false);
    const [isRejectOfferModalOpen, setIsRejectOfferModalOpen] = useState(false);
    const [rejectOfferReason, setRejectOfferReason] = useState("busy_with_student");
    const [isRejectingOffer, setIsRejectingOffer] = useState(false);

    // Mini room map
    const [deskLayout, setDeskLayout] = useState<MiniDeskInfo[]>([]);
    const [previousDeskNumber, setPreviousDeskNumber] = useState<string | null>(null);

    // Socket
    const socketRef = useRef<Socket | null>(null);
    const hasWarnedAboutConnectError = useRef(false);

    // Notification (FCM)
    const { 
        isSupported: notificationSupported, 
        permissionStatus, 
        requestPermission, 
        registerFcmToken,
        fcmToken,
    } = useNotification();

    useEffect(() => {
        document.title = isEnglish
            ? "Queue Worker - LabTAS"
            : "หน้ารับงาน - LabTAS";
    }, [isEnglish]);

    useEffect(() => {
        const pageLabel = isEnglish ? "Queue Worker" : "หน้ารับงาน";
        document.title = buildPageTitle(pageLabel, courseContext);
    }, [courseContext, isEnglish]);

    // Get current user
    useEffect(() => {
        const user = authService.getStoredUser();
        if (user) {
            setCurrentUser({ id: user.id, full_name: user.full_name });
        }
    }, []);

    // Fetch desk layout for mini map
    useEffect(() => {
        const loadDeskLayout = async () => {
            try {
                // Use same public endpoint as projector page – guaranteed to return x/y
                const response = await fetch(
                    `${API_BASE_URL}/queue/sessions/${sessionId}/desk-statuses`
                );
                const result = await response.json();
                if (result.success && result.data?.desks) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const desks = result.data.desks as any[];
                    setDeskLayout(
                        desks
                            .filter(
                                (d) =>
                                    // Always include teacher desks as spatial landmarks
                                    (d.is_enabled || d.type === 'teacher') &&
                                    d.x !== undefined &&
                                    d.y !== undefined
                            )
                            .map((d) => ({
                                id: Number(d.id),
                                number: String(d.number),
                                position_x: d.x as number,
                                position_y: d.y as number,
                                is_enabled: d.is_enabled as boolean,
                                type: d.type as string | undefined,
                            }))
                    );
                }
            } catch (err) {
                // Non-critical – mini map simply won't show
                console.warn("Could not load desk layout for mini map:", err);
            }
        };
        loadDeskLayout();
    }, [sessionId]);

    // Fetch session details and check for existing booking
    const fetchSession = useCallback(async () => {
        setIsLoading(true);
        try {
            const [data, courseResponse] = await Promise.all([
                queueService.getQueueSession(courseId, sessionId),
                courseService.getCourseById(courseId),
            ]);
            setSession(data);
            setIsCourseActive(Boolean(courseResponse.success && courseResponse.data?.is_active));
            if (courseResponse.success && courseResponse.data) {
                setCourseContext(buildCourseTitleContext(courseResponse.data));
            }

            // Always check for existing booking assigned to current user (even if offline)
            // This handles reconnection after page refresh
            try {
                const result = await queueService.getWorkerCurrentBooking(courseId, sessionId);
                
                const { worker, currentBooking } = result;
                
                if (currentBooking) {
                    // Has pending booking - restore state
                    setCurrentBooking(currentBooking);
                    setIsWorkerOnline(true);
                    
                    if (worker) {
                        setWorkerPreferences({
                            accept_grading: worker.accept_grading,
                            accept_help: worker.accept_help,
                        });
                    }
                    
                    addToast({
                        title: t("พบงานที่ค้างอยู่", "Pending task restored"),
                        description: `${formatDeskLabel(currentBooking.desk_number, isEnglish)} - ${formatBookingTypeLabel(currentBooking.booking_type, isEnglish)}`,
                        color: "primary",
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });
                } else if (currentUser && data.workers) {
                    // No pending booking - check if user is a worker
                    const myWorker = data.workers.find((w) => w.user_id === currentUser.id);
                    if (myWorker && myWorker.status !== "offline") {
                        setIsWorkerOnline(true);
                        setWorkerPreferences({
                            accept_grading: myWorker.accept_grading,
                            accept_help: myWorker.accept_help,
                        });
                    }
                }
            } catch (err) {
                console.error("Error fetching current booking:", err);
            }
        } catch (error) {
            console.error("Error fetching session:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถโหลดข้อมูล Session ได้", "Unable to load the queue session."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, [courseId, sessionId, currentUser, isEnglish, t]);

    useEffect(() => {
        if (currentUser) {
            fetchSession();
        }
    }, [fetchSession, currentUser]);

    // Prevent page refresh/close when worker is online or has current booking
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isWorkerOnline || currentBooking) {
                e.preventDefault();
                // Chrome requires returnValue to be set
                e.returnValue = isEnglish
                    ? "You are currently receiving tasks. Do you want to leave this page?"
                    : "คุณกำลังรับงานอยู่ ต้องการออกจากหน้านี้หรือไม่?";
                return e.returnValue;
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [isWorkerOnline, currentBooking, isEnglish]);

    // Polling interval ref
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // Poll for current booking (fallback if socket fails)
    // Use ref to track if we should skip polling (to avoid stale closure issues)
    const skipPollingRef = useRef(false);
    // Ref to track paused state (to avoid stale closure issues)
    const isPausedRef = useRef(false);
    
    // Keep ref in sync with state
    useEffect(() => {
        isPausedRef.current = isPausedAfterComplete;
    }, [isPausedAfterComplete]);
    
    const pollForBooking = useCallback(async (force: boolean = false) => {
        // Skip if not online, already have booking, or paused (unless forced)
        if (!isWorkerOnline) return;
        if (isPausedRef.current) return; // Don't poll for new tasks when paused
        if (!force && (currentBooking || skipPollingRef.current)) return;
        
        try {
            const result = await queueService.getWorkerCurrentBooking(courseId, sessionId);
            if (result.currentBooking) {
                // Double check - don't accept if paused
                if (isPausedRef.current) {
                    return;
                }
                
                setCurrentBooking(result.currentBooking);
                skipPollingRef.current = true;
                addToast({
                    title: t("มีงานใหม่!", "New task assigned"),
                    description: result.currentBooking.status === "waiting"
                        ? t("กรุณากดรับงานภายใน 20 วินาที", "Please accept this task within 20 seconds.")
                        : `${formatDeskLabel(result.currentBooking.desk_number, isEnglish)} - ${formatBookingTypeLabel(result.currentBooking.booking_type, isEnglish)}`,
                    color: "primary",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (err) {
            console.error("Polling error:", err);
        }
    }, [courseId, sessionId, isWorkerOnline, currentBooking, isEnglish]);

    // Socket connection - connect only when worker is online
    useEffect(() => {
        if (!currentUser || !isWorkerOnline) return;

        const socket = io(getRealtimeSocketBaseUrl());

        socket.on("connect", () => {
            hasWarnedAboutConnectError.current = false;
            // Join queue and worker rooms
            socket.emit("join-queue", sessionId);
            socket.emit("join-worker", String(currentUser.id));
        });

        socket.on("connect_error", (err) => {
            if (!hasWarnedAboutConnectError.current) {
                const message = err instanceof Error ? err.message : "WebSocket connection error";
                console.warn("Worker socket unavailable:", message);
                hasWarnedAboutConnectError.current = true;
            }
        });

        // Listen for task assignment
        socket.on("new-task", (data: { booking: QueueBooking }) => {
            // Ignore if paused - we shouldn't receive this but just in case
            if (isPausedRef.current) {
                return;
            }
            
            setCurrentBooking(data.booking);
            addToast({
                title: t("มีงานใหม่!", "New task assigned"),
                description: data.booking.status === "waiting"
                    ? t("กรุณากดรับงานภายใน 20 วินาที", "Please accept this task within 20 seconds.")
                    : `${formatDeskLabel(data.booking.desk_number, isEnglish)} - ${formatBookingTypeLabel(data.booking.booking_type, isEnglish)}`,
                color: "primary",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        });

        // Listen for session status changes
        socket.on("session-status-changed", (data: { sessionId: string; status: string }) => {
            if (data.sessionId === sessionId) {
                setSession((prev) => (prev ? { ...prev, status: data.status as QueueSession["status"] } : null));
                if (data.status === "closed") {
                    addToast({
                        title: t("Session ถูกปิด", "Session closed"),
                        description: t("การรับคิวถูกยกเลิก", "Queue intake has been cancelled."),
                        color: "warning",
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });
                }
            }
        });

        // Listen for booking updates
        socket.on("booking-completed", () => {
            // Refresh if needed
        });

        socketRef.current = socket;

        // Start polling as fallback (every 30 seconds) - socket handles real-time updates
        pollingRef.current = setInterval(() => {
            // Only poll if no current booking
            if (!currentBooking) {
                skipPollingRef.current = false;
                pollForBooking();
            }
        }, 30000);

        return () => {
            socket.emit("leave-queue", sessionId);
            socket.emit("leave-worker", String(currentUser.id));
            socket.disconnect();
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [sessionId, currentUser, isWorkerOnline, pollForBooking, isEnglish]);

    // Join as worker
    const handleJoinAsWorker = async () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }

        if (!workerPreferences.accept_grading && !workerPreferences.accept_help) {
            addToast({
                title: t("กรุณาเลือก", "Select a task type"),
                description: t("กรุณาเลือกอย่างน้อย 1 ประเภทงานที่ต้องการรับ", "Please choose at least one task type to accept."),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsJoining(true);
        try {
            // Request notification permission and register FCM token
            if (notificationSupported && permissionStatus !== "granted") {
                const granted = await requestPermission();
                if (granted) {
                    // Register FCM token for this worker and session
                    await registerFcmToken("worker", parseInt(sessionId));
                }
            } else if (fcmToken) {
                // Already have permission, just register token
                await registerFcmToken("worker", parseInt(sessionId));
            }

            const result = await queueService.joinAsWorker(courseId, sessionId, workerPreferences);
            setIsWorkerOnline(true);
            
            // If there was a waiting booking that got assigned immediately
            if (result.assignedBooking) {
                setCurrentBooking(result.assignedBooking);
                addToast({
                    title: t("มีงานรอตรวจ!", "Task assigned immediately"),
                    description: result.assignedBooking.status === "waiting"
                        ? t("กรุณากดรับงานภายใน 20 วินาที", "Please accept this task within 20 seconds.")
                        : `${formatDeskLabel(result.assignedBooking.desk_number, isEnglish)} - ${formatBookingTypeLabel(result.assignedBooking.booking_type, isEnglish)}`,
                    color: "primary",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                addToast({
                    title: t("สำเร็จ", "Success"),
                    description: t("เข้าร่วมรับงานเรียบร้อยแล้ว", "You are now receiving tasks."),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: unknown) {
            console.error("Error joining as worker:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: isEnglish
                    ? "Unable to join task intake."
                    : error instanceof Error ? error.message : "ไม่สามารถเข้าร่วมรับงานได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsJoining(false);
        }
    };

    // Leave as worker
    const handleLeaveAsWorker = async () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }

        setIsLeaving(true);
        try {
            await queueService.leaveAsWorker(courseId, sessionId);
            
            if (currentBooking) {
                // Has current booking - mark as paused, will fully leave after completing
                setIsPausedAfterComplete(true);
                addToast({
                    title: t("หยุดรับงานใหม่", "Stopped receiving new tasks"),
                    description: t("จะไม่ได้รับงานใหม่ กรุณาทำงานปัจจุบันให้เสร็จ", "No new tasks will be assigned. Please finish your current task."),
                    color: "warning",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                // No current booking - leave immediately
                setIsWorkerOnline(false);
                setIsPausedAfterComplete(false);
                addToast({
                    title: t("สำเร็จ", "Success"),
                    description: t("ออกจากการรับงานเรียบร้อยแล้ว", "You have stopped receiving tasks."),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: unknown) {
            console.error("Error leaving as worker:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: isEnglish
                    ? "Unable to stop receiving tasks."
                    : error instanceof Error ? error.message : "ไม่สามารถออกจากการรับงานได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLeaving(false);
        }
    };

    // Complete booking
    const handleCompleteBooking = async () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }

        if (!currentBooking) return;

        if (currentBooking.booking_type === "grading") {
            const parsedScore = completeForm.score === "" ? null : parseScoreInput(completeForm.score);

            if (usesSubItemScoring) {
                const hasAnySubItemScore = completeForm.sub_item_scores.some((item) => item.score !== "");
                if (!hasAnySubItemScore) {
                    addToast({
                        title: t("กรุณากรอกคะแนน", "Score required"),
                        description: t("กรุณากรอกคะแนนอย่างน้อย 1 ข้อก่อนบันทึกผล", "Please enter at least one sub-item score before saving."),
                        color: "warning",
                        timeout: 3000,
                        shouldShowTimeoutProgress: true,
                    });
                    return;
                }
            } else if (parsedScore === null) {
                addToast({
                    title: t("กรุณากรอกคะแนน", "Score required"),
                    description: t("คิวตรวจงานนี้ต้องมีคะแนนก่อนบันทึกผล", "This grading task requires a score before saving."),
                    color: "warning",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                return;
            } else if (parsedScore < 0 || parsedScore > maxScore) {
                addToast({
                    title: t("à¸„à¸°à¹à¸™à¸™à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡", "Invalid score"),
                    description: isEnglish
                        ? `Please enter a score between 0 and ${maxScore} with up to 2 decimal places.`
                        : `à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸„à¸°à¹à¸™à¸™à¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡ 0-${maxScore} à¹à¸¥à¸°à¸—à¸¨à¸™à¸´à¸¢à¸¡à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ 2 à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡`,
                    color: "warning",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                return;
            }
        }

        setIsCompleting(true);
        try {
            // Filter only sub-items with scores entered
            const validSubItemScores = completeForm.sub_item_scores
                .filter(s => s.score !== "" && s.score !== null)
                .map(s => ({
                    sub_item_id: s.sub_item_id,
                    score: parseScoreInput(s.score) ?? 0,
                }));

            const result = await queueService.completeBooking(courseId, sessionId, currentBooking.id, {
                score: !usesSubItemScoring && currentBooking.booking_type === "grading" && completeForm.score !== "" 
                    ? parseScoreInput(completeForm.score) ?? 0 
                    : undefined,
                sub_item_scores: usesSubItemScoring && currentBooking.booking_type === "grading" && validSubItemScores.length > 0
                    ? validSubItemScores
                    : undefined,
                score_comment: completeForm.score_comment || undefined,
                worker_note: completeForm.worker_note || undefined,
            });

            addToast({
                title: t("สำเร็จ", "Saved"),
                description: t("บันทึกผลเรียบร้อยแล้ว", "The result has been saved successfully."),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });

            // Save position of completed desk for direction guide
            if (currentBooking?.desk_number) {
                setPreviousDeskNumber(currentBooking.desk_number);
            }
            setIsCompleteModalOpen(false);
            setCompleteForm({ score: "", score_comment: "", worker_note: "", sub_item_scores: [] });
            
            // Check if worker was paused - if so, fully leave now
            // Use ref to avoid stale closure issues
            if (isPausedRef.current) {
                setCurrentBooking(null);
                setIsWorkerOnline(false);
                setIsPausedAfterComplete(false);
                isPausedRef.current = false;
                skipPollingRef.current = true;
                addToast({
                    title: t("ออกจากการรับงานแล้ว", "Stopped receiving tasks"),
                    description: t("คุณได้ออกจากการรับงานเรียบร้อยแล้ว", "You have left task intake successfully."),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                if (result.next_booking) {
                    setCurrentBooking(result.next_booking);
                    skipPollingRef.current = true;
                    addToast({
                        title: t("งานถัดไปมาแล้ว", "Next task assigned"),
                        description: `${formatDeskLabel(result.next_booking.desk_number, isEnglish)} - ${formatBookingTypeLabel(result.next_booking.booking_type, isEnglish)}`,
                        color: "primary",
                        timeout: 3000,
                        shouldShowTimeoutProgress: true,
                    });
                } else {
                    setCurrentBooking(null);
                    skipPollingRef.current = false; // Allow polling again
                    // Poll immediately for new booking (don't wait for interval)
                    setTimeout(() => {
                        pollForBooking(true);
                    }, 500);
                }
            }
        } catch (error: unknown) {
            console.error("Error completing booking:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: isEnglish
                    ? "Unable to save the result."
                    : error instanceof Error ? error.message : "ไม่สามารถบันทึกผลได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsCompleting(false);
        }
    };

    // Skip booking
    const handleSkipBooking = async () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }

        if (!currentBooking) return;

        setIsSkipping(true);
        try {
            const result = await queueService.skipBooking(courseId, sessionId, currentBooking.id, skipReason);

            addToast({
                title: t("ข้ามคิวแล้ว", "Queue skipped"),
                description: t("ระบบจะยิงงานใหม่มาให้อัตโนมัติ", "The next task will be assigned automatically."),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });

            // Save position of skipped desk for direction guide
            if (currentBooking?.desk_number) {
                setPreviousDeskNumber(currentBooking.desk_number);
            }
            setIsSkipModalOpen(false);
            setSkipReason("");

            if (result.next_booking) {
                setCurrentBooking(result.next_booking);
                skipPollingRef.current = true;
            } else {
                setCurrentBooking(null);
                skipPollingRef.current = false;
                setTimeout(() => {
                    pollForBooking(true);
                }, 500);
            }
        } catch (error: unknown) {
            console.error("Error skipping booking:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: isEnglish
                    ? "Unable to skip this queue item."
                    : error instanceof Error ? error.message : "ไม่สามารถข้ามคิวได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSkipping(false);
        }
    };

    const handleAcceptOffer = async () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }
        if (!currentBooking || currentBooking.status !== "waiting") return;

        setIsAcceptingOffer(true);
        try {
            const result = await queueService.workerBookingAction(courseId, sessionId, currentBooking.id, {
                action: "start",
            });

            setCurrentBooking(result.booking || currentBooking);
            setOfferSecondsLeft(null);
            addToast({
                title: t("รับงานแล้ว", "Task accepted"),
                description: t("เริ่มตรวจงานได้เลย", "You can start this task now."),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } catch (error: unknown) {
            console.error("Error accepting offer:", error);
            addToast({
                title: t("รับงานไม่สำเร็จ", "Unable to accept task"),
                description: isEnglish
                    ? "This offer may have expired."
                    : error instanceof Error ? error.message : "ข้อเสนออาจหมดเวลาแล้ว",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            setCurrentBooking(null);
            skipPollingRef.current = false;
            setTimeout(() => {
                pollForBooking(true);
            }, 300);
        } finally {
            setIsAcceptingOffer(false);
        }
    };

    const handleRejectOffer = async () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }
        if (!currentBooking || currentBooking.status !== "waiting") return;

        setIsRejectingOffer(true);
        try {
            const result = await queueService.workerBookingAction(courseId, sessionId, currentBooking.id, {
                action: "reject",
                reject_reason: rejectOfferReason,
            });

            setIsRejectOfferModalOpen(false);
            setRejectOfferReason("busy_with_student");
            setOfferSecondsLeft(null);

            if (result.next_booking) {
                setCurrentBooking(result.next_booking);
                skipPollingRef.current = true;
            } else {
                setCurrentBooking(null);
                skipPollingRef.current = false;
                setTimeout(() => {
                    pollForBooking(true);
                }, 300);
            }

            addToast({
                title: t("ปฏิเสธงานแล้ว", "Task declined"),
                description: t("ระบบจะหาเคสถัดไปให้อัตโนมัติ", "The system will route this task and find the next one automatically."),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } catch (error: unknown) {
            console.error("Error rejecting offer:", error);
            addToast({
                title: t("ปฏิเสธงานไม่สำเร็จ", "Unable to decline task"),
                description: isEnglish
                    ? "Unable to update this task offer."
                    : error instanceof Error ? error.message : "ไม่สามารถปฏิเสธงานนี้ได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsRejectingOffer(false);
        }
    };

    useEffect(() => {
        if (!currentBooking || currentBooking.status !== "waiting" || !currentBooking.offer_expires_at) {
            setOfferSecondsLeft(null);
            return;
        }

        const computeSecondsLeft = () => {
            const expiresAt = new Date(currentBooking.offer_expires_at || "").getTime();
            if (Number.isNaN(expiresAt)) {
                setOfferSecondsLeft(null);
                return;
            }
            const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
            setOfferSecondsLeft(seconds);

            if (seconds <= 0) {
                setCurrentBooking(null);
                skipPollingRef.current = false;
                setTimeout(() => {
                    pollForBooking(true);
                }, 300);
            }
        };

        computeSecondsLeft();
        const timer = setInterval(computeSecondsLeft, 1000);
        return () => clearInterval(timer);
    }, [currentBooking, pollForBooking]);

    const isGradingBooking = currentBooking?.booking_type === "grading";
    const isSessionLinkedAssignmentMissing = Boolean(session?.linked_assignment_id && !session?.linkedAssignment);
    // Get max score from linked assignment, or fall back to a general manual-score default.
    const maxScore = session?.linkedAssignment?.max_score || 10;
    const hasSubItems = Boolean(session?.linkedAssignment?.subItems?.length);
    const usesSubItemScoring = isGradingBooking && hasSubItems;
    const usesSingleScoreScoring = isGradingBooking && !hasSubItems;
    // Sort subItems by order_index
    const subItems = [...(session?.linkedAssignment?.subItems || [])].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );

    // Initialize sub-item scores when opening modal - fetch existing scores first
    const initializeCompleteForm = async () => {
        if (!isCourseActive) {
            showCourseClosedReadOnlyToast();
            return;
        }

        setIsCompleteModalOpen(true);
        setIsPreparingCompleteForm(true);

        try {
            let scoringSession = session;

            if (currentBooking?.booking_type === "grading" && session?.linked_assignment_id && !session?.linkedAssignment) {
                try {
                    const refreshedSession = await queueService.getQueueSession(courseId, sessionId);
                    scoringSession = refreshedSession;
                    setSession(refreshedSession);
                } catch (refreshError) {
                    console.error("Error refreshing queue session for scoring:", refreshError);
                }
            }

            const scoringSubItems = [...(scoringSession?.linkedAssignment?.subItems || [])].sort(
                (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
            );
            const scoringHasSubItems = scoringSubItems.length > 0;

            if (currentBooking?.booking_type === "grading" && scoringSession?.linkedAssignment && scoringHasSubItems) {
                // Fetch existing scores for this student
                setIsLoadingScores(true);
                try {
                    const scoresData = await scoreService.getScores(scoringSession.linkedAssignment.id);
                    const studentScore = scoresData?.student_scores?.find(
                        ss => ss.student.id === currentBooking.student_id
                    );
                    
                    // Extract existing sub-item scores
                    const existingScores = studentScore?.sub_item_scores?.map(s => ({
                        sub_item_id: s.sub_item_id,
                        score: s.score,
                        graded_by: s.graded_by || undefined,
                        graded_at: s.graded_at ?? null,
                    })) || [];
                    
                    setExistingSubItemScores(existingScores);
                    
                    // Initialize form with empty values for items not yet scored
                    setCompleteForm({
                        score: "",
                        score_comment: "",
                        worker_note: "",
                        sub_item_scores: scoringSubItems.map(item => ({
                            sub_item_id: item.id,
                            score: "", // Start empty - only for items not yet scored
                        })),
                    });
                } catch (error) {
                    console.error("Error fetching existing scores:", error);
                    setExistingSubItemScores([]);
                    setCompleteForm({
                        score: "",
                        score_comment: "",
                        worker_note: "",
                        sub_item_scores: scoringSubItems.map(item => ({
                            sub_item_id: item.id,
                            score: "",
                        })),
                    });
                } finally {
                    setIsLoadingScores(false);
                }
            } else if (currentBooking?.booking_type === "grading") {
                setExistingSubItemScores([]);
                setCompleteForm({
                    score: "",
                    score_comment: "",
                    worker_note: "",
                    sub_item_scores: [],
                });
            } else {
                setExistingSubItemScores([]);
                setCompleteForm({ score: "", score_comment: "", worker_note: "", sub_item_scores: [] });
            }
        } finally {
            setIsPreparingCompleteForm(false);
        }
    };

    // Calculate total score from sub-items (only items with scores)
    const totalSubItemScore = completeForm.sub_item_scores
        .filter(item => item.score !== "")
        .reduce((sum, item) => sum + (Number(item.score) || 0), 0);
    const totalMaxSubItemScore = subItems.reduce((sum, item) => sum + (Number(item.max_score) || 0), 0);
    
    // Count items being scored in this session
    const newScoredItemsCount = completeForm.sub_item_scores.filter(item => item.score !== "").length;
    // Count already scored items
    const existingScoredItemsCount = existingSubItemScores.filter(s => s.score !== null).length;
    // Total scored (existing + new)
    const totalScoredItemsCount = existingScoredItemsCount + newScoredItemsCount;

    // Direction guide for mini map
    const currentDeskPos  = currentBooking
        ? (deskLayout.find((d) => String(d.number) === String(currentBooking.desk_number)) ?? null)
        : null;
    const previousDeskPos = previousDeskNumber
        ? (deskLayout.find((d) => String(d.number) === String(previousDeskNumber)) ?? null)
        : null;
    const directionGuide =
        currentDeskPos && previousDeskPos && String(previousDeskNumber) !== String(currentBooking?.desk_number ?? "")
            ? getDirectionGuide(
                  { x: previousDeskPos.position_x, y: previousDeskPos.position_y },
                  { x: currentDeskPos.position_x,  y: currentDeskPos.position_y }
              )
            : null;

    if (!session && !isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
                <Card className="max-w-md border border-default-200 shadow-sm">
                    <CardBody className="p-8 text-center">
                        <Icon icon="solar:clipboard-remove-bold" className="mx-auto mb-4 text-6xl text-default-300" />
                        <h2 className="mb-2 text-xl font-bold text-default-700">{t("ไม่พบ Session", "Session not found")}</h2>
                        <p className="mb-4 text-default-500">{t("Session นี้อาจถูกลบหรือไม่มีอยู่ในระบบ", "This session may have been deleted or does not exist.")}</p>
                        <Button color="primary" onPress={() => router.back()}>
                            {t("กลับ", "Back")}
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex items-center justify-center bg-background p-8 text-foreground">
                <Spinner size="lg" color="primary" />
            </div>
        );
    }

    if (session.status === "draft") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
                <Card className="max-w-md border border-default-200 shadow-sm">
                    <CardBody className="p-8 text-center">
                        <Icon icon="solar:document-bold" className="mx-auto mb-4 text-6xl text-default-300" />
                        <h2 className="mb-2 text-xl font-bold text-default-700">{t("Session ยังไม่เปิดใช้งาน", "Session not active yet")}</h2>
                        <p className="mb-4 text-default-500">{t("Session นี้ยังเป็นแบบร่าง กรุณาเปิดใช้งานก่อน", "This session is still in draft mode. Please activate it first.")}</p>
                        <Button color="primary" onPress={() => router.back()}>
                            {t("กลับ", "Back")}
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 text-foreground md:p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Session paused/closed banner */}
                {session.status === "paused" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-100 shrink-0">
                                <Icon icon="solar:pause-circle-bold" className="text-amber-600 text-xl" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-amber-800">{t("ปิดรับการจองคิวชั่วคราว", "Queue booking temporarily paused")}</h3>
                                <p className="text-sm text-amber-600">{t("ไม่รับการจองคิวใหม่ แต่ยังสามารถจัดการคิวที่มีอยู่ได้", "New bookings are paused, but you can still manage the existing queue.")}</p>
                            </div>
                        </div>
                    </div>
                )}
                {session.status === "closed" && (
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-rose-100 shrink-0">
                                <Icon icon="solar:stop-circle-bold" className="text-rose-600 text-xl" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-rose-800">{t("Session ปิดแล้ว", "Session closed")}</h3>
                                <p className="text-sm text-rose-600">{t("Session นี้ถูกปิดแล้ว แต่ยังสามารถจัดการคิวที่ค้างอยู่ได้", "This session is closed, but you can still manage pending queue items.")}</p>
                            </div>
                        </div>
                    </div>
                )}
                {!isCourseActive && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-100 shrink-0">
                                <Icon icon="solar:lock-keyhole-bold" className="text-amber-600 text-xl" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-amber-800">{t("รายวิชานี้ถูกปิดแล้ว", "This course is closed")}</h3>
                                <p className="text-sm text-amber-700">{t("หน้านี้อยู่ในโหมดดูข้อมูลอย่างเดียว ไม่สามารถรับงาน เปลี่ยนสถานะ หรือบันทึกผลได้", "This page is read-only. Receiving tasks, changing status, and saving results are disabled.")}</p>
                            </div>
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        {/* <Button
                            variant="light"
                            startContent={<Icon icon="solar:arrow-left-bold" />}
                            onPress={() => router.back()}
                            className="mb-2"
                        >
                            กลับ
                        </Button> */}
                        <h1 className="text-xl font-bold text-foreground">{session.title}</h1>
                        <p className="text-sm text-default-500">
                            {t("ห้อง", "Room")} {session.classroom?.name} • PIN: <span className="font-mono font-bold text-blue-600">{session.pin_code}</span>
                        </p>
                    </div>
                    <Chip
                        size="md"
                        color={isPausedAfterComplete ? "warning" : isWorkerOnline ? "success" : "default"}
                        variant="flat"
                        startContent={
                            <Icon 
                                icon={isPausedAfterComplete ? "solar:pause-bold" : isWorkerOnline ? "solar:check-circle-bold" : "solar:minus-circle-bold"} 
                            />
                        }
                    >
                        {isPausedAfterComplete ? t("รอเคลียร์งาน", "Finishing current task") : isWorkerOnline ? t("กำลังรับงาน", "Receiving tasks") : t("ไม่ได้รับงาน", "Not receiving tasks")}
                    </Chip>
                </div>

                {/* Worker Settings Card */}
                {!isWorkerOnline ? (
                    <Card className="border border-default-200 bg-content1 shadow-lg">
                        <CardHeader className="border-b border-divider px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-100">
                                    <Icon icon="solar:user-check-bold" className="text-blue-600 text-xl" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">{t("ตั้งค่าการรับงาน", "Task intake settings")}</h2>
                                    <p className="text-sm text-default-500">{t("เลือกประเภทงานที่ต้องการรับ", "Choose the task types you want to accept.")}</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardBody className="p-6">
                            <div className="space-y-4">
                                <div className="flex flex-col gap-3">
                                    <Checkbox
                                        isSelected={workerPreferences.accept_grading}
                                        isDisabled={!isCourseActive}
                                        onValueChange={(value) =>
                                            setWorkerPreferences({ ...workerPreferences, accept_grading: value })
                                        }
                                        classNames={{
                                            label: "text-default-700",
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon icon="solar:clipboard-check-bold" className="text-emerald-500" />
                                            <span>{t("รับตรวจงาน", "Accept grading")}</span>
                                        </div>
                                    </Checkbox>
                                    <Checkbox
                                        isSelected={workerPreferences.accept_help}
                                        isDisabled={!isCourseActive}
                                        onValueChange={(value) =>
                                            setWorkerPreferences({ ...workerPreferences, accept_help: value })
                                        }
                                        classNames={{
                                            label: "text-default-700",
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon icon="solar:hand-shake-bold" className="text-amber-500" />
                                            <span>{t("รับช่วยเหลือ", "Accept help")}</span>
                                        </div>
                                    </Checkbox>
                                </div>

                                {/* Notification Permission Info */}
                                {notificationSupported && permissionStatus !== "granted" && (
                                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                                        <div className="flex items-start gap-2">
                                            <Icon icon="solar:bell-bold" className="text-amber-500 text-lg mt-0.5" />
                                            <div className="text-sm">
                                                <p className="font-medium text-amber-700">{t("เปิดการแจ้งเตือน", "Enable notifications")}</p>
                                                <p className="text-amber-600 text-xs mt-0.5">
                                                    {t("เมื่อกดเริ่มรับงาน ระบบจะขออนุญาตส่งการแจ้งเตือนเมื่อมีงานใหม่ แม้ปิดหน้าจอก็ได้รับแจ้งเตือน", "When you start receiving tasks, the system will request notification permission so you can get alerts for new tasks even when this page is closed.")}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {permissionStatus === "denied" && (
                                    <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                                        <div className="flex items-start gap-2">
                                            <Icon icon="solar:bell-off-bold" className="text-red-500 text-lg mt-0.5" />
                                            <div className="text-sm">
                                                <p className="font-medium text-red-700">{t("การแจ้งเตือนถูกปิด", "Notifications are blocked")}</p>
                                                <p className="text-red-600 text-xs mt-0.5">
                                                    {t("กรุณาเปิดการแจ้งเตือนในการตั้งค่าเบราว์เซอร์เพื่อรับการแจ้งเตือนเมื่อมีงานใหม่", "Please enable notifications in your browser settings to receive alerts for new tasks.")}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    color="primary"
                                    size="lg"
                                    className="w-full"
                                    startContent={<Icon icon="solar:play-bold" className="text-lg" />}
                                    onPress={handleJoinAsWorker}
                                    isLoading={isJoining}
                                    isDisabled={!isCourseActive}
                                >
                                    {t("เริ่มรับงาน", "Start receiving tasks")}
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                ) : (
                    <>
                        {/* Current Task Card */}
                        <Card className="border border-default-200 bg-content1 shadow-lg">
                            <CardHeader className="border-b border-divider px-4 py-2">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <div className={`rounded-xl p-2 ${currentBooking ? "bg-emerald-100" : "bg-content3"}`}>
                                            <Icon 
                                                icon={currentBooking ? "solar:clipboard-check-bold" : "solar:hourglass-bold"} 
                                                className={`text-xl ${currentBooking ? "text-emerald-600" : "text-default-400"}`} 
                                            />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-foreground">
                                                {currentBooking ? t("งานปัจจุบัน", "Current task") : t("รอรับงาน", "Waiting for task")}
                                            </h2>
                                            <p className="text-sm text-default-500">
                                                {currentBooking 
                                                    ? formatDeskLabel(currentBooking.desk_number, isEnglish)
                                                    : t("ระบบจะยิงงานมาให้อัตโนมัติ", "New tasks will be assigned automatically")}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        color={isPausedAfterComplete ? "default" : "danger"}
                                        variant="flat"
                                        size="sm"
                                        startContent={<Icon icon={isPausedAfterComplete ? "solar:pause-bold" : "solar:logout-2-bold"} />}
                                        onPress={handleLeaveAsWorker}
                                        isLoading={isLeaving}
                                        isDisabled={isPausedAfterComplete || !isCourseActive}
                                    >
                                        {isPausedAfterComplete ? t("รอเครียร์งาน...", "Finishing task...") : t("หยุดรับงาน", "Stop receiving tasks")}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardBody className="p-6">
                                {/* Paused notification banner */}
                                {isPausedAfterComplete && currentBooking && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                                        <div className="flex items-center gap-2 text-amber-700">
                                            <Icon icon="solar:info-circle-bold" className="text-xl shrink-0" />
                                            <p className="text-sm">
                                                {t("คุณหยุดรับงานใหม่แล้ว หลังจากทำงานนี้เสร็จจะออกจากการรับงานอัตโนมัติ", "You have stopped receiving new tasks. Once this task is completed, you will leave task intake automatically.")}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {currentBooking ? (
                                    <div className="space-y-6">
                                        {/* Booking Info */}
                                        <div className="rounded-2xl bg-primary/5 p-4">
                                            {currentBooking.status === "waiting" && (
                                                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2 text-amber-700">
                                                            <Icon icon="solar:alarm-bold" className="text-lg" />
                                                            <p className="text-sm font-medium">
                                                                {t("กรุณากดรับงานภายใน 20 วินาที", "Please accept this task within 20 seconds")}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="relative h-10 w-10">
                                                                <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                                                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" className="text-amber-500" />
                                                                    <circle
                                                                        cx="18"
                                                                        cy="18"
                                                                        r="15.915"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="3"
                                                                        className={offerSecondsLeft !== null && offerSecondsLeft <= 5 ? "text-rose-500" : "text-amber-600"}
                                                                        strokeDasharray={`${Math.max(0, Math.min(1, (offerSecondsLeft ?? 0) / 20)) * 100}, 100`}
                                                                    />
                                                                </svg>
                                                                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-amber-700">
                                                                    {offerSecondsLeft ?? 0}
                                                                </span>
                                                            </div>
                                                            <Chip color={offerSecondsLeft !== null && offerSecondsLeft <= 5 ? "danger" : "warning"} variant="flat" size="sm">
                                                                {t("เวลารับงาน", "Offer timer")}
                                                            </Chip>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between mb-4">
                                                <Chip
                                                    size="sm"
                                                    color={currentBooking.booking_type === "grading" ? "success" : "warning"}
                                                    variant="flat"
                                                    startContent={
                                                        <Icon 
                                                            icon={currentBooking.booking_type === "grading" 
                                                                ? "solar:clipboard-check-bold" 
                                                                : "solar:hand-shake-bold"
                                                            } 
                                                        />
                                                    }
                                                >
                                                    {formatBookingTypeLabel(currentBooking.booking_type, isEnglish)}
                                                </Chip>
                                                <span className="text-sm text-default-500">
                                                    {isEnglish ? `Queue #${currentBooking.queue_number}` : `คิวที่ ${currentBooking.queue_number}`}
                                                </span>
                                            </div>

                                            {currentBooking.is_late_booking && (
                                                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                                                    <div className="flex items-start gap-2 text-rose-700">
                                                        <Icon icon="solar:danger-triangle-bold" className="text-lg mt-0.5 shrink-0" />
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-sm">{t("นักศึกษาคนนี้จองหลัง Cutoff", "This student booked after cutoff")}</p>
                                                            <p className="text-xs mt-0.5 text-rose-600">
                                                                {currentBooking.late_reason || t("งานนี้ต้องพิจารณาเกณฑ์คะแนนหลัง cutoff", "This booking may require post-cutoff scoring criteria.")}
                                                            </p>
                                                            {session?.cutoff_at && (
                                                                <p className="text-xs mt-0.5 text-rose-600">
                                                                    {t("เวลา cutoff", "Cutoff time")}: {formatCutoffDateTime(session.cutoff_at, isEnglish)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mb-5 flex items-center justify-center gap-3">
                                                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-content1 shadow-lg ring-1 ring-default-200">
                                                    <span className="text-3xl font-bold text-blue-600">
                                                        {currentBooking.desk_number}
                                                    </span>
                                                </div>
                                                <div>
                                                <p className="text-md font-semibold text-foreground">
                                                    {formatDeskLabel(currentBooking.desk_number, isEnglish)}
                                                </p>
                                                {currentBooking.zone && (
                                                    // <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700">
                                                    //     <Icon icon="solar:map-point-bold" className="text-base" />
                                                        <span className="text-sm text-default-500">{currentBooking.zone.name}</span>
                                                    // </div>
                                                )}
                                                </div>
                                            </div>

                                            {/* ─── Mini Room Map + Direction Guide ─── */}
                                            {deskLayout.length > 0 && (
                                                <div className="mb-4 overflow-hidden rounded-xl border border-default-200 bg-content1/70">
                                                    {/* Direction banner – only show when we know previous desk */}
                                                    {directionGuide && (
                                                        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500 text-white text-xs text-center font-normal">
                                                            {/* <Icon icon={directionGuide.icon} className="text-lg shrink-0" /> */}
                                                            <span className="text-center">
                                                                {isEnglish
                                                                    ? `From ${formatDeskLabel(previousDeskNumber, true)} to ${formatDeskLabel(currentBooking.desk_number, true)}`
                                                                    : `จากโต๊ะ ${previousDeskNumber} → โต๊ะ ${currentBooking.desk_number}`}{" "}
                                                                <span className="font-normal">
                                                                    ({formatDirectionLabel(directionGuide.label, isEnglish)},{" "}{formatDistanceLabel(directionGuide.distance, isEnglish)})
                                                                </span>
                                                            </span>
                                                        </div>
                                                    )}
                                                    {/* SVG map */}
                                                    <div className="px-2 pt-2">
                                                        <MiniRoomMap
                                                            desks={deskLayout}
                                                            currentDeskNumber={currentBooking.desk_number}
                                                            previousDeskNumber={previousDeskNumber}
                                                        />
                                                    </div>
                                                    {/* Legend */}
                                                    <div className="flex items-center gap-4 px-3 pb-2 text-xs text-default-500">
                                                        <span className="flex items-center gap-1">
                                                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
                                                            {t("โต๊ะนี้", "Current desk")}
                                                        </span>
                                                        {previousDeskNumber && String(previousDeskNumber) !== String(currentBooking.desk_number) && (
                                                            <span className="flex items-center gap-1">
                                                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-300" />
                                                                {t("โต๊ะก่อนหน้า", "Previous desk")}
                                                            </span>
                                                        )}
                                                        {/* <span className="flex items-center gap-1">
                                                            <span className="inline-block w-3 h-1.5 rounded-sm bg-emerald-600" />
                                                            โต๊ะอาจารย์
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300" />
                                                            โต๊ะอื่น
                                                        </span> */}
                                                    </div>
                                                </div>
                                            )}


                                            <div className="space-y-2 rounded-xl border border-default-200 bg-content1 p-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar
                                                        name={currentBooking.student?.full_name || t("นักศึกษา", "Student")}
                                                        size="sm"
                                                        className="bg-linear-to-br from-blue-400 to-indigo-500"
                                                    />
                                                    <div>
                                                        <p className="font-medium text-foreground">
                                                            {currentBooking.student?.full_name || "-"}
                                                        </p>
                                                        <p className="text-sm text-default-500">
                                                            {currentBooking.student?.student_id || "-"}
                                                        </p>
                                                    </div>
                                                </div>
                                                {currentBooking.note && (
                                                    <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                                                        <p className="text-sm text-amber-800">
                                                            <Icon icon="solar:notes-bold" className="inline mr-1" />
                                                            {currentBooking.note}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>


                                        {/* Action Buttons */}
                                        {currentBooking.status === "waiting" ? (
                                            <div className="flex gap-3">
                                                <Button
                                                    color="primary"
                                                    size="lg"
                                                    className="flex-1"
                                                    startContent={<Icon icon="solar:inbox-in-bold" className="text-xl" />}
                                                    onPress={handleAcceptOffer}
                                                    isLoading={isAcceptingOffer}
                                                    isDisabled={!isCourseActive}
                                                >
                                                    {t("รับงานตรวจนี้", "Accept this task")}
                                                </Button>
                                                <Button
                                                    color="danger"
                                                    variant="flat"
                                                    size="lg"
                                                    startContent={<Icon icon="solar:close-circle-bold" className="text-xl" />}
                                                    onPress={() => setIsRejectOfferModalOpen(true)}
                                                    isDisabled={!isCourseActive}
                                                >
                                                    {t("ปฏิเสธ", "Decline")}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-3">
                                                <Button
                                                    color="success"
                                                    size="lg"
                                                    className="flex-1"
                                                    startContent={<Icon icon="solar:check-circle-bold" className="text-xl" />}
                                                    onPress={initializeCompleteForm}
                                                    isDisabled={!isCourseActive}
                                                >
                                                    {t("เสร็จสิ้น", "Complete")}
                                                </Button>
                                                <Button
                                                    color="warning"
                                                    variant="flat"
                                                    size="lg"
                                                    startContent={<Icon icon="solar:skip-next-bold" className="text-xl" />}
                                                    onPress={() => setIsSkipModalOpen(true)}
                                                    isDisabled={!isCourseActive}
                                                >
                                                    {t("ข้าม", "Skip")}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-content3">
                                            <Spinner size="lg" color="primary" />
                                        </div>
                                        <p className="mb-1 text-lg font-medium text-default-600">
                                            {t("กำลังรอรับงาน...", "Waiting for new task...")}
                                        </p>
                                        <p className="text-sm text-default-400">
                                            {t("เมื่อมีนักศึกษาจองคิว ระบบจะยิงงานมาให้อัตโนมัติ", "When a student books a queue slot, the system will assign it automatically.")}
                                        </p>
                                    </div>
                                )}
                            </CardBody>
                        </Card>

                        {/* Worker Preferences Card */}
                        <Card className="border border-default-200 bg-content1 shadow-md">
                            <CardBody className="p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-default-600">{t("ประเภทงานที่รับ:", "Accepting:")}</span>
                                    <div className="flex gap-2">
                                        {workerPreferences.accept_grading && (
                                            <Chip size="sm" color="success" variant="flat" startContent={<Icon icon="solar:clipboard-check-bold" className="mr-1" />}>
                                                {/* <Icon icon="solar:clipboard-check-bold" className="mr-1" /> */}
                                                {t("ตรวจงาน", "Grading")}
                                            </Chip>
                                        )}
                                        {workerPreferences.accept_help && (
                                            <Chip size="sm" color="warning" variant="flat" startContent={<Icon icon="solar:hand-shake-bold" className="mr-1" />}>
                                                {t("ช่วยเหลือ", "Help")}
                                            </Chip>
                                        )}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </>
                )}
            </div>


            {/* Complete Booking Modal */}
            <Modal 
                isOpen={isCompleteModalOpen} 
                onClose={() => setIsCompleteModalOpen(false)}
                size="lg"
                scrollBehavior="inside"
            >
                <ModalContent>
                    <ModalHeader>
                        <div className="flex items-center gap-3">
                            <Icon icon="solar:check-circle-bold" className="text-emerald-500 text-2xl" />
                            <span>{t("บันทึกผลการตรวจ", "Record result")}</span>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <div className="space-y-4">
                            {isPreparingCompleteForm && (
                                <div className="flex items-center justify-center py-8">
                                    <Spinner size="lg" />
                                </div>
                            )}

                            {!isPreparingCompleteForm && isGradingBooking && isSessionLinkedAssignmentMissing && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                    <div className="flex items-start gap-2 text-amber-700">
                                        <Icon icon="solar:danger-triangle-bold" className="mt-0.5 text-lg shrink-0" />
                                        <div className="text-sm">
                                            <p className="font-medium">{t("โหลดรายละเอียดการให้คะแนนไม่ครบ", "Scoring details are incomplete")}</p>
                                            <p className="mt-0.5 text-amber-600">
                                                {t("ระบบจะแสดงช่องคะแนนรวมเป็นค่า fallback หากคิวนี้ควรเป็นการให้คะแนนรายข้อ แนะนำให้รีเฟรชหน้าแล้วลองอีกครั้ง", "A total-score fallback is shown for now. If this task should use sub-item scoring, refresh the page and try again.")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!isPreparingCompleteForm && isGradingBooking && (
                                <>
                                    {/* Sub-items scoring */}
                                    {usesSubItemScoring ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-medium text-default-700">
                                                    {t("กรอกคะแนนรายข้อ", "Enter sub-item scores")}
                                                </label>
                                                <Chip size="sm" color={totalScoredItemsCount === subItems.length ? "success" : "primary"} variant="flat">
                                                    {isEnglish ? `Scored ${totalScoredItemsCount}/${subItems.length} items` : `ลงแล้ว ${totalScoredItemsCount}/${subItems.length} ข้อ`}
                                                </Chip>
                                            </div>
                                            
                                            {isLoadingScores ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Spinner size="lg" />
                                                </div>
                                            ) : (
                                                <div className="space-y-3 rounded-xl bg-content2/70 p-4">
                                                    {subItems.map((item, index) => {
                                                        const existingScore = existingSubItemScores.find(
                                                            s => s.sub_item_id === item.id
                                                        );
                                                        const isLocked = existingScore && existingScore.score !== null;
                                                        const currentScore = completeForm.sub_item_scores.find(
                                                            s => s.sub_item_id === item.id
                                                        )?.score ?? "";
                                                        
                                                        return (
                                                            <div 
                                                                key={`sub-item-${index}-${item.id}`} 
                                                                className={`flex items-start gap-3 p-3 rounded-lg border ${
                                                                    isLocked 
                                                                        ? 'bg-amber-50 border-amber-200' 
                                                                        : 'bg-content1 border-default-200'
                                                                }`}
                                                            >
                                                                <span className={`w-8 h-8 flex items-center justify-center text-sm font-bold rounded-full shrink-0 ${
                                                                    isLocked 
                                                                        ? 'bg-amber-100 text-amber-600' 
                                                                        : 'bg-blue-100 text-blue-600'
                                                                }`}>
                                                                    {index + 1}
                                                                </span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-default-700 break-words">{item.name}</p>
                                                                    {isLocked && existingScore?.graded_by && (
                                                                        <div className="mt-1 space-y-0.5">
                                                                            <p className="text-xs text-amber-700">
                                                                                {t("ลงโดย", "Scored by")} {existingScore.graded_by.display_name}
                                                                            </p>
                                                                            {existingScore.graded_at && (
                                                                                <p className="text-[11px] text-amber-600/90">
                                                                                    {formatCutoffDateTime(existingScore.graded_at, isEnglish)}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                                                                    {isLocked ? (
                                                                        <>
                                                                            <div className="flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1.5">
                                                                                <Icon icon="solar:lock-bold" className="text-amber-600" />
                                                                                <span className="font-bold text-amber-700">{existingScore?.score}</span>
                                                                            </div>
                                                                            <span className="text-xs text-default-500">/ {item.max_score}</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <div className="flex items-center gap-2">
                                                                                <Input
                                                                                    type="text"
                                                                                    inputMode="decimal"
                                                                                    pattern={SCORE_INPUT_PATTERN}
                                                                                    placeholder="0"
                                                                                    size="sm"
                                                                                    value={currentScore}
                                                                                    isDisabled={!isCourseActive}
                                                                                    onValueChange={(value) => {
                                                                                        setCompleteForm(prev => ({
                                                                                            ...prev,
                                                                                            sub_item_scores: prev.sub_item_scores.map(s =>
                                                                                                s.sub_item_id === item.id
                                                                                                    ? { ...s, score: sanitizeScoreInput(value, Number(item.max_score) || 0) }
                                                                                                    : s
                                                                                            ),
                                                                                        }));
                                                                                    }}
                                                                                    classNames={{
                                                                                        base: "w-20",
                                                                                        input: "text-center font-semibold",
                                                                                        inputWrapper: "bg-content1 border-default-200",
                                                                                    }}
                                                                                    variant="bordered"
                                                                                    min={0}
                                                                                    max={item.max_score}
                                                                                />
                                                                                <span className="text-sm text-default-500">/ {item.max_score}</span>
                                                                            </div>
                                                                            {/* Quick score buttons */}
                                                                            <div className="flex justify-end gap-1">
                                                                                {(() => {
                                                                                    const rawMax = Number(item.max_score);
                                                                                    const max = Number.isFinite(rawMax) ? rawMax : 0;
                                                                                    const half = Number(formatScoreValue(max / 2));
                                                                                    const options = [0, half, max];
                                                                                    return options.map((score, idx) => (
                                                                                        <Button
                                                                                            key={`sub-score-${item.id}-${idx}-${score}`}
                                                                                            size="sm"
                                                                                            variant={currentScore === score.toString() ? "solid" : "flat"}
                                                                                            color={currentScore === score.toString() ? "primary" : "default"}
                                                                                            isDisabled={!isCourseActive}
                                                                                            className={`min-w-10 h-7 text-xs ${currentScore === score.toString() 
                                                                                                ? "bg-blue-500 text-white font-semibold" 
                                                                                                : "bg-content3 text-default-700 font-medium"
                                                                                            }`}
                                                                                            onPress={() => {
                                                                                                setCompleteForm(prev => ({
                                                                                                    ...prev,
                                                                                                    sub_item_scores: prev.sub_item_scores.map(s =>
                                                                                                        s.sub_item_id === item.id
                                                                                                            ? { ...s, score: score.toString() }
                                                                                                            : s
                                                                                                    ),
                                                                                                }));
                                                                                            }}
                                                                                        >
                                                                                            {score}
                                                                                        </Button>
                                                                                    ));
                                                                                })()}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            
                                            {/* Total score summary */}
                                            {newScoredItemsCount > 0 && (
                                                <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
                                                    <span className="font-medium text-blue-700">{isEnglish ? `Score to submit now (${newScoredItemsCount} items)` : `คะแนนที่จะลงครั้งนี้ (${newScoredItemsCount} ข้อ)`}</span>
                                                    <span className="text-2xl font-bold text-blue-600">
                                                        {formatScoreValue(totalSubItemScore)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Single score - no sub-items */
                                        <div className="space-y-3 rounded-xl bg-content2/70 p-4">
                                            <div className="flex items-center gap-3 rounded-lg border border-default-200 bg-content1 p-3">
                                                <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                                                    <Icon icon="solar:medal-star-bold" className="text-xl text-amber-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-default-700">{t("คะแนนรวม", "Total score")}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        pattern={SCORE_INPUT_PATTERN}
                                                        placeholder="0"
                                                        value={completeForm.score}
                                                        isDisabled={!isCourseActive}
                                                        onValueChange={(value) => setCompleteForm({ ...completeForm, score: sanitizeScoreInput(value, maxScore) })}
                                                        min={0}
                                                        max={maxScore}
                                                        step="0.01"
                                                        className="w-20"
                                                        size="sm"
                                                        variant="bordered"
                                                        classNames={{
                                                            input: "text-center font-semibold",
                                                            inputWrapper: "bg-content1 border-default-200",
                                                        }}
                                                    />
                                                    <span className="text-sm text-default-500">/ {maxScore}</span>
                                                </div>
                                            </div>
                                            {/* Quick score buttons */}
                                            <div className="flex justify-end gap-2">
                                                {(() => {
                                                    const rawMax = Number(maxScore);
                                                    const max = Number.isFinite(rawMax) ? rawMax : 0;
                                                    const half = Number(formatScoreValue(max / 2));
                                                    const options = [0, half, max];
                                                    return options.map((score, idx) => (
                                                        <Button
                                                            key={`total-score-${idx}-${score}`}
                                                            size="sm"
                                                            variant={completeForm.score === score.toString() ? "solid" : "flat"}
                                                            color={completeForm.score === score.toString() ? "primary" : "default"}
                                                            isDisabled={!isCourseActive}
                                                            className={completeForm.score === score.toString() 
                                                                ? "bg-blue-500 text-white font-semibold min-w-12" 
                                                                : "bg-content1 border border-default-200 text-default-700 font-medium min-w-12"
                                                            }
                                                            onPress={() => setCompleteForm({ ...completeForm, score: score.toString() })}
                                                        >
                                                            {score}
                                                        </Button>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* For help requests - no score needed */}
                            {!isPreparingCompleteForm && currentBooking?.booking_type === "help" && (
                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                    <div className="flex items-center gap-2 text-amber-700">
                                        <Icon icon="solar:info-circle-bold" className="text-xl" />
                                        <span className="text-sm">{t("การขอความช่วยเหลือไม่ต้องลงคะแนน", "Help requests do not require scoring.")}</span>
                                    </div>
                                </div>
                            )}

                            <Input
                                label={t("ความคิดเห็น/หมายเหตุ (ถ้ามี)", "Comment / note (optional)")}
                                placeholder={t("เพิ่มความคิดเห็นหรือหมายเหตุ...", "Add a comment or note...")}
                                value={completeForm.score_comment}
                                isDisabled={!isCourseActive}
                                onValueChange={(value) => setCompleteForm({ ...completeForm, score_comment: value })}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={() => setIsCompleteModalOpen(false)}>
                            {t("ยกเลิก", "Cancel")}
                        </Button>
                        <Button 
                            color="success" 
                            onPress={handleCompleteBooking}
                            isLoading={isCompleting}
                            isDisabled={!isCourseActive || isPreparingCompleteForm || isLoadingScores}
                        >
                            {t("บันทึกผล", "Save result")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Skip Booking Modal */}
            <Modal isOpen={isSkipModalOpen} onClose={() => setIsSkipModalOpen(false)}>
                <ModalContent>
                    <ModalHeader>
                        <div className="flex items-center gap-3">
                            <Icon icon="solar:skip-next-bold" className="text-amber-500 text-2xl" />
                            <span>{t("ข้ามคิว", "Skip queue")}</span>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <p className="mb-4 text-default-600">
                            {t("คุณแน่ใจหรือไม่ที่จะข้ามคิวนี้? (เช่น นักศึกษาไม่อยู่ที่โต๊ะ)", "Are you sure you want to skip this queue item? (for example, the student is not at the desk)")}
                        </p>
                        <Input
                            label={t("เหตุผล (ถ้ามี)", "Reason (optional)")}
                            placeholder={t("ไม่พบนักศึกษา...", "Student not found...")}
                            labelPlacement="outside"
                            variant="bordered"
                            value={skipReason}
                            isDisabled={!isCourseActive}
                            onValueChange={setSkipReason}
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={() => setIsSkipModalOpen(false)}>
                            {t("ยกเลิก", "Cancel")}
                        </Button>
                        <Button 
                            color="warning" 
                            onPress={handleSkipBooking}
                            isLoading={isSkipping}
                            isDisabled={!isCourseActive}
                        >
                            {t("ข้ามคิว", "Skip queue")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Reject Offer Modal */}
            <Modal isOpen={isRejectOfferModalOpen} onClose={() => setIsRejectOfferModalOpen(false)}>
                <ModalContent>
                    <ModalHeader>
                        <div className="flex items-center gap-3">
                            <Icon icon="solar:close-circle-bold" className="text-red-500 text-2xl" />
                            <span>{t("ปฏิเสธงาน", "Decline task")}</span>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <p className="mb-3 text-default-600">
                            {t("หากไม่สะดวกในตอนนี้ คุณสามารถปฏิเสธงานนี้ได้ ระบบจะส่งต่อให้อีกคน", "If you are currently unavailable, you can decline this task and the system will re-route it.")}
                        </p>
                        <Select
                            label={t("เหตุผลการปฏิเสธ", "Decline reason")}
                            labelPlacement="outside"
                            selectedKeys={[rejectOfferReason]}
                            onSelectionChange={(keys) => {
                                const selected = (Array.from(keys)[0] as string) || "busy_with_student";
                                setRejectOfferReason(selected);
                            }}
                            variant="bordered"
                            isDisabled={!isCourseActive}
                        >
                            {rejectReasonOptions.map((item) => (
                                <SelectItem key={item.key}>{item.label}</SelectItem>
                            ))}
                        </Select>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={() => setIsRejectOfferModalOpen(false)}>
                            {t("ยกเลิก", "Cancel")}
                        </Button>
                        <Button
                            color="danger"
                            onPress={handleRejectOffer}
                            isLoading={isRejectingOffer}
                            isDisabled={!isCourseActive}
                        >
                            {t("ยืนยันปฏิเสธ", "Confirm decline")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}

