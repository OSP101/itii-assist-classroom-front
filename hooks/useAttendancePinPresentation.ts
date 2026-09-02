import { useEffect, useState } from "react";

type PinSessionLike = {
    pin_code?: string | null;
    pin_issued?: boolean;
    pin_issued_at?: string | null;
    pin_rotates_at?: string | null;
    auto_rotate_pin?: boolean;
    pin_mode?: "static" | "rotating" | string;
    status?: "draft" | "active" | "closed" | string;
};

/**
 * The one rule every screen must use to decide "does this session's PIN
 * rotate?". It used to be re-written inline on each screen, and the variants
 * disagreed: the countdown hook read `pin_mode === "static" || !auto_rotate_pin`
 * (static wins) while the check-in page and the instructor's QR modal read
 * `pin_mode === "rotating" || ...` (rotating wins). `pin_mode` is served from
 * the Redis runtime state and `auto_rotate_pin` from the session row, so the
 * two can briefly disagree — and when they did, the same session showed a
 * "PIN เปลี่ยนทุก 1 นาที" label with no countdown next to it.
 *
 * An explicit "this does not rotate" from either field wins; a field that is
 * missing from the payload defers to the other one.
 */
export function isRotatingPinSession(session: PinSessionLike | null | undefined): boolean {
    if (!session) return false;
    if (session.pin_mode === "static") return false;
    if (session.pin_mode === "rotating") return session.auto_rotate_pin !== false;
    return Boolean(session.auto_rotate_pin);
}

/** Convenience inverse of {@link isRotatingPinSession}, for static-mode copy. */
export function isStaticPinSession(session: PinSessionLike | null | undefined): boolean {
    return !isRotatingPinSession(session);
}

type PinPresentationState = {
    isPending: boolean;
    isStatic: boolean;
    secondsLeft: number | null;
    totalSeconds: number | null;
};

const initialState: PinPresentationState = {
    isPending: false,
    isStatic: false,
    secondsLeft: null,
    totalSeconds: null,
};

function sameState(a: PinPresentationState, b: PinPresentationState): boolean {
    return (
        a.isPending === b.isPending &&
        a.isStatic === b.isStatic &&
        a.secondsLeft === b.secondsLeft &&
        a.totalSeconds === b.totalSeconds
    );
}

export function useAttendancePinPresentation(session: PinSessionLike | null | undefined): PinPresentationState {
    const [state, setState] = useState<PinPresentationState>(initialState);

    useEffect(() => {
        if (!session || session.status !== "active") {
            setState((prev) => (sameState(prev, initialState) ? prev : initialState));
            return;
        }

        // The public check-in route withholds pin_code and answers with the
        // pin_issued flag instead, while the instructor and classroom-display
        // routes still send the code itself — accept either as proof that a
        // PIN exists, so this hook works on all three screens.
        const hasPin = session.pin_issued ?? Boolean(session.pin_code);

        if (!hasPin) {
            const pending = { ...initialState, isPending: true };
            setState((prev) => (sameState(prev, pending) ? prev : pending));
            return;
        }

        if (!isRotatingPinSession(session) || !session.pin_rotates_at) {
            const staticState = { ...initialState, isStatic: true };
            setState((prev) => (sameState(prev, staticState) ? prev : staticState));
            return;
        }

        const issuedAtMs = session.pin_issued_at ? new Date(session.pin_issued_at).getTime() : Date.now();
        const rotatesAtMs = new Date(session.pin_rotates_at).getTime();

        if (!Number.isFinite(issuedAtMs) || !Number.isFinite(rotatesAtMs) || rotatesAtMs <= issuedAtMs) {
            const expired = { ...initialState, secondsLeft: 0 };
            setState((prev) => (sameState(prev, expired) ? prev : expired));
            return;
        }

        let timeoutId = 0;
        const totalSeconds = Math.max(1, Math.ceil((rotatesAtMs - issuedAtMs) / 1000));

        // Only whole seconds are ever rendered, so the timer wakes on second
        // boundaries instead of every animation frame. The rAF loop this
        // replaces re-rendered the whole consuming page ~60 times a second for
        // a number that changes once a second, which on a phone starved the
        // touch handling of the buttons and PIN inputs sitting under it (taps
        // needed a second attempt to register) and thrashed every effect that
        // depends on the countdown.
        const tick = () => {
            const remainingMs = Math.max(0, rotatesAtMs - Date.now());
            const next: PinPresentationState = {
                isPending: false,
                isStatic: false,
                secondsLeft: Math.ceil(remainingMs / 1000),
                totalSeconds,
            };

            setState((prev) => (sameState(prev, next) ? prev : next));

            if (remainingMs <= 0) {
                return;
            }

            // `remainingMs % 1000` is exactly how long until the ceil() above
            // drops to the next whole second (0 means we just landed on a
            // boundary, so wait a full second); the small pad absorbs timer
            // jitter so a tick never lands a hair early and repeats itself.
            timeoutId = window.setTimeout(tick, (remainingMs % 1000 || 1000) + 20);
        };

        tick();

        return () => window.clearTimeout(timeoutId);
    }, [
        session?.auto_rotate_pin,
        session?.pin_mode,
        session?.pin_code,
        session?.pin_issued,
        session?.pin_issued_at,
        session?.pin_rotates_at,
        session?.status,
    ]);

    return state;
}
