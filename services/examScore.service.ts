/**
 * Exam Score Service - API calls for Exam Score Management
 * คะแนนสอบกลางภาคและปลายภาค
 *
 * แบบ B: ทุกรายการเริ่มเป็นร่าง → ตรวจทาน → ประกาศ การประกาศ/ซ่อน
 * เป็น endpoint แยกจากการตั้งค่าคะแนนเต็ม จะได้ไม่เผลอเปิดให้นักศึกษาเห็น
 */

import { apiService } from './api.service';

// Types
export interface ExamSetting {
    id: number;
    course_id: string;
    exam_type: 'midterm' | 'final';
    component: 'lecture' | 'lab';
    max_score: number;
    is_active: boolean;
    is_visible: boolean;
    published_at?: string | null;
    published_by?: number | null;
    hidden_at?: string | null;
    hidden_by?: number | null;
    hide_reason?: string;
    scheduled_publish_at?: string | null;
    scheduled_by?: number | null;
    show_average?: boolean;
    show_comments?: boolean;
    notify_by_email?: boolean;
    created_at: string;
    updated_at: string;
}

export interface ExamPublishMeta {
    published_at: string | null;
    published_by_name: string | null;
    hidden_at: string | null;
    hidden_by_name: string | null;
    hide_reason: string;
    scheduled_publish_at: string | null;
    scheduled_by_name: string | null;
    show_average: boolean;
    show_comments: boolean;
    notify_by_email: boolean;
    viewed_count: number;
    last_graded_at: string | null;
    last_graded_by_name: string | null;
}

export interface Student {
    id: number;
    student_id: string;
    full_name: string;
    section_no: string;
}

export interface ExamScore {
    id: number;
    exam_setting_id: number;
    student_id: number;
    score: number | null;
    is_absent: boolean;
    comment: string;
    grader_id: number | null;
    grader_name?: string | null;
    graded_at?: string | null;
    created_at?: string;
    updated_at?: string;
    student?: Student;
}

export interface ExamScoreWithSetting extends ExamPublishMeta {
    id: number;
    exam_type: 'midterm' | 'final';
    component: 'lecture' | 'lab';
    max_score: number;
    is_active: boolean;
    is_visible: boolean;
    scores?: ExamScore[];
}

export interface SaveScoreDto {
    exam_setting_id: number;
    student_id: number;
    score: number | null;
    is_absent?: boolean;
    comment?: string;
}

export interface BulkSaveDto {
    exam_setting_id: number;
    scores: Array<{
        student_id: string;
        score: number | null;
        is_absent?: boolean;
    }>;
}

export interface BulkSaveResult {
    success: boolean;
    message: string;
    saved: number;
    errors: Array<{
        student_id: string;
        reason: string;
    }>;
}

export interface ExamReviewStudent {
    id: number;
    student_id: string;
    full_name: string;
    score: number | null;
    is_absent: boolean;
    comment: string;
}

export interface ExamReviewBucket {
    label: string;
    from: number;
    to: number;
    count: number;
}

export interface ExamSettingReview {
    setting: ExamSetting;
    meta: ExamPublishMeta;
    total_students: number;
    scored_count: number;
    absent_count: number;
    missing_count: number;
    comment_count: number;
    invalid_count: number;
    emailable_count: number;
    average: number | null;
    max: number | null;
    min: number | null;
    below_half_count: number;
    distribution: ExamReviewBucket[];
    missing: ExamReviewStudent[];
    absent: ExamReviewStudent[];
    invalid: ExamReviewStudent[];
    preview: ExamReviewStudent | null;
}

export interface PublishExamDto {
    send_email: boolean;
    show_average: boolean;
    show_comments: boolean;
    scheduled_at?: string | null;
    confirmed: boolean;
}

export interface HideExamDto {
    reason: string;
    notify_viewers: boolean;
}

export interface ExamViewerRow {
    student_id: number;
    student_code: string;
    full_name: string;
    email: string;
    score: number | null;
    is_absent: boolean;
    has_result: boolean;
    first_viewed_at: string | null;
    last_viewed_at: string | null;
    view_count: number;
    notification_kind: string;
    notification_sent_at: string | null;
    notification_error: string;
}

export interface ExamViewersSummary {
    setting: ExamSetting;
    meta: ExamPublishMeta;
    total_students: number;
    viewed_count: number;
    unviewed_count: number;
    viewed_within_24h: number;
    email_sent: number;
    email_failed: number;
    rows: ExamViewerRow[];
}

export interface ExamPublishHistoryEntry {
    id: number;
    action: string;
    actor_user_id: number;
    actor_name: string;
    exam_setting_id: number;
    exam_type: 'midterm' | 'final' | '';
    component: 'lecture' | 'lab' | '';
    detail: Record<string, unknown> | null;
    created_at: string;
}

// Helper functions
export const getExamTypeLabel = (type: 'midterm' | 'final', isEnglish = false): string => {
    if (isEnglish) {
        return type === 'midterm' ? 'Midterm' : 'Final';
    }
    return type === 'midterm' ? 'กลางภาค' : 'ปลายภาค';
};

export const getComponentLabel = (component: 'lecture' | 'lab', isEnglish = false): string => {
    if (isEnglish) {
        return component === 'lecture' ? 'Lecture' : 'Lab';
    }
    return component === 'lecture' ? 'บรรยาย' : 'ปฏิบัติการ';
};

export const getExamName = (setting: Pick<ExamSetting, 'exam_type' | 'component'>, isEnglish = false): string => {
    if (isEnglish) {
        return `${getExamTypeLabel(setting.exam_type, true)} (${getComponentLabel(setting.component, true)})`;
    }
    return `สอบ${getExamTypeLabel(setting.exam_type)} (${getComponentLabel(setting.component)})`;
};

/** "-" in a score column means the student did not sit the exam. */
export const ABSENT_INPUT = '-';

export const isAbsentInput = (value: string): boolean => value.trim() === ABSENT_INPUT;

export const parseExcelData = (data: string): Array<{ studentId: string; score: string }> => {
    const lines = data.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
        const parts = line.split(/[\t,]/).map(p => p.trim());
        return {
            studentId: parts[0] || '',
            score: parts[1] || '',
        };
    });
};

export type ExamLifecycleStage = 'inactive' | 'draft' | 'scheduled' | 'published';

/** Which step of ร่าง → ตรวจทาน → ประกาศแล้ว a setting is on. */
export const getExamLifecycleStage = (setting: Pick<ExamScoreWithSetting, 'is_active' | 'is_visible' | 'scheduled_publish_at'>): ExamLifecycleStage => {
    if (!setting.is_active) return 'inactive';
    if (setting.is_visible) return 'published';
    if (setting.scheduled_publish_at) return 'scheduled';
    return 'draft';
};

// Exam Score Service
const examScoreService = {
    /**
     * Get exam settings for a course
     */
    async getExamSettings(courseId: string): Promise<ExamSetting[]> {
        const response = await apiService.get<ExamSetting[]>(`/courses/${courseId}/exam-settings`);
        return response.data || [];
    },

    /**
     * Get exam scores for a course (with students)
     */
    async getExamScores(courseId: string): Promise<{
        students: Student[];
        settings: ExamScoreWithSetting[];
    }> {
        const response = await apiService.get<{
            students: Student[];
            settings: ExamScoreWithSetting[];
        }>(`/courses/${courseId}/exam-scores`);
        return response.data || { students: [], settings: [] };
    },

    /**
     * Save a single exam score. Pass is_absent=true (score null) for "-".
     */
    async saveExamScore(courseId: string, data: SaveScoreDto): Promise<ExamScore> {
        const response = await apiService.post<ExamScore>(`/courses/${courseId}/exam-scores`, data);
        return response.data!;
    },

    /**
     * Bulk save exam scores (from Excel import)
     */
    async bulkSaveExamScores(courseId: string, data: BulkSaveDto): Promise<BulkSaveResult> {
        const response = await apiService.post<{ saved: number; errors: Array<{ student_id: string; reason: string }> }>(`/courses/${courseId}/exam-scores/bulk`, data);
        return {
            success: response.success,
            message: response.message || 'บันทึกสำเร็จ',
            saved: response.data?.saved ?? 0,
            errors: response.data?.errors ?? [],
        };
    },

    /**
     * Update exam setting (max_score, is_active). Visibility is NOT settable
     * here any more; use publish/hide.
     */
    async updateExamSetting(courseId: string, settingId: number, data: { max_score?: number; is_active?: boolean }): Promise<ExamSetting> {
        const response = await apiService.put<ExamSetting>(`/courses/${courseId}/exam-settings/${settingId}`, data);
        return response.data!;
    },

    /** Pre-publish review: counts, distribution, missing/absent lists, student preview. */
    async getReview(courseId: string, settingId: number): Promise<ExamSettingReview> {
        const response = await apiService.get<ExamSettingReview>(`/courses/${courseId}/exam-settings/${settingId}/review`);
        return response.data!;
    },

    /** Publish now, or schedule when scheduled_at is set. */
    async publish(courseId: string, settingId: number, data: PublishExamDto): Promise<{ setting: ExamSetting; message: string }> {
        const response = await apiService.post<ExamSetting>(`/courses/${courseId}/exam-settings/${settingId}/publish`, data);
        return { setting: response.data!, message: response.message || '' };
    },

    /** Hide published scores (or cancel a pending schedule). */
    async hide(courseId: string, settingId: number, data: HideExamDto): Promise<{ setting: ExamSetting; message: string }> {
        const response = await apiService.post<ExamSetting>(`/courses/${courseId}/exam-settings/${settingId}/hide`, data);
        return { setting: response.data!, message: response.message || '' };
    },

    async getViewers(courseId: string, settingId: number): Promise<ExamViewersSummary> {
        const response = await apiService.get<ExamViewersSummary>(`/courses/${courseId}/exam-settings/${settingId}/viewers`);
        return response.data!;
    },

    /** Email everyone who has a result but has not opened it. */
    async remindUnviewed(courseId: string, settingId: number): Promise<{ count: number; message: string }> {
        const response = await apiService.post<{ count: number }>(`/courses/${courseId}/exam-settings/${settingId}/remind`, {});
        return { count: response.data?.count ?? 0, message: response.message || '' };
    },

    async getPublishHistory(courseId: string): Promise<ExamPublishHistoryEntry[]> {
        const response = await apiService.get<ExamPublishHistoryEntry[]>(`/courses/${courseId}/exam-settings/history`);
        return response.data || [];
    },
};

export default examScoreService;
