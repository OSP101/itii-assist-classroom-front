"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type ExcelJS from "exceljs";
import { addToast } from "@heroui/toast";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Pagination } from "@heroui/pagination";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
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
import { useSmartPolling } from "@/lib/realtime/use-smart-polling";
import queueService, {
    getQueueBookingStatusLabel,
    getQueueBookingTypeLabel,
    type DeskWithStatus,
    type ProjectorViewData,
    type QueueReportBooking,
    type QueueReportWorkerStat,
    type QueueSessionReport,
} from "@/services/queue.service";

const LIVE_INTERVAL_MS = 5000;

type ReportSnapshot = {
    report: QueueSessionReport;
    deskData: ProjectorViewData;
};

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
    const width = 340;
    const height = 220;
    const pad = 18;
    const rawWidth = Math.max(...xs) - minX;
    const rawHeight = Math.max(...ys) - minY;
    const scale = Math.min(
        rawWidth > 0 ? (width - pad * 2) / rawWidth : 1,
        rawHeight > 0 ? (height - pad * 2) / rawHeight : 1,
    );

    const currentSet = new Set(currentDeskNumbers.map(String));
    const highlightedSet = new Set(highlightedDeskNumbers.map(String));

    const cx = (desk: DeskWithStatus) => pad + ((desk.x as number) - minX) * scale;
    const cy = (desk: DeskWithStatus) => pad + ((desk.y as number) - minY) * scale;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-2xl bg-slate-50 p-2 dark:bg-slate-950/40">
            {positionedDesks.map((desk) => {
                const x = cx(desk);
                const y = cy(desk);
                const deskKey = String(desk.number);
                const isCurrent = currentSet.has(deskKey);
                const isHighlighted = highlightedSet.has(deskKey);

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

                const fill = isCurrent ? "#f59e0b" : isHighlighted ? "#38bdf8" : "#cbd5e1";
                const labelFill = isCurrent || isHighlighted ? "#0f172a" : "#475569";

                return (
                    <g key={`desk-${desk.id}`}>
                        {isCurrent ? <circle cx={x} cy={y} r={11} fill="#fde68a" opacity={0.65} /> : null}
                        <circle cx={x} cy={y} r={7} fill={fill} />
                        {(isCurrent || isHighlighted) ? (
                            <text x={x} y={y - 12} textAnchor="middle" fontSize="9" fill={labelFill}>
                                {desk.number}
                            </text>
                        ) : null}
                    </g>
                );
            })}
        </svg>
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

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [bookingTypeFilter, setBookingTypeFilter] = useState("all");
    const [workerFilter, setWorkerFilter] = useState("all");
    const [selectedWorkerId, setSelectedWorkerId] = useState("all");
    const [bookingPage, setBookingPage] = useState(1);
    const [bookingsPerPage, setBookingsPerPage] = useState("10");
    const [isExporting, setIsExporting] = useState(false);

    const {
        data: snapshot,
        isInitialLoading,
        isRefreshing,
        error,
        refetch,
    } = useSmartPolling<ReportSnapshot>({
        enabled: hasParams,
        intervalMs: LIVE_INTERVAL_MS,
        fetcher: async () => {
            const [report, deskData] = await Promise.all([
                queueService.getSessionReport(courseId as string, sessionId as string),
                queueService.getDeskStatuses(courseId as string, sessionId as string),
            ]);

            return { report, deskData };
        },
    });

    const report = snapshot?.report ?? null;
    const deskData = snapshot?.deskData ?? null;
    const desks = deskData?.desks ?? [];
    const now = new Date();
    const errorMessage = error instanceof Error
        ? error.message
        : t("ไม่สามารถโหลดรีพอร์ตได้", "Unable to load the report.");

    useEffect(() => {
        setBookingPage(1);
    }, [searchQuery, statusFilter, bookingTypeFilter, workerFilter, bookingsPerPage]);

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
        const query = searchQuery.trim().toLowerCase();
        return workerSummaries.filter((worker) => {
            const matchesWorker = workerFilter === "all" || String(worker.user_id) === workerFilter;
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
    }, [isEnglish, searchQuery, workerFilter, workerSummaries]);

    useEffect(() => {
        if (filteredWorkers.length === 0) {
            setSelectedWorkerId("all");
            return;
        }

        if (selectedWorkerId === "all" || !filteredWorkers.some((worker) => String(worker.user_id) === selectedWorkerId)) {
            setSelectedWorkerId(String(filteredWorkers[0].user_id));
        }
    }, [filteredWorkers, selectedWorkerId]);

    const selectedWorker = filteredWorkers.find((worker) => String(worker.user_id) === selectedWorkerId) || null;

    const filteredBookings = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return sortedBookings.filter((booking) => {
            const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
            const matchesType = bookingTypeFilter === "all" || booking.booking_type === bookingTypeFilter;
            const matchesWorker = workerFilter === "all" || String(booking.assigned_worker?.id || "") === workerFilter;
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
    }, [bookingTypeFilter, searchQuery, sortedBookings, statusFilter, workerFilter]);

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

    const summaryCards = [
        {
            label: t("รายการทั้งหมด", "Total bookings"),
            value: totalBookings,
            hint: t("รวมทุกสถานะใน session นี้", "All queue entries in this session"),
            icon: "solar:clipboard-list-bold",
            colorClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
        },
        {
            label: t("กำลังรอ / กำลังตรวจ", "Waiting / In progress"),
            value: `${waitingCount} / ${inProgressCount}`,
            hint: t("ดูคาบกำลังไหลแค่ไหน", "Live queue load right now"),
            icon: "solar:clock-circle-bold",
            colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
        },
        {
            label: t("เสร็จสิ้นแล้ว", "Completed"),
            value: completedCount,
            hint: t("งานที่ปิดได้แล้ว", "Work finished so far"),
            icon: "solar:check-circle-bold",
            colorClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
        },
        {
            label: t("ถูกข้าม / หมดเวลา", "Skipped / Timed out"),
            value: `${skippedCount} / ${timeoutCount}`,
            hint: t("รายการที่สะดุดระหว่าง flow", "Entries that broke the normal flow"),
            icon: "solar:danger-triangle-bold",
            colorClass: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
        },
        {
            label: t("ผู้ตรวจพร้อม / พักรับงาน", "Ready / Paused"),
            value: `${activeWorkerCount} / ${autoPausedWorkers}`,
            hint: t("ดูว่าใครยังช่วยรับงานได้อยู่", "Current worker availability"),
            icon: "solar:users-group-rounded-bold",
            colorClass: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
        },
        {
            label: t("ความต่างภาระงาน", "Workload spread"),
            value: `${maxCompleted - minCompleted}`,
            hint: t(
                `เฉลี่ย ${averageCompleted.toFixed(1)} งานต่อคน`,
                `Average ${averageCompleted.toFixed(1)} jobs per worker`,
            ),
            icon: "solar:chart-bold",
            colorClass: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200",
        },
    ];

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

            const summarySheet = workbook.addWorksheet(t("ภาพรวม", "Summary"));
            summarySheet.columns = [{ width: 28 }, { width: 36 }];
            summarySheet.addRows([
                [t("session", "Session"), report.session?.title || sessionId || "-"],
                [t("ส่งออกเมื่อ", "Exported at"), exportDate.toLocaleString(isEnglish ? "en-US" : "th-TH")],
                [t("อัปเดตข้อมูลล่าสุด", "Last data refresh"), formatDateTime(report.generated_at, isEnglish)],
                [t("รายการทั้งหมด", "Total bookings"), totalBookings],
                [t("เสร็จสิ้นแล้ว", "Completed"), completedCount],
                [t("กำลังรอ", "Waiting"), waitingCount],
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
                    {t("ไม่พบรหัสคอร์สหรือ session", "Course ID or session ID was not found.")}
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
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-semibold text-foreground">
                            {t("ภาพรวมการทำงานของคิว", "Queue Session Performance")}
                        </h1>
                        <Chip size="sm" color={report?.session ? "primary" : "default"} variant="flat">
                            {report?.session?.title || sessionId}
                        </Chip>
                        {isRefreshing ? (
                            <Chip size="sm" color="success" variant="flat">
                                {t("อัปเดตสด", "Live refresh")}
                            </Chip>
                        ) : null}
                    </div>
                    <p className="max-w-4xl text-sm text-default-500">
                        {t(
                            "ดูคาบนี้แบบละเอียดว่าใครรับงานอะไร รับได้ทันไหม กระจายงานสมดุลหรือไม่ และโต๊ะไหนถูกตรวจไปแล้วบ้าง ข้อมูลจะรีเฟรชอัตโนมัติทุกไม่กี่วินาที",
                            "Review this session in detail: who handled what, how quickly offers were accepted, how balanced the workload is, and which desks each worker has touched. Data refreshes automatically every few seconds.",
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
                            {t("สถานะ session", "Session status")}: {deskData?.session?.status || "-"}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="flat" startContent={<Icon icon="solar:refresh-bold" />} onPress={refetch}>
                        {t("รีเฟรชทันที", "Refresh now")}
                    </Button>
                    <Button
                        color="primary"
                        variant="solid"
                        startContent={<Icon icon="solar:download-bold" />}
                        isLoading={isExporting}
                        onPress={handleExport}
                    >
                        {t("ส่งออก Excel", "Export Excel")}
                    </Button>
                </div>
            </div>

            {error ? (
                <Card className="border border-danger-200 bg-danger-50">
                    <CardBody className="flex flex-col gap-3 text-danger-700 md:flex-row md:items-center md:justify-between">
                        <span>{errorMessage}</span>
                        <Button color="danger" variant="flat" onPress={refetch}>
                            {t("ลองใหม่", "Try again")}
                        </Button>
                    </CardBody>
                </Card>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {summaryCards.map((card) => (
                    <Card key={card.label} className="border border-default-200 bg-content1 shadow-sm">
                        <CardBody className="flex flex-row items-start gap-4 p-5">
                            <div className={`rounded-2xl p-3 ${card.colorClass}`}>
                                <Icon icon={card.icon} width={24} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-default-500">{card.label}</p>
                                <p className="text-2xl font-semibold text-foreground">{card.value}</p>
                                <p className="text-xs text-default-400">{card.hint}</p>
                            </div>
                        </CardBody>
                    </Card>
                ))}
            </div>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="pb-0">
                    <div>
                        <h2 className="text-lg font-semibold">{t("สัดส่วนประเภทงาน", "Job Type Distribution")}</h2>
                        <p className="text-sm text-default-500">
                            {t(
                                "ช่วยดูว่าคิวเอียงไปทางตรวจงานหรือช่วยเหลือมากน้อยแค่ไหนในคาบนี้",
                                "Quickly see whether this session leaned more toward grading or help requests.",
                            )}
                        </p>
                    </div>
                </CardHeader>
                <CardBody className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-default-200 bg-default-50 p-4 dark:bg-default-100/5">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm text-default-500">{t("ตรวจงาน", "Grading")}</span>
                            <span className="text-lg font-semibold">{gradingCount}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-default-200">
                            <div
                                className="h-full rounded-full bg-sky-500"
                                style={{ width: `${totalBookings > 0 ? (gradingCount / totalBookings) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-default-200 bg-default-50 p-4 dark:bg-default-100/5">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm text-default-500">{t("ช่วยเหลือ", "Help")}</span>
                            <span className="text-lg font-semibold">{helpCount}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-default-200">
                            <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${totalBookings > 0 ? (helpCount / totalBookings) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardBody className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <Input
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                            placeholder={t("ค้นหาผู้จอง ผู้ตรวจ โต๊ะ IP หรือหมายเหตุ...", "Search by student, worker, desk, IP, or notes...")}
                            isClearable
                            variant="bordered"
                            startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                            className="flex-1"
                        />
                        <div className="grid gap-2 sm:grid-cols-3 lg:w-auto">
                            <Select
                                aria-label={t("กรองตามสถานะ", "Filter by status")}
                                selectedKeys={[statusFilter]}
                                onSelectionChange={(keys) => setStatusFilter(getSingleSelection(keys, "all"))}
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
                                selectedKeys={[bookingTypeFilter]}
                                onSelectionChange={(keys) => setBookingTypeFilter(getSingleSelection(keys, "all"))}
                                variant="bordered"
                            >
                                <SelectItem key="all">{t("ทุกประเภท", "All types")}</SelectItem>
                                <SelectItem key="grading">{t("ตรวจงาน", "Grading")}</SelectItem>
                                <SelectItem key="help">{t("ช่วยเหลือ", "Help")}</SelectItem>
                            </Select>
                            <Select
                                aria-label={t("กรองตามผู้ตรวจ", "Filter by worker")}
                                items={workerSelectItems}
                                selectedKeys={[workerFilter]}
                                onSelectionChange={(keys) => setWorkerFilter(getSingleSelection(keys, "all"))}
                                variant="bordered"
                            >
                                {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
                            </Select>
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="pb-0">
                    <div>
                        <h2 className="text-lg font-semibold">{t("ภาพรวมผู้ตรวจแต่ละคน", "Worker Performance Overview")}</h2>
                        <p className="text-sm text-default-500">
                            {t(
                                "ดูได้ทันทีว่าใครรับงานแบบไหน รับทันหรือหมดเวลาเท่าไร ถูกพักรับงานอยู่หรือไม่ และภาระงานกระจายสมดุลแค่ไหน",
                                "See at a glance what each worker handled, how often offers timed out, whether they are temporarily paused, and how balanced the workload has been.",
                            )}
                        </p>
                    </div>
                </CardHeader>
                <CardBody className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-2">
                        {filteredWorkers.map((worker) => (
                            <button
                                type="button"
                                key={worker.user_id}
                                onClick={() => setSelectedWorkerId(String(worker.user_id))}
                                className={`rounded-2xl border p-4 text-left transition ${
                                    selectedWorkerId === String(worker.user_id)
                                        ? "border-primary bg-primary-50 shadow-sm dark:bg-primary-500/10"
                                        : "border-default-200 bg-default-50 hover:border-primary/40 dark:bg-default-100/5"
                                }`}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-semibold text-foreground">
                                                {worker.full_name || `#${worker.user_id}`}
                                            </h3>
                                            <Chip size="sm" color={getWorkerStatusColor(worker, now)} variant="flat">
                                                {getWorkerStatusLabel(worker, isEnglish)}
                                            </Chip>
                                        </div>
                                        <p className="text-sm text-default-500">{buildWorkerModeLabel(worker, isEnglish)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-default-500">{t("งานเสร็จรวม", "Completed total")}</p>
                                        <p className="text-2xl font-semibold text-foreground">{worker.total_completed}</p>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-default-200 bg-content1 p-3">
                                        <p className="text-xs text-default-500">{t("ประเภทงานที่รับ", "Handled job types")}</p>
                                        <p className="mt-1 text-sm font-medium">
                                            {t("ตรวจงาน", "Grading")}: {worker.gradingAssignedCount} | {t("ช่วยเหลือ", "Help")}: {worker.helpAssignedCount}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-default-200 bg-content1 p-3">
                                        <p className="text-xs text-default-500">{t("ตอบรับ / ปฏิเสธ / หมดเวลา", "Accept / Decline / Timeout")}</p>
                                        <p className="mt-1 text-sm font-medium">
                                            {worker.offer_accept_count || 0} / {worker.offer_reject_count || 0} / {worker.offer_timeout_count || 0}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-default-200 bg-content1 p-3">
                                        <p className="text-xs text-default-500">{t("เปอร์เซ็นต์ตอบรับ / สัดส่วนงาน", "Accept rate / Work share")}</p>
                                        <p className="mt-1 text-sm font-medium">
                                            {formatPercent(worker.offer_accept_rate)} / {formatPercent(worker.percent)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-default-200 bg-content1 p-3">
                                        <p className="text-xs text-default-500">{t("ถูกข้าม / ค้างอยู่", "Skipped / Still assigned")}</p>
                                        <p className="mt-1 text-sm font-medium">
                                            {worker.skippedCount} / {worker.pendingAssignedCount}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-default-500">
                                    <Chip size="sm" variant="flat">{t("โต๊ะที่เกี่ยวข้อง", "Touched desks")}: {worker.uniqueDeskNumbers.length}</Chip>
                                    <Chip size="sm" variant="flat">{t("พร้อมรับงานรวม", "Active time")}: {formatDuration(worker.total_active_seconds, isEnglish)}</Chip>
                                    {worker.currentDeskNumbers.length > 0 ? (
                                        <Chip size="sm" color="warning" variant="flat">
                                            {t("กำลังอยู่ที่โต๊ะ", "Current desk")}: {worker.currentDeskNumbers.join(", ")}
                                        </Chip>
                                    ) : null}
                                    {worker.offer_paused_until ? (
                                        <Chip size="sm" color="danger" variant="flat">
                                            {t("พักถึง", "Paused until")}: {formatDateTime(worker.offer_paused_until, isEnglish)}
                                        </Chip>
                                    ) : null}
                                </div>
                            </button>
                        ))}
                    </div>

                    {selectedWorker ? (
                        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                            <Card className="border border-default-200 bg-default-50 shadow-none dark:bg-default-100/5">
                                <CardHeader className="pb-0">
                                    <div>
                                        <h3 className="text-base font-semibold">
                                            {t("รายละเอียดผู้ตรวจ", "Worker detail")}: {selectedWorker.full_name || `#${selectedWorker.user_id}`}
                                        </h3>
                                        <p className="text-sm text-default-500">
                                            {t(
                                                "โต๊ะที่ผู้ตรวจคนนี้เคยรับและสถานะการทำงานล่าสุด",
                                                "Desks this worker has handled and their latest operating state.",
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
                                            <p className="text-xs text-default-500">{t("ปิดรับงานล่าสุด / active ล่าสุด", "Last closed / last active")}</p>
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
                                        <h3 className="text-base font-semibold">{t("ประวัติของผู้ตรวจคนนี้", "This worker's recent history")}</h3>
                                        <p className="text-sm text-default-500">
                                            {t(
                                                "เรียงจากล่าสุดไปเก่าสุด เพื่อดูว่าเดินตรวจโต๊ะไหนบ้างและใช้เวลานานแค่ไหน",
                                                "Sorted newest first so you can review which desks they handled and how long each step took.",
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
                </CardBody>
            </Card>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="pb-0">
                    <div>
                        <h2 className="text-lg font-semibold">{t("สรุปเหตุผลการปฏิเสธงาน", "Decline Reason Summary")}</h2>
                        <p className="text-sm text-default-500">
                            {t(
                                "ไว้เช็กว่าคาบนี้ปัญหาเกิดจากภาระงานชนกัน ปัญหาเทคนิค หรือมีคนต้องพักรับงานบ่อยแค่ไหน",
                                "Helpful for spotting whether the session was slowed down by worker load, technical issues, or repeated temporary pauses.",
                            )}
                        </p>
                    </div>
                </CardHeader>
                <CardBody>
                    <Table removeWrapper aria-label={t("สรุปเหตุผลการปฏิเสธ", "Decline reason summary")}>
                        <TableHeader>
                            <TableColumn>{t("เหตุผล", "Reason")}</TableColumn>
                            <TableColumn>{t("จำนวนครั้ง", "Count")}</TableColumn>
                            <TableColumn>{t("สัดส่วน", "Share")}</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent={t("ยังไม่พบการปฏิเสธงาน", "No declined offers found.")}>
                            {rejectReasonStats.map((reason) => (
                                <TableRow key={reason.code}>
                                    <TableCell>{isEnglish ? reason.label_en : reason.label_th}</TableCell>
                                    <TableCell>{reason.count}</TableCell>
                                    <TableCell>{formatPercent((reason.count / Math.max(1, totalRejectByReason)) * 100)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardBody>
            </Card>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="pb-0">
                    <div>
                        <h2 className="text-lg font-semibold">{t("ประวัติการจองคิว", "Queue Booking History")}</h2>
                        <p className="text-sm text-default-500">
                            {t(
                                "เรียงจากปัจจุบันไปเก่าสุด และแยกเวลาเป็นช่วงชัดเจน: เวลารอก่อนถูกเสนอ, เวลาตอบรับงาน, และเวลาที่ใช้ตรวจจริง",
                                "Sorted newest first and broken into clear stages: queue wait before first offer, offer response time, and active service time.",
                            )}
                        </p>
                    </div>
                </CardHeader>
                <CardBody>
                    <Table removeWrapper aria-label={t("ประวัติการจองคิว", "Queue booking history")} classNames={{ base: "min-w-[1500px]" }}>
                        <TableHeader>
                            <TableColumn>{t("เวลาจอง", "Booked at")}</TableColumn>
                            <TableColumn>{t("คิว", "Queue")}</TableColumn>
                            <TableColumn>{t("โต๊ะ", "Desk")}</TableColumn>
                            <TableColumn>{t("ประเภท", "Type")}</TableColumn>
                            <TableColumn>{t("ผู้จอง", "Student")}</TableColumn>
                            <TableColumn>{t("สถานะ", "Status")}</TableColumn>
                            <TableColumn>{t("ผู้ตรวจ", "Worker")}</TableColumn>
                            <TableColumn>{t("รอก่อนถูกเสนอ", "Queue wait")}</TableColumn>
                            <TableColumn>{t("เวลาตอบรับงาน", "Offer response")}</TableColumn>
                            <TableColumn>{t("เวลาตรวจ", "Service time")}</TableColumn>
                            <TableColumn>{t("หมดเวลา", "Timed out")}</TableColumn>
                            <TableColumn>{t("ปฏิเสธ", "Declined")}</TableColumn>
                            <TableColumn>{t("หมายเหตุผู้ตรวจ", "Worker note")}</TableColumn>
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
                                    <TableCell>{formatDuration(booking.queue_wait_seconds, isEnglish)}</TableCell>
                                    <TableCell>{formatDuration(booking.offer_response_seconds, isEnglish)}</TableCell>
                                    <TableCell>{formatDuration(booking.service_duration_seconds, isEnglish)}</TableCell>
                                    <TableCell>{booking.timeout_count || 0}</TableCell>
                                    <TableCell>{booking.reject_count || 0}</TableCell>
                                    <TableCell>{booking.worker_note || "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {filteredBookings.length > 0 ? (
                        <div className="mt-4 flex flex-col gap-3 border-t border-default-200 pt-4 lg:flex-row lg:items-center lg:justify-between">
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
                </CardBody>
            </Card>
        </div>
    );
}
