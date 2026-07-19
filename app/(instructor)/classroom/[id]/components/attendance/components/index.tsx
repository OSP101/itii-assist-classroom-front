/**
 * AttendanceTab Sub-components
 * Memoized components for better performance
 */

"use client";

import React, { memo, Suspense, lazy, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Skeleton } from "@heroui/skeleton";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Divider } from "@heroui/divider";
import { addToast } from "@heroui/toast";
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
import { Icon } from "@iconify/react";
import { type DateValue, getLocalTimeZone, parseDateTime, CalendarDateTime } from "@internationalized/date";
import { QRCodeSVG } from "qrcode.react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import TablePaginationFooter, { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/components/ui/table-pagination-footer";
import {
    useHorizontalOverflow,
    STICKY_SCROLL_CONTAINER_CLASS,
    STICKY_ACTION_HEADER_CLASS,
    STICKY_ACTION_CELL_CLASS,
} from "../../shared/stickyActionColumn";

import {
    type SessionWithComputedStatus,
    type AttendanceStats,
    type Section,
    type CreateAttendanceData,
    RADIUS_OPTIONS,
    formatDate,
    formatTime,
    getSessionTypeDisplay,
    getStatusDisplay,
} from "../config";
import { type AttendanceSession, type TimeChangePreview, type TimeChangeRecord, type SectionChangePreview } from "@/services/attendance.service";
import { getAppUrl } from "@/lib/app-url";
import DisplayScannerModal from "./DisplayScannerModal";

// Lazy load LocationPicker
const LocationPicker = lazy(() => import("@/components/map/LocationPicker"));

// ============================================================================
// Custom DateTime Input (Native HTML styled like HeroUI)
// ============================================================================

/** Convert a DateValue to the "YYYY-MM-DDTHH:MM" string required by <input type="datetime-local"> */
const toDateTimeLocalStr = (dateValue: DateValue): string => {
    try {
        const date = dateValue.toDate(getLocalTimeZone());
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
        return "";
    }
};

/** Return "YYYY-MM-DDT23:59" for the same calendar day as the given DateValue */
const endOfDayStr = (dateValue: DateValue): string => {
    try {
        const base = toDateTimeLocalStr(dateValue);
        return base.slice(0, 11) + "23:59"; // keep date, replace time
    } catch {
        return "";
    }
};

interface DateTimeInputProps {
    label: string;
    value: DateValue;
    onChange: (value: DateValue) => void;
    description?: string;
    isRequired?: boolean;
    isDisabled?: boolean;
    colorScheme?: "blue" | "amber";
    /** HTML datetime-local min constraint ("YYYY-MM-DDTHH:MM") */
    min?: string;
    /** HTML datetime-local max constraint ("YYYY-MM-DDTHH:MM") */
    max?: string;
}

const DateTimeInput = memo(function DateTimeInput({
    label,
    value,
    onChange,
    description,
    isRequired = false,
    isDisabled = false,
    colorScheme = "blue",
    min,
    max,
}: DateTimeInputProps) {
    // Convert datetime-local string to DateValue
    const fromDateTimeLocal = (dateTimeStr: string): DateValue | null => {
        if (!dateTimeStr) return null;
        try {
            // dateTimeStr format: "YYYY-MM-DDTHH:MM"
            const [datePart, timePart] = dateTimeStr.split("T");
            const [year, month, day] = datePart.split("-").map(Number);
            const [hour, minute] = timePart.split(":").map(Number);
            return new CalendarDateTime(year, month, day, hour, minute);
        } catch {
            return null;
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = fromDateTimeLocal(e.target.value);
        if (newValue) {
            onChange(newValue);
        }
    };

    const borderColor = colorScheme === "amber"
        ? "border-default-200 hover:border-amber-300 focus:border-amber-500 focus:ring-amber-500/20"
        : "border-default-200 hover:border-blue-300 focus:border-blue-500 focus:ring-blue-500/20";

    return (
        <div className="flex min-w-0 w-full max-w-full flex-col gap-1.5 overflow-hidden">
            <label className="text-sm font-medium text-default-700">
                {label}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
                type="datetime-local"
                value={toDateTimeLocalStr(value)}
                onChange={handleChange}
                disabled={isDisabled}
                min={min}
                max={max}
                className={`box-border h-10 min-w-0 w-full max-w-full rounded-xl border-2 bg-content1 px-4 py-0 ${borderColor}
                    text-foreground text-sm transition-all duration-200
                    focus:outline-none focus:ring-4
                    placeholder:text-default-400 disabled:cursor-not-allowed disabled:opacity-60`}
            />
            {description && (
                <p className={`text-xs font-medium ${colorScheme === "amber" ? "text-amber-600" : "text-default-500"}`}>
                    {description}
                </p>
            )}
        </div>
    );
});

// ============================================================================
// Loading Skeleton
// ============================================================================

export const AttendanceTableSkeleton = memo(function AttendanceTableSkeleton() {
    return (
        <Card className="border border-default-200 bg-content1 shadow-sm">
            <CardBody className="p-2">
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-3">
                            <Skeleton className="w-10 h-10 rounded-xl" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="w-48 h-4 rounded-lg" />
                                <Skeleton className="w-32 h-3 rounded-lg" />
                            </div>
                            <Skeleton className="w-20 h-6 rounded-full" />
                            <Skeleton className="w-24 h-8 rounded-lg" />
                        </div>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
});

export const StatsSkeleton = memo(function StatsSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="border border-default-200 bg-content1 shadow-sm">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-12 h-12 rounded-xl" />
                            <div className="space-y-2">
                                <Skeleton className="w-20 h-3 rounded-lg" />
                                <Skeleton className="w-8 h-6 rounded-lg" />
                            </div>
                        </div>
                    </CardBody>
                </Card>
            ))}
        </div>
    );
});

// ============================================================================
// Stats Cards
// ============================================================================

interface StatsCardsProps {
    stats: AttendanceStats;
}

export const StatsCards = memo(function StatsCards({ stats }: StatsCardsProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const items = [
        {
            label: isEnglish ? "Total" : "ทั้งหมด",
            value: stats.total,
            icon: "solar:calendar-bold",
            iconClass: "text-blue-600",
            bgClass: "bg-blue-100",
        },
        {
            label: isEnglish ? "Active" : "กำลังเปิด",
            value: stats.active,
            icon: "solar:play-circle-bold",
            iconClass: "text-emerald-600",
            bgClass: "bg-emerald-100",
        },
        {
            label: isEnglish ? "Draft" : "ฉบับร่าง",
            value: stats.draft,
            icon: "solar:document-bold",
            iconClass: "text-default-600",
            bgClass: "bg-content3",
        },
        {
            label: isEnglish ? "Closed" : "ปิดแล้ว",
            value: stats.closed,
            icon: "solar:stop-circle-bold",
            iconClass: "text-red-600",
            bgClass: "bg-red-100",
        },
    ];

    return (
        <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((item) => (
                <Card key={item.label} className="border border-default-200 bg-content1 shadow-sm">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 ${item.bgClass} rounded-xl`}>
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
    );
});

// ============================================================================
// Filters Card
// ============================================================================

interface FiltersCardProps {
    searchQuery: string;
    statusFilter: string;
    typeFilter: string;
    onSearchChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    onTypeChange: (value: string) => void;
}

export const FiltersCard = memo(function FiltersCard({
    searchQuery,
    statusFilter,
    typeFilter,
    onSearchChange,
    onStatusChange,
    onTypeChange,
}: FiltersCardProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    return (
        <Card className="border border-default-200 bg-content1 shadow-sm">
            <CardBody className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                        placeholder={isEnglish ? "Search attendance sessions..." : "ค้นหาชื่อรอบการเช็คชื่อ..."}
                        value={searchQuery}
                        onValueChange={onSearchChange}
                        startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                        className="flex-1"
                        size="md"
                        variant="bordered"
                        isClearable
                        classNames={{
                            inputWrapper: "border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                            label: "text-blue-400 text-sm",
                        }}
                    />
                    <div className="flex gap-2">
                        <Select
                            placeholder={isEnglish ? "Status" : "สถานะ"}
                            aria-label={isEnglish ? "Filter by status" : "กรองตามสถานะ"}
                            selectedKeys={[statusFilter]}
                            onSelectionChange={(keys) => onStatusChange(Array.from(keys)[0] as string)}
                            className="w-full sm:w-40"
                            variant="bordered"
                            size="md"
                        >
                            <SelectItem key="all">{isEnglish ? "All statuses" : "ทุกสถานะ"}</SelectItem>
                            <SelectItem key="draft">{getStatusDisplay("draft", isEnglish).label}</SelectItem>
                            <SelectItem key="active">{getStatusDisplay("active", isEnglish).label}</SelectItem>
                            <SelectItem key="closed">{getStatusDisplay("closed", isEnglish).label}</SelectItem>
                        </Select>
                        <Select
                            placeholder={isEnglish ? "Type" : "ประเภท"}
                            aria-label={isEnglish ? "Filter by type" : "กรองตามประเภท"}
                            selectedKeys={[typeFilter]}
                            onSelectionChange={(keys) => onTypeChange(Array.from(keys)[0] as string)}
                            className="w-full sm:w-40"
                            variant="bordered"
                            size="md"
                        >
                            <SelectItem key="all">{isEnglish ? "All types" : "ทุกประเภท"}</SelectItem>
                            <SelectItem key="lecture">{getSessionTypeDisplay("lecture", isEnglish).label}</SelectItem>
                            <SelectItem key="lab">{getSessionTypeDisplay("lab", isEnglish).label}</SelectItem>
                            <SelectItem key="online">{getSessionTypeDisplay("online", isEnglish).label}</SelectItem>
                        </Select>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
});

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
    onCreateClick: () => void;
    isCourseActive?: boolean;
    canCreateAttendanceSessions?: boolean;
}

export const EmptyState = memo(function EmptyState({ onCreateClick, isCourseActive = true, canCreateAttendanceSessions = false }: EmptyStateProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    return (
        <Card className="border border-dashed border-default-300 bg-content2/50 shadow-sm">
            <CardBody className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                    <Icon
                        icon="solar:clipboard-check-bold-duotone"
                        className="text-5xl text-blue-500"
                        aria-label={isEnglish ? "No attendance sessions" : "ยังไม่มีรอบการเช็คชื่อ"}
                    />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-default-700">{isEnglish ? "No attendance sessions yet" : "ยังไม่มีรอบการเช็คชื่อ"}</h3>
                <p className="mx-auto mb-6 max-w-md text-default-500">
                    {isEnglish ? "Create an attendance session so students can check in." : "สร้างรอบการเช็คชื่อเพื่อให้นักศึกษาสามารถเช็คชื่อเข้าเรียนได้"}
                </p>
                {canCreateAttendanceSessions && (
                    <Button
                        color="primary"
                        startContent={<Icon icon="solar:add-circle-bold" />}
                        onPress={onCreateClick}
                        isDisabled={!isCourseActive}
                        className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                    >
                        {isEnglish ? "Create first attendance session" : "สร้างรอบเช็คชื่อแรก"}
                    </Button>
                )}
            </CardBody>
        </Card>
    );
});

// ============================================================================
// QR Code Preview Modal (for draft sessions - schedule posting)
// ============================================================================

interface QRPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: SessionWithComputedStatus | null;
}

export const QRPreviewModal = memo(function QRPreviewModal({
    isOpen,
    onClose,
    session,
}: QRPreviewModalProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    if (!session) return null;

    const checkInUrl = getAppUrl(`/check-in/${session.id}`);
    const isStaticPinSession = session.pin_mode === "static" || (session.pin_mode == null && !session.auto_rotate_pin);

    const copyPIN = () => {
        if (session.pin_code) {
            navigator.clipboard.writeText(session.pin_code);
            addToast({
                title: isEnglish ? "Copied" : "คัดลอกแล้ว",
                description: isEnglish ? "PIN copied to clipboard." : "PIN ถูกคัดลอกไปยังคลิปบอร์ดแล้ว",
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        }
    };

    const copyURL = () => {
        navigator.clipboard.writeText(checkInUrl);
        addToast({
            title: isEnglish ? "Copied" : "คัดลอกแล้ว",
            description: isEnglish ? "Check-in link copied to clipboard." : "ลิงก์เช็คชื่อถูกคัดลอกไปยังคลิปบอร์ดแล้ว",
            color: "success",
            timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
    };

    const downloadQR = () => {
        const svg = document.getElementById("qr-code-preview");
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.download = `${isEnglish ? "attendance" : "check-in"}-${session.title}-${session.pin_code || "rotating-pin"}.png`;
            downloadLink.href = pngFile;
            downloadLink.click();
        };

        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <ModalContent>
                <ModalHeader className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl">
                        <Icon icon="solar:qr-code-bold" className="text-xl text-blue-600" />
                    </div>
                    <div>
                        <p className="font-semibold">{isEnglish ? "QR code and PIN" : "QR Code และ PIN"}</p>
                        <p className="text-sm font-normal text-default-500">{isEnglish ? "For scheduled posting" : "สำหรับตั้งเวลาโพสต์"}</p>
                    </div>
                </ModalHeader>
                <Divider />
                <ModalBody className="py-6">


                    {/* QR Code */}
                    <div className="text-center mb-3">
                        <p className="mb-3 text-xs uppercase tracking-wider text-default-400">QR CODE</p>
                        <div className="inline-block rounded-xl border-2 border-default-200 bg-content1 p-4">
                            <QRCodeSVG
                                id="qr-code-preview"
                                value={checkInUrl}
                                size={300}
                                level="L"
                                fgColor="#000000"
                                bgColor="#ffffff"
                                marginSize={0}
                            />
                        </div>
                    </div>

                    {/* PIN Code */}
                    <div className="text-center mb-3">
                        <p className="mb-2 text-xs uppercase tracking-wider text-default-400">PIN CODE</p>
                        {session.pin_code ? (
                            <div
                                className="inline-block px-8 py-4 bg-linear-to-r from-blue-500 to-indigo-500 rounded-2xl cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-colors"
                                onClick={copyPIN}
                            >
                                <div className="flex gap-4 px-5">
                                    {session.pin_code.split("").map((digit, index) => (
                                        <span key={index} className="text-4xl font-bold text-white font-mono">
                                            {digit}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="inline-block rounded-2xl border border-dashed border-default-300 bg-content2 px-6 py-5 text-sm text-default-500">
                                {isStaticPinSession
                                    ? (isEnglish ? "This session uses one fixed PIN, but it is not ready yet." : "รอบนี้ใช้ PIN คงที่ แต่ยังไม่พร้อมแสดงในขณะนี้")
                                    : (isEnglish ? "PIN will appear when check-in opens and rotate every minute." : "PIN จะปรากฏเมื่อเริ่มรอบเช็คชื่อ และจะเปลี่ยนทุก 1 นาที")}
                            </div>
                        )}
                    </div>

                    {/* URL */}
                    <div className="rounded-xl bg-content2 p-3">
                        <p className="mb-1 text-xs text-default-400">{isEnglish ? "Check-in link" : "ลิงก์เช็คชื่อ"}</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 truncate rounded-lg border border-default-200 bg-content1 px-3 py-2 text-sm text-blue-600">
                                {checkInUrl}
                            </code>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                color="primary"
                                onPress={copyURL}
                            >
                                <Icon icon="solar:copy-bold" />
                            </Button>
                        </div>
                    </div>


                </ModalBody>
                <Divider />
                <ModalFooter>
                    <Button variant="flat" onPress={onClose}>
                        {isEnglish ? "Close" : "ปิด"}
                    </Button>
                    <Button
                        color="primary"
                        startContent={<Icon icon="solar:download-bold" />}
                        onPress={downloadQR}
                    >
                        {isEnglish ? "Download QR" : "ดาวน์โหลด QR"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
});

// ============================================================================
// Session Table Row
// ============================================================================

interface SessionRowActionsProps {
    session: SessionWithComputedStatus;
    courseId: string;
    isCourseActive?: boolean;
    onActivate: (session: AttendanceSession) => void;
    onEdit: (session: AttendanceSession) => void;
    onDelete: (session: AttendanceSession) => void;
    onClose: (session: AttendanceSession) => void;
    onShowQR?: (session: SessionWithComputedStatus) => void;
    onScanProjector?: (session: SessionWithComputedStatus) => void;
    canUpdateAttendanceSessions?: boolean;
    canDeleteAttendanceSessions?: boolean;
}

const SessionRowActions = memo(function SessionRowActions({
    session,
    courseId,
    isCourseActive = true,
    onActivate,
    onEdit,
    onDelete,
    onClose,
    onShowQR,
    onScanProjector,
    canUpdateAttendanceSessions = false,
    canDeleteAttendanceSessions = false,
}: SessionRowActionsProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    if (session.status === "draft") {
        return (
            <>
                <Tooltip content={isEnglish ? "View QR/PIN" : "ดู QR/PIN"}>
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="secondary"
                        onPress={() => onShowQR?.(session)}
                    >
                        <Icon icon="solar:qr-code-bold" className="text-xl" />
                    </Button>
                </Tooltip>
                <Tooltip content={isEnglish ? "Connect projector display" : "เชื่อมต่อหน้าจอฉาย"}>
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="primary"
                        onPress={() => onScanProjector?.(session)}
                    >
                        <Icon icon="solar:camera-minimalistic-bold-duotone" className="text-xl" />
                    </Button>
                </Tooltip>
                {canUpdateAttendanceSessions && (
                    <Tooltip content={isEnglish ? "Open now" : "เริ่มเปิดเช็คชื่อทันที"}>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="success"
                            isDisabled={!isCourseActive}
                            onPress={() => onActivate(session)}
                        >
                            <Icon icon="solar:play-bold" className="text-xl" />
                        </Button>
                    </Tooltip>
                )}
                {canUpdateAttendanceSessions && (
                    <Tooltip content={isEnglish ? "Edit" : "แก้ไข"}>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="primary"
                            isDisabled={!isCourseActive}
                            onPress={() => onEdit(session)}
                        >
                            <Icon icon="solar:pen-bold" className="text-xl" />
                        </Button>
                    </Tooltip>
                )}
                {canDeleteAttendanceSessions && (
                    <Tooltip content={isEnglish ? "Delete" : "ลบ"} color="danger">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            isDisabled={!isCourseActive}
                            onPress={() => onDelete(session)}
                        >
                            <Icon icon="solar:trash-bin-trash-bold" className="text-xl" />
                        </Button>
                    </Tooltip>
                )}
            </>
        );
    }

    if (session.status === "active") {
        return (
            <>
                <Tooltip content={isEnglish ? "Open attendance page" : "ดูหน้าเช็คชื่อ"}>
                    <Link
                        className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-content2"
                        href={`/attendance/${courseId}/session/${session.id}/live`}
                        target="_blank"
                    >
                        <Icon icon="solar:eye-bold" className="text-xl text-blue-600" />
                    </Link>
                </Tooltip>
                <Tooltip content={isEnglish ? "Connect projector display" : "เชื่อมต่อหน้าจอฉาย"}>
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="primary"
                        onPress={() => onScanProjector?.(session)}
                    >
                        <Icon icon="solar:camera-minimalistic-bold-duotone" className="text-xl" />
                    </Button>
                </Tooltip>
                <Tooltip content={isEnglish ? "View summary" : "ดูสรุป"}>
                    <Link
                        className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-content2"
                        href={`/classroom/${courseId}/attendance/${session.id}/summary`}
                        target="_blank"
                    >
                        <Icon icon="solar:chart-bold" className="text-xl" />
                    </Link>
                </Tooltip>
                {canUpdateAttendanceSessions && (
                    <Tooltip content={isEnglish ? "Edit time" : "แก้ไขเวลา"}>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="primary"
                            isDisabled={!isCourseActive}
                            onPress={() => onEdit(session)}
                        >
                            <Icon icon="solar:pen-bold" className="text-xl" />
                        </Button>
                    </Tooltip>
                )}
                {canUpdateAttendanceSessions && (
                    <Tooltip content={isEnglish ? "Close now" : "ปิดทันที"} color="danger">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            isDisabled={!isCourseActive}
                            onPress={() => onClose(session)}
                        >
                            <Icon icon="solar:stop-bold" className="text-xl" />
                        </Button>
                    </Tooltip>
                )}
            </>
        );
    }

    // closed status
    return (
        <>
            <Tooltip content={isEnglish ? "Open attendance page" : "ดูหน้าเช็คชื่อ"}>
                <Link
                    className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-content2"
                    href={`/attendance/${courseId}/session/${session.id}/live`}
                    target="_blank"
                >
                    <Icon icon="solar:eye-bold" className="text-xl" />
                </Link>
            </Tooltip>
            <Tooltip content={isEnglish ? "View summary" : "ดูสรุป"}>
                <Link
                    className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-content2"
                    href={`/classroom/${courseId}/attendance/${session.id}/summary`}
                    target="_blank"
                >
                    <Icon icon="solar:chart-bold" className="text-xl" />
                </Link>
            </Tooltip>
            {canUpdateAttendanceSessions && (
                <Tooltip content={isEnglish ? "Edit title" : "แก้ไขชื่อ"}>
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="primary"
                        isDisabled={!isCourseActive}
                        onPress={() => onEdit(session)}
                    >
                        <Icon icon="solar:pen-bold" className="text-xl" />
                    </Button>
                </Tooltip>
            )}

            {canDeleteAttendanceSessions && (
                <Tooltip content={isEnglish ? "Delete" : "ลบ"} color="danger">
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        isDisabled={!isCourseActive}
                        onPress={() => onDelete(session)}
                    >
                        <Icon icon="solar:trash-bin-trash-bold" className="text-xl" />
                    </Button>
                </Tooltip>
            )}
        </>
    );
});

// ============================================================================
// Sessions Table
// ============================================================================

interface SessionsTableProps {
    sessions: SessionWithComputedStatus[];
    sections: Section[];
    courseId: string;
    isCourseActive?: boolean;
    onCreateClick: () => void;
    onActivate: (session: AttendanceSession) => void;
    onEdit: (session: AttendanceSession) => void;
    onDelete: (session: AttendanceSession) => void;
    onClose: (session: AttendanceSession) => void;
    canCreateAttendanceSessions?: boolean;
    canUpdateAttendanceSessions?: boolean;
    canDeleteAttendanceSessions?: boolean;
}

export const SessionsTable = memo(function SessionsTable({
    sessions,
    sections,
    courseId,
    isCourseActive = true,
    onCreateClick,
    onActivate,
    onEdit,
    onDelete,
    onClose,
    canCreateAttendanceSessions = false,
    canUpdateAttendanceSessions = false,
    canDeleteAttendanceSessions = false,
}: SessionsTableProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    // QR Preview Modal State
    const [qrPreviewSession, setQRPreviewSession] = useState<SessionWithComputedStatus | null>(null);

    // Display Scanner Modal State
    const [scanProjectorSession, setScanProjectorSession] = useState<SessionWithComputedStatus | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);

    // Pin the actions column so it stays visible when the table scrolls sideways.
    const { scrollRef, hasOverflow } = useHorizontalOverflow();

    const totalPages = Math.max(1, Math.ceil(sessions.length / rowsPerPage));
    const sectionMap = useMemo(
        () => new Map(sections.map((section) => [section.id, section])),
        [sections],
    );
    const paginatedSessions = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return sessions.slice(start, start + rowsPerPage);
    }, [sessions, currentPage, rowsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [rowsPerPage, sessions]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    return (
        <>
            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardBody className="p-2">
                    <div
                        ref={scrollRef}
                        data-overflow={hasOverflow ? "true" : "false"}
                        className={STICKY_SCROLL_CONTAINER_CLASS}
                    >
                        <Table
                            aria-label={isEnglish ? "Attendance sessions table" : "ตารางรอบการเช็คชื่อ"}
                            removeWrapper
                            classNames={{
                                base: "min-w-225",
                                th: "bg-content2 text-default-600 font-semibold text-sm whitespace-nowrap",
                                td: "py-3 whitespace-nowrap",
                            }}
                        >
                            <TableHeader>
                                <TableColumn className="min-w-40">{isEnglish ? "Attendance session" : "รอบการเช็คชื่อ"}</TableColumn>
                                <TableColumn className="min-w-25">{isEnglish ? "Section" : "เซคชัน"}</TableColumn>
                                <TableColumn className="min-w-22.5">{isEnglish ? "Type" : "ประเภท"}</TableColumn>
                                <TableColumn className="min-w-35">{isEnglish ? "Date & time" : "วันเวลา"}</TableColumn>
                                <TableColumn className="min-w-22.5">{isEnglish ? "Status" : "สถานะ"}</TableColumn>
                                <TableColumn className="min-w-35">{isEnglish ? "Stats" : "สถิติ"}</TableColumn>
                                <TableColumn align="center" className={`${STICKY_ACTION_HEADER_CLASS} min-w-30`}>{isEnglish ? "Actions" : "จัดการ"}</TableColumn>
                            </TableHeader>
                            <TableBody
                                emptyContent={
                                    <div className="py-10 text-center">
                                        <Icon
                                            icon="solar:clipboard-list-linear"
                                            className="mx-auto mb-3 text-5xl text-default-300"
                                        />
                                        <p className="text-default-400">{isEnglish ? "No attendance sessions match the current filters." : "ไม่พบรอบการเช็คชื่อที่ตรงกับเงื่อนไข"}</p>
                                        {canCreateAttendanceSessions && (
                                            <Button
                                                color="primary"
                                                variant="flat"
                                                size="sm"
                                                className="mt-3"
                                                isDisabled={!isCourseActive}
                                                onPress={onCreateClick}
                                            >
                                                {isEnglish ? "Create attendance session" : "สร้างรอบเช็คชื่อ"}
                                            </Button>
                                        )}
                                    </div>
                                }
                            >
                                {paginatedSessions.map((session) => {
                                    const sessionTypeDisplay = getSessionTypeDisplay(session.session_type, isEnglish);
                                    const statusDisplay = getStatusDisplay(session.status, isEnglish);
                                    const resolvedSections = session.sections && session.sections.length > 0
                                        ? session.sections
                                        : (session.course_section_ids || [])
                                            .map((sectionId) => sectionMap.get(sectionId))
                                            .filter((section): section is Section => Boolean(section));

                                    return (
                                    <TableRow key={session.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <p className="font-medium text-foreground">{session.title}</p>
                                                    {session.check_location && (
                                                        <div className="flex items-center gap-1 text-xs text-default-500">
                                                            <span>{isEnglish ? "GPS required" : "ตรวจสอบตำแหน่ง"}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {resolvedSections.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {resolvedSections.map((sec) => (
                                                        <Chip key={sec.id} size="sm" variant="flat" color="default">
                                                            {sec.section_no}
                                                        </Chip>
                                                    ))}
                                                </div>
                                            ) : session.section ? (
                                                <Chip size="sm" variant="flat" color="default">
                                                    {session.section.section_no}
                                                </Chip>
                                            ) : (
                                                <span className="text-sm text-default-500">{isEnglish ? "All sections" : "ทุกเซคชัน"}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                size="sm"
                                                color={sessionTypeDisplay.color}
                                                variant="flat"
                                            >
                                                {sessionTypeDisplay.label}
                                            </Chip>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <p className="text-foreground">{formatDate(session.start_time, isEnglish)}</p>
                                                <p className="text-default-500">
                                                    {formatTime(session.start_time, isEnglish)} - {formatTime(session.end_time, isEnglish)}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                size="sm"
                                                color={statusDisplay.color}
                                                variant="flat"
                                                startContent={
                                                    session.status === "active" ? (
                                                        <span className="relative flex h-2 w-2 mr-1">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                        </span>
                                                    ) : undefined
                                                }
                                            >
                                                {statusDisplay.label}
                                            </Chip>
                                        </TableCell>
                                        <TableCell>
                                            {session.stats ? (
                                                <div className="flex items-center gap-2">
                                                    <Tooltip content={isEnglish ? "Present" : "มาเรียน"}>
                                                        <Chip size="sm" color="success" variant="flat">
                                                            {session.stats.present}
                                                        </Chip>
                                                    </Tooltip>
                                                    <Tooltip content={isEnglish ? "Late" : "สาย"}>
                                                        <Chip size="sm" color="warning" variant="flat">
                                                            {session.stats.late}
                                                        </Chip>
                                                    </Tooltip>
                                                    <Tooltip content={isEnglish ? "Absent" : "ขาด"}>
                                                        <Chip size="sm" color="danger" variant="flat">
                                                            {session.stats.absent}
                                                        </Chip>
                                                    </Tooltip>
                                                </div>
                                            ) : (
                                                <span className="text-default-400">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className={STICKY_ACTION_CELL_CLASS}>
                                            <div className="flex items-center justify-center gap-1">
                                                <SessionRowActions
                                                    session={session}
                                                    courseId={courseId}
                                                    isCourseActive={isCourseActive}
                                                    onActivate={onActivate}
                                                    onEdit={onEdit}
                                                    onDelete={onDelete}
                                                    onClose={onClose}
                                                    onShowQR={setQRPreviewSession}
                                                    onScanProjector={setScanProjectorSession}
                                                    canUpdateAttendanceSessions={canUpdateAttendanceSessions}
                                                    canDeleteAttendanceSessions={canDeleteAttendanceSessions}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    <TablePaginationFooter
                        totalItems={sessions.length}
                        currentPage={currentPage}
                        rowsPerPage={rowsPerPage}
                        totalPages={totalPages}
                        isEnglish={isEnglish}
                        nounEnglish="session"
                        nounEnglishPlural="sessions"
                        nounThai="รอบ"
                        onPageChange={setCurrentPage}
                        onRowsPerPageChange={setRowsPerPage}
                    />
                </CardBody>
            </Card>

            {/* QR Preview Modal */}
            <QRPreviewModal
                isOpen={!!qrPreviewSession}
                onClose={() => setQRPreviewSession(null)}
                session={qrPreviewSession}
            />

            {/* Display Scanner Modal */}
            <DisplayScannerModal
                isOpen={!!scanProjectorSession}
                onClose={() => setScanProjectorSession(null)}
                session={scanProjectorSession}
            />
        </>
    );
});

// ============================================================================
// Location Check Card
// ============================================================================

interface LocationCheckCardProps {
    checkLocation: boolean;
    locationLat?: number;
    locationLng?: number;
    radiusMeters: number;
    isGettingLocation: boolean;
    onToggle: () => void;
    onGetCurrentLocation: () => void;
    onLocationChange: (lat: number, lng: number) => void;
    onRadiusChange: (radius: number) => void;
    onClearLocation: () => void;
}

export const LocationCheckCard = memo(function LocationCheckCard({
    checkLocation,
    locationLat,
    locationLng,
    radiusMeters,
    isGettingLocation,
    onToggle,
    onGetCurrentLocation,
    onLocationChange,
    onRadiusChange,
    onClearLocation,
}: LocationCheckCardProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    return (
        <Card className="border border-default-200 bg-content1">
            <CardBody className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="font-medium text-default-700">{isEnglish ? "GPS location check" : "ตรวจสอบตำแหน่ง GPS"}</p>
                        <p className="text-sm text-default-500">{isEnglish ? "Restrict check-in to the selected area." : "ให้นักศึกษาต้องอยู่ในบริเวณที่กำหนด"}</p>
                    </div>
                    <Switch
                        isSelected={checkLocation}
                        color="primary"
                        onValueChange={onToggle}
                    />
                </div>

                {checkLocation && (
                    <div className="mt-4 space-y-4">
                        {/* GPS Button */}
                        <button
                            type="button"
                            onClick={onGetCurrentLocation}
                            disabled={isGettingLocation}
                            className={`group relative p-4 rounded-xl border-2 border-dashed transition-all duration-200 w-full ${isGettingLocation
                                ? "border-blue-400 bg-blue-50 cursor-wait"
                                : "border-default-200 hover:border-blue-400 hover:bg-content2"
                                }`}
                        >
                            <div className="flex flex-col items-center gap-2">
                                <div className={`p-3 rounded-full transition-colors ${isGettingLocation
                                    ? "bg-blue-200 animate-pulse"
                                    : "bg-blue-100 group-hover:bg-blue-200"
                                    }`}>
                                    <Icon
                                        icon="solar:gps-bold"
                                        className={`text-2xl text-blue-600 ${isGettingLocation ? "animate-spin" : ""}`}
                                    />
                                </div>
                                <span className="font-medium text-default-700">
                                    {isGettingLocation ? (isEnglish ? "Getting GPS..." : "กำลังดึง GPS...") : (isEnglish ? "Get device GPS" : "ดึงจาก GPS ของเครื่อง")}
                                </span>
                                <span className="text-xs text-default-500">
                                    {isGettingLocation ? (isEnglish ? "Please wait..." : "รอสักครู่...") : (isEnglish ? "Use high-accuracy GPS" : "ใช้ GPS ความแม่นยำสูง")}
                                </span>
                            </div>
                            {isGettingLocation && (
                                <div className="absolute inset-0 flex items-center justify-center bg-blue-50/50 rounded-xl">
                                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </button>

                        {/* Location Status */}
                        {locationLat && locationLng ? (
                            <div className="p-4 bg-linear-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <Icon icon="solar:map-point-wave-bold" className="text-xl text-green-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Icon icon="solar:check-circle-bold" className="text-green-600" />
                                            <span className="font-medium text-green-700">{isEnglish ? "Location set" : "กำหนดตำแหน่งแล้ว"}</span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-default-500">Lat:</span>
                                                <code className="rounded bg-content1 px-1.5 py-0.5 font-mono text-xs text-green-700">
                                                    {Number(locationLat).toFixed(6)}
                                                </code>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-default-500">Lng:</span>
                                                <code className="rounded bg-content1 px-1.5 py-0.5 font-mono text-xs text-green-700">
                                                    {Number(locationLng).toFixed(6)}
                                                </code>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        color="danger"
                                        onPress={onClearLocation}
                                    >
                                        <Icon icon="solar:trash-bin-trash-bold" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 rounded-lg">
                                        <Icon icon="solar:map-point-search-bold" className="text-xl text-amber-600" />
                                    </div>
                                    <div>
                                        <span className="font-medium text-amber-700">{isEnglish ? "Location not set" : "ยังไม่ได้กำหนดตำแหน่ง"}</span>
                                        <p className="text-xs text-amber-600 mt-0.5">{isEnglish ? "Choose a method above to set the location." : "กรุณาเลือกวิธีกำหนดตำแหน่งด้านบน"}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Map Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:map-bold" className="text-default-400" />
                                <span className="text-sm font-medium text-default-600">{isEnglish ? "Map (click to place a pin)" : "แผนที่ (คลิกเพื่อปักหมุด)"}</span>
                            </div>
                            <Suspense fallback={
                                <div className="flex h-70 items-center justify-center rounded-xl border border-default-200 bg-content2">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="rounded-full bg-content1 p-4 shadow-sm">
                                            <Icon icon="solar:map-bold" className="animate-pulse text-4xl text-default-400" />
                                        </div>
                                        <span className="text-sm text-default-500">{isEnglish ? "Loading map..." : "กำลังโหลดแผนที่..."}</span>
                                    </div>
                                </div>
                            }>
                                <LocationPicker
                                    latitude={locationLat}
                                    longitude={locationLng}
                                    radius={radiusMeters}
                                    onLocationChange={onLocationChange}
                                />
                            </Suspense>
                        </div>

                        {/* Radius Setting */}
                        <div className="rounded-xl border border-default-200 bg-content2 p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-violet-100 rounded-lg">
                                    <Icon icon="solar:ruler-angular-bold" className="text-lg text-violet-600" />
                                </div>
                                <div>
                                    <span className="font-medium text-default-700">{isEnglish ? "Allowed radius" : "รัศมีที่อนุญาต"}</span>
                                    <p className="text-xs text-default-500">{isEnglish ? "Maximum distance from the selected point allowed for check-in." : "ระยะห่างจากจุดกำหนดที่อนุญาตให้เช็คชื่อได้"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="number"
                                    variant="bordered"
                                    value={String(radiusMeters)}
                                    onValueChange={(value) => onRadiusChange(parseInt(value) || 10)}
                                    size="sm"
                                    endContent={<span className="text-sm text-default-400">{isEnglish ? "meters" : "เมตร"}</span>}
                                    className="max-w-37.5"
                                />
                                <div className="flex gap-1.5">
                                    {RADIUS_OPTIONS.map((r) => (
                                        <Button
                                            key={r}
                                            size="sm"
                                            variant={radiusMeters === r ? "solid" : "flat"}
                                            color={radiusMeters === r ? "primary" : "default"}
                                            onPress={() => onRadiusChange(r)}
                                            className="min-w-0 px-3"
                                        >
                                            {r}m
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </CardBody>
        </Card>
    );
});

// ============================================================================
// Create Session Modal
// ============================================================================

interface CreateSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    isCourseActive?: boolean;
    formData: CreateAttendanceData;
    setFormData: React.Dispatch<React.SetStateAction<CreateAttendanceData>>;
    startDateTime: DateValue;
    setStartDateTime: (value: DateValue) => void;
    endDateTime: DateValue;
    setEndDateTime: (value: DateValue) => void;
    lateThresholdTime: DateValue;
    setLateThresholdTime: (value: DateValue) => void;
    lateThresholdMinutes: number;
    sections: Section[];
    isSubmitting: boolean;
    isGettingLocation: boolean;
    onSubmit: () => Promise<void>;
    onGetCurrentLocation: () => void;
}

export const CreateSessionModal = memo(function CreateSessionModal({
    isOpen,
    onClose,
    isCourseActive = true,
    formData,
    setFormData,
    startDateTime,
    setStartDateTime,
    endDateTime,
    setEndDateTime,
    lateThresholdTime,
    setLateThresholdTime,
    lateThresholdMinutes,
    sections,
    isSubmitting,
    isGettingLocation,
    onSubmit,
    onGetCurrentLocation,
}: CreateSessionModalProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    return (
        <Modal
            isOpen={isOpen}
            isDismissable={false}
            isKeyboardDismissDisabled={true}
            onClose={onClose}
            size="2xl"
            placement="top-center"
            scrollBehavior="inside"
        >
            <ModalContent className="m-0 h-[100dvh] max-h-[100dvh] w-full rounded-none sm:my-8 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl">
                <ModalHeader className="flex flex-col gap-1 px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg">
                            <Icon icon="solar:clipboard-check-bold" className="text-2xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground">{isEnglish ? "Create attendance session" : "สร้างรอบการเช็คชื่อ"}</h3>
                            <p className="mt-1 text-sm font-normal text-default-500">
                                {isEnglish ? "Set the attendance session details." : "กำหนดรายละเอียดการเช็คชื่อเข้าเรียน"}
                            </p>
                        </div>
                    </div>
                </ModalHeader>
                <ModalBody className="px-4 py-4 pb-32 sm:px-6 sm:pb-6">
                    <div className="space-y-5">
                        {/* Title */}
                        <div>
                            <Input
                                label={isEnglish ? "Attendance session title" : "ชื่อรอบการเช็คชื่อ"}
                                placeholder={isEnglish ? "e.g. Week 1 attendance, Lab 1" : "เช่น เช็คชื่อสัปดาห์ที่ 1, Lab 1"}
                                value={formData.title}
                                onValueChange={(value) => setFormData((prev) => ({ ...prev, title: value }))}
                                isRequired
                                labelPlacement="outside"
                                variant="bordered"
                                size="md"
                                classNames={{
                                    inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-default-600 font-medium text-sm",
                                }}
                            />
                        </div>

                        {/* Section - Multi-select */}
                        <div>
                            <Select
                                label={isEnglish ? "Sections" : "กลุ่มเรียน"}
                                placeholder={isEnglish ? "Select sections" : "เลือกกลุ่มเรียน"}
                                selectionMode="multiple"
                                selectedKeys={new Set((formData.course_section_ids || []).map(String))}
                                labelPlacement="outside"
                                variant="bordered"
                                size="md"
                                className="py-4"
                                onSelectionChange={(keys) => {
                                    const selectedIds = Array.from(keys).map((k) => Number(k));
                                    setFormData((prev: CreateAttendanceData) => ({
                                        ...prev,
                                        course_section_ids: selectedIds,
                                        course_section_id: selectedIds.length === 1 ? selectedIds[0] : null,
                                    }));
                                }}
                                classNames={{
                                    trigger: "bg-content1 border-default-200",
                                    label: "text-default-600 font-medium text-sm",
                                }}
                            >
                                {sections.map((section) => (
                                    <SelectItem key={String(section.id)} textValue={`${section.section_no}${section.note ? ` - ${section.note}` : ""}`}>
                                        {section.section_no}{section.note ? ` - ${section.note}` : ""}
                                    </SelectItem>
                                ))}
                            </Select>
                        </div>


                        {/* Session Type */}
                        <div>
                            <Select
                                label={isEnglish ? "Session type" : "ประเภทการเรียน"}
                                selectedKeys={[formData.session_type]}
                                variant="bordered"
                                onSelectionChange={(keys) => {
                                    const selected = Array.from(keys)[0] as "lecture" | "lab" | "online";
                                    setFormData((prev: CreateAttendanceData) => ({ ...prev, session_type: selected }));
                                }}
                                isRequired
                                labelPlacement="outside"
                                size="md"
                                classNames={{
                                    trigger: "bg-content1 border-default-200",
                                    label: "text-default-600 font-medium text-sm",
                                }}
                            >
                                <SelectItem key="lecture">
                                    {isEnglish ? "Lecture" : "บรรยาย (Lecture)"}
                                </SelectItem>
                                <SelectItem key="lab">
                                    {isEnglish ? "Lab" : "ปฏิบัติการ (Lab)"}
                                </SelectItem>
                                <SelectItem key="online">
                                    {isEnglish ? "Online" : "ออนไลน์ (Online)"}
                                </SelectItem>
                            </Select>
                        </div>

                        {/* Date Time */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <DateTimeInput
                                label={isEnglish ? "Start time" : "เวลาเริ่มต้น"}
                                value={startDateTime}
                                onChange={setStartDateTime}
                                isRequired
                                colorScheme="blue"
                            />
                            <DateTimeInput
                                label={isEnglish ? "End time" : "เวลาสิ้นสุด"}
                                value={endDateTime}
                                onChange={setEndDateTime}
                                isRequired
                                colorScheme="blue"
                                min={toDateTimeLocalStr(startDateTime)}
                                max={endOfDayStr(startDateTime)}
                            />
                        </div>

                        {/* Late Threshold Time */}
                        <div className="">
                            <DateTimeInput
                                label={isEnglish ? "Late cutoff time" : "เวลาตัดสาย"}
                                value={lateThresholdTime}
                                onChange={setLateThresholdTime}
                                isRequired
                                colorScheme="amber"
                                description={isEnglish ? "Check-ins after this time will be marked late." : "เช็คอินหลังเวลานี้จะถูกนับเป็นสาย"}
                                min={toDateTimeLocalStr(startDateTime)}
                                max={toDateTimeLocalStr(endDateTime)}
                            />
                        </div>

                        <Card className="border border-default-200 bg-content1">
                            <CardBody className="flex flex-row items-center justify-between gap-4 p-4">
                                <div>
                                    <p className="font-medium text-default-700">{isEnglish ? "Auto-rotate PIN" : "เปลี่ยน PIN อัตโนมัติ"}</p>
                                    <p className="text-sm text-default-500">
                                        {isEnglish ? "Rotate the check-in PIN every minute for this session." : "ให้ระบบเปลี่ยน PIN ทุก 1 นาทีสำหรับรอบนี้"}
                                    </p>
                                </div>
                                <Switch
                                    isSelected={formData.auto_rotate_pin}
                                    color="primary"
                                    onValueChange={(value) => setFormData((prev: CreateAttendanceData) => ({ ...prev, auto_rotate_pin: value }))}
                                />
                            </CardBody>
                        </Card>

                        {/* Location Check */}
                        <LocationCheckCard
                            checkLocation={formData.check_location}
                            locationLat={formData.location_lat}
                            locationLng={formData.location_lng}
                            radiusMeters={formData.radius_meters ?? 100}
                            isGettingLocation={isGettingLocation}
                            onToggle={() => setFormData((prev: CreateAttendanceData) => ({ ...prev, check_location: !prev.check_location }))}
                            onGetCurrentLocation={onGetCurrentLocation}
                            onLocationChange={(lat, lng) => setFormData((prev: CreateAttendanceData) => ({ ...prev, location_lat: lat, location_lng: lng }))}
                            onRadiusChange={(radius) => setFormData((prev: CreateAttendanceData) => ({ ...prev, radius_meters: radius }))}
                            onClearLocation={() => setFormData((prev: CreateAttendanceData) => ({ ...prev, location_lat: undefined, location_lng: undefined }))}
                        />
                    </div>
                </ModalBody>
                <ModalFooter className="sticky bottom-0 z-20 flex-col-reverse gap-2 border-t border-divider bg-content1 px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] sm:flex-row sm:px-6 sm:py-4">
                    <Button variant="light" onPress={onClose} className="w-full sm:w-auto">
                        {isEnglish ? "Cancel" : "ยกเลิก"}
                    </Button>
                    <Button
                        color="primary"
                        onPress={onSubmit}
                        isLoading={isSubmitting}
                        isDisabled={!isCourseActive || !formData.title?.trim()}
                        className="w-full bg-linear-to-r from-blue-400 to-indigo-500 sm:w-auto"
                    >
                        {isEnglish ? "Create attendance session" : "สร้างรอบเช็คชื่อ"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
});

// ============================================================================
// Edit Session Modal
// ============================================================================

interface EditSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    isCourseActive?: boolean;
    editTarget: AttendanceSession | null;
    formData: CreateAttendanceData;
    setFormData: React.Dispatch<React.SetStateAction<CreateAttendanceData>>;
    startDateTime: DateValue;
    setStartDateTime: (value: DateValue) => void;
    endDateTime: DateValue;
    setEndDateTime: (value: DateValue) => void;
    lateThresholdTime: DateValue;
    setLateThresholdTime: (value: DateValue) => void;
    lateThresholdMinutes: number;
    sections: Section[];
    allSectionIds: number[];
    isSubmitting: boolean;
    isGettingLocation: boolean;
    onSubmit: () => Promise<void>;
    onGetCurrentLocation: () => void;
}

export const EditSessionModal = memo(function EditSessionModal({
    isOpen,
    onClose,
    isCourseActive = true,
    editTarget,
    formData,
    setFormData,
    startDateTime,
    setStartDateTime,
    endDateTime,
    setEndDateTime,
    lateThresholdTime,
    setLateThresholdTime,
    lateThresholdMinutes,
    sections,
    allSectionIds,
    isSubmitting,
    isGettingLocation,
    onSubmit,
    onGetCurrentLocation,
}: EditSessionModalProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const [originalFormData, setOriginalFormData] = useState<CreateAttendanceData | null>(null);
    const isClosedSession = editTarget?.status === "closed";

    useEffect(() => {
        if (!isOpen || !editTarget) {
            setOriginalFormData(null);
            return;
        }

        setOriginalFormData({
            ...formData,
            course_section_ids: [...(formData.course_section_ids || [])].sort((a, b) => a - b),
            start_time: toDateTimeLocalStr(startDateTime),
            end_time: toDateTimeLocalStr(endDateTime),
            late_threshold_time: toDateTimeLocalStr(lateThresholdTime),
        });
    }, [isOpen, editTarget]);

    const hasFormChanges = () => {
        if (!originalFormData) return false;

        if (isClosedSession) {
            return formData.title !== originalFormData.title;
        }

        const currentSectionIds = [...(formData.course_section_ids || [])].sort((a, b) => a - b);
        const originalSectionIds = [...(originalFormData.course_section_ids || [])].sort((a, b) => a - b);

        return JSON.stringify({
            ...formData,
            course_section_ids: currentSectionIds,
            start_time: toDateTimeLocalStr(startDateTime),
            end_time: toDateTimeLocalStr(endDateTime),
            late_threshold_time: toDateTimeLocalStr(lateThresholdTime),
        }) !== JSON.stringify({
            ...originalFormData,
            course_section_ids: originalSectionIds,
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            isDismissable={false}
            isKeyboardDismissDisabled={true}
            onClose={onClose}
            size="2xl"
            placement="top-center"
            scrollBehavior="inside"
        >
            <ModalContent className="m-0 h-[100dvh] max-h-[100dvh] w-full rounded-none sm:my-8 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl">
                <ModalHeader className="flex flex-col gap-1 px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-linear-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg">
                            <Icon icon="solar:pen-bold" className="text-2xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground">{isEnglish ? "Edit attendance session" : "แก้ไขรอบการเช็คชื่อ"}</h3>
                            <p className="mt-1 text-sm font-normal text-default-500">
                                {editTarget?.title}
                            </p>
                        </div>
                    </div>
                </ModalHeader>
                <ModalBody className="px-4 py-4 pb-32 sm:px-6 sm:pb-6">
                    <div className="space-y-3">
                        {/* Title */}
                        <Input
                            label={isEnglish ? "Attendance session title" : "ชื่อรอบการเช็คชื่อ"}
                            value={formData.title}
                            onValueChange={(value) => setFormData((prev: CreateAttendanceData) => ({ ...prev, title: value }))}
                            isRequired
                            labelPlacement="outside"
                            variant="bordered"
                            size="md"
                            classNames={{
                                inputWrapper: "bg-content1 border-default-200 hover:border-amber-300 focus-within:!border-amber-400",
                                label: "text-default-600 font-medium text-sm",
                            }}
                        />
                        {isClosedSession && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                {isEnglish ? "Closed sessions can only update the session title." : "รอบที่ปิดใช้งานแล้วจะแก้ไขได้เฉพาะชื่อ session เท่านั้น"}
                            </div>
                        )}
                        <div className={isClosedSession ? "pointer-events-none space-y-3 opacity-60 select-none" : "space-y-3"}>

                        {/* Section - Multi-select */}
                        <Select
                            label={isEnglish ? "Sections" : "กลุ่มเรียน"}
                            placeholder={isEnglish ? "Select sections" : "เลือกกลุ่มเรียน"}
                            selectionMode="multiple"
                            selectedKeys={new Set((formData.course_section_ids || []).map(String))}
                            labelPlacement="outside"
                            variant="bordered"
                            size="md"
                            className="py-3"
                            onSelectionChange={(keys) => {
                                const selectedIds = Array.from(keys).map((k) => Number(k));
                                setFormData((prev: CreateAttendanceData) => ({
                                    ...prev,
                                    course_section_ids: selectedIds,
                                    course_section_id: selectedIds.length === 1 ? selectedIds[0] : null,
                                }));
                            }}
                            classNames={{
                                trigger: "bg-content1 border-default-200",
                                label: "text-default-700 font-medium text-sm",
                            }}
                        >
                            {sections.map((section) => (
                                <SelectItem key={String(section.id)} textValue={`${section.section_no}${section.note ? ` - ${section.note}` : ""}`}>
                                    {section.section_no}{section.note ? ` - ${section.note}` : ""}
                                </SelectItem>
                            ))}
                        </Select>

                        {/* Session Type */}
                        <Select
                            label={isEnglish ? "Session type" : "ประเภทการเรียน"}
                            selectedKeys={[formData.session_type]}
                            labelPlacement="outside"
                            variant="bordered"
                            size="md"
                            onSelectionChange={(keys) => {
                                const selected = Array.from(keys)[0] as "lecture" | "lab" | "online";
                                setFormData((prev: CreateAttendanceData) => ({ ...prev, session_type: selected }));
                            }}
                            classNames={{
                                trigger: "bg-content1 border-default-200",
                                label: "text-default-700 font-medium text-sm",
                            }}
                        >
                            <SelectItem key="lecture">
                                {isEnglish ? "Lecture" : "บรรยาย (Lecture)"}
                            </SelectItem>
                            <SelectItem key="lab">
                                {isEnglish ? "Lab" : "ปฏิบัติการ (Lab)"}
                            </SelectItem>
                            <SelectItem key="online">
                                {isEnglish ? "Online" : "ออนไลน์ (Online)"}
                            </SelectItem>
                        </Select>

                        {/* Time Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            <DateTimeInput
                                label={isEnglish ? "Start time" : "เวลาเริ่มต้น"}
                                value={startDateTime}
                                onChange={setStartDateTime}
                                isRequired
                                isDisabled={isClosedSession}
                                colorScheme="amber"
                            />
                            <DateTimeInput
                                label={isEnglish ? "End time" : "เวลาสิ้นสุด"}
                                value={endDateTime}
                                onChange={setEndDateTime}
                                isRequired
                                isDisabled={isClosedSession}
                                colorScheme="amber"
                                min={toDateTimeLocalStr(startDateTime)}
                                max={endOfDayStr(startDateTime)}
                            />
                        </div>

                        {/* Late Threshold Time */}
                        <div className="">
                            <DateTimeInput
                                label={isEnglish ? "Late cutoff time" : "เวลาสำหรับเช็คสาย"}
                                value={lateThresholdTime}
                                onChange={setLateThresholdTime}
                                isRequired
                                isDisabled={isClosedSession}
                                colorScheme="amber"
                                description={isEnglish ? "Check-ins after this time will be marked late." : "เช็คอินหลังเวลานี้จะถูกนับเป็นสาย"}
                                min={toDateTimeLocalStr(startDateTime)}
                                max={toDateTimeLocalStr(endDateTime)}
                            />
                        </div>

                        <Card className="border border-default-200 bg-content1">
                            <CardBody className="flex flex-row items-center justify-between gap-4 p-4">
                                <div>
                                    <p className="font-medium text-default-700">{isEnglish ? "Auto-rotate PIN" : "เปลี่ยน PIN อัตโนมัติ"}</p>
                                    <p className="text-sm text-default-500">
                                        {isEnglish ? "Rotate the check-in PIN every minute for this session." : "ให้ระบบเปลี่ยน PIN ทุก 1 นาทีสำหรับรอบนี้"}
                                    </p>
                                </div>
                                <Switch
                                    isSelected={formData.auto_rotate_pin}
                                    color="warning"
                                    isDisabled={isClosedSession}
                                    onValueChange={(value) => setFormData((prev: CreateAttendanceData) => ({ ...prev, auto_rotate_pin: value }))}
                                />
                            </CardBody>
                        </Card>


                        {/* Location Check */}
                        <Card className="border border-default-200 bg-content1">
                            <CardBody className="p-4">
                                <div className="mb-4 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-default-700">{isEnglish ? "GPS location check" : "ตรวจสอบตำแหน่ง GPS"}</p>
                                        <p className="text-sm text-default-500">{isEnglish ? "Restrict check-in to the selected area." : "ให้นักศึกษาเช็คชื่อได้เฉพาะในพื้นที่ที่กำหนด"}</p>
                                    </div>
                                    <Switch
                                        isSelected={formData.check_location}
                                        color="primary"
                                        isDisabled={isClosedSession}
                                        onValueChange={(value) => setFormData((prev: CreateAttendanceData) => ({ ...prev, check_location: value }))}
                                    />
                                </div>

                                {formData.check_location && (
                                    <div className="space-y-4">
                                        {/* Map */}
                                        <div className="overflow-hidden rounded-xl border border-default-200">
                                            <Suspense fallback={
                                                <div className="flex h-64 items-center justify-center bg-content2">
                                                    <span className="text-default-400">{isEnglish ? "Loading map..." : "กำลังโหลดแผนที่..."}</span>
                                                </div>
                                            }>
                                                <LocationPicker
                                                    latitude={formData.location_lat || 16.4728}
                                                    longitude={formData.location_lng || 102.8233}
                                                    radius={formData.radius_meters || 50}
                                                    onLocationChange={(lat, lng) => {
                                                        setFormData((prev: CreateAttendanceData) => ({
                                                            ...prev,
                                                            location_lat: lat,
                                                            location_lng: lng,
                                                        }));
                                                    }}
                                                />
                                            </Suspense>
                                        </div>

                                        {/* Location Controls */}
                                        <div className="flex flex-wrap gap-3">
                                            <Button
                                                size="sm"
                                                variant="flat"
                                                color="primary"
                                                startContent={isGettingLocation ? null : <Icon icon="solar:map-point-wave-bold" />}
                                                onPress={onGetCurrentLocation}
                                                isLoading={isGettingLocation}
                                            >
                                                {isGettingLocation ? (isEnglish ? "Getting location..." : "กำลังระบุตำแหน่ง...") : (isEnglish ? "Use current location (GPS)" : "ใช้ตำแหน่งปัจจุบัน (GPS)")}
                                            </Button>
                                            <div className="flex-1">
                                                <p className="text-xs text-default-500">
                                                    {isEnglish ? "Location" : "ตำแหน่ง"}: {formData.location_lat ? Number(formData.location_lat).toFixed(6) : "-"}, {formData.location_lng ? Number(formData.location_lng).toFixed(6) : "-"}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Radius */}
                                        <div>
                                            <p className="mb-2 text-sm text-default-600">{isEnglish ? "Attendance radius" : "รัศมีการเช็คชื่อ"}</p>
                                            <div className="flex gap-1.5">
                                                {RADIUS_OPTIONS.map((r) => (
                                                    <Button
                                                        key={r}
                                                        size="sm"
                                                        variant={formData.radius_meters === r ? "solid" : "flat"}
                                                        color={formData.radius_meters === r ? "primary" : "default"}
                                                        onPress={() => setFormData((prev: CreateAttendanceData) => ({ ...prev, radius_meters: r }))}
                                                        className="min-w-0 px-3"
                                                    >
                                                        {r}m
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter className="sticky bottom-0 z-20 flex-col-reverse gap-2 border-t border-divider bg-content1 px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] sm:flex-row sm:px-6 sm:py-4">
                    <Button variant="light" onPress={onClose} className="w-full sm:w-auto">
                        {isEnglish ? "Cancel" : "ยกเลิก"}
                    </Button>
                    <Button
                        color="primary"
                        onPress={onSubmit}
                        isLoading={isSubmitting}
                        isDisabled={!isCourseActive || !formData.title?.trim() || !hasFormChanges()}
                        className="w-full bg-linear-to-r from-blue-400 to-indigo-500 text-white sm:w-auto"
                    >
                        {isEnglish ? "Save changes" : "บันทึกการแก้ไข"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
});

// ============================================================================
// Delete Confirmation Modal
// ============================================================================

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    isCourseActive?: boolean;
    targetTitle: string | undefined;
    isSubmitting: boolean;
    onConfirm: () => Promise<void>;
}

export const DeleteConfirmModal = memo(function DeleteConfirmModal({
    isOpen,
    onClose,
    isCourseActive = true,
    targetTitle,
    isSubmitting,
    onConfirm,
}: DeleteConfirmModalProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <Icon icon="solar:trash-bin-trash-bold" className="text-xl text-red-600" />
                        </div>
                        <span>{isEnglish ? "Confirm attendance session deletion" : "ยืนยันการลบรอบเช็คชื่อ"}</span>
                    </div>
                </ModalHeader>
                <ModalBody>
                    <p>
                        {isEnglish ? "Do you want to delete attendance session " : "คุณต้องการลบรอบการเช็คชื่อ "}<strong className="text-red-600">{targetTitle}</strong>{isEnglish ? "?" : " หรือไม่?"}
                    </p>
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <Icon icon="solar:danger-triangle-bold" className="text-red-500 text-lg mt-0.5 shrink-0" />
                            <div className="text-sm text-red-700">
                                <p className="font-bold">{isEnglish ? "Warning: this action cannot be undone!" : "คำเตือน: การลบจะไม่สามารถกู้คืนได้!"}</p>
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>{isEnglish ? "All attendance data will be permanently deleted." : <><span>ข้อมูลการเช็คชื่อทั้งหมดจะ</span><strong>หายไปถาวร</strong></>}</li>
                                    <li>{isEnglish ? "Student attendance results will be removed." : "ผลการเช็คชื่อของนักศึกษาจะถูกลบ"}</li>
                                    <li>{isEnglish ? "The data cannot be restored." : "ไม่สามารถกู้คืนข้อมูลได้"}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>
                        {isEnglish ? "Cancel" : "ยกเลิก"}
                    </Button>
                    <Button color="danger" onPress={onConfirm} isLoading={isSubmitting} isDisabled={!isCourseActive}>
                        {isEnglish ? "Delete permanently" : "ลบถาวร"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
});

// ============================================================================
// Close Session Modal
// ============================================================================

interface CloseSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    isCourseActive?: boolean;
    targetTitle: string | undefined;
    isSubmitting: boolean;
    onConfirm: () => Promise<void>;
}

export const CloseSessionModal = memo(function CloseSessionModal({
    isOpen,
    onClose,
    isCourseActive = true,
    targetTitle,
    isSubmitting,
    onConfirm,
}: CloseSessionModalProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <Icon icon="solar:stop-bold" className="text-xl text-red-600" />
                        </div>
                        <span>{isEnglish ? "Confirm attendance session closure" : "ยืนยันการปิดรอบเช็คชื่อ"}</span>
                    </div>
                </ModalHeader>
                <ModalBody>
                    <p>
                        {isEnglish ? "Do you want to close attendance session " : "คุณต้องการปิดรอบการเช็คชื่อ "}<strong>{targetTitle}</strong>{isEnglish ? " immediately?" : " ทันทีหรือไม่?"}
                    </p>
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <Icon icon="solar:danger-triangle-bold" className="text-amber-500 text-lg mt-0.5" />
                            <div className="text-sm text-amber-700">
                                <p className="font-medium">{isEnglish ? "After closing:" : "หลังจากปิดแล้ว:"}</p>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                    <li>{isEnglish ? "Students will no longer be able to check in." : "นักศึกษาจะไม่สามารถเช็คชื่อได้อีก"}</li>
                                    <li>{isEnglish ? "This attendance session can no longer be edited." : "ไม่สามารถแก้ไขรอบเช็คชื่อได้"}</li>
                                    <li>{isEnglish ? "The PIN will be released for other sessions." : "รหัส PIN จะถูกปล่อยให้รอบอื่นใช้งานได้"}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>
                        {isEnglish ? "Cancel" : "ยกเลิก"}
                    </Button>
                    <Button color="danger" onPress={onConfirm} isLoading={isSubmitting} isDisabled={!isCourseActive}>
                        {isEnglish ? "Close attendance session" : "ปิดรอบเช็คชื่อ"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
});

// ============================================================================
// Time Change Preview Modal
// Shows impact preview before applying attendance time changes
// ============================================================================

/**
 * Format ISO date string to localized short datetime
 */
const formatPreviewTime = (isoStr: string, isEnglish: boolean) => {
    try {
        return new Date(isoStr).toLocaleString(isEnglish ? "en-US" : "th-TH", {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return isoStr;
    }
};

const getChangeTypeConfig = (isEnglish: boolean): Record<string, { label: string; color: string; icon: string; bgClass: string }> => ({
    will_be_invalidated: { label: isEnglish ? "Will be invalidated" : 'จะถูกยกเลิก', color: 'text-red-600', icon: 'solar:close-circle-bold', bgClass: 'bg-red-50' },
    present_to_late: { label: isEnglish ? "On time -> Late" : 'มาตรงเวลา → สาย', color: 'text-amber-600', icon: 'solar:clock-circle-bold', bgClass: 'bg-amber-50' },
    late_to_present: { label: isEnglish ? "Late -> On time" : 'สาย → มาตรงเวลา', color: 'text-emerald-600', icon: 'solar:check-circle-bold', bgClass: 'bg-emerald-50' },
    recovered: { label: isEnglish ? "Restored" : 'กลับมาถูกต้อง', color: 'text-blue-600', icon: 'solar:refresh-circle-bold', bgClass: 'bg-blue-50' },
    already_invalid: { label: isEnglish ? "Still outside time range" : 'ยังคงอยู่นอกช่วงเวลา', color: 'text-default-500', icon: 'solar:minus-circle-bold', bgClass: 'bg-content2' },
});

interface TimeChangePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    preview: TimeChangePreview | null;
    isApplying: boolean;
    onConfirm: () => Promise<void>;
}

export const TimeChangePreviewModal = memo(function TimeChangePreviewModal({
    isOpen,
    onClose,
    preview,
    isApplying,
    onConfirm,
}: TimeChangePreviewModalProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    if (!preview) return null;

    const { summary, changes, timeChanges, hasDestructiveChanges, hasAnyImpact } = preview;
    const changeTypeConfig = getChangeTypeConfig(isEnglish);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside" isDismissable={false}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl shadow-lg ${hasDestructiveChanges ? 'bg-linear-to-br from-red-500 to-rose-600' : hasAnyImpact ? 'bg-linear-to-br from-amber-400 to-orange-500' : 'bg-linear-to-br from-blue-400 to-indigo-500'}`}>
                            <Icon icon={hasDestructiveChanges ? 'solar:danger-triangle-bold' : hasAnyImpact ? 'solar:info-circle-bold' : 'solar:check-circle-bold'} className="text-2xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground">
                                {hasDestructiveChanges
                                    ? (isEnglish ? "Warning: this change affects existing records" : 'คำเตือน: การเปลี่ยนแปลงนี้มีผลกระทบ')
                                    : hasAnyImpact
                                        ? (isEnglish ? "Review impact before saving" : 'ตรวจสอบผลกระทบก่อนบันทึก')
                                        : (isEnglish ? "No impact on existing records" : 'ไม่มีผลกระทบต่อข้อมูลที่มีอยู่')}
                            </h3>
                            <p className="mt-1 text-sm font-normal text-default-500">
                                {preview.session_title} — {summary.total_checked_in} {isEnglish ? "check-ins" : "รายการเช็คชื่อ"}
                            </p>
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody className="px-6 py-4 space-y-4">
                    {/* Time Rules Diff */}
                    <div className="space-y-2">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-default-700">
                            <Icon icon="solar:clock-circle-bold" className="text-blue-500" />
                            {isEnglish ? "Time changes" : 'การเปลี่ยนแปลงเวลา'}
                        </h4>
                        <div className="grid gap-2">
                            {timeChanges.start_time.changed && (
                                <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                                    <Icon icon="solar:play-bold" className="text-blue-500" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-default-500">{isEnglish ? "Start time" : 'เวลาเริ่มต้น'}</p>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-default-500 line-through">{formatPreviewTime(timeChanges.start_time.old, isEnglish)}</span>
                                            <Icon icon="solar:arrow-right-linear" className="text-default-400" width={14} />
                                            <span className="font-medium text-blue-700">{formatPreviewTime(timeChanges.start_time.new, isEnglish)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {timeChanges.late_threshold.changed && (
                                <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                                    <Icon icon="solar:clock-circle-bold" className="text-amber-500" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-default-500">{isEnglish ? "Late cutoff" : 'เวลาตัดสาย'}</p>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-default-500 line-through">{formatPreviewTime(timeChanges.late_threshold.old, isEnglish)}</span>
                                            <Icon icon="solar:arrow-right-linear" className="text-default-400" width={14} />
                                            <span className="font-medium text-amber-700">{formatPreviewTime(timeChanges.late_threshold.new, isEnglish)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {timeChanges.end_time.changed && (
                                <div className="flex items-center gap-2 p-2.5 bg-rose-50 rounded-lg border border-rose-100">
                                    <Icon icon="solar:stop-bold" className="text-rose-500" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-default-500">{isEnglish ? "End time" : 'เวลาสิ้นสุด'}</p>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-default-500 line-through">{formatPreviewTime(timeChanges.end_time.old, isEnglish)}</span>
                                            <Icon icon="solar:arrow-right-linear" className="text-default-400" width={14} />
                                            <span className="font-medium text-rose-700">{formatPreviewTime(timeChanges.end_time.new, isEnglish)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!timeChanges.start_time.changed && !timeChanges.late_threshold.changed && !timeChanges.end_time.changed && (
                                <div className="flex items-center gap-2 rounded-lg border border-default-200 bg-content2 p-2.5">
                                    <Icon icon="solar:check-circle-bold" className="text-emerald-500" />
                                    <span className="text-sm text-default-600">{isEnglish ? "No time changes" : 'ไม่มีการเปลี่ยนแปลงเวลา'}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Impact Summary Cards */}
                    {hasAnyImpact && (
                        <div className="space-y-2">
                            <h4 className="flex items-center gap-2 text-sm font-semibold text-default-700">
                                <Icon icon="solar:chart-2-bold" className="text-indigo-500" />
                                {isEnglish ? "Impact on attendance records" : 'ผลกระทบต่อข้อมูลเช็คชื่อ'}
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {summary.will_be_invalidated > 0 && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                                        <p className="text-2xl font-bold text-red-600">{summary.will_be_invalidated}</p>
                                        <p className="text-xs text-red-500 mt-0.5">{isEnglish ? "Will be invalidated" : 'จะถูกยกเลิก'}</p>
                                    </div>
                                )}
                                {summary.present_to_late > 0 && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                                        <p className="text-2xl font-bold text-amber-600">{summary.present_to_late}</p>
                                        <p className="text-xs text-amber-500 mt-0.5">{isEnglish ? "On-time -> Late" : 'ตรงเวลา → สาย'}</p>
                                    </div>
                                )}
                                {summary.late_to_present > 0 && (
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                                        <p className="text-2xl font-bold text-emerald-600">{summary.late_to_present}</p>
                                        <p className="text-xs text-emerald-500 mt-0.5">{isEnglish ? "Late -> On-time" : 'สาย → ตรงเวลา'}</p>
                                    </div>
                                )}
                                {summary.recovered > 0 && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                                        <p className="text-2xl font-bold text-blue-600">{summary.recovered}</p>
                                        <p className="text-xs text-blue-500 mt-0.5">{isEnglish ? "Restored" : 'กลับมาถูกต้อง'}</p>
                                    </div>
                                )}
                                <div className="rounded-xl border border-default-200 bg-content2 p-3 text-center">
                                    <p className="text-2xl font-bold text-default-600">{summary.unchanged}</p>
                                    <p className="mt-0.5 text-xs text-default-500">{isEnglish ? "Unchanged" : 'ไม่เปลี่ยนแปลง'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Scenario-specific Warnings */}
                    {hasDestructiveChanges && (
                        <div className="p-4 bg-red-100 rounded-xl border border-red-200">
                            <div className="flex items-start gap-3">
                                <Icon icon="solar:shield-warning-bold" className="text-2xl text-red-600 mt-0.5 shrink-0" />
                                <div className="space-y-1.5">
                                    <p className="font-semibold text-red-800">
                                        {isEnglish ? `${summary.will_be_invalidated} attendance records will become "Absent"` : `การเช็คชื่อ ${summary.will_be_invalidated} รายการจะถูกเปลี่ยนเป็น "ขาด"`}
                                    </p>
                                    <p className="text-sm text-red-600">
                                        {isEnglish ? "Check-in times that fall outside the new time window will keep their timestamps, but their status will change." : 'เนื่องจากเวลาเช็คอินอยู่นอกช่วงเวลาใหม่ ข้อมูลเวลาเช็คอินจะยังคงอยู่ แต่สถานะจะเปลี่ยน'}
                                    </p>
                                    <ul className="text-sm text-red-600 list-disc ml-4 space-y-0.5">
                                        {timeChanges.start_time.changed && new Date(timeChanges.start_time.new) > new Date(timeChanges.start_time.old) && (
                                            <li>{isEnglish ? 'Moving the start time later means students who checked in before the new start time will be marked "Absent".' : 'เลื่อนเวลาเริ่มไปข้างหน้า — นักศึกษาที่เช็คชื่อก่อนเวลาเริ่มใหม่จะถูกนับเป็น "ขาด"'}</li>
                                        )}
                                        {timeChanges.end_time.changed && new Date(timeChanges.end_time.new) < new Date(timeChanges.end_time.old) && (
                                            <li>{isEnglish ? 'Moving the end time earlier means students who checked in after the new end time will be marked "Absent".' : 'เลื่อนเวลาสิ้นสุดให้เร็วขึ้น — นักศึกษาที่เช็คชื่อหลังเวลาสิ้นสุดใหม่จะถูกนับเป็น "ขาด"'}</li>
                                        )}
                                    </ul>
                                    <p className="text-xs text-red-500 mt-1">
                                        {isEnglish ? "This action is logged for audit history." : 'การดำเนินการนี้บันทึกลง Log เพื่อตรวจสอบย้อนหลังได้'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {summary.present_to_late > 0 && (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                            <div className="flex items-start gap-3">
                                <Icon icon="solar:clock-circle-bold" className="text-xl text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-medium text-amber-800">
                                        {isEnglish ? `${summary.present_to_late} students will change from "On time" to "Late"` : `${summary.present_to_late} คนจะเปลี่ยนจาก "มาตรงเวลา" เป็น "สาย"`}
                                    </p>
                                    <p className="text-sm text-amber-600 mt-0.5">
                                        {isEnglish ? "The late cutoff moved earlier, so some students who were previously on time will now be marked late." : 'เนื่องจากเวลาตัดสายถูกขยับให้เร็วขึ้น นักศึกษาที่เคยมาก่อนเส้นตัดเดิมจะกลายเป็นสาย'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {summary.late_to_present > 0 && (
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                            <div className="flex items-start gap-3">
                                <Icon icon="solar:check-circle-bold" className="text-xl text-emerald-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-medium text-emerald-800">
                                        {isEnglish ? `${summary.late_to_present} students will change from "Late" to "On time"` : `${summary.late_to_present} คนจะเปลี่ยนจาก "สาย" เป็น "มาตรงเวลา"`}
                                    </p>
                                    <p className="text-sm text-emerald-600 mt-0.5">
                                        {isEnglish ? "The late cutoff moved later, so some students who were previously late will now be on time." : 'เนื่องจากเวลาตัดสายถูกขยับให้ช้าลง นักศึกษาที่เคยสายจะกลับมาเป็นมาตรงเวลา'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {summary.recovered > 0 && (
                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                            <div className="flex items-start gap-3">
                                <Icon icon="solar:refresh-circle-bold" className="text-xl text-blue-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-medium text-blue-800">
                                        {isEnglish ? `${summary.recovered} students will be restored` : `${summary.recovered} คนจะกลับมาถูกต้อง`}
                                    </p>
                                    <p className="text-sm text-blue-600 mt-0.5">
                                        {isEnglish ? "Students who were previously outside the old time window now fall inside the new one and will regain the appropriate status." : 'นักศึกษาที่เคยอยู่นอกช่วงเวลาเดิมจะกลับมาอยู่ในช่วงเวลาใหม่ และได้รับสถานะตามเวลาเช็คอิน'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Leave status note */}
                    {hasAnyImpact && (
                        <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-100">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:shield-check-bold" className="text-purple-500 shrink-0" />
                                <p className="text-xs text-purple-600">
                                    {isEnglish ? 'Students with "Leave" status set by the instructor will not be changed automatically.' : 'นักศึกษาที่มีสถานะ "ลา" (กำหนดโดยอาจารย์) จะไม่ถูกเปลี่ยนแปลง — ข้อมูลจะถูกข้ามโดยอัตโนมัติ'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Affected Records Table */}
                    {changes.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="flex items-center gap-2 text-sm font-semibold text-default-700">
                                <Icon icon="solar:users-group-rounded-bold" className="text-default-500" />
                                {isEnglish ? `Affected students (${changes.length})` : `รายละเอียดนักศึกษาที่ได้รับผลกระทบ (${changes.length} คน)`}
                            </h4>
                            <div className="overflow-x-auto">
                                <Table removeWrapper aria-label={isEnglish ? "Attendance impact preview" : "ผลกระทบ"} classNames={{ th: "bg-content2 text-default-600 text-xs", td: "text-sm" }}>
                                    <TableHeader>
                                        <TableColumn>{isEnglish ? "Student" : 'นักศึกษา'}</TableColumn>
                                        <TableColumn align="center">{isEnglish ? "Check-in time" : 'เวลาเช็คอิน'}</TableColumn>
                                        <TableColumn align="center">{isEnglish ? "Change" : 'การเปลี่ยนแปลง'}</TableColumn>
                                    </TableHeader>
                                    <TableBody items={changes.slice(0, 20)}>
                                        {(record: TimeChangeRecord) => {
                                            const cfg = changeTypeConfig[record.change_type] || changeTypeConfig.already_invalid;
                                            return (
                                                <TableRow key={record.record_id}>
                                                    <TableCell>
                                                        <div>
                                                            <p className="font-medium text-foreground">{record.student_name || '-'}</p>
                                                            <p className="text-xs text-default-400">{record.student_id || ''}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-default-600">
                                                            {new Date(record.check_in_time).toLocaleTimeString(isEnglish ? "en-US" : 'th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip size="sm" variant="flat" className={`${cfg.bgClass} ${cfg.color} gap-1`} startContent={<Icon icon={cfg.icon} width={14} />}>
                                                            {cfg.label}
                                                        </Chip>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }}
                                    </TableBody>
                                </Table>
                                {changes.length > 20 && (
                                    <p className="mt-2 text-center text-xs text-default-400">
                                        {isEnglish ? `Showing 20 of ${changes.length} records` : `แสดง 20 จาก ${changes.length} รายการ`}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* No Impact */}
                    {!hasAnyImpact && (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 mx-auto mb-3 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Icon icon="solar:check-circle-bold" className="text-3xl text-emerald-500" />
                            </div>
                            <p className="font-medium text-default-700">{isEnglish ? "No impact on attendance records" : 'ไม่มีผลกระทบต่อข้อมูลเช็คชื่อ'}</p>
                            <p className="mt-1 text-sm text-default-500">
                                {isEnglish ? "The time changes do not affect existing attendance statuses." : 'การเปลี่ยนแปลงเวลาไม่ส่งผลกระทบต่อสถานะเช็คชื่อที่มีอยู่'}
                            </p>
                        </div>
                    )}
                </ModalBody>

                <ModalFooter className="border-t border-divider px-6 py-4">
                    <Button variant="light" onPress={onClose} isDisabled={isApplying}>
                        {isEnglish ? "Cancel" : 'ยกเลิก'}
                    </Button>
                    <Button
                        color={hasDestructiveChanges ? 'danger' : 'primary'}
                        onPress={onConfirm}
                        isLoading={isApplying}
                        className={hasDestructiveChanges ? 'bg-red-500' : 'bg-linear-to-r from-amber-400 to-orange-500'}
                        startContent={!isApplying ? <Icon icon={hasDestructiveChanges ? 'solar:shield-warning-bold' : 'solar:check-circle-bold'} /> : undefined}
                    >
                        {hasDestructiveChanges ? (isEnglish ? 'Confirm changes' : 'ยืนยันการเปลี่ยนแปลง') : (isEnglish ? 'Save changes' : 'บันทึกการแก้ไข')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
});

// ============================================================================
// Section Change Warning Modal
// Shows which checked-in students will lose their data when sections are removed
// ============================================================================

const getSectionStatusLabels = (isEnglish: boolean): Record<string, { label: string; color: string; icon: string }> => ({
    present: { label: isEnglish ? "Present" : 'มาเรียน', color: 'text-emerald-600', icon: 'solar:check-circle-bold' },
    late: { label: isEnglish ? "Late" : 'สาย', color: 'text-amber-600', icon: 'solar:clock-circle-bold' },
    leave: { label: isEnglish ? "Leave" : 'ลา', color: 'text-purple-600', icon: 'solar:letter-bold' },
});

interface SectionChangeWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    preview: SectionChangePreview | null;
    isSubmitting: boolean;
    onConfirm: () => Promise<void>;
}

export const SectionChangeWarningModal = memo(function SectionChangeWarningModal({
    isOpen,
    onClose,
    preview,
    isSubmitting,
    onConfirm,
}: SectionChangeWarningModalProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    if (!preview) return null;

    const { removed_sections, affected_students, total_affected } = preview;
    const statusLabels = getSectionStatusLabels(isEnglish);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside" isDismissable={false}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-linear-to-br from-red-500 to-rose-600 rounded-xl shadow-lg">
                            <Icon icon="solar:danger-triangle-bold" className="text-2xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground">
                                {isEnglish ? "Warning: checked-in students found" : 'คำเตือน: มีนักศึกษาที่เช็คชื่อแล้ว'}
                            </h3>
                            <p className="mt-1 text-sm font-normal text-default-500">
                                {preview.session_title}
                            </p>
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody className="px-6 py-4 space-y-4">
                    {/* Removed Sections */}
                    <div className="space-y-2">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-default-700">
                            <Icon icon="solar:minus-circle-bold" className="text-red-500" />
                            {isEnglish ? "Sections to remove" : 'กลุ่มเรียนที่จะถูกนำออก'}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {removed_sections.map(section => (
                                <Chip
                                    key={section.id}
                                    size="sm"
                                    variant="flat"
                                    className="bg-red-50 text-red-700 border border-red-200"
                                    startContent={<Icon icon="solar:users-group-rounded-bold" width={14} />}
                                >
                                    {isEnglish ? `Section ${section.section_no}` : `กลุ่ม ${section.section_no}`}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    {/* Warning Box */}
                    <div className="p-4 bg-red-100 rounded-xl border border-red-200">
                        <div className="flex items-start gap-3">
                            <Icon icon="solar:shield-warning-bold" className="text-2xl text-red-600 mt-0.5 shrink-0" />
                            <div className="space-y-1.5">
                                <p className="font-semibold text-red-800">
                                        {isEnglish ? `Attendance data for ${total_affected} students will be removed` : `ข้อมูลการเช็คชื่อของนักศึกษา ${total_affected} คนจะถูกลบออก`}
                                </p>
                                <p className="text-sm text-red-600">
                                        {isEnglish ? "Students in the removed sections who already checked in will lose all attendance data for this session. This action cannot be undone." : 'นักศึกษาในกลุ่มที่ถูกนำออกซึ่งเช็คชื่อแล้วจะสูญเสียข้อมูลการเช็คชื่อทั้งหมดในรอบนี้ การดำเนินการนี้ไม่สามารถย้อนกลับได้'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Affected Students Table */}
                    {affected_students.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="flex items-center gap-2 text-sm font-semibold text-default-700">
                                <Icon icon="solar:users-group-rounded-bold" className="text-default-500" />
                                {isEnglish ? `Affected students (${total_affected})` : `นักศึกษาที่ได้รับผลกระทบ (${total_affected} คน)`}
                            </h4>
                            <div className="overflow-x-auto">
                                <Table removeWrapper aria-label={isEnglish ? "Affected students" : "นักศึกษาที่ได้รับผลกระทบ"} classNames={{ th: "bg-content2 text-default-600 text-xs", td: "text-sm" }}>
                                    <TableHeader>
                                        <TableColumn>{isEnglish ? "Student" : 'นักศึกษา'}</TableColumn>
                                        <TableColumn align="center">{isEnglish ? "Section" : 'กลุ่ม'}</TableColumn>
                                        <TableColumn align="center">{isEnglish ? "Status" : 'สถานะ'}</TableColumn>
                                        <TableColumn align="center">{isEnglish ? "Check-in time" : 'เวลาเช็คอิน'}</TableColumn>
                                    </TableHeader>
                                    <TableBody items={affected_students.slice(0, 30)}>
                                        {(student) => {
                                            const cfg = statusLabels[student.status] || statusLabels.present;
                                            return (
                                                <TableRow key={student.record_id}>
                                                    <TableCell>
                                                        <div>
                                                            <p className="font-medium text-foreground">{student.student_name || '-'}</p>
                                                            <p className="text-xs text-default-400">{student.student_id || ''}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-default-600">{student.section_no}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip size="sm" variant="flat" className={`${cfg.color} gap-1`} startContent={<Icon icon={cfg.icon} width={14} />}>
                                                            {cfg.label}
                                                        </Chip>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-default-600">
                                                            {student.check_in_time
                                                                ? new Date(student.check_in_time).toLocaleTimeString(isEnglish ? "en-US" : 'th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                                                : '-'}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }}
                                    </TableBody>
                                </Table>
                                {affected_students.length > 30 && (
                                    <p className="mt-2 text-center text-xs text-default-400">
                                        {isEnglish ? `Showing 30 of ${affected_students.length} records` : `แสดง 30 จาก ${affected_students.length} รายการ`}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </ModalBody>

                <ModalFooter className="border-t border-divider px-6 py-4">
                    <Button variant="light" onPress={onClose} isDisabled={isSubmitting}>
                        {isEnglish ? "Cancel" : 'ยกเลิก'}
                    </Button>
                    <Button
                        color="danger"
                        onPress={onConfirm}
                        isLoading={isSubmitting}
                        className="bg-red-500"
                    >
                        {isEnglish ? "Confirm section removal" : 'ยืนยันการนำกลุ่มออก'}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
});
