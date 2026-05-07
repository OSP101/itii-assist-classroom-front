"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import type { InsightItem, InsightType } from "../analytics";

const TYPE_CONFIG: Record<InsightType, {
  border: string;
  iconBg: string;
  iconColor: string;
  titleColor: string;
  cardBg: string;
}> = {
  success: { border: "border-l-emerald-400", iconBg: "bg-emerald-50 dark:bg-emerald-950/40", iconColor: "text-emerald-600 dark:text-emerald-400", titleColor: "text-emerald-700 dark:text-emerald-400", cardBg: "bg-slate-50 dark:bg-zinc-800/40" },
  info:    { border: "border-l-blue-400",    iconBg: "bg-blue-50 dark:bg-blue-950/40",    iconColor: "text-blue-600 dark:text-blue-400",    titleColor: "text-blue-700 dark:text-blue-400",    cardBg: "bg-slate-50 dark:bg-zinc-800/40" },
  warning: { border: "border-l-amber-400",   iconBg: "bg-amber-50 dark:bg-amber-950/40",   iconColor: "text-amber-600 dark:text-amber-400",   titleColor: "text-amber-700 dark:text-amber-400",   cardBg: "bg-slate-50 dark:bg-zinc-800/40" },
  danger:  { border: "border-l-rose-400",    iconBg: "bg-rose-50 dark:bg-rose-950/40",    iconColor: "text-rose-600 dark:text-rose-400",    titleColor: "text-rose-700 dark:text-rose-400",    cardBg: "bg-slate-50 dark:bg-zinc-800/40" },
};

interface InsightPanelProps {
  insights: InsightItem[];
}

function InsightPanelComponent({ insights }: InsightPanelProps) {
  if (insights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {insights.map((item, i) => {
        const cfg = TYPE_CONFIG[item.type];
        return (
          <motion.div
            key={item.id}
            className={`min-h-[80px] sm:min-h-[96px] ${cfg.cardBg} rounded-xl border border-l-4 border-slate-200/80 dark:border-zinc-700/50 ${cfg.border} p-3 sm:p-4 flex items-start gap-2.5`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2, transition: { duration: 0.15 } }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.iconBg}`}>
              <Icon icon={item.icon} className={`text-base ${cfg.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold leading-snug ${cfg.titleColor}`}>{item.title}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">{item.description}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export const InsightPanel = memo(InsightPanelComponent);
