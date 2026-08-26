"use client";

import { memo, useEffect, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import { Progress } from "@heroui/progress";
import { Spinner } from "@heroui/spinner";
import { Icon } from "@iconify/react";
import assignmentService, { type AssignmentCourseSummary } from "@/services/assignment.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";

interface AssignmentCourseSummaryPanelProps {
    courseId: string;
}

function AssignmentCourseSummaryPanelComponent({ courseId }: AssignmentCourseSummaryPanelProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const [summary, setSummary] = useState<AssignmentCourseSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        assignmentService
            .getCourseSummary(courseId)
            .then((data) => {
                if (!cancelled) setSummary(data);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [courseId]);

    if (isLoading) {
        return (
            <Card className="border border-default-200 shadow-sm">
                <CardBody className="py-6 flex items-center justify-center">
                    <Spinner size="sm" />
                </CardBody>
            </Card>
        );
    }

    if (!summary || summary.total_assignments === 0) {
        return null;
    }

    return (
        <Card className="border border-default-200 shadow-sm">
            <CardBody className="py-4 px-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                            <Icon icon="solar:document-text-bold-duotone" className="text-lg text-blue-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground text-sm">
                                {isEnglish ? "Course-wide status" : "สถานะรวมทั้งรายวิชา"}
                            </p>
                            <p className="text-xs text-default-400">
                                {summary.total_assignments} {isEnglish ? "assignments" : "งาน"}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-blue-600">{summary.overall_graded_rate}%</p>
                        <p className="text-xs text-default-400">
                            {summary.overall_graded}/{summary.overall_target} {isEnglish ? "graded" : "ตรวจแล้ว"}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {summary.assignments.map((a) => (
                        <div key={a.assignment_id} className="rounded-xl border border-default-200 p-3">
                            <div className="flex items-center justify-between mb-2 gap-2">
                                <span className="text-sm font-medium text-foreground truncate" title={a.name}>
                                    {a.name}
                                </span>
                                <span className="text-xs font-semibold text-default-500 shrink-0">{a.graded_rate}%</span>
                            </div>
                            <Progress
                                value={a.graded_rate}
                                color={a.graded_rate >= 100 ? "success" : a.graded_rate > 0 ? "primary" : "default"}
                                size="sm"
                                aria-label={a.name}
                                className="h-2"
                            />
                            <p className="text-xs text-default-400 mt-1">
                                {a.graded_count}/{a.target_count} {isEnglish ? "graded" : "ตรวจแล้ว"}
                                {a.ungraded_count > 0 && (
                                    <span className="text-warning-600">
                                        {" "}
                                        &middot; {a.ungraded_count} {isEnglish ? "pending" : "ค้างตรวจ"}
                                    </span>
                                )}
                            </p>
                        </div>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
}

export const AssignmentCourseSummaryPanel = memo(AssignmentCourseSummaryPanelComponent);
