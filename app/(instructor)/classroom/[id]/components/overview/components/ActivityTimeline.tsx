"use client";

import { memo } from "react";
import { Avatar } from "@heroui/avatar";
import { Chip } from "@heroui/chip";
import { Icon } from "@iconify/react";
import type { RecentActivity } from "@/services/course.service";
import { formatRelativeTime } from "../config";

interface ActivityTimelineProps {
  activities: RecentActivity[];
}

function ActivityTimelineComponent({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Icon icon="solar:history-2-linear" className="text-4xl text-slate-300" />
        <p className="text-sm text-slate-400">ยังไม่มีกิจกรรม</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-4 bottom-4 w-px bg-slate-100 dark:bg-zinc-800" />

      <div className="space-y-3.5">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 relative pl-2">
            {/* Dot */}
            <div className="w-5 h-5 rounded-full bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700 flex items-center justify-center shrink-0 mt-1 z-10">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors border border-slate-100 dark:border-zinc-700/50">
              <div className="flex items-start gap-2">
                <Avatar
                  name={activity.user?.full_name || "?"}
                  src={activity.user?.avatar || undefined}
                  size="sm"
                  className="shrink-0 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed line-clamp-2">
                    {activity.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                    {activity.score > 0 && (
                      <Chip size="sm" variant="flat" color="primary" className="h-5 text-[11px]">
                        +{activity.score} คะแนน
                      </Chip>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ActivityTimeline = memo(ActivityTimelineComponent);
