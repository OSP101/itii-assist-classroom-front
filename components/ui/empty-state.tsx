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

const variantDefaults: Record<EmptyStateVariant, { title: string; description: string; emoji: string }> = {
  "no-data": {
    emoji: "📂",
    title: "ยังไม่มีข้อมูล",
    description: "ยังไม่มีรายการใดๆ ในขณะนี้",
  },
  "no-result": {
    emoji: "🔍",
    title: "ไม่พบผลลัพธ์",
    description: "ลองปรับเงื่อนไขการค้นหาหรือล้างตัวกรอง",
  },
  "no-permission": {
    emoji: "🔒",
    title: "ไม่มีสิทธิ์เข้าถึง",
    description: "คุณไม่มีสิทธิ์ดูข้อมูลนี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ",
  },
  "first-time": {
    emoji: "✨",
    title: "เริ่มต้นกันเลย",
    description: "ยังไม่มีข้อมูล สร้างรายการแรกเพื่อเริ่มใช้งาน",
  },
  "not-configured": {
    emoji: "⚙️",
    title: "ยังไม่ได้ตั้งค่า",
    description: "ฟีเจอร์นี้ยังไม่ได้รับการตั้งค่า กรุณาตั้งค่าก่อนใช้งาน",
  },
  archived: {
    emoji: "📦",
    title: "เก็บถาวรแล้ว",
    description: "รายการนี้ถูกเก็บถาวรและไม่สามารถแก้ไขได้",
  },
  error: {
    emoji: "⚠️",
    title: "เกิดข้อผิดพลาด",
    description: "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
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
  const defaults = variantDefaults[variant];
  const displayTitle = title ?? defaults.title;
  const displayDesc = description ?? defaults.description;

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
