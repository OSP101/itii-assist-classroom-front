"use client";

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useAnnouncementViewer } from "@/hooks/useAnnouncementViewer";
import { getBackendPublicAssetUrl } from "@/lib/public-asset-url";
import { getAnnouncementRibbonStyle } from "@/lib/announcement-severity";

/**
 * One announcement per severity colour, laid out as a thin ribbon that spans
 * the full width above the page header — the shape used for standing notices
 * ("a new release is out", "certificates need attention") where a card inside
 * the content would be too heavy.
 *
 * It is a separate component from the banner stack because it has to mount
 * outside <main>, above the header, to span the whole width. Both read the same
 * shared announcement store, so this costs no extra request.
 */

export function GlobalAnnouncementTopbar() {
    const {
        t,
        user,
        visibleAnnouncements,
        acknowledgingIds,
        dismiss,
        acknowledge,
        getLocalizedTitle,
        getLocalizedMessage,
        getLocalizedActionLabel,
    } = useAnnouncementViewer();
    const [ribbonIndex, setRibbonIndex] = useState(0);

    const ribbons = useMemo(
        () => visibleAnnouncements.filter((item) => item.display_mode === "topbar"),
        [visibleAnnouncements],
    );

    if (!user || ribbons.length === 0) {
        return null;
    }

    // A ribbon is one line tall, so stacking several would eat the top of every
    // page. They rotate through one slot instead, with the count shown.
    const current = ribbons[Math.min(ribbonIndex, ribbons.length - 1)];
    const style = getAnnouncementRibbonStyle(current.severity);
    const message = getLocalizedMessage(current);
    const isAcknowledging = acknowledgingIds.has(current.id);

    return (
        <div className={`w-full ${style.bar} ${style.text}`}>
            <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-2 text-sm">
                <Icon icon={style.icon} className="hidden shrink-0 text-base sm:block" />

                <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${style.badge}`}>
                    {getLocalizedTitle(current)}
                </span>

                {/* The message stays on one line: a ribbon that wraps to three
                    lines stops being a ribbon. The full text is always in the
                    notification inbox. */}
                <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium sm:hidden">{getLocalizedTitle(current)} </span>
                    {message}
                </span>

                {current.action_url ? (
                    <a
                        href={getBackendPublicAssetUrl(current.action_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 whitespace-nowrap rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold underline-offset-2 hover:bg-white/30 hover:underline"
                    >
                        {getLocalizedActionLabel(current)}
                    </a>
                ) : null}

                {current.require_acknowledge ? (
                    <button
                        type="button"
                        disabled={isAcknowledging}
                        onClick={() => void acknowledge(current)}
                        className="shrink-0 whitespace-nowrap rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30 disabled:opacity-60"
                    >
                        {t("adminAcknowledgeAction")}
                    </button>
                ) : null}

                {ribbons.length > 1 && (
                    <button
                        type="button"
                        onClick={() => setRibbonIndex((prev) => (prev + 1) % ribbons.length)}
                        className="shrink-0 whitespace-nowrap rounded-md px-1.5 py-1 text-[11px] font-medium opacity-80 hover:bg-white/20 hover:opacity-100"
                        aria-label={t("announcementNext")}
                    >
                        {t("announcementStepIndicator", { current: ribbonIndex + 1, total: ribbons.length })}
                    </button>
                )}

                {current.is_dismissible && !current.require_acknowledge ? (
                    <button
                        type="button"
                        onClick={() => dismiss(current.id)}
                        className="shrink-0 rounded-md p-1 opacity-80 hover:bg-white/20 hover:opacity-100"
                        aria-label={t("dismiss")}
                    >
                        <Icon icon="solar:close-circle-linear" className="text-base" />
                    </button>
                ) : null}
            </div>
        </div>
    );
}
