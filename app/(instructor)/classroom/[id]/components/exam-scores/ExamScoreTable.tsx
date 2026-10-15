"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Icon } from "@iconify/react";
import type { ExamScore, ExamScoreWithSetting, Student } from "@/services/examScore.service";
import { ABSENT_INPUT } from "@/services/examScore.service";
import { formatDateTime, formatScore, scoreCellValue } from "./examScoreUtils";

interface ExamScoreTableProps {
    setting: ExamScoreWithSetting;
    students: Student[];
    scores: Record<number, ExamScore> | undefined;
    canEdit: boolean;
    isSaving: boolean;
    isEnglish: boolean;
    onSave: (studentId: number, rawValue: string, comment: string) => Promise<boolean>;
}

interface EditingState {
    studentId: number;
    value: string;
    comment: string;
}

/**
 * One editable score table for one exam component. Type a number, or "-"
 * for a student who did not sit the exam; "-" is stored as absent and never
 * counts toward the average or the attended total.
 */
export default function ExamScoreTable({ setting, students, scores, canEdit, isSaving, isEnglish, onSave }: ExamScoreTableProps) {
    const [editing, setEditing] = useState<EditingState | null>(null);

    const startEdit = (student: Student) => {
        if (!canEdit) return;
        const current = scores?.[student.id];
        setEditing({ studentId: student.id, value: scoreCellValue(current), comment: current?.comment ?? "" });
    };

    const commit = async () => {
        if (!editing) return;
        const ok = await onSave(editing.studentId, editing.value, editing.comment);
        if (ok) setEditing(null);
    };

    return (
        <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="sticky top-0 z-20 bg-content1">
                    <tr className="border-b border-divider text-left text-xs font-semibold uppercase tracking-wider text-default-500">
                        <th className="w-32 px-3 py-3">{isEnglish ? "Student ID" : "รหัสนักศึกษา"}</th>
                        <th className="px-3 py-3">{isEnglish ? "Name" : "ชื่อ-นามสกุล"}</th>
                        <th className="w-16 px-3 py-3 text-center">Sec</th>
                        <th className="w-40 px-3 py-3 text-right">{isEnglish ? `Score / ${formatScore(setting.max_score)}` : `คะแนน / ${formatScore(setting.max_score)}`}</th>
                        <th className="w-52 px-3 py-3">{isEnglish ? "Note to student" : "หมายเหตุถึงนักศึกษา"}</th>
                        <th className="w-44 px-3 py-3">{isEnglish ? "Saved by" : "บันทึกโดย"}</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map((student, index) => {
                        const score = scores?.[student.id];
                        const isEditing = editing?.studentId === student.id;
                        const cell = scoreCellValue(score);
                        const isAbsent = !!score?.is_absent;
                        const isMissing = cell === "";
                        const rowBg = isMissing ? "bg-warning-50/60 dark:bg-warning-500/10" : index % 2 === 0 ? "bg-content1" : "bg-content2/40";

                        return (
                            <tr key={student.id} className={`border-b border-divider last:border-b-0 ${rowBg}`}>
                                <td className="px-3 py-2.5 font-mono text-[13px] text-default-600">{student.student_id}</td>
                                <td className="truncate px-3 py-2.5 text-default-700">{student.full_name}</td>
                                <td className="px-3 py-2.5 text-center text-default-500">{student.section_no || "-"}</td>
                                <td className="px-3 py-2.5 text-right">
                                    {isEditing ? (
                                        <div className="flex items-center justify-end gap-1">
                                            <Input
                                                size="sm"
                                                variant="bordered"
                                                className="w-20"
                                                classNames={{ input: "text-center font-semibold", inputWrapper: "h-8 min-h-8" }}
                                                aria-label={isEnglish ? "Score" : "คะแนน"}
                                                value={editing.value}
                                                onValueChange={(v) => setEditing({ ...editing, value: v })}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") void commit();
                                                    else if (e.key === "Escape") setEditing(null);
                                                }}
                                                autoFocus
                                            />
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className="group inline-flex items-center gap-2 disabled:cursor-default"
                                            onClick={() => startEdit(student)}
                                            disabled={!canEdit}
                                            aria-label={isEnglish ? `Edit score for ${student.full_name}` : `แก้คะแนนของ ${student.full_name}`}
                                        >
                                            {isAbsent ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-default-100 px-2.5 py-1 text-xs font-medium text-default-600">
                                                    <span className="font-mono font-bold text-foreground">-</span>
                                                    {isEnglish ? "Absent" : "ไม่มาสอบ"}
                                                </span>
                                            ) : isMissing ? (
                                                <span className="inline-flex h-7 w-16 items-center justify-center rounded-md border border-dashed border-warning-500 text-xs text-warning-700 dark:text-warning-400">
                                                    {canEdit ? (isEnglish ? "Enter" : "กรอก") : "-"}
                                                </span>
                                            ) : (
                                                <span className="inline-flex min-w-12 items-center justify-center rounded-md bg-content2 px-2.5 py-1 text-sm font-semibold text-foreground">
                                                    {cell}
                                                </span>
                                            )}
                                            {canEdit && <Icon icon="solar:pen-2-linear" className="text-default-400 transition-colors group-hover:text-primary" width={14} />}
                                        </button>
                                    )}
                                </td>
                                <td className="px-3 py-2.5 text-[13px] text-default-600">
                                    {isEditing ? (
                                        <div className="flex items-center gap-1">
                                            <Input
                                                size="sm"
                                                variant="bordered"
                                                classNames={{ inputWrapper: "h-8 min-h-8" }}
                                                aria-label={isEnglish ? "Note" : "หมายเหตุ"}
                                                placeholder={isEnglish ? "Optional" : "ไม่บังคับ"}
                                                value={editing.comment}
                                                onValueChange={(v) => setEditing({ ...editing, comment: v })}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") void commit();
                                                    else if (e.key === "Escape") setEditing(null);
                                                }}
                                            />
                                            <Button isIconOnly size="sm" variant="flat" color="danger" className="h-7 w-7 min-w-7" aria-label={isEnglish ? "Cancel" : "ยกเลิก"} onPress={() => setEditing(null)}>
                                                <Icon icon="solar:close-circle-bold" />
                                            </Button>
                                            <Button isIconOnly size="sm" variant="flat" color="success" className="h-7 w-7 min-w-7" aria-label={isEnglish ? "Save" : "บันทึก"} isLoading={isSaving} onPress={() => void commit()}>
                                                <Icon icon="solar:check-circle-bold" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <span className="line-clamp-2">{score?.comment || ""}</span>
                                    )}
                                </td>
                                <td className="px-3 py-2.5 text-[13px] text-default-500">
                                    {isMissing
                                        ? <span className="text-warning-700 dark:text-warning-400">{isEnglish ? "No score yet" : "ยังไม่มีคะแนน"}</span>
                                        : [score?.grader_name, score?.graded_at ? formatDateTime(score.graded_at, isEnglish) : ""].filter(Boolean).join(" ")}
                                </td>
                            </tr>
                        );
                    })}
                    {students.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-default-500">{isEnglish ? "No students found" : "ไม่พบนักศึกษา"}</td>
                        </tr>
                    )}
                </tbody>
            </table>
            {canEdit && (
                <p className="sticky bottom-0 border-t border-divider bg-content1 px-3 py-2 text-xs text-default-500">
                    {isEnglish
                        ? `Click a score to edit. Enter saves, Esc cancels. Type "${ABSENT_INPUT}" for a student who did not sit the exam: it is excluded from the average and the attended count.`
                        : `คลิกช่องคะแนนเพื่อแก้ไข กด Enter เพื่อบันทึก Esc เพื่อยกเลิก พิมพ์ "${ABSENT_INPUT}" ถ้าไม่มาสอบ จะไม่นำไปคิดค่าเฉลี่ยและไม่นับเป็นผู้เข้าสอบ`}
                </p>
            )}
        </div>
    );
}
