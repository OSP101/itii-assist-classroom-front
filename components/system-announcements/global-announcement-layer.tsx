"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { useAnnouncementViewer } from "@/hooks/useAnnouncementViewer";
import type { VisibleAnnouncement } from "@/hooks/useActiveAnnouncements";
import { getBackendPublicAssetUrl } from "@/lib/public-asset-url";
import { getAnnouncementSeverityStyle } from "@/lib/announcement-severity";
import { AnnouncementCornerCard } from "@/components/system-announcements/announcement-corner-card";

/**
 * How many banners are visible before the stack collapses. The rest stay one
 * click away rather than being dropped: the old layer sliced the list to two
 * and everything past that vanished with nothing on screen to say so.
 */
const COLLAPSED_BANNER_COUNT = 2;

type AnnouncementDisplayMode = "banner_top" | "fullscreen" | "fullscreen_image";

function getFrontendAbsoluteUrl(pathOrUrl: string): string {
  return getBackendPublicAssetUrl(pathOrUrl);
}

export function GlobalAnnouncementLayer() {
  const {
    t,
    user,
    isLoading,
    visibleAnnouncements,
    acknowledgingIds,
    dismiss,
    acknowledge,
    getLocalizedTitle,
    getLocalizedMessage,
    getLocalizedActionLabel,
  } = useAnnouncementViewer();
  const [isStackExpanded, setIsStackExpanded] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [cornerIndex, setCornerIndex] = useState(0);
  // Full-screen posters can always be closed, even ones marked not
  // dismissible; for those the close is remembered only until the next page
  // load rather than recorded on the server.
  const [locallyHiddenIds, setLocallyHiddenIds] = useState<Set<number>>(new Set());
  // The blocking overlays are portalled to <body>, so no ancestor of wherever
  // this component happens to be mounted can capture their clicks or trap them
  // in a stacking context. A full-screen announcement nobody can close is the
  // worst failure this component has, so it does not rely on the tree above it.
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Every fullscreen announcement is shown, one after another, instead of only
  // whichever one happened to sort first. Both fullscreen shapes queue
  // together — they occupy the same screen.
  const fullscreenAnnouncements = useMemo(
    () => visibleAnnouncements.filter(
      (item) => (item.display_mode === "fullscreen" || item.display_mode === "fullscreen_image")
        && !locallyHiddenIds.has(item.id),
    ),
    [visibleAnnouncements, locallyHiddenIds],
  );

  const bannerAnnouncements = useMemo(
    () => visibleAnnouncements.filter((item) => item.display_mode === "banner_top"),
    [visibleAnnouncements],
  );

  // The corner card is rendered from here rather than from its own mount point
  // because it is fixed-positioned: it does not need to sit anywhere
  // particular in the tree the way the top ribbon does.
  const cornerAnnouncements = useMemo(
    () => visibleAnnouncements.filter((item) => item.display_mode === "corner_card"),
    [visibleAnnouncements],
  );

  const collapsedBanners = isStackExpanded
    ? bannerAnnouncements
    : bannerAnnouncements.slice(0, COLLAPSED_BANNER_COUNT);
  const hiddenBannerCount = bannerAnnouncements.length - collapsedBanners.length;

  useEffect(() => {
    if (fullscreenIndex > fullscreenAnnouncements.length - 1) {
      setFullscreenIndex(Math.max(0, fullscreenAnnouncements.length - 1));
    }
  }, [fullscreenAnnouncements.length, fullscreenIndex]);

  useEffect(() => {
    if (cornerIndex > cornerAnnouncements.length - 1) {
      setCornerIndex(Math.max(0, cornerAnnouncements.length - 1));
    }
  }, [cornerAnnouncements.length, cornerIndex]);

  const fullscreenAnnouncement = fullscreenAnnouncements[fullscreenIndex];

  // Every full-screen announcement can be closed, whatever it was configured
  // with. A dismissible one is recorded on the server; anything else is hidden
  // only until the next page load. The one exception is an announcement that
  // requires acknowledgement, which closes by being acknowledged.
  const closeFullscreen = useCallback(
    (item: VisibleAnnouncement) => {
      if (item.is_dismissible && !item.require_acknowledge) {
        dismiss(item.id);
        return;
      }
      setLocallyHiddenIds((prev) => new Set([...prev, item.id]));
    },
    [dismiss],
  );

  // Escape is the reflex when something covers the screen, so it works here
  // too.
  useEffect(() => {
    const current = fullscreenAnnouncements[fullscreenIndex];
    if (!current || current.require_acknowledge) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeFullscreen(current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeFullscreen, fullscreenAnnouncements, fullscreenIndex]);

  const renderActionButtons = (item: VisibleAnnouncement, mode: AnnouncementDisplayMode) => {
    const isOverlay = mode !== "banner_top";
    const isAcknowledging = acknowledgingIds.has(item.id);

    return (
      <div className="flex flex-wrap items-center gap-2">
        {item.action_url ? (
          <Button
            as="a"
            href={getFrontendAbsoluteUrl(item.action_url)}
            target="_blank"
            rel="noopener noreferrer"
            variant={isOverlay ? "solid" : "flat"}
            color={isOverlay ? "primary" : "default"}
            size="sm"
          >
            {getLocalizedActionLabel(item)}
          </Button>
        ) : null}
        {item.require_acknowledge ? (
          <Button
            color="primary"
            variant={isOverlay ? "solid" : "flat"}
            size="sm"
            isLoading={isAcknowledging}
            onPress={() => void acknowledge(item)}
          >
            {t("adminAcknowledgeAction")}
          </Button>
        ) : null}
        {item.is_dismissible && !item.require_acknowledge ? (
          <Button
            variant={isOverlay ? "bordered" : "light"}
            size="sm"
            className={isOverlay ? "border-white/40 text-white" : undefined}
            onPress={() => dismiss(item.id)}
          >
            {t("dismiss")}
          </Button>
        ) : null}
      </div>
    );
  };

  if (!user || (!isLoading && visibleAnnouncements.length === 0)) {
    return null;
  }

  const isFullBleedImage = fullscreenAnnouncement?.display_mode === "fullscreen_image"
    && !!fullscreenAnnouncement.image_url;

  return (
    <>
      {collapsedBanners.length > 0 && (
        <div className="mb-4 space-y-2">
          {bannerAnnouncements.length > COLLAPSED_BANNER_COUNT && (
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-xs font-medium text-default-500">
                {t("announcementCountLabel", { count: bannerAnnouncements.length })}
              </span>
              <Button
                size="sm"
                variant="light"
                onPress={() => setIsStackExpanded((prev) => !prev)}
                endContent={<Icon icon={isStackExpanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} />}
              >
                {isStackExpanded ? t("announcementShowLess") : t("announcementShowAll", { count: bannerAnnouncements.length })}
              </Button>
            </div>
          )}

          {collapsedBanners.map((item) => {
            const severityStyle = getAnnouncementSeverityStyle(item.severity);
            const message = getLocalizedMessage(item);

            return (
              <div
                key={item.id}
                className={`rounded-xl border px-4 py-3 shadow-sm ${severityStyle.banner}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-semibold ${severityStyle.title}`}>{getLocalizedTitle(item)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${severityStyle.chip}`}>
                        {t(severityStyle.labelKey)}
                      </span>
                    </div>
                    {/* whitespace-pre-line keeps the paragraph breaks the admin
                        typed; without it a multi-paragraph notice collapsed
                        into one run-on block. */}
                    {message ? (
                      <p className={`whitespace-pre-line text-sm ${severityStyle.body}`}>{message}</p>
                    ) : null}
                  </div>
                  <Icon icon={severityStyle.icon} className={`shrink-0 text-xl ${severityStyle.iconClass}`} />
                </div>
                {item.content_type !== "text" && item.image_url ? (
                  <img
                    src={getFrontendAbsoluteUrl(item.image_url)}
                    alt={getLocalizedTitle(item)}
                    className="mt-3 h-36 w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="mt-3">{renderActionButtons(item, "banner_top")}</div>
              </div>
            );
          })}

          {hiddenBannerCount > 0 && (
            <button
              type="button"
              onClick={() => setIsStackExpanded(true)}
              className="w-full rounded-xl border border-dashed border-default-300 px-4 py-2 text-xs font-medium text-default-500 transition hover:bg-default-100"
            >
              {t("announcementShowAll", { count: bannerAnnouncements.length })}
            </button>
          )}
        </div>
      )}

      {fullscreenAnnouncement && isMounted && createPortal(
        <div className={`fixed inset-0 z-9999 flex items-center justify-center bg-black/85 ${isFullBleedImage ? "" : "p-4"}`}>
          {isFullBleedImage ? (
            /* Nothing but the poster. It already carries the wording, so a
               caption bar over the bottom of it would only cover the part of
               the design that says the same thing. The controls are the
               smallest they can be: a close cross, and a step counter when
               more than one is queued. */
            <div className="relative h-full w-full">
              {fullscreenAnnouncement.action_url ? (
                <a
                  href={getFrontendAbsoluteUrl(fullscreenAnnouncement.action_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-full w-full"
                  aria-label={getLocalizedActionLabel(fullscreenAnnouncement)}
                >
                  <img
                    src={getFrontendAbsoluteUrl(fullscreenAnnouncement.image_url!)}
                    alt={getLocalizedTitle(fullscreenAnnouncement)}
                    className="h-full w-full object-contain"
                  />
                </a>
              ) : (
                <img
                  src={getFrontendAbsoluteUrl(fullscreenAnnouncement.image_url!)}
                  alt={getLocalizedTitle(fullscreenAnnouncement)}
                  className="h-full w-full object-contain"
                />
              )}

              {fullscreenAnnouncements.length > 1 && (
                <button
                  type="button"
                  onClick={() => setFullscreenIndex((prev) => (prev + 1) % fullscreenAnnouncements.length)}
                  className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/80"
                  aria-label={t("announcementNext")}
                >
                  {t("announcementStepIndicator", {
                    current: fullscreenIndex + 1,
                    total: fullscreenAnnouncements.length,
                  })}
                </button>
              )}

              {fullscreenAnnouncement.require_acknowledge ? (
                /* An announcement that demands acknowledgement cannot offer a
                   plain close, or the acknowledgement would never be recorded.
                   The button is a floating pill rather than a bar so it covers
                   as little of the poster as possible. */
                <Button
                  color="primary"
                  size="md"
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 shadow-lg"
                  isLoading={acknowledgingIds.has(fullscreenAnnouncement.id)}
                  onPress={() => void acknowledge(fullscreenAnnouncement)}
                >
                  {t("adminAcknowledgeAction")}
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={() => closeFullscreen(fullscreenAnnouncement)}
                  className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white backdrop-blur transition hover:bg-black/80"
                  aria-label={t("dismiss")}
                >
                  <Icon icon="solar:close-circle-linear" className="text-2xl" />
                </button>
              )}
            </div>
          ) : (
            <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-black/60 p-5 text-white backdrop-blur">
              {!fullscreenAnnouncement.require_acknowledge && (
                <button
                  type="button"
                  onClick={() => closeFullscreen(fullscreenAnnouncement)}
                  className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white transition hover:bg-black/80"
                  aria-label={t("dismiss")}
                >
                  <Icon icon="solar:close-circle-linear" className="text-xl" />
                </button>
              )}
              <div className="space-y-3 pr-10">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon
                    icon={getAnnouncementSeverityStyle(fullscreenAnnouncement.severity).icon}
                    className={`text-xl ${getAnnouncementSeverityStyle(fullscreenAnnouncement.severity).iconClass}`}
                  />
                  <p className="text-xl font-semibold">{getLocalizedTitle(fullscreenAnnouncement)}</p>
                  {fullscreenAnnouncements.length > 1 && (
                    <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-xs">
                      {t("announcementStepIndicator", {
                        current: fullscreenIndex + 1,
                        total: fullscreenAnnouncements.length,
                      })}
                    </span>
                  )}
                </div>
                {getLocalizedMessage(fullscreenAnnouncement) ? (
                  <p className="whitespace-pre-line text-sm text-white/90">{getLocalizedMessage(fullscreenAnnouncement)}</p>
                ) : null}
              </div>
              {fullscreenAnnouncement.content_type !== "text" && fullscreenAnnouncement.image_url ? (
                <img
                  src={getFrontendAbsoluteUrl(fullscreenAnnouncement.image_url)}
                  alt={getLocalizedTitle(fullscreenAnnouncement)}
                  className="mt-4 max-h-[60vh] w-full rounded-xl object-contain bg-black/30"
                  loading="lazy"
                />
              ) : null}
              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                {/* With more than one fullscreen notice queued, this steps
                    through them rather than leaving the rest unseen. */}
                {fullscreenIndex < fullscreenAnnouncements.length - 1 && (
                  <Button
                    variant="bordered"
                    size="sm"
                    className="border-white/40 text-white"
                    onPress={() => setFullscreenIndex((prev) => prev + 1)}
                  >
                    {t("announcementNext")}
                  </Button>
                )}
                {renderActionButtons(fullscreenAnnouncement, "fullscreen")}
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}

      {isMounted && createPortal(
        <AnnouncementCornerCard
          items={cornerAnnouncements}
          index={cornerIndex}
          onNext={() => setCornerIndex((prev) => (prev + 1) % cornerAnnouncements.length)}
          onDismiss={dismiss}
          onAcknowledge={(item) => void acknowledge(item)}
          acknowledgingIds={acknowledgingIds}
          getTitle={getLocalizedTitle}
          getMessage={getLocalizedMessage}
          getActionLabel={getLocalizedActionLabel}
          t={t}
        />,
        document.body,
      )}
    </>
  );
}
