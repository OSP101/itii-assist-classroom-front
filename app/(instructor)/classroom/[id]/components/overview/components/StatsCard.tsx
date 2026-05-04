"use client";

import { memo } from "react";
import { Icon } from "@iconify/react";

interface StatsCardProps {
    icon: string;
    iconBg: string;
    label: string;
    value: number;
    suffix?: string;
}

function StatsCardComponent({
    icon,
    iconBg,
    label,
    value,
    suffix = "",
}: StatsCardProps) {

    return (
        <div className="relative bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
            {/* Background decoration */}
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-slate-50 opacity-50 group-hover:scale-125 transition-transform duration-500" />
            
            <div className="relative flex items-start justify-between">
                <div>
                    <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center mb-3`}>
                        <Icon icon={icon} className="text-2xl text-white" />
                    </div>
                    <p className="text-sm text-slate-500 mb-1">{label}</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-slate-800">{value}</span>
                        {suffix && <span className="text-lg text-slate-500">{suffix}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}

export const StatsCard = memo(StatsCardComponent);
