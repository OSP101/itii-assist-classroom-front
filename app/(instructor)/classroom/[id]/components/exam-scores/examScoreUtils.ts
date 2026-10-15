import {
    type ExamScore,
    type ExamScoreWithSetting,
    type Student,
    type ExamLifecycleStage,
    getComponentLabel,
    getExamTypeLabel,
} from "@/services/examScore.service";
import { formatScoreValue } from "@/lib/score-input";

export function formatDateTime(value: string | null | undefined, isEnglish: boolean): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString(isEnglish ? "en-GB" : "th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatScore(value: number | null | undefined): string {
    if (value === null || value === undefined) return "";
    const numeric = typeof value === "string" ? parseFloat(value) : value;
    if (!Number.isFinite(numeric)) return "";
    return formatScoreValue(numeric);
}

/** What goes in the score cell: "" (missing), "-" (absent) or the number. */
export function scoreCellValue(score: ExamScore | undefined): string {
    if (!score) return "";
    if (score.is_absent) return "-";
    return formatScore(score.score);
}

export function hasResult(score: ExamScore | undefined): boolean {
    return !!score && (score.is_absent || (score.score !== null && score.score !== undefined));
}

export interface SettingSummary {
    total: number;
    scored: number;
    absent: number;
    missing: number;
    average: number | null;
    max: number | null;
    min: number | null;
}

/**
 * Attended / absent / missing split. Only students with a numeric score
 * enter the average, max and min: an absent "-" never moves the statistics.
 */
export function summarizeSetting(students: Student[], scores: Record<number, ExamScore> | undefined): SettingSummary {
    const summary: SettingSummary = { total: students.length, scored: 0, absent: 0, missing: 0, average: null, max: null, min: null };
    let sum = 0;
    for (const student of students) {
        const score = scores?.[student.id];
        if (score?.is_absent) {
            summary.absent++;
            continue;
        }
        const raw = score?.score;
        const numeric = raw === null || raw === undefined ? NaN : (typeof raw === "string" ? parseFloat(raw) : raw);
        if (!Number.isFinite(numeric)) {
            summary.missing++;
            continue;
        }
        summary.scored++;
        sum += numeric;
        summary.max = summary.max === null ? numeric : Math.max(summary.max, numeric);
        summary.min = summary.min === null ? numeric : Math.min(summary.min, numeric);
    }
    if (summary.scored > 0) {
        summary.average = Math.round((sum / summary.scored) * 100) / 100;
    }
    return summary;
}

export function examTypeTitle(setting: Pick<ExamScoreWithSetting, "exam_type">, isEnglish: boolean): string {
    return isEnglish ? `${getExamTypeLabel(setting.exam_type, true)} exam` : `สอบ${getExamTypeLabel(setting.exam_type)}`;
}

export function componentTitle(setting: Pick<ExamScoreWithSetting, "component">, isEnglish: boolean): string {
    if (isEnglish) return `${getComponentLabel(setting.component, true)} component`;
    return setting.component === "lab" ? "ปฏิบัติการ (Lab)" : "บรรยาย (Lecture)";
}

export function shortExamName(setting: Pick<ExamScoreWithSetting, "exam_type" | "component">, isEnglish: boolean): string {
    return `${getExamTypeLabel(setting.exam_type, isEnglish)} ${getComponentLabel(setting.component, isEnglish)}`;
}

export function stageLabel(stage: ExamLifecycleStage, isEnglish: boolean): string {
    switch (stage) {
        case "published":
            return isEnglish ? "Published" : "ประกาศแล้ว";
        case "scheduled":
            return isEnglish ? "Scheduled" : "ตั้งเวลาแล้ว";
        case "draft":
            return isEnglish ? "Draft" : "ร่าง";
        default:
            return isEnglish ? "Not enabled" : "ยังไม่เปิดใช้";
    }
}

export const HIDE_REASONS = [
    { key: "mistake", th: "พบคะแนนผิดพลาด ต้องแก้ไขก่อน", en: "Found a scoring mistake, needs correction" },
    { key: "wrong_item", th: "ประกาศผิดรายการ", en: "Published the wrong exam" },
    { key: "pending_review", th: "รอตรวจเพิ่มเติม", en: "Waiting for further review" },
    { key: "other", th: "อื่น ๆ", en: "Other" },
] as const;
