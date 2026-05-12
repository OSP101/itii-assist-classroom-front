"use client";

import { memo } from "react";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";

interface QuickAction {
  id: string;
  labelKey: string;
  icon: string;
  tab?: string;
}

const ACTIONS: QuickAction[] = [
  { id: "assignments", labelKey: "createAssignment", icon: "solar:add-square-bold", tab: "assignments" },
  { id: "attendance", labelKey: "attendance", icon: "solar:user-check-bold", tab: "attendance" },
  { id: "queue", labelKey: "openQueue", icon: "solar:sort-by-time-bold", tab: "queue" },
  { id: "scores", labelKey: "gradeWork", icon: "solar:diploma-bold", tab: "scores" },
  { id: "approval", labelKey: "scoreApproval", icon: "solar:clipboard-check-bold", tab: "approval" },
];

interface QuickActionsBarProps {
  onNavigate?: (tab: string) => void;
}

function QuickActionsBarComponent({ onNavigate }: QuickActionsBarProps) {
  const t = useI18n();
  return (
    <div className="flex flex-wrap gap-2.5">
      {ACTIONS.map(action => (
        <Button
          key={action.id}
          size="sm"
          color="default"
          variant="flat"
          startContent={<Icon icon={action.icon} className="text-sm text-slate-500 dark:text-zinc-400" />}
          onPress={() => action.tab && onNavigate?.(action.tab)}
          className="rounded-xl text-xs h-8 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150"
        >
          {t(action.labelKey)}
        </Button>
      ))}
    </div>
  );
}

export const QuickActionsBar = memo(QuickActionsBarComponent);
