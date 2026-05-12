import type { AppLanguage, TranslationValues } from "@/lib/i18n";

type NotificationTranslator = (key: string, values?: TranslationValues) => string;

type NotificationData = Record<string, unknown>;

export interface NotificationDisplaySource {
    type?: string | null;
    title?: string | null;
    message?: string | null;
    data?: NotificationData | null;
}

const THAI_TEXT_PATTERN = /[\u0E00-\u0E7F]/;

const ACTION_KEY_BY_TYPE: Record<string, string> = {
    assignment_created: "assignmentCreated",
    assignment_updated: "assignmentUpdated",
    attendance_created: "attendanceCreated",
    attendance_started: "attendanceOpened",
    attendance_opened: "attendanceOpened",
    attendance_closed: "attendanceClosed",
    queue_created: "queueCreated",
    queue_updated: "queueUpdated",
    queue_opened: "queueOpened",
    queue_closed: "queueClosed",
    score_edit_request: "scoreEditRequest",
    score_edit_approved: "scoreEditApproved",
    score_edit_rejected: "scoreEditRejected",
    admin_message: "systemAnnouncement",
};

const MESSAGE_KEY_BY_TYPE: Record<string, string> = {
    assignment_created: "assignmentCreatedInCourse",
    assignment_updated: "assignmentUpdatedInCourse",
    attendance_created: "attendanceCreatedInCourse",
    attendance_started: "attendanceOpenedInCourse",
    attendance_opened: "attendanceOpenedInCourse",
    attendance_closed: "attendanceClosedInCourse",
    queue_created: "queueCreatedInCourse",
    queue_updated: "queueUpdatedInCourse",
    queue_opened: "queueOpenedInCourse",
    queue_closed: "queueClosedInCourse",
    score_edit_request: "scoreEditRequestSubmitted",
    score_edit_approved: "scoreEditApprovedMessage",
    score_edit_rejected: "scoreEditRejectedMessage",
    admin_message: "systemAnnouncementReceived",
};

function isRecord(value: unknown): value is NotificationData {
    return typeof value === "object" && value !== null;
}

function getNotificationData(data?: NotificationData | null): NotificationData {
    return isRecord(data) ? data : {};
}

function pickString(...values: unknown[]): string {
    for (const value of values) {
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed) {
                return trimmed;
            }
        }
    }
    return "";
}

function containsThaiText(value: string): boolean {
    return THAI_TEXT_PATTERN.test(value);
}

function isSystemGeneratedNotification(type?: string | null): boolean {
    return String(type || "") !== "admin_message";
}

function getRawTitle(notification: NotificationDisplaySource): string {
    const data = getNotificationData(notification.data);
    return pickString(notification.title, data.title);
}

function getRawMessage(notification: NotificationDisplaySource): string {
    const data = getNotificationData(notification.data);
    return pickString(notification.message, data.body, data.message);
}

export function getNotificationActionLabel(
    type: string | null | undefined,
    t: NotificationTranslator,
): string {
    return t(ACTION_KEY_BY_TYPE[String(type || "")] || "genericUpdate");
}

export function getNotificationEntityName(
    notification: NotificationDisplaySource,
    language: AppLanguage,
): string {
    const data = getNotificationData(notification.data);
    const fromPayload = pickString(data.resource_name, data.resourceName, data.name);
    if (fromPayload) {
        return fromPayload;
    }

    const rawTitle = getRawTitle(notification);
    if (!rawTitle) {
        return "";
    }

    if (rawTitle.includes(":")) {
        const tail = rawTitle.split(":").slice(1).join(":").trim();
        if (tail) {
            return tail;
        }
    }

    if (language === "en" && isSystemGeneratedNotification(notification.type) && containsThaiText(rawTitle)) {
        return "";
    }

    return rawTitle;
}

export function getNotificationHeadline(
    notification: NotificationDisplaySource,
    language: AppLanguage,
    t: NotificationTranslator,
): string {
    const actionLabel = getNotificationActionLabel(notification.type, t);
    const entityName = getNotificationEntityName(notification, language);

    if (entityName) {
        return `${actionLabel}: ${entityName}`;
    }

    const rawTitle = getRawTitle(notification);
    if (rawTitle && (language === "th" || !isSystemGeneratedNotification(notification.type) || !containsThaiText(rawTitle))) {
        return rawTitle;
    }

    return actionLabel;
}

export function getNotificationMessage(
    notification: NotificationDisplaySource,
    language: AppLanguage,
    t: NotificationTranslator,
): string {
    const rawMessage = getRawMessage(notification);

    if (rawMessage) {
        if (language === "th" || !isSystemGeneratedNotification(notification.type) || !containsThaiText(rawMessage)) {
            return rawMessage;
        }
    }

    return t(MESSAGE_KEY_BY_TYPE[String(notification.type || "")] || "updatedInCourse");
}