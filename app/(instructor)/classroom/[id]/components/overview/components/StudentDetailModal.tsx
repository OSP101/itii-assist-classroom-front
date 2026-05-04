"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { Chip } from "@heroui/chip";
import { Progress } from "@heroui/progress";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";
import { Icon } from "@iconify/react";
import scoreService from "@/services/score.service";
import type { Assignment } from "@/services/assignment.service";
import { getAssignmentTypeConfig } from "../config";

interface StudentInfo {
    id: number;
    student_id: string;
    full_name: string;
    totalScore?: number;
    percentage?: number;
}

interface StudentDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: StudentInfo | null;
    courseId: string;
}

// Extended type for assignment with scores from the summary endpoint
interface AssignmentWithScores extends Assignment {
    scores?: {
        id: number;
        score: number | null;
        student_id: number;
        sub_item_id: number | null;
        comment?: string;
        status?: string;
        student?: {
            id: number;
            student_id: string;
            full_name: string;
        };
    }[];
}

export function StudentDetailModal({ isOpen, onClose, student, courseId }: StudentDetailModalProps) {
    const [assignments, setAssignments] = useState<AssignmentWithScores[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !student || !courseId) {
            setAssignments([]);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        scoreService.getStudentScoresSummary(courseId, student.id)
            .then((data) => {
                if (!cancelled) setAssignments(data as AssignmentWithScores[]);
            })
            .catch(() => {
                if (!cancelled) setAssignments([]);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [isOpen, student, courseId]);

    // Calculate total score (consistent with overview logic)
    const totalScore = assignments.reduce((sum, a) => {
        const hasSubItems = a.subItems && a.subItems.length > 0;
        if (hasSubItems) {
            const subScores = a.scores?.filter(s => s.sub_item_id !== null) || [];
            return sum + subScores.reduce((ss, s) => ss + (s.score !== null ? Number(s.score) : 0), 0);
        } else {
            const mainScore = a.scores?.find(s => s.sub_item_id === null);
            if (mainScore && mainScore.score !== null) return sum + Number(mainScore.score);
            return sum;
        }
    }, 0);

    const totalMaxScore = assignments.reduce((sum, a) => {
        if (a.subItems && a.subItems.length > 0) {
            return sum + a.subItems.reduce((ss, item) => ss + Number(item.max_score || 0), 0);
        }
        return sum + Number(a.max_score || 0);
    }, 0);
    const overallPercentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

    const gradedCount = assignments.filter(a => a.scores && a.scores.length > 0).length;

    // Group assignments by type
    const groupedAssignments = useMemo(() => {
        const groups: Record<string, AssignmentWithScores[]> = {};
        assignments.forEach(a => {
            const type = a.assignment_type || "individual";
            if (!groups[type]) groups[type] = [];
            groups[type].push(a);
        });
        return groups;
    }, [assignments]);

    // Calculate per-type stats
    const getTypeStats = (items: AssignmentWithScores[]) => {
        const total = items.length;
        const graded = items.filter(a => a.scores && a.scores.length > 0).length;
        const missed = total - graded;
        let earned = 0;
        let max = 0;
        items.forEach(a => {
            const hasSubItems = a.subItems && a.subItems.length > 0;
            if (hasSubItems) {
                max += a.subItems!.reduce((s, item) => s + Number(item.max_score || 0), 0);
                const subScores = a.scores?.filter(s => s.sub_item_id !== null) || [];
                earned += subScores.reduce((s, sc) => s + (sc.score !== null ? Number(sc.score) : 0), 0);
            } else {
                max += Number(a.max_score || 0);
                const mainScore = a.scores?.find(s => s.sub_item_id === null);
                if (mainScore && mainScore.score !== null) earned += Number(mainScore.score);
            }
        });
        const percentage = max > 0 ? Math.round((earned / max) * 100) : 0;
        return { total, graded, missed, earned, max, percentage };
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                    {student && (
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                                <Icon icon="solar:user-bold" className="text-2xl text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-800">{student.full_name}</h3>
                                <p className="text-sm text-slate-500">{student.student_id}</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-2xl font-bold ${
                                    overallPercentage >= 80 ? "text-emerald-600" :
                                    overallPercentage >= 60 ? "text-blue-600" :
                                    overallPercentage >= 40 ? "text-amber-600" : "text-red-600"
                                }`}>
                                    {overallPercentage}%
                                </p>
                                <p className="text-xs text-slate-400">{totalScore.toFixed(1)}/{totalMaxScore} คะแนน</p>
                            </div>
                        </div>
                    )}
                </ModalHeader>

                <Divider />

                <ModalBody className="px-6 py-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Spinner size="lg" />
                        </div>
                    ) : assignments.length > 0 ? (
                        <div className="space-y-5">
                            {/* Overall Summary */}
                            <div className="flex items-center justify-between text-sm text-slate-500">
                                <span>มีคะแนนแล้ว {gradedCount}/{assignments.length} งาน</span>
                                <span>{totalScore.toFixed(1)} / {totalMaxScore} คะแนนรวม</span>
                            </div>

                            {/* Grouped by type */}
                            {Object.entries(groupedAssignments).map(([type, items]) => {
                                const config = getAssignmentTypeConfig(type);
                                const stats = getTypeStats(items);

                                return (
                                    <div key={type}>
                                        {/* Type Header */}
                                        <div className={`flex items-center justify-between p-3 rounded-xl ${config.bgClass} mb-2`}>
                                            <div className="flex items-center gap-2">
                                                <Icon icon={config.icon} className={`text-lg ${config.textClass}`} />
                                                <span className={`font-semibold text-sm ${config.textClass}`}>
                                                    {config.shortLabel}
                                                </span>
                                                <Chip size="sm" variant="flat" className="bg-white/60">
                                                    {stats.total} งาน
                                                </Chip>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs">
                                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                                    <Icon icon="solar:check-circle-bold" className="text-sm" />
                                                    {stats.graded} ส่ง
                                                </span>
                                                {stats.missed > 0 && (
                                                    <span className="flex items-center gap-1 text-red-500 font-medium">
                                                        <Icon icon="solar:close-circle-bold" className="text-sm" />
                                                        {stats.missed} ขาด
                                                    </span>
                                                )}
                                                <span className={`font-bold ${
                                                    stats.percentage >= 80 ? "text-emerald-600" :
                                                    stats.percentage >= 50 ? "text-blue-600" :
                                                    stats.percentage >= 30 ? "text-amber-600" : "text-red-500"
                                                }`}>
                                                    {stats.earned.toFixed(1)}/{stats.max}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Assignments in this type */}
                                        <div className="space-y-2 ml-1">
                                            {items.map((assignment) => {
                                                const hasSubItems = assignment.subItems && assignment.subItems.length > 0;
                                                const mainScoreEntry = assignment.scores?.find(s => s.sub_item_id === null);
                                                let earned = 0;
                                                let hasScore = false;

                                                if (hasSubItems) {
                                                    const subScores = assignment.scores?.filter(s => s.sub_item_id !== null) || [];
                                                    hasScore = subScores.length > 0;
                                                    earned = subScores.reduce((sum, s) => sum + (s.score !== null ? Number(s.score) : 0), 0);
                                                } else {
                                                    hasScore = mainScoreEntry !== undefined && mainScoreEntry.score !== null;
                                                    earned = hasScore && mainScoreEntry ? Number(mainScoreEntry.score) : 0;
                                                }

                                                const maxScore = hasSubItems
                                                    ? assignment.subItems!.reduce((sum, item) => sum + Number(item.max_score || 0), 0)
                                                    : Number(assignment.max_score || 0);
                                                const percentage = maxScore > 0 ? Math.round((earned / maxScore) * 100) : 0;

                                                return (
                                                    <div
                                                        key={assignment.id}
                                                        className={`p-3 rounded-xl border transition-colors ${
                                                            hasScore
                                                                ? "bg-white border-slate-200"
                                                                : "bg-slate-50 border-dashed border-slate-300"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {/* Status indicator */}
                                                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                                                                hasScore
                                                                    ? percentage >= 80 ? "bg-emerald-500" : percentage >= 50 ? "bg-blue-500" : "bg-amber-500"
                                                                    : "bg-slate-300"
                                                            }`} />

                                                            {/* Content */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <p className="font-medium text-slate-800 text-sm truncate">{assignment.name}</p>
                                                                    {assignment.week_number && (
                                                                        <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600 shrink-0">
                                                                            W{assignment.week_number}
                                                                        </Chip>
                                                                    )}
                                                                </div>
                                                                {hasScore ? (
                                                                    <Progress
                                                                        value={percentage}
                                                                        size="sm"
                                                                        color={percentage >= 80 ? "success" : percentage >= 50 ? "primary" : "warning"}
                                                                        className="max-w-full"
                                                                    />
                                                                ) : (
                                                                    <p className="text-xs text-slate-400 flex items-center gap-1">
                                                                        <Icon icon="solar:close-circle-linear" className="text-sm text-slate-300" />
                                                                        ยังไม่มีคะแนน
                                                                    </p>
                                                                )}

                                                                {/* Sub-items detail */}
                                                                {hasScore && hasSubItems && (
                                                                    <div className="mt-2 space-y-1 pl-1">
                                                                        {assignment.subItems!.map((sub) => {
                                                                            const subScore = assignment.scores?.find(
                                                                                s => s.sub_item_id === sub.id
                                                                            );
                                                                            return (
                                                                                <div key={sub.id} className="flex items-center justify-between text-xs text-slate-500">
                                                                                    <span className="truncate">{sub.name}</span>
                                                                                    <span className={subScore?.score !== null && subScore?.score !== undefined ? "font-medium text-slate-700" : "text-slate-300"}>
                                                                                        {subScore?.score !== null && subScore?.score !== undefined
                                                                                            ? `${subScore.score}/${sub.max_score}`
                                                                                            : `-/${sub.max_score}`
                                                                                        }
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Score */}
                                                            <div className="text-right shrink-0 ml-2">
                                                                {hasScore ? (
                                                                    <>
                                                                        <p className={`text-base font-bold ${
                                                                            percentage >= 80 ? "text-emerald-600" :
                                                                            percentage >= 50 ? "text-blue-600" :
                                                                            percentage >= 30 ? "text-amber-600" : "text-red-600"
                                                                        }`}>
                                                                            {earned}
                                                                        </p>
                                                                        <p className="text-xs text-slate-400">/ {maxScore}</p>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <p className="text-base font-bold text-slate-300">-</p>
                                                                        <p className="text-xs text-slate-400">/ {maxScore}</p>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Icon icon="solar:clipboard-list-linear" className="text-3xl text-slate-300" />
                            </div>
                            <p className="text-sm text-slate-500">ยังไม่มีงานในวิชานี้</p>
                        </div>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}
