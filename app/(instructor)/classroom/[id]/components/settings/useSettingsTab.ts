"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { addToast } from "@heroui/toast";
import type ExcelJS from "exceljs";
import { courseService } from "@/services/course.service";
import type { Course } from "@/services/course.service";
import scoreService from "@/services/score.service";
import attendanceService from "@/services/attendance.service";
import bonusScoreService from "@/services/bonusScore.service";
import examScoreService from "@/services/examScore.service";
import { getTAStats } from "@/services/courseActivityLog.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";

export interface SettingsFormData {
    code: string;
    name: string;
    year: number;
    semester: number;
    description: string;
    image: string;
    cover_position_x: number;
    cover_position_y: number;
    cover_zoom: number;
    attention_threshold: number;
    is_active: boolean;
}

type CoverFields = Pick<SettingsFormData, "image" | "cover_position_x" | "cover_position_y" | "cover_zoom">;

interface UseSettingsTabProps {
    courseId: string;
    course: Course;
    onCourseUpdate: (updatedCourse: Course) => void;
}

export function useSettingsTab({ courseId, course, onCourseUpdate }: UseSettingsTabProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isCoverSaving, setIsCoverSaving] = useState(false);
    const coverAutosaveInFlightRef = useRef(false);
    const pendingCoverAutosaveRef = useRef<CoverFields | null>(null);

    const buildFormDataFromCourse = useCallback((sourceCourse: Course): SettingsFormData => ({
        code: sourceCourse.code || "",
        name: sourceCourse.name || "",
        year: sourceCourse.year || new Date().getFullYear() + 543,
        semester: sourceCourse.semester || 1,
        description: sourceCourse.description || "",
        image: sourceCourse.image || "",
        cover_position_x: sourceCourse.cover_position_x ?? 50,
        cover_position_y: sourceCourse.cover_position_y ?? 50,
        cover_zoom: sourceCourse.cover_zoom ?? 1,
        attention_threshold: sourceCourse.attention_threshold ?? 60,
        is_active: sourceCourse.is_active ?? true,
    }), []);

    // Form state
    const [formData, setFormData] = useState<SettingsFormData>(() => buildFormDataFromCourse(course));

    // Reset form when course changes
    useEffect(() => {
        if (isEditing) return;
        setFormData(buildFormDataFromCourse(course));
    }, [course, isEditing, buildFormDataFromCourse]);

    // Check if form has changes that trigger warning
    const hasWarningChanges = useMemo(() => {
        return formData.code !== course.code || 
               formData.year !== course.year || 
               formData.semester !== course.semester;
    }, [formData.code, formData.year, formData.semester, course.code, course.year, course.semester]);

    // Check if disabling course
    const isDisablingCourse = useMemo(() => {
        return !formData.is_active && course.is_active;
    }, [formData.is_active, course.is_active]);

    // Computed statistics
    const stats = useMemo(() => ({
        totalStudents: course.sections?.reduce((acc, s) => acc + (s.studentCount || 0), 0) || 0,
        sectionsCount: course.sections?.length || 0,
        instructorsCount: course.instructors?.length || (course.instructor ? 1 : 0),
        tasCount: course.tas?.length || 0,
        primaryInstructor: course.instructors?.find(i => (i as any).CourseInstructor?.is_primary)?.full_name 
            || course.instructor?.full_name 
            || '-',
    }), [course.sections, course.instructors, course.instructor, course.tas]);

    // Update single form field
    const updateField = useCallback(<K extends keyof SettingsFormData>(
        field: K, 
        value: SettingsFormData[K]
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    const queueCoverAutosave = useCallback(async (nextCover: CoverFields) => {
        if (!isEditing || !course.is_active) return;

        pendingCoverAutosaveRef.current = nextCover;
        if (coverAutosaveInFlightRef.current) return;

        coverAutosaveInFlightRef.current = true;
        setIsCoverSaving(true);

        while (pendingCoverAutosaveRef.current) {
            const payload = pendingCoverAutosaveRef.current;
            pendingCoverAutosaveRef.current = null;

            try {
                const response = await courseService.updateCourse(course.id, {
                    image: payload.image,
                    cover_position_x: payload.cover_position_x,
                    cover_position_y: payload.cover_position_y,
                    cover_zoom: payload.cover_zoom,
                });

                if (response.success && response.data) {
                    onCourseUpdate(response.data);
                } else {
                    const errorMessage = typeof response.error === "object" && response.error !== null
                        ? (response.error as { message?: string }).message
                        : response.error || response.message || (isEnglish ? "Unable to save course cover." : "ไม่สามารถบันทึกรูปปกรายวิชาได้");

                    addToast({
                        title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                        description: errorMessage,
                        color: "danger",
                        timeout: 3000,
                        shouldShowTimeoutProgress: true,
                    });
                }
            } catch (error: any) {
                addToast({
                    title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                    description: error.message || (isEnglish ? "Unable to save course cover." : "ไม่สามารถบันทึกรูปปกรายวิชาได้"),
                    color: "danger",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
        }

        coverAutosaveInFlightRef.current = false;
        setIsCoverSaving(false);
    }, [course.id, course.is_active, isEditing, isEnglish, onCourseUpdate]);

    const updateCover = useCallback((cover: CoverFields) => {
        setFormData(prev => ({ ...prev, ...cover }));
        void queueCoverAutosave(cover);
    }, [queueCoverAutosave]);

    // Handle save
    const handleSave = useCallback(async () => {
        if (!formData.code.trim() || !formData.name.trim()) {
            addToast({
                title: isEnglish ? "Missing required fields" : "กรุณากรอกข้อมูล",
                description: isEnglish ? "Course code and course name are required." : "รหัสวิชาและชื่อวิชาจำเป็นต้องกรอก",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSaving(true);
        try {
            const response = await courseService.updateCourse(course.id, {
                code: formData.code,
                name: formData.name,
                year: formData.year,
                semester: formData.semester,
                description: formData.description || undefined,
                image: formData.image,
                cover_position_x: formData.cover_position_x,
                cover_position_y: formData.cover_position_y,
                cover_zoom: formData.cover_zoom,
                attention_threshold: formData.attention_threshold,
                is_active: formData.is_active,
            });

            if (response.success && response.data) {
                addToast({
                    title: isEnglish ? "Saved" : "สำเร็จ",
                    description: isEnglish ? "Course settings were saved successfully." : "บันทึกการตั้งค่าเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                onCourseUpdate(response.data);
                setIsEditing(false);
            } else {
                const errorMessage = typeof response.error === 'object' && response.error !== null
                    ? (response.error as { message?: string }).message
                    : response.error || response.message || (isEnglish ? "Unable to save course settings." : "ไม่สามารถบันทึกได้");
                addToast({
                    title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: any) {
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: error.message || (isEnglish ? "Unable to save course settings." : "ไม่สามารถบันทึกการตั้งค่าได้"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSaving(false);
        }
    }, [course.id, formData, isEnglish, onCourseUpdate]);

    // Handle cancel
    const handleCancel = useCallback(() => {
        setFormData(buildFormDataFromCourse(course));
        setIsEditing(false);
    }, [course, buildFormDataFromCourse]);

    // Start editing
    const startEditing = useCallback(() => {
        setIsEditing(true);
    }, []);

    // Get semester text
    const getSemesterText = useCallback((semester: number) => {
        switch (semester) {
            case 1: return isEnglish ? "Semester 1" : "ภาคเรียนที่ 1";
            case 2: return isEnglish ? "Semester 2" : "ภาคเรียนที่ 2";
            case 3: return isEnglish ? "Summer" : "ภาคฤดูร้อน";
            default: return isEnglish ? `Semester ${semester}` : `ภาคเรียนที่ ${semester}`;
        }
    }, [isEnglish]);

    // ─── Export All (multi-sheet Excel with full styling) ────────────────────
    const handleExportAll = useCallback(async () => {
        setIsExporting(true);
        try {
            const ExcelJS = (await import("exceljs")).default;
            const wb = new ExcelJS.Workbook();
            wb.creator = "ITII Assist";
            wb.created = new Date();

            // ── Style helpers ─────────────────────────────────────────────────
            // Score → ARGB fill color (intensity based on percentage)
            const scoreArgb = (score: number | null, maxScore: number): string | null => {
                if (score === null || score === undefined) return "FFE2E8F0"; // slate-200 = not graded
                if (maxScore === 0) return null;
                const pct = score / maxScore;
                if (pct >= 0.9)  return "FF16A34A"; // green-600
                if (pct >= 0.75) return "FF4ADE80"; // green-400
                if (pct >= 0.5)  return "FFBBF7D0"; // green-100
                if (pct >= 0.25) return "FFFDE68A"; // amber-100
                if (pct >  0)    return "FFFCA5A5"; // red-200
                return "FFEF4444"; // red-500 (zero)
            };
            // Whether score needs white text (dark bg)
            const scoreWhite = (score: number | null, maxScore: number): boolean => {
                if (score === null) return false;
                if (maxScore === 0) return false;
                const pct = score / maxScore;
                return pct >= 0.9 || pct === 0;
            };

            type FillSolid = { type: "pattern"; pattern: "solid"; fgColor: { argb: string } };
            const solidFill = (argb: string): FillSolid => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

            // Header styles
            const HDR1_FILL = solidFill("FF1E293B"); // slate-800
            const HDR2_FILL = solidFill("FF334155"); // slate-700
            const HDR1_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" };
            const HDR2_FONT: Partial<ExcelJS.Font> = { bold: false, color: { argb: "FFE2E8F0" }, size: 10, name: "Calibri" };
            const CENTER_ALIGN: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };
            const LEFT_ALIGN: Partial<ExcelJS.Alignment>   = { horizontal: "left",   vertical: "middle" };
            const THIN_BORDER: Partial<ExcelJS.Borders> = {
                top:    { style: "thin", color: { argb: "FFD1D5DB" } },
                bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
                left:   { style: "thin", color: { argb: "FFD1D5DB" } },
                right:  { style: "thin", color: { argb: "FFD1D5DB" } },
            };
            const applyHdr1 = (cell: ExcelJS.Cell) => { cell.fill = HDR1_FILL; cell.font = HDR1_FONT; cell.alignment = CENTER_ALIGN; cell.border = THIN_BORDER; };
            const applyHdr2 = (cell: ExcelJS.Cell) => { cell.fill = HDR2_FILL; cell.font = HDR2_FONT; cell.alignment = CENTER_ALIGN; cell.border = THIN_BORDER; };

            // ── Helper: build a styled score worksheet ────────────────────────
            type ColDef = { key: string; asgmtTitle: string; asgmtMax: number; subLabel: string | null; asgmtStart: boolean };
            const buildScoreSheet = (
                matrix: NonNullable<Awaited<ReturnType<typeof scoreService.getScoreSummaryMatrix>>>,
                sheetName: string,
                isGroup = false,
            ) => {
                const ws = wb.addWorksheet(sheetName);
                // For group sheets: 1 extra fixed col (ชื่อกลุ่ม)
                const FIXED = isGroup ? 4 : 3;
                const asgmts = matrix.assignments;

                const scoreCols: ColDef[] = [];
                let colIdx = FIXED;
                for (const a of asgmts) {
                    if (a.subItems.length === 0) {
                        scoreCols.push({ key: `${a.id}_main`, asgmtTitle: a.title, asgmtMax: a.max_score, subLabel: null, asgmtStart: true });
                        colIdx++;
                    } else {
                        for (let si = 0; si < a.subItems.length; si++) {
                            const sub = a.subItems[si];
                            scoreCols.push({ key: `${a.id}_${sub.id}`, asgmtTitle: a.title, asgmtMax: sub.max_score, subLabel: `${sub.name} (${sub.max_score})`, asgmtStart: si === 0 });
                            colIdx++;
                        }
                    }
                }
                const totalCols = FIXED + scoreCols.length + 2;

                // Column widths (1-indexed)
                if (isGroup) {
                    ws.getColumn(1).width = 22; // ชื่อกลุ่ม
                    ws.getColumn(2).width = 16; // รหัสนักศึกษา
                    ws.getColumn(3).width = 28; // ชื่อ-นามสกุล
                    ws.getColumn(4).width = 10; // กลุ่มเรียน
                } else {
                    ws.getColumn(1).width = 16;
                    ws.getColumn(2).width = 28;
                    ws.getColumn(3).width = 10;
                }
                for (let c = FIXED + 1; c < FIXED + 1 + scoreCols.length; c++) ws.getColumn(c).width = 11;
                ws.getColumn(FIXED + scoreCols.length + 1).width = 9;
                ws.getColumn(FIXED + scoreCols.length + 2).width = 11;

                // Row heights
                ws.getRow(1).height = 32;
                ws.getRow(2).height = 22;

                // ─ Row 1: main headers ─
                const r1 = ws.getRow(1);
                if (isGroup) {
                    r1.getCell(1).value = "ชื่อกลุ่ม";
                    r1.getCell(2).value = "รหัสนักศึกษา";
                    r1.getCell(3).value = "ชื่อ-นามสกุล";
                    r1.getCell(4).value = "กลุ่มเรียน";
                } else {
                    r1.getCell(1).value = "รหัสนักศึกษา";
                    r1.getCell(2).value = "ชื่อ-นามสกุล";
                    r1.getCell(3).value = "กลุ่มเรียน";
                }

                let ci = FIXED; // 0-based cursor
                for (const col of scoreCols) {
                    if (col.asgmtStart) r1.getCell(ci + 1).value = `${col.asgmtTitle} (${col.asgmtMax})`;
                    ci++;
                }
                r1.getCell(totalCols - 1).value = "รวม";
                r1.getCell(totalCols).value = "คะแนนเต็ม";
                for (let c = 1; c <= totalCols; c++) applyHdr1(r1.getCell(c));

                // ─ Row 2: sub-item labels ─
                const r2 = ws.getRow(2);
                ci = FIXED;
                for (const col of scoreCols) {
                    if (col.subLabel) r2.getCell(ci + 1).value = col.subLabel;
                    ci++;
                }
                for (let c = 1; c <= totalCols; c++) applyHdr2(r2.getCell(c));

                // ─ Merges for headers ─
                // Fixed cols: vertical merge rows 1-2
                if (isGroup) {
                    ws.mergeCells(1, 1, 2, 1);
                    ws.mergeCells(1, 2, 2, 2);
                    ws.mergeCells(1, 3, 2, 3);
                    ws.mergeCells(1, 4, 2, 4);
                } else {
                    ws.mergeCells(1, 1, 2, 1);
                    ws.mergeCells(1, 2, 2, 2);
                    ws.mergeCells(1, 3, 2, 3);
                }
                ws.mergeCells(1, totalCols - 1, 2, totalCols - 1);
                ws.mergeCells(1, totalCols, 2, totalCols);

                ci = FIXED;
                for (const a of asgmts) {
                    if (a.subItems.length === 0) {
                        // Single col: vertical merge
                        ws.mergeCells(1, ci + 1, 2, ci + 1);
                        ci++;
                    } else {
                        // Multi cols: horizontal merge for title in row 1
                        ws.mergeCells(1, ci + 1, 1, ci + a.subItems.length);
                        ci += a.subItems.length;
                    }
                }

                // ─ Data rows ─
                // Pre-compute group merge ranges for group sheets
                const groupMergeRanges: Array<{ startRow: number; endRow: number; group_id: number | null; group_name: string | null }> = [];
                if (isGroup) {
                    let i = 0;
                    while (i < matrix.students.length) {
                        const gid = matrix.students[i].group_id ?? null;
                        let j = i;
                        while (j < matrix.students.length && (matrix.students[j].group_id ?? null) === gid) j++;
                        groupMergeRanges.push({
                            startRow: 3 + i,
                            endRow: 3 + j - 1,
                            group_id: gid,
                            group_name: matrix.students[i].group_name ?? null,
                        });
                        i = j;
                    }
                }

                matrix.students.forEach((stu, rowOffset) => {
                    const r = ws.getRow(3 + rowOffset);
                    if (isGroup) {
                        // group cols: col1 = ชื่อกลุ่ม, col2 = รหัสนักศึกษา, col3 = ชื่อ-นามสกุล, col4 = กลุ่มเรียน
                        r.getCell(1).value = stu.group_name ?? "-";
                        r.getCell(2).value = stu.student_id;
                        r.getCell(3).value = stu.full_name;
                        r.getCell(4).value = stu.section_number;
                    } else {
                        r.getCell(1).value = stu.student_id;
                        r.getCell(2).value = stu.full_name;
                        r.getCell(3).value = stu.section_number;
                    }

                    scoreCols.forEach((col, scIdx) => {
                        const scoreObj = stu.scores[col.key];
                        const val = scoreObj?.score ?? null;
                        const cell = r.getCell(FIXED + scIdx + 1);
                        cell.alignment = CENTER_ALIGN;
                        cell.border = THIN_BORDER;
                        const argb = scoreArgb(val, col.asgmtMax);
                        if (argb) {
                            cell.fill = solidFill(argb);
                            cell.font = { color: { argb: scoreWhite(val, col.asgmtMax) ? "FFFFFFFF" : "FF1E293B" }, size: 10, bold: val !== null && val / col.asgmtMax >= 0.9 };
                        } else {
                            cell.font = { size: 10, color: { argb: "FF64748B" } };
                        }

                        // Build note for edit requests and comments
                        const noteLines: string[] = [];
                        const editReqs = scoreObj?.edit_requests ?? [];
                        if (editReqs.length > 0) {
                            for (const er of editReqs) {
                                const oldStr = er.old_score !== null && er.old_score !== undefined ? String(er.old_score) : "-";
                                noteLines.push(`แก้ไขคะแนน: ${oldStr} → ${er.new_score}`);
                                if (er.reason) noteLines.push(`เหตุผล: ${er.reason}`);
                                if (er.requester) noteLines.push(`ผู้ขอแก้ไข: ${er.requester}`);
                                if (er.reviewer) noteLines.push(`ผู้อนุมัติ: ${er.reviewer}`);
                                if (er.reviewed_at) {
                                    try {
                                        const dt = new Date(er.reviewed_at);
                                        noteLines.push(`อนุมัติเมื่อ: ${dt.toLocaleDateString("th-TH")} ${dt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`);
                                    } catch { /* ignore */ }
                                }
                                if (er.review_comment) noteLines.push(`ความเห็น: ${er.review_comment}`);
                                noteLines.push(""); // separator between multiple requests
                            }
                        }
                        if (scoreObj?.comment) noteLines.push(`หมายเหตุ: ${scoreObj.comment}`);

                        const hasNote = noteLines.filter(l => l.length > 0).length > 0;
                        cell.value = val;
                        if (hasNote) {
                            cell.note = noteLines.join("\n").trim();
                        }
                    });

                    // Total + max
                    const totalCell = r.getCell(totalCols - 1);
                    const maxCell   = r.getCell(totalCols);
                    totalCell.value = stu.total_score;
                    maxCell.value   = stu.total_max_score;
                    totalCell.alignment = CENTER_ALIGN;
                    maxCell.alignment   = CENTER_ALIGN;
                    totalCell.border = THIN_BORDER;
                    maxCell.border   = THIN_BORDER;
                    const totalArgb = scoreArgb(stu.total_score, stu.total_max_score);
                    if (totalArgb) {
                        totalCell.fill = solidFill(totalArgb);
                        totalCell.font = { bold: true, color: { argb: scoreWhite(stu.total_score, stu.total_max_score) ? "FFFFFFFF" : "FF1E293B" }, size: 10 };
                    }

                    // Fixed col styles
                    if (isGroup) {
                        r.getCell(1).alignment = CENTER_ALIGN;
                        r.getCell(2).alignment = LEFT_ALIGN;
                        r.getCell(3).alignment = LEFT_ALIGN;
                        r.getCell(4).alignment = CENTER_ALIGN;
                        for (let c = 1; c <= FIXED; c++) r.getCell(c).border = THIN_BORDER;
                    } else {
                        r.getCell(1).alignment = LEFT_ALIGN;
                        r.getCell(2).alignment = LEFT_ALIGN;
                        r.getCell(3).alignment = CENTER_ALIGN;
                        r.getCell(1).border = THIN_BORDER;
                        r.getCell(2).border = THIN_BORDER;
                        r.getCell(3).border = THIN_BORDER;
                    }
                    // Alternate row
                    if (rowOffset % 2 === 1) {
                        for (let c = 1; c <= FIXED; c++) {
                            if (!r.getCell(c).fill || (r.getCell(c).fill as FillSolid).fgColor?.argb === undefined)
                                r.getCell(c).fill = solidFill("FFF8FAFC");
                        }
                    }
                });

                // ─ Group cell merges (vertical) for group sheets ─
                if (isGroup) {
                    const GROUP_FILL = solidFill("FFE0E7FF"); // indigo-100
                    const GROUP_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF3730A3" }, size: 10, name: "Calibri" }; // indigo-800
                    for (const range of groupMergeRanges) {
                        // Merge ชื่อกลุ่ม and รหัสกลุ่ม columns vertically
                        if (range.endRow > range.startRow) {
                            ws.mergeCells(range.startRow, 1, range.endRow, 1);
                        }
                        // Style the merged group cell
                        const nameCell = ws.getCell(range.startRow, 1);
                        nameCell.fill = GROUP_FILL;
                        nameCell.font = GROUP_FONT;
                        nameCell.alignment = CENTER_ALIGN;
                        nameCell.border = THIN_BORDER;
                    }
                }

                ws.views = [{ state: "frozen", xSplit: isGroup ? 4 : 3, ySplit: 2 }];
                return ws;
            };

            // ════════════════════════════════════════════════════════════════
            // Sheets 1-3: Score matrices (individual, assignment, permanent group)
            // ════════════════════════════════════════════════════════════════
            const scoreTypes: Array<{ key: "individual" | "assignment" | "permanent_group"; sheet: string }> = [
                { key: "individual",      sheet: "คะแนนแลป" },
                { key: "assignment",      sheet: "คะแนนการบ้าน" },
                { key: "permanent_group", sheet: "คะแนนกลุ่ม" },
            ];

            type SummaryEntry = {
                full_name: string; section: number;
                total_lab: number; total_lab_max: number;
                total_hw: number;  total_hw_max: number;
                total_group: number; total_group_max: number;
                bonus: number;
            };
            const summaryMap = new Map<string, SummaryEntry>();

            const matrices = await Promise.all(
                scoreTypes.map(t => scoreService.getScoreSummaryMatrix(courseId, { assignmentType: t.key }))
            );

            matrices.forEach((matrix, idx) => {
                if (!matrix) {
                    const ws = wb.addWorksheet(scoreTypes[idx].sheet);
                    ws.addRow(["ไม่มีข้อมูลคะแนน"]);
                    return;
                }
                for (const stu of matrix.students) {
                    const prev = summaryMap.get(stu.student_id) ?? {
                        full_name: stu.full_name, section: stu.section_number,
                        total_lab: 0, total_lab_max: 0,
                        total_hw: 0,  total_hw_max: 0,
                        total_group: 0, total_group_max: 0,
                        bonus: stu.bonus_score,
                    };
                    if (idx === 0) { prev.total_lab   = stu.total_score; prev.total_lab_max   = stu.total_max_score; }
                    if (idx === 1) { prev.total_hw    = stu.total_score; prev.total_hw_max    = stu.total_max_score; }
                    if (idx === 2) { prev.total_group = stu.total_score; prev.total_group_max = stu.total_max_score; }
                    prev.bonus = stu.bonus_score;
                    summaryMap.set(stu.student_id, prev);
                }
                buildScoreSheet(matrix, scoreTypes[idx].sheet, scoreTypes[idx].key === "permanent_group");
            });

            // ════════════════════════════════════════════════════════════════
            // Sheet 4: คะแนนกลุ่ม (สัปดาห์) — weekly group
            // Columns: รหัสนักศึกษา | ชื่อ-นามสกุล | กลุ่มเรียน | [Asgmt 1 scores] | ...
            // Group name is shown as an Excel note on each score cell
            // ════════════════════════════════════════════════════════════════
            const weeklyMatrix = await scoreService.getScoreSummaryMatrix(courseId, { assignmentType: "weekly_group" });
            if (!weeklyMatrix || weeklyMatrix.assignments.length === 0) {
                const wws = wb.addWorksheet("\u0e04\u0e30\u0e41\u0e19\u0e19\u0e01\u0e25\u0e38\u0e48\u0e21 (\u0e2a\u0e31\u0e1b\u0e14\u0e32\u0e2b\u0e4c)");
                wws.getColumn(1).width = 22;
                wws.getColumn(2).width = 16;
                wws.getColumn(3).width = 28;
                wws.getColumn(4).width = 12;
                const noDataHdr = wws.getRow(1);
                noDataHdr.height = 30;
                noDataHdr.getCell(1).value = "\u0e0a\u0e37\u0e48\u0e2d\u0e01\u0e25\u0e38\u0e48\u0e21";
                noDataHdr.getCell(2).value = "\u0e23\u0e2b\u0e31\u0e2a\u0e19\u0e31\u0e01\u0e28\u0e36\u0e01\u0e29\u0e32";
                noDataHdr.getCell(3).value = "\u0e0a\u0e37\u0e48\u0e2d \u0e19\u0e32\u0e21\u0e2a\u0e01\u0e38\u0e25";
                noDataHdr.getCell(4).value = "\u0e04\u0e30\u0e41\u0e19\u0e19\u0e23\u0e27\u0e21";
                for (let c = 1; c <= 4; c++) applyHdr1(noDataHdr.getCell(c));
                if (weeklyMatrix?.students.length) {
                    weeklyMatrix.students.forEach((stu, rowOffset) => {
                        const wr = wws.getRow(2 + rowOffset);
                        wr.getCell(1).value = "-";
                        wr.getCell(2).value = stu.student_id;
                        wr.getCell(3).value = stu.full_name;
                        wr.getCell(4).value = stu.total_score;
                        wr.getCell(1).alignment = CENTER_ALIGN;
                        wr.getCell(2).alignment = LEFT_ALIGN;
                        wr.getCell(3).alignment = LEFT_ALIGN;
                        wr.getCell(4).alignment = CENTER_ALIGN;
                        for (let c = 1; c <= 4; c++) wr.getCell(c).border = THIN_BORDER;
                        if (rowOffset % 2 === 1) {
                            for (let c = 1; c <= 4; c++) wr.getCell(c).fill = solidFill("FFF8FAFC");
                        }
                    });
                }
                wws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
            } else {
                const wws = wb.addWorksheet("\u0e04\u0e30\u0e41\u0e19\u0e19\u0e01\u0e25\u0e38\u0e48\u0e21 (\u0e2a\u0e31\u0e1b\u0e14\u0e32\u0e2b\u0e4c)");
                const WEEK_FIXED = 3;
                type WeeklyColDef = {
                    scoreKey: string;
                    asgmtMax: number;
                    headerLabel: string;
                };
                type WeeklyBlock = {
                    weekNumber: number;
                    columns: WeeklyColDef[];
                };

                const assignmentsByWeek = new Map<number, typeof weeklyMatrix.assignments>();
                for (const assignment of weeklyMatrix.assignments) {
                    const weekNumber = assignment.week_number ?? 0;
                    const bucket = assignmentsByWeek.get(weekNumber) ?? [];
                    bucket.push(assignment);
                    assignmentsByWeek.set(weekNumber, bucket);
                }

                const weeklyBlocks: WeeklyBlock[] = Array.from(assignmentsByWeek.entries())
                    .sort((a, b) => a[0] - b[0])
                    .map(([weekNumber, assignments]) => ({
                        weekNumber,
                        columns: assignments.flatMap((assignment) => {
                            if (assignment.subItems.length === 0) {
                                return [{
                                    scoreKey: `${assignment.id}_main`,
                                    asgmtMax: assignment.max_score,
                                    headerLabel: assignment.title,
                                }];
                            }
                            return assignment.subItems.map((subItem) => ({
                                scoreKey: `${assignment.id}_${subItem.id}`,
                                asgmtMax: subItem.max_score,
                                headerLabel: subItem.name,
                            }));
                        }),
                    }));

                const maxWeekCols = weeklyBlocks.reduce((max, block) => Math.max(max, block.columns.length), 0);
                const totalCol = WEEK_FIXED + maxWeekCols + 1;

                wws.getColumn(1).width = 22;
                wws.getColumn(2).width = 16;
                wws.getColumn(3).width = 28;
                for (let c = 4; c < totalCol; c++) wws.getColumn(c).width = 11;
                wws.getColumn(totalCol).width = 12;

                const topHeader = wws.getRow(1);
                topHeader.height = 30;
                topHeader.getCell(1).value = "\u0e0a\u0e37\u0e48\u0e2d\u0e01\u0e25\u0e38\u0e48\u0e21";
                topHeader.getCell(2).value = "\u0e23\u0e2b\u0e31\u0e2a\u0e19\u0e31\u0e01\u0e28\u0e36\u0e01\u0e29\u0e32";
                topHeader.getCell(3).value = "\u0e0a\u0e37\u0e48\u0e2d \u0e19\u0e32\u0e21\u0e2a\u0e01\u0e38\u0e25";
                topHeader.getCell(4).value = "\u0e07\u0e32\u0e19";
                topHeader.getCell(totalCol).value = "\u0e04\u0e30\u0e41\u0e19\u0e19\u0e23\u0e27\u0e21";
                for (let c = 1; c <= totalCol; c++) applyHdr1(topHeader.getCell(c));
                if (totalCol > 4) wws.mergeCells(1, 4, 1, totalCol - 1);

                const buildWeeklyNote = (scoreObj?: {
                    group_name?: string | null;
                    comment?: string | null;
                    edit_requests?: {
                        old_score: number | null;
                        new_score: number;
                        reason: string | null;
                        requester: string | null;
                        reviewer: string | null;
                        reviewed_at: string | null;
                        review_comment: string | null;
                    }[];
                }) => {
                    if (!scoreObj) return undefined;
                    const noteLines: string[] = [];
                    if (scoreObj.group_name) noteLines.push(`\u0e01\u0e25\u0e38\u0e48\u0e21: ${scoreObj.group_name}`);
                    const editReqs = scoreObj.edit_requests ?? [];
                    if (editReqs.length > 0) {
                        if (noteLines.length > 0) noteLines.push("");
                        for (const er of editReqs) {
                            const oldStr = er.old_score !== null && er.old_score !== undefined ? String(er.old_score) : "-";
                            noteLines.push(`\u0e41\u0e01\u0e49\u0e44\u0e02\u0e04\u0e30\u0e41\u0e19\u0e19: ${oldStr} -> ${er.new_score}`);
                            if (er.reason) noteLines.push(`\u0e40\u0e2b\u0e15\u0e38\u0e1c\u0e25: ${er.reason}`);
                            if (er.requester) noteLines.push(`\u0e1c\u0e39\u0e49\u0e02\u0e2d\u0e41\u0e01\u0e49\u0e44\u0e02: ${er.requester}`);
                            if (er.reviewer) noteLines.push(`\u0e1c\u0e39\u0e49\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34: ${er.reviewer}`);
                            if (er.review_comment) noteLines.push(`\u0e04\u0e27\u0e32\u0e21\u0e40\u0e2b\u0e47\u0e19: ${er.review_comment}`);
                            noteLines.push("");
                        }
                    }
                    if (scoreObj.comment) noteLines.push(`\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38: ${scoreObj.comment}`);
                    const content = noteLines.join("\\n").trim();
                    return content.length > 0 ? content : undefined;
                };

                let currentRow = 2;
                let stripeIndex = 0;
                for (const block of weeklyBlocks) {
                    const weekLabelRow = wws.getRow(currentRow);
                    weekLabelRow.height = 24;
                    weekLabelRow.getCell(1).value = block.weekNumber > 0 ? `\u0e2a\u0e31\u0e1b\u0e14\u0e32\u0e2b\u0e4c\u0e17\u0e35\u0e48 ${block.weekNumber}` : "\u0e2a\u0e31\u0e1b\u0e14\u0e32\u0e2b\u0e4c\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38";
                    for (let c = 1; c <= totalCol; c++) applyHdr2(weekLabelRow.getCell(c));
                    if (totalCol > 1) wws.mergeCells(currentRow, 1, currentRow, totalCol);
                    currentRow += 1;

                    const weekHeaderRow = wws.getRow(currentRow);
                    weekHeaderRow.height = 22;
                    block.columns.forEach((col, index) => {
                        weekHeaderRow.getCell(4 + index).value = col.headerLabel;
                    });
                    for (let c = 1; c <= totalCol; c++) applyHdr2(weekHeaderRow.getCell(c));
                    currentRow += 1;

                    const weekStudents = weeklyMatrix.students
                        .map((stu) => {
                            const weekKey = String(block.weekNumber);
                            const fallbackGroupName = block.columns
                                .map((col) => stu.scores[col.scoreKey]?.group_name)
                                .find((value): value is string => Boolean(value && value.trim()));
                            const groupName = stu.weekly_group_names?.[weekKey] ?? fallbackGroupName ?? null;
                            const groupId = stu.weekly_group_ids?.[weekKey] ?? null;
                            return { stu, groupName, groupId };
                        })
                        .filter((entry) => entry.groupName);

                    weekStudents.sort((a, b) => {
                        const groupDiff = (a.groupId ?? Number.MAX_SAFE_INTEGER) - (b.groupId ?? Number.MAX_SAFE_INTEGER);
                        if (groupDiff !== 0) return groupDiff;
                        const nameDiff = (a.groupName ?? "").localeCompare(b.groupName ?? "");
                        if (nameDiff !== 0) return nameDiff;
                        return a.stu.student_id.localeCompare(b.stu.student_id);
                    });

                    const groupRanges: Array<{ startRow: number; endRow: number; groupName: string }> = [];
                    let groupStart = currentRow;
                    for (let index = 0; index < weekStudents.length; index++) {
                        const entry = weekStudents[index];
                        const row = wws.getRow(currentRow + index);
                        row.getCell(1).value = entry.groupName;
                        row.getCell(2).value = entry.stu.student_id;
                        row.getCell(3).value = entry.stu.full_name;
                        row.getCell(1).alignment = CENTER_ALIGN;
                        row.getCell(2).alignment = LEFT_ALIGN;
                        row.getCell(3).alignment = LEFT_ALIGN;
                        for (let c = 1; c <= 3; c++) row.getCell(c).border = THIN_BORDER;

                        block.columns.forEach((col, colIndex) => {
                            const scoreObj = entry.stu.scores[col.scoreKey];
                            const val = scoreObj?.score ?? null;
                            const cell = row.getCell(4 + colIndex);
                            cell.value = val;
                            cell.alignment = CENTER_ALIGN;
                            cell.border = THIN_BORDER;
                            const argb = scoreArgb(val, col.asgmtMax);
                            if (argb) {
                                cell.fill = solidFill(argb);
                                cell.font = { color: { argb: scoreWhite(val, col.asgmtMax) ? "FFFFFFFF" : "FF1E293B" }, size: 10, bold: val !== null && val / col.asgmtMax >= 0.9 };
                            } else {
                                cell.font = { size: 10, color: { argb: "FF64748B" } };
                            }
                            const note = buildWeeklyNote(scoreObj);
                            if (note) cell.note = note;
                        });

                        for (let c = 4 + block.columns.length; c < totalCol; c++) {
                            row.getCell(c).border = THIN_BORDER;
                            row.getCell(c).alignment = CENTER_ALIGN;
                        }

                        const totalCell = row.getCell(totalCol);
                        totalCell.value = entry.stu.total_score;
                        totalCell.alignment = CENTER_ALIGN;
                        totalCell.border = THIN_BORDER;
                        const totalArgb = scoreArgb(entry.stu.total_score, entry.stu.total_max_score);
                        if (totalArgb) {
                            totalCell.fill = solidFill(totalArgb);
                            totalCell.font = { bold: true, color: { argb: scoreWhite(entry.stu.total_score, entry.stu.total_max_score) ? "FFFFFFFF" : "FF1E293B" }, size: 10 };
                        }

                        if (stripeIndex % 2 === 1) {
                            for (let c = 1; c <= totalCol; c++) {
                                const currentCell = row.getCell(c);
                                const fillArgb = (currentCell.fill as FillSolid | undefined)?.fgColor?.argb;
                                if (!fillArgb) currentCell.fill = solidFill("FFF8FAFC");
                            }
                        }
                        stripeIndex += 1;

                        const nextEntry = weekStudents[index + 1];
                        if (!nextEntry || nextEntry.groupName !== entry.groupName) {
                            groupRanges.push({
                                startRow: groupStart,
                                endRow: currentRow + index,
                                groupName: entry.groupName ?? "-",
                            });
                            groupStart = currentRow + index + 1;
                        }
                    }

                    const GROUP_FILL = solidFill("FFE0E7FF");
                    const GROUP_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF3730A3" }, size: 10, name: "Calibri" };
                    for (const range of groupRanges) {
                        if (range.endRow > range.startRow) {
                            wws.mergeCells(range.startRow, 1, range.endRow, 1);
                        }
                        const nameCell = wws.getCell(range.startRow, 1);
                        nameCell.value = range.groupName;
                        nameCell.fill = GROUP_FILL;
                        nameCell.font = GROUP_FONT;
                        nameCell.alignment = CENTER_ALIGN;
                        nameCell.border = THIN_BORDER;
                    }

                    currentRow += weekStudents.length;
                    currentRow += 1;
                }

                wws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
            }

            const sessions = await attendanceService.getSessions(courseId);
            const closedSessions = (sessions ?? []).filter(s => s.status !== "draft");

            const ATT_COLOR: Record<string, string> = {
                "มา":   "FF86EFAC", // green-300
                "สาย":  "FFFDE68A", // amber-100
                "ลา":   "FFB4D0FF", // blue-200
                "ขาด":  "FFFCA5A5", // red-200
            };
            const ATT_TEXT: Record<string, string> = {
                "มา":   "FF14532D", // green-900
                "สาย":  "FF78350F", // amber-900
                "ลา":   "FF1E3A8A", // blue-900
                "ขาด":  "FF7F1D1D", // red-900
            };

            if (closedSessions.length > 0) {
                const allRecords = await Promise.all(
                    closedSessions.map(s => attendanceService.getRecords(s.id))
                );

                type AttEntry = {
                    full_name: string;
                    section: number;
                    records: Record<number, string>;
                    checkInTimes: Record<number, string | null>;
                    updaters: Record<number, string | null>;
                    updatedAts: Record<number, string | null>;
                    notes: Record<number, string | null>;
                };
                const attMap = new Map<string, AttEntry>();
                allRecords.forEach((records, sIdx) => {
                    const sessionId = closedSessions[sIdx].id;
                    for (const rec of records) {
                        const sid = rec.student?.student_id ?? String(rec.student_id);
                        if (!attMap.has(sid)) {
                            const sectionNum = summaryMap.get(sid)?.section ?? 0;
                            attMap.set(sid, { full_name: rec.student?.full_name ?? sid, section: sectionNum, records: {}, checkInTimes: {}, updaters: {}, updatedAts: {}, notes: {} });
                        }
                        const entry = attMap.get(sid)!;
                        entry.records[sessionId] = rec.status;
                        entry.checkInTimes[sessionId] = rec.check_in_time ?? null;
                        entry.updaters[sessionId] = rec.updater?.full_name ?? null;
                        entry.updatedAts[sessionId] = rec.updated_by ? (rec.updated_at ?? null) : null;
                        entry.notes[sessionId] = rec.note ?? null;
                    }
                });

                const TH: Record<string, string> = { present: "มา", late: "สาย", leave: "ลา", absent: "ขาด" };

                // Sort attendance entries by section, then student_id
                const sortedAttEntries = Array.from(attMap.entries()).sort(([sidA, a], [sidB, b]) => {
                    if (a.section !== b.section) return a.section - b.section;
                    return sidA.localeCompare(sidB);
                });

                const attWs = wb.addWorksheet("การเช็คชื่อ");
                const AFIXED = 3;
                const ASUM = 6; // summary cols
                const ATOTAL = AFIXED + closedSessions.length + ASUM;

                // Column widths
                attWs.getColumn(1).width = 16;
                attWs.getColumn(2).width = 28;
                attWs.getColumn(3).width = 10;
                for (let c = 4; c < 4 + closedSessions.length; c++) attWs.getColumn(c).width = 15;
                for (let c = 4 + closedSessions.length; c <= ATOTAL; c++) attWs.getColumn(c).width = 10;
                attWs.getRow(1).height = 36; // taller for possible section label wrap
                attWs.getRow(2).height = 18;

                // Row 1: session titles (+ section labels if session is section-specific)
                const ar1 = attWs.getRow(1);
                ar1.getCell(1).value = "รหัสนักศึกษา";
                ar1.getCell(2).value = "ชื่อ-นามสกุล";
                ar1.getCell(3).value = "กลุ่มเรียน";
                closedSessions.forEach((s, i) => {
                    // Resolve which sections this session targets
                    const sectionNos: number[] = s.sections?.map(sec => sec.section_no) ?? [];
                    if (!sectionNos.length && s.course_section_id) {
                        // legacy single section — section_no not directly available, mark as "(Sec ?)"
                    }
                    const secLabel = sectionNos.length > 0 ? `\n[Sec ${sectionNos.join(",")}]` : "";
                    ar1.getCell(AFIXED + i + 1).value = `${s.title}${secLabel}`;
                });
                const ATT_SUM_LABELS = ["มาเรียน", "สาย", "ลา", "ขาด", "นับเข้าเรียน", "รวมครั้ง"];
                ATT_SUM_LABELS.forEach((lbl, i) => { ar1.getCell(AFIXED + closedSessions.length + i + 1).value = lbl; });
                for (let c = 1; c <= ATOTAL; c++) applyHdr1(ar1.getCell(c));

                // Row 2: dates
                const ar2 = attWs.getRow(2);
                closedSessions.forEach((s, i) => {
                    ar2.getCell(AFIXED + i + 1).value = new Date(s.start_time).toLocaleDateString("th-TH");
                });
                for (let c = 1; c <= ATOTAL; c++) applyHdr2(ar2.getCell(c));

                // Merges: fixed cols + summary cols span rows 1-2
                attWs.mergeCells(1, 1, 2, 1);
                attWs.mergeCells(1, 2, 2, 2);
                attWs.mergeCells(1, 3, 2, 3);
                for (let c = AFIXED + closedSessions.length + 1; c <= ATOTAL; c++) attWs.mergeCells(1, c, 2, c);

                // Data rows
                sortedAttEntries.forEach(([sid, data], rowOffset) => {
                    // If student has NO record for a session → they were not targeted → show "-"
                    const statuses = closedSessions.map(s =>
                        s.id in data.records ? TH[data.records[s.id]] ?? "ขาด" : "-"
                    );
                    // Only count sessions the student was actually targeted in
                    const targeted = statuses.filter(x => x !== "-");
                    const present = targeted.filter(x => x === "มา").length;
                    const late    = targeted.filter(x => x === "สาย").length;
                    const leave   = targeted.filter(x => x === "ลา").length;
                    const absent  = targeted.filter(x => x === "ขาด").length;
                    const r = attWs.getRow(3 + rowOffset);
                    r.height = 30; // accommodate status + time on two lines

                    r.getCell(1).value = sid;
                    r.getCell(2).value = data.full_name;
                    r.getCell(3).value = data.section || "-";
                    r.getCell(1).alignment = LEFT_ALIGN;
                    r.getCell(2).alignment = LEFT_ALIGN;
                    r.getCell(3).alignment = CENTER_ALIGN;
                    r.getCell(1).border = THIN_BORDER;
                    r.getCell(2).border = THIN_BORDER;
                    r.getCell(3).border = THIN_BORDER;

                    // Build check-in time strings for each session
                    const checkInTimes = closedSessions.map(s => {
                        const t = data.checkInTimes[s.id];
                        if (!t) return null;
                        try {
                            return new Date(t).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
                        } catch { return null; }
                    });

                    // Build updater info for each session
                    const updaterInfos = closedSessions.map(s => {
                        const updaterName = data.updaters[s.id];
                        if (!updaterName) return null;
                        const updatedAt = data.updatedAts[s.id];
                        const note = data.notes[s.id];
                        let info = `แก้ไขโดย: ${updaterName}`;
                        if (updatedAt) {
                            try {
                                const dt = new Date(updatedAt);
                                info += `\nเมื่อ: ${dt.toLocaleDateString("th-TH")} ${dt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
                            } catch { /* ignore */ }
                        }
                        if (note) info += `\nหมายเหตุ: ${note}`;
                        return info;
                    });

                    statuses.forEach((st, i) => {
                        const cell = r.getCell(AFIXED + i + 1);
                        const timeStr = checkInTimes[i];
                        const updaterInfo = updaterInfos[i];
                        // Show status with check-in time (e.g. "มา\n10:30")
                        let displayVal = st === "-" ? st : timeStr ? `${st}\n${timeStr}` : st;
                        // If manually edited, append asterisk
                        if (updaterInfo) displayVal += " *";
                        cell.value = displayVal;
                        cell.alignment = { ...CENTER_ALIGN, wrapText: true };
                        cell.border = THIN_BORDER;
                        if (st === "-") {
                            cell.fill = solidFill("FFF1F5F9");
                            cell.font = { color: { argb: "FFCBD5E1" }, italic: true, size: 10 };
                        } else if (ATT_COLOR[st]) {
                            cell.fill = solidFill(ATT_COLOR[st]);
                            cell.font = { color: { argb: ATT_TEXT[st] ?? "FF000000" }, size: 10, bold: st === "มา" };
                        }
                        // Add Excel comment/note if manually edited
                        if (updaterInfo) {
                            cell.note = updaterInfo;
                        }
                    });

                    const sumVals = [present, late, leave, absent, present + late, targeted.length];
                    const sumArgbs = ["FF16A34A", "FFCA8A04", "FF1D4ED8", "FFDC2626", "FF0F766E", "FF475569"];
                    sumVals.forEach((v, i) => {
                        const cell = r.getCell(AFIXED + closedSessions.length + i + 1);
                        cell.value = v;
                        cell.alignment = CENTER_ALIGN;
                        cell.border = THIN_BORDER;
                        cell.font = { bold: true, color: { argb: sumArgbs[i] }, size: 10 };
                    });

                    if (rowOffset % 2 === 1) {
                        r.getCell(1).fill = solidFill("FFF8FAFC");
                        r.getCell(2).fill = solidFill("FFF8FAFC");
                        r.getCell(3).fill = solidFill("FFF8FAFC");
                    }
                });

                attWs.views = [{ state: "frozen", xSplit: 3, ySplit: 2 }];
            } else {
                const ws = wb.addWorksheet("การเช็คชื่อ");
                ws.addRow(["ยังไม่มีการเช็คชื่อในรายวิชานี้"]);
            }

            // ════════════════════════════════════════════════════════════════
            // Sheet 5: การทำงานของทีเอ
            // ════════════════════════════════════════════════════════════════
            try {
                const taStatsData = await getTAStats(courseId);
                const taWs = wb.addWorksheet("การทำงานของทีเอ");
                taWs.getColumn(1).width = 30; // ชื่อ
                taWs.getColumn(3).width = 18; // จำนวนที่ตรวจ
                taWs.getColumn(4).width = 18; // สัดส่วน (%)
                taWs.getRow(1).height = 30;

                const taHdrRow = taWs.addRow(["ชื่อ", "จำนวนที่ตรวจ (ครั้ง)", "สัดส่วน (%)"]);
                taHdrRow.eachCell(cell => applyHdr1(cell));

                const totalGraded = taStatsData?.summary?.totalScoresGraded ?? 0;
                const taList = taStatsData?.taStats ?? [];

                taList.forEach((ta, rowOffset) => {
                    const pct = totalGraded > 0
                        ? Math.round((ta.totalScoresGraded / totalGraded) * 1000) / 10
                        : 0;
                    const r = taWs.addRow([ta.fullName, ta.totalScoresGraded, pct]);
                    r.getCell(1).alignment = LEFT_ALIGN;
                    r.getCell(2).alignment = LEFT_ALIGN;
                    r.getCell(3).alignment = CENTER_ALIGN;
                    r.getCell(3).font = { bold: true, color: { argb: "FF0F766E" }, size: 11 };
                    // Color % cell: green scale
                    const pctArgb = pct >= 50 ? "FF16A34A" : pct >= 25 ? "FF4ADE80" : pct >= 10 ? "FFBBF7D0" : "FFF1F5F9";
                    const pctTextArgb = pct >= 50 ? "FFFFFFFF" : "FF1E293B";
                    r.getCell(4).fill = solidFill(pctArgb);
                    r.getCell(4).font = { bold: true, color: { argb: pctTextArgb }, size: 11 };
                    r.getCell(4).value = `${pct.toFixed(1)}%`;
                    r.eachCell(c => { c.border = THIN_BORDER; });
                    if (rowOffset % 2 === 1) {
                        r.getCell(1).fill = solidFill("FFF8FAFC");
                        r.getCell(2).fill = solidFill("FFF8FAFC");
                    }
                });

                // Total row
                const totalRow = taWs.addRow(["รวมทั้งหมด", "", totalGraded, "100%"]);
                totalRow.eachCell(cell => {
                    cell.fill = solidFill("FF1E293B");
                    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
                    cell.alignment = CENTER_ALIGN;
                    cell.border = THIN_BORDER;
                });
                totalRow.getCell(1).alignment = LEFT_ALIGN;

                taWs.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
            } catch {
                const ws = wb.addWorksheet("การทำงานของทีเอ");
                ws.addRow(["ไม่สามารถโหลดข้อมูลกิจกรรมได้"]);
            }

            // ════════════════════════════════════════════════════════════════
            // Sheet 6: สรุปคะแนน
            // ════════════════════════════════════════════════════════════════
            const [examResp, bonusResp] = await Promise.all([
                examScoreService.getExamScores(courseId),
                bonusScoreService.getBonusScoresByCourse(courseId),
            ]);

            type ExamEntry = { midterm_lab: number | null; midterm_lecture: number | null; final_lab: number | null; final_lecture: number | null };
            const examMap = new Map<string, ExamEntry>();

            // Build mapping: integer student PK → string student_id (e.g. "66010001")
            const studentIdMap = new Map<number, string>();
            for (const stu of examResp?.students ?? []) {
                studentIdMap.set(stu.id, stu.student_id);
            }

            for (const setting of examResp?.settings ?? []) {
                for (const score of setting.scores ?? []) {
                    // score.student_id is the integer FK — resolve to string student_id
                    const sid = studentIdMap.get(score.student_id) ?? "";
                    if (!sid) continue;
                    if (!examMap.has(sid)) examMap.set(sid, { midterm_lab: null, midterm_lecture: null, final_lab: null, final_lecture: null });
                    const e = examMap.get(sid)!;
                    if (setting.exam_type === "midterm" && setting.component === "lab")     e.midterm_lab     = score.score;
                    if (setting.exam_type === "midterm" && setting.component === "lecture") e.midterm_lecture = score.score;
                    if (setting.exam_type === "final"   && setting.component === "lab")     e.final_lab       = score.score;
                    if (setting.exam_type === "final"   && setting.component === "lecture") e.final_lecture   = score.score;
                }
            }

            const mLabMax  = examResp?.settings?.find(s => s.exam_type === "midterm" && s.component === "lab")?.max_score ?? 0;
            const mLecMax  = examResp?.settings?.find(s => s.exam_type === "midterm" && s.component === "lecture")?.max_score ?? 0;
            const fLabMax  = examResp?.settings?.find(s => s.exam_type === "final"   && s.component === "lab")?.max_score ?? 0;
            const fLecMax  = examResp?.settings?.find(s => s.exam_type === "final"   && s.component === "lecture")?.max_score ?? 0;

            const bonusMap = new Map<string, number>();
            for (const b of bonusResp?.data?.studentBonusScores ?? []) {
                bonusMap.set(b.student.student_id, b.totalScore);
            }

            const firstEntry = Array.from(summaryMap.values())[0] as SummaryEntry | undefined;
            const labMax   = firstEntry?.total_lab_max   ?? 0;
            const hwMax    = firstEntry?.total_hw_max    ?? 0;
            const groupMax = firstEntry?.total_group_max ?? 0;

            const sumWs = wb.addWorksheet("สรุปคะแนน");
            // Col widths
            [16, 28, 10, 14, 14, 14, 14, 16, 14, 16, 12].forEach((w, i) => { sumWs.getColumn(i + 1).width = w; });
            sumWs.getRow(1).height = 30;
            sumWs.getRow(2).height = 22;

            // Row 1 headers
            const sr1 = sumWs.getRow(1);
            sr1.getCell(1).value  = "รหัสนักศึกษา";
            sr1.getCell(2).value  = "ชื่อ-นามสกุล";
            sr1.getCell(3).value  = "กลุ่มเรียน";
            sr1.getCell(4).value  = `รวมแลป (${labMax})`;
            sr1.getCell(5).value  = `รวมการบ้าน (${hwMax})`;
            sr1.getCell(6).value  = `รวมงานกลุ่ม (${groupMax})`;
            sr1.getCell(7).value  = "สอบกลางภาค";
            sr1.getCell(9).value  = "สอบปลายภาค";
            sr1.getCell(11).value = "คะแนนพิเศษ";
            for (let c = 1; c <= 11; c++) applyHdr1(sr1.getCell(c));

            // Row 2 sub-headers
            const sr2 = sumWs.getRow(2);
            sr2.getCell(7).value  = `แลป (${mLabMax})`;
            sr2.getCell(8).value  = `บรรยาย (${mLecMax})`;
            sr2.getCell(9).value  = `แลป (${fLabMax})`;
            sr2.getCell(10).value = `บรรยาย (${fLecMax})`;
            for (let c = 1; c <= 11; c++) applyHdr2(sr2.getCell(c));

            // Merges
            [1,2,3,4,5,6,11].forEach(c => sumWs.mergeCells(1, c, 2, c));   // vertical
            sumWs.mergeCells(1, 7, 1, 8);   // สอบกลางภาค
            sumWs.mergeCells(1, 9, 1, 10);  // สอบปลายภาค

            // Data rows
            Array.from(summaryMap.entries()).forEach(([sid, data], rowOffset) => {
                const exam = examMap.get(sid) ?? { midterm_lab: null, midterm_lecture: null, final_lab: null, final_lecture: null };
                const bonus = bonusMap.get(sid) ?? data.bonus ?? 0;
                const r = sumWs.getRow(3 + rowOffset);

                const vals: (string | number | null)[] = [
                    sid, data.full_name, data.section,
                    data.total_lab, data.total_hw, data.total_group,
                    exam.midterm_lab, exam.midterm_lecture,
                    exam.final_lab,   exam.final_lecture,
                    bonus,
                ];
                const maxes = [null, null, null, labMax, hwMax, groupMax, mLabMax, mLecMax, fLabMax, fLecMax, null];

                vals.forEach((v, i) => {
                    const cell = r.getCell(i + 1);
                    cell.value = v;
                    cell.border = THIN_BORDER;
                    if (i < 3) {
                        cell.alignment = i === 0 ? LEFT_ALIGN : i === 2 ? CENTER_ALIGN : LEFT_ALIGN;
                    } else {
                        cell.alignment = CENTER_ALIGN;
                        const mx = maxes[i];
                        if (mx !== null && mx > 0) {
                            const argb = scoreArgb(v as number | null, mx);
                            if (argb) {
                                cell.fill = solidFill(argb);
                                cell.font = { color: { argb: scoreWhite(v as number | null, mx) ? "FFFFFFFF" : "FF1E293B" }, bold: i === 3 || i === 4 || i === 5, size: 10 };
                            }
                        } else if (i === 10) {
                            // Bonus: highlight if > 0
                            if ((v as number) > 0) {
                                cell.fill = solidFill("FFFEF08A"); // yellow-200
                                cell.font = { bold: true, color: { argb: "FF713F12" }, size: 10 };
                            }
                        }
                    }
                    if (rowOffset % 2 === 1 && !cell.fill) cell.fill = solidFill("FFF8FAFC");
                });
            });

            sumWs.views = [{ state: "frozen", xSplit: 2, ySplit: 2 }];


            // ── Download ────────────────────────────────────────────────────
            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const dateStr = new Date().toLocaleDateString("th-TH").replace(/\//g, "-");
            a.href = url;
            a.download = `รายงาน_${course.code}_${dateStr}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);

            addToast({ title: "ส่งออกสำเร็จ", description: "ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว", color: "success", timeout: 4000, shouldShowTimeoutProgress: true });
        } catch (e: any) {
            addToast({ title: "เกิดข้อผิดพลาด", description: e?.message || "ไม่สามารถสร้างไฟล์รายงานได้", color: "danger", timeout: 4000, shouldShowTimeoutProgress: true });
        } finally {
            setIsExporting(false);
        }
    }, [courseId, course.code]);

    return {
        // State
        isEditing,
        isSaving,
        formData,
        isExporting,
        isCoverSaving,

        // Computed
        hasWarningChanges,
        isDisablingCourse,
        stats,

        // Actions
        updateField,
        updateCover,
        handleSave,
        handleCancel,
        startEditing,
        getSemesterText,
        handleExportAll,
    };
}

export type UseSettingsTabReturn = ReturnType<typeof useSettingsTab>;
