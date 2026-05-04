"use client";

import { useState, useCallback, useMemo } from "react";
import { addToast } from "@heroui/toast";
import scoreService from "@/services/score.service";
import type { Assignment as AssignmentType, AssignmentSubItem } from "@/services/assignment.service";
import type { ScoresData, Group } from "@/services/score.service";

interface UseScoresOptions {
    onOverviewRefresh?: () => void;
    emitUpdate?: (resource: string, action: string, id?: string | number) => void;
}

/**
 * Custom hook for managing scores with optimized state management
 */
export function useScores(options: UseScoresOptions = {}) {
    const { onOverviewRefresh, emitUpdate } = options;

    // Score states
    const [selectedAssignment, setSelectedAssignment] = useState<AssignmentType | null>(null);
    const [scoresData, setScoresData] = useState<ScoresData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [scoreEntries, setScoreEntries] = useState<Record<string, number | "">>({});
    const [groupsForScore, setGroupsForScore] = useState<Group[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [groupScoreValue, setGroupScoreValue] = useState<number>(0);
    const [groupSubItemScores, setGroupSubItemScores] = useState<Record<number, number>>({});

    // Fetch scores for assignment
    const fetchScores = useCallback(async (assignment: AssignmentType) => {
        setIsLoading(true);
        try {
            const data = await scoreService.getScores(assignment.id);
            setScoresData(data);
            
            // Initialize score entries
            const entries: Record<string, number | ""> = {};
            if (data?.student_scores) {
                data.student_scores.forEach(studentScore => {
                    const key = `${studentScore.student.id}`;
                    entries[key] = studentScore.score !== null && studentScore.score !== undefined 
                        ? studentScore.score 
                        : "";
                });
            }
            setScoreEntries(entries);

            // Fetch groups if group assignment
            if (assignment.assignment_type !== "individual") {
                const groups = await scoreService.getGroupsForAssignment(assignment.id);
                setGroupsForScore(groups);
            } else {
                setGroupsForScore([]);
            }
        } catch (error) {
            console.error("Error fetching scores:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถโหลดข้อมูลคะแนนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Save individual score
    const saveScore = useCallback(async (studentId: number, score: number) => {
        if (!selectedAssignment) return;
        
        try {
            await scoreService.submitScore({
                assignment_id: selectedAssignment.id,
                student_id: studentId,
                score,
            });
            
            addToast({
                title: "บันทึกแล้ว",
                description: "บันทึกคะแนนเรียบร้อย",
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            
            onOverviewRefresh?.();
            emitUpdate?.("score", "update", selectedAssignment.id);
        } catch (error) {
            console.error("Error saving score:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถบันทึกคะแนนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        }
    }, [selectedAssignment, onOverviewRefresh, emitUpdate]);

    // Save all scores
    const saveAllScores = useCallback(async () => {
        if (!selectedAssignment || !scoresData) return;
        
        setIsSaving(true);
        try {
            const scores: { student_id: number; score: number; comment?: string }[] = [];
            
            scoresData.student_scores.forEach(studentScore => {
                const key = `${studentScore.student.id}`;
                const scoreValue = scoreEntries[key];
                if (scoreValue !== "" && scoreValue !== undefined) {
                    scores.push({
                        student_id: studentScore.student.id,
                        score: Number(scoreValue),
                    });
                }
            });

            if (scores.length > 0) {
                await scoreService.submitBulkScores({
                    assignment_id: selectedAssignment.id,
                    scores,
                });
                
                addToast({
                    title: "บันทึกแล้ว",
                    description: `บันทึกคะแนนทั้งหมด ${scores.length} รายการเรียบร้อย`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                emitUpdate?.("score", "bulk", selectedAssignment.id);
                await fetchScores(selectedAssignment);
                onOverviewRefresh?.();
            }
        } catch (error) {
            console.error("Error saving all scores:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถบันทึกคะแนนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSaving(false);
        }
    }, [selectedAssignment, scoresData, scoreEntries, fetchScores, onOverviewRefresh, emitUpdate]);

    // Save group score
    const saveGroupScore = useCallback(async () => {
        if (!selectedAssignment || !selectedGroup) return;
        
        setIsSaving(true);
        try {
            await scoreService.submitGroupScore({
                assignment_id: selectedAssignment.id,
                group_id: selectedGroup.id,
                score: groupScoreValue,
            });
            
            addToast({
                title: "บันทึกแล้ว",
                description: `บันทึกคะแนนกลุ่ม ${selectedGroup.name} เรียบร้อย`,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            
            emitUpdate?.("score", "update", selectedAssignment.id);
            await fetchScores(selectedAssignment);
            onOverviewRefresh?.();
            
            return true; // Success
        } catch (error) {
            console.error("Error saving group score:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถบันทึกคะแนนกลุ่มได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [selectedAssignment, selectedGroup, groupScoreValue, fetchScores, onOverviewRefresh, emitUpdate]);

    // Reset score states
    const resetScores = useCallback(() => {
        setSelectedAssignment(null);
        setScoresData(null);
        setScoreEntries({});
        setGroupsForScore([]);
        setSelectedGroup(null);
        setGroupScoreValue(0);
        setGroupSubItemScores({});
    }, []);

    return {
        // State
        selectedAssignment,
        setSelectedAssignment,
        scoresData,
        setScoresData,
        isLoading,
        isSaving,
        scoreEntries,
        setScoreEntries,
        groupsForScore,
        setGroupsForScore,
        selectedGroup,
        setSelectedGroup,
        groupScoreValue,
        setGroupScoreValue,
        groupSubItemScores,
        setGroupSubItemScores,

        // Actions
        fetchScores,
        saveScore,
        saveAllScores,
        saveGroupScore,
        resetScores,
    };
}
