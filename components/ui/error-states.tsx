/**
 * Error state components — standardised error UI for pages and sections.
 *
 * Rules:
 * - Page-level error: use PageErrorState (in error.tsx)
 * - Section/chart/widget error: use SectionErrorState (does NOT crash the page)
 * - Inline/tiny error: use InlineErrorState
 * - 403 / permission denied: use PermissionDeniedState
 * - Network error: use NetworkErrorState
 *
 * Always provide a retry button when the action is retryable.
 */

"use client";

import React from "react";
import { Button } from "@heroui/button";

// ---------------------------------------------------------------------------
// Page-level error — used in app/**/error.tsx files
// ---------------------------------------------------------------------------

type PageErrorStateProps = {
  error?: Error;
  reset?: () => void;
  title?: string;
  description?: string;
};

export function PageErrorState({
  error,
  reset,
  title = "เกิดข้อผิดพลาด",
  description,
}: PageErrorStateProps) {
  const message =
    description ??
    (error?.message && !error.message.includes("undefined")
      ? error.message
      : "ไม่สามารถโหลดหน้านี้ได้ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-5xl" aria-hidden>⚠️</span>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-default-800">{title}</h2>
        <p className="text-sm text-default-500 max-w-md">{message}</p>
      </div>
      <div className="flex gap-2 mt-2">
        {reset && (
          <Button color="primary" variant="flat" size="sm" onPress={reset}>
            ลองใหม่อีกครั้ง
          </Button>
        )}
        <Button
          variant="light"
          size="sm"
          onPress={() => (window.location.href = "/")}
        >
          กลับหน้าหลัก
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section-level error — inside a card/widget; does NOT crash the page
// ---------------------------------------------------------------------------

type SectionErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

export function SectionErrorState({
  title = "โหลดข้อมูลไม่สำเร็จ",
  description = "กรุณาลองใหม่อีกครั้ง",
  onRetry,
  className,
}: SectionErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-6 text-center ${className ?? ""}`}
    >
      <span className="text-2xl" aria-hidden>⚠️</span>
      <p className="text-sm font-medium text-danger">{title}</p>
      <p className="text-xs text-default-400">{description}</p>
      {onRetry && (
        <Button color="danger" variant="flat" size="sm" onPress={onRetry}>
          ลองใหม่
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline error — for small inline error hints (e.g., inside a table cell)
// ---------------------------------------------------------------------------

type InlineErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export function InlineErrorState({
  message = "โหลดไม่สำเร็จ",
  onRetry,
}: InlineErrorStateProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-danger">
      <span>⚠️</span>
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="underline underline-offset-2 hover:no-underline"
        >
          ลองใหม่
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Permission denied — 403 state
// ---------------------------------------------------------------------------

export function PermissionDeniedState({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-5xl" aria-hidden>🔒</span>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-default-800">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="text-sm text-default-500">คุณไม่มีสิทธิ์ดูหน้านี้</p>
      </div>
      <Button
        variant="flat"
        size="sm"
        onPress={onBack ?? (() => window.history.back())}
      >
        ย้อนกลับ
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Network error
// ---------------------------------------------------------------------------

export function NetworkErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-divider p-8 text-center">
      <span className="text-4xl" aria-hidden>📡</span>
      <div className="space-y-1">
        <p className="font-medium text-default-700">ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้</p>
        <p className="text-sm text-default-400">ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่</p>
      </div>
      {onRetry && (
        <Button color="primary" variant="flat" size="sm" onPress={onRetry}>
          ลองใหม่
        </Button>
      )}
    </div>
  );
}
