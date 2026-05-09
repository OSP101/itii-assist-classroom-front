"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
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
import { io, Socket } from "@/services/realtime-socket";
import QRCode from "react-qr-code";

import { API_BASE_URL } from "@/config/api";
import { Divider } from "@heroui/divider";
import { Skeleton } from "@heroui/skeleton";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

interface DeskBooking {
    id: number;
    queue_number: number;
    booking_type: 'grading' | 'help';
    status: string;
    student_name?: string;
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
        title: string;
        pin_code: string;
        status: string;
        is_cutoff_enabled?: boolean;
        cutoff_at?: string | null;
        cutoff_note?: string;
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

export default function ProjectorViewPage() {
    const params = useParams();
    const sessionId = params.sessionId as string;

    const [data, setData] = useState<ProjectorViewData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [sidebarPosition, setSidebarPosition] = useState<'right' | 'bottom'>('right');

    // Desk action modal states
    const [selectedDesk, setSelectedDesk] = useState<DeskWithStatus | null>(null);
    const [isDeskModalOpen, setIsDeskModalOpen] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
	const [isCutoffConfirmOpen, setIsCutoffConfirmOpen] = useState(false);

    // Status toggle states
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [isTogglingCutoff, setIsTogglingCutoff] = useState(false);

    // Real-time clock
    const [currentTime, setCurrentTime] = useState(new Date());

    const socketRef = useRef<Socket | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch data
    const fetchData = useCallback(async () => {
        try {
            // Use public route without auth
            const response = await fetch(`${API_BASE_URL}/queue/sessions/${sessionId}/desk-statuses`);
            const result = await response.json();

            if (result.success) {
                setData(result.data);
                setError(null);
            } else {
                setError(result.error?.message || "ไม่สามารถโหลดข้อมูลได้");
            }
        } catch (err) {
            console.error("Error fetching data:", err);
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Socket connection for real-time updates
    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            console.log("Socket connected");
            socket.emit("join-queue", sessionId);
        });

        // Listen for booking updates
        socket.on("new-booking", () => {
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
                    title: "Session ปิดแล้ว",
                    description: "การจองคิวถูกปิด",
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

        socket.on("pin-changed", () => {
            fetchData();
        });

        socketRef.current = socket;

        return () => {
            socket.emit("leave-queue", sessionId);
            socket.disconnect();
        };
    }, [sessionId, fetchData]);

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
                    title: newStatus === 'paused' ? "หยุดรับคิวแล้ว" : "เปิดรับคิวแล้ว",
                    description: newStatus === 'paused'
                        ? "นักศึกษาจะไม่สามารถจองคิวใหม่ได้"
                        : "นักศึกษาสามารถจองคิวได้อีกครั้ง",
                    color: newStatus === 'paused' ? "warning" : "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                fetchData();
            } else {
                addToast({
                    title: "เกิดข้อผิดพลาด",
                    description: result.error?.message || "ไม่สามารถเปลี่ยนสถานะได้",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            console.error("Error toggling status:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถเปลี่ยนสถานะได้",
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
                    title: nextEnabled ? "เปิด Cutoff แล้ว" : "ปิด Cutoff แล้ว",
                    description: nextEnabled
                        ? "การจองใหม่จากนี้จะถูกติดป้าย Late Booking"
                        : "การจองใหม่จะไม่ถูกติดป้าย Late Booking",
                    color: nextEnabled ? "warning" : "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                fetchData();
            } else {
                addToast({
                    title: "เกิดข้อผิดพลาด",
                    description: result.error?.message || "ไม่สามารถเปลี่ยนสถานะ Cutoff ได้",
                    color: "danger",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            console.error("Error toggling cutoff:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถเปลี่ยนสถานะ Cutoff ได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsTogglingCutoff(false);
        }
    };

    // Handle desk click
    const handleDeskClick = (desk: DeskWithStatus) => {
        // Only open modal if desk has active booking
        if (desk.booking && (desk.status.grading_status === 'waiting' || desk.status.grading_status === 'in_progress' || desk.status.help_status !== 'none')) {
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
                    title: "ยกเลิกการจองสำเร็จ",
                    description: `โต๊ะ ${selectedDesk.number} ถูกล้างแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsDeskModalOpen(false);
                setSelectedDesk(null);
                fetchData();
            } else {
                addToast({
                    title: "ยกเลิกไม่สำเร็จ",
                    description: result.error?.message || "เกิดข้อผิดพลาด",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            console.error("Error cancelling booking:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถยกเลิกการจองได้",
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
        return "bg-slate-200"; // ยังไม่ได้ทำอะไร - เปลี่ยนเป็นสีอ่อน
    };

    // Get desk border based on type
    const getDeskBorder = (desk: DeskWithStatus) => {
        if (desk.type === "teacher") {
            return "border-4 border-purple-400";
        }
        if (desk.type === "computer") {
            return "border-2 border-cyan-400";
        }
        return "border border-slate-500";
    };

    // Get booking URL for QR code
    const getBookingUrl = () => {
        return `${FRONTEND_URL}/queue/book?pin=${data?.session.pin_code}`;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-100 p-4 flex flex-col gap-4">
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
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                        <Skeleton className="w-full h-[62vh] rounded-lg" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
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

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Icon icon="solar:danger-triangle-bold" className="text-6xl text-red-400 mb-4" />
                    <h2 className="text-xl font-bold text-slate-800 mb-2">เกิดข้อผิดพลาด</h2>
                    <p className="text-slate-500 mb-4">{error || "ไม่สามารถโหลดข้อมูลได้"}</p>
                    <Button color="primary" onPress={() => fetchData()}>
                        ลองใหม่
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
        <div ref={containerRef} className="min-h-screen bg-slate-100 p-4 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{data.session.title}</h1>
                        <p className="text-slate-500">
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
                            หยุดรับคิว
                        </Chip>
                    )}
                    {isClosed && (
                        <Chip
                            size="lg"
                            color="danger"
                            variant="flat"
                            startContent={<Icon icon="solar:stop-circle-bold" />}
                        >
                            ปิดแล้ว
                        </Chip>
                    )}
                    {isCutoffEnabled && (
                        <Chip
                            size="lg"
                            color="warning"
                            variant="flat"
                            startContent={<Icon icon="solar:danger-triangle-bold" />}
                        >
                            Cutoff เปิดอยู่
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
                            <p>รอตรวจ: {data.queueStats.grading_waiting}</p>
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
                            รอช่วยเหลือ: {data.queueStats.help_waiting}
                        </Chip>
                    </div>



                    {/* Zoom Controls */}
                    <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-200 shadow-sm">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            className="bg-slate-100 text-slate-700 text-2xl"
                            onPress={() => setZoom((prev) => Math.max(prev - 0.05, 0.3))}
                        >
                            {/* <Icon icon="solar:minus-bold" /> */} -
                        </Button>
                        <span className="text-slate-700 text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            className="bg-slate-100 text-slate-700 text-2xl"
                            onPress={() => setZoom((prev) => Math.min(prev + 0.05, 2))}
                        >
                            {/* <Icon icon="solar:add-bold" /> */} +
                        </Button>
                    </div>



                    {/* Toggle Queue Status */}
                    <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 border border-slate-200 shadow-sm">
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
                            {isClosed ? 'ปิดแล้ว' : isPaused ? 'หยุดรับคิว' : 'เปิดรับคิว'}
                        </span>
                    </div>

                    {/* Cutoff Toggle */}
                    <Button
                        size="lg"
                        variant="flat"
                        className={`border shadow-sm ${isCutoffEnabled
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : 'bg-white border-slate-200 text-slate-700'}`}
                        isLoading={isTogglingCutoff}
                        isDisabled={isClosed || isTogglingCutoff}
                        onPress={() => setIsCutoffConfirmOpen(true)}
                        startContent={<Icon icon={isCutoffEnabled ? "solar:lock-bold" : "solar:lock-unlocked-bold"} className="text-lg" />}
                    >
                        {isCutoffEnabled ? 'ปิด Cutoff' : 'เปิด Cutoff'}
                    </Button>

                    {/* Layout Toggle */}
                    <Button
                        isIconOnly
                        size="lg"
                        variant="flat"
                        className="bg-white text-slate-700 border border-slate-200 shadow-sm"
                        onPress={() => setSidebarPosition((prev) => prev === 'right' ? 'bottom' : 'right')}
                        title={sidebarPosition === 'right' ? 'ย้ายแถบข้อมูลไปด้านล่าง' : 'ย้ายแถบข้อมูลไปด้านขวา'}
                    >
                        <Icon icon={sidebarPosition === 'right' ? "solar:align-bottom-bold" : "solar:align-right-bold"} className="text-xl" />
                    </Button>

                    {/* Fullscreen */}
                    <Button
                        isIconOnly
                        size="lg"
                        variant="flat"
                        className="bg-white text-slate-700 border border-slate-200 shadow-sm"
                        onPress={toggleFullscreen}
                    >
                        <Icon icon={isFullscreen ? "solar:quit-full-screen-bold" : "solar:full-screen-bold"} className="text-xl" />
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 flex gap-4 ${sidebarPosition === 'bottom' ? 'flex-col' : 'flex-row'}`}>
                {/* Room Layout */}
                <div className="flex-1 bg-white rounded-2xl p-4 overflow-auto border border-slate-200 shadow-sm">
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
                            return (
                                <div
                                    key={desk.id}
                                    className={`
                                        absolute flex items-center justify-center rounded-lg
                                        ${getDeskColor(desk)} ${getDeskBorder(desk)}
                                        transition-all duration-300 
                                        ${hasActiveBooking ? 'cursor-pointer hover:ring-2 hover:ring-red-400 hover:ring-offset-2' : 'cursor-default'}
                                    `}
                                    style={{
                                        left: desk.x,
                                        top: desk.y,
                                        width: isTeacher ? 120 : 60,
                                        height: isTeacher ? 50 : 60,
                                    }}
                                    title={isTeacher ? `โต๊ะอาจารย์ ${desk.number}` : `โต๊ะ ${desk.number}${desk.label ? ` (${desk.label})` : ""}${hasActiveBooking ? ' - คลิกเพื่อจัดการ' : ''}`}
                                    onClick={() => handleDeskClick(desk)}
                                >
                                    <span className={`font-bold ${isTeacher ? "text-sm text-black" : "text-lg"} ${desk.status.grading_status === "not_started" && desk.status.help_status === "none" ? "text-slate-700" : "text-white"}`}>
                                        {isTeacher ? `อาจารย์ ${desk.number}` : desk.number}
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
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar - QR Code & Legend */}
                {sidebarPosition === 'bottom' ? (
                    /* ── Bottom layout: compact single-row strip ── */
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5 flex items-center gap-6">
                        {/* QR / Status section */}
                        {isClosed ? (
                            <div className="flex items-center gap-3 text-rose-600 shrink-0">
                                <Icon icon="solar:stop-circle-bold" className="text-3xl" />
                                <div>
                                    <p className="font-bold text-sm">ปิดแล้ว</p>
                                    <p className="text-xs text-rose-500">การจองคิวถูกปิดแล้ว</p>
                                </div>
                            </div>
                        ) : isPaused ? (
                            <div className="flex items-center gap-3 text-amber-600 shrink-0">
                                <Icon icon="solar:pause-circle-bold" className="text-3xl" />
                                <div>
                                    <p className="font-bold text-sm">หยุดรับคิว</p>
                                    <p className="text-xs text-amber-500">ไม่รับการจองคิวใหม่ชั่วคราว</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4 shrink-0">
                                <QRCode value={getBookingUrl()} size={200} bgColor="#ffffff" fgColor="#000000" level="L" />
                                <div className="bg-blue-100 rounded-xl px-4 py-2">
                                    <span className="text-sm text-slate-600">PIN Code</span>
                                    <p className="text-4xl font-mono font-bold text-blue-700 text-center">{data.session.pin_code}</p>

                                    <Divider className="my-3" />
                                    <p className="font-mono text-slate-800">{`itii.osp101.dev/queue/book`}</p>
                                </div>
                            </div>
                        )}

                        {/* Divider */}
                        <div className="w-px h-12 bg-slate-200 shrink-0" />

                        {/* Legend - compact inline */}
                        <div className="flex items-center gap-4 flex-wrap flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-slate-200 border border-slate-300 shrink-0" />
                                <span className="text-slate-500 text-md whitespace-nowrap">ยังไม่ได้ตรวจ</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-blue-300 border border-blue-400 shrink-0" />
                                <span className="text-slate-500 text-md whitespace-nowrap">รอตรวจ</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-blue-500 animate-pulse border border-blue-600 shrink-0" />
                                <span className="text-slate-500 text-md whitespace-nowrap">กำลังตรวจ</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-emerald-500 border border-emerald-600 shrink-0" />
                                <span className="text-slate-500 text-md whitespace-nowrap">ตรวจเสร็จ</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-amber-300 border border-amber-400 shrink-0" />
                                <span className="text-slate-500 text-md whitespace-nowrap">รอช่วยเหลือ</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-amber-500 animate-pulse border border-amber-600 shrink-0" />
                                <span className="text-slate-500 text-md whitespace-nowrap">กำลังช่วยเหลือ</span>
                            </div>

                            {/* Desk types inline */}
                            <div className="w-px h-12 bg-slate-200 shrink-0" />
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-slate-200 border-2 border-cyan-400 shrink-0" />
                                <span className="text-slate-500 text-md whitespace-nowrap">คอมฯ</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 rounded bg-slate-200 border-[3px] border-purple-400 shrink-0" />
                                <span className="text-slate-500 text-md whitespace-nowrap">โต๊ะอาจารย์</span>
                            </div>

                            <div className="w-px h-12 bg-slate-200 shrink-0" />

                            <div className="bg-white rounded-xl max-w-full px-4 py-2 border border-slate-200 shadow-sm flex items-center gap-2 justify-center">
                                {/* <Icon icon="solar:clock-circle-bold" className="text-slate-400 text-lg" /> */}
                                <span className="font-mono text-2xl font-semibold text-slate-700 tabular-nums">
                                    {currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                </span>
                            </div>
                        </div>

                    </div>
                ) : (
                    /* ── Right sidebar layout (original) ── */
                    <div className="w-72 flex flex-col gap-4">
                        {/* QR Code - Hide when paused or closed */}
                        {isClosed ? (
                            <div className="bg-rose-50 rounded-2xl p-6 text-center border-2 border-rose-200">
                                <Icon icon="solar:stop-circle-bold" className="text-6xl text-rose-500 mb-3" />
                                <h3 className="text-lg font-bold text-rose-700 mb-1">ปิดแล้ว</h3>
                                <p className="text-sm text-rose-600">
                                    การจองคิวถูกปิดแล้ว
                                </p>
                            </div>
                        ) : isPaused ? (
                            <div className="bg-amber-50 rounded-2xl p-6 text-center border-2 border-amber-200 justify-center">
                                <Icon icon="solar:pause-circle-bold" className="text-6xl text-amber-500 mb-3 text-center w-full" />
                                <h3 className="text-lg font-bold text-amber-700 mb-1">หยุดรับคิว</h3>
                                <p className="text-sm text-amber-600">
                                    ไม่รับการจองคิวใหม่ชั่วคราว
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl p-6 text-center">
                                <div className="mb-3">
                                    <QRCode
                                        value={getBookingUrl()}
                                        size={180}
                                        className="mx-auto"
                                        bgColor="#ffffff" fgColor="#000000" level="L"
                                    />
                                </div>
                                <div className="bg-blue-100 rounded-xl px-4 py-2">
                                    <span className="text-sm text-slate-600">PIN Code</span>

                                    <p className="text-4xl font-mono font-bold text-blue-700">{data.session.pin_code}</p>
                                </div>
                                <div>
                                    <Divider className="my-3" />
                                    <p className="font-mono text-slate-800">{`${process.env.NEXT_PUBLIC_FRONTEND_URL}/queue/book`}</p>
                                </div>
                            </div>
                        )}

                        {/* Legend */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                            <h3 className="text-slate-800 font-semibold mb-3">สัญลักษณ์</h3>
                            <div className="space-y-2 grid grid-cols-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-slate-200 border border-slate-300" />
                                    <span className="text-slate-600 text-sm">ยังไม่ได้ตรวจ</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-emerald-500 border border-emerald-600" />
                                    <span className="text-slate-600 text-sm">ตรวจเสร็จแล้ว</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-blue-300 border border-blue-400" />
                                    <span className="text-slate-600 text-sm">รอตรวจงาน</span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-amber-300 border border-amber-400" />
                                    <span className="text-slate-600 text-sm">รอช่วยเหลือ</span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-blue-500 animate-pulse border border-blue-600" />
                                    <span className="text-slate-600 text-sm">กำลังตรวจ</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-amber-500 animate-pulse border border-amber-600" />
                                    <span className="text-slate-600 text-sm">กำลังช่วยเหลือ</span>
                                </div>
                            </div>

                            {/* Desk types */}
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <h4 className="text-slate-500 text-sm mb-2">ประเภทโต๊ะ</h4>
                                <div className="space-y-2 grid grid-cols-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-slate-200 border-2 border-cyan-400" />
                                        <span className="text-slate-600 text-sm">คอมพิวเตอร์</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-slate-200 border-4 border-purple-400" />
                                        <span className="text-slate-600 text-sm">โต๊ะอาจารย์</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Clock */}
                        <div className="bg-white rounded-xl px-4 py-2 border border-slate-200 shadow-sm flex items-center gap-2 justify-center">
                            {/* <Icon icon="solar:clock-circle-bold" className="text-slate-400 text-lg" /> */}
                            <span className="font-mono text-2xl font-semibold text-slate-700 tabular-nums">
                                {currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
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
                        <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
                            <Icon icon="solar:square-bold" className="text-xl text-white" />
                        </div>
                        <span>โต๊ะ {selectedDesk?.number}</span>
                    </ModalHeader>
                    <ModalBody>
                        {selectedDesk?.booking && (
                            <div className="space-y-4">
                                <div className="bg-slate-50 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-slate-600 text-sm">คิวที่</span>
                                        <span className="text-2xl font-bold text-blue-600">
                                            {selectedDesk.booking.queue_number}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-slate-600 text-sm">ประเภท</span>
                                        <Chip
                                            size="sm"
                                            color={selectedDesk.booking.booking_type === 'grading' ? 'primary' : 'warning'}
                                            variant="flat"
                                        >
                                            {selectedDesk.booking.booking_type === 'grading' ? 'ตรวจงาน' : 'ขอความช่วยเหลือ'}
                                        </Chip>
                                    </div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-slate-600 text-sm">สถานะ</span>
                                        <span className="text-slate-800 font-medium">{selectedDesk.booking.status}</span>
                                    </div>
                                    {selectedDesk.booking.student_name && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 text-sm">นักศึกษา</span>
                                            <span className="text-slate-800">{selectedDesk.booking.student_name}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                    <div className="flex items-start gap-2">
                                        <Icon icon="solar:danger-triangle-bold" className="text-amber-600 text-lg mt-0.5" />
                                        <div className="text-sm text-amber-700">
                                            <p className="font-medium">ยกเลิกการจองนี้?</p>
                                            <p className="mt-1">ใช้เมื่อมีปัญหาหรือข้อผิดพลาดเท่านั้น โต๊ะจะว่างและนักศึกษาสามารถจองใหม่ได้</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setIsDeskModalOpen(false)}>
                            ปิด
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleCancelDeskBooking}
                            isLoading={isCancelling}
                            className="bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                            startContent={<Icon icon="solar:trash-bin-trash-bold" />}
                        >
                            ยกเลิกการจอง
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={isCutoffConfirmOpen} onClose={() => setIsCutoffConfirmOpen(false)}>
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2">
                        <div className="p-2 bg-gradient-to-br from-rose-400 to-pink-500 rounded-lg shadow-lg shadow-rose-500/30">
                            <Icon icon="solar:danger-triangle-bold" className="text-xl text-white" />
                        </div>
                        <span>{nextCutoffEnabled ? "ยืนยันเปิด Cutoff" : "ยืนยันปิด Cutoff"}</span>
                    </ModalHeader>
                    <ModalBody>
                        <div className="space-y-3 text-sm text-slate-700">
                            <p>
                                {nextCutoffEnabled
                                    ? "หลังจากนี้การจองใหม่ทั้งหมดจะถูกติดป้ายว่า Late Booking"
                                    : "หลังจากนี้การจองใหม่จะไม่ถูกติดป้าย Late Booking"}
                            </p>
                            {nextCutoffEnabled && (
                                <p className="text-rose-600">
                                    แจ้งนักศึกษาให้เรียบร้อยก่อนกดยืนยันเพื่อป้องกันความสับสน
                                </p>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setIsCutoffConfirmOpen(false)}>
                            ยกเลิก
                        </Button>
                        <Button
                            color={nextCutoffEnabled ? "warning" : "success"}
                            onPress={async () => {
                                setIsCutoffConfirmOpen(false);
                                await handleToggleCutoff();
                            }}
                            isLoading={isTogglingCutoff}
                            startContent={<Icon icon={nextCutoffEnabled ? "solar:lock-bold" : "solar:lock-unlocked-bold"} />}
                        >
                            {nextCutoffEnabled ? "ยืนยันเปิด Cutoff" : "ยืนยันปิด Cutoff"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
