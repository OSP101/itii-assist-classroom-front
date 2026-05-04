"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import scoreService, { ScoreSummaryMatrix } from "@/services/score.service";
import {
    AssignmentTabType,
    ScoreDetailModal,
    ColumnDef,
    AssignmentGroup,
    toNum,
    INITIAL_SCORE_MODAL,
} from "./config";

interface UseScoreSummaryTabProps {
    courseId: string;
}

interface StudentType {
    student_id: string;
    full_name: string;
    section_number: string | number;
    total_score: number;
    total_max_score: number;
    bonus_score: number;
    scores?: Record<string, {
        score: number | null;
        max_score: number;
        sub_item_name?: string;
        graded_by?: string | null;
        graded_at?: string | null;
        updated_at?: string | null;
        comment?: string | null;
    }>;
}

export function useScoreSummaryTab({ courseId }: UseScoreSummaryTabProps) {
    // Tab & Filter state
    const [selectedTab, setSelectedTab] = useState<AssignmentTabType>("lab");
    const [selectedSection, setSelectedSection] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Hover state for table
    const [hoverRowId, setHoverRowId] = useState<string | null>(null);
    const [hoverColKey, setHoverColKey] = useState<string | null>(null);

    // Cache data for all tabs - avoid re-fetching when switching
    const [labData, setLabData] = useState<ScoreSummaryMatrix | null>(null);
    const [assignmentData, setAssignmentData] = useState<ScoreSummaryMatrix | null>(null);
    const [groupData, setGroupData] = useState<ScoreSummaryMatrix | null>(null);
    const hasFetchedRef = useRef({ lab: false, assignment: false, group: false });

    // Score detail modal
    const [scoreModal, setScoreModal] = useState<ScoreDetailModal>(INITIAL_SCORE_MODAL);

    // Get current matrix data based on selected tab
    const matrixData = selectedTab === "lab" ? labData : selectedTab === "assignment" ? assignmentData : groupData;

    // Fetch matrix data (with caching)
    const fetchMatrix = useCallback(async (type: AssignmentTabType, forceRefresh = false) => {
        // Skip if already fetched and not forcing refresh
        if (!forceRefresh && hasFetchedRef.current[type]) return;

        setIsLoading(true);
        try {
            // Map tab type to API assignment type
            const apiType = type === "lab" ? "individual" : type === "assignment" ? "assignment" : "group";
            const data = await scoreService.getScoreSummaryMatrix(courseId, {
                assignmentType: apiType,
            });
            if (type === "lab") {
                setLabData(data);
            } else if (type === "assignment") {
                setAssignmentData(data);
            } else {
                setGroupData(data);
            }
            hasFetchedRef.current[type] = true;
        } catch (error) {
            console.error("Failed to fetch score matrix:", error);
        } finally {
            setIsLoading(false);
        }
    }, [courseId]);

    // Initial fetch for current tab
    useEffect(() => {
        fetchMatrix(selectedTab);
    }, [selectedTab, fetchMatrix]);

    // Filter students by search query and section
    const filteredStudents = useMemo(() => {
        if (!matrixData?.students) return [];
        return matrixData.students.filter(student => {
            // Section filter
            if (selectedSection !== "all") {
                const sectionId = matrixData.sections?.find(s => String(s.id) === selectedSection);
                if (sectionId && student.section_number !== sectionId.section_number) {
                    return false;
                }
            }
            // Search filter
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (
                student.student_id.toLowerCase().includes(query) ||
                student.full_name.toLowerCase().includes(query)
            );
        });
    }, [matrixData?.students, matrixData?.sections, searchQuery, selectedSection]);

    // Get assignment columns
    const columns = useMemo((): ColumnDef[] => {
        if (!matrixData?.assignments) return [];

        const cols: ColumnDef[] = [];

        for (const assignment of matrixData.assignments) {
            const title = assignment.title || `งาน #${assignment.id}`;
            const shortTitle = assignment.short_title || title;

            if (assignment.subItems && assignment.subItems.length > 0) {
                for (const subItem of assignment.subItems) {
                    cols.push({
                        key: `${assignment.id}_${subItem.id}`,
                        assignmentId: assignment.id,
                        assignmentTitle: title,
                        assignmentShortTitle: shortTitle,
                        subItemId: subItem.id,
                        subItemName: subItem.name,
                        maxScore: toNum(subItem.max_score),
                    });
                }
            } else {
                cols.push({
                    key: `${assignment.id}_main`,
                    assignmentId: assignment.id,
                    assignmentTitle: title,
                    assignmentShortTitle: shortTitle,
                    maxScore: toNum(assignment.max_score),
                });
            }
        }

        return cols;
    }, [matrixData?.assignments]);

    // Group assignments for header (for colspan)
    const assignmentGroups = useMemo((): AssignmentGroup[] => {
        if (!matrixData?.assignments) return [];
        return matrixData.assignments.map(a => ({
            id: a.id,
            title: a.title || a.short_title || `งาน #${a.id}`,
            colSpan: a.subItems && a.subItems.length > 0 ? a.subItems.length : 1,
            hasSubItems: a.subItems && a.subItems.length > 0,
        }));
    }, [matrixData?.assignments]);

    // Total max score
    const totalMaxScore = useMemo(() => columns.reduce((sum, c) => sum + c.maxScore, 0), [columns]);

    // Class average
    const classAverage = useMemo(() => {
        if (totalMaxScore === 0) return 0;

        const studentsWithScores = filteredStudents.filter(s => {
            if (toNum(s.total_score) > 0) return true;
            if (s.scores) {
                return Object.values(s.scores).some(score => score?.score !== null && score?.score !== undefined);
            }
            return false;
        });

        if (studentsWithScores.length === 0) return 0;

        const total = studentsWithScores.reduce((sum, s) => sum + toNum(s.total_score), 0);
        const avgScore = total / studentsWithScores.length;
        return (avgScore / totalMaxScore) * 100;
    }, [filteredStudents, totalMaxScore]);

    // Handle score cell click
    const handleScoreClick = useCallback((
        student: StudentType,
        col: ColumnDef,
        scoreData: { score: number | null; max_score: number; sub_item_name?: string; graded_by?: string | null; graded_at?: string | null; updated_at?: string | null; comment?: string | null } | undefined
    ) => {
        setScoreModal({
            isOpen: true,
            studentName: student.full_name,
            studentId: student.student_id,
            assignmentTitle: col.assignmentTitle,
            subItemName: col.subItemName,
            score: scoreData?.score !== undefined ? toNum(scoreData.score) : null,
            maxScore: col.maxScore,
            gradedBy: scoreData?.graded_by ?? undefined,
            gradedAt: scoreData?.graded_at ?? undefined,
            updatedAt: scoreData?.updated_at ?? undefined,
            comment: scoreData?.comment ?? undefined,
        });
    }, []);

    // Close score modal
    const closeScoreModal = useCallback(() => {
        setScoreModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    // Count assignments for each tab from cache
    const labCount = labData?.assignments?.length || 0;
    const assignmentCount = assignmentData?.assignments?.length || 0;
    const groupCount = groupData?.assignments?.length || 0;

    return {
        // State
        selectedTab,
        selectedSection,
        searchQuery,
        isLoading,
        hoverRowId,
        hoverColKey,
        scoreModal,
        matrixData,

        // Computed
        filteredStudents,
        columns,
        assignmentGroups,
        totalMaxScore,
        classAverage,
        labCount,
        assignmentCount,
        groupCount,

        // Actions
        setSelectedTab,
        setSelectedSection,
        setSearchQuery,
        setHoverRowId,
        setHoverColKey,
        handleScoreClick,
        closeScoreModal,
        fetchMatrix,
    };
}

export type UseScoreSummaryTabReturn = ReturnType<typeof useScoreSummaryTab>;
