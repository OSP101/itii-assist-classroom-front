"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Avatar } from "@heroui/avatar";
import { Progress } from "@heroui/progress";
import { Input } from "@heroui/input";
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
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { buildCourseTitleContext, buildPageTitle } from "@/lib/page-title";
import { courseService } from "@/services/course.service";
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
    present: {
        label: "มา",
        labelEn: "Present",
        color: "success",
        icon: "solar:check-circle-bold",
    },
    late: {
        label: "สาย",
        labelEn: "Late",
        color: "warning",
        icon: "solar:clock-circle-bold",
    },
    leave: {
        label: "ลา",
        labelEn: "On leave",
        color: "default",
        icon: "solar:document-bold",
    },
    absent: {
        label: "ขาด",
        labelEn: "Absent",
        color: "danger",
        icon: "solar:close-circle-bold",
    },
};

// Format date for display
function formatDate(dateString: string, isEnglish = false): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(isEnglish ? "en-US" : "th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

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

function getStatusLabel(status: string, isEnglish = false): string {
    const config = statusConfig[status];
    if (!config) return status;
    return isEnglish ? config.labelEn : config.label;
}

export default function AttendanceSummaryPage() {
    const params = useParams();
    const router = useRouter();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const courseId = params.id as string;
    const sessionId = Number(params.sessionId);
    const t = (thai: string, english: string) => (isEnglish ? english : thai);

    // State
    const [session, setSession] = useState<AttendanceSession | null>(null);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [courseContext, setCourseContext] = useState<string | null>(null);
    const [isCourseActive, setIsCourseActive] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Modal states
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [newStatus, setNewStatus] = useState<string>("");
    const [statusNote, setStatusNote] = useState("");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // Calculate stats
    const stats = {
        total: records.length,
        present: records.filter((r) => r.status === "present").length,
        late: records.filter((r) => r.status === "late").length,
        leave: records.filter((r) => r.status === "leave").length,
        absent: records.filter((r) => r.status === "absent").length,
    };

    // Attendance rate
    const attendanceRate = stats.total > 0 
        ? ((stats.present + stats.late) / stats.total) * 100 
        : 0;

    // Filter records
    const filteredRecords = records.filter((record) => {
        const matchesSearch =
            record.student?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            record.student?.student_id?.includes(searchQuery) ||
            record.section_no?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || record.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Fetch session and records
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [sessionData, recordsData] = await Promise.all([
                attendanceService.getSession(sessionId),
                attendanceService.getRecords(sessionId),
            ]);

            const courseResponse = await courseService.getCourseById(courseId);
            if (courseResponse.success && courseResponse.data) {
                setIsCourseActive(courseResponse.data.is_active);
                setCourseContext(buildCourseTitleContext(courseResponse.data));
            }

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
    }, [sessionId]);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        document.title = isEnglish
            ? "Attendance Summary - LabTAS"
            : "สรุปการเช็คชื่อ - LabTAS";
    }, [isEnglish]);

    useEffect(() => {
        const pageLabel = isEnglish ? "Attendance Summary" : "สรุปการเช็คชื่อ";
        document.title = buildPageTitle(pageLabel, courseContext);
    }, [courseContext, isEnglish]);

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
                    prev.map((r) =>
                        r.id === selectedRecord.id
                            ? {
                                ...r,
                                ...result,
                                student: result.student ?? r.student,
                                section_no: result.section_no ?? r.section_no,
                            }
                            : r
                    )
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

    // Export to CSV
    const exportCSV = () => {
        if (!session || records.length === 0) return;

        const headers = isEnglish
            ? ["Student ID", "Student name", "Section", "Status", "Check-in time", "Note"]
            : ["รหัสนักศึกษา", "ชื่อ-นามสกุล", "Section", "สถานะ", "เวลาเช็คชื่อ", "หมายเหตุ"];
        const rows = records.map((r) => [
            r.student?.student_id || "",
            r.student?.full_name || "",
            r.section_no || "",
            getStatusLabel(r.status, isEnglish),
            r.check_in_time ? formatTime(r.check_in_time, isEnglish) : "-",
            r.note || "",
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
        ].join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attendance_${session.title}_${formatDate(session.start_time, isEnglish)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!session && !isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
                <Icon icon="solar:clipboard-remove-bold-duotone" className="mb-4 text-6xl text-default-300" aria-label={t("ไม่พบรอบการเช็คชื่อ", "Attendance session not found")} />
                <h2 className="text-xl font-semibold text-default-700">{t("ไม่พบรอบการเช็คชื่อ", "Attendance session not found")}</h2>
                <Button
                    color="primary"
                    variant="light"
                    className="mt-4"
                    onPress={() => router.back()}
                >
                    {t("ย้อนกลับ", "Go back")}
                </Button>
            </div>
        );
    }

    if (!session) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background p-4 text-foreground lg:p-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    {/* <Button
                        isIconOnly
                        variant="flat"
                        onPress={() => router.back()}
                    >
                        <Icon icon="solar:arrow-left-linear" className="text-xl" />
                    </Button> */}
                    <div>
                        <h1 className="text-xl font-bold text-foreground">{session.title}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <Chip size="sm" color="default" variant="flat">
                                {t("ปิดแล้ว", "Closed")}
                            </Chip>
                            <span className="text-sm text-default-500">
                                {formatDate(session.start_time, isEnglish)}
                            </span>
                            {session.section && (
                                <Chip size="sm" variant="flat">
                                    {session.section.section_no}
                                </Chip>
                            )}
                        </div>
                    </div>
                </div>

                {/* <Button
                    color="primary"
                    variant="flat"
                    startContent={<Icon icon="solar:download-bold" />}
                    onPress={exportCSV}
                >
                    ส่งออก CSV
                </Button> */}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <Card className="border border-default-200 shadow-sm">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-100 rounded-xl">
                                <Icon icon="solar:users-group-rounded-bold" className="text-2xl text-blue-600" aria-label={t("ทั้งหมด", "Total")} />
                            </div>
                            <div>
                                <p className="text-xs text-default-500">{t("ทั้งหมด", "Total")}</p>
                                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-100 rounded-xl">
                                <Icon icon="solar:check-circle-bold" className="text-2xl text-emerald-600" aria-label={t("มา", "Present")} />
                            </div>
                            <div>
                                <p className="text-xs text-default-500">{t("มา", "Present")}</p>
                                <p className="text-2xl font-bold text-emerald-600">{stats.present}</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-100 rounded-xl">
                                <Icon icon="solar:clock-circle-bold" className="text-2xl text-amber-600" aria-label={t("สาย", "Late")} />
                            </div>
                            <div>
                                <p className="text-xs text-default-500">{t("สาย", "Late")}</p>
                                <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-content3 p-2.5">
                                <Icon icon="solar:document-bold" className="text-2xl text-default-600" aria-label={t("ลา", "On leave")} />
                            </div>
                            <div>
                                <p className="text-xs text-default-500">{t("ลา", "On leave")}</p>
                                <p className="text-2xl font-bold text-default-600">{stats.leave}</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-red-100 rounded-xl">
                                <Icon icon="solar:close-circle-bold" className="text-2xl text-red-600" aria-label={t("ขาด", "Absent")} />
                            </div>
                            <div>
                                <p className="text-xs text-default-500">{t("ขาด", "Absent")}</p>
                                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Attendance Rate Card */}
            <Card className="mb-6 border border-default-200 shadow-sm">
                <CardBody className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-default-700">{t("อัตราการเข้าเรียน", "Attendance rate")}</h3>
                        <span className="text-2xl font-bold text-blue-600">{attendanceRate.toFixed(1)}%</span>
                    </div>
                    <Progress
                        value={attendanceRate}
                        aria-label={t("อัตราการเข้าเรียน", "Attendance rate")}
                        color={attendanceRate >= 80 ? "success" : attendanceRate >= 60 ? "warning" : "danger"}
                        size="lg"
                    />
                </CardBody>
            </Card>

            {/* Filters & Table */}
            <Card className="border border-default-200 shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-foreground">{t("รายชื่อนักศึกษา", "Student list")}</h3>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <Input
                            placeholder={t("ค้นหา...", "Search...")}
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                            startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                            className="w-full sm:w-48"
                            size="sm"
                            isClearable
                        />
                        <Select
                            placeholder={t("สถานะ", "Status")}
                            aria-label={t("กรองตามสถานะ", "Filter by status")}
                            selectedKeys={[statusFilter]}
                            onSelectionChange={(keys) => setStatusFilter(Array.from(keys)[0] as string)}
                            className="w-full sm:w-32"
                            size="sm"
                        >
                            <SelectItem key="all">{t("ทั้งหมด", "All")}</SelectItem>
                            <SelectItem key="present">{t("มา", "Present")}</SelectItem>
                            <SelectItem key="late">{t("สาย", "Late")}</SelectItem>
                            <SelectItem key="leave">{t("ลา", "On leave")}</SelectItem>
                            <SelectItem key="absent">{t("ขาด", "Absent")}</SelectItem>
                        </Select>
                    </div>
                </CardHeader>
                <CardBody className="p-0">
                    <div className="overflow-x-auto">
                        <Table
                            aria-label={t("ตารางเช็คชื่อนักศึกษา", "Student attendance table")}
                            removeWrapper
                            classNames={{
                                th: "bg-content2 text-default-600 font-semibold text-sm",
                                td: "py-3",
                            }}
                        >
                            <TableHeader>
                                <TableColumn>{t("นักศึกษา", "Student")}</TableColumn>
                                <TableColumn>{t("Section", "Section")}</TableColumn>
                                <TableColumn>{t("เวลาเช็คชื่อ", "Check-in time")}</TableColumn>
                                <TableColumn>{t("สถานะ", "Status")}</TableColumn>
                                <TableColumn>{t("การยืนยัน", "Verification")}</TableColumn>
                                <TableColumn>{t("หมายเหตุ", "Note")}</TableColumn>
                                <TableColumn align="center">{t("จัดการ", "Manage")}</TableColumn>
                            </TableHeader>
                            <TableBody
                                emptyContent={
                                    <div className="py-10 text-center">
                                        <Icon
                                            icon="solar:users-group-rounded-linear"
                                            className="mx-auto mb-3 text-5xl text-default-300"
                                            aria-label={t("ไม่พบรายการที่ตรงกับการค้นหา", "No records match your search")}
                                        />
                                        <p className="text-default-400">{t("ไม่พบรายการที่ตรงกับการค้นหา", "No records match your search")}</p>
                                    </div>
                                }
                            >
                                {filteredRecords.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar
                                                    name={record.student?.full_name || "?"}
                                                    size="sm"
                                                    className={
                                                        record.status === "present" || record.status === "late"
                                                            ? "bg-linear-to-br from-emerald-500 to-teal-500"
                                                            : "bg-content4"
                                                    }
                                                />
                                                <div>
                                                    <p className="font-medium text-foreground">
                                                        {record.student?.full_name || "-"}
                                                    </p>
                                                    <p className="text-sm text-default-500">
                                                        {record.student?.student_id || "-"}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-default-600">
                                                {record.section_no || "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className={
                                                    record.check_in_time
                                                        ? "font-mono text-default-700"
                                                        : "text-default-400"
                                                }
                                            >
                                                {formatTime(record.check_in_time, isEnglish)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                size="sm"
                                                color={statusConfig[record.status].color}
                                                variant="flat"
                                                startContent={
                                                    <Icon
                                                        icon={statusConfig[record.status].icon}
                                                        className="text-sm"
                                                    />
                                                }
                                            >
                                                {getStatusLabel(record.status, isEnglish)}
                                            </Chip>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {record.pin_verified && (
                                                    <Tooltip content={t("ยืนยัน PIN แล้ว", "PIN verified")}> 
                                                        <Chip size="sm" color="primary" variant="flat">
                                                            <Icon icon="solar:key-bold" className="text-xs" />
                                                        </Chip>
                                                    </Tooltip>
                                                )}
                                                {record.location_verified && (
                                                    <Tooltip
                                                        content={t(
                                                            `ยืนยันตำแหน่ง (${record.distance_meters?.toFixed(0) || "-"}m)`,
                                                            `Location verified (${record.distance_meters?.toFixed(0) || "-"}m)`
                                                        )}
                                                    >
                                                        <Chip size="sm" color="success" variant="flat">
                                                            <Icon icon="solar:map-point-bold" className="text-xs" />
                                                        </Chip>
                                                    </Tooltip>
                                                )}
                                                {!record.pin_verified && !record.location_verified && (
                                                    <span className="text-default-400">-</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-default-500">
                                                {record.note || "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip content={t("แก้ไขสถานะ", "Edit status")}>
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    isDisabled={!isCourseActive}
                                                    onPress={() => {
                                                        setSelectedRecord(record);
                                                        setNewStatus(record.status);
                                                        setStatusNote(record.note || "");
                                                        setIsStatusModalOpen(true);
                                                    }}
                                                >
                                                    <Icon icon="solar:pen-bold" className="text-lg text-default-400" />
                                                </Button>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardBody>
            </Card>

            {/* Status Update Modal */}
            <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)}>
                <ModalContent>
                    <ModalHeader>{t("แก้ไขสถานะการเช็คชื่อ", "Edit attendance status")}</ModalHeader>
                    <ModalBody>
                        {selectedRecord && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 rounded-xl bg-content2/80 p-3">
                                    <Avatar
                                        name={selectedRecord.student?.full_name || "?"}
                                        size="sm"
                                    />
                                    <div>
                                        <p className="font-medium text-foreground">
                                            {selectedRecord.student?.full_name}
                                        </p>
                                        <p className="text-sm text-default-500">
                                            {selectedRecord.student?.student_id}
                                        </p>
                                    </div>
                                </div>

                                <Select
                                    label={t("สถานะ", "Status")}
                                    selectedKeys={[newStatus]}
                                    onSelectionChange={(keys) =>
                                        setNewStatus(Array.from(keys)[0] as string)
                                    }
                                >
                                    <SelectItem
                                        key="present"
                                        startContent={
                                            <Icon icon="solar:check-circle-bold" className="text-emerald-500" />
                                        }
                                    >
                                        {t("มา", "Present")}
                                    </SelectItem>
                                    <SelectItem
                                        key="late"
                                        startContent={
                                            <Icon icon="solar:clock-circle-bold" className="text-amber-500" />
                                        }
                                    >
                                        {t("สาย", "Late")}
                                    </SelectItem>
                                    <SelectItem
                                        key="leave"
                                        startContent={
                                            <Icon icon="solar:document-bold" className="text-default-500" />
                                        }
                                    >
                                        {t("ลา", "On leave")}
                                    </SelectItem>
                                    <SelectItem
                                        key="absent"
                                        startContent={
                                            <Icon icon="solar:close-circle-bold" className="text-red-500" />
                                        }
                                    >
                                        {t("ขาด", "Absent")}
                                    </SelectItem>
                                </Select>

                                <Input
                                    label={t("หมายเหตุ (ถ้ามี)", "Note (optional)")}
                                    placeholder={t("ระบุเหตุผล...", "Add a note...")}
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
                            isDisabled={!isCourseActive}
                        >
                            {t("บันทึก", "Save")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
