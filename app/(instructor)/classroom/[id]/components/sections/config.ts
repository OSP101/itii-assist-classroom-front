/**
 * SectionsTab Configuration
 * 
 * Contains types, interfaces, and utility functions for the SectionsTab component.
 */

import type { Course, SectionStudent, RemovedSectionStudent } from "@/services/course.service";

// ============================================
// Team Types
// ============================================

export interface TeamMember {
    id: number;
    student_id: string;
    full_name: string;
}

export interface PermanentTeam {
    id: number;
    name: string;
    members: TeamMember[];
    createdAt: string;
}

export interface WeeklyTeam {
    id: number;
    name: string;
    members: TeamMember[];
    weekNumber: number;
}

// ============================================
// Component Types
// ============================================

export type SectionSubTab = "students" | "permanent" | "weekly";
export type TeamFormationMethod = "manual" | "random";
export type TeamType = "permanent" | "weekly";

export interface SectionsTabProps {
    courseId: string;
}

// ============================================
// View Component Props (for memoized view)
// ============================================

export interface SectionsTabViewProps {
    // Data
    course: Course;
    sectionSubTab: SectionSubTab;
    sectionSearchQuery: string;
    totalStudents: number;
    permanentTeams: PermanentTeam[];
    weeklyTeams: Record<number, WeeklyTeam[]>;
    selectedWeek: number;
    totalWeeks: number;
    expandedSections: number[];
    isTeamsLoading: boolean;
    sectionStudents: Record<number, SectionStudent[]>;
    removedStudents: RemovedSectionStudent[];
    
    // Handlers
    onSubTabChange: (tab: SectionSubTab) => void;
    onSearchQueryChange: (query: string) => void;
    onWeekChange: (week: number) => void;
    onToggleSection: (sectionId: number) => void;
    onOpenAddSectionModal: () => void;
    onOpenAddStudentModal: (sectionId: number) => void;
    onRemoveSection: (sectionId: number) => void;
    onOpenDeleteStudentModal: (sectionId: number, student: SectionStudent) => void;
    onRestoreRemovedStudent: (removed: RemovedSectionStudent) => void;
    onOpenCreateTeamModal: (type: TeamType, method: TeamFormationMethod) => void;
    onOpenDeleteTeamModal: (teamId: number, type: TeamType, weekNumber?: number) => void;
    onOpenEditTeamModal: (teamId: number, type: TeamType, weekNumber?: number) => void;
    onCopyTeamsFromWeek: (sourceWeek: number) => void;
    onOpenBulkDeleteModal: () => void;
    
    // Computed functions
    getFilteredSectionStudents: (sectionId: number) => SectionStudent[];
    findStudentTeam: (studentId: number, type: TeamType, weekNumber?: number) => string | null;
}

// ============================================
// Constants
// ============================================

export const DEFAULT_TOTAL_WEEKS = 15;

// ============================================
// Utility Functions
// ============================================

/**
 * Sort teams naturally by name (numeric order)
 */
export function naturalSortTeams<T extends { name: string; id: number }>(a: T, b: T): number {
    const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
    if (numA && numB) return numA - numB;
    return a.id - b.id;
}

/**
 * Filter students by search query
 */
export function filterStudentsByQuery(
    students: SectionStudent[],
    query: string
): SectionStudent[] {
    if (!query.trim()) return students;
    const lowerQuery = query.toLowerCase();
    return students.filter(s =>
        s.student_id.toLowerCase().includes(lowerQuery) ||
        s.full_name.toLowerCase().includes(lowerQuery)
    );
}

/**
 * Calculate total students from course sections
 */
export function calculateTotalStudents(course: Course | null): number {
    return course?.sections?.reduce((acc, section) => acc + (section.studentCount || 0), 0) || 0;
}

/**
 * Check if any week has teams
 */
export function hasAnyWeeklyTeams(weeklyTeams: Record<number, WeeklyTeam[]>): boolean {
    return Object.keys(weeklyTeams).some(k => weeklyTeams[parseInt(k)]?.length > 0);
}

/**
 * Get weeks with teams (excluding current week)
 */
export function getWeeksWithTeams(
    weeklyTeams: Record<number, WeeklyTeam[]>,
    excludeWeek: number,
    totalWeeks: number
): number[] {
    return Array.from({ length: totalWeeks }, (_, i) => i + 1)
        .filter(week => week !== excludeWeek && weeklyTeams[week]?.length > 0);
}
