"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { CourseOverview, AssignmentTypeStats, OverviewAssignment } from "@/services/course.service";

interface UseOverviewTabProps {
    overview: CourseOverview | null;
}

export interface UseOverviewTabReturn {
    // State
    mounted: boolean;
    selectedAssignmentType: string;
    // Computed
    assignmentStatsByType: Record<string, AssignmentTypeStats>;
    availableTypes: string[];
    filteredAssignments: OverviewAssignment[];
    // Actions
    setSelectedAssignmentType: (type: string) => void;
    resetAssignmentTypeFilter: () => void;
}

/**
 * Custom hook for OverviewTab state and logic
 * Handles mounting state, assignment type filtering, and computed statistics
 */
export function useOverviewTab({ overview }: UseOverviewTabProps): UseOverviewTabReturn {
    // State
    const [mounted, setMounted] = useState(false);
    const [selectedAssignmentType, setSelectedAssignmentType] = useState<string>("all");

    // Set mounted on client
    useEffect(() => {
        setMounted(true);
    }, []);

    // Use assignment statistics from backend (or fallback to calculate from assignments)
    const assignmentStatsByType = useMemo(() => {
        // Prefer backend data if available
        if (overview?.assignmentStatsByType && Object.keys(overview.assignmentStatsByType).length > 0) {
            return overview.assignmentStatsByType;
        }
        
        // Fallback: Calculate from assignments array
        if (!overview?.assignments) return {};
        
        const stats: Record<string, AssignmentTypeStats> = {};
        
        overview.assignments.forEach(assignment => {
            const type = assignment.assignment_type || 'individual';
            if (!stats[type]) {
                stats[type] = { 
                    count: 0, 
                    totalMaxScore: 0, 
                    totalScored: 0, 
                    totalExpected: 0, 
                    progressRate: 0 
                };
            }
            stats[type].count += 1;
            stats[type].totalMaxScore += assignment.max_score;
            stats[type].totalScored += assignment.scoredCount;
            stats[type].totalExpected += assignment.scoredCount + assignment.notScoredCount;
        });
        
        // Calculate progress rate
        Object.keys(stats).forEach(type => {
            if (stats[type].totalExpected > 0) {
                stats[type].progressRate = Math.round((stats[type].totalScored / stats[type].totalExpected) * 100);
            }
        });
        
        return stats;
    }, [overview?.assignmentStatsByType, overview?.assignments]);

    // Get available assignment types for tabs
    const availableTypes = useMemo(() => {
        return Object.keys(assignmentStatsByType);
    }, [assignmentStatsByType]);

    // Filter assignments by type
    const filteredAssignments = useMemo(() => {
        if (!overview?.assignments) return [];
        if (selectedAssignmentType === "all") return overview.assignments;
        return overview.assignments.filter(a => a.assignment_type === selectedAssignmentType);
    }, [overview?.assignments, selectedAssignmentType]);

    // Reset filter action
    const resetAssignmentTypeFilter = useCallback(() => {
        setSelectedAssignmentType("all");
    }, []);

    return {
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
    };
}
