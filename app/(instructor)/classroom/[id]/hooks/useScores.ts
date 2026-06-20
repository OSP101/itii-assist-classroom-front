"use client";

import { useState, useCallback, useMemo } from "react";
import { addToast } from "@heroui/toast";
import scoreService from "@/services/score.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { isScoreInputValid, parseScoreInput } from "@/lib/score-input";
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
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const t = (th: string, en: string) => (isEnglish ? en : th);

    // Score states
    const [selectedAssignment, setSelectedAssignment] = useState<AssignmentType | null>(null);
    const [scoresData, setScoresData] = useState<ScoresData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [scoreEntries, setScoreEntries] = useState<Record<string, number | "">>({});
    const [groupsForScore, setGroupsForScore] = useState<Group[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [groupScoreValue, setGroupScoreValue] = useState<string>("");
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
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถโหลดข้อมูลคะแนนได้", "Unable to load score data."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, [isEnglish]);

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
                title: t("บันทึกแล้ว", "Saved"),
                description: t("บันทึกคะแนนเรียบร้อย", "Score saved successfully."),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            
            onOverviewRefresh?.();
            emitUpdate?.("score", "update", selectedAssignment.id);
        } catch (error) {
            console.error("Error saving score:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถบันทึกคะแนนได้", "Unable to save the score."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        }
    }, [selectedAssignment, onOverviewRefresh, emitUpdate, isEnglish]);

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
                    title: t("บันทึกแล้ว", "Saved"),
                    description: isEnglish
                        ? `Saved ${scores.length} ${scores.length === 1 ? "score" : "scores"} successfully.`
                        : `บันทึกคะแนนทั้งหมด ${scores.length} รายการเรียบร้อย`,
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
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถบันทึกคะแนนได้", "Unable to save the scores."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSaving(false);
        }
    }, [selectedAssignment, scoresData, scoreEntries, fetchScores, onOverviewRefresh, emitUpdate, isEnglish]);

    // Save group score
    const saveGroupScore = useCallback(async () => {
        if (!selectedAssignment || !selectedGroup) return;
        if (!isScoreInputValid(groupScoreValue, selectedAssignment.max_score)) {
            addToast({
                title: t("à¸„à¸°à¹à¸™à¸™à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡", "Invalid score"),
                description: isEnglish
                    ? `Please enter a valid score between 0 and ${selectedAssignment.max_score} with up to 2 decimal places.`
                    : `à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸„à¸°à¹à¸™à¸™à¹ƒà¸«à¹‰à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡ à¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡ 0-${selectedAssignment.max_score} à¹à¸¥à¸°à¸—à¸¨à¸™à¸´à¸¢à¸¡à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ 2 à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡`,
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
        
        setIsSaving(true);
        try {
            await scoreService.submitGroupScore({
                assignment_id: selectedAssignment.id,
                group_id: selectedGroup.id,
                score: parseScoreInput(groupScoreValue) ?? 0,
            });
            
            addToast({
                title: t("บันทึกแล้ว", "Saved"),
                description: isEnglish
                    ? `Saved the score for group ${selectedGroup.name}.`
                    : `บันทึกคะแนนกลุ่ม ${selectedGroup.name} เรียบร้อย`,
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
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถบันทึกคะแนนกลุ่มได้", "Unable to save the group score."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [selectedAssignment, selectedGroup, groupScoreValue, fetchScores, onOverviewRefresh, emitUpdate, isEnglish]);

    // Reset score states
    const resetScores = useCallback(() => {
        setSelectedAssignment(null);
        setScoresData(null);
        setScoreEntries({});
        setGroupsForScore([]);
        setSelectedGroup(null);
        setGroupScoreValue("");
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
