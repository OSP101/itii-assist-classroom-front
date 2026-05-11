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
import { useI18n } from "@/hooks/useI18n";

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
  title,
  description,
}: PageErrorStateProps) {
  const t = useI18n();
  const message =
    description ??
    (error?.message && !error.message.includes("undefined")
      ? error.message
      : t("cannotLoadPageTryAgainOrContactAdmin"));
  const displayTitle = title ?? t("somethingWentWrong");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-5xl" aria-hidden>⚠️</span>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-default-800">{displayTitle}</h2>
        <p className="text-sm text-default-500 max-w-md">{message}</p>
      </div>
      <div className="flex gap-2 mt-2">
        {reset && (
          <Button color="primary" variant="flat" size="sm" onPress={reset}>
            {t("tryAgain")}
          </Button>
        )}
        <Button
          variant="light"
          size="sm"
          onPress={() => (window.location.href = "/")}
        >
          {t("goHome")}
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
  title,
  description,
  onRetry,
  className,
}: SectionErrorStateProps) {
  const t = useI18n();
  const displayTitle = title ?? t("failedToLoadData");
  const displayDescription = description ?? t("pleaseTryAgain");

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-6 text-center ${className ?? ""}`}
    >
      <span className="text-2xl" aria-hidden>⚠️</span>
      <p className="text-sm font-medium text-danger">{displayTitle}</p>
      <p className="text-xs text-default-400">{displayDescription}</p>
      {onRetry && (
        <Button color="danger" variant="flat" size="sm" onPress={onRetry}>
          {t("retry")}
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
  message,
  onRetry,
}: InlineErrorStateProps) {
  const t = useI18n();

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-danger">
      <span>⚠️</span>
      <span>{message ?? t("failedToLoad")}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="underline underline-offset-2 hover:no-underline"
        >
          {t("retry")}
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Permission denied — 403 state
// ---------------------------------------------------------------------------

export function PermissionDeniedState({ onBack }: { onBack?: () => void }) {
  const t = useI18n();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-5xl" aria-hidden>🔒</span>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-default-800">{t("accessDenied")}</h2>
        <p className="text-sm text-default-500">{t("youDoNotHaveAccessToThisPage")}</p>
      </div>
      <Button
        variant="flat"
        size="sm"
        onPress={onBack ?? (() => window.history.back())}
      >
        {t("goBack")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Network error
// ---------------------------------------------------------------------------

export function NetworkErrorState({ onRetry }: { onRetry?: () => void }) {
  const t = useI18n();

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-divider p-8 text-center">
      <span className="text-4xl" aria-hidden>📡</span>
      <div className="space-y-1">
        <p className="font-medium text-default-700">{t("cannotConnectToServer")}</p>
        <p className="text-sm text-default-400">{t("checkInternetAndTryAgain")}</p>
      </div>
      {onRetry && (
        <Button color="primary" variant="flat" size="sm" onPress={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
