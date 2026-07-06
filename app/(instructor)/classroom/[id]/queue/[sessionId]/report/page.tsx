"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type ExcelJS from "exceljs";
import { addToast } from "@heroui/toast";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Pagination } from "@heroui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/popover";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { Tab, Tabs } from "@heroui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
} from "@heroui/table";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import queueService, {
    getQueueBookingStatusLabel,
    getQueueBookingTypeLabel,
    type DeskWithStatus,
    type ProjectorViewData,
    type QueueReportBooking,
    type QueueReportWorkerStat,
    type QueueSessionReport,
} from "@/services/queue.service";
import { getRealtimeSocketBaseUrl, io, type Socket } from "@/services/realtime-socket";

type ReportSnapshot = {
    report: QueueSessionReport;
    deskData: ProjectorViewData;
};

type ReportTabKey = "overview" | "ta" | "history";

type DeskVisualState =
    | "help_in_progress"
    | "help_waiting"
    | "grading_in_progress"
    | "grading_waiting"
    | "completed"
    | "idle";

type WorkerSummary = QueueReportWorkerStat & {
    assignedBookings: QueueReportBooking[];
    currentDeskNumbers: number[];
    uniqueDeskNumbers: number[];
    completedCount: number;
    skippedCount: number;
    gradingAssignedCount: number;
    helpAssignedCount: number;
    pendingAssignedCount: number;
};

function getStatusColor(status: string): "default" | "primary" | "warning" | "success" | "danger" {
    switch (status) {
        case "waiting":
            return "primary";
        case "in_progress":
            return "warning";
        case "completed":
            return "success";
        case "cancelled":
        case "no_show":
            return "danger";
        default:
            return "default";
    }
}

function getWorkerStatusColor(worker: QueueReportWorkerStat, now: Date): "default" | "primary" | "warning" | "success" | "danger" {
    if (worker.offer_paused_until) {
        const pausedUntil = new Date(worker.offer_paused_until);
        if (!Number.isNaN(pausedUntil.getTime()) && pausedUntil > now) {
            return "danger";
        }
    }

    switch (worker.status) {
        case "busy":
            return "warning";
        case "online":
            return "success";
        case "paused":
            return "danger";
        default:
            return "default";
    }
}

function sanitizeFileNameSegment(value?: string | null): string {
    return (value || "untitled")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "_")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "") || "untitled";
}

function formatExportDate(value: Date): string {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = value.getFullYear();
    return `${day}-${month}-${year}`;
}

function formatDateTime(value: string | null | undefined, isEnglish: boolean): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString(isEnglish ? "en-US" : "th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDuration(totalSeconds: number | null | undefined, isEnglish: boolean): string {
    if (!totalSeconds || totalSeconds <= 0) return "-";

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const parts: string[] = [];

    if (hours > 0) {
        parts.push(isEnglish ? `${hours} hr` : `${hours} ชม.`);
    }
    if (minutes > 0) {
        parts.push(isEnglish ? `${minutes} min` : `${minutes} นาที`);
    }
    if (seconds > 0 && (hours === 0 || minutes < 5)) {
        parts.push(isEnglish ? `${seconds} sec` : `${seconds} วินาที`);
    }

    return parts.join(" ");
}

function formatPercent(value: number | null | undefined): string {
    return `${(value || 0).toFixed(1)}%`;
}

function getWorkerStatusLabel(worker: QueueReportWorkerStat, isEnglish: boolean): string {
    if (worker.offer_paused_until) {
        const pausedUntil = new Date(worker.offer_paused_until);
        if (!Number.isNaN(pausedUntil.getTime()) && pausedUntil > new Date()) {
            return isEnglish ? "Paused from offers" : "พักรับงานอัตโนมัติ";
        }
    }

    switch (worker.status) {
        case "online":
            return isEnglish ? "Ready" : "พร้อมรับงาน";
        case "busy":
            return isEnglish ? "Busy" : "กำลังตรวจ";
        case "paused":
            return isEnglish ? "Paused" : "พักรับงาน";
        default:
            return isEnglish ? "Offline" : "ออฟไลน์";
    }
}

function buildWorkerModeLabel(worker: QueueReportWorkerStat, isEnglish: boolean): string {
    const accepts: string[] = [];
    if (worker.accept_grading) accepts.push(isEnglish ? "Grading" : "ตรวจงาน");
    if (worker.accept_help) accepts.push(isEnglish ? "Help" : "ช่วยเหลือ");
    if (accepts.length === 0) return isEnglish ? "No queue types enabled" : "ยังไม่เปิดรับประเภทงาน";
    return accepts.join(" / ");
}

function getSingleSelection(keys: unknown, fallback: string): string {
    const first = Array.from(keys as Iterable<string>)[0];
    return typeof first === "string" && first.length > 0 ? first : fallback;
}

function getDeskVisualState(desk: DeskWithStatus): DeskVisualState {
    const help = desk.status?.help_status;
    const grading = desk.status?.grading_status;

    if (help === "in_progress") return "help_in_progress";
    if (help === "waiting") return "help_waiting";
    if (grading === "in_progress") return "grading_in_progress";
    if (grading === "waiting") return "grading_waiting";
    if (grading === "completed") return "completed";
    return "idle";
}

function WorkerDeskMap({
    desks,
    highlightedDeskNumbers,
    currentDeskNumbers,
}: {
    desks: DeskWithStatus[];
    highlightedDeskNumbers: number[];
    currentDeskNumbers: number[];
}) {
    const positionedDesks = desks.filter(
        (desk) =>
            typeof desk.x === "number" &&
            typeof desk.y === "number" &&
            (desk.is_enabled || desk.type === "teacher"),
    );

    if (positionedDesks.length === 0) {
        return null;
    }

    const xs = positionedDesks.map((desk) => desk.x as number);
    const ys = positionedDesks.map((desk) => desk.y as number);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = 360;
    const height = 240;
    const pad = 34;
    const rawWidth = Math.max(...xs) - minX;
    const rawHeight = Math.max(...ys) - minY;
    const scale = Math.min(
        rawWidth > 0 ? (width - pad * 2) / rawWidth : 1,
        rawHeight > 0 ? (height - pad * 2) / rawHeight : 1,
    );
    const drawnWidth = rawWidth * scale;
    const drawnHeight = rawHeight * scale;
    const offsetX = pad + Math.max(0, (width - pad * 2 - drawnWidth) / 2);
    const offsetY = pad + Math.max(0, (height - pad * 2 - drawnHeight) / 2);

    const currentSet = new Set(currentDeskNumbers.map(String));
    const visitedSet = new Set(highlightedDeskNumbers.map(String));

    const cx = (desk: DeskWithStatus) => offsetX + ((desk.x as number) - minX) * scale;
    const cy = (desk: DeskWithStatus) => offsetY + ((desk.y as number) - minY) * scale;

    return (
        <div className="rounded-2xl bg-slate-50 p-4 sm:p-6 dark:bg-slate-950/40">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
            {positionedDesks.map((desk) => {
                const x = cx(desk);
                const y = cy(desk);
                const deskKey = String(desk.number);
                const isCurrent = currentSet.has(deskKey);
                const isVisited = visitedSet.has(deskKey);

                if (desk.type === "teacher") {
                    return (
                        <g key={`teacher-${desk.id}`}>
                            <rect x={x - 18} y={y - 6} width={36} height={12} rx={4} fill="#059669" />
                            <text x={x} y={y - 10} textAnchor="middle" fontSize="9" fill="#0f172a">
                                T
                            </text>
                        </g>
                    );
                }

                const fill = isCurrent ? "#f59e0b" : isVisited ? "#bfdbfe" : "#e2e8f0";
                const stroke = isCurrent ? "#b45309" : isVisited ? "#60a5fa" : "#cbd5e1";
                const textColor = isCurrent ? "#451a03" : isVisited ? "#1e3a8a" : "#94a3b8";

                return (
                    <g key={`desk-${desk.id}`}>
                        {isCurrent ? <circle cx={x} cy={y} r={13} fill="none" stroke="#b45309" strokeWidth="2" /> : null}
                        <rect
                            x={x - 10}
                            y={y - 7}
                            width={20}
                            height={14}
                            rx={5}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isCurrent || isVisited ? 1.5 : 1}
                        />
                        <text
                            x={x}
                            y={y + 3}
                            textAnchor="middle"
                            fontSize="8.5"
                            fontWeight={isCurrent || isVisited ? 700 : 500}
                            fill={textColor}
                        >
                            {desk.number}
                        </text>
                    </g>
                );
            })}
            </svg>
        </div>
    );
}

export default function QueueSessionReportPage() {
    const params = useParams<{ id: string; sessionId: string }>();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const t = (thai: string, english: string) => (isEnglish ? english : thai);
    const courseId = params?.id;
    const sessionId = params?.sessionId;
    const hasParams = Boolean(courseId && sessionId);

    const [taSearchQuery, setTaSearchQuery] = useState("");
    const [taWorkerFilter, setTaWorkerFilter] = useState("all");
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
    const [historyBookingTypeFilter, setHistoryBookingTypeFilter] = useState("all");
    const [historyWorkerFilter, setHistoryWorkerFilter] = useState("all");
    const [activeTab, setActiveTab] = useState<ReportTabKey>("overview");
    const [selectedWorkerId, setSelectedWorkerId] = useState("all");
    const [bookingPage, setBookingPage] = useState(1);
    const [bookingsPerPage, setBookingsPerPage] = useState("10");
    const [isExporting, setIsExporting] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const isMountedRef = useRef(true);
    const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<unknown>(null);

    const fetchSnapshot = useCallback(async (background = false) => {
        if (!hasParams) return;

        if (background) {
            setIsRefreshing(true);
        } else {
            setIsInitialLoading(true);
        }

        try {
            const [report, deskData] = await Promise.all([
                queueService.getSessionReport(courseId as string, sessionId as string),
                queueService.getDeskStatuses(courseId as string, sessionId as string),
            ]);

            if (!isMountedRef.current) return;
            setSnapshot({ report, deskData });
            setError(null);
        } catch (fetchError) {
            if (!isMountedRef.current) return;
            setError(fetchError);
        } finally {
            if (!isMountedRef.current) return;
            setIsInitialLoading(false);
            setIsRefreshing(false);
        }
    }, [courseId, hasParams, sessionId]);

    const report = snapshot?.report ?? null;
    const deskData = snapshot?.deskData ?? null;
    const desks = deskData?.desks ?? [];
    const now = new Date();
    const errorMessage = error instanceof Error
        ? error.message
        : t("ไม่สามารถโหลดรีพอร์ตได้", "Unable to load the report.");

    useEffect(() => {
        isMountedRef.current = true;
        void fetchSnapshot(false);

        return () => {
            isMountedRef.current = false;
        };
    }, [fetchSnapshot]);

    // Realtime updates come primarily from the "queue-report-snapshot" push, which the
    // backend already emits for every booking/worker/session mutation. Avoid triggering
    // extra HTTP requests per event (that would duplicate server work); only fall back to
    // fetching on connect, tab focus, and a low-frequency safety-net interval.
    useEffect(() => {
        if (!hasParams) return;

        const socket = io(getRealtimeSocketBaseUrl());
        socketRef.current = socket;

        socket.on("connect", () => {
            socket.emit("join-queue", sessionId);
            void fetchSnapshot(true);
        });

        socket.on("queue-report-snapshot", (payload?: { snapshot?: ReportSnapshot }) => {
            if (!payload?.snapshot || !isMountedRef.current) return;
            setSnapshot(payload.snapshot);
            setError(null);
            setIsInitialLoading(false);
            setIsRefreshing(false);
        });

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                void fetchSnapshot(true);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        const safetyNetInterval = window.setInterval(() => {
            if (!document.hidden) {
                void fetchSnapshot(true);
            }
        }, 45000);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.clearInterval(safetyNetInterval);
            socket.off("queue-report-snapshot");
            socket.emit("leave-queue", sessionId);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [fetchSnapshot, hasParams, sessionId]);

    useEffect(() => {
        setBookingPage(1);
    }, [historySearchQuery, historyStatusFilter, historyBookingTypeFilter, historyWorkerFilter, bookingsPerPage]);

    const sortedBookings = useMemo(() => {
        return [...(report?.bookings ?? [])].sort((left, right) => {
            const diff = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
            return diff !== 0 ? diff : right.id - left.id;
        });
    }, [report?.bookings]);

    const workerSummaries = useMemo<WorkerSummary[]>(() => {
        return (report?.worker_stats ?? []).map((worker) => {
            const assignedBookings = sortedBookings.filter((booking) => booking.assigned_worker?.id === worker.user_id);
            const uniqueDeskNumbers = Array.from(
                new Set(
                    assignedBookings
                        .map((booking) => booking.desk_number)
                        .filter((deskNumber) => deskNumber !== null && deskNumber !== undefined),
                ),
            ).sort((left, right) => left - right);
            const currentDeskNumbers = Array.from(
                new Set(
                    desks
                        .filter((desk) => desk.booking?.assigned_worker?.id === worker.user_id)
                        .map((desk) => Number(desk.number))
                        .filter((deskNumber) => !Number.isNaN(deskNumber)),
                ),
            );
            const completedCount = assignedBookings.filter((booking) => booking.status === "completed").length;
            const skippedCount = assignedBookings.filter((booking) => booking.status === "no_show").length;
            const gradingAssignedCount = assignedBookings.filter((booking) => booking.booking_type === "grading").length;
            const helpAssignedCount = assignedBookings.filter((booking) => booking.booking_type === "help").length;
            const pendingAssignedCount = assignedBookings.filter(
                (booking) => booking.status === "waiting" || booking.status === "in_progress",
            ).length;

            return {
                ...worker,
                assignedBookings,
                currentDeskNumbers,
                uniqueDeskNumbers,
                completedCount,
                skippedCount,
                gradingAssignedCount,
                helpAssignedCount,
                pendingAssignedCount,
            };
        });
    }, [desks, report?.worker_stats, sortedBookings]);

    const workerSelectItems = useMemo(() => {
        return [
            { key: "all", label: t("ผู้ตรวจทั้งหมด", "All workers") },
            ...workerSummaries.map((worker) => ({
                key: String(worker.user_id),
                label: worker.full_name || `#${worker.user_id}`,
            })),
        ];
    }, [isEnglish, workerSummaries]);

    const filteredWorkers = useMemo(() => {
        const query = taSearchQuery.trim().toLowerCase();
        return workerSummaries.filter((worker) => {
            const matchesWorker = taWorkerFilter === "all" || String(worker.user_id) === taWorkerFilter;
            if (!matchesWorker) return false;
            if (!query) return true;

            const haystack = [
                worker.full_name || "",
                String(worker.user_id),
                String(worker.total_completed),
                String(worker.offer_accept_count || 0),
                String(worker.offer_reject_count || 0),
                String(worker.offer_timeout_count || 0),
                buildWorkerModeLabel(worker, isEnglish),
                worker.uniqueDeskNumbers.join(" "),
            ].join(" ").toLowerCase();

            return haystack.includes(query);
        });
    }, [isEnglish, taSearchQuery, taWorkerFilter, workerSummaries]);

    const rankedWorkers = useMemo(() => {
        return [...filteredWorkers].sort((left, right) => {
            if (right.pendingAssignedCount !== left.pendingAssignedCount) {
                return right.pendingAssignedCount - left.pendingAssignedCount;
            }
            if (right.total_completed !== left.total_completed) {
                return right.total_completed - left.total_completed;
            }
            return left.user_id - right.user_id;
        });
    }, [filteredWorkers]);

    useEffect(() => {
        if (rankedWorkers.length === 0) {
            setSelectedWorkerId("all");
            return;
        }

        if (selectedWorkerId === "all" || !rankedWorkers.some((worker) => String(worker.user_id) === selectedWorkerId)) {
            setSelectedWorkerId(String(rankedWorkers[0].user_id));
        }
    }, [rankedWorkers, selectedWorkerId]);

    const selectedWorker = rankedWorkers.find((worker) => String(worker.user_id) === selectedWorkerId) || null;

    const filteredBookings = useMemo(() => {
        const query = historySearchQuery.trim().toLowerCase();
        return sortedBookings.filter((booking) => {
            const matchesStatus = historyStatusFilter === "all" || booking.status === historyStatusFilter;
            const matchesType = historyBookingTypeFilter === "all" || booking.booking_type === historyBookingTypeFilter;
            const matchesWorker = historyWorkerFilter === "all" || String(booking.assigned_worker?.id || "") === historyWorkerFilter;
            if (!matchesStatus || !matchesType || !matchesWorker) return false;
            if (!query) return true;

            const haystack = [
                booking.student?.full_name || "",
                booking.student?.student_id || "",
                booking.assigned_worker?.full_name || "",
                booking.booking_ip || "",
                booking.booking_device || "",
                booking.booking_type,
                booking.status,
                String(booking.queue_number),
                String(booking.desk_number),
                booking.worker_note || "",
            ].join(" ").toLowerCase();

            return haystack.includes(query);
        });
    }, [historyBookingTypeFilter, historySearchQuery, sortedBookings, historyStatusFilter, historyWorkerFilter]);

    const totalBookings = sortedBookings.length;
    const completedCount = sortedBookings.filter((booking) => booking.status === "completed").length;
    const waitingCount = sortedBookings.filter((booking) => booking.status === "waiting").length;
    const inProgressCount = sortedBookings.filter((booking) => booking.status === "in_progress").length;
    const skippedCount = sortedBookings.filter((booking) => booking.status === "no_show").length;
    const timeoutCount = sortedBookings.reduce((sum, booking) => sum + (booking.timeout_count || 0), 0);
    const rejectCount = sortedBookings.reduce((sum, booking) => sum + (booking.reject_count || 0), 0);
    const gradingCount = sortedBookings.filter((booking) => booking.booking_type === "grading").length;
    const helpCount = sortedBookings.filter((booking) => booking.booking_type === "help").length;
    const activeWorkerCount = workerSummaries.filter((worker) => worker.status === "online" || worker.status === "busy").length;
    const autoPausedWorkers = workerSummaries.filter((worker) => {
        if (!worker.offer_paused_until) return false;
        const pausedUntil = new Date(worker.offer_paused_until);
        return !Number.isNaN(pausedUntil.getTime()) && pausedUntil > now;
    }).length;
    const completedLoads = workerSummaries.map((worker) => worker.total_completed);
    const maxCompleted = completedLoads.length > 0 ? Math.max(...completedLoads) : 0;
    const minCompleted = completedLoads.length > 0 ? Math.min(...completedLoads) : 0;
    const averageCompleted = completedLoads.length > 0
        ? completedLoads.reduce((sum, value) => sum + value, 0) / completedLoads.length
        : 0;

    const rejectReasonStats = report?.reject_reason_stats || [];
    const totalRejectByReason = rejectReasonStats.reduce((sum, item) => sum + (item.count || 0), 0);

    const bookingPageSize = Number(bookingsPerPage);
    const totalBookingPages = Math.max(1, Math.ceil(filteredBookings.length / bookingPageSize));
    const currentBookingPage = Math.min(bookingPage, totalBookingPages);
    const paginatedBookings = filteredBookings.slice(
        (currentBookingPage - 1) * bookingPageSize,
        currentBookingPage * bookingPageSize,
    );

    const topWorker = rankedWorkers[0] ?? null;
    const slowResponseCount = sortedBookings.filter((booking) => (booking.offer_response_seconds || 0) >= 120).length;
    const focusNotes = [
        t(
            `ตอนนี้มีงานค้างอยู่ ${waitingCount + inProgressCount} รายการ`,
            `${waitingCount + inProgressCount} entries are still active right now`,
        ),
        t(
            `ผู้ตรวจพร้อมรับงาน ${activeWorkerCount} คน และพักรับงาน ${autoPausedWorkers} คน`,
            `${activeWorkerCount} workers are available and ${autoPausedWorkers} are temporarily paused`,
        ),
        t(
            `มีงานที่ตอบรับช้ากว่า 2 นาที ${slowResponseCount} รายการ`,
            `${slowResponseCount} entries took longer than 2 minutes to accept`,
        ),
    ];

    const sessionStatus = deskData?.session?.status || "-";
    const sessionStatusColor: "default" | "success" | "warning" | "danger" =
        sessionStatus === "active" ? "success" : sessionStatus === "paused" ? "warning" : sessionStatus === "closed" ? "danger" : "default";

    type KpiColor = "warning" | "primary" | "success" | "danger";
    const kpiColorClasses: Record<KpiColor, { card: string; icon: string }> = {
        warning: {
            card: "border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-900/20",
            icon: "bg-warning-100 text-warning dark:bg-warning-500/20",
        },
        primary: {
            card: "border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20",
            icon: "bg-primary-100 text-primary dark:bg-primary-500/20",
        },
        success: {
            card: "border-success-200 bg-success-50 dark:border-success-800 dark:bg-success-900/20",
            icon: "bg-success-100 text-success dark:bg-success-500/20",
        },
        danger: {
            card: "border-danger-200 bg-danger-50 dark:border-danger-800 dark:bg-danger-900/20",
            icon: "bg-danger-100 text-danger dark:bg-danger-500/20",
        },
    };
    const kpiCards: Array<{ key: string; label: string; value: number; icon: string; color: KpiColor }> = [
        { key: "waiting", label: t("รอคิว", "Waiting"), value: waitingCount, icon: "solar:clock-circle-bold", color: "warning" },
        { key: "progress", label: t("กำลังตรวจ", "In progress"), value: inProgressCount, icon: "solar:hourglass-bold", color: "primary" },
        { key: "done", label: t("เสร็จสิ้น", "Completed"), value: completedCount, icon: "solar:check-circle-bold", color: "success" },
        { key: "issue", label: t("ต้องดูแล", "Needs attention"), value: skippedCount + timeoutCount + rejectCount, icon: "solar:danger-triangle-bold", color: "danger" },
    ];

    const deskLegendItems = [
        { key: "help_in_progress", label: t("ช่วยเหลือกำลังทำ", "Help in progress"), swatch: "#f59e0b" },
        { key: "help_waiting", label: t("รอช่วยเหลือ", "Help waiting"), swatch: "#fcd34d" },
        { key: "grading_in_progress", label: t("ตรวจงานกำลังทำ", "Grading in progress"), swatch: "#3b82f6" },
        { key: "grading_waiting", label: t("รอตรวจ", "Grading waiting"), swatch: "#93c5fd" },
        { key: "completed", label: t("เสร็จแล้ว", "Completed"), swatch: "#10b981" },
        { key: "idle", label: t("ว่าง", "Idle"), swatch: "#cbd5e1" },
    ];

    const workerDeskLegend = [
        { key: "current", label: t("โต๊ะปัจจุบัน", "Current desk"), swatch: "#f59e0b" },
        { key: "visited", label: t("เคยไปโต๊ะนี้", "Previously visited"), swatch: "#60a5fa" },
        { key: "other", label: t("โต๊ะอื่นในห้อง", "Other desks"), swatch: "#cbd5e1" },
    ];

    const activeDeskNumbers = desks
        .filter((desk) => getDeskVisualState(desk) !== "idle")
        .map((desk) => Number(desk.number))
        .filter((deskNumber) => !Number.isNaN(deskNumber));

    const handleExport = async () => {
        if (!report) return;

        setIsExporting(true);
        try {
            const ExcelJSImport = await import("exceljs");
            const workbook = new ExcelJSImport.default.Workbook();
            const exportDate = new Date();
            workbook.creator = "ITII Assist";
            workbook.created = exportDate;
            workbook.title = `${t("รีพอร์ตคิว", "Queue Report")} - ${report.session?.title || sessionId}`;

            const summarySheet = workbook.addWorksheet(t("สรุป", "Summary"));
            summarySheet.columns = [{ width: 28 }, { width: 36 }];
            summarySheet.addRows([
                [t("เซสชัน", "Session"), report.session?.title || sessionId || "-"],
                [t("ส่งออกเมื่อ", "Exported at"), exportDate.toLocaleString(isEnglish ? "en-US" : "th-TH")],
                [t("อัปเดตข้อมูลล่าสุด", "Last data refresh"), formatDateTime(report.generated_at, isEnglish)],
                [t("รายการทั้งหมด", "Total bookings"), totalBookings],
                [t("เสร็จสิ้น", "Completed"), completedCount],
                [t("รอคิว", "Waiting"), waitingCount],
                [t("กำลังตรวจ", "In progress"), inProgressCount],
                [t("ถูกข้าม", "Skipped"), skippedCount],
                [t("หมดเวลา", "Timed out"), timeoutCount],
                [t("ปฏิเสธ", "Declined"), rejectCount],
                [t("ตรวจงาน", "Grading"), gradingCount],
                [t("ช่วยเหลือ", "Help"), helpCount],
            ]);

            const workerSheet = workbook.addWorksheet(t("ผู้ตรวจ", "Workers"));
            workerSheet.columns = [
                { header: t("ผู้ตรวจ", "Worker"), key: "name", width: 26 },
                { header: t("สถานะ", "Status"), key: "status", width: 20 },
                { header: t("โหมดรับงาน", "Queue types"), key: "mode", width: 22 },
                { header: t("รวม", "Total"), key: "total", width: 10 },
                { header: t("ตรวจงาน", "Grading"), key: "grading", width: 10 },
                { header: t("ช่วยเหลือ", "Help"), key: "help", width: 10 },
                { header: t("ตอบรับ", "Accepted"), key: "accept", width: 10 },
                { header: t("ปฏิเสธ", "Declined"), key: "decline", width: 10 },
                { header: t("หมดเวลา", "Timed out"), key: "timeout", width: 10 },
                { header: t("% ตอบรับ", "Accept %"), key: "acceptRate", width: 12 },
                { header: t("เวลาพร้อมรับงานรวม", "Active time"), key: "activeTime", width: 18 },
                { header: t("โต๊ะที่ดูแล", "Desks"), key: "desks", width: 28 },
                { header: t("พักรับงานถึง", "Paused until"), key: "pausedUntil", width: 22 },
            ];
            workerSheet.addRows(filteredWorkers.map((worker) => ({
                name: worker.full_name || `#${worker.user_id}`,
                status: getWorkerStatusLabel(worker, isEnglish),
                mode: buildWorkerModeLabel(worker, isEnglish),
                total: worker.total_completed,
                grading: worker.grading_completed,
                help: worker.help_completed,
                accept: worker.offer_accept_count || 0,
                decline: worker.offer_reject_count || 0,
                timeout: worker.offer_timeout_count || 0,
                acceptRate: formatPercent(worker.offer_accept_rate),
                activeTime: formatDuration(worker.total_active_seconds, isEnglish),
                desks: worker.uniqueDeskNumbers.join(", "),
                pausedUntil: formatDateTime(worker.offer_paused_until, isEnglish),
            })));

            const bookingSheet = workbook.addWorksheet(t("ประวัติการจองคิว", "Booking History"));
            bookingSheet.columns = [
                { header: t("เวลาจอง", "Booked at"), key: "createdAt", width: 22 },
                { header: t("คิว", "Queue"), key: "queueNumber", width: 8 },
                { header: t("โต๊ะ", "Desk"), key: "deskNumber", width: 8 },
                { header: t("ประเภท", "Type"), key: "type", width: 14 },
                { header: t("ผู้จอง", "Student"), key: "student", width: 28 },
                { header: t("สถานะ", "Status"), key: "status", width: 14 },
                { header: t("ผู้ตรวจ", "Worker"), key: "worker", width: 24 },
                { header: t("รอก่อนถูกเสนอ", "Queue wait"), key: "queueWait", width: 18 },
                { header: t("เวลาตอบรับงาน", "Offer response"), key: "offerResponse", width: 18 },
                { header: t("เวลาตรวจ", "Service time"), key: "serviceTime", width: 18 },
                { header: t("หมดเวลา", "Timed out"), key: "timeout", width: 10 },
                { header: t("ปฏิเสธ", "Declined"), key: "decline", width: 10 },
                { header: t("หมายเหตุผู้ตรวจ", "Worker note"), key: "note", width: 30 },
            ];
            bookingSheet.addRows(filteredBookings.map((booking) => ({
                createdAt: formatDateTime(booking.created_at, isEnglish),
                queueNumber: booking.queue_number,
                deskNumber: booking.desk_number,
                type: getQueueBookingTypeLabel(booking.booking_type, isEnglish),
                student: booking.student?.full_name || "-",
                status: getQueueBookingStatusLabel(booking.status, isEnglish),
                worker: booking.assigned_worker?.full_name || "-",
                queueWait: formatDuration(booking.queue_wait_seconds, isEnglish),
                offerResponse: formatDuration(booking.offer_response_seconds, isEnglish),
                serviceTime: formatDuration(booking.service_duration_seconds, isEnglish),
                timeout: booking.timeout_count || 0,
                decline: booking.reject_count || 0,
                note: booking.worker_note || "-",
            })));

            const boldFont: Partial<ExcelJS.Font> = { bold: true };
            [summarySheet, workerSheet, bookingSheet].forEach((sheet) => {
                sheet.getRow(1).font = boldFont;
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = [
                sanitizeFileNameSegment(report.session?.title || sessionId),
                sanitizeFileNameSegment(report.course?.code || courseId),
                formatExportDate(exportDate),
            ].join("_") + ".xlsx";
            anchor.click();
            URL.revokeObjectURL(url);

            addToast({
                title: t("ส่งออกรีพอร์ตแล้ว", "Report exported"),
                description: t("ดาวน์โหลดไฟล์เรียบร้อยแล้ว", "The report file has been downloaded."),
                color: "success",
            });
        } catch (exportError) {
            console.error("Export queue report failed:", exportError);
            addToast({
                title: t("ส่งออกรีพอร์ตไม่สำเร็จ", "Export failed"),
                description: t("ไม่สามารถสร้างไฟล์รีพอร์ตได้", "Unable to generate the report file."),
                color: "danger",
            });
        } finally {
            setIsExporting(false);
        }
    };

    if (!hasParams) {
        return (
            <Card className="border border-danger-200 bg-danger-50">
                <CardBody className="text-danger-700">
                    {t("ไม่พบรหัสคอร์สหรือรหัสเซสชัน", "Course ID or session ID was not found.")}
                </CardBody>
            </Card>
        );
    }

    if (isInitialLoading && !report) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <Spinner label={t("กำลังโหลดรีพอร์ต...", "Loading report...")} />
            </div>
        );
    }

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-semibold text-foreground">
                            {t("ภาพรวมการทำงานของคิว", "Queue Session Performance")}
                        </h1>
                        <Chip size="sm" color={report?.session ? "primary" : "default"} variant="flat">
                            {report?.session?.title || sessionId}
                        </Chip>
                        <Chip size="sm" color={sessionStatusColor} variant="flat">
                            {t("สถานะ", "Status")}: {sessionStatus}
                        </Chip>
                        {isRefreshing ? (
                            <Chip size="sm" color="success" variant="flat">
                                {t("อัปเดตสด", "Live refresh")}
                            </Chip>
                        ) : null}
                    </div>
                    <p className="max-w-4xl text-sm text-default-500">
                        {t(
                            "ดูตัวเลขสำคัญด้านบนก่อน จากนั้นดูผลงานผู้ตรวจและประวัติการจองคิวได้ในแท็บถัดไป",
                            "Start with the key numbers above, then check TA performance and booking history in the next tabs.",
                        )}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-default-500">
                        <span>
                            {t("อัปเดตล่าสุด", "Last refresh")}: {formatDateTime(report?.generated_at, isEnglish)}
                        </span>
                        <span>
                            {t("ห้อง", "Room")}: {deskData?.classroom?.name || "-"}
                        </span>
                        <span>
                            {t("คอร์ส", "Course")}: {report?.course?.code || "-"}
                        </span>
                        <span>
                            {t("รวมรายการ", "Total entries")}: {totalBookings}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Popover placement="bottom-end">
                        <PopoverTrigger>
                            <Button variant="flat" startContent={<Icon icon="solar:palette-bold" />}>
                                {t("คำอธิบายสี", "Legend")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent>
                            <div className="grid max-w-xs gap-2 p-1 text-xs sm:grid-cols-2">
                                {deskLegendItems.map((item) => (
                                    <div key={item.key} className="inline-flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.swatch }} />
                                        <span className="text-default-600">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Button variant="flat" startContent={<Icon icon="solar:refresh-bold" />} onPress={() => void fetchSnapshot(true)}>
                        {t("รีเฟรชทันที", "Refresh now")}
                    </Button>
                    {activeTab === "history" ? (
                        <Button
                            color="primary"
                            variant="solid"
                            startContent={<Icon icon="solar:download-bold" />}
                            isLoading={isExporting}
                            onPress={handleExport}
                        >
                            {t("ส่งออก Excel", "Export Excel")}
                        </Button>
                    ) : null}
                </div>
            </div>

            {error ? (
                <Card className="border border-danger-200 bg-danger-50">
                    <CardBody className="flex flex-col gap-3 text-danger-700 md:flex-row md:items-center md:justify-between">
                        <span>{errorMessage}</span>
                        <Button color="danger" variant="flat" onPress={() => void fetchSnapshot(true)}>
                            {t("ลองใหม่", "Try again")}
                        </Button>
                    </CardBody>
                </Card>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {kpiCards.map((card) => {
                    const colorClasses = kpiColorClasses[card.color];
                    return (
                        <div
                            key={card.key}
                            className={`flex items-center gap-3 rounded-2xl border p-4 ${colorClasses.card}`}
                        >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorClasses.icon}`}>
                                <Icon icon={card.icon} className="text-xl" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-default-500">{card.label}</p>
                                <p className="text-2xl font-semibold text-foreground">{card.value}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardBody className="p-4">
                    <Tabs
                        selectedKey={activeTab}
                        onSelectionChange={(key) => setActiveTab(key as ReportTabKey)}
                        variant="underlined"
                        color="primary"
                    >
                        <Tab key="overview" title={t("ภาพรวม", "Overview")}>
                            <div className="mt-4 space-y-4">
                                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                                    <div className="rounded-2xl border border-default-200 bg-default-50 p-4 dark:bg-default-100/5">
                                        <p className="text-sm font-semibold text-foreground">{t("สิ่งที่ควรจับตา", "What to watch")}</p>
                                        <div className="mt-3 space-y-2">
                                            {focusNotes.map((note) => (
                                                <div key={note} className="flex items-start gap-2 text-sm text-default-600">
                                                    <Icon icon="solar:round-alt-arrow-right-linear" className="mt-0.5 text-default-400" />
                                                    <span>{note}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-default-200 bg-default-50 p-4 dark:bg-default-100/5">
                                        <p className="text-sm font-semibold text-foreground">{t("ภาพรวมโดยย่อ", "Quick snapshot")}</p>
                                        <div className="mt-3 space-y-3 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-default-500">{t("ตรวจงาน / ช่วยเหลือ", "Grading / Help")}</span>
                                                <span className="font-medium">{gradingCount} / {helpCount}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-default-500">{t("ปฏิเสธ / หมดเวลา", "Declined / Timed out")}</span>
                                                <span className="font-medium">{rejectCount} / {timeoutCount}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-default-500">{t("ส่วนต่างภาระงานสูงสุด", "Max workload gap")}</span>
                                                <span className="font-medium">{maxCompleted - minCompleted}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-default-500">{t("เฉลี่ยต่อผู้ตรวจ", "Average per worker")}</span>
                                                <span className="font-medium">{averageCompleted.toFixed(1)}</span>
                                            </div>
                                            {topWorker ? (
                                                <div className="rounded-xl bg-content1 p-3">
                                                    <p className="text-xs text-default-500">{t("ภาระงานสูงสุดตอนนี้", "Highest active load")}</p>
                                                    <p className="mt-1 font-medium text-foreground">
                                                        {topWorker.full_name || `#${topWorker.user_id}`} ({topWorker.pendingAssignedCount})
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                {rejectReasonStats.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 rounded-2xl border border-default-200 bg-content2/40 p-3">
                                        {rejectReasonStats.map((reason) => (
                                            <Chip key={reason.code} variant="flat" size="sm">
                                                {(isEnglish ? reason.label_en : reason.label_th)}: {reason.count} ({formatPercent((reason.count / Math.max(1, totalRejectByReason)) * 100)})
                                            </Chip>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </Tab>

                        <Tab key="ta" title={t("ประสิทธิภาพผู้ตรวจ", "TA Performance")}>
                            <div className="mt-4 space-y-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                    <Input
                                        value={taSearchQuery}
                                        onValueChange={setTaSearchQuery}
                                        placeholder={t("ค้นหาผู้ตรวจ โต๊ะ หรือโหมดรับงาน...", "Search worker, desks, or queue mode...")}
                                        isClearable
                                        variant="bordered"
                                        startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                                        className="flex-1"
                                    />
                                    <div className="grid gap-2 sm:grid-cols-1 lg:w-64">
                                        <Select
                                            aria-label={t("กรองตามผู้ตรวจ", "Filter by worker")}
                                            items={workerSelectItems}
                                            selectedKeys={[taWorkerFilter]}
                                            onSelectionChange={(keys) => setTaWorkerFilter(getSingleSelection(keys, "all"))}
                                            variant="bordered"
                                        >
                                            {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
                                        </Select>
                                    </div>
                                </div>

                                <Table removeWrapper aria-label={t("ตารางผู้ตรวจ", "Worker table")}>
                                    <TableHeader>
                                        <TableColumn>{t("ผู้ตรวจ", "Worker")}</TableColumn>
                                        <TableColumn>{t("สถานะ", "Status")}</TableColumn>
                                        <TableColumn>{t("ค้างอยู่", "Active")}</TableColumn>
                                        <TableColumn>{t("เสร็จสิ้น", "Completed")}</TableColumn>
                                        <TableColumn>{t("ตอบรับ", "Accept %")}</TableColumn>
                                        <TableColumn>{t("หมดเวลา", "Timed out")}</TableColumn>
                                        <TableColumn>{t("โต๊ะปัจจุบัน / รวม", "Active desk / total")}</TableColumn>
                                    </TableHeader>
                                    <TableBody emptyContent={t("ยังไม่มีข้อมูลผู้ตรวจ", "No worker data found.")}>
                                        {rankedWorkers.map((worker) => (
                                            <TableRow
                                                key={worker.user_id}
                                                className={`cursor-pointer ${selectedWorkerId === String(worker.user_id) ? "bg-primary-50 dark:bg-primary-500/10" : ""}`}
                                                onClick={() => setSelectedWorkerId(String(worker.user_id))}
                                            >
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium text-foreground">{worker.full_name || `#${worker.user_id}`}</div>
                                                        <div className="text-xs text-default-500">{buildWorkerModeLabel(worker, isEnglish)}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="sm" color={getWorkerStatusColor(worker, now)} variant="flat">
                                                        {getWorkerStatusLabel(worker, isEnglish)}
                                                    </Chip>
                                                </TableCell>
                                                <TableCell>{worker.pendingAssignedCount}</TableCell>
                                                <TableCell>{worker.total_completed}</TableCell>
                                                <TableCell>{formatPercent(worker.offer_accept_rate)}</TableCell>
                                                <TableCell>{worker.offer_timeout_count || 0}</TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium text-foreground">
                                                            {worker.currentDeskNumbers.length > 0
                                                                ? worker.currentDeskNumbers.map((n) => `#${n}`).join(", ")
                                                                : <span className="text-default-400">{t("ว่าง", "—")}</span>}
                                                        </div>
                                                        <div className="text-xs text-default-500">
                                                            {t(`${worker.uniqueDeskNumbers.length} โต๊ะทั้งหมด`, `${worker.uniqueDeskNumbers.length} desks total`)}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                {selectedWorker ? (
                                    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                                        <Card className="border border-default-200 bg-default-50 shadow-none dark:bg-default-100/5">
                                            <CardHeader className="pb-0">
                                                <div>
                                                    <h3 className="text-base font-semibold">
                                                        {t("แผนผังโต๊ะของผู้ตรวจ", "Worker desk map")}: {selectedWorker.full_name || `#${selectedWorker.user_id}`}
                                                    </h3>
                                                    <p className="text-sm text-default-500">
                                                        {t(
                                                            "ไฮไลต์เฉพาะโต๊ะที่ผู้ตรวจคนนี้เคยไปหรือกำลังไปตอนนี้ เพื่อดูตำแหน่งได้ทันที",
                                                            "Only the desks this worker has visited or is currently at are highlighted.",
                                                        )}
                                                    </p>
                                                </div>
                                            </CardHeader>
                                            <CardBody className="space-y-4">
                                                <WorkerDeskMap
                                                    desks={desks}
                                                    highlightedDeskNumbers={selectedWorker.uniqueDeskNumbers}
                                                    currentDeskNumbers={selectedWorker.currentDeskNumbers}
                                                />
                                                <div className="grid gap-2 grid-cols-3">
                                                    {workerDeskLegend.map((item) => (
                                                        <div key={item.key} className="flex items-center gap-2 rounded-lg border border-default-200 bg-content1 px-2 py-1.5 text-xs">
                                                            <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: item.swatch }} />
                                                            <span className="text-default-600">{item.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedWorker.uniqueDeskNumbers.length > 0 ? (
                                                        selectedWorker.uniqueDeskNumbers.map((deskNumber) => (
                                                            <Chip
                                                                key={deskNumber}
                                                                size="sm"
                                                                color={selectedWorker.currentDeskNumbers.includes(deskNumber) ? "warning" : "primary"}
                                                                variant="flat"
                                                            >
                                                                {t("โต๊ะ", "Desk")} {deskNumber}
                                                            </Chip>
                                                        ))
                                                    ) : (
                                                        <span className="text-sm text-default-500">
                                                            {t("ยังไม่พบโต๊ะที่ผู้ตรวจคนนี้รับงาน", "No desks recorded for this worker yet.")}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div className="rounded-xl border border-default-200 bg-content1 p-3">
                                                        <p className="text-xs text-default-500">{t("เปิดรับงานครั้งแรก / ล่าสุด", "First / last opened")}</p>
                                                        <p className="mt-1 text-sm font-medium">
                                                            {formatDateTime(selectedWorker.first_opened_at, isEnglish)} | {formatDateTime(selectedWorker.last_opened_at, isEnglish)}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl border border-default-200 bg-content1 p-3">
                                                        <p className="text-xs text-default-500">{t("ปิดรับงานล่าสุด / ใช้งานล่าสุด", "Last closed / last active")}</p>
                                                        <p className="mt-1 text-sm font-medium">
                                                            {formatDateTime(selectedWorker.last_closed_at, isEnglish)} | {formatDateTime(selectedWorker.last_active_at, isEnglish)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardBody>
                                        </Card>

                                        <Card className="border border-default-200 bg-default-50 shadow-none dark:bg-default-100/5">
                                            <CardHeader className="pb-0">
                                                <div>
                                                    <h3 className="text-base font-semibold">{t("งานล่าสุดของผู้ตรวจ", "Recent tasks")}</h3>
                                                    <p className="text-sm text-default-500">
                                                        {t(
                                                            "เรียงจากล่าสุดไปเก่าสุด เพื่อดูความต่อเนื่องของงาน",
                                                            "Sorted newest first to inspect execution continuity.",
                                                        )}
                                                    </p>
                                                </div>
                                            </CardHeader>
                                            <CardBody>
                                                <Table removeWrapper aria-label={t("ประวัติผู้ตรวจ", "Worker booking history")}>
                                                    <TableHeader>
                                                        <TableColumn>{t("เวลา", "Time")}</TableColumn>
                                                        <TableColumn>{t("โต๊ะ", "Desk")}</TableColumn>
                                                        <TableColumn>{t("ประเภท", "Type")}</TableColumn>
                                                        <TableColumn>{t("สถานะ", "Status")}</TableColumn>
                                                        <TableColumn>{t("ตอบรับงาน", "Offer response")}</TableColumn>
                                                        <TableColumn>{t("เวลาตรวจ", "Service time")}</TableColumn>
                                                    </TableHeader>
                                                    <TableBody emptyContent={t("ยังไม่มีประวัติของผู้ตรวจคนนี้", "No history for this worker yet.")}>
                                                        {selectedWorker.assignedBookings.slice(0, 8).map((booking) => (
                                                            <TableRow key={booking.id}>
                                                                <TableCell>{formatDateTime(booking.created_at, isEnglish)}</TableCell>
                                                                <TableCell>{booking.desk_number}</TableCell>
                                                                <TableCell>{getQueueBookingTypeLabel(booking.booking_type, isEnglish)}</TableCell>
                                                                <TableCell>
                                                                    <Chip size="sm" color={getStatusColor(booking.status)} variant="flat">
                                                                        {getQueueBookingStatusLabel(booking.status, isEnglish)}
                                                                    </Chip>
                                                                </TableCell>
                                                                <TableCell>{formatDuration(booking.offer_response_seconds, isEnglish)}</TableCell>
                                                                <TableCell>{formatDuration(booking.service_duration_seconds, isEnglish)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </CardBody>
                                        </Card>
                                    </div>
                                ) : null}
                            </div>
                        </Tab>

                        <Tab key="history" title={t("ประวัติการจอง", "Booking History")}>
                            <div className="mt-4 space-y-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                    <Input
                                        value={historySearchQuery}
                                        onValueChange={setHistorySearchQuery}
                                        placeholder={t("ค้นหาผู้จอง ผู้ตรวจ โต๊ะ IP หรือหมายเหตุ...", "Search by student, worker, desk, IP, or notes...")}
                                        isClearable
                                        variant="bordered"
                                        startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                                        className="flex-1"
                                    />
                                    <div className="grid gap-2 sm:grid-cols-3 lg:w-auto">
                                        <Select
                                            aria-label={t("กรองตามสถานะ", "Filter by status")}
                                            selectedKeys={[historyStatusFilter]}
                                            onSelectionChange={(keys) => setHistoryStatusFilter(getSingleSelection(keys, "all"))}
                                            variant="bordered"
                                        >
                                            <SelectItem key="all">{t("ทุกสถานะ", "All statuses")}</SelectItem>
                                            <SelectItem key="waiting">{t("รอคิว", "Waiting")}</SelectItem>
                                            <SelectItem key="in_progress">{t("กำลังตรวจ", "In progress")}</SelectItem>
                                            <SelectItem key="completed">{t("เสร็จสิ้น", "Completed")}</SelectItem>
                                            <SelectItem key="cancelled">{t("ยกเลิก", "Cancelled")}</SelectItem>
                                            <SelectItem key="no_show">{t("ถูกข้าม", "Skipped")}</SelectItem>
                                        </Select>
                                        <Select
                                            aria-label={t("กรองตามประเภทงาน", "Filter by booking type")}
                                            selectedKeys={[historyBookingTypeFilter]}
                                            onSelectionChange={(keys) => setHistoryBookingTypeFilter(getSingleSelection(keys, "all"))}
                                            variant="bordered"
                                        >
                                            <SelectItem key="all">{t("ทุกประเภท", "All types")}</SelectItem>
                                            <SelectItem key="grading">{t("ตรวจงาน", "Grading")}</SelectItem>
                                            <SelectItem key="help">{t("ช่วยเหลือ", "Help")}</SelectItem>
                                        </Select>
                                        <Select
                                            aria-label={t("กรองตามผู้ตรวจ", "Filter by worker")}
                                            items={workerSelectItems}
                                            selectedKeys={[historyWorkerFilter]}
                                            onSelectionChange={(keys) => setHistoryWorkerFilter(getSingleSelection(keys, "all"))}
                                            variant="bordered"
                                        >
                                            {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-default-200 bg-content2/40 px-3 py-2 text-xs text-default-600">
                                    <span>{t("รวมรายการ", "Total entries")}: {filteredBookings.length}</span>
                                    <span>{t("โต๊ะที่กำลังทำงาน", "Active desks")}: {activeDeskNumbers.length}</span>
                                    <span>{t("ส่งออกตามชุดกรองปัจจุบัน", "Export uses current filters")}</span>
                                </div>

                                <Table removeWrapper aria-label={t("ประวัติการจองคิว", "Queue booking history")} classNames={{ base: "min-w-[1120px]" }}>
                                    <TableHeader>
                                        <TableColumn>{t("เวลาจอง", "Booked at")}</TableColumn>
                                        <TableColumn>{t("คิว", "Queue")}</TableColumn>
                                        <TableColumn>{t("โต๊ะ", "Desk")}</TableColumn>
                                        <TableColumn>{t("ประเภท", "Type")}</TableColumn>
                                        <TableColumn>{t("ผู้จอง", "Student")}</TableColumn>
                                        <TableColumn>{t("สถานะ", "Status")}</TableColumn>
                                        <TableColumn>{t("ผู้ตรวจ", "Worker")}</TableColumn>
                                        <TableColumn>{t("เวลาตอบรับงาน", "Offer response")}</TableColumn>
                                        <TableColumn>{t("เวลาตรวจ", "Service time")}</TableColumn>
                                        <TableColumn>{t("ปัญหา", "Issues")}</TableColumn>
                                    </TableHeader>
                                    <TableBody emptyContent={t("ยังไม่มีประวัติการจองคิว", "No booking history found.")}>
                                        {paginatedBookings.map((booking) => (
                                            <TableRow key={booking.id}>
                                                <TableCell>{formatDateTime(booking.created_at, isEnglish)}</TableCell>
                                                <TableCell>{booking.queue_number}</TableCell>
                                                <TableCell>{booking.desk_number}</TableCell>
                                                <TableCell>{getQueueBookingTypeLabel(booking.booking_type, isEnglish)}</TableCell>
                                                <TableCell>
                                                    <div className="min-w-48">
                                                        <div className="font-medium text-foreground">{booking.student?.full_name || "-"}</div>
                                                        <div className="text-xs text-default-500">{booking.student?.student_id || "-"}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="sm" color={getStatusColor(booking.status)} variant="flat">
                                                        {getQueueBookingStatusLabel(booking.status, isEnglish)}
                                                    </Chip>
                                                </TableCell>
                                                <TableCell>{booking.assigned_worker?.full_name || "-"}</TableCell>
                                                <TableCell>{formatDuration(booking.offer_response_seconds, isEnglish)}</TableCell>
                                                <TableCell>{formatDuration(booking.service_duration_seconds, isEnglish)}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        <Chip
                                                            size="sm"
                                                            variant="flat"
                                                            color={(booking.timeout_count || 0) > 0 ? "danger" : "default"}
                                                            title={t("หมดเวลา", "Timed out")}
                                                        >
                                                            TO {booking.timeout_count || 0}
                                                        </Chip>
                                                        <Chip
                                                            size="sm"
                                                            variant="flat"
                                                            color={(booking.reject_count || 0) > 0 ? "warning" : "default"}
                                                            title={t("ปฏิเสธ", "Declined")}
                                                        >
                                                            RJ {booking.reject_count || 0}
                                                        </Chip>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                {filteredBookings.length > 0 ? (
                                    <div className="mt-2 flex flex-col gap-3 border-t border-default-200 pt-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <p className="text-sm text-default-500">
                                                {t("แสดง", "Showing")} {(currentBookingPage - 1) * bookingPageSize + 1}-{Math.min(currentBookingPage * bookingPageSize, filteredBookings.length)} {t("จาก", "of")} {filteredBookings.length} {t("รายการ", "items")}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-default-500">{t("ต่อหน้า", "per page")}</span>
                                                <Select
                                                    aria-label={t("จำนวนรายการต่อหน้า", "Rows per page")}
                                                    selectedKeys={[bookingsPerPage]}
                                                    onSelectionChange={(keys) => setBookingsPerPage(getSingleSelection(keys, "10"))}
                                                    className="w-28"
                                                    size="sm"
                                                    variant="bordered"
                                                >
                                                    <SelectItem key="10">10</SelectItem>
                                                    <SelectItem key="20">20</SelectItem>
                                                    <SelectItem key="50">50</SelectItem>
                                                </Select>
                                            </div>
                                        </div>
                                        <Pagination
                                            page={currentBookingPage}
                                            total={totalBookingPages}
                                            onChange={setBookingPage}
                                            showControls
                                            isCompact
                                            color="primary"
                                            variant="flat"
                                        />
                                    </div>
                                ) : null}
                            </div>
                        </Tab>
                    </Tabs>
                </CardBody>
            </Card>
        </div>
    );
}
