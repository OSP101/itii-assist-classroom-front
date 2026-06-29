"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
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
    group_id?: number | null;
    group_name?: string | null;
    weekly_group_ids?: Record<string, number>;
    weekly_group_names?: Record<string, string>;
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
        group_id?: number | null;
        group_name?: string | null;
        edit_requests?: {
            old_score: number | null;
            new_score: number;
            reason: string | null;
            requester: string | null;
            reviewer: string | null;
            reviewed_at: string | null;
            review_comment: string | null;
        }[];
    }>;
}

function getDisplayedStudentTotal(student: StudentType, columns: ColumnDef[]): number {
    return columns.reduce((sum, col) => {
        const score = student.scores?.[col.key]?.score;
        return sum + (score === null || score === undefined ? 0 : toNum(score));
    }, 0);
}

function compareOptionalGroupNames(aName: string | undefined, bName: string | undefined, isEnglish: boolean): number {
    const normalizedA = aName?.trim() ?? "";
    const normalizedB = bName?.trim() ?? "";

    if (!normalizedA && !normalizedB) return 0;
    if (!normalizedA) return 1;
    if (!normalizedB) return -1;

    const collator = new Intl.Collator(isEnglish ? ["en", "th"] : ["th", "en"], {
        sensitivity: "base",
        numeric: true,
    });

    return collator.compare(normalizedA, normalizedB);
}

export function useScoreSummaryTab({ courseId }: UseScoreSummaryTabProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    // Tab & Filter state
    const [selectedTab, setSelectedTab] = useState<AssignmentTabType>("lab");
    const [selectedSection, setSelectedSection] = useState<string>("all");
    const [weeklySortWeek, setWeeklySortWeek] = useState<string>("");
    const [weeklySortMode, setWeeklySortMode] = useState<"group" | "student">("group");
    const [groupSortDirection, setGroupSortDirection] = useState<"asc" | "desc">("asc");
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Hover state for table
    const [hoverRowId, setHoverRowId] = useState<string | null>(null);
    const [hoverColKey, setHoverColKey] = useState<string | null>(null);

    // Cache data for all tabs - avoid re-fetching when switching
    const [labData, setLabData] = useState<ScoreSummaryMatrix | null>(null);
    const [assignmentData, setAssignmentData] = useState<ScoreSummaryMatrix | null>(null);
    const [groupData, setGroupData] = useState<ScoreSummaryMatrix | null>(null);
    const [weeklyGroupData, setWeeklyGroupData] = useState<ScoreSummaryMatrix | null>(null);
    const hasFetchedRef = useRef({ lab: false, assignment: false, group: false, weekly_group: false });

    // Score detail modal
    const [scoreModal, setScoreModal] = useState<ScoreDetailModal>(INITIAL_SCORE_MODAL);

    // Get current matrix data based on selected tab
    const matrixData = selectedTab === "lab"
        ? labData
        : selectedTab === "assignment"
            ? assignmentData
            : selectedTab === "group"
                ? groupData
                : weeklyGroupData;

    // Fetch matrix data (with caching)
    const fetchMatrix = useCallback(async (type: AssignmentTabType, forceRefresh = false, showLoading = true) => {
        // Skip if already fetched and not forcing refresh
        if (!forceRefresh && hasFetchedRef.current[type]) return;

        if (showLoading) {
            setIsLoading(true);
        }
        try {
            // Map tab type to API assignment type
            const apiType = type === "lab"
                ? "individual"
                : type === "assignment"
                    ? "assignment"
                    : type === "group"
                        ? "permanent_group"
                        : "weekly_group";
            const data = await scoreService.getScoreSummaryMatrix(courseId, {
                assignmentType: apiType,
            });
            if (type === "lab") {
                setLabData(data);
            } else if (type === "assignment") {
                setAssignmentData(data);
            } else if (type === "group") {
                setGroupData(data);
            } else {
                setWeeklyGroupData(data);
            }
            hasFetchedRef.current[type] = true;
        } catch (error) {
            console.error("Failed to fetch score matrix:", error);
        } finally {
            if (showLoading) {
                setIsLoading(false);
            }
        }
    }, [courseId]);

    // Initial fetch for current tab
    useEffect(() => {
        fetchMatrix(selectedTab);
    }, [selectedTab, fetchMatrix]);

    // Prefetch remaining tabs so all chip counts are visible on first paint.
    useEffect(() => {
        const tabs: AssignmentTabType[] = ["lab", "assignment", "group", "weekly_group"];
        const tabsToPrefetch = tabs.filter((tab) => tab !== selectedTab && !hasFetchedRef.current[tab]);
        if (tabsToPrefetch.length === 0) return;

        Promise.all(tabsToPrefetch.map((tab) => fetchMatrix(tab, false, false))).catch((error) => {
            console.error("Failed to prefetch score matrix tabs:", error);
        });
    }, [selectedTab, fetchMatrix]);

    const weeklySortWeekOptions = useMemo(() => {
        const source = weeklyGroupData?.assignments ?? [];
        const weeks = new Set<number>();
        for (const assignment of source) {
            if (assignment.week_number !== null && assignment.week_number !== undefined) {
                weeks.add(assignment.week_number);
            }
        }
        return Array.from(weeks).sort((a, b) => a - b).map((week) => String(week));
    }, [weeklyGroupData?.assignments]);

    useEffect(() => {
        if (selectedTab !== "weekly_group") return;
        if (weeklySortWeekOptions.length === 0) {
            if (weeklySortWeek !== "") setWeeklySortWeek("");
            return;
        }
        if (!weeklySortWeek || !weeklySortWeekOptions.includes(weeklySortWeek)) {
            setWeeklySortWeek(weeklySortWeekOptions[0]);
        }
    }, [selectedTab, weeklySortWeek, weeklySortWeekOptions]);

    // Filter + sort students by search query, section, and weekly group code when applicable
    const filteredStudents = useMemo(() => {
        if (!matrixData?.students) return [];
        const students = matrixData.students.filter(student => {
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

        if (selectedTab !== "weekly_group") {
            if (selectedTab === "group") {
                return [...students].sort((a, b) => {
                    const byGroupName = compareOptionalGroupNames(a.group_name ?? undefined, b.group_name ?? undefined, isEnglish);
                    if (byGroupName !== 0) {
                        return groupSortDirection === "asc" ? byGroupName : -byGroupName;
                    }

                    return a.student_id.localeCompare(b.student_id);
                });
            }

            return students;
        }

        if (weeklySortMode === "student" || !weeklySortWeek) {
            return [...students].sort((a, b) => a.student_id.localeCompare(b.student_id));
        }

        return [...students].sort((a, b) => {
            const groupAName = a.weekly_group_names?.[weeklySortWeek];
            const groupBName = b.weekly_group_names?.[weeklySortWeek];
            const byGroupName = compareOptionalGroupNames(groupAName, groupBName, isEnglish);

            if (byGroupName !== 0) {
                return groupSortDirection === "asc" ? byGroupName : -byGroupName;
            }

            return a.student_id.localeCompare(b.student_id);
        });
    }, [groupSortDirection, isEnglish, matrixData?.students, matrixData?.sections, searchQuery, selectedSection, selectedTab, weeklySortWeek, weeklySortMode]);

    const visibleAssignments = useMemo(() => {
        if (!matrixData?.assignments) return [];
        if (selectedTab !== "weekly_group" || !weeklySortWeek) {
            return matrixData.assignments;
        }

        return matrixData.assignments.filter((assignment) => String(assignment.week_number ?? "") === weeklySortWeek);
    }, [matrixData?.assignments, selectedTab, weeklySortWeek]);

    // Get assignment columns
    const columns = useMemo((): ColumnDef[] => {
        if (visibleAssignments.length === 0) return [];

        const cols: ColumnDef[] = [];

        for (const assignment of visibleAssignments) {
            const title = assignment.title || (isEnglish ? `Assignment #${assignment.id}` : `งาน #${assignment.id}`);
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
    }, [isEnglish, visibleAssignments]);

    // Group assignments for header (for colspan)
    const assignmentGroups = useMemo((): AssignmentGroup[] => {
        if (visibleAssignments.length === 0) return [];
        return visibleAssignments.map(a => ({
            id: a.id,
            title: a.title || a.short_title || (isEnglish ? `Assignment #${a.id}` : `งาน #${a.id}`),
            colSpan: a.subItems && a.subItems.length > 0 ? a.subItems.length : 1,
            hasSubItems: a.subItems && a.subItems.length > 0,
        }));
    }, [isEnglish, visibleAssignments]);

    // Total max score
    const totalMaxScore = useMemo(() => columns.reduce((sum, c) => sum + c.maxScore, 0), [columns]);

    // Class average
    const classAverage = useMemo(() => {
        if (totalMaxScore === 0) return 0;

        const studentsWithScores = filteredStudents.filter(s => {
            return columns.some((col) => {
                const score = s.scores?.[col.key]?.score;
                return score !== null && score !== undefined;
            });
        });

        if (studentsWithScores.length === 0) return 0;

        const total = studentsWithScores.reduce((sum, s) => sum + getDisplayedStudentTotal(s, columns), 0);
        const avgScore = total / studentsWithScores.length;
        return (avgScore / totalMaxScore) * 100;
    }, [columns, filteredStudents, totalMaxScore]);

    // Handle score cell click
    const handleScoreClick = useCallback((
        student: StudentType,
        col: ColumnDef,
        scoreData: {
            score: number | null;
            max_score: number;
            sub_item_name?: string;
            graded_by?: string | null;
            graded_at?: string | null;
            updated_at?: string | null;
            comment?: string | null;
            group_id?: number | null;
            group_name?: string | null;
            edit_requests?: {
                old_score: number | null;
                new_score: number;
                reason: string | null;
                requester: string | null;
                reviewer: string | null;
                reviewed_at: string | null;
                review_comment: string | null;
            }[];
        } | undefined
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
            editRequests: scoreData?.edit_requests ?? undefined,
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
    const weeklyGroupCount = weeklyGroupData?.assignments?.length || 0;

    return {
        // State
        selectedTab,
        selectedSection,
        weeklySortWeek,
        weeklySortMode,
        groupSortDirection,
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
        weeklyGroupCount,
        weeklySortWeekOptions,

        // Actions
        setSelectedTab,
        setSelectedSection,
        setWeeklySortWeek,
        setWeeklySortMode,
        setGroupSortDirection,
        setSearchQuery,
        setHoverRowId,
        setHoverColKey,
        handleScoreClick,
        closeScoreModal,
        fetchMatrix,
    };
}

export type UseScoreSummaryTabReturn = ReturnType<typeof useScoreSummaryTab>;
