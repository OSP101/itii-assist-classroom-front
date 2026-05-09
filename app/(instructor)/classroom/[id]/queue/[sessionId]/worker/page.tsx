"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
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
import { io, Socket } from "@/services/realtime-socket";
import queueService, {
    type QueueSession,
    type QueueWorker,
    type QueueBooking,
} from "@/services/queue.service";
import { authService } from "@/services/auth.service";
import scoreService from "@/services/score.service";
import { useNotification } from "@/contexts/NotificationContext";
import { API_BASE_URL } from "@/config/api";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";


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
                        <g key={desk.id}>
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
                    <g key={desk.id}>
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

function formatCutoffDateTime(value?: string | null): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// ============================================================
// Main Component
// ============================================================

export default function WorkerDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.id as string;
    const sessionId = params.sessionId as string;

    const [session, setSession] = useState<QueueSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<{ id: number; full_name: string } | null>(null);

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
    }[]>([]);
    const [isLoadingScores, setIsLoadingScores] = useState(false);

    // Skip booking modal
    const [isSkipModalOpen, setIsSkipModalOpen] = useState(false);
    const [skipReason, setSkipReason] = useState("");
    const [isSkipping, setIsSkipping] = useState(false);

    // Mini room map
    const [deskLayout, setDeskLayout] = useState<MiniDeskInfo[]>([]);
    const [previousDeskNumber, setPreviousDeskNumber] = useState<string | null>(null);

    // Socket
    const socketRef = useRef<Socket | null>(null);

    // Notification (FCM)
    const { 
        isSupported: notificationSupported, 
        permissionStatus, 
        requestPermission, 
        registerFcmToken,
        fcmToken,
    } = useNotification();

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
            const data = await queueService.getQueueSession(courseId, sessionId);
            setSession(data);

            // Always check for existing booking assigned to current user (even if offline)
            // This handles reconnection after page refresh
            try {
                const result = await queueService.getWorkerCurrentBooking(courseId, sessionId);
                console.log("getWorkerCurrentBooking result:", result);
                
                const { worker, currentBooking } = result;
                
                if (currentBooking) {
                    console.log("Found pending booking:", currentBooking);
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
                        title: "พบงานที่ค้างอยู่",
                        description: `โต๊ะ ${currentBooking.desk_number} - ${currentBooking.booking_type === "grading" ? "ตรวจงาน" : "ช่วยเหลือ"}`,
                        color: "primary",
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });
                } else if (currentUser && data.workers) {
                    console.log("No pending booking, checking worker list");
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
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถโหลดข้อมูล Session ได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, [courseId, sessionId, currentUser]);

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
                e.returnValue = "คุณกำลังรับงานอยู่ ต้องการออกจากหน้านี้หรือไม่?";
                return e.returnValue;
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [isWorkerOnline, currentBooking]);

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
            console.log("Polling for new booking...");
            const result = await queueService.getWorkerCurrentBooking(courseId, sessionId);
            if (result.currentBooking) {
                // Double check - don't accept if paused
                if (isPausedRef.current) {
                    console.log("Polling found booking but worker is paused, ignoring");
                    return;
                }
                
                console.log("Polling found new booking:", result.currentBooking);
                setCurrentBooking(result.currentBooking);
                skipPollingRef.current = true;
                addToast({
                    title: "มีงานใหม่!",
                    description: `โต๊ะ ${result.currentBooking.desk_number} - ${result.currentBooking.booking_type === "grading" ? "ตรวจงาน" : "ขอความช่วยเหลือ"}`,
                    color: "primary",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (err) {
            console.error("Polling error:", err);
        }
    }, [courseId, sessionId, isWorkerOnline, currentBooking]);

    // Socket connection - connect only when worker is online
    useEffect(() => {
        if (!currentUser || !isWorkerOnline) return;

        const socket = io(SOCKET_URL, {
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            console.log("Socket connected for worker, socketId:", socket.id, "userId:", currentUser.id);
            // Join queue and worker rooms
            socket.emit("join-queue", sessionId);
            socket.emit("join-worker", String(currentUser.id));
            console.log("Joined rooms: queue-" + sessionId + ", worker-" + String(currentUser.id));
        });

        socket.on("disconnect", () => {
            console.log("Socket disconnected for worker");
        });

        socket.on("connect_error", (err) => {
            console.error("Socket connection error:", err);
        });

        // Listen for task assignment
        socket.on("new-task", (data: { booking: QueueBooking }) => {
            console.log("=== RECEIVED new-task event ===");
            console.log("Data:", JSON.stringify(data, null, 2));
            
            // Ignore if paused - we shouldn't receive this but just in case
            if (isPausedRef.current) {
                console.log("Ignoring new-task because worker is paused");
                return;
            }
            
            setCurrentBooking(data.booking);
            addToast({
                title: "มีงานใหม่!",
                description: `โต๊ะ ${data.booking.desk_number} - ${data.booking.booking_type === "grading" ? "ตรวจงาน" : "ขอความช่วยเหลือ"}`,
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
                        title: "Session ถูกปิด",
                        description: "การรับคิวถูกยกเลิก",
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

        // Start polling as fallback (every 3 seconds)
        pollingRef.current = setInterval(() => {
            // Only poll if no current booking
            if (!currentBooking) {
                skipPollingRef.current = false;
                pollForBooking();
            }
        }, 3000);

        return () => {
            socket.emit("leave-queue", sessionId);
            socket.emit("leave-worker", String(currentUser.id));
            socket.disconnect();
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [sessionId, currentUser, isWorkerOnline, pollForBooking]);

    // Join as worker
    const handleJoinAsWorker = async () => {
        if (!workerPreferences.accept_grading && !workerPreferences.accept_help) {
            addToast({
                title: "กรุณาเลือก",
                description: "กรุณาเลือกอย่างน้อย 1 ประเภทงานที่ต้องการรับ",
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
                    title: "มีงานรอตรวจ!",
                    description: `โต๊ะ ${result.assignedBooking.desk_number} - ${result.assignedBooking.booking_type === "grading" ? "ตรวจงาน" : "ขอความช่วยเหลือ"}`,
                    color: "primary",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                addToast({
                    title: "สำเร็จ",
                    description: "เข้าร่วมรับงานเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: unknown) {
            console.error("Error joining as worker:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error instanceof Error ? error.message : "ไม่สามารถเข้าร่วมรับงานได้",
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
        setIsLeaving(true);
        try {
            await queueService.leaveAsWorker(courseId, sessionId);
            
            if (currentBooking) {
                // Has current booking - mark as paused, will fully leave after completing
                setIsPausedAfterComplete(true);
                addToast({
                    title: "หยุดรับงานใหม่",
                    description: "จะไม่ได้รับงานใหม่ กรุณาทำงานปัจจุบันให้เสร็จ",
                    color: "warning",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                // No current booking - leave immediately
                setIsWorkerOnline(false);
                setIsPausedAfterComplete(false);
                addToast({
                    title: "สำเร็จ",
                    description: "ออกจากการรับงานเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: unknown) {
            console.error("Error leaving as worker:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error instanceof Error ? error.message : "ไม่สามารถออกจากการรับงานได้",
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
        if (!currentBooking) return;

        setIsCompleting(true);
        try {
            const hasSubItems = session?.linkedAssignment?.subItems && session.linkedAssignment.subItems.length > 0;

            // Filter only sub-items with scores entered
            const validSubItemScores = completeForm.sub_item_scores
                .filter(s => s.score !== "" && s.score !== null)
                .map(s => ({
                    sub_item_id: s.sub_item_id,
                    score: parseFloat(s.score) || 0,
                }));

            const result = await queueService.completeBooking(courseId, sessionId, currentBooking.id, {
                score: !hasSubItems && currentBooking.booking_type === "grading" && completeForm.score !== "" 
                    ? parseFloat(completeForm.score) || 0 
                    : undefined,
                sub_item_scores: hasSubItems && currentBooking.booking_type === "grading" && validSubItemScores.length > 0
                    ? validSubItemScores
                    : undefined,
                score_comment: completeForm.score_comment || undefined,
                worker_note: completeForm.worker_note || undefined,
            });

            addToast({
                title: "สำเร็จ",
                description: "บันทึกผลเรียบร้อยแล้ว",
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
                    title: "ออกจากการรับงานแล้ว",
                    description: "คุณได้ออกจากการรับงานเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                if (result.next_booking) {
                    setCurrentBooking(result.next_booking);
                    skipPollingRef.current = true;
                    addToast({
                        title: "งานถัดไปมาแล้ว",
                        description: `โต๊ะ ${result.next_booking.desk_number} - ${result.next_booking.booking_type === "grading" ? "ตรวจงาน" : "ขอความช่วยเหลือ"}`,
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
                title: "เกิดข้อผิดพลาด",
                description: error instanceof Error ? error.message : "ไม่สามารถบันทึกผลได้",
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
        if (!currentBooking) return;

        setIsSkipping(true);
        try {
            const result = await queueService.skipBooking(courseId, sessionId, currentBooking.id, skipReason);

            addToast({
                title: "ข้ามคิวแล้ว",
                description: "ระบบจะยิงงานใหม่มาให้อัตโนมัติ",
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
                title: "เกิดข้อผิดพลาด",
                description: error instanceof Error ? error.message : "ไม่สามารถข้ามคิวได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSkipping(false);
        }
    };

    // Get max score from linked assignment
    const maxScore = session?.linkedAssignment?.max_score || 10;
    const hasSubItems = session?.linkedAssignment?.subItems && session.linkedAssignment.subItems.length > 0;
    // Sort subItems by order_index
    const subItems = [...(session?.linkedAssignment?.subItems || [])].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );

    // Initialize sub-item scores when opening modal - fetch existing scores first
    const initializeCompleteForm = async () => {
        setIsCompleteModalOpen(true);
        
        if (currentBooking?.booking_type === "grading" && session?.linkedAssignment) {
            if (hasSubItems) {
                // Fetch existing scores for this student
                setIsLoadingScores(true);
                try {
                    const scoresData = await scoreService.getScores(session.linkedAssignment.id);
                    const studentScore = scoresData?.student_scores?.find(
                        ss => ss.student.id === currentBooking.student_id
                    );
                    
                    // Extract existing sub-item scores
                    const existingScores = studentScore?.sub_item_scores?.map(s => ({
                        sub_item_id: s.sub_item_id,
                        score: s.score,
                        graded_by: s.graded_by || undefined,
                    })) || [];
                    
                    setExistingSubItemScores(existingScores);
                    
                    // Initialize form with empty values for items not yet scored
                    setCompleteForm({
                        score: "",
                        score_comment: "",
                        worker_note: "",
                        sub_item_scores: subItems.map(item => ({
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
                        sub_item_scores: subItems.map(item => ({
                            sub_item_id: item.id,
                            score: "",
                        })),
                    });
                } finally {
                    setIsLoadingScores(false);
                }
            } else {
                setExistingSubItemScores([]);
                setCompleteForm({
                    score: "",
                    score_comment: "",
                    worker_note: "",
                    sub_item_scores: [],
                });
            }
        } else {
            setExistingSubItemScores([]);
            setCompleteForm({ score: "", score_comment: "", worker_note: "", sub_item_scores: [] });
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
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardBody className="p-8 text-center">
                        <Icon icon="solar:clipboard-remove-bold" className="text-6xl text-slate-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-700 mb-2">ไม่พบ Session</h2>
                        <p className="text-slate-500 mb-4">Session นี้อาจถูกลบหรือไม่มีอยู่ในระบบ</p>
                        <Button color="primary" onPress={() => router.back()}>
                            กลับ
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="bg-slate-100 p-8 flex items-center justify-center">
                <Spinner size="lg" color="primary" />
            </div>
        );
    }

    if (session.status === "draft") {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardBody className="p-8 text-center">
                        <Icon icon="solar:document-bold" className="text-6xl text-slate-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-700 mb-2">Session ยังไม่เปิดใช้งาน</h2>
                        <p className="text-slate-500 mb-4">Session นี้ยังเป็นแบบร่าง กรุณาเปิดใช้งานก่อน</p>
                        <Button color="primary" onPress={() => router.back()}>
                            กลับ
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4 md:p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Session paused/closed banner */}
                {session.status === "paused" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-100 shrink-0">
                                <Icon icon="solar:pause-circle-bold" className="text-amber-600 text-xl" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-amber-800">ปิดรับการจองคิวชั่วคราว</h3>
                                <p className="text-sm text-amber-600">ไม่รับการจองคิวใหม่ แต่ยังสามารถจัดการคิวที่มีอยู่ได้</p>
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
                                <h3 className="font-semibold text-rose-800">Session ปิดแล้ว</h3>
                                <p className="text-sm text-rose-600">Session นี้ถูกปิดแล้ว แต่ยังสามารถจัดการคิวที่ค้างอยู่ได้</p>
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
                        <h1 className="text-xl font-bold text-slate-800">{session.title}</h1>
                        <p className="text-slate-500 text-sm">
                            ห้อง {session.classroom?.name} • PIN: <span className="font-mono font-bold text-blue-600">{session.pin_code}</span>
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
                        {isPausedAfterComplete ? "รอเคลียร์งาน" : isWorkerOnline ? "กำลังรับงาน" : "ไม่ได้รับงาน"}
                    </Chip>
                </div>

                {/* Worker Settings Card */}
                {!isWorkerOnline ? (
                    <Card className="shadow-lg border-0">
                        <CardHeader className="px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-100">
                                    <Icon icon="solar:user-check-bold" className="text-blue-600 text-xl" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-800">ตั้งค่าการรับงาน</h2>
                                    <p className="text-sm text-slate-500">เลือกประเภทงานที่ต้องการรับ</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardBody className="p-6">
                            <div className="space-y-4">
                                <div className="flex flex-col gap-3">
                                    <Checkbox
                                        isSelected={workerPreferences.accept_grading}
                                        onValueChange={(value) =>
                                            setWorkerPreferences({ ...workerPreferences, accept_grading: value })
                                        }
                                        classNames={{
                                            label: "text-slate-700",
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon icon="solar:clipboard-check-bold" className="text-emerald-500" />
                                            <span>รับตรวจงาน</span>
                                        </div>
                                    </Checkbox>
                                    <Checkbox
                                        isSelected={workerPreferences.accept_help}
                                        onValueChange={(value) =>
                                            setWorkerPreferences({ ...workerPreferences, accept_help: value })
                                        }
                                        classNames={{
                                            label: "text-slate-700",
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon icon="solar:hand-shake-bold" className="text-amber-500" />
                                            <span>รับช่วยเหลือ</span>
                                        </div>
                                    </Checkbox>
                                </div>

                                {/* Notification Permission Info */}
                                {notificationSupported && permissionStatus !== "granted" && (
                                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                                        <div className="flex items-start gap-2">
                                            <Icon icon="solar:bell-bold" className="text-amber-500 text-lg mt-0.5" />
                                            <div className="text-sm">
                                                <p className="font-medium text-amber-700">เปิดการแจ้งเตือน</p>
                                                <p className="text-amber-600 text-xs mt-0.5">
                                                    เมื่อกดเริ่มรับงาน ระบบจะขออนุญาตส่งการแจ้งเตือนเมื่อมีงานใหม่ แม้ปิดหน้าจอก็ได้รับแจ้งเตือน
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
                                                <p className="font-medium text-red-700">การแจ้งเตือนถูกปิด</p>
                                                <p className="text-red-600 text-xs mt-0.5">
                                                    กรุณาเปิดการแจ้งเตือนในการตั้งค่าเบราว์เซอร์เพื่อรับการแจ้งเตือนเมื่อมีงานใหม่
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
                                >
                                    เริ่มรับงาน
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                ) : (
                    <>
                        {/* Current Task Card */}
                        <Card className="shadow-lg border-0">
                            <CardHeader className="px-4 py-2 border-b border-slate-100">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${currentBooking ? "bg-emerald-100" : "bg-slate-100"}`}>
                                            <Icon 
                                                icon={currentBooking ? "solar:clipboard-check-bold" : "solar:hourglass-bold"} 
                                                className={`text-xl ${currentBooking ? "text-emerald-600" : "text-slate-400"}`} 
                                            />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-800">
                                                {currentBooking ? "งานปัจจุบัน" : "รอรับงาน"}
                                            </h2>
                                            <p className="text-sm text-slate-500">
                                                {currentBooking 
                                                    ? `โต๊ะ ${currentBooking.desk_number}`
                                                    : "ระบบจะยิงงานมาให้อัตโนมัติ"}
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
                                        isDisabled={isPausedAfterComplete}
                                    >
                                        {isPausedAfterComplete ? "รอเครียร์งาน..." : "หยุดรับงาน"}
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
                                                คุณหยุดรับงานใหม่แล้ว หลังจากทำงานนี้เสร็จจะออกจากการรับงานอัตโนมัติ
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {currentBooking ? (
                                    <div className="space-y-6">
                                        {/* Booking Info */}
                                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4">
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
                                                    {currentBooking.booking_type === "grading" ? "ตรวจงาน" : "ช่วยเหลือ"}
                                                </Chip>
                                                <span className="text-sm text-slate-500">
                                                    คิวที่ {currentBooking.queue_number}
                                                </span>
                                            </div>

                                            {currentBooking.is_late_booking && (
                                                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                                                    <div className="flex items-start gap-2 text-rose-700">
                                                        <Icon icon="solar:danger-triangle-bold" className="text-lg mt-0.5 shrink-0" />
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-sm">นักศึกษาคนนี้จองหลัง Cutoff</p>
                                                            <p className="text-xs mt-0.5 text-rose-600">
                                                                {currentBooking.late_reason || "งานนี้ต้องพิจารณาเกณฑ์คะแนนหลัง cutoff"}
                                                            </p>
                                                            {session?.cutoff_at && (
                                                                <p className="text-xs mt-0.5 text-rose-600">
                                                                    เวลา cutoff: {formatCutoffDateTime(session.cutoff_at)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mb-5 flex items-center justify-center gap-3">
                                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg">
                                                    <span className="text-3xl font-bold text-blue-600">
                                                        {currentBooking.desk_number}
                                                    </span>
                                                </div>
                                                <div>
                                                <p className="text-md font-semibold text-slate-800">
                                                    โต๊ะ {currentBooking.desk_number}
                                                </p>
                                                {currentBooking.zone && (
                                                    // <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700">
                                                    //     <Icon icon="solar:map-point-bold" className="text-base" />
                                                        <span className="text-sm text-slate-500">{currentBooking.zone.name}</span>
                                                    // </div>
                                                )}
                                                </div>
                                            </div>

                                            {/* ─── Mini Room Map + Direction Guide ─── */}
                                            {deskLayout.length > 0 && (
                                                <div className="rounded-xl overflow-hidden border border-white/60 bg-white/50 mb-4">
                                                    {/* Direction banner – only show when we know previous desk */}
                                                    {directionGuide && (
                                                        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500 text-white text-xs text-center font-normal">
                                                            {/* <Icon icon={directionGuide.icon} className="text-lg shrink-0" /> */}
                                                            <span className="text-center">
                                                                จากโต๊ะ {previousDeskNumber} → โต๊ะ {currentBooking.desk_number}{" "}
                                                                <span className="font-normal">
                                                                    ({directionGuide.label},{" "}{directionGuide.distance})
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
                                                    <div className="flex items-center gap-4 px-3 pb-2 text-xs text-slate-500">
                                                        <span className="flex items-center gap-1">
                                                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
                                                            โต๊ะนี้
                                                        </span>
                                                        {previousDeskNumber && String(previousDeskNumber) !== String(currentBooking.desk_number) && (
                                                            <span className="flex items-center gap-1">
                                                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-300" />
                                                                โต๊ะก่อนหน้า
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


                                            <div className="bg-white rounded-xl p-3 space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <Avatar
                                                        name={currentBooking.student?.full_name || "Student"}
                                                        size="sm"
                                                        className="bg-gradient-to-br from-blue-400 to-indigo-500"
                                                    />
                                                    <div>
                                                        <p className="font-medium text-slate-800">
                                                            {currentBooking.student?.full_name || "-"}
                                                        </p>
                                                        <p className="text-sm text-slate-500">
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
                                        <div className="flex gap-3">
                                            <Button
                                                color="success"
                                                size="lg"
                                                className="flex-1"
                                                startContent={<Icon icon="solar:check-circle-bold" className="text-xl" />}
                                                onPress={initializeCompleteForm}
                                            >
                                                เสร็จสิ้น
                                            </Button>
                                            <Button
                                                color="warning"
                                                variant="flat"
                                                size="lg"
                                                startContent={<Icon icon="solar:skip-next-bold" className="text-xl" />}
                                                onPress={() => setIsSkipModalOpen(true)}
                                            >
                                                ข้าม
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 mb-4">
                                            <Spinner size="lg" color="primary" />
                                        </div>
                                        <p className="text-lg font-medium text-slate-600 mb-1">
                                            กำลังรอรับงาน...
                                        </p>
                                        <p className="text-sm text-slate-400">
                                            เมื่อมีนักศึกษาจองคิว ระบบจะยิงงานมาให้อัตโนมัติ
                                        </p>
                                    </div>
                                )}
                            </CardBody>
                        </Card>

                        {/* Worker Preferences Card */}
                        <Card className="shadow-md border-0">
                            <CardBody className="p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">ประเภทงานที่รับ:</span>
                                    <div className="flex gap-2">
                                        {workerPreferences.accept_grading && (
                                            <Chip size="sm" color="success" variant="flat" startContent={<Icon icon="solar:clipboard-check-bold" className="mr-1" />}>
                                                {/* <Icon icon="solar:clipboard-check-bold" className="mr-1" /> */}
                                                ตรวจงาน
                                            </Chip>
                                        )}
                                        {workerPreferences.accept_help && (
                                            <Chip size="sm" color="warning" variant="flat" startContent={<Icon icon="solar:hand-shake-bold" className="mr-1" />}>
                                                ช่วยเหลือ
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
                            <span>บันทึกผลการตรวจ</span>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <div className="space-y-4">
                            {currentBooking?.booking_type === "grading" && session?.linkedAssignment && (
                                <>
                                    {/* Sub-items scoring */}
                                    {hasSubItems ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-medium text-slate-700">
                                                    กรอกคะแนนรายข้อ
                                                </label>
                                                <Chip size="sm" color={totalScoredItemsCount === subItems.length ? "success" : "primary"} variant="flat">
                                                    ลงแล้ว {totalScoredItemsCount}/{subItems.length} ข้อ
                                                </Chip>
                                            </div>
                                            
                                            {isLoadingScores ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Spinner size="lg" />
                                                </div>
                                            ) : (
                                                <div className="space-y-3 bg-slate-50 p-4 rounded-xl">
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
                                                                key={item.id} 
                                                                className={`flex items-center gap-3 p-3 rounded-lg border ${
                                                                    isLocked 
                                                                        ? 'bg-amber-50 border-amber-200' 
                                                                        : 'bg-white border-slate-200'
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
                                                                    <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                                                                    {isLocked && existingScore?.graded_by && (
                                                                        <p className="text-xs text-amber-600 mt-0.5">
                                                                            ลงโดย {existingScore.graded_by.display_name}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col items-end gap-2">
                                                                    {isLocked ? (
                                                                        <>
                                                                            <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 rounded-lg">
                                                                                <Icon icon="solar:lock-bold" className="text-amber-600" />
                                                                                <span className="font-bold text-amber-700">{existingScore?.score}</span>
                                                                            </div>
                                                                            <span className="text-sm text-slate-500">/ {item.max_score}</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <div className="flex items-center gap-2">
                                                                                <Input
                                                                                    type="number"
                                                                                    placeholder="0"
                                                                                    size="sm"
                                                                                    value={currentScore}
                                                                                    onValueChange={(value) => {
                                                                                        setCompleteForm(prev => ({
                                                                                            ...prev,
                                                                                            sub_item_scores: prev.sub_item_scores.map(s =>
                                                                                                s.sub_item_id === item.id
                                                                                                    ? { ...s, score: value }
                                                                                                    : s
                                                                                            ),
                                                                                        }));
                                                                                    }}
                                                                                    classNames={{
                                                                                        base: "w-20",
                                                                                        input: "text-center font-semibold",
                                                                                        inputWrapper: "bg-white border-slate-200",
                                                                                    }}
                                                                                    variant="bordered"
                                                                                    min={0}
                                                                                    max={item.max_score}
                                                                                />
                                                                                <span className="text-sm text-slate-500">/ {item.max_score}</span>
                                                                            </div>
                                                                            {/* Quick score buttons */}
                                                                            <div className="flex justify-end gap-1">
                                                                                {(() => {
                                                                                    const max = item.max_score;
                                                                                    const half = Math.floor(max / 2);
                                                                                    const options = [0, half, max];
                                                                                    return options.map(score => (
                                                                                        <Button
                                                                                            key={score}
                                                                                            size="sm"
                                                                                            variant={currentScore === score.toString() ? "solid" : "flat"}
                                                                                            color={currentScore === score.toString() ? "primary" : "default"}
                                                                                            className={`min-w-[2.5rem] h-7 text-xs ${currentScore === score.toString() 
                                                                                                ? "bg-blue-500 text-white font-semibold" 
                                                                                                : "bg-slate-100 font-medium"
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
                                                    <span className="font-medium text-blue-700">คะแนนที่จะลงครั้งนี้ ({newScoredItemsCount} ข้อ)</span>
                                                    <span className="text-2xl font-bold text-blue-600">
                                                        {totalSubItemScore.toFixed(1)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Single score - no sub-items */
                                        <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                                            <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                                                <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                                                    <Icon icon="solar:medal-star-bold" className="text-xl text-amber-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-700">คะแนนรวม</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        value={completeForm.score}
                                                        onValueChange={(value) => setCompleteForm({ ...completeForm, score: value })}
                                                        min={0}
                                                        max={maxScore}
                                                        className="w-20"
                                                        size="sm"
                                                        variant="bordered"
                                                        classNames={{
                                                            input: "text-center font-semibold",
                                                            inputWrapper: "bg-white border-slate-200",
                                                        }}
                                                    />
                                                    <span className="text-sm text-slate-500">/ {maxScore}</span>
                                                </div>
                                            </div>
                                            {/* Quick score buttons */}
                                            <div className="flex justify-end gap-2">
                                                {(() => {
                                                    const max = maxScore;
                                                    const half = Math.floor(max / 2);
                                                    const options = [0, half, max];
                                                    return options.map(score => (
                                                        <Button
                                                            key={score}
                                                            size="sm"
                                                            variant={completeForm.score === score.toString() ? "solid" : "flat"}
                                                            color={completeForm.score === score.toString() ? "primary" : "default"}
                                                            className={completeForm.score === score.toString() 
                                                                ? "bg-blue-500 text-white font-semibold min-w-[3rem]" 
                                                                : "bg-white border border-slate-200 font-medium min-w-[3rem]"
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
                            {currentBooking?.booking_type === "help" && (
                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                    <div className="flex items-center gap-2 text-amber-700">
                                        <Icon icon="solar:info-circle-bold" className="text-xl" />
                                        <span className="text-sm">การขอความช่วยเหลือไม่ต้องลงคะแนน</span>
                                    </div>
                                </div>
                            )}

                            <Input
                                label="ความคิดเห็น/หมายเหตุ (ถ้ามี)"
                                placeholder="เพิ่มความคิดเห็นหรือหมายเหตุ..."
                                value={completeForm.score_comment}
                                onValueChange={(value) => setCompleteForm({ ...completeForm, score_comment: value })}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={() => setIsCompleteModalOpen(false)}>
                            ยกเลิก
                        </Button>
                        <Button 
                            color="success" 
                            onPress={handleCompleteBooking}
                            isLoading={isCompleting}
                        >
                            บันทึกผล
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
                            <span>ข้ามคิว</span>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <p className="text-slate-600 mb-4">
                            คุณแน่ใจหรือไม่ที่จะข้ามคิวนี้? (เช่น นักศึกษาไม่อยู่ที่โต๊ะ)
                        </p>
                        <Input
                            label="เหตุผล (ถ้ามี)"
                            placeholder="ไม่พบนักศึกษา..."
                            labelPlacement="outside"
                            variant="bordered"
                            value={skipReason}
                            onValueChange={setSkipReason}
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={() => setIsSkipModalOpen(false)}>
                            ยกเลิก
                        </Button>
                        <Button 
                            color="warning" 
                            onPress={handleSkipBooking}
                            isLoading={isSkipping}
                        >
                            ข้ามคิว
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
