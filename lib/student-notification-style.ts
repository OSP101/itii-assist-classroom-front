/**
 * Icon and colour for a notification row in the student zone.
 *
 * The mapping lived inline in three different screens with three slightly
 * different icon sets, so the same notification looked different depending on
 * where you saw it. Keep it here so a queue notification is always violet.
 */
export interface NotifStyle {
	icon: string;
	bg: string;
	fg: string;
}

export const NOTIF_STYLE: Record<string, NotifStyle> = {
	score: { icon: "solar:diploma-linear", bg: "var(--cg-info-soft)", fg: "var(--cg-info)" },
	attendance: { icon: "solar:check-circle-linear", bg: "var(--cg-success-soft)", fg: "var(--cg-success)" },
	queue: { icon: "solar:users-group-rounded-linear", bg: "var(--cg-violet-soft)", fg: "var(--cg-violet)" },
	bonus: { icon: "solar:star-linear", bg: "var(--cg-warning-soft)", fg: "var(--cg-warning)" },
	announcement: { icon: "solar:megaphone-linear", bg: "var(--cg-danger-soft)", fg: "var(--cg-danger)" },
	default: { icon: "solar:bell-linear", bg: "var(--cg-fill)", fg: "var(--cg-text-2)" },
};

/** Notification types are prefixed strings such as `queue_called`, `score_updated`. */
export function notifStyleFor(type: string | undefined): NotifStyle {
	if (!type) return NOTIF_STYLE.default;
	const lower = type.toLowerCase();
	const key = Object.keys(NOTIF_STYLE).find((k) => k !== "default" && lower.includes(k));
	return NOTIF_STYLE[key ?? "default"];
}
