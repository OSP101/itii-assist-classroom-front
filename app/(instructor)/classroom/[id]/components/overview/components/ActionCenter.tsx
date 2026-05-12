"use client";

import { memo } from "react";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";
import type { ActionItem } from "../analytics";

const SEV = {
  high:   { dot: "bg-rose-500",  text: "text-rose-600",  labelKey: "urgent",   labelCls: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400",  borderL: "border-l-rose-500",  rowBg: "hover:bg-rose-50/40 dark:hover:bg-rose-950/20" },
  medium: { dot: "bg-amber-500", text: "text-amber-600", labelKey: "shouldDo",  labelCls: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400", borderL: "border-l-amber-500", rowBg: "hover:bg-amber-50/30 dark:hover:bg-amber-950/10" },
  low:    { dot: "bg-blue-500",  text: "text-blue-600",  labelKey: "recommended",  labelCls: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",   borderL: "border-l-blue-500",  rowBg: "hover:bg-blue-50/30 dark:hover:bg-blue-950/10" },
};

interface ActionCenterProps {
  items: ActionItem[];
  onNavigate?: (tab: string) => void;
}

function ActionCenterComponent({ items, onNavigate }: ActionCenterProps) {
  const t = useI18n();
  if (items.length === 0) return null;

  return (
    <div className="divide-y divide-slate-100 dark:divide-zinc-800">
      {items.map((item) => {
        const s = SEV[item.severity];
        return (
          <div key={item.id} className={`flex items-center gap-3 py-2.5 sm:py-3.5 first:pt-0 last:pb-0 border-l-[3px] pl-3 rounded-r-lg transition-colors ${s.borderL} ${s.rowBg}`}>
            <div className="relative shrink-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot} ${item.severity === 'high' ? 'opacity-0' : ''}`} />
              {item.severity === 'high' && (
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${s.dot} opacity-60`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${s.dot}`} />
                </span>
              )}
            </div>
            <div className={`w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0`}>
              <Icon icon={item.icon} className={`text-base ${s.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.title}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${s.labelCls}`}>{t(s.labelKey)}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{item.description}</p>
            </div>
            {item.count > 0 && (
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 shrink-0 w-8 text-center tabular-nums">{item.count}</span>
            )}
            {item.tab && onNavigate && (
              <Button
                size="sm"
                variant="flat"
                color="primary"
                className="shrink-0 text-xs h-8 px-3 min-w-0"
                onPress={() => onNavigate(item.tab!)}
              >
                {t("manage")}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const ActionCenter = memo(ActionCenterComponent);
