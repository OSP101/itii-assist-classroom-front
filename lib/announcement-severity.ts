import type { AnnouncementSeverity } from "@/services/admin-settings.service";

/**
 * One visual treatment per announcement severity, shared by the live banner
 * layer and the admin composer's preview so what an admin sees while writing
 * is what everybody else gets.
 */
export interface AnnouncementSeverityStyle {
    /** Border and background for the banner shell. */
    banner: string;
    title: string;
    body: string;
    icon: string;
    iconClass: string;
    /** Pill showing the severity name. */
    chip: string;
    /** i18n key for the severity's label. */
    labelKey: string;
}

export const ANNOUNCEMENT_SEVERITY_STYLES: Record<AnnouncementSeverity, AnnouncementSeverityStyle> = {
    info: {
        banner: "border-sky-200 bg-linear-to-r from-sky-50 to-cyan-50 dark:border-sky-900/60 dark:from-sky-950/60 dark:to-cyan-950/40",
        title: "text-sky-900 dark:text-sky-100",
        body: "text-sky-800/90 dark:text-sky-200/80",
        icon: "solar:bell-bold",
        iconClass: "text-sky-500",
        chip: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200",
        labelKey: "adminAnnouncementSeverityInfo",
    },
    success: {
        banner: "border-emerald-200 bg-linear-to-r from-emerald-50 to-teal-50 dark:border-emerald-900/60 dark:from-emerald-950/60 dark:to-teal-950/40",
        title: "text-emerald-900 dark:text-emerald-100",
        body: "text-emerald-800/90 dark:text-emerald-200/80",
        icon: "solar:check-circle-bold",
        iconClass: "text-emerald-500",
        chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200",
        labelKey: "adminAnnouncementSeveritySuccess",
    },
    warning: {
        banner: "border-amber-300 bg-linear-to-r from-amber-50 to-orange-50 dark:border-amber-900/60 dark:from-amber-950/60 dark:to-orange-950/40",
        title: "text-amber-900 dark:text-amber-100",
        body: "text-amber-800/90 dark:text-amber-200/80",
        icon: "solar:danger-triangle-bold",
        iconClass: "text-amber-500",
        chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100",
        labelKey: "adminAnnouncementSeverityWarning",
    },
    urgent: {
        banner: "border-rose-300 bg-linear-to-r from-rose-50 to-red-50 dark:border-rose-900/60 dark:from-rose-950/60 dark:to-red-950/40",
        title: "text-rose-900 dark:text-rose-100",
        body: "text-rose-800/90 dark:text-rose-200/80",
        icon: "solar:siren-bold",
        iconClass: "text-rose-500",
        chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200",
        labelKey: "adminAnnouncementSeverityUrgent",
    },
};

/** Falls back to the neutral treatment for a severity written by an older client. */
export function getAnnouncementSeverityStyle(severity?: string | null): AnnouncementSeverityStyle {
    return ANNOUNCEMENT_SEVERITY_STYLES[(severity || "info") as AnnouncementSeverity]
        || ANNOUNCEMENT_SEVERITY_STYLES.info;
}

/** Colours for the full-width top ribbon, which is solid rather than tinted. */
export interface AnnouncementRibbonStyle {
    bar: string;
    text: string;
    badge: string;
    icon: string;
}

export const ANNOUNCEMENT_RIBBON_STYLES: Record<AnnouncementSeverity, AnnouncementRibbonStyle> = {
    info: {
        bar: "bg-sky-600 dark:bg-sky-700",
        text: "text-white",
        badge: "bg-white/20 text-white",
        icon: "solar:bell-bold",
    },
    success: {
        bar: "bg-emerald-600 dark:bg-emerald-700",
        text: "text-white",
        badge: "bg-white/20 text-white",
        icon: "solar:check-circle-bold",
    },
    warning: {
        bar: "bg-amber-500 dark:bg-amber-600",
        text: "text-amber-950 dark:text-white",
        badge: "bg-black/15 text-amber-950 dark:bg-white/20 dark:text-white",
        icon: "solar:danger-triangle-bold",
    },
    urgent: {
        bar: "bg-rose-600 dark:bg-rose-700",
        text: "text-white",
        badge: "bg-white/20 text-white",
        icon: "solar:siren-bold",
    },
};

export function getAnnouncementRibbonStyle(severity?: string | null): AnnouncementRibbonStyle {
    return ANNOUNCEMENT_RIBBON_STYLES[(severity || "info") as AnnouncementSeverity]
        || ANNOUNCEMENT_RIBBON_STYLES.info;
}
