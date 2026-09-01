import type { VisibleAnnouncement } from "@/hooks/useActiveAnnouncements";

const DISMISSED_KEY_PREFIX = "system-announcement-dismissed";

/**
 * Which of the app's areas an announcement is scoped to. Kept here rather than
 * in a component because the top ribbon and the banner stack both have to
 * answer the same question about the same announcement.
 */
export function matchesDisplayPathRule(rule: string, pathname: string): boolean {
    const normalizedRule = String(rule || "").trim().toLowerCase();
    if (!normalizedRule || normalizedRule === "all_pages") return true;
    if (normalizedRule === "admin_pages") return pathname.startsWith("/admin");
    if (normalizedRule === "student_pages") return pathname.startsWith("/student");
    if (normalizedRule === "student_notifications") return pathname.startsWith("/student/notifications");
    if (normalizedRule === "instructor_pages") return pathname.startsWith("/classroom") || pathname.startsWith("/home");
    if (normalizedRule === "classroom_pages") return pathname.startsWith("/classroom/");
    if (normalizedRule.startsWith("/")) return pathname.startsWith(normalizedRule);
    return false;
}

export function matchesCurrentPath(item: VisibleAnnouncement, pathname: string): boolean {
    const displayPaths = item.display_paths && item.display_paths.length > 0 ? item.display_paths : ["all_pages"];
    return displayPaths.some((rule) => matchesDisplayPathRule(rule, pathname));
}

function getDismissedStorageKey(userId: number): string {
    return `${DISMISSED_KEY_PREFIX}:${userId}`;
}

export function getDismissedIds(userId: number): Set<number> {
    if (typeof window === "undefined") {
        return new Set();
    }

    try {
        const raw = window.localStorage.getItem(getDismissedStorageKey(userId));
        if (!raw) {
            return new Set();
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return new Set();
        }
        return new Set(parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0));
    } catch {
        return new Set();
    }
}

export function saveDismissedIds(userId: number, ids: Set<number>): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.localStorage.setItem(getDismissedStorageKey(userId), JSON.stringify(Array.from(ids)));
    } catch {
        // no-op
    }
}

export function shouldHideAnnouncement(item: VisibleAnnouncement, dismissedIds: Set<number>): boolean {
    if (item.require_acknowledge && item.is_acknowledged) {
        return true;
    }

    if (!item.require_acknowledge && item.is_dismissible && dismissedIds.has(item.id)) {
        return true;
    }

    return false;
}
