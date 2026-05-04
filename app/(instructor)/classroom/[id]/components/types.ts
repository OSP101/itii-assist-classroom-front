// Types for Classroom Detail Page
import type { Assignment as AssignmentType, AssignmentSubItem } from "@/services/assignment.service";
import type { Course, TA, SectionStudent, CourseOverview, Team, TeamMember as ServiceTeamMember } from "@/services/course.service";
import type { Student } from "@/services/student.service";
import type { StudentScore, ScoresData, Group } from "@/services/score.service";

// Re-export service types
export type { AssignmentType, AssignmentSubItem, Course, TA, SectionStudent, CourseOverview, Team, Student, StudentScore, ScoresData, Group };

// Team/Group Types (local extension of service types)
export interface TeamMember {
    id: number;
    student_id: string;
    full_name: string;
    first_name?: string;
    last_name?: string;
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

export interface LocalSubItem {
    id?: number;
    name: string;
    max_score: number;
}

export interface NewAssignment {
    name: string;
    assignment_type: "individual" | "permanent_group" | "weekly_group" | "assignment";
    week_number?: number;
    hasSubItems: boolean;
    subItems: LocalSubItem[];
    maxScore: number;
    dueDate: string;
    description: string;
}

export interface DeleteTarget {
    // For student deletion
    studentId?: number;
    studentName?: string;
    studentCode?: string;
    sectionId?: number;
    sectionNo?: string;
    // For team deletion
    teamId?: number;
    teamName?: string;
    teamType?: "permanent" | "weekly";
    weekNumber?: number;
    teamMembers?: TeamMember[];
}

export interface ParsedStudent {
    inputValue: string;
    matchedStudent: Student | null;
    status: "matched" | "not_found" | "already_enrolled";
}

export interface ParsedTeamMember {
    inputValue: string;
    matchedStudent: TeamMember | null;
    status: "matched" | "not_found" | "already_in_team";
}

// Menu item type for sidebar
export interface MenuItem {
    key: string;
    label: string;
    icon: string;
    badge?: number;
}
