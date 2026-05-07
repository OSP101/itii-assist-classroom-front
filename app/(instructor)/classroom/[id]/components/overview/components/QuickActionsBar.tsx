"use client";

import { memo } from "react";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  tab?: string;
}

const ACTIONS: QuickAction[] = [
  { id: "assignments", label: "สร้างงาน", icon: "solar:add-square-bold", tab: "assignments" },
  { id: "attendance", label: "เช็คชื่อ", icon: "solar:user-check-bold", tab: "attendance" },
  { id: "queue", label: "เปิดคิว", icon: "solar:sort-by-time-bold", tab: "queue" },
  { id: "scores", label: "ตรวจงาน", icon: "solar:diploma-bold", tab: "scores" },
  { id: "approval", label: "อนุมัติคะแนน", icon: "solar:clipboard-check-bold", tab: "approval" },
];

interface QuickActionsBarProps {
  onNavigate?: (tab: string) => void;
}

function QuickActionsBarComponent({ onNavigate }: QuickActionsBarProps) {
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
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export const QuickActionsBar = memo(QuickActionsBarComponent);
