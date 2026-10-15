"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import examScoreService, { type ExamScoreWithSetting, type Student, isAbsentInput } from "@/services/examScore.service";
import { formatScore, shortExamName } from "./examScoreUtils";

type RowStatus = "valid" | "absent" | "not_found" | "score_exceeds" | "invalid_score" | "negative_score";

interface ParsedRow {
    inputStudentId: string;
    inputScore: string;
    status: RowStatus;
    matchedStudent?: Student;
    parsedScore: number | null;
}

interface ExamBulkImportModalProps {
    courseId: string;
    setting: ExamScoreWithSetting | null;
    students: Student[];
    isOpen: boolean;
    isEnglish: boolean;
    onClose: () => void;
    onImported: () => Promise<void> | void;
}

function statusText(status: RowStatus, isEnglish: boolean, maxScore: number): string {
    switch (status) {
        case "valid": return isEnglish ? "Valid" : "ถูกต้อง";
        case "absent": return isEnglish ? "Absent" : "ไม่มาสอบ";
        case "not_found": return isEnglish ? "Student not found" : "ไม่พบนักศึกษา";
        case "score_exceeds": return isEnglish ? `Exceeds max score (${formatScore(maxScore)})` : `เกินคะแนนเต็ม (${formatScore(maxScore)})`;
        case "invalid_score": return isEnglish ? "Invalid score" : "คะแนนไม่ถูกต้อง";
        case "negative_score": return isEnglish ? "Score cannot be negative" : "คะแนนต้องไม่ติดลบ";
    }
}

/**
 * Paste two columns from Excel: student ID and score. A "-" in the score
 * column marks the student absent (stored separately, never averaged).
 */
export default function ExamBulkImportModal({ courseId, setting, students, isOpen, isEnglish, onClose, onImported }: ExamBulkImportModalProps) {
    const [raw, setRaw] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) setRaw("");
    }, [isOpen]);

    const parsed = useMemo<ParsedRow[]>(() => {
        if (!setting || !raw.trim()) return [];
        const maxScore = setting.max_score;
        const byCode = new Map<string, Student>();
        students.forEach((s) => byCode.set(s.student_id.toLowerCase(), s));
        const rows: ParsedRow[] = [];
        for (const line of raw.split(/\r?\n/)) {
            if (!line.trim()) continue;
            const parts = line.split(/[\t,]/).map((p) => p.trim());
            if (parts.length < 2) continue;
            const [inputStudentId, inputScore] = parts;
            const matchedStudent = byCode.get(inputStudentId.toLowerCase());
            let status: RowStatus = "valid";
            let parsedScore: number | null = null;
            if (!matchedStudent) {
                status = "not_found";
            } else if (isAbsentInput(inputScore)) {
                status = "absent";
            } else if (inputScore === "") {
                status = "invalid_score";
            } else {
                const n = parseFloat(inputScore);
                if (!Number.isFinite(n)) status = "invalid_score";
                else if (n < 0) status = "negative_score";
                else if (n > maxScore) status = "score_exceeds";
                else parsedScore = n;
            }
            rows.push({ inputStudentId, inputScore, status, matchedStudent, parsedScore });
        }
        return rows;
    }, [raw, setting, students]);

    const counts = useMemo(() => ({
        valid: parsed.filter((p) => p.status === "valid").length,
        absent: parsed.filter((p) => p.status === "absent").length,
        notFound: parsed.filter((p) => p.status === "not_found").length,
        exceeds: parsed.filter((p) => p.status === "score_exceeds").length,
        invalid: parsed.filter((p) => p.status === "invalid_score" || p.status === "negative_score").length,
    }), [parsed]);

    const importable = parsed.filter((p) => (p.status === "valid" || p.status === "absent") && p.matchedStudent);

    const handleImport = async () => {
        if (!setting || importable.length === 0) return;
        setIsSaving(true);
        try {
            const result = await examScoreService.bulkSaveExamScores(courseId, {
                exam_setting_id: setting.id,
                scores: importable.map((row) => ({
                    student_id: row.inputStudentId,
                    score: row.status === "absent" ? null : row.parsedScore,
                    is_absent: row.status === "absent",
                })),
            });
            addToast({
                title: isEnglish ? "Import complete" : "นำเข้าสำเร็จ",
                description: isEnglish ? `Saved ${result.saved} rows.` : (result.message || `บันทึกคะแนน ${result.saved} รายการ`),
                color: "success",
                timeout: 3000,
            });
            if (result.errors.length > 0) {
                addToast({ title: isEnglish ? "Some rows failed" : "บางรายการไม่สำเร็จ", description: isEnglish ? `${result.errors.length} rows were not saved.` : `มี ${result.errors.length} รายการที่ไม่ได้บันทึก`, color: "warning", timeout: 4000 });
            }
            await onImported();
            onClose();
        } catch (error: any) {
            addToast({ title: isEnglish ? "Unable to import scores" : (error?.response?.data?.message || "นำเข้าไม่สำเร็จ"), color: "danger", timeout: 3000 });
        } finally {
            setIsSaving(false);
        }
    };

    const statusIcon = (status: RowStatus) => {
        switch (status) {
            case "valid": return { icon: "solar:check-circle-bold", cls: "text-success" };
            case "absent": return { icon: "solar:user-minus-bold", cls: "text-default-500" };
            case "not_found": return { icon: "solar:user-cross-bold", cls: "text-danger" };
            case "score_exceeds": return { icon: "solar:danger-triangle-bold", cls: "text-warning" };
            default: return { icon: "solar:close-circle-bold", cls: "text-danger" };
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary dark:bg-primary-500/20">
                        <Icon icon="solar:import-bold" width={22} />
                    </span>
                    <div>
                        <h3 className="text-lg font-semibold">{isEnglish ? "Import scores from Excel" : "นำเข้าคะแนนจาก Excel"}</h3>
                        <p className="text-sm font-normal text-default-500">{setting ? shortExamName(setting, isEnglish) : ""}{setting ? ` ${isEnglish ? "max" : "เต็ม"} ${formatScore(setting.max_score)}` : ""}</p>
                    </div>
                </ModalHeader>
                <ModalBody className="gap-4">
                    <div className="rounded-xl border border-default-200 bg-content2 p-4 text-sm">
                        <p className="mb-2 font-medium text-default-700">{isEnglish ? "Copy two columns from Excel and paste below" : "คัดลอก 2 คอลัมน์จาก Excel แล้ววางด้านล่าง"}</p>
                        <div className="mb-2 flex flex-wrap gap-2">
                            <Chip size="sm" variant="flat" color="primary">{isEnglish ? "Column A: Student ID" : "คอลัมน์ A: รหัสนักศึกษา"}</Chip>
                            <Chip size="sm" variant="flat" color="success">{isEnglish ? "Column B: Score" : "คอลัมน์ B: คะแนน"}</Chip>
                        </div>
                        <p className="text-xs text-default-500">
                            {isEnglish
                                ? 'Put "-" in the score column for a student who did not sit the exam. Absent students are stored separately and never enter the average or the attended count.'
                                : 'ใส่ "-" ในช่องคะแนนสำหรับคนที่ไม่มาสอบ ระบบจะบันทึกเป็นไม่มาสอบ ไม่นำไปคิดค่าเฉลี่ยและไม่นับเป็นผู้เข้าสอบ'}
                        </p>
                    </div>
                    <textarea
                        className="h-40 w-full resize-none rounded-xl border border-default-200 bg-content1 p-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder={isEnglish ? "650705010-1\t85\n650705011-9\t-" : "650705010-1\t85\n650705011-9\t-"}
                        aria-label={isEnglish ? "Pasted score data" : "ข้อมูลคะแนนที่วาง"}
                        value={raw}
                        onChange={(e) => setRaw(e.target.value)}
                    />
                    {parsed.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <Chip size="sm" color="success" variant="flat">{isEnglish ? `Valid ${counts.valid}` : `ถูกต้อง ${counts.valid}`}</Chip>
                                <Chip size="sm" variant="flat">{isEnglish ? `Absent ${counts.absent}` : `ไม่มาสอบ ${counts.absent}`}</Chip>
                                {counts.notFound > 0 && <Chip size="sm" color="danger" variant="flat">{isEnglish ? `Not found ${counts.notFound}` : `ไม่พบรหัส ${counts.notFound}`}</Chip>}
                                {counts.exceeds > 0 && <Chip size="sm" color="warning" variant="flat">{isEnglish ? `Exceeds max ${counts.exceeds}` : `คะแนนเกิน ${counts.exceeds}`}</Chip>}
                                {counts.invalid > 0 && <Chip size="sm" color="danger" variant="flat">{isEnglish ? `Invalid ${counts.invalid}` : `ไม่ถูกต้อง ${counts.invalid}`}</Chip>}
                            </div>
                            <div className="max-h-64 divide-y divide-divider overflow-y-auto rounded-xl border border-default-200">
                                {parsed.map((row, index) => {
                                    const { icon, cls } = statusIcon(row.status);
                                    return (
                                        <div key={index} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                            <div className="flex items-center gap-3">
                                                <Icon icon={icon} className={`text-lg ${cls}`} />
                                                <span className="font-mono">{row.inputStudentId}</span>
                                                <span className="font-mono text-default-500">{row.inputScore || "-"}</span>
                                            </div>
                                            <div className="text-right text-xs">
                                                {row.matchedStudent && (row.status === "valid" || row.status === "absent")
                                                    ? <span className="text-default-600">{row.matchedStudent.full_name}{row.status === "absent" ? ` (${statusText(row.status, isEnglish, setting?.max_score ?? 0)})` : ""}</span>
                                                    : <span className={row.status === "score_exceeds" ? "text-warning-700 dark:text-warning-400" : "text-danger"}>{statusText(row.status, isEnglish, setting?.max_score ?? 0)}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="bordered" onPress={onClose} isDisabled={isSaving}>{isEnglish ? "Cancel" : "ยกเลิก"}</Button>
                    <Button color="primary" className="font-semibold" onPress={() => void handleImport()} isLoading={isSaving} isDisabled={importable.length === 0}>
                        {isEnglish ? `Import ${importable.length} rows` : `นำเข้า ${importable.length} รายการ`}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
