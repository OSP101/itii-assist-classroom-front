"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { getExamSeatingExport, type ExamSeatingExport } from "@/services/examSeat.service";
import { courseService } from "@/services/course.service";
import type { Course } from "@/services/course.service";

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
            <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
                <Button variant="flat" size="sm" onPress={() => window.history.back()}>
                    <Icon icon="solar:arrow-left-linear" className="mr-1" />
                    {t("examSeatPrintBack")}
                </Button>
                <span className="text-sm text-slate-600">
                    {t("printExamSheet")} — {toolbarExamTypeLabel} ({toolbarComponentLabel}) — {formatDate(session.exam_date)}
                </span>
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
            <div className="px-8 py-6 max-w-5xl mx-auto print:max-w-full print:px-4 print:py-2">
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
