"use client";

import React, { useMemo } from "react";
import { Icon } from "@iconify/react";
import type { ActivityLog, ResolvedRef } from "@/services/courseActivityLog.service";
import {
  formatTarget,
  isOutsiderAdminView,
  isSystemDetectedEvent,
  splitDetailParts,
} from "./activityDetail";

interface CategoryConfig {
  label: string;
  icon: string;
  bgClass: string;
  iconClass: string;
}

interface ActivityTimelineListProps {
  logs: ActivityLog[];
  isEnglish: boolean;
  categoryConfig: Record<string, CategoryConfig>;
  actionLabels: Record<string, string>;
  getRoleLabel: (role?: string | null) => string;
  onSelect: (log: ActivityLog) => void;
  onSubjectSelect: (ref: ResolvedRef) => void;
}

/**
 * Groups rows by calendar day. The table view answers "find me this row"; the
 * timeline answers "what happened in this class", which needs the shape of a
 * day — a cluster of edits at 14:30 reads very differently from the same edits
 * spread over a week, and "3 days ago" hides that entirely.
 */
function groupByDay(logs: ActivityLog[], isEnglish: boolean) {
  const groups: { key: string; label: string; logs: ActivityLog[] }[] = [];
  const locale = isEnglish ? "en-US" : "th-TH";

  for (const log of logs) {
    const date = new Date(log.created_at);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.logs.push(log);
      continue;
    }
    groups.push({
      key,
      label: date.toLocaleDateString(locale, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      logs: [log],
    });
  }

  return groups;
}

function formatClockTime(value: string, isEnglish: boolean) {
  return new Date(value).toLocaleTimeString(isEnglish ? "en-US" : "th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityTimelineList({
  logs,
  isEnglish,
  categoryConfig,
  actionLabels,
  getRoleLabel,
  onSelect,
  onSubjectSelect,
}: ActivityTimelineListProps) {
  const groups = useMemo(() => groupByDay(logs, isEnglish), [logs, isEnglish]);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
            <span className="text-xs text-default-400">
              {group.logs.length} {isEnglish ? "events" : "รายการ"}
            </span>
            <div className="h-px flex-1 bg-default-200" />
          </div>

          <ol className="space-y-1">
            {group.logs.map((log) => {
              const conf = categoryConfig[log.category] || categoryConfig.general;
              const { changes, summary } = splitDetailParts(log, isEnglish);
              const targetText = formatTarget(log, isEnglish);
              const outsider = isOutsiderAdminView(log);
              const system = isSystemDetectedEvent(log);
              const actorName = system
                ? targetText || (isEnglish ? "Student" : "นักศึกษา")
                : log.actor?.full_name || (isEnglish ? "Unknown user" : "ไม่ทราบผู้ใช้");

              return (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(log)}
                    className={`flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-content2 ${
                      outsider ? "bg-danger-50/60 dark:bg-danger-100/10" : ""
                    }`}
                  >
                    <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-default-400">
                      {formatClockTime(log.created_at, isEnglish)}
                    </span>

                    <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${conf.bgClass}`}>
                      <Icon
                        icon={system ? "solar:shield-check-bold" : conf.icon}
                        width={14}
                        className={conf.iconClass}
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className="text-sm font-medium text-foreground">{actorName}</span>
                        {!system && (
                          <span className="text-xs text-default-400">
                            {getRoleLabel(log.actor_role || log.actor?.role)}
                          </span>
                        )}
                        {outsider && (
                          <span className="rounded-md bg-danger-100 px-1 py-px text-[10px] font-semibold text-danger-700 dark:bg-danger-100/20 dark:text-danger-400">
                            {isEnglish ? "outside course" : "นอกรายวิชา"}
                          </span>
                        )}
                        <span className="text-sm text-default-600">
                          {actionLabels[log.action] || log.action}
                        </span>
                      </span>

                      {targetText && !system && (
                        <span className="mt-0.5 block">
                          {log.target_ref ? (
                            // Rendered as a span, not a nested button or Chip:
                            // a button may only contain phrasing content.
                            <span
                              role="link"
                              tabIndex={0}
                              className="inline-block cursor-pointer rounded-md bg-content2 px-1.5 py-0.5 text-xs text-default-600 hover:bg-content3"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (log.target_ref) onSubjectSelect(log.target_ref);
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                event.stopPropagation();
                                if (log.target_ref) onSubjectSelect(log.target_ref);
                              }}
                            >
                              {targetText}
                            </span>
                          ) : (
                            <span className="text-xs text-default-500">{targetText}</span>
                          )}
                        </span>
                      )}

                      {changes.map((part) => (
                        <span key={part.key} className="mt-0.5 flex flex-wrap items-center gap-1 text-xs">
                          <span className="text-default-400">{part.label}</span>
                          <span className="text-default-400 line-through">{part.change?.from}</span>
                          <Icon icon="solar:arrow-right-linear" width={12} className="text-default-400" />
                          <span className={part.tone === "score" ? "font-semibold text-amber-600" : "font-medium text-success-600"}>
                            {part.change?.to}
                          </span>
                        </span>
                      ))}

                      {summary && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-default-500">{summary}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
