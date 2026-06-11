/**
 * Error state components - standardised error UI for pages and sections.
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

import React, { useEffect } from "react";
import { Button } from "@heroui/button";
import { useI18n } from "@/hooks/useI18n";

const CHUNK_ERROR_RELOAD_KEY = "itii:chunk-error-reloaded";

type PageErrorStateProps = {
  error?: Error;
  reset?: () => void;
  title?: string;
  description?: string;
};

type SectionErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

type InlineErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

function isRecoverableChunkError(error?: Error) {
  const message = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();

  return (
    message.includes("chunkloaderror") ||
    message.includes("failed to load chunk") ||
    message.includes("failed to fetch dynamically imported module") ||
    (message.includes("/_next/static/chunks/") && message.includes("404"))
  );
}

export function PageErrorState({
  error,
  reset,
  title,
  description,
}: PageErrorStateProps) {
  const t = useI18n();
  const isChunkError = isRecoverableChunkError(error);

  useEffect(() => {
    if (!isChunkError || typeof window === "undefined") {
      return;
    }

    try {
      const hasReloaded = window.sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY);
      if (hasReloaded !== "1") {
        window.sessionStorage.setItem(CHUNK_ERROR_RELOAD_KEY, "1");
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, [isChunkError]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (!isChunkError) {
        window.sessionStorage.removeItem(CHUNK_ERROR_RELOAD_KEY);
      }
    } catch {
      // Ignore sessionStorage failures in restrictive browsers.
    }
  }, [isChunkError]);

  const message =
    description ??
    (isChunkError
      ? "ระบบมีการอัปเดต กำลังโหลดหน้าใหม่เพื่อดึงไฟล์เวอร์ชันล่าสุด"
      : error?.message && !error.message.includes("undefined")
        ? error.message
        : t("cannotLoadPageTryAgainOrContactAdmin"));
  const displayTitle = title ?? t("somethingWentWrong");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-5xl font-bold text-danger" aria-hidden>
        !
      </span>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-default-800">{displayTitle}</h2>
        <p className="max-w-md text-sm text-default-500">{message}</p>
      </div>
      <div className="mt-2 flex gap-2">
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
      <span className="text-2xl font-bold text-danger" aria-hidden>
        !
      </span>
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

export function InlineErrorState({
  message,
  onRetry,
}: InlineErrorStateProps) {
  const t = useI18n();

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-danger">
      <span className="font-bold" aria-hidden>
        !
      </span>
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

export function PermissionDeniedState({ onBack }: { onBack?: () => void }) {
  const t = useI18n();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-5xl font-semibold text-default-400" aria-hidden>
        X
      </span>
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

export function NetworkErrorState({ onRetry }: { onRetry?: () => void }) {
  const t = useI18n();

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-divider p-8 text-center">
      <span className="text-4xl font-semibold text-default-400" aria-hidden>
        ~
      </span>
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
