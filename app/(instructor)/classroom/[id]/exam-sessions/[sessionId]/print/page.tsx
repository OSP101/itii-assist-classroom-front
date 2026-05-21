"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { getExamSeatingExport, getExamSeats, type ExamSeatingExport, type ExamSeat } from "@/services/examSeat.service";
import { courseService } from "@/services/course.service";
import classroomService, { type Classroom as ClassroomLayout, type Desk } from "@/services/classroom.service";
import type { Course } from "@/services/course.service";

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
    const t = useI18n();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const courseId = params.id;
    const sessionId = parseInt(params.sessionId);

    const [data, setData] = useState<ExamSeatingExport | null>(null);
    const [course, setCourse] = useState<Course | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Layout view state
    const [viewMode, setViewMode] = useState<"list" | "layout">("layout");
    const [seats, setSeats] = useState<ExamSeat[]>([]);
    const [classroomLayouts, setClassroomLayouts] = useState<Map<string, ClassroomLayout>>(new Map());
    const [isLayoutLoading, setIsLayoutLoading] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1.0);

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
    const componentLabel = session.exam_setting?.component === "lab" ? "Lab" : "บรรยาย";
    const toolbarExamTypeLabel = session.exam_setting?.exam_type === "midterm" ? t("midtermExam") : t("finalExam");
    const toolbarComponentLabel = session.exam_setting?.component === "lab" ? t("practicalComponent") : t("lectureComponent");

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString(isEnglish ? "en-GB" : "th-TH", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    // Group rows by classroom
    const classrooms = Array.from(new Set(rows.map((r) => r.classroom_name))).sort();
    const groupedByClassroom: Record<string, typeof rows> = {};
    for (const row of rows) {
        if (!groupedByClassroom[row.classroom_name]) groupedByClassroom[row.classroom_name] = [];
        groupedByClassroom[row.classroom_name].push(row);
    }

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
                    <div>
                        {/* KKU Header */}
                        <div className="text-center mb-4">
                            <p className="text-base font-bold">มหาวิทยาลัยขอนแก่น</p>
                            <p className="text-sm">ใบรายชื่อผู้เข้าสอบ</p>
                        </div>

                        {/* Course info table */}
                        <table className="w-full text-sm border border-slate-400 mb-1" style={{ borderCollapse: "collapse" }}>
                            <tbody>
                                <tr>
                                    <td className="border border-slate-400 px-2 py-1 font-semibold w-36">รหัสวิชา</td>
                                    <td className="border border-slate-400 px-2 py-1">{course.code}</td>
                                    <td className="border border-slate-400 px-2 py-1 font-semibold w-28">ชื่อวิชา</td>
                                    <td className="border border-slate-400 px-2 py-1" colSpan={3}>{course.name}</td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-400 px-2 py-1 font-semibold">ประเภทสอบ</td>
                                    <td className="border border-slate-400 px-2 py-1">{examTypeLabel} ({componentLabel})</td>
                                    <td className="border border-slate-400 px-2 py-1 font-semibold">วันสอบ</td>
                                    <td className="border border-slate-400 px-2 py-1" colSpan={3}>{formatDate(session.exam_date)}</td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-400 px-2 py-1 font-semibold">เวลาสอบ</td>
                                    <td className="border border-slate-400 px-2 py-1">{session.start_time} – {session.end_time} น.</td>
                                    <td className="border border-slate-400 px-2 py-1 font-semibold">ห้องสอบ</td>
                                    <td className="border border-slate-400 px-2 py-1">{classrooms.join(", ")}</td>
                                    <td className="border border-slate-400 px-2 py-1 font-semibold">จำนวน</td>
                                    <td className="border border-slate-400 px-2 py-1">{rows.length} คน</td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-400 px-2 py-1 font-semibold">ปีการศึกษา</td>
                                    <td className="border border-slate-400 px-2 py-1">{course.year} เทอม {course.semester}</td>
                                    <td className="border border-slate-400 px-2 py-1 font-semibold">อาจารย์</td>
                                    <td className="border border-slate-400 px-2 py-1" colSpan={3}>
                                        {course.instructor ? course.instructor.full_name : "—"}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Seat table */}
                        <table className="w-full text-sm border border-slate-400 mt-3" style={{ borderCollapse: "collapse" }}>
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="border border-slate-400 px-2 py-1.5 text-center w-10">ลำดับ</th>
                                    <th className="border border-slate-400 px-2 py-1.5 text-left w-32">รหัสประจำตัว</th>
                                    <th className="border border-slate-400 px-2 py-1.5 text-left">ชื่อ-สกุล</th>
                                    <th className="border border-slate-400 px-2 py-1.5 text-center w-20">เอก</th>
                                    <th className="border border-slate-400 px-2 py-1.5 text-center w-36">ห้อง-เลขที่นั่งสอบ</th>
                                    <th className="border border-slate-400 px-2 py-1.5 text-center w-32">ลงชื่อเข้าสอบ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr key={row.row_num} className={idx % 2 === 0 ? "" : "bg-slate-50"}>
                                        <td className="border border-slate-400 px-2 py-1.5 text-center">{idx + 1}</td>
                                        <td className="border border-slate-400 px-2 py-1.5 tabular-nums">{row.student_id}</td>
                                        <td className="border border-slate-400 px-2 py-1.5">{row.full_name}</td>
                                        <td className="border border-slate-400 px-2 py-1.5 text-center">{row.major || "—"}</td>
                                        <td className="border border-slate-400 px-2 py-1.5 text-center font-semibold">{row.seat_label}</td>
                                        <td className="border border-slate-400 px-2 py-1.5">&nbsp;</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Signature area */}
                        <div className="mt-8 flex justify-end gap-16 text-sm print:mt-6">
                            <div className="text-center">
                                <div className="h-12" />
                                <p>ลายมือชื่อผู้คุมสอบ</p>
                                <p className="mt-1">(.......................................)</p>
                                <p className="text-xs text-slate-500">วันที่ ...............</p>
                            </div>
                            <div className="text-center">
                                <div className="h-12" />
                                <p>ลายมือชื่อผู้ตรวจสอบ</p>
                                <p className="mt-1">(.......................................)</p>
                                <p className="text-xs text-slate-500">วันที่ ...............</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Print CSS */}
            <style jsx global>{`
                @media print {
                    body { margin: 0; font-size: 11pt; }
                    .print\\:hidden { display: none !important; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                }
            `}</style>
        </div>
    );
}
