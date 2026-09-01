"use client";

import { useCallback, useEffect, useState } from "react";
import { adminSettingsService, type Announcement } from "@/services/admin-settings.service";
import { authService } from "@/services/auth.service";

export type VisibleAnnouncement = Announcement & {
    is_acknowledged?: boolean;
};

const REFRESH_INTERVAL_MS = 60000;

/**
 * The announcement list is now read by two components at once — the top ribbon
 * sits above the page header while the banner stack lives inside the content —
 * and both are mounted on every page. A module-level store keeps that to a
 * single request and a single timer no matter how many of them subscribe.
 */
let cachedAnnouncements: VisibleAnnouncement[] = [];
let hasLoadedOnce = false;
let inFlight: Promise<void> | null = null;
let pollTimer: number | null = null;
const subscribers = new Set<(rows: VisibleAnnouncement[]) => void>();

function publish(): void {
    for (const notify of subscribers) {
        notify(cachedAnnouncements);
    }
}

async function loadAnnouncements(): Promise<void> {
    if (!authService.isAuthenticated()) {
        cachedAnnouncements = [];
        hasLoadedOnce = true;
        publish();
        return;
    }

    try {
        cachedAnnouncements = await adminSettingsService.getActiveAnnouncements();
    } catch {
        cachedAnnouncements = [];
    } finally {
        hasLoadedOnce = true;
        publish();
    }
}

/** Collapses concurrent callers onto the one request already running. */
function refreshAnnouncements(): Promise<void> {
    if (!inFlight) {
        inFlight = loadAnnouncements().finally(() => {
            inFlight = null;
        });
    }
    return inFlight;
}

function startPolling(): void {
    if (pollTimer !== null || typeof window === "undefined") return;
    pollTimer = window.setInterval(() => {
        void refreshAnnouncements();
    }, REFRESH_INTERVAL_MS);
}

function stopPolling(): void {
    if (pollTimer === null || typeof window === "undefined") return;
    window.clearInterval(pollTimer);
    pollTimer = null;
}

/**
 * Drops one announcement from the shared list straight away, so a dismissal or
 * acknowledgement removes it from every subscriber at once without waiting for
 * the next poll.
 */
export function removeAnnouncementLocally(announcementId: number): void {
    cachedAnnouncements = cachedAnnouncements.filter((item) => item.id !== announcementId);
    publish();
}

export function useActiveAnnouncements() {
    const [announcements, setAnnouncements] = useState<VisibleAnnouncement[]>(cachedAnnouncements);
    const [isLoading, setIsLoading] = useState(!hasLoadedOnce);

    useEffect(() => {
        const notify = (rows: VisibleAnnouncement[]) => {
            setAnnouncements(rows);
            setIsLoading(false);
        };

        subscribers.add(notify);
        startPolling();

        if (hasLoadedOnce) {
            notify(cachedAnnouncements);
        } else {
            void refreshAnnouncements();
        }

        return () => {
            subscribers.delete(notify);
            if (subscribers.size === 0) {
                stopPolling();
            }
        };
    }, []);

    const refresh = useCallback(() => refreshAnnouncements(), []);

    return { announcements, isLoading, refresh };
}
