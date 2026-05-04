"use client";

import { memo } from "react";
import { Progress } from "@heroui/progress";
import { Icon } from "@iconify/react";
import type { AssignmentTypeStats } from "@/services/course.service";
import { getAssignmentTypeConfig } from "../config";

interface AssignmentTypeSummaryCardProps {
    type: string;
    stats: AssignmentTypeStats;
}

function AssignmentTypeSummaryCardComponent({
    type,
    stats,
}: AssignmentTypeSummaryCardProps) {
    const config = getAssignmentTypeConfig(type);
    
    return (
        <div className={`relative bg-white rounded-2xl p-4 border ${config.borderClass} shadow-sm hover:shadow-md transition-all overflow-hidden group`}>
            <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full ${config.bgClass} opacity-30 group-hover:scale-125 transition-transform duration-500`} />
            
            <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 ${config.bgClass} rounded-xl flex items-center justify-center`}>
                        <Icon icon={config.icon} className={`text-xl ${config.textClass}`} />
                    </div>
                    <div>
                        <p className={`font-semibold ${config.textClass}`}>{config.shortLabel}</p>
                        <p className="text-xs text-slate-400">{stats.count} งาน</p>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">คะแนนเต็ม</span>
                        <span className="font-semibold text-slate-700">{stats.totalMaxScore}</span>
                    </div>
                    <Progress
                        value={stats.progressRate}
                        color={config.color}
                        size="sm"
                        className="h-2"
                    />
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400">
                            ตรวจแล้ว {stats.totalScored}/{stats.totalExpected}
                        </span>
                        <span className={`text-xs font-semibold ${config.textClass}`}>
                            {stats.progressRate}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export const AssignmentTypeSummaryCard = memo(AssignmentTypeSummaryCardComponent);
