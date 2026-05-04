// Types
export type AssignmentTabType = "lab" | "assignment" | "group";

export interface ScoreDetailModal {
    isOpen: boolean;
    studentName: string;
    studentId: string;
    assignmentTitle: string;
    subItemName?: string;
    score: number | null;
    maxScore: number;
    gradedBy?: string;
    gradedAt?: string;
    updatedAt?: string;
    comment?: string;
}

export interface ColumnDef {
    key: string;
    assignmentId: number;
    assignmentTitle: string;
    assignmentShortTitle: string;
    subItemId?: number;
    subItemName?: string;
    maxScore: number;
}

export interface AssignmentGroup {
    id: number;
    title: string;
    colSpan: number;
    hasSubItems: boolean;
}

// Helper: safely parse to number
export const toNum = (val: unknown): number => {
    if (val === null || val === undefined) return 0;
    const n = typeof val === 'string' ? parseFloat(val) : Number(val);
    return isNaN(n) ? 0 : n;
};

// Helper: format score display
export const fmtScore = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return "-";
    const n = toNum(score);
    return Number.isInteger(n) ? n.toString() : n.toFixed(1);
};

// Helper: format date
export const formatDate = (dateStr?: string): string => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

// Get score color based on percentage
export const getScoreColor = (score: number | null, max: number) => {
    if (score === null) return { bg: "bg-slate-50", text: "text-slate-400", border: "border-slate-200" };
    if (max === 0) return { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
    const pct = (score / max) * 100;
    if (pct >= 80) return { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" };
    if (pct >= 60) return { bg: "bg-sky-50", text: "text-sky-600", border: "border-sky-200" };
    if (pct >= 40) return { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" };
    if (pct > 0) return { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" };
    return { bg: "bg-red-50", text: "text-red-500", border: "border-red-200" };
};

// Initial modal state
export const INITIAL_SCORE_MODAL: ScoreDetailModal = {
    isOpen: false,
    studentName: "",
    studentId: "",
    assignmentTitle: "",
    score: null,
    maxScore: 0,
};
