"use client";

import { usePathname } from "next/navigation";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import type { VisibleAnnouncement } from "@/hooks/useActiveAnnouncements";
import { getAnnouncementSeverityStyle } from "@/lib/announcement-severity";
import { getBackendPublicAssetUrl } from "@/lib/public-asset-url";

interface AnnouncementCornerCardProps {
    items: VisibleAnnouncement[];
    index: number;
    onNext: () => void;
    onDismiss: (announcementId: number) => void;
    onAcknowledge: (item: VisibleAnnouncement) => void;
    acknowledgingIds: Set<number>;
    getTitle: (item: VisibleAnnouncement) => string;
    getMessage: (item: VisibleAnnouncement) => string;
    getActionLabel: (item: VisibleAnnouncement) => string;
    t: (key: string, values?: Record<string, string | number>) => string;
}

/**
 * A small card that floats in the bottom-left corner while the reader carries
 * on working: the announcement is in view without blocking the page the way a
 * fullscreen notice does, and without taking a line off the top the way the
 * ribbon does. Good for a standing invitation or a "have you seen this yet".
 *
 * Only one is on screen at a time — a corner is one card wide — with the rest
 * reachable through the step control.
 */
export function AnnouncementCornerCard({
    items,
    index,
    onNext,
    onDismiss,
    onAcknowledge,
    acknowledgingIds,
    getTitle,
    getMessage,
    getActionLabel,
    t,
}: AnnouncementCornerCardProps) {
    const pathname = usePathname();

    if (items.length === 0) {
        return null;
    }

    const item = items[Math.min(index, items.length - 1)];
    const severityStyle = getAnnouncementSeverityStyle(item.severity);
    const message = getMessage(item);
    const isAcknowledging = acknowledgingIds.has(item.id);

    // The student zone keeps a fixed tab bar along the bottom of the screen, so
    // the card has to sit above it rather than on top of it.
    const bottomOffset = pathname.startsWith("/student") ? "bottom-24" : "bottom-4 sm:bottom-6";

    return (
        <div
            className={`fixed left-4 z-110 w-[calc(100vw-2rem)] max-w-sm sm:left-6 ${bottomOffset}`}
            role="complementary"
        >
            <div className="overflow-hidden rounded-2xl border border-default-200 bg-content1 shadow-2xl">
                {item.content_type !== "text" && item.image_url ? (
                    <img
                        src={getBackendPublicAssetUrl(item.image_url)}
                        alt={getTitle(item)}
                        className="h-36 w-full object-cover"
                        loading="lazy"
                    />
                ) : null}

                <div className="space-y-2 p-4">
                    <div className="flex items-start gap-2">
                        <Icon icon={severityStyle.icon} className={`mt-0.5 shrink-0 text-lg ${severityStyle.iconClass}`} />
                        <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">{getTitle(item)}</p>
                        {items.length > 1 && (
                            <button
                                type="button"
                                onClick={onNext}
                                className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-default-500 hover:bg-default-100"
                                aria-label={t("announcementNext")}
                            >
                                {t("announcementStepIndicator", { current: index + 1, total: items.length })}
                            </button>
                        )}
                    </div>

                    {message ? (
                        <p className="whitespace-pre-line text-xs leading-relaxed text-default-600">{message}</p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {item.is_dismissible && !item.require_acknowledge ? (
                            <Button size="sm" variant="bordered" onPress={() => onDismiss(item.id)}>
                                {t("close")}
                            </Button>
                        ) : null}
                        {item.action_url ? (
                            <Button
                                as="a"
                                href={getBackendPublicAssetUrl(item.action_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                size="sm"
                                color="primary"
                                className="flex-1"
                            >
                                {getActionLabel(item)}
                            </Button>
                        ) : null}
                        {item.require_acknowledge ? (
                            <Button
                                size="sm"
                                color="primary"
                                className="flex-1"
                                isLoading={isAcknowledging}
                                onPress={() => onAcknowledge(item)}
                            >
                                {t("adminAcknowledgeAction")}
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
