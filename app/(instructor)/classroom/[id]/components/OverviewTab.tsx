"use client";

import type { Course, CourseOverview } from "@/services/course.service";
import type { AssignmentType } from "./types";
import { useOverviewTab, OverviewTabView } from "./overview";

interface OverviewTabProps {
    course: Course;
    overview: CourseOverview | null;
    isLoading: boolean;
    userRole: string;
    assignments: AssignmentType[];
    onNavigateToAssignments: () => void;
}

/**
 * OverviewTab Container Component
 * 
 * This is a container component that:
 * 1. Uses the useOverviewTab hook to manage all state and business logic
 * 2. Passes data and handlers to the memoized OverviewTabView component
 * 
 * Benefits:
 * - Separation of concerns (logic vs presentation)
 * - Easier testing (can test hook and view separately)
 * - Reduced re-renders through React.memo in OverviewTabView
 */
export default function OverviewTab({
    course,
    overview,
    isLoading,
    userRole,
    assignments,
    onNavigateToAssignments,
}: OverviewTabProps) {
    const {
        // State
        mounted,
        selectedAssignmentType,
        // Computed
        assignmentStatsByType,
        availableTypes,
        filteredAssignments,
        // Actions
        setSelectedAssignmentType,
        resetAssignmentTypeFilter,
    } = useOverviewTab({ overview });

    return (
        <OverviewTabView
            course={course}
            overview={overview}
            isLoading={isLoading}
            userRole={userRole}
            assignments={assignments}
            mounted={mounted}
            selectedAssignmentType={selectedAssignmentType}
            assignmentStatsByType={assignmentStatsByType}
            availableTypes={availableTypes}
            filteredAssignments={filteredAssignments}
            onNavigateToAssignments={onNavigateToAssignments}
            onSetSelectedAssignmentType={setSelectedAssignmentType}
            onResetAssignmentTypeFilter={resetAssignmentTypeFilter}
        />
    );
}
