"use client";

import { memo } from "react";

interface CircularProgressProps {
    value: number;
    size?: number;
    strokeWidth?: number;
    color?: "primary" | "success" | "warning" | "danger";
    sublabel?: string;
}

const colorClasses = {
    primary: "text-blue-500",
    success: "text-emerald-500",
    warning: "text-amber-500",
    danger: "text-red-500",
};

const bgColorClasses = {
    primary: "text-blue-100",
    success: "text-emerald-100",
    warning: "text-amber-100",
    danger: "text-red-100",
};

function CircularProgressComponent({
    value,
    size = 120,
    strokeWidth = 10,
    color = "primary",
    sublabel,
}: CircularProgressProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (value / 100) * circumference;

    return (
        <div className="relative flex flex-col items-center">
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    className={bgColorClasses[color]}
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className={`${colorClasses[color]} transition-all duration-500 ease-out`}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${colorClasses[color]}`}>{value}%</span>
            </div>
            {sublabel && <span className="text-sm text-slate-600 mt-2 font-medium">{sublabel}</span>}
        </div>
    );
}

export const CircularProgress = memo(CircularProgressComponent);
