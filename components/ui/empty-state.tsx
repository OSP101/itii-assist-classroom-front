/**
 * EmptyState — standardised empty/no-data/first-time UI.
 *
 * Use this instead of ad-hoc "ไม่มีข้อมูล" strings.
 * Always provide an actionable message when appropriate.
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   variant="no-data"
 *   title="ยังไม่มีงาน"
 *   description="สร้างงานแรกเพื่อเริ่มให้คะแนนนักศึกษา"
 *   action={{ label: "สร้างงาน", onClick: handleCreate }}
 * />
 * ```
 */

"use client";

import React from "react";
import { Button } from "@heroui/button";
import { useI18n } from "@/hooks/useI18n";

export type EmptyStateVariant =
  | "no-data"
  | "no-result"
  | "no-permission"
  | "first-time"
  | "not-configured"
  | "archived"
  | "error";

type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

type EmptyStateProps = {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** Override the default icon — pass any React node */
  icon?: React.ReactNode;
  className?: string;
};

const variantDefaults: Record<
  EmptyStateVariant,
  { titleKey: string; descriptionKey: string; emoji: string }
> = {
  "no-data": {
    emoji: "📂",
    titleKey: "noDataYet",
    descriptionKey: "noItemsAtTheMoment",
  },
  "no-result": {
    emoji: "🔍",
    titleKey: "noResultsFound",
    descriptionKey: "adjustSearchOrClearFilters",
  },
  "no-permission": {
    emoji: "🔒",
    titleKey: "accessDenied",
    descriptionKey: "youDoNotHavePermissionToViewThisData",
  },
  "first-time": {
    emoji: "✨",
    titleKey: "letsGetStarted",
    descriptionKey: "noDataCreateFirstItem",
  },
  "not-configured": {
    emoji: "⚙️",
    titleKey: "systemSettings",
    descriptionKey: "featureNotConfigured",
  },
  archived: {
    emoji: "📦",
    titleKey: "archived",
    descriptionKey: "itemArchivedCannotEdit",
  },
  error: {
    emoji: "⚠️",
    titleKey: "somethingWentWrong",
    descriptionKey: "pleaseTryAgain",
  },
};

export function EmptyState({
  variant = "no-data",
  title,
  description,
  action,
  secondaryAction,
  icon,
  className,
}: EmptyStateProps) {
  const t = useI18n();
  const defaults = variantDefaults[variant];
  const displayTitle = title ?? t(defaults.titleKey);
  const displayDesc = description ?? t(defaults.descriptionKey);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-divider px-6 py-12 text-center ${className ?? ""}`}
    >
      <div className="text-4xl" aria-hidden>
        {icon ?? defaults.emoji}
      </div>
      <div className="space-y-1">
        <p className="font-medium text-default-700">{displayTitle}</p>
        <p className="text-sm text-default-400 max-w-xs">{displayDesc}</p>
      </div>
      {(action || secondaryAction) && (
        <div className="flex gap-2 mt-1">
          {action && (
            <Button
              size="sm"
              color="primary"
              variant="flat"
              onPress={action.onClick}
              as={action.href ? "a" : undefined}
              href={action.href}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              size="sm"
              variant="light"
              onPress={secondaryAction.onClick}
              as={secondaryAction.href ? "a" : undefined}
              href={secondaryAction.href}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
