"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Input } from "@heroui/input";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Divider } from "@heroui/divider";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";
import { courseService } from "@/services/course.service";
import type { AttendanceRecord, AttendanceSession } from "@/services/attendance.service";
import attendanceService from "@/services/attendance.service";
import dynamic from "next/dynamic";

const AttendanceLocationMap = dynamic(
    () => import("@/components/map/AttendanceLocationMap"),
    { ssr: false }
);

interface AttendanceOverviewTabProps {
    courseId: string;
    sections: Array<{ id: number; section_no: string }>;
    sessions: AttendanceSession[];
    isLoading: boolean;
    isCourseActive: boolean;
    onNavigateToAttendance: () => void;
}

interface CourseStudent {
    id: number;
    student_id: string;
    full_name: string;
    section_no: string;
}

type AttendanceMatrixStatus = "present" | "late" | "leave" | "absent";

interface AttendanceCellData {
    id: number;
    attendanceSessionId: number;
    studentId: number;
    status: AttendanceMatrixStatus;
    checkInTime: string | null;
    googleEmail: string | null;
    googleId: string | null;
    pinVerified: boolean;
    locationVerified: boolean;
    locationLat: number | null;
    locationLng: number | null;
    distanceMeters: number | null;
    note: string | null;
    updatedBy: number | null;
    createdAt: string | null;
    updatedAt: string | null;
}

type AttendanceMatrix = Record<number, Record<number, AttendanceCellData>>;

interface SelectedAttendanceCell {
    student: CourseStudent;
    session: AttendanceSession;
    record: AttendanceCellData | null;
}

interface StudentAttendanceSummary {
    present: number;
    late: number;
    leave: number;
    absent: number;
    attended: number;
    applicableSessions: number;
    rate: number;
}

export default function AttendanceOverviewTab({
    courseId,
    sections,
    sessions,
    isLoading,
    isCourseActive,
    onNavigateToAttendance,
}: AttendanceOverviewTabProps) {
    const t = useI18n();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSection, setSelectedSection] = useState<string>("all");
    const [students, setStudents] = useState<CourseStudent[]>([]);
    const [matrixLoading, setMatrixLoading] = useState(false);
    const [matrix, setMatrix] = useState<AttendanceMatrix>({});
    const [viewMode, setViewMode] = useState<"matrix" | "summary">("matrix");
    const [hoverRowId, setHoverRowId] = useState<number | null>(null);
    const [hoverColKey, setHoverColKey] = useState<number | null>(null);
    const [selectedCell, setSelectedCell] = useState<SelectedAttendanceCell | null>(null);
    const [showMap, setShowMap] = useState(false);

    const sectionIdBySectionNo = useMemo(() => {
        return new Map(sections.map((section) => [section.section_no, section.id]));
    }, [sections]);

    const getSessionTargetSectionIds = (session: AttendanceSession): number[] => {
        if (Array.isArray(session.course_section_ids) && session.course_section_ids.length > 0) {
            return session.course_section_ids;
        }
        if (session.course_section_id) {
            return [session.course_section_id];
        }
        return [];
    };

    const isStudentTargetedBySession = (student: CourseStudent, session: AttendanceSession): boolean => {
        const targetSectionIds = getSessionTargetSectionIds(session);
        if (targetSectionIds.length === 0) {
            return true;
        }

        const studentSectionId = sectionIdBySectionNo.get(student.section_no);
        if (!studentSectionId) {
            return false;
        }

        return targetSectionIds.includes(studentSectionId);
    };

    const visibleSessions = useMemo(() => {
        const orderedSessions = [...sessions].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        if (selectedSection === "all") {
            return orderedSessions;
        }

        const selectedSectionId = sectionIdBySectionNo.get(selectedSection);
        if (!selectedSectionId) {
            return orderedSessions;
        }

        return orderedSessions.filter((session) => {
            const targetSectionIds = getSessionTargetSectionIds(session);
            return targetSectionIds.length === 0 || targetSectionIds.includes(selectedSectionId);
        });
    }, [sectionIdBySectionNo, selectedSection, sessions]);

    useEffect(() => {
        let isMounted = true;

        async function fetchAttendanceMatrix() {
            if (!courseId || sections.length === 0) {
                if (isMounted) {
                    setStudents([]);
                    setMatrix({});
                }
                return;
            }

            setMatrixLoading(true);
            try {
                const sectionResponses = await Promise.all(
                    sections.map((section) => courseService.getSectionStudents(courseId, section.id))
                );

                const uniqueStudents = new Map<number, CourseStudent>();
                sectionResponses.forEach((response, index) => {
                    if (!response.success || !response.data) return;
                    const sectionNo = sections[index]?.section_no ?? "-";

                    response.data.forEach((student) => {
                        if (!uniqueStudents.has(student.id)) {
                            uniqueStudents.set(student.id, {
                                id: student.id,
                                student_id: student.student_id,
                                full_name: student.full_name,
                                section_no: sectionNo,
                            });
                        }
                    });
                });

                const nextStudents = Array.from(uniqueStudents.values()).sort((a, b) => {
                    const sectionCompare = Number(a.section_no) - Number(b.section_no);
                    if (!Number.isNaN(sectionCompare) && sectionCompare !== 0) {
                        return sectionCompare;
                    }
                    return a.student_id.localeCompare(b.student_id, undefined, { numeric: true });
                });

                const recordsBySession = await Promise.all(
                    visibleSessions.map(async (session) => {
                        try {
                            const records = await attendanceService.getRecords(session.id);
                            const statusMap: Record<number, AttendanceCellData> = {};

                            records.forEach((record) => {
                                const status = (record.status ?? "absent") as AttendanceMatrixStatus;
                                statusMap[record.student_id] = {
                                    id: record.id,
                                    attendanceSessionId: record.attendance_session_id,
                                    studentId: record.student_id,
                                    status,
                                    checkInTime: record.check_in_time,
                                    googleEmail: record.google_email,
                                    googleId: record.google_id,
                                    pinVerified: record.pin_verified,
                                    locationVerified: record.location_verified,
                                    locationLat: record.location_lat,
                                    locationLng: record.location_lng,
                                    distanceMeters: record.distance_meters,
                                    note: record.note,
                                    updatedBy: record.updated_by ?? null,
                                    createdAt: record.created_at ?? null,
                                    updatedAt: record.updated_at,
                                };
                            });

                            return [session.id, statusMap] as const;
                        } catch {
                            return [session.id, {}] as const;
                        }
                    })
                );

                if (!isMounted) return;

                setStudents(nextStudents);
                setMatrix(Object.fromEntries(recordsBySession));
            } finally {
                if (isMounted) {
                    setMatrixLoading(false);
                }
            }
        }

        fetchAttendanceMatrix();

        return () => {
            isMounted = false;
        };
    }, [courseId, sections, visibleSessions]);

    const filteredStudents = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return students.filter((student) => {
            if (selectedSection !== "all" && student.section_no !== selectedSection) {
                return false;
            }
            if (!query) return true;

            return (
                student.student_id.toLowerCase().includes(query) ||
                student.full_name.toLowerCase().includes(query)
            );
        });
    }, [students, searchQuery, selectedSection]);

    const perSessionAttendanceRate = useMemo(() => {
        return visibleSessions.reduce<Record<number, number>>((acc, session) => {
            const records = matrix[session.id] || {};
            const targetedStudents = filteredStudents.filter((student) => isStudentTargetedBySession(student, session));
            if (targetedStudents.length === 0) {
                acc[session.id] = 0;
                return acc;
            }

            const attendedCount = targetedStudents.reduce((count, student) => {
                const status = records[student.id]?.status ?? "absent";
                return status === "present" || status === "late" || status === "leave"
                    ? count + 1
                    : count;
            }, 0);

            acc[session.id] = (attendedCount / targetedStudents.length) * 100;
            return acc;
        }, {});
    }, [filteredStudents, matrix, visibleSessions]);

    const summary = useMemo(() => {
        const total = visibleSessions.length;
        const active = visibleSessions.filter((session) => session.status === "active").length;
        const closed = visibleSessions.filter((session) => session.status === "closed").length;
        const averageCheckInRate = visibleSessions.length > 0
            ? visibleSessions.reduce((acc, session) => acc + (perSessionAttendanceRate[session.id] ?? 0), 0) / visibleSessions.length
            : 0;

        return {
            total,
            active,
            closed,
            averageCheckInRate,
        };
    }, [perSessionAttendanceRate, visibleSessions]);

    const getStatusView = (status: AttendanceMatrixStatus) => {
        if (status === "present") {
            return { label: t("attendanceStatusPresent"), className: "bg-emerald-50 text-emerald-600" };
        }
        if (status === "late") {
            return { label: t("attendanceStatusLate"), className: "bg-amber-50 text-amber-600" };
        }
        if (status === "leave") {
            return { label: t("attendanceStatusLeave"), className: "bg-sky-50 text-sky-600" };
        }
        return { label: t("attendanceStatusAbsent"), className: "bg-red-50 text-red-500" };
    };

    const getStudentSummary = (student: CourseStudent): StudentAttendanceSummary => {
        const counts = {
            present: 0,
            late: 0,
            leave: 0,
            absent: 0,
        };
        let applicableSessions = 0;

        visibleSessions.forEach((session) => {
            if (!isStudentTargetedBySession(student, session)) {
                return;
            }

            applicableSessions += 1;
            const status = matrix[session.id]?.[student.id]?.status ?? "absent";
            counts[status] += 1;
        });

        const attended = counts.present + counts.late + counts.leave;
        const rate = applicableSessions > 0 ? (attended / applicableSessions) * 100 : 0;

        return {
            ...counts,
            attended,
            applicableSessions,
            rate,
        };
    };

    const formatAttendanceDate = (value: string) => new Date(value).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
    const formatThaiDateTime = (value: string | null | undefined): string | null => {
        if (!value) return null;
        try {
            return new Date(value).toLocaleString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        } catch { return value; }
    };

    if (isLoading || matrixLoading) {
        return (
            <div className="flex min-h-55 items-center justify-center rounded-xl border border-default-200 bg-content1">
                <Spinner size="lg" label={t("loading")} />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex w-full items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:chart-2-bold" className="text-xl text-primary" />
                            <h3 className="text-lg font-semibold text-default-800">{t("attendanceOverview")}</h3>
                        </div>
                        <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            onPress={onNavigateToAttendance}
                            isDisabled={!isCourseActive}
                            startContent={<Icon icon="solar:user-check-bold" className="text-base" />}
                        >
                            {t("attendance")}
                        </Button>
                    </div>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border border-default-200 bg-content2 p-3">
                            <p className="text-xs text-default-500">{t("totalSessions")}</p>
                            <p className="mt-1 text-2xl font-bold text-default-800">{summary.total}</p>
                        </div>
                        <div className="rounded-lg border border-default-200 bg-content2 p-3">
                            <p className="text-xs text-default-500">{t("activeSessions")}</p>
                            <p className="mt-1 text-2xl font-bold text-success">{summary.active}</p>
                        </div>
                        <div className="rounded-lg border border-default-200 bg-content2 p-3">
                            <p className="text-xs text-default-500">{t("closedSessions")}</p>
                            <p className="mt-1 text-2xl font-bold text-default-800">{summary.closed}</p>
                        </div>
                        <div className="rounded-lg border border-default-200 bg-content2 p-3">
                            <p className="text-xs text-default-500">{t("averageCheckInRate")}</p>
                            <p className="mt-1 text-2xl font-bold text-primary">{summary.averageCheckInRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card className="shadow-sm">
                <CardBody className="py-3 px-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex w-full gap-2 items-center">
                            <Input
                                placeholder={t("searchStudents")}
                                value={searchQuery}
                                onValueChange={setSearchQuery}
                                startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400 text-sm" />}
                                className="w-full"
                                size="md"
                                variant="bordered"
                                isClearable
                                classNames={{
                                    inputWrapper: "border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-blue-400 text-sm",
                                }}
                            />

                            <Dropdown>
                                <DropdownTrigger>
                                    <Button
                                        variant="bordered"
                                        size="md"
                                        className="min-w-28 justify-between border-default-200 bg-content1 text-default-700"
                                    >
                                        {selectedSection === "all" ? t("allSections") : `Sec ${selectedSection}`}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    selectionMode="single"
                                    selectedKeys={new Set([selectedSection])}
                                    onSelectionChange={(keys) => setSelectedSection(Array.from(keys)[0] as string)}
                                    items={[
                                        { key: "all", label: t("allSections") },
                                        ...sections.map((section) => ({ key: section.section_no, label: `Sec ${section.section_no}` })),
                                    ]}
                                >
                                    {(item) => <DropdownItem key={item.key}>{item.label}</DropdownItem>}
                                </DropdownMenu>
                            </Dropdown>

                            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-default-200 bg-content1 p-1">
                                <Button
                                    size="sm"
                                    variant={viewMode === "matrix" ? "flat" : "light"}
                                    color={viewMode === "matrix" ? "primary" : "default"}
                                    onPress={() => setViewMode("matrix")}
                                    className="min-w-22"
                                >
                                    {t("matrixView")}
                                </Button>
                                <Button
                                    size="sm"
                                    variant={viewMode === "summary" ? "flat" : "light"}
                                    color={viewMode === "summary" ? "primary" : "default"}
                                    onPress={() => setViewMode("summary")}
                                    className="min-w-22"
                                >
                                    {t("summaryView")}
                                </Button>
                            </div>
                        </div>

                        <div className="flex sm:hidden items-center gap-1 rounded-lg border border-default-200 bg-content1 p-1">
                            <Button
                                size="sm"
                                variant={viewMode === "matrix" ? "flat" : "light"}
                                color={viewMode === "matrix" ? "primary" : "default"}
                                onPress={() => setViewMode("matrix")}
                                className="flex-1"
                            >
                                {t("matrixView")}
                            </Button>
                            <Button
                                size="sm"
                                variant={viewMode === "summary" ? "flat" : "light"}
                                color={viewMode === "summary" ? "primary" : "default"}
                                onPress={() => setViewMode("summary")}
                                className="flex-1"
                            >
                                {t("summaryView")}
                            </Button>
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardBody className="p-0">
                    {visibleSessions.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-default-300 p-6 text-center text-sm text-default-500">
                            {t("noAttendanceSessionsYet")}
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-default-300 p-6 text-center text-sm text-default-500">
                            {t("noStudentsFound")}
                        </div>
                    ) : viewMode === "matrix" ? (
                        <div className="max-h-147.5 overflow-x-auto overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10">
                                    <tr className="border-b border-divider bg-content2">
                                        <th rowSpan={2} className="w-12 border-r border-divider bg-content2 px-3 py-2 text-center font-semibold text-default-600">#</th>
                                        <th rowSpan={2} className="min-w-30 border-r border-divider bg-content2 px-3 py-2 text-center font-semibold text-default-600">{t("studentId")}</th>
                                        <th rowSpan={2} className="min-w-50 border-r border-divider bg-content2 px-3 py-2 text-center font-semibold text-default-600">{t("studentName")}</th>
                                        <th rowSpan={2} className="w-14 border-r border-divider bg-content2 px-2 py-2 text-center font-semibold text-default-600">Sec</th>
                                        {visibleSessions.map((session) => (
                                            <th
                                                key={session.id}
                                                colSpan={1}
                                                onMouseEnter={() => setHoverColKey(session.id)}
                                                onMouseLeave={() => setHoverColKey(null)}
                                                className={`min-w-28 border-l px-2 py-2 text-center font-semibold text-default-700 ${hoverColKey === session.id ? "border-primary/30 bg-primary/10" : "border-default-300 bg-content3"}`}
                                            >
                                                <div className="truncate">{session.title}</div>
                                            </th>
                                        ))}
                                        <th rowSpan={2} className="min-w-18 border-l border-default-300 bg-content3 px-2 py-2 text-center font-semibold text-default-700">
                                            {t("attendanceStatusPresent")}
                                        </th>
                                        <th rowSpan={2} className="min-w-18 border-l border-default-300 bg-content3 px-2 py-2 text-center font-semibold text-default-700">
                                            {t("attendanceStatusLate")}
                                        </th>
                                        <th rowSpan={2} className="min-w-18 border-l border-default-300 bg-content3 px-2 py-2 text-center font-semibold text-default-700">
                                            {t("attendanceStatusLeave")}
                                        </th>
                                        <th rowSpan={2} className="min-w-18 border-l border-default-300 bg-content3 px-2 py-2 text-center font-semibold text-default-700">
                                            {t("attendanceStatusAbsent")}
                                        </th>
                                        <th rowSpan={2} className="min-w-20 border-l border-blue-200 bg-blue-50 px-2 py-2 text-center font-semibold text-blue-700">
                                            {t("attendanceRate")}
                                        </th>
                                    </tr>
                                    <tr className="border-b border-default-300 bg-content2/80">
                                        {visibleSessions.map((session) => (
                                            <th
                                                key={`date-${session.id}`}
                                                onMouseEnter={() => setHoverColKey(session.id)}
                                                onMouseLeave={() => setHoverColKey(null)}
                                                className={`min-w-28 border-l px-2 py-2 text-center text-xs font-medium ${hoverColKey === session.id ? "border-primary/30 bg-primary/10 text-primary-700" : "border-divider bg-content2/80 text-default-600"}`}
                                            >
                                                {formatAttendanceDate(session.start_time)}
                                            </th>
                                        ))}
                                    </tr>
                                    <tr className="bg-blue-50 border-b-2 border-blue-200">
                                        <td colSpan={4} className="px-3 py-2 text-center text-blue-700 font-semibold bg-blue-50">
                                            {t("attendanceRate")}
                                        </td>
                                        {visibleSessions.map((session) => (
                                            <td
                                                key={`avg-${session.id}`}
                                                className="px-2 py-2 text-center text-blue-600 font-medium border-l border-blue-100 bg-blue-50"
                                            >
                                                {perSessionAttendanceRate[session.id].toFixed(1)}%
                                            </td>
                                        ))}
                                        <td className="px-2 py-2 text-center text-blue-700 font-semibold border-l border-blue-100 bg-blue-50">-</td>
                                        <td className="px-2 py-2 text-center text-blue-700 font-semibold border-l border-blue-100 bg-blue-50">-</td>
                                        <td className="px-2 py-2 text-center text-blue-700 font-semibold border-l border-blue-100 bg-blue-50">-</td>
                                        <td className="px-2 py-2 text-center text-blue-700 font-semibold border-l border-blue-100 bg-blue-50">-</td>
                                        <td className="px-2 py-2 text-center text-blue-700 font-semibold border-l border-blue-100 bg-blue-50">-</td>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-divider">
                                    {filteredStudents.map((student, index) => {
                                        const studentSummary = getStudentSummary(student);

                                        return (
                                            <tr
                                                key={student.id}
                                                onMouseEnter={() => setHoverRowId(student.id)}
                                                onMouseLeave={() => setHoverRowId(null)}
                                                className={`transition-colors ${hoverRowId === student.id ? "bg-primary/10" : ""}`}
                                            >
                                                <td className="px-3 py-3 text-center text-foreground">{index + 1}</td>
                                                <td className="px-3 py-3 whitespace-nowrap text-default-600">{student.student_id}</td>
                                                <td className="px-3 py-3 whitespace-nowrap font-medium text-foreground">{student.full_name}</td>
                                                <td className="px-2 py-3 text-center text-default-600">{student.section_no}</td>
                                                {visibleSessions.map((session) => {
                                                    const isTargeted = isStudentTargetedBySession(student, session);
                                                    if (!isTargeted) {
                                                        return (
                                                            <td
                                                                key={`${student.id}-${session.id}`}
                                                                onMouseEnter={() => setHoverColKey(session.id)}
                                                                onMouseLeave={() => setHoverColKey(null)}
                                                                className={`border-l border-divider px-2 py-2 text-center text-default-400 transition-colors ${hoverColKey === session.id ? "bg-primary/10" : ""}`}
                                                            >
                                                                -
                                                            </td>
                                                        );
                                                    }

                                                    const record = matrix[session.id]?.[student.id] ?? null;
                                                    const status = record?.status ?? "absent";
                                                    const statusView = getStatusView(status);
                                                    return (
                                                        <td
                                                            key={`${student.id}-${session.id}`}
                                                            onMouseEnter={() => setHoverColKey(session.id)}
                                                            onMouseLeave={() => setHoverColKey(null)}
                                                            className={`border-l border-divider px-2 py-2 text-center transition-colors ${hoverColKey === session.id ? "bg-primary/10" : ""}`}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedCell({ student, session, record })}
                                                                className={`inline-flex h-7 min-w-10 items-center justify-center rounded-md px-2 text-sm font-medium transition-all hover:scale-105 hover:shadow-sm ${statusView.className}`}
                                                            >
                                                                {statusView.label}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                                <td className="border-l border-divider px-2 py-2 text-center font-semibold text-success-700">{studentSummary.present}</td>
                                                <td className="border-l border-divider px-2 py-2 text-center font-semibold text-warning-700">{studentSummary.late}</td>
                                                <td className="border-l border-divider px-2 py-2 text-center font-semibold text-primary-700">{studentSummary.leave}</td>
                                                <td className="border-l border-divider px-2 py-2 text-center font-semibold text-default-600">{studentSummary.absent}</td>
                                                <td className="border-l border-blue-100 bg-blue-50 px-2 py-2 text-center font-semibold text-blue-700">
                                                    {studentSummary.rate.toFixed(1)}%
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="max-h-147.5 overflow-x-auto overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10">
                                    <tr className="border-b border-divider bg-content2">
                                        <th className="w-12 border-r border-divider bg-content2 px-3 py-2 text-center font-semibold text-default-600">#</th>
                                        <th className="min-w-30 border-r border-divider bg-content2 px-3 py-2 text-center font-semibold text-default-600">{t("studentId")}</th>
                                        <th className="min-w-50 border-r border-divider bg-content2 px-3 py-2 text-center font-semibold text-default-600">{t("studentName")}</th>
                                        <th className="w-14 border-r border-divider bg-content2 px-2 py-2 text-center font-semibold text-default-600">Sec</th>
                                        <th className="min-w-18 border-l border-default-300 bg-content3 px-2 py-2 text-center font-semibold text-default-700">{t("attendanceStatusPresent")}</th>
                                        <th className="min-w-18 border-l border-default-300 bg-content3 px-2 py-2 text-center font-semibold text-default-700">{t("attendanceStatusLate")}</th>
                                        <th className="min-w-18 border-l border-default-300 bg-content3 px-2 py-2 text-center font-semibold text-default-700">{t("attendanceStatusLeave")}</th>
                                        <th className="min-w-18 border-l border-default-300 bg-content3 px-2 py-2 text-center font-semibold text-default-700">{t("attendanceStatusAbsent")}</th>
                                        <th className="min-w-20 border-l border-blue-200 bg-blue-50 px-2 py-2 text-center font-semibold text-blue-700">{t("attendanceRate")}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-divider">
                                    {filteredStudents.map((student, index) => {
                                        const studentSummary = getStudentSummary(student);
                                        return (
                                            <tr
                                                key={student.id}
                                                onMouseEnter={() => setHoverRowId(student.id)}
                                                onMouseLeave={() => setHoverRowId(null)}
                                                className={`transition-colors ${hoverRowId === student.id ? "bg-primary/10" : ""}`}
                                            >
                                                <td className="px-3 py-3 text-center text-foreground">{index + 1}</td>
                                                <td className="px-3 py-3 whitespace-nowrap text-default-600">{student.student_id}</td>
                                                <td className="px-3 py-3 whitespace-nowrap font-medium text-foreground">{student.full_name}</td>
                                                <td className="px-2 py-3 text-center text-default-600">{student.section_no}</td>
                                                <td className="border-l border-divider px-2 py-2 text-center font-semibold text-success-700">{studentSummary.present}</td>
                                                <td className="border-l border-divider px-2 py-2 text-center font-semibold text-warning-700">{studentSummary.late}</td>
                                                <td className="border-l border-divider px-2 py-2 text-center font-semibold text-primary-700">{studentSummary.leave}</td>
                                                <td className="border-l border-divider px-2 py-2 text-center font-semibold text-default-600">{studentSummary.absent}</td>
                                                <td className="border-l border-blue-100 bg-blue-50 px-2 py-2 text-center font-semibold text-blue-700">{studentSummary.rate.toFixed(1)}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardBody>
            </Card>

            <Modal isOpen={selectedCell !== null} onClose={() => setSelectedCell(null)} size="md" scrollBehavior="inside">
                <ModalContent>
                    {selectedCell ? (
                        <>
                            <ModalHeader className="flex items-start justify-between gap-3 pb-2">
                                <div>
                                    <p className="text-lg font-semibold text-foreground">{t("attendanceRecordDetails")}</p>
                                    <p className="text-xs text-default-500">{t("attendanceRecordDetailSubtitle")}</p>
                                </div>
                                <Chip
                                    size="sm"
                                    variant="flat"
                                    className={getStatusView(selectedCell.record?.status ?? "absent").className}
                                >
                                    {getStatusView(selectedCell.record?.status ?? "absent").label}
                                </Chip>
                            </ModalHeader>
                            <Divider />
                            <ModalBody className="py-4">
                                <div className="space-y-4">
                                    {/* Info cards */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex items-center gap-3 rounded-lg border border-default-200 bg-content2 p-3">
                                            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                                <Icon icon="solar:user-bold" className="text-lg text-blue-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs text-default-500">{t("studentLabel")}</p>
                                                <p className="text-sm font-medium text-foreground truncate">{selectedCell.student.full_name}</p>
                                                <p className="text-xs text-default-500">{selectedCell.student.student_id}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 rounded-lg border border-default-200 bg-content2 p-3">
                                            <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                                                <Icon icon="solar:calendar-check-bold" className="text-lg text-violet-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs text-default-500">{t("attendanceSession")}</p>
                                                <p className="text-sm font-medium text-foreground truncate">{selectedCell.session.title}</p>
                                                <p className="text-xs text-default-500">{formatAttendanceDate(selectedCell.session.start_time)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedCell.record ? (
                                        <>
                                            {/* Manual override banner */}
                                            {selectedCell.record.updatedBy !== null && (
                                                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                                                    <Icon icon="solar:pen-bold" className="mt-0.5 shrink-0 text-base text-amber-500" />
                                                    <div>
                                                        <p className="text-sm font-semibold text-amber-800">{t("attendanceManualOverride")}</p>
                                                        <p className="text-xs text-amber-600">{t("attendanceManualOverrideDesc")}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Section: สถานะการเช็คชื่อ */}
                                            <div className="overflow-hidden rounded-xl border border-default-200">
                                                <div className="flex items-center gap-2 border-b border-divider bg-content2 px-4 py-3">
                                                    <Icon icon="solar:check-circle-bold" className="text-emerald-500" />
                                                    <p className="text-sm font-semibold text-default-700">{t("attendanceCheckInStatus")}</p>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Icon icon="solar:clock-circle-bold" className="text-sky-500 shrink-0" />
                                                        <span className="text-default-500">{t("checkedInAt")}:</span>
                                                        <span className="font-medium text-foreground">
                                                            {formatThaiDateTime(selectedCell.record.checkInTime) ?? (
                                                                <span className="text-default-400">{t("attendanceNotCheckedIn")}</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Section: การยืนยันตัวตน */}
                                            <div className="overflow-hidden rounded-xl border border-default-200">
                                                <div className="flex items-center gap-2 border-b border-divider bg-content2 px-4 py-3">
                                                    <Icon icon="solar:shield-check-bold" className="text-indigo-500" />
                                                    <p className="text-sm font-semibold text-default-700">{t("attendanceVerificationSection")}</p>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-1.5 text-sm text-default-500">
                                                            <Icon icon="solar:key-bold" className="text-default-400 shrink-0" />
                                                            <span>{t("pinVerification")}</span>
                                                        </div>
                                                        <div className={`flex items-center gap-1 text-sm font-medium ${selectedCell.record.pinVerified ? "text-emerald-600" : "text-default-400"}`}>
                                                            <Icon icon={selectedCell.record.pinVerified ? "solar:check-circle-bold" : "solar:close-circle-bold"} className="text-base" />
                                                            {selectedCell.record.pinVerified ? t("verified") : t("notVerified")}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-1.5 text-sm text-default-500">
                                                            <Icon icon="solar:map-point-bold" className="text-default-400 shrink-0" />
                                                            <span>{t("locationVerification")}</span>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <div className={`flex items-center gap-1 text-sm font-medium ${selectedCell.record.locationVerified ? "text-emerald-600" : "text-default-400"}`}>
                                                                <Icon icon={selectedCell.record.locationVerified ? "solar:check-circle-bold" : "solar:close-circle-bold"} className="text-base" />
                                                                {selectedCell.record.locationVerified ? t("verified") : t("notVerified")}
                                                            </div>
                                                            {selectedCell.record.distanceMeters !== null && selectedCell.record.distanceMeters !== undefined && (
                                                                <span className="text-xs text-default-400">
                                                                    {t("attendanceDistanceDisplay", { distance: Number(selectedCell.record.distanceMeters).toFixed(0) })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Map button — only when session uses location check and student location was recorded */}
                                                    {selectedCell.session.check_location &&
                                                        selectedCell.record.locationLat !== null &&
                                                        selectedCell.record.locationLng !== null &&
                                                        selectedCell.session.location_lat !== null &&
                                                        selectedCell.session.location_lng !== null && (
                                                        <Button
                                                            size="sm"
                                                            variant="flat"
                                                            color="primary"
                                                            startContent={<Icon icon="solar:map-bold" className="text-base" />}
                                                            onPress={() => setShowMap(true)}
                                                            className="w-full"
                                                        >
                                                            {t("viewLocationMap")}
                                                        </Button>
                                                    )}
                                                    {selectedCell.record.googleEmail && (
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <Icon icon="solar:letter-bold" className="text-red-400 shrink-0" />
                                                            <span className="text-default-500">Google:</span>
                                                            <span className="text-foreground truncate min-w-0">{selectedCell.record.googleEmail}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Note — only if present */}
                                            {selectedCell.record.note && (
                                                <div className="rounded-xl border border-default-200 p-4">
                                                    <p className="mb-1.5 text-xs font-semibold text-default-500">{t("attendanceNote")}</p>
                                                    <p className="text-sm whitespace-pre-wrap text-default-700">{selectedCell.record.note}</p>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-default-300 bg-content2 p-6 text-center">
                                            <Icon icon="solar:info-circle-linear" className="mx-auto mb-2 text-3xl text-default-300" />
                                            <p className="text-sm text-default-400">{t("attendanceNoRecordInSession")}</p>
                                        </div>
                                    )}
                                </div>
                            </ModalBody>
                            <Divider />
                            <ModalFooter>
                                <Button size="sm" variant="light" onPress={() => setSelectedCell(null)}>
                                    {t("adminCloseButton")}
                                </Button>
                            </ModalFooter>
                        </>
                    ) : null}
                </ModalContent>
            </Modal>

            {/* Map sub-modal */}
            {selectedCell?.record &&
                selectedCell.session.check_location &&
                selectedCell.record.locationLat !== null &&
                selectedCell.record.locationLng !== null &&
                selectedCell.session.location_lat !== null &&
                selectedCell.session.location_lng !== null && (
                <Modal isOpen={showMap} onClose={() => setShowMap(false)} size="lg">
                    <ModalContent>
                        <>
                            <ModalHeader className="flex items-start justify-between gap-3 pb-2">
                                <div>
                                    <p className="text-base font-semibold text-foreground">{t("locationMapTitle")}</p>
                                    <p className="text-xs text-default-500">
                                        {selectedCell.student.full_name} · {selectedCell.session.title}
                                    </p>
                                </div>
                            </ModalHeader>
                            <Divider />
                            <ModalBody className="py-4">
                                <div className="space-y-3">
                                    <div className="overflow-hidden rounded-xl border border-default-200">
                                        <AttendanceLocationMap
                                            studentLat={selectedCell.record.locationLat!}
                                            studentLng={selectedCell.record.locationLng!}
                                            sessionLat={selectedCell.session.location_lat!}
                                            sessionLng={selectedCell.session.location_lng!}
                                            radiusMeters={selectedCell.session.radius_meters}
                                            distanceMeters={selectedCell.record.distanceMeters}
                                            studentLabel={t("locationMapStudentPin")}
                                            sessionLabel={t("locationMapSessionPin")}
                                        />
                                    </div>
                                    {/* Legend */}
                                    <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-default-500">
                                        <div className="flex items-center gap-1.5">
                                            <span className="inline-block h-3 w-3 rounded-full bg-red-500 ring-2 ring-white shadow-sm" />
                                            {t("locationMapStudentPin")}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="inline-block h-3 w-3 rounded-full bg-blue-500 ring-2 ring-white shadow-sm" />
                                            {t("locationMapSessionPin")} ({t("locationMapRadius", { radius: selectedCell.session.radius_meters })})
                                        </div>
                                        {selectedCell.record.distanceMeters !== null && selectedCell.record.distanceMeters !== undefined && (
                                            <div className="flex items-center gap-1.5">
                                                <Icon icon="solar:ruler-bold" className="text-default-400" />
                                                {t("attendanceDistanceDisplay", { distance: Number(selectedCell.record.distanceMeters).toFixed(0) })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </ModalBody>
                            <Divider />
                            <ModalFooter>
                                <Button size="sm" variant="light" onPress={() => setShowMap(false)}>
                                    {t("adminCloseButton")}
                                </Button>
                            </ModalFooter>
                        </>
                    </ModalContent>
                </Modal>
            )}
        </div>
    );
}
