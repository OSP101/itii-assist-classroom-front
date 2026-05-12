/**
 * Exam Score Service - API calls for Exam Score Management
 * คะแนนสอบกลางภาคและปลายภาค
 */

import { apiService } from './api.service';

// Types
export interface ExamSetting {
    id: number;
    course_id: number;
    exam_type: 'midterm' | 'final';
    component: 'lecture' | 'lab';
    max_score: number;
    is_active: boolean;
    is_visible: boolean;
    created_at: string;
    updated_at: string;
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
    grader_id: number | null;
    grader_name?: string;
    created_at: string;
    updated_at: string;
    student?: Student;
}

export interface ExamScoreWithSetting extends ExamSetting {
    scores?: ExamScore[];
}

export interface SaveScoreDto {
    exam_setting_id: number;
    student_id: number;
    score: number | null;
}

export interface BulkSaveDto {
    exam_setting_id: number;
    scores: Array<{
        student_id: string;
        score: number | null;
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

export const getExamName = (setting: ExamSetting, isEnglish = false): string => {
    if (isEnglish) {
        return `${getExamTypeLabel(setting.exam_type, true)} (${getComponentLabel(setting.component, true)})`;
    }
    return `สอบ${getExamTypeLabel(setting.exam_type)} (${getComponentLabel(setting.component)})`;
};

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
     * Save a single exam score
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
     * Update exam setting (max_score, is_active, is_visible)
     */
    async updateExamSetting(courseId: string, settingId: number, data: Partial<ExamSetting>): Promise<ExamSetting> {
        const response = await apiService.put<ExamSetting>(`/courses/${courseId}/exam-settings/${settingId}`, data);
        return response.data!;
    },
};

export default examScoreService;
