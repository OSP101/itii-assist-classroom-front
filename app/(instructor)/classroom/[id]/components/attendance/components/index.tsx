/**
 * AttendanceTab Sub-components
 * Memoized components for better performance
 */

"use client";

import React, { memo, Suspense, lazy, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Skeleton } from "@heroui/skeleton";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Divider } from "@heroui/divider";
import { Pagination } from "@heroui/pagination";
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

import {
    type SessionWithComputedStatus,
    type AttendanceStats,
    type Section,
    type CreateAttendanceData,
    SESSION_TYPE_DISPLAY,
    STATUS_DISPLAY,
    RADIUS_OPTIONS,
    formatDate,
    formatTime,
} from "../config";
import { type AttendanceSession, type TimeChangePreview, type TimeChangeRecord, type SectionChangePreview } from "@/services/attendance.service";

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
        ? "border-slate-200 hover:border-amber-300 focus:border-amber-500 focus:ring-amber-500/20"
        : "border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:ring-blue-500/20";

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
                {label}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
                type="datetime-local"
                value={toDateTimeLocalStr(value)}
                onChange={handleChange}
                min={min}
                max={max}
                className={`w-full px-3 py-2.5 rounded-xl bg-white border-2 ${borderColor} 
                    text-slate-800 text-sm transition-all duration-200
                    focus:outline-none focus:ring-4
                    placeholder:text-slate-400`}
            />
            {description && (
                <p className={`text-xs font-medium ${colorScheme === "amber" ? "text-amber-600" : "text-slate-500"}`}>
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
        <Card className="shadow-sm border border-slate-200">
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
                <Card key={i} className="shadow-sm border border-slate-200">
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
    const items = [
        {
            label: "ทั้งหมด",
            value: stats.total,
            icon: "solar:calendar-bold",
            iconClass: "text-blue-600",
            bgClass: "bg-blue-100",
        },
        {
            label: "กำลังเปิด",
            value: stats.active,
            icon: "solar:play-circle-bold",
            iconClass: "text-emerald-600",
            bgClass: "bg-emerald-100",
        },
        {
            label: "ฉบับร่าง",
            value: stats.draft,
            icon: "solar:document-bold",
            iconClass: "text-slate-600",
            bgClass: "bg-slate-100",
        },
        {
            label: "ปิดแล้ว",
            value: stats.closed,
            icon: "solar:stop-circle-bold",
            iconClass: "text-red-600",
            bgClass: "bg-red-100",
        },
    ];

    return (
        <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((item) => (
                <Card key={item.label} className="shadow-sm border border-slate-200">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 ${item.bgClass} rounded-xl`}>
                                <Icon icon={item.icon} className={`text-2xl ${item.iconClass}`} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">{item.label}</p>
                                <p className="text-2xl font-bold text-slate-800">{item.value}</p>
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
    return (
        <Card className="shadow-sm border border-slate-200">
            <CardBody className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                        placeholder="ค้นหาชื่อรอบการเช็คชื่อ..."
                        value={searchQuery}
                        onValueChange={onSearchChange}
                        startContent={<Icon icon="solar:magnifer-linear" className="text-slate-400" />}
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
                            placeholder="สถานะ"
                            selectedKeys={[statusFilter]}
                            onSelectionChange={(keys) => onStatusChange(Array.from(keys)[0] as string)}
                            className="w-full sm:w-40"
                            variant="bordered"
                            size="md"
                        >
                            <SelectItem key="all">ทุกสถานะ</SelectItem>
                            <SelectItem key="draft">ฉบับร่าง</SelectItem>
                            <SelectItem key="active">กำลังเปิด</SelectItem>
                            <SelectItem key="closed">ปิดแล้ว</SelectItem>
                        </Select>
                        <Select
                            placeholder="ประเภท"
                            selectedKeys={[typeFilter]}
                            onSelectionChange={(keys) => onTypeChange(Array.from(keys)[0] as string)}
                            className="w-full sm:w-40"
                            variant="bordered"
                            size="md"
                        >
                            <SelectItem key="all">ทุกประเภท</SelectItem>
                            <SelectItem key="lecture">บรรยาย</SelectItem>
                            <SelectItem key="lab">ปฏิบัติ</SelectItem>
                            <SelectItem key="online">ออนไลน์</SelectItem>
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
    canCreateAttendanceSessions?: boolean;
}

export const EmptyState = memo(function EmptyState({ onCreateClick, canCreateAttendanceSessions = false }: EmptyStateProps) {
    return (
        <Card className="shadow-sm border border-dashed border-slate-300 bg-slate-50/50">
            <CardBody className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                    <Icon
                        icon="solar:clipboard-check-bold-duotone"
                        className="text-5xl text-blue-500"
                    />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">ยังไม่มีรอบการเช็คชื่อ</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                    สร้างรอบการเช็คชื่อเพื่อให้นักศึกษาสามารถเช็คชื่อเข้าเรียนได้
                </p>
                {canCreateAttendanceSessions && (
                    <Button
                        color="primary"
                        startContent={<Icon icon="solar:add-circle-bold" />}
                        onPress={onCreateClick}
                        className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                    >
                        สร้างรอบเช็คชื่อแรก
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
    if (!session) return null;

    const checkInUrl = typeof window !== "undefined"
        ? `${window.location.origin}/check-in/${session.id}`
        : "";

    const copyPIN = () => {
        if (session.pin_code) {
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

    const copyURL = () => {
        navigator.clipboard.writeText(checkInUrl);
        addToast({
            title: "คัดลอกแล้ว",
            description: "ลิงก์เช็คชื่อถูกคัดลอกไปยังคลิปบอร์ดแล้ว",
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
            downloadLink.download = `check-in-${session.title}-${session.pin_code}.png`;
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
                        <p className="font-semibold">QR Code และ PIN</p>
                        <p className="text-sm font-normal text-slate-500">สำหรับตั้งเวลาโพสต์</p>
                    </div>
                </ModalHeader>
                <Divider />
                <ModalBody className="py-6">


                    {/* QR Code */}
                    <div className="text-center mb-3">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">QR CODE</p>
                        <div className="inline-block p-4 bg-white rounded-xl border-2 border-slate-200">
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
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">PIN CODE</p>
                        <div
                            className="inline-block px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-colors"
                            onClick={copyPIN}
                        >
                            <div className="flex gap-4 px-5">
                                {session.pin_code.split('').map((digit, index) => (
                                    <span key={index} className="text-4xl font-bold text-white font-mono">
                                        {digit}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* URL */}
                    <div className="p-3 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-400 mb-1">ลิงก์เช็คชื่อ</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-sm text-blue-600 bg-white px-3 py-2 rounded-lg border truncate">
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
                        ปิด
                    </Button>
                    <Button
                        color="primary"
                        startContent={<Icon icon="solar:download-bold" />}
                        onPress={downloadQR}
                    >
                        ดาวน์โหลด QR
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
    onActivate: (session: AttendanceSession) => void;
    onEdit: (session: AttendanceSession) => void;
    onDelete: (session: AttendanceSession) => void;
    onClose: (session: AttendanceSession) => void;
    onShowQR?: (session: SessionWithComputedStatus) => void;
    canUpdateAttendanceSessions?: boolean;
    canDeleteAttendanceSessions?: boolean;
}

const SessionRowActions = memo(function SessionRowActions({
    session,
    courseId,
    onActivate,
    onEdit,
    onDelete,
    onClose,
    onShowQR,
    canUpdateAttendanceSessions = false,
    canDeleteAttendanceSessions = false,
}: SessionRowActionsProps) {
    if (session.status === "draft") {
        return (
            <>
                <Tooltip content="ดู QR/PIN">
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="secondary"
                        onPress={() => onShowQR?.(session)}
                    >
                        <Icon icon="solar:qr-code-bold" className="text-lg" />
                    </Button>
                </Tooltip>
                {canUpdateAttendanceSessions && (
                    <Tooltip content="เริ่มเปิดเช็คชื่อทันที">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="success"
                            onPress={() => onActivate(session)}
                        >
                            <Icon icon="solar:play-bold" className="text-lg" />
                        </Button>
                    </Tooltip>
                )}
                {canUpdateAttendanceSessions && (
                    <Tooltip content="แก้ไข">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="primary"
                            onPress={() => onEdit(session)}
                        >
                            <Icon icon="solar:pen-bold" className="text-lg" />
                        </Button>
                    </Tooltip>
                )}
                {canDeleteAttendanceSessions && (
                    <Tooltip content="ลบ" color="danger">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => onDelete(session)}
                        >
                            <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />
                        </Button>
                    </Tooltip>
                )}
            </>
        );
    }

    if (session.status === "active") {
        return (
            <>
                <Tooltip content="ดูหน้าเช็คชื่อ">
                    <Link
                        className="inline-flex items-center justify-center p-2 rounded-lg hover:bg-gray-100"
                        href={`/attendance/${courseId}/session/${session.id}/live`}
                        target="_blank"
                    >
                        <Icon icon="solar:eye-bold" className="text-lg text-blue-600" />
                    </Link>
                </Tooltip>
                <Tooltip content="ดูสรุป">
                    <Link
                        className="inline-flex items-center justify-center p-2 rounded-lg hover:bg-gray-100"
                        href={`/classroom/${courseId}/attendance/${session.id}/summary`}
                        target="_blank"
                    >
                        <Icon icon="solar:chart-bold" className="text-lg" />
                    </Link>
                </Tooltip>
                {canUpdateAttendanceSessions && (
                    <Tooltip content="แก้ไขเวลา">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="primary"
                            onPress={() => onEdit(session)}
                        >
                            <Icon icon="solar:pen-bold" className="text-lg" />
                        </Button>
                    </Tooltip>
                )}
                {canUpdateAttendanceSessions && (
                    <Tooltip content="ปิดทันที" color="danger">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => onClose(session)}
                        >
                            <Icon icon="solar:stop-bold" className="text-lg" />
                        </Button>
                    </Tooltip>
                )}
            </>
        );
    }

    // closed status
    return (
        <>
            <Tooltip content="ดูหน้าเช็คชื่อ">
                <Link
                    className="inline-flex items-center justify-center p-2 rounded-lg hover:bg-gray-100"
                    href={`/attendance/${courseId}/session/${session.id}/live`}
                    target="_blank"
                >
                    <Icon icon="solar:eye-bold" className="text-lg" />
                </Link>
            </Tooltip>
            <Tooltip content="ดูสรุป">
                <Link
                    className="inline-flex items-center justify-center p-2 rounded-lg hover:bg-gray-100"
                    href={`/classroom/${courseId}/attendance/${session.id}/summary`}
                    target="_blank"
                >
                    <Icon icon="solar:chart-bold" className="text-lg" />
                </Link>
            </Tooltip>

            {canDeleteAttendanceSessions && (
                <Tooltip content="ลบ" color="danger">
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => onDelete(session)}
                    >
                        <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />
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
    courseId: string;
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
    courseId,
    onCreateClick,
    onActivate,
    onEdit,
    onDelete,
    onClose,
    canCreateAttendanceSessions = false,
    canUpdateAttendanceSessions = false,
    canDeleteAttendanceSessions = false,
}: SessionsTableProps) {
    // QR Preview Modal State
    const [qrPreviewSession, setQRPreviewSession] = useState<SessionWithComputedStatus | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
    const paginatedSessions = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sessions.slice(start, start + ITEMS_PER_PAGE);
    }, [sessions, currentPage]);

    return (
        <>
            <Card className="shadow-sm border border-slate-200">
                <CardBody className="p-2">
                    <div className="overflow-x-auto">
                        <Table
                            aria-label="Attendance sessions table"
                            removeWrapper
                            classNames={{
                                base: "min-w-[900px]",
                                th: "bg-slate-50 text-slate-600 font-semibold text-sm whitespace-nowrap",
                                td: "py-3 whitespace-nowrap",
                            }}
                        >
                            <TableHeader>
                                <TableColumn className="min-w-[160px]">รอบการเช็คชื่อ</TableColumn>
                                <TableColumn className="min-w-[100px]">เซคชัน</TableColumn>
                                <TableColumn className="min-w-[90px]">ประเภท</TableColumn>
                                <TableColumn className="min-w-[140px]">วันเวลา</TableColumn>
                                <TableColumn className="min-w-[90px]">สถานะ</TableColumn>
                                <TableColumn className="min-w-[140px]">สถิติ</TableColumn>
                                <TableColumn align="center" className="min-w-[120px]">จัดการ</TableColumn>
                            </TableHeader>
                            <TableBody
                                emptyContent={
                                    <div className="py-10 text-center">
                                        <Icon
                                            icon="solar:clipboard-list-linear"
                                            className="text-5xl text-slate-300 mx-auto mb-3"
                                        />
                                        <p className="text-slate-400">ไม่พบรอบการเช็คชื่อที่ตรงกับเงื่อนไข</p>
                                        {canCreateAttendanceSessions && (
                                            <Button
                                                color="primary"
                                                variant="flat"
                                                size="sm"
                                                className="mt-3"
                                                onPress={onCreateClick}
                                            >
                                                สร้างรอบเช็คชื่อ
                                            </Button>
                                        )}
                                    </div>
                                }
                            >
                                {paginatedSessions.map((session) => (
                                    <TableRow key={session.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <p className="font-medium text-slate-800">{session.title}</p>
                                                    {session.check_location && (
                                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                                            <span>ตรวจสอบตำแหน่ง</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {session.sections && session.sections.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {session.sections.map((sec) => (
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
                                                <span className="text-slate-500 text-sm">ทุกเซคชัน</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                size="sm"
                                                color={SESSION_TYPE_DISPLAY[session.session_type]?.color || "default"}
                                                variant="flat"
                                            >
                                                {SESSION_TYPE_DISPLAY[session.session_type]?.label || session.session_type}
                                            </Chip>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <p className="text-slate-800">{formatDate(session.start_time)}</p>
                                                <p className="text-slate-500">
                                                    {formatTime(session.start_time)} - {formatTime(session.end_time)}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                size="sm"
                                                color={STATUS_DISPLAY[session.status]?.color || "default"}
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
                                                {STATUS_DISPLAY[session.status]?.label || session.status}
                                            </Chip>
                                        </TableCell>
                                        <TableCell>
                                            {session.stats ? (
                                                <div className="flex items-center gap-2">
                                                    <Tooltip content="มาเรียน">
                                                        <Chip size="sm" color="success" variant="flat">
                                                            {session.stats.present}
                                                        </Chip>
                                                    </Tooltip>
                                                    <Tooltip content="สาย">
                                                        <Chip size="sm" color="warning" variant="flat">
                                                            {session.stats.late}
                                                        </Chip>
                                                    </Tooltip>
                                                    <Tooltip content="ขาด">
                                                        <Chip size="sm" color="danger" variant="flat">
                                                            {session.stats.absent}
                                                        </Chip>
                                                    </Tooltip>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-1">
                                                <SessionRowActions
                                                    session={session}
                                                    courseId={courseId}
                                                    onActivate={onActivate}
                                                    onEdit={onEdit}
                                                    onDelete={onDelete}
                                                    onClose={onClose}
                                                    onShowQR={setQRPreviewSession}
                                                    canUpdateAttendanceSessions={canUpdateAttendanceSessions}
                                                    canDeleteAttendanceSessions={canDeleteAttendanceSessions}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center py-4 border-t border-slate-100">
                            <Pagination
                                total={totalPages}
                                page={currentPage}
                                onChange={setCurrentPage}
                                showControls
                                size="sm"
                                color="primary"
                                classNames={{
                                    wrapper: "gap-1",
                                    item: "bg-transparent",
                                    cursor: "bg-blue-500 text-white shadow-md",
                                }}
                            />
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* QR Preview Modal */}
            <QRPreviewModal
                isOpen={!!qrPreviewSession}
                onClose={() => setQRPreviewSession(null)}
                session={qrPreviewSession}
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
    return (
        <Card className="border border-slate-200 overflow-hidden">
            <CardBody className="p-0">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-xl">
                            <Icon icon="solar:map-point-bold" className="text-xl text-blue-600" />
                        </div>
                        <div>
                            <span className="font-semibold text-slate-800">ตรวจสอบตำแหน่ง GPS</span>
                            <p className="text-xs text-slate-500">ให้นักศึกษาต้องอยู่ในบริเวณที่กำหนด</p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant={checkLocation ? "solid" : "bordered"}
                        color={checkLocation ? "primary" : "default"}
                        onPress={onToggle}
                        startContent={
                            <Icon
                                icon={checkLocation ? "solar:check-circle-bold" : "solar:close-circle-linear"}
                                className="text-lg"
                            />
                        }
                    >
                        {checkLocation ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                    </Button>
                </div>

                {checkLocation && (
                    <div className="p-4 space-y-4">
                        {/* GPS Button */}
                        <button
                            type="button"
                            onClick={onGetCurrentLocation}
                            disabled={isGettingLocation}
                            className={`group relative p-4 rounded-xl border-2 border-dashed transition-all duration-200 w-full ${isGettingLocation
                                ? "border-blue-400 bg-blue-50 cursor-wait"
                                : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/50"
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
                                <span className="font-medium text-slate-700">
                                    {isGettingLocation ? "กำลังดึง GPS..." : "ดึงจาก GPS ของเครื่อง"}
                                </span>
                                <span className="text-xs text-slate-500">
                                    {isGettingLocation ? "รอสักครู่..." : "ใช้ GPS ความแม่นยำสูง"}
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
                            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <Icon icon="solar:map-point-wave-bold" className="text-xl text-green-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Icon icon="solar:check-circle-bold" className="text-green-600" />
                                            <span className="font-medium text-green-700">กำหนดตำแหน่งแล้ว</span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-slate-500">Lat:</span>
                                                <code className="px-1.5 py-0.5 bg-white rounded text-green-700 font-mono text-xs">
                                                    {Number(locationLat).toFixed(6)}
                                                </code>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-slate-500">Lng:</span>
                                                <code className="px-1.5 py-0.5 bg-white rounded text-green-700 font-mono text-xs">
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
                                        <span className="font-medium text-amber-700">ยังไม่ได้กำหนดตำแหน่ง</span>
                                        <p className="text-xs text-amber-600 mt-0.5">กรุณาเลือกวิธีกำหนดตำแหน่งด้านบน</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Map Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:map-bold" className="text-slate-400" />
                                <span className="text-sm font-medium text-slate-600">แผนที่ (คลิกเพื่อปักหมุด)</span>
                            </div>
                            <Suspense fallback={
                                <div className="h-[280px] bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl flex items-center justify-center border border-slate-200">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-4 bg-white rounded-full shadow-sm">
                                            <Icon icon="solar:map-bold" className="text-4xl text-slate-400 animate-pulse" />
                                        </div>
                                        <span className="text-sm text-slate-500">กำลังโหลดแผนที่...</span>
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
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-violet-100 rounded-lg">
                                    <Icon icon="solar:ruler-angular-bold" className="text-lg text-violet-600" />
                                </div>
                                <div>
                                    <span className="font-medium text-slate-700">รัศมีที่อนุญาต</span>
                                    <p className="text-xs text-slate-500">ระยะห่างจากจุดกำหนดที่อนุญาตให้เช็คชื่อได้</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="number"
                                    variant="bordered"
                                    value={String(radiusMeters)}
                                    onValueChange={(value) => onRadiusChange(parseInt(value) || 10)}
                                    size="sm"
                                    endContent={<span className="text-slate-400 text-sm">เมตร</span>}
                                    className="max-w-[150px]"
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
    return (
        <Modal
            isOpen={isOpen}
            isDismissable={false}
            isKeyboardDismissDisabled={true}
            onClose={onClose}
            size="2xl"
            scrollBehavior="inside"
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg">
                            <Icon icon="solar:clipboard-check-bold" className="text-2xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">สร้างรอบการเช็คชื่อ</h3>
                            <p className="text-sm text-slate-500 font-normal mt-1">
                                กำหนดรายละเอียดการเช็คชื่อเข้าเรียน
                            </p>
                        </div>
                    </div>
                </ModalHeader>
                <ModalBody className="px-6 py-4">
                    <div className="space-y-5">
                        {/* Title */}
                        <div>
                            <Input
                                label="ชื่อรอบการเช็คชื่อ"
                                placeholder="เช่น เช็คชื่อสัปดาห์ที่ 1, Lab 1"
                                value={formData.title}
                                onValueChange={(value) => setFormData((prev) => ({ ...prev, title: value }))}
                                isRequired
                                labelPlacement="outside"
                                variant="bordered"
                                size="md"
                                classNames={{
                                    inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            />
                        </div>

                        {/* Section - Multi-select */}
                        <div>
                            <Select
                                label="กลุ่มเรียน"
                                placeholder="เลือกกลุ่มเรียน"
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
                                    trigger: "bg-white border-slate-200",
                                    label: "text-slate-600 font-medium text-sm",
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
                                label="ประเภทการเรียน"
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
                                    trigger: "bg-white border-slate-200",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            >
                                <SelectItem key="lecture">
                                    บรรยาย (Lecture)
                                </SelectItem>
                                <SelectItem key="lab">
                                    ปฏิบัติการ (Lab)
                                </SelectItem>
                                <SelectItem key="online">
                                    ออนไลน์ (Online)
                                </SelectItem>
                            </Select>
                        </div>

                        {/* Date Time */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <DateTimeInput
                                label="เวลาเริ่มต้น"
                                value={startDateTime}
                                onChange={setStartDateTime}
                                isRequired
                                colorScheme="blue"
                            />
                            <DateTimeInput
                                label="เวลาสิ้นสุด"
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
                                label="เวลาตัดสาย"
                                value={lateThresholdTime}
                                onChange={setLateThresholdTime}
                                isRequired
                                colorScheme="amber"
                                description="เช็คอินหลังเวลานี้จะถูกนับเป็นสาย"
                                min={toDateTimeLocalStr(startDateTime)}
                                max={toDateTimeLocalStr(endDateTime)}
                            />
                        </div>

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
                <ModalFooter className="px-6 py-4 border-t border-slate-100">
                    <Button variant="light" onPress={onClose}>
                        ยกเลิก
                    </Button>
                    <Button
                        color="primary"
                        onPress={onSubmit}
                        isLoading={isSubmitting}
                        className="bg-gradient-to-r from-blue-400 to-indigo-500"
                    >
                        สร้างรอบเช็คชื่อ
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
    return (
        <Modal
            isOpen={isOpen}
            isDismissable={false}
            isKeyboardDismissDisabled={true}
            onClose={onClose}
            size="2xl"
            scrollBehavior="inside"
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg">
                            <Icon icon="solar:pen-bold" className="text-2xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">แก้ไขรอบการเช็คชื่อ</h3>
                            <p className="text-sm text-slate-500 font-normal mt-1">
                                {editTarget?.title}
                            </p>
                        </div>
                    </div>
                </ModalHeader>
                <ModalBody className="px-6 py-4">
                    <div className="space-y-3">
                        {/* Title */}
                        <Input
                            label="ชื่อรอบการเช็คชื่อ"
                            value={formData.title}
                            onValueChange={(value) => setFormData((prev: CreateAttendanceData) => ({ ...prev, title: value }))}
                            isRequired
                            labelPlacement="outside"
                            variant="bordered"
                            size="md"
                            classNames={{
                                inputWrapper: "bg-white border-slate-200 hover:border-amber-300 focus-within:!border-amber-400",
                                label: "text-slate-600 font-medium text-sm",
                            }}
                        />

                        {/* Section - Multi-select */}
                        <Select
                            label="กลุ่มเรียน"
                            placeholder="เลือกกลุ่มเรียน"
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
                                trigger: "bg-white border-slate-200",
                                label: "text-slate-800 font-medium text-sm",
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
                            label="ประเภทการสอน"
                            selectedKeys={[formData.session_type]}
                            labelPlacement="outside"
                            variant="bordered"
                            size="md"
                            onSelectionChange={(keys) => {
                                const selected = Array.from(keys)[0] as "lecture" | "lab" | "online";
                                setFormData((prev: CreateAttendanceData) => ({ ...prev, session_type: selected }));
                            }}
                            classNames={{
                                trigger: "bg-white border-slate-200",
                                label: "text-slate-800 font-medium text-sm",
                            }}
                        >
                            <SelectItem key="lecture" startContent={<Icon icon="solar:presentation-graph-bold" className="text-blue-500" />}>
                                บรรยาย
                            </SelectItem>
                            <SelectItem key="lab" startContent={<Icon icon="solar:test-tube-bold" className="text-emerald-500" />}>
                                ปฏิบัติ
                            </SelectItem>
                            <SelectItem key="online" startContent={<Icon icon="solar:laptop-bold" className="text-violet-500" />}>
                                ออนไลน์
                            </SelectItem>
                        </Select>

                        {/* Time Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            <DateTimeInput
                                label="เวลาเริ่มต้น"
                                value={startDateTime}
                                onChange={setStartDateTime}
                                isRequired
                                colorScheme="amber"
                            />
                            <DateTimeInput
                                label="เวลาสิ้นสุด"
                                value={endDateTime}
                                onChange={setEndDateTime}
                                isRequired
                                colorScheme="amber"
                                min={toDateTimeLocalStr(startDateTime)}
                                max={endOfDayStr(startDateTime)}
                            />
                        </div>

                        {/* Late Threshold Time */}
                        <div className="">
                            <DateTimeInput
                                label="เวลาสำหรับเช็คสาย"
                                value={lateThresholdTime}
                                onChange={setLateThresholdTime}
                                isRequired
                                colorScheme="amber"
                                description="เช็คอินหลังเวลานี้จะถูกนับเป็นสาย"
                                min={toDateTimeLocalStr(startDateTime)}
                                max={toDateTimeLocalStr(endDateTime)}
                            />
                        </div>


                        {/* Location Check */}
                        <Card className="border border-slate-200">
                            <CardBody className="p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="font-medium text-slate-700">ตรวจสอบตำแหน่ง GPS</p>
                                        <p className="text-sm text-slate-500">ให้นักศึกษาเช็คชื่อได้เฉพาะในพื้นที่ที่กำหนด</p>
                                    </div>
                                    <Button
                                        color={formData.check_location ? "primary" : "default"}
                                        variant={formData.check_location ? "solid" : "flat"}
                                        onPress={() => setFormData((prev: CreateAttendanceData) => ({ ...prev, check_location: !prev.check_location }))}
                                    >
                                        {formData.check_location ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                                    </Button>
                                </div>

                                {formData.check_location && (
                                    <div className="space-y-4">
                                        {/* Map */}
                                        <div className="rounded-xl overflow-hidden border border-slate-200">
                                            <Suspense fallback={
                                                <div className="h-64 bg-slate-100 flex items-center justify-center">
                                                    <span className="text-slate-400">กำลังโหลดแผนที่...</span>
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
                                                {isGettingLocation ? "กำลังระบุตำแหน่ง..." : "ใช้ตำแหน่งปัจจุบัน (GPS)"}
                                            </Button>
                                            <div className="flex-1">
                                                <p className="text-xs text-slate-500">
                                                    ตำแหน่ง: {formData.location_lat ? Number(formData.location_lat).toFixed(6) : "-"}, {formData.location_lng ? Number(formData.location_lng).toFixed(6) : "-"}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Radius */}
                                        <div>
                                            <p className="text-sm text-slate-600 mb-2">รัศมีการเช็คชื่อ</p>
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
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>
                        ยกเลิก
                    </Button>
                    <Button
                        color="primary"
                        onPress={onSubmit}
                        isLoading={isSubmitting}
                        className="bg-gradient-to-r from-amber-400 to-orange-500"
                    >
                        บันทึกการแก้ไข
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
    targetTitle: string | undefined;
    isSubmitting: boolean;
    onConfirm: () => Promise<void>;
}

export const DeleteConfirmModal = memo(function DeleteConfirmModal({
    isOpen,
    onClose,
    targetTitle,
    isSubmitting,
    onConfirm,
}: DeleteConfirmModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <Icon icon="solar:trash-bin-trash-bold" className="text-xl text-red-600" />
                        </div>
                        <span>ยืนยันการลบรอบเช็คชื่อ</span>
                    </div>
                </ModalHeader>
                <ModalBody>
                    <p>
                        คุณต้องการลบรอบการเช็คชื่อ <strong className="text-red-600">{targetTitle}</strong> หรือไม่?
                    </p>
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <Icon icon="solar:danger-triangle-bold" className="text-red-500 text-lg mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-red-700">
                                <p className="font-bold">คำเตือน: การลบจะไม่สามารถกู้คืนได้!</p>
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>ข้อมูลการเช็คชื่อทั้งหมดจะ<strong>หายไปถาวร</strong></li>
                                    <li>ผลการเช็คชื่อของนักศึกษาจะถูกลบ</li>
                                    <li>ไม่สามารถกู้คืนข้อมูลได้</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>
                        ยกเลิก
                    </Button>
                    <Button color="danger" onPress={onConfirm} isLoading={isSubmitting}>
                        ลบถาวร
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
    targetTitle: string | undefined;
    isSubmitting: boolean;
    onConfirm: () => Promise<void>;
}

export const CloseSessionModal = memo(function CloseSessionModal({
    isOpen,
    onClose,
    targetTitle,
    isSubmitting,
    onConfirm,
}: CloseSessionModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <Icon icon="solar:stop-bold" className="text-xl text-red-600" />
                        </div>
                        <span>ยืนยันการปิดรอบเช็คชื่อ</span>
                    </div>
                </ModalHeader>
                <ModalBody>
                    <p>
                        คุณต้องการปิดรอบการเช็คชื่อ <strong>{targetTitle}</strong> ทันทีหรือไม่?
                    </p>
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <Icon icon="solar:danger-triangle-bold" className="text-amber-500 text-lg mt-0.5" />
                            <div className="text-sm text-amber-700">
                                <p className="font-medium">หลังจากปิดแล้ว:</p>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                    <li>นักศึกษาจะไม่สามารถเช็คชื่อได้อีก</li>
                                    <li>ไม่สามารถแก้ไขรอบเช็คชื่อได้</li>
                                    <li>รหัส PIN จะถูกปล่อยให้รอบอื่นใช้งานได้</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>
                        ยกเลิก
                    </Button>
                    <Button color="danger" onPress={onConfirm} isLoading={isSubmitting}>
                        <Icon icon="solar:stop-bold" className="text-lg" />
                        ปิดรอบเช็คชื่อ
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
 * Format ISO date string to localized Thai short datetime
 */
const formatPreviewTime = (isoStr: string) => {
    try {
        return new Date(isoStr).toLocaleString('th-TH', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return isoStr;
    }
};

const CHANGE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string; bgClass: string }> = {
    will_be_invalidated: { label: 'จะถูกยกเลิก', color: 'text-red-600', icon: 'solar:close-circle-bold', bgClass: 'bg-red-50' },
    present_to_late: { label: 'มาตรงเวลา → สาย', color: 'text-amber-600', icon: 'solar:clock-circle-bold', bgClass: 'bg-amber-50' },
    late_to_present: { label: 'สาย → มาตรงเวลา', color: 'text-emerald-600', icon: 'solar:check-circle-bold', bgClass: 'bg-emerald-50' },
    recovered: { label: 'กลับมาถูกต้อง', color: 'text-blue-600', icon: 'solar:refresh-circle-bold', bgClass: 'bg-blue-50' },
    already_invalid: { label: 'ยังคงอยู่นอกช่วงเวลา', color: 'text-slate-500', icon: 'solar:minus-circle-bold', bgClass: 'bg-slate-50' },
};

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
    if (!preview) return null;

    const { summary, changes, timeChanges, hasDestructiveChanges, hasAnyImpact } = preview;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside" isDismissable={false}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl shadow-lg ${hasDestructiveChanges ? 'bg-gradient-to-br from-red-500 to-rose-600' : hasAnyImpact ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-blue-400 to-indigo-500'}`}>
                            <Icon icon={hasDestructiveChanges ? 'solar:danger-triangle-bold' : hasAnyImpact ? 'solar:info-circle-bold' : 'solar:check-circle-bold'} className="text-2xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {hasDestructiveChanges ? 'คำเตือน: การเปลี่ยนแปลงนี้มีผลกระทบ' : hasAnyImpact ? 'ตรวจสอบผลกระทบก่อนบันทึก' : 'ไม่มีผลกระทบต่อข้อมูลที่มีอยู่'}
                            </h3>
                            <p className="text-sm text-slate-500 font-normal mt-1">
                                {preview.session_title} — {summary.total_checked_in} รายการเช็คชื่อ
                            </p>
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody className="px-6 py-4 space-y-4">
                    {/* Time Rules Diff */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Icon icon="solar:clock-circle-bold" className="text-blue-500" />
                            การเปลี่ยนแปลงเวลา
                        </h4>
                        <div className="grid gap-2">
                            {timeChanges.start_time.changed && (
                                <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                                    <Icon icon="solar:play-bold" className="text-blue-500" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-500">เวลาเริ่มต้น</p>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-slate-500 line-through">{formatPreviewTime(timeChanges.start_time.old)}</span>
                                            <Icon icon="solar:arrow-right-linear" className="text-slate-400" width={14} />
                                            <span className="font-medium text-blue-700">{formatPreviewTime(timeChanges.start_time.new)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {timeChanges.late_threshold.changed && (
                                <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                                    <Icon icon="solar:clock-circle-bold" className="text-amber-500" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-500">เวลาตัดสาย</p>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-slate-500 line-through">{formatPreviewTime(timeChanges.late_threshold.old)}</span>
                                            <Icon icon="solar:arrow-right-linear" className="text-slate-400" width={14} />
                                            <span className="font-medium text-amber-700">{formatPreviewTime(timeChanges.late_threshold.new)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {timeChanges.end_time.changed && (
                                <div className="flex items-center gap-2 p-2.5 bg-rose-50 rounded-lg border border-rose-100">
                                    <Icon icon="solar:stop-bold" className="text-rose-500" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-500">เวลาสิ้นสุด</p>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-slate-500 line-through">{formatPreviewTime(timeChanges.end_time.old)}</span>
                                            <Icon icon="solar:arrow-right-linear" className="text-slate-400" width={14} />
                                            <span className="font-medium text-rose-700">{formatPreviewTime(timeChanges.end_time.new)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!timeChanges.start_time.changed && !timeChanges.late_threshold.changed && !timeChanges.end_time.changed && (
                                <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                    <Icon icon="solar:check-circle-bold" className="text-emerald-500" />
                                    <span className="text-sm text-slate-600">ไม่มีการเปลี่ยนแปลงเวลา</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Impact Summary Cards */}
                    {hasAnyImpact && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Icon icon="solar:chart-2-bold" className="text-indigo-500" />
                                ผลกระทบต่อข้อมูลเช็คชื่อ
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {summary.will_be_invalidated > 0 && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                                        <p className="text-2xl font-bold text-red-600">{summary.will_be_invalidated}</p>
                                        <p className="text-xs text-red-500 mt-0.5">จะถูกยกเลิก</p>
                                    </div>
                                )}
                                {summary.present_to_late > 0 && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                                        <p className="text-2xl font-bold text-amber-600">{summary.present_to_late}</p>
                                        <p className="text-xs text-amber-500 mt-0.5">ตรงเวลา → สาย</p>
                                    </div>
                                )}
                                {summary.late_to_present > 0 && (
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                                        <p className="text-2xl font-bold text-emerald-600">{summary.late_to_present}</p>
                                        <p className="text-xs text-emerald-500 mt-0.5">สาย → ตรงเวลา</p>
                                    </div>
                                )}
                                {summary.recovered > 0 && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                                        <p className="text-2xl font-bold text-blue-600">{summary.recovered}</p>
                                        <p className="text-xs text-blue-500 mt-0.5">กลับมาถูกต้อง</p>
                                    </div>
                                )}
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                                    <p className="text-2xl font-bold text-slate-600">{summary.unchanged}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">ไม่เปลี่ยนแปลง</p>
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
                                        การเช็คชื่อ {summary.will_be_invalidated} รายการจะถูกเปลี่ยนเป็น &quot;ขาด&quot;
                                    </p>
                                    <p className="text-sm text-red-600">
                                        เนื่องจากเวลาเช็คอินอยู่นอกช่วงเวลาใหม่ ข้อมูลเวลาเช็คอินจะยังคงอยู่ แต่สถานะจะเปลี่ยน
                                    </p>
                                    <ul className="text-sm text-red-600 list-disc ml-4 space-y-0.5">
                                        {timeChanges.start_time.changed && new Date(timeChanges.start_time.new) > new Date(timeChanges.start_time.old) && (
                                            <li>เลื่อนเวลาเริ่มไปข้างหน้า — นักศึกษาที่เช็คชื่อก่อนเวลาเริ่มใหม่จะถูกนับเป็น &quot;ขาด&quot;</li>
                                        )}
                                        {timeChanges.end_time.changed && new Date(timeChanges.end_time.new) < new Date(timeChanges.end_time.old) && (
                                            <li>เลื่อนเวลาสิ้นสุดให้เร็วขึ้น — นักศึกษาที่เช็คชื่อหลังเวลาสิ้นสุดใหม่จะถูกนับเป็น &quot;ขาด&quot;</li>
                                        )}
                                    </ul>
                                    <p className="text-xs text-red-500 mt-1">
                                        การดำเนินการนี้บันทึกลง Log เพื่อตรวจสอบย้อนหลังได้
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
                                        {summary.present_to_late} คนจะเปลี่ยนจาก &quot;มาตรงเวลา&quot; เป็น &quot;สาย&quot;
                                    </p>
                                    <p className="text-sm text-amber-600 mt-0.5">
                                        เนื่องจากเวลาตัดสายถูกขยับให้เร็วขึ้น นักศึกษาที่เคยมาก่อนเส้นตัดเดิมจะกลายเป็นสาย
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
                                        {summary.late_to_present} คนจะเปลี่ยนจาก &quot;สาย&quot; เป็น &quot;มาตรงเวลา&quot;
                                    </p>
                                    <p className="text-sm text-emerald-600 mt-0.5">
                                        เนื่องจากเวลาตัดสายถูกขยับให้ช้าลง นักศึกษาที่เคยสายจะกลับมาเป็นมาตรงเวลา
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
                                        {summary.recovered} คนจะกลับมาถูกต้อง
                                    </p>
                                    <p className="text-sm text-blue-600 mt-0.5">
                                        นักศึกษาที่เคยอยู่นอกช่วงเวลาเดิมจะกลับมาอยู่ในช่วงเวลาใหม่ และได้รับสถานะตามเวลาเช็คอิน
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
                                    นักศึกษาที่มีสถานะ &quot;ลา&quot; (กำหนดโดยอาจารย์) จะไม่ถูกเปลี่ยนแปลง — ข้อมูลจะถูกข้ามโดยอัตโนมัติ
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Affected Records Table */}
                    {changes.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Icon icon="solar:users-group-rounded-bold" className="text-slate-500" />
                                รายละเอียดนักศึกษาที่ได้รับผลกระทบ ({changes.length} คน)
                            </h4>
                            <div className="overflow-x-auto">
                                <Table removeWrapper aria-label="ผลกระทบ" classNames={{ th: "bg-slate-50 text-xs", td: "text-sm" }}>
                                    <TableHeader>
                                        <TableColumn>นักศึกษา</TableColumn>
                                        <TableColumn align="center">เวลาเช็คอิน</TableColumn>
                                        <TableColumn align="center">การเปลี่ยนแปลง</TableColumn>
                                    </TableHeader>
                                    <TableBody items={changes.slice(0, 20)}>
                                        {(record: TimeChangeRecord) => {
                                            const cfg = CHANGE_TYPE_CONFIG[record.change_type] || CHANGE_TYPE_CONFIG.already_invalid;
                                            return (
                                                <TableRow key={record.record_id}>
                                                    <TableCell>
                                                        <div>
                                                            <p className="font-medium text-slate-800">{record.student_name || '-'}</p>
                                                            <p className="text-xs text-slate-400">{record.student_id || ''}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-slate-600">
                                                            {new Date(record.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
                                    <p className="text-xs text-slate-400 text-center mt-2">
                                        แสดง 20 จาก {changes.length} รายการ
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
                            <p className="font-medium text-slate-700">ไม่มีผลกระทบต่อข้อมูลเช็คชื่อ</p>
                            <p className="text-sm text-slate-500 mt-1">
                                การเปลี่ยนแปลงเวลาไม่ส่งผลกระทบต่อสถานะเช็คชื่อที่มีอยู่
                            </p>
                        </div>
                    )}
                </ModalBody>

                <ModalFooter className="px-6 py-4 border-t border-slate-100">
                    <Button variant="light" onPress={onClose} isDisabled={isApplying}>
                        ยกเลิก
                    </Button>
                    <Button
                        color={hasDestructiveChanges ? 'danger' : 'primary'}
                        onPress={onConfirm}
                        isLoading={isApplying}
                        className={hasDestructiveChanges ? 'bg-red-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}
                        startContent={!isApplying ? <Icon icon={hasDestructiveChanges ? 'solar:shield-warning-bold' : 'solar:check-circle-bold'} /> : undefined}
                    >
                        {hasDestructiveChanges ? 'ยืนยันการเปลี่ยนแปลง' : 'บันทึกการแก้ไข'}
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

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    present: { label: 'มาเรียน', color: 'text-emerald-600', icon: 'solar:check-circle-bold' },
    late: { label: 'สาย', color: 'text-amber-600', icon: 'solar:clock-circle-bold' },
    leave: { label: 'ลา', color: 'text-purple-600', icon: 'solar:letter-bold' },
};

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
    if (!preview) return null;

    const { removed_sections, affected_students, total_affected } = preview;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside" isDismissable={false}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg">
                            <Icon icon="solar:danger-triangle-bold" className="text-2xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">
                                คำเตือน: มีนักศึกษาที่เช็คชื่อแล้ว
                            </h3>
                            <p className="text-sm text-slate-500 font-normal mt-1">
                                {preview.session_title}
                            </p>
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody className="px-6 py-4 space-y-4">
                    {/* Removed Sections */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Icon icon="solar:minus-circle-bold" className="text-red-500" />
                            กลุ่มเรียนที่จะถูกนำออก
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
                                    กลุ่ม {section.section_no}
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
                                    ข้อมูลการเช็คชื่อของนักศึกษา {total_affected} คนจะถูกลบออก
                                </p>
                                <p className="text-sm text-red-600">
                                    นักศึกษาในกลุ่มที่ถูกนำออกซึ่งเช็คชื่อแล้วจะสูญเสียข้อมูลการเช็คชื่อทั้งหมดในรอบนี้
                                    การดำเนินการนี้ไม่สามารถย้อนกลับได้
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Affected Students Table */}
                    {affected_students.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Icon icon="solar:users-group-rounded-bold" className="text-slate-500" />
                                นักศึกษาที่ได้รับผลกระทบ ({total_affected} คน)
                            </h4>
                            <div className="overflow-x-auto">
                                <Table removeWrapper aria-label="นักศึกษาที่ได้รับผลกระทบ" classNames={{ th: "bg-slate-50 text-xs", td: "text-sm" }}>
                                    <TableHeader>
                                        <TableColumn>นักศึกษา</TableColumn>
                                        <TableColumn align="center">กลุ่ม</TableColumn>
                                        <TableColumn align="center">สถานะ</TableColumn>
                                        <TableColumn align="center">เวลาเช็คอิน</TableColumn>
                                    </TableHeader>
                                    <TableBody items={affected_students.slice(0, 30)}>
                                        {(student) => {
                                            const cfg = STATUS_LABELS[student.status] || STATUS_LABELS.present;
                                            return (
                                                <TableRow key={student.record_id}>
                                                    <TableCell>
                                                        <div>
                                                            <p className="font-medium text-slate-800">{student.student_name || '-'}</p>
                                                            <p className="text-xs text-slate-400">{student.student_id || ''}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-slate-600">{student.section_no}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip size="sm" variant="flat" className={`${cfg.color} gap-1`} startContent={<Icon icon={cfg.icon} width={14} />}>
                                                            {cfg.label}
                                                        </Chip>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-slate-600">
                                                            {student.check_in_time
                                                                ? new Date(student.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                                                : '-'}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }}
                                    </TableBody>
                                </Table>
                                {affected_students.length > 30 && (
                                    <p className="text-xs text-slate-400 text-center mt-2">
                                        แสดง 30 จาก {affected_students.length} รายการ
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </ModalBody>

                <ModalFooter className="px-6 py-4 border-t border-slate-100">
                    <Button variant="light" onPress={onClose} isDisabled={isSubmitting}>
                        ยกเลิก
                    </Button>
                    <Button
                        color="danger"
                        onPress={onConfirm}
                        isLoading={isSubmitting}
                        className="bg-red-500"
                        startContent={!isSubmitting ? <Icon icon="solar:shield-warning-bold" /> : undefined}
                    >
                        ยืนยันการนำกลุ่มออก
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
});