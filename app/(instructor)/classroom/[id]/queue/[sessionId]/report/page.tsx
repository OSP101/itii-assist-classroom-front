"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type ExcelJS from "exceljs";
import { addToast } from "@heroui/toast";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Pagination } from "@heroui/pagination";
import { Select, SelectItem } from "@heroui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
} from "@heroui/table";
import { Spinner } from "@heroui/spinner";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import queueService, {
    getQueueBookingStatusLabel,
    getQueueBookingTypeLabel,
    type QueueSessionReport,
} from "@/services/queue.service";

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

export default function QueueSessionReportPage() {
    const params = useParams<{ id: string; sessionId: string }>();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const t = (thai: string, english: string) => (isEnglish ? english : thai);
    const courseId = params?.id;
    const sessionId = params?.sessionId;
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState<QueueSessionReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [bookingTypeFilter, setBookingTypeFilter] = useState("all");
    const [workerFilter, setWorkerFilter] = useState("all");
    const [isExporting, setIsExporting] = useState(false);
    const [bookingPage, setBookingPage] = useState(1);
    const [bookingsPerPage, setBookingsPerPage] = useState("10");

    useEffect(() => {
        if (!courseId || !sessionId) {
            setError(t("ไม่พบรหัสคอร์สหรือ session", "Course ID or session ID was not found."));
            setLoading(false);
            return;
        }

        const fetchReport = async () => {
            try {
                setLoading(true);
                const data = await queueService.getSessionReport(courseId, sessionId);
                setReport(data);
                setError(null);
            } catch (fetchError) {
                const message = !isEnglish && fetchError instanceof Error
                    ? fetchError.message
                    : t("ไม่สามารถโหลดรีพอร์ตได้", "Unable to load the report.");
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [courseId, sessionId, isEnglish]);

    useEffect(() => {
        setBookingPage(1);
    }, [searchQuery, statusFilter, bookingTypeFilter, workerFilter, bookingsPerPage]);

    if (loading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <Spinner label={t("กำลังโหลดรีพอร์ต...", "Loading report...")} />
            </div>
        );
    }

    const query = searchQuery.trim().toLowerCase();
    const workerOptions = report?.worker_stats || [];
    const workerSelectItems = [
        { key: "all", label: t("ผู้ตรวจทั้งหมด", "All workers") },
        ...workerOptions.map((worker) => ({
            key: String(worker.user_id),
            label: worker.full_name || `#${worker.user_id}`,
        })),
    ];
    const filteredWorkers = (report?.worker_stats || []).filter((worker) => {
        const matchesWorker = workerFilter === "all" || String(worker.user_id) === workerFilter;
        if (!matchesWorker) return false;
        if (!query) return true;
        const haystack = [
            worker.full_name || "",
            String(worker.user_id),
            String(worker.total_completed),
            String(worker.opened_count || 0),
            String(worker.closed_count || 0),
            String(worker.offer_accept_count || 0),
            String(worker.offer_reject_count || 0),
            String(worker.offer_timeout_count || 0),
        ].join(" ").toLowerCase();
        return haystack.includes(query);
    });

    const filteredBookings = (report?.bookings || []).filter((booking) => {
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
            booking.booking_type || "",
            booking.status || "",
            String(booking.queue_number),
            String(booking.desk_number),
            booking.worker_note || "",
        ].join(" ").toLowerCase();
        return haystack.includes(query);
    });

    const completedCount = filteredBookings.filter((booking) => booking.status === "completed").length;
    const waitingCount = filteredBookings.filter((booking) => booking.status === "waiting").length;
    const inProgressCount = filteredBookings.filter((booking) => booking.status === "in_progress").length;
    const timeoutCount = filteredBookings.reduce((sum, booking) => sum + (booking.timeout_count || 0), 0);
    const rejectCount = filteredBookings.reduce((sum, booking) => sum + (booking.reject_count || 0), 0);
    const rejectReasonStats = report?.reject_reason_stats || [];
    const totalRejectByReason = rejectReasonStats.reduce((sum, item) => sum + (item.count || 0), 0);
    const bookingPageSize = Number(bookingsPerPage);
    const totalBookingPages = Math.max(1, Math.ceil(filteredBookings.length / bookingPageSize));
    const currentBookingPage = Math.min(bookingPage, totalBookingPages);
    const paginatedBookings = filteredBookings.slice(
        (currentBookingPage - 1) * bookingPageSize,
        currentBookingPage * bookingPageSize,
    );
    const statCards = [
        {
            label: t("ทั้งหมด", "Total"),
            value: filteredBookings.length,
            icon: "solar:clipboard-list-bold",
            iconClass: "text-blue-600",
            bgClass: "bg-blue-100 dark:bg-blue-500/15",
        },
        {
            label: t("กำลังรอ", "Waiting"),
            value: waitingCount,
            icon: "solar:clock-circle-bold",
            iconClass: "text-amber-600 dark:text-amber-300",
            bgClass: "bg-amber-100 dark:bg-amber-500/15",
        },
        {
            label: t("กำลังตรวจ", "In Progress"),
            value: inProgressCount,
            icon: "solar:play-circle-bold",
            iconClass: "text-emerald-600 dark:text-emerald-300",
            bgClass: "bg-emerald-100 dark:bg-emerald-500/15",
        },
        {
            label: t("เสร็จแล้ว", "Completed"),
            value: completedCount,
            icon: "solar:check-circle-bold",
            iconClass: "text-red-600 dark:text-red-300",
            bgClass: "bg-red-100 dark:bg-red-500/15",
        },
    ];

    const formatDateTime = (value?: string | null) => {
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
    };

    const triggerDownload = (buffer: ArrayBuffer, fileName: string) => {
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const handleExport = async () => {
        if (!report) return;
        setIsExporting(true);
        try {
            const ExcelJS = (await import("exceljs")).default;
            const exportDate = new Date();
            const workbook = new ExcelJS.Workbook();
            workbook.creator = "ITII Assist";
            workbook.created = exportDate;
            workbook.subject = report.session?.title || t("รีพอร์ตคิว", "Queue report");
            workbook.title = `${t("รีพอร์ตคิว", "Queue Report")} - ${report.session?.title || sessionId}`;

            const solidFill = (argb: string) => ({ type: "pattern", pattern: "solid", fgColor: { argb } }) as const;
            const thinBorder: Partial<ExcelJS.Borders> = {
                top: { style: "thin", color: { argb: "FFE2E8F0" } },
                bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
                left: { style: "thin", color: { argb: "FFE2E8F0" } },
                right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };
            const workbookFontName = "TH Sarabun New";
            const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 16, name: workbookFontName };
            const subHeaderFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF0F172A" }, size: 14, name: workbookFontName };
            const titleFill = solidFill("FF0F766E");
            const headerFill = solidFill("FF1E293B");
            const subHeaderFill = solidFill("FFE2E8F0");
            const accentFill = solidFill("FFD1FAE5");
            const waitingFill = solidFill("FFDBEAFE");
            const progressFill = solidFill("FFFEF3C7");
            const completedFill = solidFill("FFDCFCE7");
            const applyHeader = (cell: ExcelJS.Cell) => {
                cell.fill = headerFill;
                cell.font = headerFont;
                cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                cell.border = thinBorder;
            };
            const applyBody = (cell: ExcelJS.Cell, centered = false) => {
                cell.border = thinBorder;
                cell.font = { size: 14, name: workbookFontName };
                cell.alignment = { horizontal: centered ? "center" : "left", vertical: "middle", wrapText: true };
            };

            const summarySheet = workbook.addWorksheet(t("ภาพรวมรีพอร์ต", "Report Summary"));
            summarySheet.columns = [
                { width: 18 },
                { width: 18 },
                { width: 18 },
                { width: 18 },
                { width: 18 },
                { width: 18 },
            ];
            summarySheet.mergeCells("A1:F2");
            const titleCell = summarySheet.getCell("A1");
            titleCell.value = `${t("รีพอร์ตการจองคิว", "Queue Booking Report")}\n${report.session?.title || sessionId}`;
            titleCell.fill = titleFill;
            titleCell.font = { bold: true, size: 22, color: { argb: "FFFFFFFF" }, name: workbookFontName };
            titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            titleCell.border = thinBorder;
            summarySheet.getRow(1).height = 26;
            summarySheet.getRow(2).height = 24;

            const paintKpi = (range: string, label: string, value: string | number, fill: ReturnType<typeof solidFill>) => {
                summarySheet.mergeCells(range);
                const cell = summarySheet.getCell(range.split(":")[0]);
                cell.value = `${label}\n${value}`;
                cell.fill = fill;
                cell.font = { bold: true, size: 18, color: { argb: "FF0F172A" }, name: workbookFontName };
                cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                cell.border = thinBorder;
            };

            paintKpi("A4:B5", t("ผู้ตรวจที่พบ", "Workers Found"), filteredWorkers.length, accentFill);
            paintKpi("C4:D5", t("คิวที่แสดง", "Bookings Shown"), filteredBookings.length, waitingFill);
            paintKpi("E4:F5", t("คิวสำเร็จ", "Completed"), completedCount, completedFill);
            paintKpi("A7:B8", t("กำลังรอ", "Waiting"), waitingCount, waitingFill);
            paintKpi("C7:D8", t("กำลังตรวจ", "In Progress"), inProgressCount, progressFill);
            paintKpi("E7:F8", t("หมดเวลา/ปฏิเสธ", "Timeout/Decline"), `${timeoutCount}/${rejectCount}`, accentFill);

            summarySheet.mergeCells("A9:F9");
            summarySheet.getCell("A9").value = `${t("ส่งออกเมื่อ", "Exported At")}: ${exportDate.toLocaleString(isEnglish ? "en-US" : "th-TH")}`;
            summarySheet.getCell("A9").alignment = { horizontal: "center", vertical: "middle" };
            summarySheet.getCell("A9").font = { bold: true, size: 13, color: { argb: "FF0F172A" }, name: workbookFontName };
            summarySheet.getCell("A9").fill = accentFill;
            summarySheet.getCell("A9").border = thinBorder;

            summarySheet.mergeCells("A11:B11");
            summarySheet.mergeCells("C11:F11");
            summarySheet.getCell("A11").value = t("Filter ที่ใช้", "Applied Filters");
            summarySheet.getCell("C11").value = [
                `${t("คำค้น", "Search")}: ${searchQuery || t("ทั้งหมด", "All")}`,
                `${t("สถานะ", "Status")}: ${statusFilter === "all" ? t("ทั้งหมด", "All") : getQueueBookingStatusLabel(statusFilter as "waiting" | "in_progress" | "completed" | "cancelled" | "no_show", isEnglish)}`,
                `${t("ประเภท", "Type")}: ${bookingTypeFilter === "all" ? t("ทั้งหมด", "All") : getQueueBookingTypeLabel(bookingTypeFilter as "grading" | "help", isEnglish)}`,
                `${t("ผู้ตรวจ", "Worker")}: ${workerFilter === "all" ? t("ทั้งหมด", "All") : workerOptions.find((worker) => String(worker.user_id) === workerFilter)?.full_name || workerFilter}`,
            ].join(" | ");
            ["A11", "C11"].forEach((address) => {
                const cell = summarySheet.getCell(address);
                cell.fill = subHeaderFill;
                cell.font = subHeaderFont;
                cell.border = thinBorder;
                cell.alignment = { vertical: "middle", horizontal: address === "A11" ? "center" : "left", wrapText: true };
            });

            const workerSheet = workbook.addWorksheet(t("สถิติผู้ตรวจ", "Worker Statistics"));
            workerSheet.columns = [
                { header: t("ผู้ตรวจ", "Worker"), key: "full_name", width: 28 },
                { header: t("รวมงาน", "Total"), key: "total_completed", width: 12 },
                { header: t("ตรวจงาน", "Grading"), key: "grading_completed", width: 12 },
                { header: t("ช่วยเหลือ", "Help"), key: "help_completed", width: 12 },
                { header: t("% งาน", "% Work"), key: "percent", width: 10 },
                { header: t("เปิดรับงานครั้งแรก", "First Opened"), key: "first_opened_at", width: 22 },
                { header: t("เปิดรับงานล่าสุด", "Last Opened"), key: "last_opened_at", width: 22 },
                { header: t("ปิดรับงานล่าสุด", "Last Closed"), key: "last_closed_at", width: 22 },
                { header: t("เปิดกี่ครั้ง", "Open Count"), key: "opened_count", width: 12 },
                { header: t("ปิดกี่ครั้ง", "Close Count"), key: "closed_count", width: 12 },
                { header: t("เวลาที่เปิดรวม", "Total Active Time"), key: "total_active_duration", width: 18 },
                { header: t("รับงาน", "Accepted"), key: "offer_accept_count", width: 10 },
                { header: t("ปฏิเสธ", "Declined"), key: "offer_reject_count", width: 10 },
                { header: t("หมดเวลา", "Timeout"), key: "offer_timeout_count", width: 10 },
                { header: t("ตอบรับ", "Accept Rate"), key: "offer_accept_rate", width: 12 },
                { header: t("พักถึง", "Paused Until"), key: "offer_paused_until", width: 22 },
            ];
            workerSheet.getRow(1).eachCell(applyHeader);
            filteredWorkers.forEach((worker) => {
                const row = workerSheet.addRow({
                    full_name: worker.full_name || `#${worker.user_id}`,
                    total_completed: worker.total_completed,
                    grading_completed: worker.grading_completed,
                    help_completed: worker.help_completed,
                    percent: `${worker.percent.toFixed(1)}%`,
                    first_opened_at: formatDateTime(worker.first_opened_at),
                    last_opened_at: formatDateTime(worker.last_opened_at),
                    last_closed_at: formatDateTime(worker.last_closed_at),
                    opened_count: worker.opened_count || 0,
                    closed_count: worker.closed_count || 0,
                    total_active_duration: worker.total_active_duration || "-",
                    offer_accept_count: worker.offer_accept_count || 0,
                    offer_reject_count: worker.offer_reject_count || 0,
                    offer_timeout_count: worker.offer_timeout_count || 0,
                    offer_accept_rate: `${(worker.offer_accept_rate || 0).toFixed(1)}%`,
                    offer_paused_until: formatDateTime(worker.offer_paused_until),
                });
                row.eachCell((cell, columnNumber) => applyBody(cell, columnNumber !== 1 && columnNumber !== 6 && columnNumber !== 7 && columnNumber !== 8 && columnNumber !== 11 && columnNumber !== 16));
                if ((worker.percent || 0) >= 50) {
                    row.getCell(5).fill = completedFill;
                }
            });

            const rejectReasonSheet = workbook.addWorksheet(t("เหตุผลการปฏิเสธ", "Decline Reasons"));
            rejectReasonSheet.columns = [
                { header: t("รหัสเหตุผล", "Reason Code"), key: "code", width: 24 },
                { header: t("เหตุผล", "Reason"), key: "label", width: 40 },
                { header: t("จำนวนครั้ง", "Count"), key: "count", width: 14 },
                { header: t("สัดส่วน", "Share"), key: "percent", width: 14 },
            ];
            rejectReasonSheet.getRow(1).eachCell(applyHeader);
            (report.reject_reason_stats || []).forEach((reason) => {
                const row = rejectReasonSheet.addRow({
                    code: reason.code,
                    label: isEnglish ? reason.label_en : reason.label_th,
                    count: reason.count,
                    percent: `${((reason.count / Math.max(1, totalRejectByReason)) * 100).toFixed(1)}%`,
                });
                row.eachCell((cell, columnNumber) => applyBody(cell, columnNumber === 3 || columnNumber === 4));
            });

            const bookingSheet = workbook.addWorksheet(t("ประวัติคิว", "Booking History"));
            bookingSheet.columns = [
                { header: t("เวลาจอง", "Booked At"), key: "created_at", width: 22 },
                { header: t("คิว", "Queue"), key: "queue_number", width: 10 },
                { header: t("โต๊ะ", "Desk"), key: "desk_number", width: 10 },
                { header: t("ประเภท", "Type"), key: "booking_type", width: 12 },
                { header: t("ผู้จอง", "Student"), key: "student_name", width: 28 },
                { header: t("รหัสนักศึกษา", "Student ID"), key: "student_code", width: 16 },
                { header: "IP", key: "booking_ip", width: 18 },
                { header: t("อุปกรณ์", "Device"), key: "booking_device", width: 24 },
                { header: t("สถานะ", "Status"), key: "status", width: 14 },
                { header: t("ผู้ตรวจ", "Worker"), key: "worker_name", width: 24 },
                { header: t("เวลารอ", "Wait Time"), key: "wait_duration", width: 16 },
                { header: t("เวลาตรวจ", "Service Time"), key: "service_duration", width: 16 },
                { header: t("หมดเวลา", "Timeout"), key: "timeout_count", width: 10 },
                { header: t("ปฏิเสธ", "Declined"), key: "reject_count", width: 10 },
                { header: t("หมายเหตุ", "Note"), key: "worker_note", width: 30 },
            ];
            bookingSheet.getRow(1).eachCell(applyHeader);
            filteredBookings.forEach((booking) => {
                const row = bookingSheet.addRow({
                    created_at: formatDateTime(booking.created_at),
                    queue_number: booking.queue_number,
                    desk_number: booking.desk_number,
                    booking_type: getQueueBookingTypeLabel(booking.booking_type, isEnglish),
                    student_name: booking.student?.full_name || "-",
                    student_code: booking.student?.student_id || "-",
                    booking_ip: booking.booking_ip || "-",
                    booking_device: booking.booking_device || "-",
                    status: getQueueBookingStatusLabel(booking.status, isEnglish),
                    worker_name: booking.assigned_worker?.full_name || "-",
                    wait_duration: booking.wait_duration || "-",
                    service_duration: booking.service_duration || "-",
                    timeout_count: booking.timeout_count || 0,
                    reject_count: booking.reject_count || 0,
                    worker_note: booking.worker_note || "-",
                });
                row.eachCell((cell, columnNumber) => applyBody(cell, ![1, 5, 6, 7, 8, 10, 15].includes(columnNumber)));
                const statusCell = row.getCell(9);
                if (booking.status === "completed") statusCell.fill = completedFill;
                if (booking.status === "waiting") statusCell.fill = waitingFill;
                if (booking.status === "in_progress") statusCell.fill = progressFill;
            });

            [summarySheet, workerSheet, rejectReasonSheet, bookingSheet].forEach((sheet) => {
                sheet.views = [{ state: "frozen", ySplit: 1 }];
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const fileName = [
                sanitizeFileNameSegment(report.course?.code || courseId),
                sanitizeFileNameSegment(report.session?.title || sessionId),
                formatExportDate(exportDate),
            ].join("_");
            triggerDownload(buffer as ArrayBuffer, `${fileName}.xlsx`);
            addToast({
                title: t("ส่งออกสำเร็จ", "Export complete"),
                description: t("ดาวน์โหลดไฟล์รีพอร์ตเรียบร้อยแล้ว", "The report file has been downloaded successfully."),
                color: "success",
            });
        } catch (exportError) {
            console.error("Export queue report failed:", exportError);
            addToast({
                title: t("ส่งออกไม่สำเร็จ", "Export failed"),
                description: !isEnglish && exportError instanceof Error
                    ? exportError.message
                    : t("ไม่สามารถสร้างไฟล์รีพอร์ตได้", "Unable to generate the report file."),
                color: "danger",
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-420 space-y-6 p-4 sm:p-6">
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-foreground">{t("รีพอร์ตการจองคิว", "Queue Booking Report")}</h1>
                    <p className="text-sm text-default-500">{report?.session?.title || t("ดูประวัติการจองคิวและสถิติการทำงานใน session นี้", "Review booking history and worker performance for this session.")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        color="success"
                        isLoading={isExporting}
                        startContent={!isExporting ? <Icon icon="solar:download-bold" className="text-lg" /> : undefined}
                        onPress={handleExport}
                        className="bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    >
                        {t("ส่งออก Excel", "Export Excel")}
                    </Button>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((item) => (
                    <Card key={item.label} className="border border-default-200 bg-content1 shadow-sm">
                        <CardBody className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={`rounded-xl p-2.5 ${item.bgClass}`}>
                                    <Icon icon={item.icon} className={`text-2xl ${item.iconClass}`} aria-label={item.label} />
                                </div>
                                <div>
                                    <p className="text-xs text-default-500">{item.label}</p>
                                    <p className="text-2xl font-bold text-foreground">{item.value}</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                ))}
            </div>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="pb-0">
                    <div>
                        <h2 className="text-lg font-semibold">{t("สรุปเหตุผลการปฏิเสธ", "Decline Reason Summary")}</h2>
                        <p className="text-sm text-default-500">{t("สรุปจำนวนการปฏิเสธงานตามเหตุผลมาตรฐานใน session นี้", "Summary of declined offers by standard reason for this session.")}</p>
                    </div>
                </CardHeader>
                <CardBody>
                    <Table removeWrapper aria-label={t("สรุปเหตุผลการปฏิเสธ", "Decline reason summary")}>
                        <TableHeader>
                            <TableColumn>{t("เหตุผล", "Reason")}</TableColumn>
                            <TableColumn>{t("จำนวนครั้ง", "Count")}</TableColumn>
                            <TableColumn>{t("สัดส่วน", "Share")}</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent={t("ยังไม่มีการปฏิเสธงาน", "No declined offers found.")}>
                            {rejectReasonStats.map((reason) => (
                                <TableRow key={reason.code}>
                                    <TableCell>{isEnglish ? reason.label_en : reason.label_th}</TableCell>
                                    <TableCell>{reason.count}</TableCell>
                                    <TableCell>{`${((reason.count / Math.max(1, totalRejectByReason)) * 100).toFixed(1)}%`}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardBody>
            </Card>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardBody className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <Input
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                            placeholder={t("ค้นหาผู้จอง, ผู้ตรวจ, IP, โต๊ะ...", "Search by student, worker, IP, or desk...")}
                            size="md"
                            variant="bordered"
                            isClearable
                            startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                            className="flex-1"
                            classNames={{
                                inputWrapper: "border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                label: "text-blue-400 text-sm",
                            }}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row lg:flex-none">
                            <Select
                                placeholder={t("ทุกสถานะ", "All statuses")}
                                aria-label={t("กรองตามสถานะคิว", "Filter by queue status")}
                                selectedKeys={[statusFilter]}
                                onSelectionChange={(keys) => setStatusFilter((Array.from(keys)[0] as string) || "all")}
                                className="w-full sm:w-40 lg:w-44"
                                variant="bordered"
                                size="md"
                            >
                                <SelectItem key="all">{t("ทุกสถานะ", "All statuses")}</SelectItem>
                                <SelectItem key="waiting">{t("รอคิว", "Waiting")}</SelectItem>
                                <SelectItem key="in_progress">{t("กำลังตรวจ", "In Progress")}</SelectItem>
                                <SelectItem key="completed">{t("เสร็จสิ้น", "Completed")}</SelectItem>
                                <SelectItem key="cancelled">{t("ยกเลิก", "Cancelled")}</SelectItem>
                                <SelectItem key="no_show">{t("ถูกข้าม", "Skipped")}</SelectItem>
                            </Select>
                            <Select
                                placeholder={t("ทุกประเภท", "All types")}
                                aria-label={t("กรองตามประเภทคิว", "Filter by queue type")}
                                selectedKeys={[bookingTypeFilter]}
                                onSelectionChange={(keys) => setBookingTypeFilter((Array.from(keys)[0] as string) || "all")}
                                className="w-full sm:w-40 lg:w-44"
                                variant="bordered"
                                size="md"
                            >
                                <SelectItem key="all">{t("ทุกประเภท", "All types")}</SelectItem>
                                <SelectItem key="grading">{t("ตรวจงาน", "Grading")}</SelectItem>
                                <SelectItem key="help">{t("ช่วยเหลือ", "Help")}</SelectItem>
                            </Select>
                            <Select
                                aria-label={t("กรองตามผู้ตรวจ", "Filter by worker")}
                                items={workerSelectItems}
                                selectedKeys={[workerFilter]}
                                onSelectionChange={(keys) => setWorkerFilter((Array.from(keys)[0] as string) || "all")}
                                className="w-full sm:w-48 lg:w-52"
                                variant="bordered"
                                size="md"
                            >
                                {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
                            </Select>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {error ? (
                <Card className="border border-danger-200 bg-danger-50">
                    <CardBody className="text-danger-700">{error}</CardBody>
                </Card>
            ) : null}

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="pb-0">
                    <div>
                        <h2 className="text-lg font-semibold">{t("สถิติผู้ตรวจ", "Worker Statistics")}</h2>
                        <p className="text-sm text-default-500">{t("สัดส่วนงานพร้อมเวลาเปิด-ปิดรับงานของผู้ตรวจใน session นี้", "Work distribution and queue availability timeline for workers in this session.")}</p>
                    </div>
                </CardHeader>
                <CardBody>
                    <Table removeWrapper aria-label={t("สถิติผู้ตรวจในคิว", "Queue worker statistics")}>
                        <TableHeader>
                            <TableColumn>{t("ผู้ตรวจ", "Worker")}</TableColumn>
                            <TableColumn>{t("รวม", "Total")}</TableColumn>
                            <TableColumn>{t("ตรวจงาน", "Grading")}</TableColumn>
                            <TableColumn>{t("ช่วยเหลือ", "Help")}</TableColumn>
                            <TableColumn>{t("% งาน", "% Work")}</TableColumn>
                            <TableColumn>{t("เปิดครั้งแรก", "First Opened")}</TableColumn>
                            <TableColumn>{t("เปิดล่าสุด", "Last Opened")}</TableColumn>
                            <TableColumn>{t("ปิดล่าสุด", "Last Closed")}</TableColumn>
                            <TableColumn>{t("เปิด/ปิด", "Open/Close")}</TableColumn>
                            <TableColumn>{t("เวลาเปิดรวม", "Total Active Time")}</TableColumn>
                            <TableColumn>{t("รับ/ปฏิเสธ/หมดเวลา", "Accept/Decline/Timeout")}</TableColumn>
                            <TableColumn>{t("% ตอบรับ", "Accept %")}</TableColumn>
                            <TableColumn>{t("พักถึง", "Paused Until")}</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent={t("ยังไม่มีข้อมูลผู้ตรวจ", "No worker data found.")}>
                            {filteredWorkers.map((worker) => (
                                <TableRow key={worker.user_id}>
                                    <TableCell>{worker.full_name || `#${worker.user_id}`}</TableCell>
                                    <TableCell>{worker.total_completed}</TableCell>
                                    <TableCell>{worker.grading_completed}</TableCell>
                                    <TableCell>{worker.help_completed}</TableCell>
                                    <TableCell>{worker.percent.toFixed(1)}%</TableCell>
                                    <TableCell>{formatDateTime(worker.first_opened_at)}</TableCell>
                                    <TableCell>{formatDateTime(worker.last_opened_at)}</TableCell>
                                    <TableCell>{formatDateTime(worker.last_closed_at)}</TableCell>
                                    <TableCell>{`${worker.opened_count || 0} / ${worker.closed_count || 0}`}</TableCell>
                                    <TableCell>{worker.total_active_duration || "-"}</TableCell>
                                    <TableCell>{`${worker.offer_accept_count || 0} / ${worker.offer_reject_count || 0} / ${worker.offer_timeout_count || 0}`}</TableCell>
                                    <TableCell>{`${(worker.offer_accept_rate || 0).toFixed(1)}%`}</TableCell>
                                    <TableCell>{formatDateTime(worker.offer_paused_until)}</TableCell>
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
                        <p className="text-sm text-default-500">{t("ดูเวลาจอง โต๊ะ ผู้ตรวจ และระยะเวลาที่ใช้ในแต่ละคิว", "Review booking time, desk, worker, and durations for each queue entry.")}</p>
                    </div>
                </CardHeader>
                <CardBody>
                    <Table removeWrapper aria-label={t("ประวัติการจองคิว", "Queue booking report")} classNames={{ base: "min-w-[1280px]" }}>
                        <TableHeader>
                            <TableColumn>{t("เวลาจอง", "Booked At")}</TableColumn>
                            <TableColumn>{t("คิว", "Queue")}</TableColumn>
                            <TableColumn>{t("โต๊ะ", "Desk")}</TableColumn>
                            <TableColumn>{t("ประเภท", "Type")}</TableColumn>
                            <TableColumn>{t("ผู้จอง", "Student")}</TableColumn>
                            <TableColumn>IP</TableColumn>
                            <TableColumn>{t("อุปกรณ์", "Device")}</TableColumn>
                            <TableColumn>{t("สถานะ", "Status")}</TableColumn>
                            <TableColumn>{t("ผู้ตรวจ", "Worker")}</TableColumn>
                            <TableColumn>{t("เวลารอ", "Wait Time")}</TableColumn>
                            <TableColumn>{t("เวลาตรวจ", "Service Time")}</TableColumn>
                            <TableColumn>{t("หมดเวลา", "Timeout")}</TableColumn>
                            <TableColumn>{t("ปฏิเสธ", "Declined")}</TableColumn>
                            <TableColumn>{t("หมายเหตุ", "Note")}</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent={t("ยังไม่มีประวัติการจองคิว", "No booking history found.")}>
                            {paginatedBookings.map((booking) => (
                                <TableRow key={booking.id}>
                                    <TableCell>{new Date(booking.created_at).toLocaleString(isEnglish ? "en-US" : "th-TH")}</TableCell>
                                    <TableCell>{booking.queue_number}</TableCell>
                                    <TableCell>{booking.desk_number}</TableCell>
                                    <TableCell>{getQueueBookingTypeLabel(booking.booking_type, isEnglish)}</TableCell>
                                    <TableCell>
                                        <div className="min-w-44">
                                            <div className="font-medium text-foreground">{booking.student?.full_name || "-"}</div>
                                            <div className="text-xs text-default-500">{booking.student?.student_id || "-"}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{booking.booking_ip || "-"}</TableCell>
                                    <TableCell>{booking.booking_device || "-"}</TableCell>
                                    <TableCell>
                                        <Chip size="sm" color={getStatusColor(booking.status)} variant="flat">
                                            {getQueueBookingStatusLabel(booking.status, isEnglish)}
                                        </Chip>
                                    </TableCell>
                                    <TableCell>{booking.assigned_worker?.full_name || "-"}</TableCell>
                                    <TableCell>{booking.wait_duration || "-"}</TableCell>
                                    <TableCell>{booking.service_duration || "-"}</TableCell>
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
                                        onSelectionChange={(keys) => setBookingsPerPage((Array.from(keys)[0] as string) || "10")}
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
                            <div className="flex justify-end">
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
                        </div>
                    ) : null}
                </CardBody>
            </Card>
        </div>
    );
}
