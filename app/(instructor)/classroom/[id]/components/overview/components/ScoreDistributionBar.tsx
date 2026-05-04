"use client";

import { memo, useState, useEffect } from "react";
import { Tooltip } from "@heroui/tooltip";
import type { ScoreDistribution } from "@/services/course.service";

interface ScoreDistributionBarProps {
    distribution: ScoreDistribution;
}

function ScoreDistributionBarComponent({ distribution }: ScoreDistributionBarProps) {
    const [animate, setAnimate] = useState(false);
    const total = distribution.excellent + distribution.good + distribution.average + distribution.poor;
    
    // Trigger animation after mount
    useEffect(() => {
        const timer = setTimeout(() => setAnimate(true), 100);
        return () => clearTimeout(timer);
    }, []);

    if (total === 0) return null;

    const segments = [
        { key: 'excellent', label: 'ดีเยี่ยม', value: distribution.excellent, color: 'bg-emerald-500', percent: (distribution.excellent / total) * 100 },
        { key: 'good', label: 'ดี', value: distribution.good, color: 'bg-blue-500', percent: (distribution.good / total) * 100 },
        { key: 'average', label: 'ปานกลาง', value: distribution.average, color: 'bg-amber-500', percent: (distribution.average / total) * 100 },
        { key: 'poor', label: 'ต้องปรับปรุง', value: distribution.poor, color: 'bg-red-500', percent: (distribution.poor / total) * 100 },
    ];

    return (
        <div className="space-y-3">
            <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
                {segments.map((seg) => (
                    seg.value > 0 && (
                        <Tooltip key={seg.key} content={`${seg.label}: ${seg.value} คน (${seg.percent.toFixed(1)}%)`}>
                            <div 
                                className={`${seg.color} transition-all duration-1000 ease-out`}
                                style={{ width: animate ? `${seg.percent}%` : '0%' }}
                            />
                        </Tooltip>
                    )
                ))}
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
                {segments.map(seg => (
                    <div key={seg.key} className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded-full ${seg.color}`} />
                        <span className="text-xs text-slate-600">{seg.label}</span>
                        <span className="text-xs font-semibold text-slate-700">{seg.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export const ScoreDistributionBar = memo(ScoreDistributionBarComponent);
