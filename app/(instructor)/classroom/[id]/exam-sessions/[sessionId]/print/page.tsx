"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { getExamSeatingExport, getExamSeats, type ExamSeatingExport, type ExamSeat } from "@/services/examSeat.service";
import { courseService } from "@/services/course.service";
import classroomService, { type Classroom as ClassroomLayout, type Desk } from "@/services/classroom.service";
import type { Course } from "@/services/course.service";
import { ExamSeatPdfDocument, registerExamSeatPdfFonts } from "./exam-seat-pdf-document";

// ─── Physical layout renderer (uses actual x,y coordinates from database) ────

const DESK_W = 60;
const DESK_H = 60;
const TEACHER_W = 180;

function RoomLayoutGrid({ classroom, seats, zoom }: { classroom: ClassroomLayout; seats: ExamSeat[]; zoom: number }) {
    const deskToSeat = new Map(seats.map((s) => [s.desk_id, s]));
    const allDesks = classroom.desks.filter((d) => d.is_enabled);

    if (allDesks.length === 0) {
        return <p className="py-4 text-center text-sm text-slate-400">ไม่มีข้อมูลโต๊ะ</p>;
    }

    const getW = (d: Desk) => (d.type === "teacher" ? TEACHER_W : DESK_W);
    const PAD = 24;

    const minX = Math.min(...allDesks.map((d) => d.x)) - PAD;
    const minY = Math.min(...allDesks.map((d) => d.y)) - PAD;
    const maxX = Math.max(...allDesks.map((d) => d.x + getW(d))) + PAD;
    const maxY = Math.max(...allDesks.map((d) => d.y + DESK_H)) + PAD;
    const vW = maxX - minX;
    const vH = maxY - minY;

    return (
        <div className="overflow-auto">
        <svg
            viewBox={`${minX} ${minY} ${vW} ${vH}`}
            style={{ width: `${Math.round(zoom * 100)}%`, display: "block", minWidth: zoom > 1 ? `${Math.round(zoom * 100)}%` : undefined }}
            className="rounded-xl border border-slate-100 bg-slate-50"
        >

            {/* Zone backgrounds */}
            {classroom.zones?.map((zone) => (
                <g key={zone.id}>
                    <rect
                        x={zone.x} y={zone.y}
                        width={zone.width} height={zone.height}
                        fill={zone.color} fillOpacity={0.07}
                        stroke={zone.color} strokeWidth={1} strokeDasharray="6 3"
                        rx={6}
                    />
                    <text
                        x={zone.x + 8} y={zone.y + 16}
                        fontSize={11} fill={zone.color} fillOpacity={0.85}
                        fontFamily="sans-serif" fontWeight="600"
                    >
                        {zone.name}
                    </text>
                </g>
            ))}

            {/* Desks at actual physical positions */}
            {allDesks.map((desk) => {
                const isTeacher = desk.type === "teacher";
                const w = getW(desk);
                const seat = deskToSeat.get(desk.id);
                const filled = !!seat;

                return (
                    <g key={desk.id}>
                        <rect
                            x={desk.x} y={desk.y}
                            width={w} height={DESK_H}
                            rx={6}
                            fill={isTeacher ? "#f1f5f9" : filled ? "#eff6ff" : "#ffffff"}
                            stroke={isTeacher ? "#94a3b8" : filled ? "#93c5fd" : "#e2e8f0"}
                            strokeWidth={1.5}
                            strokeDasharray={!isTeacher && !filled ? "5 3" : undefined}
                        />
                        <text
                            x={desk.x + w / 2} y={desk.y + DESK_H / 2}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize={isTeacher ? 13 : filled ? 20 : 11}
                            fill={isTeacher ? "#64748b" : filled ? "#1d4ed8" : "#cbd5e1"}
                            fontWeight={isTeacher ? "600" : filled ? "800" : "500"}
                            fontFamily="sans-serif"
                        >
                            {isTeacher ? "โต๊ะอาจารย์" : filled ? (seat!.seat_number ?? "—") : desk.number}
                        </text>
                    </g>
                );
            })}
        </svg>
        </div>
    );
}

export default function ExamSessionPrintPage() {
    const params = useParams<{ id: string; sessionId: string }>();
    const searchParams = useSearchParams();
    const t = useI18n();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const courseId = params.id;
    const sessionId = parseInt(params.sessionId);

    const [data, setData] = useState<ExamSeatingExport | null>(null);
    const [course, setCourse] = useState<Course | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const initialViewMode = useMemo<"list" | "layout">(() => {
        const requestedView = searchParams.get("view");
        return requestedView === "list" ? "list" : "layout";
    }, [searchParams]);
    const shouldAutoDownloadPdf = searchParams.get("output") === "pdf";

    // Layout view state
    const [viewMode, setViewMode] = useState<"list" | "layout">(initialViewMode);
    const [seats, setSeats] = useState<ExamSeat[]>([]);
    const [classroomLayouts, setClassroomLayouts] = useState<Map<string, ClassroomLayout>>(new Map());
    const [isLayoutLoading, setIsLayoutLoading] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1.0);
    const [isPdfDownloading, setIsPdfDownloading] = useState(false);
    const [hasAutoDownloaded, setHasAutoDownloaded] = useState(false);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const [exportData, courseRes] = await Promise.all([
                    getExamSeatingExport(courseId, sessionId),
                    courseService.getCourseById(courseId),
                ]);
                setData(exportData);
                setCourse(courseRes.data ?? null);
            } catch (err: any) {
                setError(err?.message ?? t("examSeatPrintLoadFailed"));
            } finally {
                setIsLoading(false);
            }
        };
        void load();
    }, [courseId, sessionId, t]);

    useEffect(() => {
        setViewMode(initialViewMode);
    }, [initialViewMode]);

    const handleDownloadPdf = useCallback(async () => {
        if (isPdfDownloading) {
            return;
        }

        if (!data || !course) {
            return;
        }

        setIsPdfDownloading(true);

        try {
            const session = data.session;
            const rows = data.rows;
            const examTypeLabel = session.exam_setting?.exam_type === "midterm" ? "กลางภาค" : "ปลายภาค";
            const componentLabel = session.exam_setting?.component === "lab" ? "ปฏิบัติการ" : "บรรยาย";
            const sectionLabel = course.sections && course.sections.length > 0
                ? course.sections
                    .map((section) => section.section_no)
                    .filter(Boolean)
                    .join(", ")
                : "-";
            const classrooms = Array.from(new Set(rows.map((row) => row.classroom_name))).sort();
            const officialDate = (() => {
                try {
                    return new Date(session.exam_date).toLocaleDateString(isEnglish ? "en-GB" : "th-TH", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                    });
                } catch {
                    return session.exam_date;
                }
            })();

            const { pdf } = await import("@react-pdf/renderer");
            registerExamSeatPdfFonts(window.location.origin);

            const pdfBlob = await pdf(
                <ExamSeatPdfDocument
                    logoSrc={`${window.location.origin}/images/official-logo-kku.png`}
                    courseCode={course.code || "-"}
                    courseName={course.name || "-"}
                    semester={course.semester}
                    year={course.year}
                    sectionLabel={sectionLabel}
                    examLabel={`${examTypeLabel} (${componentLabel})`}
                    datetimeLabel={`${officialDate} เวลา ${session.start_time} - ${session.end_time} น.`}
                    componentLabel={componentLabel}
                    classroomLabel={classrooms.join(", ") || "-"}
                    instructorName={course.instructor?.full_name || "-"}
                    studentCount={rows.length}
                    rows={rows}
                />
            ).toBlob();

            const pdfUrl = URL.createObjectURL(pdfBlob);
            const downloadLink = document.createElement("a");
            downloadLink.href = pdfUrl;

            const safeCourseCode = (course?.code || "exam-seating").replace(/[^a-zA-Z0-9_-]/g, "_");
            const fileName = `${safeCourseCode}_session_${sessionId}.pdf`;
            downloadLink.download = fileName;
            downloadLink.click();
            URL.revokeObjectURL(pdfUrl);
        } finally {
            setIsPdfDownloading(false);
        }
    }, [course, data, isEnglish, isPdfDownloading, sessionId]);

    // Load spatial layout data when layout mode is active
    useEffect(() => {
        if (viewMode !== "layout" || !data) return;
        if (classroomLayouts.size > 0) return; // already loaded
        const loadLayout = async () => {
            setIsLayoutLoading(true);
            try {
                const seatsData = await getExamSeats(courseId, sessionId);
                setSeats(seatsData);
                const classroomIds = Array.from(
                    new Set(seatsData.map((s) => s.classroom_id).filter((id): id is string => !!id))
                );
                if (classroomIds.length === 0 && data.session.rooms) {
                    classroomIds.push(...data.session.rooms.map((r) => r.classroom_id));
                }
                const responses = await Promise.all(classroomIds.map((id) => classroomService.getClassroom(id)));
                const layoutMap = new Map<string, ClassroomLayout>();
                for (const res of responses) {
                    if (res.data) layoutMap.set(res.data.id, res.data);
                }
                setClassroomLayouts(layoutMap);
            } finally {
                setIsLayoutLoading(false);
            }
        };
        void loadLayout();
    }, [viewMode, data, courseId, sessionId, classroomLayouts.size]);

    useEffect(() => {
        if (!shouldAutoDownloadPdf || isLoading || !data || !course || hasAutoDownloaded) {
            return;
        }

        if (viewMode !== "list") {
            setViewMode("list");
            return;
        }

        let isCancelled = false;

        const timer = window.setTimeout(() => {
            void (async () => {
                await handleDownloadPdf();
                if (!isCancelled) {
                    setHasAutoDownloaded(true);
                }
            })();
        }, 150);

        return () => {
            isCancelled = true;
            window.clearTimeout(timer);
        };
    }, [course, data, handleDownloadPdf, hasAutoDownloaded, isLoading, shouldAutoDownloadPdf, viewMode]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (error || !data || !course) {
        return (
            <div className="flex min-h-screen items-center justify-center p-8">
                <div className="text-center">
                    <p className="text-red-600 font-semibold mb-2">{t("examSeatPrintLoadFailed")}</p>
                    <p className="text-sm text-slate-500">{error}</p>
                </div>
            </div>
        );
    }

    const session = data.session;
    const rows = data.rows;

    const examTypeLabel = session.exam_setting?.exam_type === "midterm" ? "กลางภาค" : "ปลายภาค";
    const componentLabel = session.exam_setting?.component === "lab" ? "ปฏิบัติการ" : "บรรยาย";
    const toolbarExamTypeLabel = session.exam_setting?.exam_type === "midterm" ? t("midtermExam") : t("finalExam");
    const toolbarComponentLabel = session.exam_setting?.component === "lab" ? t("practicalComponent") : t("lectureComponent");
    const sectionLabel = course.sections && course.sections.length > 0
        ? course.sections
            .map((section) => section.section_no)
            .filter(Boolean)
            .join(", ")
        : "-";

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString(isEnglish ? "en-GB" : "th-TH", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    const formatOfficialDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString(isEnglish ? "en-GB" : "th-TH", {
                day: "numeric",
                month: "long",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    const formatStudentCode = (studentCode: string) => {
        const normalized = studentCode.trim();
        if (normalized.includes("-") || !/^\d+$/.test(normalized) || normalized.length < 2) {
            return normalized;
        }
        return `${normalized.slice(0, -1)}-${normalized.slice(-1)}`;
    };

    const classrooms = Array.from(new Set(rows.map((r) => r.classroom_name))).sort();
    const rowsPerPage = 24;
    const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
    const pagedRows = Array.from({ length: pageCount }, (_, index) =>
        rows.slice(index * rowsPerPage, (index + 1) * rowsPerPage)
    );

    return (
        <div className="min-h-screen bg-white">
            {/* Print toolbar — hidden when printing */}
            <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-wrap">
                <span className="text-sm text-slate-600">
                    {toolbarExamTypeLabel} ({toolbarComponentLabel}) — {formatDate(session.exam_date)}
                </span>
                {/* View mode toggle */}
                <div className="flex rounded-lg border border-slate-200 overflow-hidden ml-2">
                    <button
                        className={`px-3 py-1 text-xs font-medium transition-colors ${viewMode === "layout" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                        onClick={() => setViewMode("layout")}
                    >
                        <Icon icon="solar:widget-5-linear" className="inline mr-1 text-sm" />
                        {t("examSeatRoomLayout")}
                    </button>
                    <button
                        className={`px-3 py-1 text-xs font-medium transition-colors border-l border-slate-200 ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                        onClick={() => setViewMode("list")}
                    >
                        <Icon icon="solar:list-linear" className="inline mr-1 text-sm" />
                        {t("examSeatListView")}
                    </button>
                </div>
                <Button
                    variant="flat"
                    isLoading={isPdfDownloading}
                    isDisabled={viewMode !== "list"}
                    onPress={() => void handleDownloadPdf()}
                >
                    <Icon icon="solar:file-download-linear" className="mr-1" />
                    {t("examSeatExportPdf")}
                </Button>
                <Button
                    className="ml-auto bg-blue-600 text-white"
                    size="sm"
                    onPress={() => window.print()}
                >
                    <Icon icon="solar:printer-bold" className="mr-1" />
                    {t("examSeatPrintButton")}
                </Button>
            </div>

            {/* Print content */}
            <div className={viewMode === "layout" ? "px-6 py-6 print:px-4 print:py-2" : "px-8 py-6 max-w-5xl mx-auto print:max-w-full print:px-4 print:py-2"}>

                {/* ── Layout view ── */}
                {viewMode === "layout" && (() => {
                    const roomList = Array.from(classroomLayouts.values());
                    const activeRoomId = selectedRoomId ?? roomList[0]?.id ?? null;
                    const activeRoom = classroomLayouts.get(activeRoomId ?? "") ?? null;
                    const roomSeats = activeRoom ? seats.filter((s) => s.classroom_id === activeRoom.id) : [];
                    const totalDesks = activeRoom
                        ? activeRoom.desks.filter((d) => d.is_enabled && d.type !== "teacher").length
                        : 0;

                    return (
                        <div>
                            {/* Session header */}
                            <div className="mb-4 border-b border-slate-100 pb-4">
                                <p className="text-lg font-bold text-slate-800">{course.name}</p>
                                <p className="mt-0.5 text-sm text-slate-500">
                                    {toolbarExamTypeLabel} ({toolbarComponentLabel})
                                    &ensp;·&ensp;
                                    {formatDate(session.exam_date)}
                                    &ensp;{session.start_time}–{session.end_time} น.
                                    &ensp;·&ensp;
                                    {rows.length} คน
                                </p>
                            </div>

                            {isLayoutLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
                                </div>
                            ) : classroomLayouts.size === 0 ? (
                                <p className="py-8 text-center text-sm text-slate-400">ไม่มีข้อมูลผังห้อง</p>
                            ) : (
                                <div>
                                    {/* Room selector tabs (shown only when multiple rooms) */}
                                    {roomList.length > 1 && (
                                        <div className="mb-5 flex flex-wrap gap-2">
                                            {roomList.map((room) => {
                                                const rs = seats.filter((s) => s.classroom_id === room.id);
                                                const td = room.desks.filter((d) => d.is_enabled && d.type !== "teacher").length;
                                                const isActive = room.id === activeRoomId;
                                                return (
                                                    <button
                                                        key={room.id}
                                                        onClick={() => setSelectedRoomId(room.id)}
                                                        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                                                            isActive
                                                                ? "border-blue-500 bg-blue-600 text-white"
                                                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        <Icon icon="solar:door-linear" className="text-base" />
                                                        <span>{room.name}</span>
                                                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                                                            isActive ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"
                                                        }`}>
                                                            {rs.length}/{td}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Active room header + zoom controls */}
                                    {activeRoom && (
                                        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <span className="text-base font-bold text-slate-800">{activeRoom.name}</span>
                                            <span className="text-sm text-slate-400">
                                                {activeRoom.building}&nbsp;{activeRoom.floor}
                                            </span>
                                            <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700">
                                                {roomSeats.length} / {totalDesks} ที่นั่ง
                                            </span>
                                            <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-1">
                                                <button
                                                    onClick={() => setZoom((z) => Math.max(0.4, parseFloat((z - 0.2).toFixed(1))))}
                                                    className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                                                    disabled={zoom <= 0.4}
                                                >
                                                    <Icon icon="solar:minus-linear" className="text-base" />
                                                </button>
                                                <span className="w-10 text-center text-xs font-medium text-slate-500">
                                                    {Math.round(zoom * 100)}%
                                                </span>
                                                <button
                                                    onClick={() => setZoom((z) => Math.min(3.0, parseFloat((z + 0.2).toFixed(1))))}
                                                    className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                                                    disabled={zoom >= 3.0}
                                                >
                                                    <Icon icon="solar:add-circle-linear" className="text-base" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {activeRoom && <RoomLayoutGrid classroom={activeRoom} seats={roomSeats} zoom={zoom} />}
                                </div>
                            )}

                            {/* Legend */}
                            {!isLayoutLoading && classroomLayouts.size > 0 && (
                                <div className="mt-6 flex items-center gap-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-5 w-8 rounded border border-blue-300 bg-blue-50" />
                                        <span>ที่นั่งที่กำหนดแล้ว</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-5 w-8 rounded border border-dashed border-slate-200 bg-white" />
                                        <span>ว่าง</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-5 w-8" />
                                        <span>ทางเดิน</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ── List / document view ── */}
                {viewMode === "list" && (
                    <div className="official-paper">
                        {pagedRows.map((pageRows, pageIndex) => {
                            const isLastPage = pageIndex === pagedRows.length - 1;
                            const blankRowCount = Math.max(0, rowsPerPage - pageRows.length);

                            return (
                                <section key={`page-${pageIndex + 1}`} className="official-page">
                                    <div className="official-header">
                                        <p className="official-title-university">มหาวิทยาลัยขอนแก่น</p>
                                        <p className="official-title-document">รายชื่อนศ.ในรายวิชาที่สอน</p>
                                        <p className="official-title-level">วิทยาเขต ขอนแก่น ปีการศึกษา {course.semester}/{course.year}</p>
                                        <p className="official-title-level">ระดับการศึกษา ปริญญาตรี โครงการพิเศษ</p>
                                    </div>

                                    <div className="official-info-grid">
                                        <div className="official-info-col">
                                            <p><strong>รายวิชา</strong> {course.code || "-"} {course.name || "-"}</p>
                                            <p><strong>กลุ่มที่</strong> {sectionLabel} <strong>ห้องสอบ</strong> {classrooms.join(", ") || "-"}</p>
                                            <p><strong>ภาคการสอน</strong> {componentLabel}</p>
                                        </div>
                                        <div className="official-info-col official-info-col-right">
                                            <p><strong>อาจารย์ผู้สอน</strong> {course.instructor ? course.instructor.full_name : "-"}</p>
                                            <p><strong>{examTypeLabel} ({componentLabel})</strong></p>
                                            <p><strong>วันเวลาสอบ</strong> {formatOfficialDate(session.exam_date)} เวลา {session.start_time} - {session.end_time} น.</p>
                                        </div>
                                    </div>

                                    <table className="official-table official-seat-table">
                                        <thead>
                                            <tr>
                                                <th>ลำดับ</th>
                                                <th>รหัสประจำตัว</th>
                                                <th>ชื่อ</th>
                                                <th>เอก</th>
                                                <th>ห้อง-เลขที่นั่งสอบ</th>
                                                <th>ลงชื่อเข้าสอบ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageRows.map((row, idx) => (
                                                <tr key={`${row.row_num}-${pageIndex}`}>
                                                    <td>{(pageIndex * rowsPerPage) + idx + 1}.</td>
                                                    <td className="student-id">{formatStudentCode(row.student_id)}</td>
                                                    <td className="student-name">{row.full_name}</td>
                                                    <td>{row.major || ""}</td>
                                                    <td className="seat-label">{row.seat_label}</td>
                                                    <td>&nbsp;</td>
                                                </tr>
                                            ))}
                                            {Array.from({ length: blankRowCount }).map((_, blankIndex) => (
                                                <tr key={`blank-${pageIndex}-${blankIndex}`} className="blank-row">
                                                    <td>{(pageIndex * rowsPerPage) + pageRows.length + blankIndex + 1}.</td>
                                                    <td>&nbsp;</td>
                                                    <td>&nbsp;</td>
                                                    <td>&nbsp;</td>
                                                    <td>&nbsp;</td>
                                                    <td>&nbsp;</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {isLastPage && (
                                        <div className="official-signature-row">
                                            <div className="official-signature-box">
                                                <p>ลายมือชื่อผู้คุมสอบ</p>
                                                <p>(..................................................)</p>
                                                <p>วันที่ ............... / ............... / ...............</p>
                                            </div>
                                            <div className="official-signature-box">
                                                <p>ลายมือชื่อผู้ตรวจสอบ</p>
                                                <p>(..................................................)</p>
                                                <p>วันที่ ............... / ............... / ...............</p>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Print CSS */}
            <style jsx global>{`
                :root {
                    --official-border: #000;
                }

                @font-face {
                    font-family: "TH Sarabun New";
                    src: url("/fonts/THSarabunNew.ttf") format("truetype");
                    font-style: normal;
                    font-weight: 400;
                    font-display: swap;
                }

                @font-face {
                    font-family: "TH Sarabun New";
                    src: url("/fonts/THSarabunNew-Bold.ttf") format("truetype");
                    font-style: normal;
                    font-weight: 700;
                    font-display: swap;
                }

                .official-paper {
                    color: #000;
                    font-family: "TH Sarabun New";
                    font-size: 16pt;
                    line-height: 1.25;
                }

                .official-paper,
                .official-paper * {
                    font-family: "TH Sarabun New" !important;
                }

                .official-page {
                    position: relative;
                    min-height: calc(297mm - 18mm);
                    display: flex;
                    flex-direction: column;
                }

                .official-page + .official-page {
                    margin-top: 20px;
                }

                .official-header {
                    margin-bottom: 8px;
                    text-align: center;
                }

                .official-title-university {
                    font-size: 26px;
                    font-weight: 700;
                    line-height: 1.1;
                }

                .official-title-document {
                    font-size: 26px;
                    font-weight: 700;
                    line-height: 1.1;
                }

                .official-title-level {
                    margin-top: 4px;
                    font-size: 14pt;
                    text-align: right;
                    line-height: 1.1;
                }

                .official-table {
                    width: 100%;
                    border-collapse: collapse;
                    border: 1px solid var(--official-border);
                }

                .official-info-grid {
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    font-size: 14pt;
                    line-height: 1.1;
                }

                .official-info-col {
                    width: 58%;
                }

                .official-info-col-right {
                    width: 42%;
                }

                .official-info-col p {
                    margin: 0 0 2px 0;
                }

                .official-table th,
                .official-table td {
                    border: 1px solid var(--official-border);
                    padding: 3px 6px;
                    vertical-align: middle;
                }

                .official-seat-table thead th {
                    background: #d9d9d9;
                    text-align: center;
                    font-weight: 700;
                    white-space: nowrap;
                    font-size: 16pt;
                }

                .official-seat-table tbody td {
                    height: 9mm;
                    font-size: 16pt;
                }

                .official-seat-table .blank-row td {
                    color: transparent;
                }

                .official-seat-table th:nth-child(1),
                .official-seat-table td:nth-child(1) {
                    width: 8%;
                    text-align: center;
                }

                .official-seat-table th:nth-child(2),
                .official-seat-table td:nth-child(2) {
                    width: 17%;
                }

                .official-seat-table th:nth-child(3),
                .official-seat-table td:nth-child(3) {
                    width: 33%;
                }

                .official-seat-table th:nth-child(4),
                .official-seat-table td:nth-child(4) {
                    width: 10%;
                    text-align: center;
                }

                .official-seat-table th:nth-child(5),
                .official-seat-table td:nth-child(5) {
                    width: 17%;
                    text-align: center;
                    font-weight: 700;
                }

                .official-seat-table th:nth-child(6),
                .official-seat-table td:nth-child(6) {
                    width: 15%;
                }

                .official-signature-row {
                    margin-top: auto;
                    padding-top: 14px;
                    display: flex;
                    justify-content: space-between;
                    gap: 16px;
                }

                .official-signature-box {
                    width: 48%;
                    text-align: center;
                    font-size: 16pt;
                }

                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 5mm 6mm 6mm 6mm;
                    }

                    body {
                        margin: 0;
                        font-size: 16px;
                        color: #000;
                        background: #fff;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .print\\:hidden { display: none !important; }

                    .official-page {
                        min-height: calc(297mm - 18mm);
                        page-break-after: always;
                    }

                    .official-info-grid {
                        page-break-inside: avoid;
                    }

                    .official-page:last-child {
                        page-break-after: auto;
                    }

                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                }
            `}</style>
        </div>
    );
}
