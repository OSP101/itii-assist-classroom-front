"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";
import type { HealthScoreData, HealthLevel } from "../analytics";

const LEVEL_CONFIG: Record<HealthLevel, {
  labelKey: string;
  color: string;
  glow: string;
  bg: string;
  textColor: string;
  icon: string;
}> = {
  excellent: {
    labelKey: "healthLevelExcellent",
    color: "#10b981",
    glow: "rgba(16,185,129,0.35)",
    bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50",
    textColor: "text-emerald-700 dark:text-emerald-400",
    icon: "solar:verified-check-bold",
  },
  healthy: {
    labelKey: "healthLevelHealthy",
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.35)",
    bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/50",
    textColor: "text-blue-700 dark:text-blue-400",
    icon: "solar:heart-pulse-bold",
  },
  warning: {
    labelKey: "healthLevelWarning",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.35)",
    bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50",
    textColor: "text-amber-700 dark:text-amber-400",
    icon: "solar:danger-triangle-bold",
  },
  critical: {
    labelKey: "healthLevelCritical",
    color: "#ef4444",
    glow: "rgba(239,68,68,0.35)",
    bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/50",
    textColor: "text-red-700 dark:text-red-400",
    icon: "solar:fire-bold",
  },
};

interface HealthScoreBadgeProps {
  data: HealthScoreData;
}

function HealthScoreBadgeComponent({ data }: HealthScoreBadgeProps) {
  const cfg = LEVEL_CONFIG[data.level];
  const t = useI18n();
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (data.score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Circular ring */}
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <defs>
            <filter id={`glow-${data.level}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feFlood floodColor={cfg.color} floodOpacity="0.4" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Track */}
          <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="8" className="stroke-slate-200 dark:stroke-zinc-700" />
          {/* Progress with glow */}
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            stroke={cfg.color}
            filter={`url(#glow-${data.level})`}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold text-slate-900 dark:text-white leading-none tabular-nums"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            {data.score}
          </motion.span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">{t("outOfHundred")}</span>
        </div>
      </div>

      {/* Level badge */}
      <motion.div
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.textColor}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Icon icon={cfg.icon} className="text-sm" />
        {t(cfg.labelKey)}
      </motion.div>

      {/* Insight text */}
      <p className="text-xs text-slate-500 dark:text-zinc-400 text-center max-w-[160px] leading-relaxed">
        {data.insight}
      </p>
    </div>
  );
}

export const HealthScoreBadge = memo(HealthScoreBadgeComponent);
