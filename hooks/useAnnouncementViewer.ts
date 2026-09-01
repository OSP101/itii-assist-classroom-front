"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { addToast } from "@heroui/toast";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useI18n } from "@/hooks/useI18n";
import { authService } from "@/services/auth.service";
import userNotificationService from "@/services/user-notification.service";
import {
    removeAnnouncementLocally,
    useActiveAnnouncements,
    type VisibleAnnouncement,
} from "@/hooks/useActiveAnnouncements";
import {
    getDismissedIds,
    matchesCurrentPath,
    saveDismissedIds,
    shouldHideAnnouncement,
} from "@/lib/announcement-visibility";

/**
 * Everything the top ribbon and the banner stack share: which announcements
 * apply here, how to close one, how to acknowledge one, and how to read the
 * title and message in the viewer's language.
 */
export function useAnnouncementViewer() {
    const t = useI18n();
    const { language } = useGlobalSettings();
    const pathname = usePathname();
    const { announcements, isLoading, refresh } = useActiveAnnouncements();
    const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
    const [acknowledgingIds, setAcknowledgingIds] = useState<Set<number>>(new Set());

    const user = authService.getStoredUser();
    const userId = user?.id;

    useEffect(() => {
        if (!userId) {
            setDismissedIds(new Set());
            return;
        }
        setDismissedIds(getDismissedIds(userId));
    }, [userId]);

    const visibleAnnouncements = useMemo(
        () => announcements.filter(
            (item) => !shouldHideAnnouncement(item, dismissedIds) && matchesCurrentPath(item, pathname),
        ),
        [announcements, dismissedIds, pathname],
    );

    const dismiss = useCallback(
        (announcementId: number) => {
            if (!userId) return;
            setDismissedIds((prev) => {
                const next = new Set(prev);
                next.add(announcementId);
                saveDismissedIds(userId, next);
                return next;
            });
            // Drop it from the shared list too, so a ribbon closed here also
            // leaves the banner stack without waiting for the next poll.
            removeAnnouncementLocally(announcementId);
            // The server copy is what makes the dismissal survive a new device
            // or a cleared browser store.
            void userNotificationService.dismissAnnouncement(announcementId);
        },
        [userId],
    );

    const acknowledge = useCallback(
        async (item: VisibleAnnouncement) => {
            if (!item.id) return;
            setAcknowledgingIds((prev) => new Set([...prev, item.id]));
            const ok = await userNotificationService.acknowledgeAnnouncement(item.id);
            setAcknowledgingIds((prev) => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });

            if (!ok) {
                addToast({
                    title: t("error"),
                    description: t("adminSettingsUpdateFailed"),
                    color: "danger",
                });
                return;
            }

            addToast({
                title: t("success"),
                description: t("adminAnnouncementAcknowledged"),
                color: "success",
            });
            await refresh();
        },
        [refresh, t],
    );

    const getLocalizedTitle = useCallback(
        (item: VisibleAnnouncement) => (language === "th"
            ? (item.title_th?.trim() || item.title_en?.trim() || item.title)
            : (item.title_en?.trim() || item.title_th?.trim() || item.title)),
        [language],
    );

    const getLocalizedMessage = useCallback(
        (item: VisibleAnnouncement) => (language === "th"
            ? (item.message_th?.trim() || item.message_en?.trim() || item.message)
            : (item.message_en?.trim() || item.message_th?.trim() || item.message)),
        [language],
    );

    const getLocalizedActionLabel = useCallback(
        (item: VisibleAnnouncement) => (language === "th"
            ? (item.action_label_th?.trim() || item.action_label_en?.trim() || item.action_label?.trim() || t("adminAnnouncementOpenAction"))
            : (item.action_label_en?.trim() || item.action_label_th?.trim() || item.action_label?.trim() || t("adminAnnouncementOpenAction"))),
        [language, t],
    );

    return {
        t,
        language,
        user,
        isLoading,
        visibleAnnouncements,
        acknowledgingIds,
        dismiss,
        acknowledge,
        getLocalizedTitle,
        getLocalizedMessage,
        getLocalizedActionLabel,
    };
}
