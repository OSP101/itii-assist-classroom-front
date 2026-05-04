/**
 * Bonus Score Service - API calls for Bonus Score Management
 * คะแนนพิเศษจากการถามตอบในห้องเรียน
 */

import { apiService } from './api.service';

// Types
export interface BonusScoreRecord {
    id: number;
    score: number;
    reason: string;
    giver: {
        id: number;
        full_name: string;
    };
    given_at: string;
}

export interface StudentWithBonus {
    id: number;
    student_id: string;
    full_name: string;
    section_no: string;
    totalBonus: number;
}

export interface StudentBonusData {
    student: {
        id: number;
        student_id: string;
        full_name: string;
    };
    totalScore: number;
    records: BonusScoreRecord[];
}

export interface BonusScoreSummary {
    totalGiven: number;
    totalRecords: number;
    uniqueStudents: number;
    topStudents: {
        student_id: string;
        full_name: string;
        total: number;
    }[];
}

export interface GiveBonusScoreDto {
    course_id: string;
    student_id: number;
    score?: number;
    reason?: string;
}

// API Response type matching api.service.ts
interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
}

// Bonus Score Service
export const bonusScoreService = {
    /**
     * Give bonus score to a student
     */
    async giveBonusScore(data: GiveBonusScoreDto): Promise<ApiResponse<{
        bonusScore: BonusScoreRecord;
        totalBonus: number;
    }>> {
        return apiService.post('/bonus-scores', data);
    },

    /**
     * Get all enrolled students for bonus score selection
     */
    async getEnrolledStudents(courseId: string): Promise<ApiResponse<{
        students: StudentWithBonus[];
    }>> {
        return apiService.get(`/bonus-scores/course/${courseId}/students`);
    },

    /**
     * Get all bonus scores for a course (grouped by student)
     */
    async getBonusScoresByCourse(courseId: string): Promise<ApiResponse<{
        studentBonusScores: StudentBonusData[];
        totalRecords: number;
    }>> {
        return apiService.get(`/bonus-scores/course/${courseId}`);
    },

    /**
     * Get bonus score summary for a course
     */
    async getBonusScoreSummary(courseId: string): Promise<ApiResponse<BonusScoreSummary>> {
        return apiService.get(`/bonus-scores/course/${courseId}/summary`);
    },

    /**
     * Get bonus score history for specific student in a course
     */
    async getStudentBonusHistory(courseId: string, studentId: number): Promise<ApiResponse<{
        records: BonusScoreRecord[];
        totalScore: number;
    }>> {
        return apiService.get(`/bonus-scores/course/${courseId}/student/${studentId}`);
    },

    /**
     * Delete a bonus score record
     */
    async deleteBonusScore(id: number): Promise<ApiResponse<null>> {
        return apiService.delete(`/bonus-scores/${id}`);
    },
};

export default bonusScoreService;
