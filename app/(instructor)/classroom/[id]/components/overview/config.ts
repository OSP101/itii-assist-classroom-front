type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

// Assignment Type Configuration
export const ASSIGNMENT_TYPE_CONFIG: Record<string, {
    label: string;
    shortLabel: string;
    labelKey: string;
    shortLabelKey: string;
    icon: string;
    color: "primary" | "secondary" | "success" | "warning" | "danger";
    bgClass: string;
    textClass: string;
    borderClass: string;
    gradientClass: string;
}> = {
    individual: {
        label: "Lab (งานเดี่ยว)",
        shortLabel: "Laboratory",
        labelKey: "assignmentTypeIndividualLabel",
        shortLabelKey: "assignmentTypeIndividualShort",
        icon: "solar:monitor-bold",
        color: "primary",
        bgClass: "bg-blue-100",
        textClass: "text-blue-600",
        borderClass: "border-blue-200",
        gradientClass: "from-blue-500 to-blue-600",
    },
    assignment: {
        label: "Assignment (การบ้าน)",
        shortLabel: "Assignment",
        labelKey: "assignmentTypeAssignmentLabel",
        shortLabelKey: "assignmentTypeAssignmentShort",
        icon: "solar:clipboard-text-bold",
        color: "warning",
        bgClass: "bg-amber-100",
        textClass: "text-amber-600",
        borderClass: "border-amber-200",
        gradientClass: "from-amber-500 to-amber-600",
    },
    permanent_group: {
        label: "งานกลุ่ม",
        shortLabel: "งานกลุ่ม",
        labelKey: "assignmentTypeGroupLabel",
        shortLabelKey: "assignmentTypeGroupShort",
        icon: "solar:users-group-rounded-bold",
        color: "secondary",
        bgClass: "bg-purple-100",
        textClass: "text-purple-600",
        borderClass: "border-purple-200",
        gradientClass: "from-purple-500 to-purple-600",
    },
    weekly_group: {
        label: "กลุ่มรายสัปดาห์",
        shortLabel: "กลุ่มรายสัปดาห์",
        labelKey: "assignmentTypeWeeklyGroupLabel",
        shortLabelKey: "assignmentTypeWeeklyGroupShort",
        icon: "solar:calendar-bold",
        color: "success",
        bgClass: "bg-emerald-100",
        textClass: "text-emerald-600",
        borderClass: "border-emerald-200",
        gradientClass: "from-emerald-500 to-emerald-600",
    },
};

export const getAssignmentTypeConfig = (type: string, t?: TranslateFn) => {
    const config = ASSIGNMENT_TYPE_CONFIG[type] || ASSIGNMENT_TYPE_CONFIG.individual;

    if (!t) {
        return config;
    }

    return {
        ...config,
        label: t(config.labelKey),
        shortLabel: t(config.shortLabelKey),
    };
};

/**
 * Format relative time from date string
 */
export const formatRelativeTime = (
    dateString: string | null,
    language: "th" | "en" = "th",
    t?: TranslateFn,
): string => {
    if (!dateString) return t ? t("noData") : "ไม่มีข้อมูล";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (!t) {
        if (minutes < 1) return "เมื่อสักครู่";
        if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
        if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
        if (days < 7) return `${days} วันที่แล้ว`;
        return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    }

    if (minutes < 1) return t("justNow");
    if (minutes < 60) {
        if (language === "th") {
            return `${minutes} ${t("minutesAgo")}`;
        }
        return `${minutes} ${minutes === 1 ? t("minuteAgo") : t("minutesAgo")}`;
    }
    if (hours < 24) {
        if (language === "th") {
            return `${hours} ${t("hoursAgo")}`;
        }
        return `${hours} ${hours === 1 ? t("hourAgo") : t("hoursAgo")}`;
    }
    if (days < 7) {
        if (language === "th") {
            return `${days} ${t("daysAgo")}`;
        }
        return `${days} ${days === 1 ? t("dayAgo") : t("daysAgo")}`;
    }
    return date.toLocaleDateString(language === "en" ? "en-US" : "th-TH", { day: "numeric", month: "short" });
};
